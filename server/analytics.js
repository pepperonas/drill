/**
 * Analytics aggregation for the Statistik page. Everything the visual dashboard
 * needs in one payload, computed from the XP ledger + tracking tables.
 *
 * Motivation-first framing: a rising cumulative XP curve, an activity heatmap
 * (intensity = XP earned that day), weekly rhythm, a balance radar across life
 * areas, and a workout-category donut.
 */
import { dayInTz, addDays, diffDays } from './time.js';
import { isoWeekKey } from './streakfreeze.js';
import { xpForLevel, levelForXp } from './gamification.js';

const HEATMAP_DAYS = 140;
const WEEKLY_DAYS = 84;   // ~12 weeks
const RADAR_DAYS = 30;

export function computeStats(db, user) {
  const uid = user.id;
  const today = dayInTz(user.tz);
  const raw = db.raw;

  // ---- XP per day -> cumulative growth curve + level markers ----
  const xpByDay = raw.prepare(
    'SELECT day, SUM(amount) amt FROM xp_events WHERE user_id = ? GROUP BY day ORDER BY day').all(uid);
  let cum = 0;
  const xpCurve = xpByDay.map((e) => { cum += e.amt; return { day: e.day, xp: cum }; });
  const totalXp = cum;
  const levelMarkers = [];
  for (let l = 2; xpForLevel(l) <= totalXp + 1; l++) {
    levelMarkers.push({ level: l, xp: xpForLevel(l) });
    if (l > 80) break;
  }

  // ---- activity heatmap (XP earned per day, last ~20 weeks) ----
  const hmSince = addDays(today, -(HEATMAP_DAYS - 1));
  const heatmap = {};
  let bestDay = null;
  for (const e of xpByDay) {
    if (e.day >= hmSince) heatmap[e.day] = e.amt;
    if (!bestDay || e.amt > bestDay.amt) bestDay = { day: e.day, amt: e.amt };
  }

  // ---- weekly rhythm: check-ins vs workouts per ISO week ----
  const wkSince = addDays(today, -(WEEKLY_DAYS - 1));
  const weeks = new Map();
  const wk = (d) => {
    const key = isoWeekKey(d);
    if (!weeks.has(key)) weeks.set(key, { week: key, checkins: 0, workouts: 0 });
    return weeks.get(key);
  };
  for (const c of raw.prepare('SELECT day FROM checkins WHERE user_id = ? AND day >= ?').all(uid, wkSince)) wk(c.day).checkins++;
  for (const w of raw.prepare('SELECT day FROM workouts WHERE user_id = ? AND day >= ?').all(uid, wkSince)) wk(w.day).workouts++;
  const weekly = [...weeks.values()].sort((a, b) => (a.week < b.week ? -1 : 1))
    .map((w) => ({ ...w, label: w.week.replace(/^\d+-W/, 'KW') }));

  // ---- balance radar across life areas (last 30 days) ----
  const rSince = addDays(today, -(RADAR_DAYS - 1));
  const cnt = (sql, ...args) => raw.prepare(sql).get(uid, ...args).n;
  const checkins30 = cnt('SELECT COUNT(*) n FROM checkins WHERE user_id = ? AND day >= ?', rSince);
  const workouts30 = cnt('SELECT COUNT(*) n FROM workouts WHERE user_id = ? AND day >= ?', rSince);
  const nutrition30 = cnt('SELECT COUNT(*) n FROM nutrition_logs WHERE user_id = ? AND day >= ?', rSince);
  const byCat = (cat) => raw.prepare(`
    SELECT COUNT(*) n FROM tracker_entries e JOIN trackers t ON t.id = e.tracker_id
    WHERE t.user_id = ? AND t.category = ? AND e.day >= ?`).get(uid, cat, rSince).n;
  const body30 = byCat('body');
  const wellbeing30 = byCat('wellbeing');
  const pct = (v, target) => Math.min(100, Math.round((v / target) * 100));
  const radar = [
    { area: 'Konsistenz', value: pct(checkins30, 30) },
    { area: 'Training', value: pct(workouts30, 12) },
    { area: 'Ernährung', value: pct(nutrition30, 30) },
    { area: 'Körper', value: pct(body30, 12) },
    { area: 'Wohlbefinden', value: pct(wellbeing30, 30) },
  ];

  // ---- workout category distribution (donut) ----
  const categories = raw.prepare(`
    SELECT COALESCE(NULLIF(category, ''), 'Sonstiges') name, COUNT(*) value
    FROM workouts WHERE user_id = ? GROUP BY name ORDER BY value DESC`).all(uid);

  // ---- headline scalars ----
  const xp30 = xpByDay.filter((e) => e.day >= rSince).reduce((a, e) => a + e.amt, 0);
  const activeDays30 = xpByDay.filter((e) => e.day >= rSince && e.amt > 0).length;

  return {
    today,
    totalXp,
    level: levelForXp(totalXp),
    xpCurve,
    levelMarkers,
    heatmap,
    heatmapFrom: hmSince,
    weekly,
    radar,
    categories,
    headline: { xp30, activeDays30, bestDay },
  };
}
