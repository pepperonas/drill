/**
 * Flexible tracker routes — the heart of "track anything your way".
 *
 * Trackers are fully user-defined (name/type/unit/icon/color/goal). Logging an
 * entry awards the tracker's configurable XP and runs the achievement check.
 * Also serves user-editable option lists (activity types, workout categories),
 * personal records, the exercise library, and insight aggregations.
 */
import express from 'express';
import { dayInTz, addDays } from '../time.js';
import { awardXp, checkAchievements } from '../gamification.js';
import {
  TRACKER_TYPES, GOAL_DIRECTIONS, seedDefaultsIfEmpty, goalProgress,
  alignSeries, pearson, movingAverage,
} from '../trackers.js';

const RANGE_DAYS = { '7': 7, '30': 30, '90': 90, '365': 365, all: 100000 };

function rangeFrom(today, range) {
  const n = RANGE_DAYS[String(range)] ?? 90;
  return n >= 100000 ? '0000-00-00' : addDays(today, -(n - 1));
}

function gamiCtx(db, user) {
  return {
    checkins: db.countCheckins.get(user.id).n,
    workouts: db.countWorkouts.get(user.id).n,
    volume: db.sumVolume.get(user.id).v,
    metrics: db.countEntries.get(user.id).n,
    nutritionDays: db.listNutrition.all(user.id, '0000-00-00').length,
    records: db.listPRs.all(user.id).length,
    trackers: db.countTrackers.get(user.id).n,
  };
}

// Normalize an incoming tracker body into the prepared-statement shape.
function trackerParams(user, b, now) {
  const type = TRACKER_TYPES.includes(b.type) ? b.type : 'number';
  let options = null;
  if (Array.isArray(b.options)) options = JSON.stringify(b.options.slice(0, 40).map(String));
  const dir = GOAL_DIRECTIONS.includes(b.goal_direction) ? b.goal_direction : null;
  return {
    user_id: user.id,
    name: String(b.name || '').trim().slice(0, 60) || 'Tracker',
    type,
    unit: b.unit ? String(b.unit).slice(0, 16) : null,
    icon: b.icon ? String(b.icon).slice(0, 8) : null,
    color: b.color ? String(b.color).slice(0, 16) : null,
    category: b.category ? String(b.category).slice(0, 20) : 'custom',
    options,
    goal_value: b.goal_value === '' || b.goal_value == null ? null : Number(b.goal_value),
    goal_direction: dir,
    scale_min: b.scale_min == null ? null : Number(b.scale_min),
    scale_max: b.scale_max == null ? null : Number(b.scale_max),
    xp: Number.isFinite(Number(b.xp)) ? Math.max(0, Math.min(100, Number(b.xp))) : 10,
    reminder_time: b.reminder_time ? String(b.reminder_time).slice(0, 5) : null,
  };
}

// Decorate a tracker with its latest value + goal progress for list views.
function decorate(db, t) {
  const latest = db.latestEntry.get(t.id);
  const latestValue = latest ? latest.value : null;
  return {
    ...t,
    options: t.options ? JSON.parse(t.options) : null,
    archived: !!t.archived,
    latest: latest || null,
    goal: goalProgress(t, latestValue),
  };
}

function entryParams(tracker, b, today) {
  const day = b.day || today;
  if (tracker.type === 'text' || tracker.type === 'choice') {
    return { tracker_id: tracker.id, value: null, text_value: String(b.value ?? b.text_value ?? '').slice(0, 500), day, note: b.note || null };
  }
  let value = Number(b.value);
  if (tracker.type === 'boolean') value = b.value ? 1 : 0;
  return { tracker_id: tracker.id, value, text_value: null, day, note: b.note || null };
}

