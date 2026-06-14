/**
 * Tracking routes: metrics, check-ins, workouts, nutrition.
 * Every write goes through the gamification engine so XP/streak/achievements
 * stay consistent, and returns the resulting gamification delta to the client
 * (so the UI can celebrate level-ups / new badges immediately).
 */
import express from 'express';
import { dayInTz } from '../time.js';
import {
  awardXp, recomputeStreak, checkAchievements, XP,
} from '../gamification.js';
import { est1RM } from '../trackers.js';
import { ensureFreeze, reconcileEarn } from '../streakfreeze.js';

/**
 * Detect new personal records from a workout's sets. For each exercise we keep
 * the best estimated 1RM; returns the list of exercises that just beat their PR.
 */
function detectPRs(db, user, sets, day) {
  const best = new Map(); // exercise -> {weight,reps,e1rm}
  for (const s of sets) {
    if (!s.weight || !s.reps) continue;
    const e1rm = est1RM(Number(s.weight), Number(s.reps));
    if (e1rm <= 0) continue;
    const cur = best.get(s.exercise);
    if (!cur || e1rm > cur.e1rm) best.set(s.exercise, { weight: Number(s.weight), reps: Number(s.reps), e1rm });
  }
  const newPRs = [];
  const now = Math.floor(Date.now() / 1000);
  for (const [exercise, b] of best) {
    const prev = db.getPR.get(user.id, exercise);
    if (!prev || b.e1rm > prev.est_1rm) {
      db.upsertPR.run({ user_id: user.id, exercise, weight: b.weight, reps: b.reps, est_1rm: b.e1rm, day, now });
      newPRs.push({ exercise, weight: b.weight, reps: b.reps, est_1rm: b.e1rm, improved: !!prev });
    }
  }
  return newPRs;
}

const KNOWN_METRICS = {
  weight: 'kg', bodyfat: '%', waist: 'cm', chest: 'cm', hip: 'cm',
  arm: 'cm', thigh: 'cm', neck: 'cm',
};

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

function gamiResult(db, user, newly) {
  return {
    xp: user.xp, level: user.level,
    streak: user.streak_current,
    unlocked: newly,
  };
}

