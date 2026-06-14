import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../db.js';
import {
  xpForLevel, levelForXp, levelProgress, awardXp, recomputeStreak,
  effectiveStreak, checkAchievements,
} from '../gamification.js';

function freshUser(db) {
  return db.upsertUser.get({
    google_sub: 'sub-' + Math.random(), email: 't@e.st', name: 'Tester',
    picture: null, now: 1700000000,
  });
}

test('level curve is monotonic and starts at 1', () => {
  assert.equal(levelForXp(0), 1);
  let prev = -1;
  for (let l = 1; l <= 20; l++) {
    const need = xpForLevel(l);
    assert.ok(need > prev, `level ${l} need ${need} should exceed ${prev}`);
    prev = need;
  }
  assert.equal(levelForXp(xpForLevel(5)), 5);
});

test('awardXp accumulates and levels up', () => {
  const db = openDb(':memory:');
  const u = freshUser(db);
  const r1 = awardXp(db, u, 50, 'test', '2026-01-01');
  assert.equal(r1.xp, 50);
  assert.equal(r1.level, 1);
  const r2 = awardXp(db, u, 200, 'test', '2026-01-01');
  assert.ok(r2.level >= 2);
  assert.ok(r2.leveledUp);
});

test('streak counts consecutive days and resets on gap', () => {
  const db = openDb(':memory:');
  const u = freshUser(db);
  recomputeStreak(db, u, '2026-01-01');
  assert.equal(u.streak_current, 1);
  recomputeStreak(db, u, '2026-01-02');
  assert.equal(u.streak_current, 2);
  recomputeStreak(db, u, '2026-01-03');
  assert.equal(u.streak_current, 3);
  assert.equal(u.streak_best, 3);
  // gap of 2 days -> reset
  recomputeStreak(db, u, '2026-01-06');
  assert.equal(u.streak_current, 1);
  assert.equal(u.streak_best, 3);
});

test('effectiveStreak expires when last checkin is too old', () => {
  const db = openDb(':memory:');
  const u = freshUser(db);
  recomputeStreak(db, u, '2026-01-10');
  assert.equal(effectiveStreak(u, '2026-01-10'), 1); // same day
  assert.equal(effectiveStreak(u, '2026-01-11'), 1); // yesterday's checkin still valid today
  assert.equal(effectiveStreak(u, '2026-01-13'), 0); // too old
});

test('achievements unlock once and award bonus xp', () => {
  const db = openDb(':memory:');
  const u = freshUser(db);
  recomputeStreak(db, u, '2026-01-01');
  const ctx = { checkins: 1, workouts: 0, volume: 0, metrics: 0, nutritionDays: 0 };
  const newly = checkAchievements(db, u, ctx, '2026-01-01');
  assert.ok(newly.find(a => a.code === 'first_checkin'));
  // second call: no duplicate
  const again = checkAchievements(db, u, ctx, '2026-01-01');
  assert.equal(again.length, 0);
});

test('long-term & PR/tracker achievements unlock at their thresholds', () => {
  const db = openDb(':memory:');
  const u = freshUser(db);
  u.streak_current = 14;
  const ctx = { checkins: 50, workouts: 100, volume: 50000, metrics: 100, nutritionDays: 30, records: 10, trackers: 8 };
  const newly = checkAchievements(db, u, ctx, '2026-01-01');
  const codes = new Set(newly.map((a) => a.code));
  // ctx- and streak-driven achievements (level achievements derive from real XP,
  // tested separately via awardXp leveling).
  for (const c of ['checkins_50', 'streak_14', 'workouts_100', 'volume_25t', 'first_pr', 'prs_10',
    'tracker_variety', 'entries_100', 'nutrition_30']) {
    assert.ok(codes.has(c), `expected ${c} to unlock`);
  }
  // higher tiers not yet reached (50 t volume clears 25 t but not 100 t)
  assert.ok(!codes.has('volume_100t'));
  assert.ok(!codes.has('checkins_365'));
  assert.ok(!codes.has('streak_30'));
});

test('progress percentage stays within 0..100', () => {
  for (const xp of [0, 1, 99, 100, 500, 5000]) {
    const p = levelProgress(xp);
    assert.ok(p.pct >= 0 && p.pct <= 100);
  }
});
