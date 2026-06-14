/**
 * Streak-freeze configuration routes. Users read and fully customize their own
 * freeze behaviour (scoring + presentation). The balance and milestone state are
 * managed by the engine (check-in flow + cron) — not editable here directly.
 */
import express from 'express';
import { ensureFreeze, persistFreezeState, COUNT_MODES } from '../streakfreeze.js';

const clampInt = (v, lo, hi, dflt) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, Math.round(n))) : dflt;
};

function publicConfig(f) {
  return {
    enabled: !!f.enabled,
    name: f.name, icon: f.icon, color: f.color, description: f.description,
    max_freezes: f.max_freezes, count_mode: f.count_mode, auto_apply: !!f.auto_apply,
    earn_per_checkins: f.earn_per_checkins, earn_per_streak: f.earn_per_streak,
    earn_weekly: f.earn_weekly, earn_on_levelup: !!f.earn_on_levelup,
    balance: f.balance,
  };
}

export function streakFreezeRoutes(db, auth) {
  const r = express.Router();
  r.use(auth.requireUser);
  const now = () => Math.floor(Date.now() / 1000);

  r.get('/streak-freeze', (req, res) => {
    const f = ensureFreeze(db, req.user);
    res.json({ config: publicConfig(f), events: db.listFreezeEvents.all(req.user.id, 20) });
  });

  r.put('/streak-freeze', (req, res) => {
    const cur = ensureFreeze(db, req.user);
    const b = req.body || {};
    const next = db.updateFreezeConfig.get({
      user_id: req.user.id,
      enabled: b.enabled ? 1 : 0,
      name: String(b.name ?? cur.name).slice(0, 40) || 'Streak-Schutz',
      icon: String(b.icon ?? cur.icon).slice(0, 8) || '🧊',
      color: String(b.color ?? cur.color).slice(0, 16) || '#8fd6ff',
      description: b.description != null ? String(b.description).slice(0, 200) : cur.description,
      max_freezes: clampInt(b.max_freezes, 0, 30, cur.max_freezes),
      count_mode: COUNT_MODES.includes(b.count_mode) ? b.count_mode : cur.count_mode,
      auto_apply: b.auto_apply ? 1 : 0,
      earn_per_checkins: clampInt(b.earn_per_checkins, 0, 365, cur.earn_per_checkins),
      earn_per_streak: clampInt(b.earn_per_streak, 0, 365, cur.earn_per_streak),
      earn_weekly: clampInt(b.earn_weekly, 0, 30, cur.earn_weekly),
      earn_on_levelup: b.earn_on_levelup ? 1 : 0,
      now: now(),
    });
    // keep balance within the (possibly lowered) cap
    if (next.balance > next.max_freezes) {
      next.balance = next.max_freezes;
      persistFreezeState(db, next);
    }
    res.json({ config: publicConfig(next) });
  });

  return r;
}