export function trackingRoutes(db, auth) {
  const r = express.Router();
  r.use(auth.requireUser);
  const now = () => Math.floor(Date.now() / 1000);

  // ---- metrics ----
  r.get('/metrics', (req, res) => {
    const kind = req.query.kind;
    const rows = kind
      ? db.listMetrics.all(req.user.id, String(kind))
      : db.listAllMetrics.all(req.user.id);
    res.json({ metrics: rows, kinds: db.distinctMetricKinds.all(req.user.id).map(k => k.kind) });
  });

  r.post('/metrics', (req, res) => {
    const { kind, value, day, note } = req.body || {};
    const v = Number(value);
    if (!kind || !Number.isFinite(v)) return res.status(400).json({ error: 'kind and numeric value required' });
    const slug = String(kind).toLowerCase().trim().replace(/[^a-z0-9_-]/g, '');
    if (!slug) return res.status(400).json({ error: 'invalid kind' });
    const unit = req.body.unit || KNOWN_METRICS[slug] || '';
    const d = day || dayInTz(req.user.tz);
    const m = db.insertMetric.get({ user_id: req.user.id, kind: slug, value: v, unit, day: d, note: note || null, now: now() });
    awardXp(db, req.user, XP.metric, 'metric:' + slug, d);
    const newly = checkAchievements(db, req.user, gamiCtx(db, req.user), d);
    res.json({ metric: m, gami: gamiResult(db, req.user, newly) });
  });

  r.delete('/metrics/:id', (req, res) => {
    db.deleteMetric.run(Number(req.params.id), req.user.id);
    res.json({ ok: true });
  });

  // ---- check-ins (attendance) ----
  r.get('/checkins', (req, res) => {
    const from = req.query.from || '0000-00-00';
    res.json({ checkins: db.listCheckins.all(req.user.id, String(from)) });
  });

  r.post('/checkins', (req, res) => {
    const day = (req.body && req.body.day) || dayInTz(req.user.tz);
    const kind = (req.body && req.body.kind) || 'gym';
    const existed = !!db.getCheckin.get(req.user.id, day);
    const c = db.upsertCheckin.get({ user_id: req.user.id, day, kind, note: (req.body && req.body.note) || null, now: now() });
    let leveled = null;
    let frozen = 0;
    if (!existed) {
      const cfg = ensureFreeze(db, req.user);
      const sres = recomputeStreak(db, req.user, day, cfg);
      frozen = sres.frozen;
      leveled = awardXp(db, req.user, XP.checkin, 'checkin', day);
      // streak bonus, capped
      const bonus = Math.min(req.user.streak_current * XP.streak_bonus, 50);
      if (bonus > 0) awardXp(db, req.user, bonus, 'streak_bonus', day);
      // earn freezes from check-in / streak / level milestones
      reconcileEarn(db, req.user, cfg, day, db.countCheckins.get(req.user.id).n);
    }
    const newly = checkAchievements(db, req.user, gamiCtx(db, req.user), day);
    res.json({ checkin: c, isNew: !existed, gami: gamiResult(db, req.user, newly), leveled, frozen });
  });

  r.delete('/checkins/:day', (req, res) => {
    db.deleteCheckin.run(req.user.id, String(req.params.day));
    res.json({ ok: true });
  });

  // ---- workouts ----
  r.get('/workouts', (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const list = db.listWorkouts.all(req.user.id, limit).map(w => ({
      ...w, sets: db.listSets.all(w.id),
    }));
    res.json({ workouts: list });
  });

  r.post('/workouts', (req, res) => {
    const b = req.body || {};
    const day = b.day || dayInTz(req.user.tz);
    const w = db.insertWorkout.get({
      user_id: req.user.id, day,
      category: b.category || null, title: b.title || null,
      duration_min: b.duration_min ? Number(b.duration_min) : null,
      note: b.note || null, now: now(),
    });
    const sets = Array.isArray(b.sets) ? b.sets : [];
    sets.forEach((s, i) => db.insertSet.run({
      workout_id: w.id, exercise: String(s.exercise || '').slice(0, 80),
      weight: s.weight != null ? Number(s.weight) : null,
      reps: s.reps != null ? Number(s.reps) : null, sort: i,
    }));
    awardXp(db, req.user, XP.workout, 'workout', day);
    const newPRs = detectPRs(db, req.user, sets, day);
    const newly = checkAchievements(db, req.user, gamiCtx(db, req.user), day);
    res.json({ workout: { ...w, sets: db.listSets.all(w.id) }, gami: gamiResult(db, req.user, newly), prs: newPRs });
  });

  r.delete('/workouts/:id', (req, res) => {
    db.deleteWorkout.run(Number(req.params.id), req.user.id);
    res.json({ ok: true });
  });

  // ---- nutrition ----
  r.get('/nutrition', (req, res) => {
    const from = req.query.from || '0000-00-00';
    res.json({ nutrition: db.listNutrition.all(req.user.id, String(from)) });
  });

  r.post('/nutrition', (req, res) => {
    const b = req.body || {};
    const day = b.day || dayInTz(req.user.tz);
    const existed = !!db.getNutrition.get(req.user.id, day);
    const num = (x) => (x == null || x === '' ? null : Number(x));
    const n = db.upsertNutrition.get({
      user_id: req.user.id, day,
      kcal: num(b.kcal), protein_g: num(b.protein_g), carbs_g: num(b.carbs_g),
      fat_g: num(b.fat_g), quality: num(b.quality), water_ml: num(b.water_ml),
      note: b.note || null, now: now(),
    });
    if (!existed) awardXp(db, req.user, XP.nutrition, 'nutrition', day);
    const newly = checkAchievements(db, req.user, gamiCtx(db, req.user), day);
    res.json({ nutrition: n, gami: gamiResult(db, req.user, newly) });
  });

  return r;
}
