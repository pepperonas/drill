/**
 * Gamification engine — server-authoritative XP, levels, streaks, achievements.
 *
 * XP is an append-only ledger (xp_events); the users row keeps a denormalized
 * rollup (xp/level/streak) for cheap reads. Levels use a gently rising curve so
 * early levels come fast (dopamine) and later ones take real consistency.
 */
import { dayInTz, addDays } from './time.js';

export const XP = {
  checkin: 25,
  workout: 40,
  metric: 10,       // logging a body metric
  nutrition: 15,    // logging nutrition for a day
  streak_bonus: 5,  // per current-streak day, capped
};
const STREAK_BONUS_CAP = 50;

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
export function awardXp(db, user, amount, reason, day) {
  if (amount <= 0) return { leveledUp: false, level: user.level };
  const now = Math.floor(Date.now() / 1000);
  db.insertXp.run({ user_id: user.id, amount, reason, day, now });
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
 * Recompute the user's streak after a check-in on `day`. A streak counts
 * consecutive calendar days with a check-in. Returns the updated streak fields.
 */
export function recomputeStreak(db, user, day) {
  const prev = user.last_checkin_day;
  let streak = user.streak_current;
  if (prev === day) {
    // already counted today — no change
  } else if (prev && addDays(prev, 1) === day) {
    streak = streak + 1; // consecutive
  } else if (!prev || prev < day) {
    streak = 1; // gap or first ever -> restart
  }
  const best = Math.max(user.streak_best, streak);
  db.updateUserGami.run({
    id: user.id, xp: user.xp, level: user.level,
    streak_current: streak, streak_best: best, last_checkin_day: day,
  });
  user.streak_current = streak; user.streak_best = best; user.last_checkin_day = day;
  return { streak, best };
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
    if (a.xp > 0) awardXp(db, user, a.xp, 'achievement:' + code, day);
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

  return newly;
}

export function allAchievements() {
  return ACHIEVEMENTS;
}
