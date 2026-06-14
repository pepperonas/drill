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
  { code: 'first_checkin',  name: 'Erster Schritt',     desc: 'Erster Check-in',                  icon: '🔥', xp: 20 },
  { code: 'streak_7',       name: 'Eine Woche',         desc: '7 Tage Streak',                    icon: '⚡', xp: 60 },
  { code: 'streak_30',      name: 'Eiserne Disziplin',  desc: '30 Tage Streak',                   icon: '🏆', xp: 250 },
  { code: 'streak_100',     name: 'Unaufhaltsam',       desc: '100 Tage Streak',                  icon: '💎', xp: 1000 },
  { code: 'workouts_10',    name: 'Aufgewärmt',         desc: '10 Workouts protokolliert',        icon: '💪', xp: 80 },
  { code: 'workouts_50',    name: 'Stammgast',          desc: '50 Workouts protokolliert',        icon: '🦾', xp: 300 },
  { code: 'volume_10t',     name: 'Tonnenweise',        desc: '10.000 kg Gesamtvolumen bewegt',   icon: '🏋️', xp: 150 },
  { code: 'level_5',        name: 'Level 5',            desc: 'Level 5 erreicht',                 icon: '⭐', xp: 0 },
  { code: 'level_10',       name: 'Level 10',           desc: 'Level 10 erreicht',                icon: '🌟', xp: 0 },
  { code: 'weight_logged',  name: 'Vermessen',          desc: 'Erste Körpermetrik erfasst',       icon: '📏', xp: 20 },
  { code: 'nutrition_7',    name: 'Bewusst',            desc: '7 Tage Ernährung getrackt',        icon: '🥗', xp: 70 },
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

  if (ctx.checkins >= 1) unlock('first_checkin');
  if (user.streak_current >= 7) unlock('streak_7');
  if (user.streak_current >= 30) unlock('streak_30');
  if (user.streak_current >= 100) unlock('streak_100');
  if (ctx.workouts >= 10) unlock('workouts_10');
  if (ctx.workouts >= 50) unlock('workouts_50');
  if (ctx.volume >= 10000) unlock('volume_10t');
  if (user.level >= 5) unlock('level_5');
  if (user.level >= 10) unlock('level_10');
  if (ctx.metrics >= 1) unlock('weight_logged');
  if (ctx.nutritionDays >= 7) unlock('nutrition_7');

  return newly;
}

export function allAchievements() {
  return ACHIEVEMENTS;
}
