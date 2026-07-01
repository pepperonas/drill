/**
 * GPS-tracked activities uploaded by the native app. Like the other write
 * routes, every upload flows through the gamification engine (XP + achievements)
 * and returns a `gami` delta. An activity also registers an idempotent day
 * check-in, so going for a run counts toward the streak.
 *
 * Uploads are idempotent on `client_uuid` (offline-sync retries never
 * double-count), and the awarded XP is reversible via the `activity:<id>` ref.
 */
import express from 'express';
import { dayInTz } from '../time.js';
import { awardXp, reverseXpByRef, recomputeStreak, checkAchievements, XP } from '../gamification.js';
import { ensureFreeze, reconcileEarn } from '../streakfreeze.js';
import { gamiCtx, gamiResult } from '../gami-helpers.js';

const TYPES = new Set(['walk', 'run', 'cycle', 'hike', 'other']);

// Base XP + a gentle distance bonus (6 XP/km), capped so a marathon can't
// distort the level economy.
export function activityXp(distanceM) {
  const km = (Number(distanceM) || 0) / 1000;
  return Math.min(120, Math.max(XP.activity, Math.round(XP.activity + km * 6)));
}

export function activitiesRoutes(db, auth) {
  const r = express.Router();
  r.use(auth.requireUser);
  const now = () => Math.floor(Date.now() / 1000);

  r.get('/activities', (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    res.json({ activities: db.listActivities.all(req.user.id, limit) });
  });

  r.get('/activities/:id', (req, res) => {
    const a = db.getActivity.get(Number(req.params.id), req.user.id);
    if (!a) return res.status(404).json({ error: 'not_found' });
    res.json({ activity: a });
  });

  r.post('/activities', (req, res) => {
    const b = req.body || {};
    const type = TYPES.has(b.type) ? b.type : null;
    if (!type) return res.status(400).json({ error: 'invalid_type' });
    const distance_m = Number(b.distance_m);
    if (!Number.isFinite(distance_m) || distance_m < 10) return res.status(400).json({ error: 'distance_too_small' });
    if (!b.polyline || typeof b.polyline !== 'string') return res.status(400).json({ error: 'polyline_required' });

    // Idempotency: a re-uploaded activity (same client_uuid) returns the stored
    // one and awards nothing again.
    const client_uuid = b.client_uuid ? String(b.client_uuid).slice(0, 64) : null;
    if (client_uuid) {
      const existing = db.getActivityByUuid.get(req.user.id, client_uuid);
      if (existing) return res.json({ activity: existing, gami: gamiResult(db, req.user, []), duplicate: true });
    }

    const day = b.day || dayInTz(req.user.tz);
    const num = (x) => (x == null || x === '' ? null : Number(x));
    const a = db.insertActivity.get({
      user_id: req.user.id, type, day,
      start_time: num(b.start_time), end_time: num(b.end_time),
      distance_m, duration_s: num(b.duration_s), moving_time_s: num(b.moving_time_s),
      avg_speed_mps: num(b.avg_speed_mps), max_speed_mps: num(b.max_speed_mps),
      elevation_gain_m: num(b.elevation_gain_m), steps: num(b.steps),
      polyline: String(b.polyline).slice(0, 200000), point_count: num(b.point_count),
      title: b.title ? String(b.title).slice(0, 120) : null,
      note: b.note ? String(b.note).slice(0, 500) : null,
      source: b.source ? String(b.source).slice(0, 40) : 'android',
      client_uuid, now: now(),
    });

    // Base + distance XP (reversible via the activity ref).
    awardXp(db, req.user, activityXp(distance_m), 'activity:' + type, day, `activity:${a.id}`);

    // Register the day as a check-in (kind 'sport') so the activity feeds the
    // streak — mirrors the check-in flow in routes/tracking.js. Idempotent:
    // if the user already checked in today, we only award the activity XP.
    if (!db.getCheckin.get(req.user.id, day)) {
      const cfg = ensureFreeze(db, req.user);
      db.upsertCheckin.get({ user_id: req.user.id, day, kind: 'sport', note: null, now: now() });
      recomputeStreak(db, req.user, day, cfg);
      awardXp(db, req.user, XP.checkin, 'checkin', day, `checkin:${day}`);
      const bonus = Math.min(req.user.streak_current * XP.streak_bonus, 50);
      if (bonus > 0) awardXp(db, req.user, bonus, 'streak_bonus', day, `checkin:${day}`);
      reconcileEarn(db, req.user, cfg, day, db.countCheckins.get(req.user.id).n);
    }

    const newly = checkAchievements(db, req.user, gamiCtx(db, req.user), day);
    res.json({ activity: a, gami: gamiResult(db, req.user, newly) });
  });

  r.delete('/activities/:id', (req, res) => {
    const id = Number(req.params.id);
    const a = db.getActivity.get(id, req.user.id);
    if (!a) return res.status(404).json({ error: 'not_found' });
    db.deleteActivity.run(id, req.user.id);
    reverseXpByRef(db, req.user, `activity:${id}`);   // the day check-in stays
    res.json({ ok: true, gami: gamiResult(db, req.user, []) });
  });

  return r;
}
