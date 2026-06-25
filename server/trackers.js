/**
 * Tracker domain logic: default seeding, goal progress, PR math, series helpers.
 *
 * A "tracker" is anything a user wants to log. Types:
 *   number   — free numeric value + unit (weight, water, steps, …)
 *   scale    — bounded rating (mood 1..5, sleep quality 1..10)
 *   boolean  — yes/no habit (stored as value 0|1)
 *   duration — minutes
 *   choice   — one of user-defined options (stored in text_value)
 *   text     — free note / journal (stored in text_value)
 */

export const TRACKER_TYPES = ['number', 'scale', 'boolean', 'duration', 'choice', 'text'];
export const GOAL_DIRECTIONS = ['up', 'down', 'maintain'];

// Seeded once for brand-new users so they don't start from a blank screen.
// Everything here is fully editable/deletable afterwards.
export const DEFAULT_TRACKERS = [
  { name: 'Gewicht',   type: 'number',  unit: 'kg', icon: '⚖️', color: '#c6ff00', category: 'body',      xp: 10 },
  { name: 'Stimmung',  type: 'scale',   unit: '',   icon: '😊', color: '#8fd6ff', category: 'wellbeing', xp: 5, scale_min: 1, scale_max: 5 },
  { name: 'Schlaf',    type: 'number',  unit: 'h',  icon: '😴', color: '#d0bcff', category: 'wellbeing', xp: 5, goal_value: 8, goal_direction: 'up' },
  { name: 'Wasser',    type: 'number',  unit: 'ml', icon: '💧', color: '#8fd6ff', category: 'nutrition', xp: 5, goal_value: 2500, goal_direction: 'up' },
  { name: 'Energie',   type: 'scale',   unit: '',   icon: '⚡', color: '#ffd34d', category: 'wellbeing', xp: 5, scale_min: 1, scale_max: 5 },
];

export function seedDefaultsIfEmpty(db, user) {
  if (db.countTrackers.get(user.id).n > 0) return [];
  const now = Math.floor(Date.now() / 1000);
  const created = [];
  DEFAULT_TRACKERS.forEach((t, i) => {
    created.push(db.insertTracker.get({
      user_id: user.id, name: t.name, type: t.type, unit: t.unit || null,
      icon: t.icon || null, color: t.color || null, category: t.category || 'custom',
      options: null, goal_value: t.goal_value ?? null, goal_direction: t.goal_direction || null,
      scale_min: t.scale_min ?? null, scale_max: t.scale_max ?? null,
      xp: t.xp ?? 10, reminder_time: null, sort: i, now,
    }));
  });
  return created;
}

// Epley estimated one-rep max. Returns 0 when inputs are unusable.
export function est1RM(weight, reps) {
  if (!weight || !reps || reps < 1) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

// Upper bound for how much a single workout's intensity can contribute as XP,
// so a huge (or fat-fingered) session can't distort the level economy.
export const INTENSITY_XP_CAP = 120;

/**
 * Combine a workout's sets into one intensity score. Each set row carries a set
 * count (`setCount`/`set_count`, default 1), reps and an optional weight. The
 * score blends three things so *any* workout is measurable:
 *   - tonnage  = Σ count·reps·weight   (load — dominant for weighted training)
 *   - rep work = Σ count·reps          (credits bodyweight / weightless sets)
 *   - volume   = Σ count               (rewards just showing up and grinding sets)
 * `points` is the headline number; weight is optional everywhere, so logging
 * "3 sets × 12 reps" with no weight still produces a real score.
 */
export function workoutIntensity(sets) {
  let tonnage = 0, reps = 0, totalSets = 0;
  for (const s of sets || []) {
    const n = Math.min(99, Math.max(1, Math.round(Number(s.setCount ?? s.set_count ?? 1)) || 1));
    const r = Math.max(0, Number(s.reps) || 0);
    const w = Math.max(0, Number(s.weight) || 0);
    totalSets += n;
    reps += n * r;
    tonnage += n * r * w;
  }
  const points = Math.round(tonnage / 150 + reps / 10 + totalSets * 0.5);
  return { tonnage: Math.round(tonnage), reps, sets: totalSets, points };
}

/** Clamp an intensity score to the XP it grants (0..INTENSITY_XP_CAP). */
export function intensityXp(points) {
  return Math.min(INTENSITY_XP_CAP, Math.max(0, Math.round(points) || 0));
}

/**
 * Goal progress for a tracker given its latest value. Returns null when the
 * tracker has no goal. `pct` is clamped 0..100; `reached` is a boolean.
 */
export function goalProgress(tracker, latestValue) {
  if (tracker.goal_value == null || latestValue == null) return null;
  const goal = tracker.goal_value;
  const dir = tracker.goal_direction || 'up';
  let pct, reached;
  if (dir === 'up') {
    pct = goal > 0 ? (latestValue / goal) * 100 : 0;
    reached = latestValue >= goal;
  } else if (dir === 'down') {
    // progress toward a lower target is harder to anchor; report reached + a
    // simple proximity percentage relative to the goal.
    reached = latestValue <= goal;
    pct = reached ? 100 : Math.max(0, (goal / latestValue) * 100);
  } else { // maintain
    const drift = Math.abs(latestValue - goal);
    const tol = Math.max(1, Math.abs(goal) * 0.05);
    reached = drift <= tol;
    pct = Math.max(0, 100 - (drift / tol) * 100);
  }
  return { goal, direction: dir, latest: latestValue, reached, pct: Math.max(0, Math.min(100, Math.round(pct))) };
}

/**
 * Align two day-keyed series into paired points for correlation/overlay charts.
 * Returns [{ day, a, b }] for days present in BOTH series.
 */
export function alignSeries(seriesA, seriesB) {
  const mapB = new Map(seriesB.map((p) => [p.day, p.value]));
  const out = [];
  for (const p of seriesA) {
    if (mapB.has(p.day)) out.push({ day: p.day, a: p.value, b: mapB.get(p.day) });
  }
  return out;
}

/** Pearson correlation coefficient for aligned {a,b} pairs, or null if < 3 pts. */
export function pearson(pairs) {
  const n = pairs.length;
  if (n < 3) return null;
  let sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0;
  for (const { a, b } of pairs) { sa += a; sb += b; saa += a * a; sbb += b * b; sab += a * b; }
  const num = n * sab - sa * sb;
  const den = Math.sqrt((n * saa - sa * sa) * (n * sbb - sb * sb));
  if (den === 0) return null;
  return Math.round((num / den) * 100) / 100;
}

// Simple trailing moving average over a {day,value} series.
export function movingAverage(series, window = 7) {
  return series.map((p, i) => {
    const slice = series.slice(Math.max(0, i - window + 1), i + 1);
    const avg = slice.reduce((s, x) => s + x.value, 0) / slice.length;
    return { day: p.day, value: p.value, avg: Math.round(avg * 100) / 100 };
  });
}