export function trackerRoutes(db, auth) {
  const r = express.Router();
  r.use(auth.requireUser);
  const now = () => Math.floor(Date.now() / 1000);

  // ---- tracker CRUD ----
  r.get('/trackers', (req, res) => {
    seedDefaultsIfEmpty(db, req.user);
    res.json({ trackers: db.listTrackers.all(req.user.id).map((t) => decorate(db, t)) });
  });

  r.get('/trackers/all', (req, res) => {
    res.json({ trackers: db.listAllTrackers.all(req.user.id).map((t) => decorate(db, t)) });
  });

  r.post('/trackers', (req, res) => {
    const p = trackerParams(req.user, req.body || {}, now());
    p.sort = db.countTrackers.get(req.user.id).n;
    p.now = now();
    res.json({ tracker: decorate(db, db.insertTracker.get(p)) });
  });

  r.put('/trackers/:id', (req, res) => {
    const cur = db.getTracker.get(Number(req.params.id), req.user.id);
    if (!cur) return res.status(404).json({ error: 'not_found' });
    const p = trackerParams(req.user, { ...cur, options: cur.options ? JSON.parse(cur.options) : null, ...req.body }, now());
    p.id = cur.id;
    p.sort = req.body.sort != null ? Number(req.body.sort) : cur.sort;
    p.archived = req.body.archived != null ? (req.body.archived ? 1 : 0) : cur.archived;
    res.json({ tracker: decorate(db, db.updateTracker.get(p)) });
  });

  r.delete('/trackers/:id', (req, res) => {
    db.deleteTracker.run(Number(req.params.id), req.user.id);
    res.json({ ok: true });
  });

  r.post('/trackers/reorder', (req, res) => {
    const order = Array.isArray(req.body?.order) ? req.body.order : [];
    db.raw.transaction(() => {
      order.forEach((id, i) => db.reorderTracker.run(i, Number(id), req.user.id));
    })();
    res.json({ ok: true });
  });

  // ---- entries ----
  r.get('/trackers/:id/entries', (req, res) => {
    const t = db.getTracker.get(Number(req.params.id), req.user.id);
    if (!t) return res.status(404).json({ error: 'not_found' });
    const from = req.query.from || '0000-00-00';
    res.json({ entries: db.listEntries.all(t.id, String(from)) });
  });

  r.post('/trackers/:id/entries', (req, res) => {
    const t = db.getTracker.get(Number(req.params.id), req.user.id);
    if (!t) return res.status(404).json({ error: 'not_found' });
    const today = dayInTz(req.user.tz);
    const p = entryParams(t, req.body || {}, today);
    if (t.type !== 'text' && t.type !== 'choice' && !Number.isFinite(p.value)) {
      return res.status(400).json({ error: 'numeric value required' });
    }
    p.now = now();
    const entry = db.insertEntry.get(p);
    awardXp(db, req.user, t.xp, 'tracker:' + t.name, p.day);
    const newly = checkAchievements(db, req.user, gamiCtx(db, req.user), p.day);
    res.json({
      entry, tracker: decorate(db, db.getTracker.get(t.id, req.user.id)),
      gami: { xp: req.user.xp, level: req.user.level, streak: req.user.streak_current, unlocked: newly },
    });
  });

  r.delete('/entries/:id', (req, res) => {
    db.deleteEntry.run(Number(req.params.id), req.user.id);
    res.json({ ok: true });
  });

  // ---- series (with moving average + goal) ----
  r.get('/trackers/:id/series', (req, res) => {
    const t = db.getTracker.get(Number(req.params.id), req.user.id);
    if (!t) return res.status(404).json({ error: 'not_found' });
    const today = dayInTz(req.user.tz);
    const from = rangeFrom(today, req.query.range || '90');
    const rows = db.listEntries.all(t.id, from)
      .filter((e) => e.value != null)
      .map((e) => ({ day: e.day, value: e.value }));
    const window = Number(req.query.avg) || 7;
    res.json({
      tracker: decorate(db, t),
      series: movingAverage(rows, window),
      goal: goalProgress(t, rows.length ? rows[rows.length - 1].value : null),
    });
  });

  // ---- insights: correlation / overlay of two trackers ----
  r.get('/insights/correlation', (req, res) => {
    const a = db.getTracker.get(Number(req.query.a), req.user.id);
    const b = db.getTracker.get(Number(req.query.b), req.user.id);
    if (!a || !b) return res.status(400).json({ error: 'two valid tracker ids required' });
    const today = dayInTz(req.user.tz);
    const from = rangeFrom(today, req.query.range || '90');
    const sa = db.listEntries.all(a.id, from).filter((e) => e.value != null).map((e) => ({ day: e.day, value: e.value }));
    const sb = db.listEntries.all(b.id, from).filter((e) => e.value != null).map((e) => ({ day: e.day, value: e.value }));
    const pairs = alignSeries(sa, sb);
    res.json({
      a: { id: a.id, name: a.name, unit: a.unit },
      b: { id: b.id, name: b.name, unit: b.unit },
      pairs, n: pairs.length, r: pearson(pairs),
    });
  });

  // ---- user-editable option lists (activity types, workout categories) ----
  r.get('/options/:domain', (req, res) => {
    res.json({ options: db.listOptions.all(req.user.id, String(req.params.domain)) });
  });
  r.post('/options/:domain', (req, res) => {
    const b = req.body || {};
    const sort = db.listOptions.all(req.user.id, String(req.params.domain)).length;
    const o = db.insertOption.get({
      user_id: req.user.id, domain: String(req.params.domain),
      label: String(b.label || '').slice(0, 40) || '—',
      icon: b.icon ? String(b.icon).slice(0, 8) : null,
      color: b.color ? String(b.color).slice(0, 16) : null, sort,
    });
    res.json({ option: o });
  });
  r.delete('/options/:id', (req, res) => {
    db.deleteOption.run(Number(req.params.id), req.user.id);
    res.json({ ok: true });
  });

  // ---- personal records + exercise library ----
  r.get('/records', (req, res) => res.json({ records: db.listPRs.all(req.user.id) }));
  r.get('/exercises', (req, res) => {
    const rows = db.raw.prepare(`
      SELECT s.exercise, COUNT(*) n FROM workout_sets s
      JOIN workouts w ON w.id = s.workout_id
      WHERE w.user_id = ? AND s.exercise <> '' GROUP BY s.exercise ORDER BY n DESC LIMIT 100
    `).all(req.user.id);
    res.json({ exercises: rows.map((x) => x.exercise) });
  });

  return r;
}
