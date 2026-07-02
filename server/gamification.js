/**
 * Gamification engine — server-authoritative XP, levels, streaks, achievements.
 *
 * XP is an append-only ledger (xp_events); the users row keeps a denormalized
 * rollup (xp/level/streak) for cheap reads. Levels use a gently rising curve so
 * early levels come fast (dopamine) and later ones take real consistency.
 */
import { dayInTz, addDays, diffDays } from './time.js';
import { consumeFreeze, persistFreezeState } from './streakfreeze.js';
import { workoutIntensity, intensityXp } from './trackers.js';

export const XP = {
  checkin: 25,
  workout: 40,
  metric: 10,       // logging a body metric
  nutrition: 15,    // logging nutrition for a day
  streak_bonus: 5,  // per current-streak day, capped
  activity: 20,     // base for a GPS activity (+ a distance bonus, see routes/activities)
};
const STREAK_BONUS_CAP = 50;
const ACTIVITY_XP_CAP = 120;

/** XP for a GPS activity: base + a gentle distance bonus (6 XP/km), capped. */
export function activityXp(distanceM) {
  const km = (Number(distanceM) || 0) / 1000;
  return Math.min(ACTIVITY_XP_CAP, Math.max(XP.activity, Math.round(XP.activity + km * 6)));
}

// XP required to reach level n (cumulative). Curve: 100 * n^1.6 rounded.
export function xpForLevel(level) {
  if (level <= 1) return 0;
  return Math.round(100 * Math.pow(level - 1, 1.6));
}
export function levelForXp(xp) {
  let lvl = 1;
  while (xpForLevel(lvl + 1) <= xp) lvl++;
  return lvl;
}
export function levelProgress(xp) {
  const level = levelForXp(xp);
  const base = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return {
    level,
    xp,
    levelXp: xp - base,
    levelNeed: next - base,
    nextLevelXp: next,
    pct: next > base ? Math.min(100, Math.round(((xp - base) / (next - base)) * 100)) : 100,
  };
}

/**
 * Award XP and recompute the rollup. `reason` is free text for the ledger.
 * Returns { xp, level, leveledUp, from, to }.
 */
export function awardXp(db, user, amount, reason, day, ref = null) {
  if (amount <= 0) return { leveledUp: false, level: user.level };
  const now = Math.floor(Date.now() / 1000);
  db.insertXp.run({ user_id: user.id, amount, reason, day, now, ref });
  const xp = db.sumXp.get(user.id).xp;
  const fromLevel = user.level;
  const level = levelForXp(xp);
  db.updateUserGami.run({
    id: user.id, xp, level,
    streak_current: user.streak_current,
    streak_best: user.streak_best,
    last_checkin_day: user.last_checkin_day,
  });
  user.xp = xp; user.level = level;
  return { xp, level, leveledUp: level > fromLevel, from: fromLevel, to: level };
}

/**
 * Reverse all XP awarded under a given source `ref` (e.g. when the user undoes
 * an action) and recompute the xp/level rollup. Streak fields are untouched here
 * — callers that delete a check-in also call recomputeStreakFromHistory.
 */
export function reverseXpByRef(db, user, ref) {
  db.delXpByRef.run(user.id, ref);
  const xp = db.sumXp.get(user.id).xp;
  const level = levelForXp(xp);
  db.updateUserGami.run({
    id: user.id, xp, level,
    streak_current: user.streak_current, streak_best: user.streak_best,
    last_checkin_day: user.last_checkin_day,
  });
  user.xp = xp; user.level = level;
  return { xp, level };
}

/**
 * Recompute streak_current / last_checkin_day from the actual surviving history
 * (check-ins plus auto-bridged freeze days). Used after a check-in is deleted so
 * the streak reflects reality. streak_best is never lowered.
 */
