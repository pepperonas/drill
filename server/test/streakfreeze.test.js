import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../db.js';
import { recomputeStreak } from '../gamification.js';
import {
  ensureFreeze, grantFreeze, consumeFreeze, reconcileEarn, weeklyGrant, isoWeekKey,
} from '../streakfreeze.js';

function freshUser(db) {
  return db.upsertUser.get({
    google_sub: 'sub-' + Math.random(), email: 't@e.st', name: 'T', picture: null, now: 1700000000,
  });
}

// Update config with only the columns the statement expects (avoids strict
// named-parameter errors from spreading the whole row).
function cfgUpdate(db, f, over = {}) {
  return db.updateFreezeConfig.get({
    user_id: f.user_id, enabled: f.enabled, name: f.name, icon: f.icon, color: f.color,
    description: f.description, max_freezes: f.max_freezes, count_mode: f.count_mode,
    auto_apply: f.auto_apply, earn_per_checkins: f.earn_per_checkins,
    earn_per_streak: f.earn_per_streak, earn_weekly: f.earn_weekly,
    earn_on_levelup: f.earn_on_levelup, now: 1, ...over,
  });
}

test('ensureFreeze creates a config row with sensible defaults', () => {
  const db = openDb(':memory:');
  const u = freshUser(db);
  const f = ensureFreeze(db, u);
  assert.equal(f.enabled, 1);
  assert.equal(f.balance, 1);
  assert.equal(f.count_mode, 'preserve');
  assert.equal(f.max_freezes, 3);
  // idempotent
  assert.equal(ensureFreeze(db, u).user_id, f.user_id);
});

test('grantFreeze caps at max_freezes; consumeFreeze logs an apply', () => {
  const db = openDb(':memory:');
  const u = freshUser(db);
  const f = ensureFreeze(db, u); // balance 1, max 3
  assert.equal(grantFreeze(db, u, f, 5, 'test', '2026-01-01'), 2); // only 2 fit
  assert.equal(f.balance, 3);
  consumeFreeze(db, u, f, 1, 'use', '2026-01-02');
  assert.equal(f.balance, 2);
  const ev = db.listFreezeEvents.all(u.id, 10);
  assert.ok(ev.some((e) => e.type === 'earn') && ev.some((e) => e.type === 'apply'));
});

test('recomputeStreak bridges a gap with a freeze (preserve mode)', () => {
  const db = openDb(':memory:');
  const u = freshUser(db);
  const f = ensureFreeze(db, u); // balance 1, preserve
  recomputeStreak(db, u, '2026-01-01', f);
  assert.equal(u.streak_current, 1);
  // miss 2026-01-02, check in 2026-01-03 -> freeze bridges the gap
  const res = recomputeStreak(db, u, '2026-01-03', f);
  assert.equal(res.frozen, 1);
  assert.equal(u.streak_current, 2);   // preserve: +1 for today only
  assert.equal(f.balance, 0);
});

test('recomputeStreak grow mode counts the frozen day', () => {
  const db = openDb(':memory:');
  const u = freshUser(db);
  const f = ensureFreeze(db, u);
  cfgUpdate(db, f, { count_mode: 'grow' });
  const f2 = db.getFreeze.get(u.id);
  recomputeStreak(db, u, '2026-01-01', f2);
  const res = recomputeStreak(db, u, '2026-01-03', f2); // gap of 1
  assert.equal(res.frozen, 1);
  assert.equal(u.streak_current, 3);   // grow: +gap(1) +1 today
});

test('recomputeStreak resets when no freeze available to bridge', () => {
  const db = openDb(':memory:');
  const u = freshUser(db);
  const f = ensureFreeze(db, u);
  f.balance = 0; // exhausted (object only; bridging checks cfg.balance)
  recomputeStreak(db, u, '2026-01-01', f);
  const res = recomputeStreak(db, u, '2026-01-05', f); // 3-day gap, no freezes
  assert.equal(res.frozen, 0);
  assert.equal(u.streak_current, 1);
});

test('reconcileEarn grants per-checkins and per-streak milestones idempotently', () => {
  const db = openDb(':memory:');
  const u = freshUser(db);
  const f = ensureFreeze(db, u);
  cfgUpdate(db, f, { max_freezes: 10, earn_per_checkins: 5, earn_per_streak: 7, earn_on_levelup: 0 });
  const cfg = db.getFreeze.get(u.id);
  cfg.balance = 0;
  u.streak_current = 7;
  reconcileEarn(db, u, cfg, '2026-01-01', 5);  // 5 checkins -> +1, streak 7 -> +1
  assert.equal(cfg.balance, 2);
  // running again with same numbers grants nothing
  reconcileEarn(db, u, cfg, '2026-01-01', 5);
  assert.equal(cfg.balance, 2);
  // streak resets -> milestone drops so a future streak can earn again
  u.streak_current = 1;
  reconcileEarn(db, u, cfg, '2026-01-02', 5);
  assert.equal(cfg.st_milestone, 0);
});

test('reconcileEarn grants on level-up via lvl_milestone delta', () => {
  const db = openDb(':memory:');
  const u = freshUser(db);
  const f = ensureFreeze(db, u);
  cfgUpdate(db, f, { max_freezes: 10, earn_per_streak: 0, earn_on_levelup: 1 });
  const cfg = db.getFreeze.get(u.id);
  cfg.balance = 0;
  u.level = 4; // from 1 -> 4 = +3 levels
  reconcileEarn(db, u, cfg, '2026-01-01', 0);
  assert.equal(cfg.balance, 3);
  assert.equal(cfg.lvl_milestone, 4);
});

test('weeklyGrant tops up once per ISO week', () => {
  const db = openDb(':memory:');
  const u = freshUser(db);
  const f = ensureFreeze(db, u);
  cfgUpdate(db, f, { max_freezes: 10, earn_weekly: 2 });
  const cfg = db.getFreeze.get(u.id);
  cfg.balance = 0;
  assert.equal(weeklyGrant(db, u, cfg, '2026-06-15'), 2);
  assert.equal(weeklyGrant(db, u, cfg, '2026-06-16'), 0); // same ISO week
  assert.equal(weeklyGrant(db, u, cfg, '2026-06-23'), 2); // next week
});

test('isoWeekKey is stable within a week and changes across weeks', () => {
  assert.equal(isoWeekKey('2026-06-15'), isoWeekKey('2026-06-21')); // Mon..Sun same week
  assert.notEqual(isoWeekKey('2026-06-15'), isoWeekKey('2026-06-22'));
});
