/**
 * SQLite access layer. Schema lives in migrations.js; this module opens the DB,
 * runs migrations and exposes prepared statements + small helpers.
 */
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { runMigrations } from './migrations.js';

export function openDb(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const applied = runMigrations(db);
  if (applied.length) console.log('[db] applied migrations: ' + applied.join(', '));

  const stmt = {
    raw: db,

    upsertUser: db.prepare(`
      INSERT INTO users (google_sub, email, name, picture, created_at, last_seen_at)
      VALUES (@google_sub, @email, @name, @picture, @now, @now)
      ON CONFLICT(google_sub) DO UPDATE SET
        email = excluded.email,
        name = excluded.name,
        picture = excluded.picture,
        last_seen_at = excluded.last_seen_at
      RETURNING *
    `),
    getUserById: db.prepare('SELECT * FROM users WHERE id = ?'),
    setUserTz: db.prepare('UPDATE users SET tz = ? WHERE id = ?'),
    setUserTheme: db.prepare('UPDATE users SET theme = ? WHERE id = ?'),
    deleteUser: db.prepare('DELETE FROM users WHERE id = ?'),
    allConfirmedUsers: db.prepare('SELECT * FROM users'),

    // metrics
    insertMetric: db.prepare(`
      INSERT INTO metrics (user_id, kind, value, unit, day, note, created_at)
      VALUES (@user_id, @kind, @value, @unit, @day, @note, @now)
      RETURNING *
    `),
    listMetrics: db.prepare(`
      SELECT * FROM metrics WHERE user_id = ? AND kind = ? ORDER BY day ASC, id ASC
    `),
    listAllMetrics: db.prepare(`
      SELECT * FROM metrics WHERE user_id = ? ORDER BY day ASC, id ASC
    `),
    deleteMetric: db.prepare('DELETE FROM metrics WHERE id = ? AND user_id = ?'),
    distinctMetricKinds: db.prepare(
      'SELECT DISTINCT kind FROM metrics WHERE user_id = ? ORDER BY kind'),

    // checkins
    upsertCheckin: db.prepare(`
      INSERT INTO checkins (user_id, day, kind, note, created_at)
      VALUES (@user_id, @day, @kind, @note, @now)
      ON CONFLICT(user_id, day) DO UPDATE SET kind = excluded.kind, note = excluded.note
      RETURNING *
    `),
    deleteCheckin: db.prepare('DELETE FROM checkins WHERE user_id = ? AND day = ?'),
    getCheckin: db.prepare('SELECT * FROM checkins WHERE user_id = ? AND day = ?'),
    listCheckins: db.prepare(
      'SELECT * FROM checkins WHERE user_id = ? AND day >= ? ORDER BY day ASC'),
    countCheckins: db.prepare('SELECT COUNT(*) n FROM checkins WHERE user_id = ?'),

    // workouts
    insertWorkout: db.prepare(`
      INSERT INTO workouts (user_id, day, category, title, duration_min, place, intensity, note, created_at)
      VALUES (@user_id, @day, @category, @title, @duration_min, @place, @intensity, @note, @now)
      RETURNING *
    `),
    insertSet: db.prepare(`
      INSERT INTO workout_sets (workout_id, exercise, weight, reps, set_count, sort)
      VALUES (@workout_id, @exercise, @weight, @reps, @set_count, @sort)
    `),
    listWorkouts: db.prepare(
      'SELECT * FROM workouts WHERE user_id = ? ORDER BY day DESC, id DESC LIMIT ?'),
    getWorkout: db.prepare('SELECT * FROM workouts WHERE id = ? AND user_id = ?'),
    listSets: db.prepare('SELECT * FROM workout_sets WHERE workout_id = ? ORDER BY sort, id'),
    deleteWorkout: db.prepare('DELETE FROM workouts WHERE id = ? AND user_id = ?'),
    countWorkouts: db.prepare('SELECT COUNT(*) n FROM workouts WHERE user_id = ?'),
    sumVolume: db.prepare(`
      SELECT COALESCE(SUM(s.weight * s.reps * COALESCE(s.set_count, 1)), 0) v
      FROM workout_sets s JOIN workouts w ON w.id = s.workout_id
      WHERE w.user_id = ?`),

    // ---- activities (GPS-tracked outdoor sessions, from the Android app) ----
    insertActivity: db.prepare(`
      INSERT INTO activities (user_id, type, day, start_time, end_time, distance_m,
        duration_s, moving_time_s, avg_speed_mps, max_speed_mps, elevation_gain_m,
        steps, polyline, point_count, title, note, source, client_uuid, created_at)
      VALUES (@user_id, @type, @day, @start_time, @end_time, @distance_m,
        @duration_s, @moving_time_s, @avg_speed_mps, @max_speed_mps, @elevation_gain_m,
        @steps, @polyline, @point_count, @title, @note, @source, @client_uuid, @now)
      RETURNING *
    `),
    getActivity: db.prepare('SELECT * FROM activities WHERE id = ? AND user_id = ?'),
    getActivityByUuid: db.prepare('SELECT * FROM activities WHERE user_id = ? AND client_uuid = ?'),
    listActivities: db.prepare(
      'SELECT * FROM activities WHERE user_id = ? ORDER BY COALESCE(start_time, created_at) DESC, id DESC LIMIT ?'),
    deleteActivity: db.prepare('DELETE FROM activities WHERE id = ? AND user_id = ?'),
    countActivities: db.prepare('SELECT COUNT(*) n FROM activities WHERE user_id = ?'),
    countActivitiesByType: db.prepare('SELECT COUNT(*) n FROM activities WHERE user_id = ? AND type = ?'),
    sumActivityDistance: db.prepare('SELECT COALESCE(SUM(distance_m), 0) m FROM activities WHERE user_id = ?'),

    // ---- device pairing (native app auth) ----
    insertPairing: db.prepare(`
      INSERT INTO pairing_codes (code, user_id, created_at, expires_at, consumed)
      VALUES (@code, @user_id, @now, @expires, 0)`),
    getPairing: db.prepare('SELECT * FROM pairing_codes WHERE code = ?'),
    consumePairing: db.prepare('UPDATE pairing_codes SET consumed = 1 WHERE code = ?'),
    insertDeviceToken: db.prepare(`
      INSERT INTO device_tokens (user_id, name, token_hash, created_at, last_seen_at)
      VALUES (@user_id, @name, @token_hash, @now, @now) RETURNING *`),
    deviceByHash: db.prepare('SELECT * FROM device_tokens WHERE token_hash = ?'),
    touchDevice: db.prepare('UPDATE device_tokens SET last_seen_at = ? WHERE id = ?'),
    listDevices: db.prepare(
      'SELECT id, name, created_at, last_seen_at, revoked FROM device_tokens WHERE user_id = ? AND revoked = 0 ORDER BY created_at DESC'),
    revokeDevice: db.prepare('UPDATE device_tokens SET revoked = 1 WHERE id = ? AND user_id = ?'),

    // nutrition
    upsertNutrition: db.prepare(`
      INSERT INTO nutrition_logs (user_id, day, kcal, protein_g, carbs_g, fat_g, quality, water_ml, note, created_at)
      VALUES (@user_id, @day, @kcal, @protein_g, @carbs_g, @fat_g, @quality, @water_ml, @note, @now)
      ON CONFLICT(user_id, day) DO UPDATE SET
        kcal=excluded.kcal, protein_g=excluded.protein_g, carbs_g=excluded.carbs_g,
        fat_g=excluded.fat_g, quality=excluded.quality, water_ml=excluded.water_ml, note=excluded.note
      RETURNING *
    `),
    listNutrition: db.prepare(
      'SELECT * FROM nutrition_logs WHERE user_id = ? AND day >= ? ORDER BY day ASC'),
    getNutrition: db.prepare('SELECT * FROM nutrition_logs WHERE user_id = ? AND day = ?'),

    // gamification
    insertXp: db.prepare(`
      INSERT INTO xp_events (user_id, amount, reason, day, created_at, ref)
      VALUES (@user_id, @amount, @reason, @day, @now, @ref)
    `),
    sumXp: db.prepare('SELECT COALESCE(SUM(amount),0) xp FROM xp_events WHERE user_id = ?'),
    delXpByRef: db.prepare('DELETE FROM xp_events WHERE user_id = ? AND ref = ?'),
    delAllXp: db.prepare('DELETE FROM xp_events WHERE user_id = ?'),
    allEntriesWithXp: db.prepare(`
      SELECT e.id, e.day, t.xp FROM tracker_entries e
      JOIN trackers t ON t.id = e.tracker_id WHERE t.user_id = ? ORDER BY e.created_at`),
    bridgeDays: db.prepare(`
      SELECT day FROM freeze_events WHERE user_id = ? AND type = 'apply' AND reason = 'auto_bridge'`),
    recentXp: db.prepare(
      'SELECT * FROM xp_events WHERE user_id = ? ORDER BY created_at DESC LIMIT ?'),
    updateUserGami: db.prepare(`
      UPDATE users SET xp=@xp, level=@level, streak_current=@streak_current,
        streak_best=@streak_best, last_checkin_day=@last_checkin_day WHERE id=@id`),
    hasAchievement: db.prepare(
      'SELECT 1 FROM user_achievements WHERE user_id = ? AND code = ?'),
    insertAchievement: db.prepare(`
      INSERT OR IGNORE INTO user_achievements (user_id, code, unlocked_at)
      VALUES (?, ?, ?)`),
    listAchievements: db.prepare(
      'SELECT code, unlocked_at FROM user_achievements WHERE user_id = ?'),

    // email
    getPrefs: db.prepare('SELECT * FROM email_prefs WHERE user_id = ?'),
    upsertPrefs: db.prepare(`
      INSERT INTO email_prefs (user_id, weekly, streak_alert, daily_nudge, confirmed, token, updated_at)
      VALUES (@user_id, @weekly, @streak_alert, @daily_nudge, @confirmed, @token, @now)
      ON CONFLICT(user_id) DO UPDATE SET
        weekly=excluded.weekly, streak_alert=excluded.streak_alert,
        daily_nudge=excluded.daily_nudge, confirmed=excluded.confirmed, updated_at=excluded.updated_at
      RETURNING *
    `),
    prefsByToken: db.prepare('SELECT * FROM email_prefs WHERE token = ?'),
    setConfirmed: db.prepare('UPDATE email_prefs SET confirmed = ? WHERE user_id = ?'),
    setUnsubscribed: db.prepare(
      'UPDATE email_prefs SET weekly=0, streak_alert=0, daily_nudge=0 WHERE token = ?'),
    logEmail: db.prepare(`
      INSERT OR IGNORE INTO email_log (user_id, type, day, sent_at) VALUES (?, ?, ?, ?)`),
    wasEmailSent: db.prepare(
      'SELECT 1 FROM email_log WHERE user_id = ? AND type = ? AND day = ?'),

    // ---- trackers (universal user-defined tracking) ----
    insertTracker: db.prepare(`
      INSERT INTO trackers (user_id, name, type, unit, icon, color, category, options,
        goal_value, goal_direction, scale_min, scale_max, xp, reminder_time, sort, created_at)
      VALUES (@user_id, @name, @type, @unit, @icon, @color, @category, @options,
        @goal_value, @goal_direction, @scale_min, @scale_max, @xp, @reminder_time, @sort, @now)
      RETURNING *
    `),
    updateTracker: db.prepare(`
      UPDATE trackers SET name=@name, type=@type, unit=@unit, icon=@icon, color=@color,
        category=@category, options=@options, goal_value=@goal_value, goal_direction=@goal_direction,
        scale_min=@scale_min, scale_max=@scale_max, xp=@xp, reminder_time=@reminder_time,
        sort=@sort, archived=@archived
      WHERE id=@id AND user_id=@user_id RETURNING *
    `),
    getTracker: db.prepare('SELECT * FROM trackers WHERE id = ? AND user_id = ?'),
    listTrackers: db.prepare(
      'SELECT * FROM trackers WHERE user_id = ? AND archived = 0 ORDER BY sort, id'),
    listAllTrackers: db.prepare(
      'SELECT * FROM trackers WHERE user_id = ? ORDER BY archived, sort, id'),
    deleteTracker: db.prepare('DELETE FROM trackers WHERE id = ? AND user_id = ?'),
    countTrackers: db.prepare('SELECT COUNT(*) n FROM trackers WHERE user_id = ?'),
    reorderTracker: db.prepare('UPDATE trackers SET sort = ? WHERE id = ? AND user_id = ?'),

    insertEntry: db.prepare(`
      INSERT INTO tracker_entries (tracker_id, value, text_value, day, note, created_at)
      VALUES (@tracker_id, @value, @text_value, @day, @note, @now)
      RETURNING *
    `),
    listEntries: db.prepare(
      'SELECT * FROM tracker_entries WHERE tracker_id = ? AND day >= ? ORDER BY day ASC, id ASC'),
    listAllEntries: db.prepare(
      'SELECT * FROM tracker_entries WHERE tracker_id = ? ORDER BY day ASC, id ASC'),
    latestEntry: db.prepare(
      'SELECT * FROM tracker_entries WHERE tracker_id = ? ORDER BY day DESC, id DESC LIMIT 1'),
    deleteEntry: db.prepare(`
      DELETE FROM tracker_entries WHERE id = ? AND tracker_id IN
        (SELECT id FROM trackers WHERE user_id = ?)`),
    countEntries: db.prepare(`
      SELECT COUNT(*) n FROM tracker_entries e
      JOIN trackers t ON t.id = e.tracker_id WHERE t.user_id = ?`),

    // ---- user-editable option lists (activity types, workout categories) ----
    listOptions: db.prepare(
      'SELECT * FROM user_options WHERE user_id = ? AND domain = ? ORDER BY sort, id'),
    insertOption: db.prepare(`
      INSERT INTO user_options (user_id, domain, label, icon, color, sort)
      VALUES (@user_id, @domain, @label, @icon, @color, @sort) RETURNING *`),
    deleteOption: db.prepare('DELETE FROM user_options WHERE id = ? AND user_id = ?'),

    // ---- personal records ----
    getPR: db.prepare('SELECT * FROM personal_records WHERE user_id = ? AND exercise = ?'),
    upsertPR: db.prepare(`
      INSERT INTO personal_records (user_id, exercise, weight, reps, est_1rm, day, created_at)
      VALUES (@user_id, @exercise, @weight, @reps, @est_1rm, @day, @now)
      ON CONFLICT(user_id, exercise) DO UPDATE SET
        weight=excluded.weight, reps=excluded.reps, est_1rm=excluded.est_1rm,
        day=excluded.day, created_at=excluded.created_at
      RETURNING *`),
    listPRs: db.prepare(
      'SELECT * FROM personal_records WHERE user_id = ? ORDER BY est_1rm DESC'),

    // ---- streak freeze ----
    getFreeze: db.prepare('SELECT * FROM streak_freeze WHERE user_id = ?'),
    createFreeze: db.prepare(`
      INSERT INTO streak_freeze (user_id, description, updated_at)
      VALUES (@user_id, @description, @now) RETURNING *`),
    updateFreezeConfig: db.prepare(`
      UPDATE streak_freeze SET
        enabled=@enabled, name=@name, icon=@icon, color=@color, description=@description,
        max_freezes=@max_freezes, count_mode=@count_mode, auto_apply=@auto_apply,
        earn_per_checkins=@earn_per_checkins, earn_per_streak=@earn_per_streak,
        earn_weekly=@earn_weekly, earn_on_levelup=@earn_on_levelup, updated_at=@now
      WHERE user_id=@user_id RETURNING *`),
    updateFreezeState: db.prepare(`
      UPDATE streak_freeze SET balance=@balance, ck_milestone=@ck_milestone,
        st_milestone=@st_milestone, lvl_milestone=@lvl_milestone, last_weekly_grant=@last_weekly_grant
      WHERE user_id=@user_id`),
    insertFreezeEvent: db.prepare(`
      INSERT INTO freeze_events (user_id, type, amount, reason, day, created_at)
      VALUES (@user_id, @type, @amount, @reason, @day, @now)`),
    listFreezeEvents: db.prepare(
      'SELECT * FROM freeze_events WHERE user_id = ? ORDER BY created_at DESC LIMIT ?'),
  };

  return stmt;
}