export function recomputeStreakFromHistory(db, user) {
  const present = new Set(db.listCheckins.all(user.id, '0000-00-00').map(c => c.day));
  for (const r of db.bridgeDays.all(user.id)) present.add(r.day);
  let streak = 0, last = null;
  if (present.size > 0) {
    last = [...present].sort().pop();
    streak = 1;
    let d = last;
    while (present.has(addDays(d, -1))) { streak++; d = addDays(d, -1); }
  }
  const best = Math.max(user.streak_best, streak);
  db.updateUserGami.run({
    id: user.id, xp: user.xp, level: user.level,
    streak_current: streak, streak_best: best, last_checkin_day: last,
  });
  user.streak_current = streak; user.streak_best = best; user.last_checkin_day = last;
  return { streak, best, last };
}

/**
 * Deterministically rebuild a user's entire XP ledger from current data — a
 * self-healing repair for accounts whose ledger drifted (e.g. legacy deletes
 * that didn't reverse XP). Re-derives streak too. Achievements stay earned: each
 * currently-unlocked achievement keeps its bonus.
 */
export function rebuildXp(db, user) {
  db.delAllXp.run(user.id);
  user.xp = 0; user.level = 1;

  // check-ins (date order) -> base + streak bonus, with freeze-bridged continuity
  const present = new Set(db.bridgeDays.all(user.id).map(r => r.day));
  const checkins = db.listCheckins.all(user.id, '0000-00-00');
  for (const c of checkins) present.add(c.day);
  let run = 0, prev = null;
  for (const c of checkins) {
    if (prev && c.day > prev) {
      let contiguous = true;
      for (let d = addDays(prev, 1); d < c.day; d = addDays(d, 1)) {
        if (!present.has(d)) { contiguous = false; break; }
      }
      run = contiguous ? run + diffDays(prev, c.day) : 1;
    } else {
      run = 1;
    }
    awardXp(db, user, XP.checkin, 'checkin', c.day, `checkin:${c.day}`);
    const bonus = Math.min(run * XP.streak_bonus, 50);
    if (bonus > 0) awardXp(db, user, bonus, 'streak_bonus', c.day, `checkin:${c.day}`);
    prev = c.day;
  }

  // workouts: base reward + re-derived intensity bonus
  for (const w of db.listWorkouts.all(user.id, 100000)) {
    awardXp(db, user, XP.workout, 'workout', w.day, `workout:${w.id}`);
    const bonus = intensityXp(workoutIntensity(db.listSets.all(w.id)).points);
    if (bonus > 0) awardXp(db, user, bonus, 'workout_intensity', w.day, `workout:${w.id}`);
  }
  // GPS activities: re-derive the distance-based XP
  for (const a of db.listActivities.all(user.id, 100000)) {
    awardXp(db, user, activityXp(a.distance_m), 'activity:' + a.type, a.day, `activity:${a.id}`);
  }
  // tracker entries (each contributes its tracker's current xp)
  for (const e of db.allEntriesWithXp.all(user.id)) {
    awardXp(db, user, e.xp, 'tracker', e.day, `entry:${e.id}`);
  }
  // nutrition days
  for (const n of db.listNutrition.all(user.id, '0000-00-00')) {
    awardXp(db, user, XP.nutrition, 'nutrition', n.day, `nutrition:${n.day}`);
  }
  // achievements stay earned -> re-award their bonus
  const byCode = Object.fromEntries(ACHIEVEMENTS.map(a => [a.code, a]));
  for (const a of db.listAchievements.all(user.id)) {
    const def = byCode[a.code];
    if (def && def.xp > 0) {
      const day = a.unlocked_at ? new Date(a.unlocked_at * 1000).toISOString().slice(0, 10) : '1970-01-01';
      awardXp(db, user, def.xp, 'achievement:' + a.code, day, `achievement:${a.code}`);
    }
  }

  recomputeStreakFromHistory(db, user);
  return { xp: user.xp, level: user.level, streak: user.streak_current };
}

