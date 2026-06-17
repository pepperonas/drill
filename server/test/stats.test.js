import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../db.js';
import { nudgeForDay, weeklyMessage, rangeStats } from '../stats.js';

function freshUser(db) {
  return db.upsertUser.get({ google_sub: 's' + Math.random(), email: 's@b.c', name: 'S', picture: null, now: 1700000000 });
}

test('nudgeForDay is deterministic per day and always valid', () => {
  const a = nudgeForDay('2026-01-01');
  const b = nudgeForDay('2026-01-01');
  assert.deepEqual(a, b);
  for (const day of ['2026-01-01', '2026-02-15', '2026-12-31']) {
    const n = nudgeForDay(day);
    assert.ok(n.subject && n.title && n.body);
  }
});

test('weeklyMessage scales with the number of check-ins', () => {
  assert.match(weeklyMessage({ checkins: 0 }), /Neustart/);
  assert.match(weeklyMessage({ checkins: 5 }), /Wahnsinns/);
  assert.match(weeklyMessage({ checkins: 3 }), /Solide/);
  assert.match(weeklyMessage({ checkins: 1 }), /Anfang/);
});

test('rangeStats counts only within the window and computes weight delta', () => {
  const db = openDb(':memory:');
  const u = freshUser(db);
  db.upsertCheckin.get({ user_id: u.id, day: '2026-03-02', kind: 'gym', note: null, now: 1 });
  db.upsertCheckin.get({ user_id: u.id, day: '2026-03-05', kind: 'gym', note: null, now: 1 });
  db.upsertCheckin.get({ user_id: u.id, day: '2026-02-01', kind: 'gym', note: null, now: 1 }); // outside
  db.insertWorkout.get({ user_id: u.id, day: '2026-03-03', category: 'Push', title: null, duration_min: 60, note: null, now: 1 });
  const w = db.insertTracker.get({
    user_id: u.id, name: 'weight', type: 'number', unit: 'kg', icon: null, color: null, category: 'body',
    options: null, goal_value: null, goal_direction: null, scale_min: null, scale_max: null, xp: 10, reminder_time: null, sort: 0, now: 1,
  });

  const s = rangeStats(db, u, '2026-03-01', '2026-03-07');
  assert.equal(s.checkins, 2);   // the Feb one is excluded
  assert.equal(s.workouts, 1);
});

test('rangeStats reports weight delta across the window', () => {
  const db = openDb(':memory:');
  const u = freshUser(db);
  // legacy metrics table is what rangeStats reads for weight delta
  db.insertMetric.get({ user_id: u.id, kind: 'weight', value: 84, unit: 'kg', day: '2026-03-01', note: null, now: 1 });
  db.insertMetric.get({ user_id: u.id, kind: 'weight', value: 82.5, unit: 'kg', day: '2026-03-07', note: null, now: 1 });
  const s = rangeStats(db, u, '2026-03-01', '2026-03-07');
  assert.equal(s.weightDelta, -1.5);
});
