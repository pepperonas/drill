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
      INSERT INTO workouts (user_id, day, category, title, duration_min, note, created_at)
      VALUES (@user_id, @day, @category, @title, @duration_min, @note, @now)
      RETURNING *
    `),
    insertSet: db.prepare(`
      INSERT INTO workout_sets (workout_id, exercise, weight, reps, sort)
      VALUES (@workout_id, @exercise, @weight, @reps, @sort)
    `),
    listWorkouts: db.prepare(
      'SELECT * FROM workouts WHERE user_id = ? ORDER BY day DESC, id DESC LIMIT ?'),
    getWorkout: db.prepare('SELECT * FROM workouts WHERE id = ? AND user_id = ?'),
    listSets: db.prepare('SELECT * FROM workout_sets WHERE workout_id = ? ORDER BY sort, id'),
    deleteWorkout: db.prepare('DELETE FROM workouts WHERE id = ? AND user_id = ?'),
    countWorkouts: db.prepare('SELECT COUNT(*) n FROM workouts WHERE user_id = ?'),
    sumVolume: db.prepare(`
      SELECT COALESCE(SUM(s.weight * s.reps), 0) v
      FROM workout_sets s JOIN workouts w ON w.id = s.workout_id
      WHERE w.user_id = ?`),

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
      INSERT INTO xp_events (user_id, amount, reason, day, created_at)
      VALUES (@user_id, @amount, @reason, @day, @now)
    `),
    sumXp: db.prepare('SELECT COALESCE(SUM(amount),0) xp FROM xp_events WHERE user_id = ?'),
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
  };

  return stmt;
}