/**
 * Recompute the user's streak after a check-in on `day`. A streak counts
 * consecutive calendar days with a check-in. If `cfg` (a streak-freeze config)
 * is given, a gap of missed days is bridged automatically by consuming freezes
 * — preserving the streak (and, in 'grow' mode, counting the frozen days).
 * Returns { streak, best, frozen } where `frozen` is the number of bridged days.
 */
export function recomputeStreak(db, user, day, cfg = null) {
  const prev = user.last_checkin_day;
  let streak = user.streak_current;
  let frozen = 0;
  if (prev === day) {
    // already counted today — no change
  } else if (prev && addDays(prev, 1) === day) {
    streak = streak + 1; // consecutive
  } else if (prev && day > prev) {
    const gap = diffDays(prev, day) - 1; // fully-missed days strictly between
    if (gap > 0 && cfg && cfg.enabled && cfg.auto_apply && cfg.balance >= gap) {
      consumeFreeze(db, user, cfg, gap, 'auto_bridge', day);
      persistFreezeState(db, cfg);
      frozen = gap;
      streak += cfg.count_mode === 'grow' ? gap + 1 : 1;
    } else if (gap > 0) {
      streak = 1; // gap couldn't be bridged -> restart
    } else {
      streak = streak + 1; // adjacent (shouldn't reach here)
    }
  } else {
    streak = 1; // first ever or out-of-order
  }
  const best = Math.max(user.streak_best, streak);
  db.updateUserGami.run({
    id: user.id, xp: user.xp, level: user.level,
    streak_current: streak, streak_best: best, last_checkin_day: day,
  });
  user.streak_current = streak; user.streak_best = best; user.last_checkin_day = day;
  return { streak, best, frozen };
}

/**
 * Streaks silently expire: if the last check-in is older than yesterday, the
 * current streak is 0 for display/alert purposes (the stored value resets on the
 * next check-in). Returns the effective current streak.
 */
export function effectiveStreak(user, todayDay) {
  const prev = user.last_checkin_day;
  if (!prev) return 0;
  if (prev === todayDay || addDays(prev, 1) === todayDay) return user.streak_current;
  return 0;
}

// ---- Achievements ---------------------------------------------------------

export const ACHIEVEMENTS = [
  // --- Check-ins / Konsistenz ---
  { code: 'first_checkin',  name: 'Erster Schritt',     desc: 'Erster Check-in',                  icon: '🔥', xp: 20 },
  { code: 'checkins_50',    name: 'Halbes Hundert',     desc: '50 Check-ins gesamt',              icon: '📅', xp: 150 },
  { code: 'checkins_100',   name: 'Hundertmal dabei',   desc: '100 Check-ins gesamt',             icon: '💯', xp: 300 },
  { code: 'checkins_250',   name: 'Dauergast',          desc: '250 Check-ins gesamt',             icon: '🏛️', xp: 700 },
  { code: 'checkins_365',   name: 'Ein ganzes Jahr',    desc: '365 Check-ins gesamt',             icon: '📆', xp: 1500 },
  // --- Streaks ---
  { code: 'streak_7',       name: 'Eine Woche',         desc: '7 Tage Streak',                    icon: '⚡', xp: 60 },
  { code: 'streak_14',      name: 'Zwei Wochen',        desc: '14 Tage Streak',                   icon: '🔋', xp: 120 },
  { code: 'streak_30',      name: 'Eiserne Disziplin',  desc: '30 Tage Streak',                   icon: '🏆', xp: 300 },
  { code: 'streak_60',      name: 'Durchmarsch',        desc: '60 Tage Streak',                   icon: '🛡️', xp: 600 },
  { code: 'streak_100',     name: 'Unaufhaltsam',       desc: '100 Tage Streak',                  icon: '💎', xp: 1500 },
  // --- Workouts ---
  { code: 'workouts_10',    name: 'Aufgewärmt',         desc: '10 Workouts protokolliert',        icon: '💪', xp: 80 },
  { code: 'workouts_50',    name: 'Stammgast',          desc: '50 Workouts protokolliert',        icon: '🦾', xp: 300 },
  { code: 'workouts_100',   name: 'Eisenfreund',        desc: '100 Workouts protokolliert',       icon: '🏋️', xp: 600 },
  { code: 'workouts_250',   name: 'Hantel-Veteran',     desc: '250 Workouts protokolliert',       icon: '🎖️', xp: 1500 },
  // --- Volumen (ein Workout bewegt grob 5–12 t, daher höhere Schwellen) ---
  { code: 'volume_25t',     name: 'Tonnenweise',        desc: '25 t Gesamtvolumen bewegt',        icon: '🏋️', xp: 150 },
  { code: 'volume_100t',    name: 'Schwergewicht',      desc: '100 t Gesamtvolumen bewegt',       icon: '🐘', xp: 500 },
  { code: 'volume_500t',    name: 'Kraftwerk',          desc: '500 t Gesamtvolumen bewegt',       icon: '⚙️', xp: 1500 },
  // --- Bestleistungen ---
  { code: 'first_pr',       name: 'Neuer Rekord',       desc: 'Erste Bestleistung aufgestellt',   icon: '🥇', xp: 50 },
  { code: 'prs_10',         name: 'Rekordjäger',        desc: '10 Bestleistungen aufgestellt',    icon: '🏅', xp: 250 },
  // --- Level ---
  { code: 'level_5',        name: 'Level 5',            desc: 'Level 5 erreicht',                 icon: '⭐', xp: 0 },
  { code: 'level_10',       name: 'Level 10',           desc: 'Level 10 erreicht',                icon: '🌟', xp: 0 },
  { code: 'level_20',       name: 'Level 20',           desc: 'Level 20 erreicht',                icon: '✨', xp: 0 },
  { code: 'level_50',       name: 'Level 50',           desc: 'Level 50 erreicht',                icon: '👑', xp: 0 },
  // --- Tracker / Daten ---
  { code: 'weight_logged',  name: 'Vermessen',          desc: 'Ersten Tracker-Wert erfasst',      icon: '📏', xp: 20 },
  { code: 'tracker_variety',name: 'Vielseitig',         desc: '8 Tracker im Einsatz',             icon: '🎛️', xp: 120 },
  { code: 'entries_100',    name: 'Datensammler',       desc: '100 Tracker-Einträge erfasst',     icon: '📊', xp: 250 },
  { code: 'entries_500',    name: 'Quantified Self',    desc: '500 Tracker-Einträge erfasst',     icon: '🔬', xp: 1000 },
  // --- Ernährung ---
  { code: 'nutrition_7',    name: 'Bewusst',            desc: '7 Tage Ernährung getrackt',        icon: '🥗', xp: 70 },
  { code: 'nutrition_30',   name: 'Ernährungsprofi',    desc: '30 Tage Ernährung getrackt',       icon: '🍱', xp: 300 },
  // --- Aktivitäten (GPS-getrackt, Android-App) ---
  { code: 'first_activity', name: 'Losgezogen',         desc: 'Erste GPS-Aktivität aufgezeichnet', icon: '🗺️', xp: 30 },
  { code: 'activities_10',  name: 'Unterwegs',          desc: '10 Aktivitäten aufgezeichnet',      icon: '🚶', xp: 120 },
  { code: 'activities_50',  name: 'Entdecker',          desc: '50 Aktivitäten aufgezeichnet',      icon: '🧭', xp: 400 },
  { code: 'distance_50km',  name: '50 Kilometer',       desc: 'Insgesamt 50 km zurückgelegt',      icon: '📍', xp: 150 },
  { code: 'distance_250km', name: '250 Kilometer',      desc: 'Insgesamt 250 km zurückgelegt',     icon: '🌍', xp: 500 },
  { code: 'distance_1000km',name: '1000 Kilometer',     desc: 'Insgesamt 1000 km zurückgelegt',    icon: '🚀', xp: 1500 },
  { code: 'run_10',         name: 'Läufer',             desc: '10 Läufe aufgezeichnet',            icon: '🏃', xp: 150 },
  { code: 'cycle_10',       name: 'Radfahrer',          desc: '10 Radtouren aufgezeichnet',        icon: '🚴', xp: 150 },
];
const BY_CODE = Object.fromEntries(ACHIEVEMENTS.map(a => [a.code, a]));

/**
 * Evaluate which achievements the user now qualifies for and unlock new ones.
 * Returns an array of newly-unlocked achievement objects (with their bonus XP
 * already awarded). `ctx` carries cheap counters to avoid extra queries.
 */
export function checkAchievements(db, user, ctx, day) {
  const have = new Set(db.listAchievements.all(user.id).map(r => r.code));
  const newly = [];
  const unlock = (code) => {
    if (have.has(code) || newly.find(a => a.code === code)) return;
    const a = BY_CODE[code];
    if (!a) return;
    db.insertAchievement.run(user.id, code, Math.floor(Date.now() / 1000));
    if (a.xp > 0) awardXp(db, user, a.xp, 'achievement:' + code, day, `achievement:${code}`);
    newly.push(a);
  };

  // check-ins
  if (ctx.checkins >= 1) unlock('first_checkin');
  if (ctx.checkins >= 50) unlock('checkins_50');
  if (ctx.checkins >= 100) unlock('checkins_100');
  if (ctx.checkins >= 250) unlock('checkins_250');
  if (ctx.checkins >= 365) unlock('checkins_365');
  // streaks
  if (user.streak_current >= 7) unlock('streak_7');
  if (user.streak_current >= 14) unlock('streak_14');
  if (user.streak_current >= 30) unlock('streak_30');
  if (user.streak_current >= 60) unlock('streak_60');
  if (user.streak_current >= 100) unlock('streak_100');
  // workouts
  if (ctx.workouts >= 10) unlock('workouts_10');
  if (ctx.workouts >= 50) unlock('workouts_50');
  if (ctx.workouts >= 100) unlock('workouts_100');
  if (ctx.workouts >= 250) unlock('workouts_250');
  // volume
  if (ctx.volume >= 25000) unlock('volume_25t');
  if (ctx.volume >= 100000) unlock('volume_100t');
  if (ctx.volume >= 500000) unlock('volume_500t');
  // personal records
  if ((ctx.records || 0) >= 1) unlock('first_pr');
  if ((ctx.records || 0) >= 10) unlock('prs_10');
  // levels
  if (user.level >= 5) unlock('level_5');
  if (user.level >= 10) unlock('level_10');
  if (user.level >= 20) unlock('level_20');
  if (user.level >= 50) unlock('level_50');
  // trackers / data
  if (ctx.metrics >= 1) unlock('weight_logged');
  if ((ctx.trackers || 0) >= 8) unlock('tracker_variety');
  if (ctx.metrics >= 100) unlock('entries_100');
  if (ctx.metrics >= 500) unlock('entries_500');
  // nutrition
  if (ctx.nutritionDays >= 7) unlock('nutrition_7');
  if (ctx.nutritionDays >= 30) unlock('nutrition_30');
  // activities (GPS)
  if ((ctx.activities || 0) >= 1) unlock('first_activity');
  if ((ctx.activities || 0) >= 10) unlock('activities_10');
  if ((ctx.activities || 0) >= 50) unlock('activities_50');
  if ((ctx.totalDistanceM || 0) >= 50000) unlock('distance_50km');
  if ((ctx.totalDistanceM || 0) >= 250000) unlock('distance_250km');
  if ((ctx.totalDistanceM || 0) >= 1000000) unlock('distance_1000km');
  if ((ctx.runCount || 0) >= 10) unlock('run_10');
  if ((ctx.cycleCount || 0) >= 10) unlock('cycle_10');

  return newly;
}

export function allAchievements() {
  return ACHIEVEMENTS;
}
