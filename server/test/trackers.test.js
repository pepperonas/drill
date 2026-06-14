import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../db.js';
import {
  est1RM, goalProgress, alignSeries, pearson, movingAverage,
  seedDefaultsIfEmpty, DEFAULT_TRACKERS,
} from '../trackers.js';

function freshUser(db) {
  return db.upsertUser.get({
    google_sub: 'sub-' + Math.random(), email: 't@e.st', name: 'Tester', picture: null, now: 1700000000,
  });
}
function mkTracker(db, user, over = {}) {
  return db.insertTracker.get({
    user_id: user.id, name: 'X', type: 'number', unit: 'kg', icon: null, color: null,
    category: 'body', options: null, goal_value: null, goal_direction: null,
    scale_min: null, scale_max: null, xp: 10, reminder_time: null, sort: 0,
    now: 1700000000, ...over,
  });
}

// ---- pure helpers ----

test('est1RM uses Epley and handles edge cases', () => {
  assert.equal(est1RM(100, 1), 100);
  assert.equal(est1RM(100, 10), 133.3);
  assert.equal(est1RM(0, 5), 0);
  assert.equal(est1RM(80, 0), 0);
});

test('goalProgress: up direction', () => {
  const g = goalProgress({ goal_value: 100, goal_direction: 'up' }, 50);
  assert.equal(g.pct, 50);
  assert.equal(g.reached, false);
  assert.equal(goalProgress({ goal_value: 100, goal_direction: 'up' }, 120).reached, true);
});

test('goalProgress: down direction reaches at/below goal', () => {
  assert.equal(goalProgress({ goal_value: 80, goal_direction: 'down' }, 78).reached, true);
  assert.equal(goalProgress({ goal_value: 80, goal_direction: 'down' }, 90).reached, false);
});

test('goalProgress: maintain within tolerance', () => {
  const g = goalProgress({ goal_value: 80, goal_direction: 'maintain' }, 80);
  assert.equal(g.reached, true);
  assert.equal(g.pct, 100);
});

test('goalProgress: null when no goal', () => {
  assert.equal(goalProgress({ goal_value: null }, 50), null);
  assert.equal(goalProgress({ goal_value: 50, goal_direction: 'up' }, null), null);
});

test('alignSeries keeps only common days', () => {
  const a = [{ day: '2026-01-01', value: 1 }, { day: '2026-01-02', value: 2 }, { day: '2026-01-03', value: 3 }];
  const b = [{ day: '2026-01-02', value: 20 }, { day: '2026-01-03', value: 30 }];
  const pairs = alignSeries(a, b);
  assert.equal(pairs.length, 2);
  assert.deepEqual(pairs[0], { day: '2026-01-02', a: 2, b: 20 });
});

test('pearson detects perfect positive correlation, null under 3 points', () => {
  const pairs = [{ a: 1, b: 2 }, { a: 2, b: 4 }, { a: 3, b: 6 }, { a: 4, b: 8 }];
  assert.equal(pearson(pairs), 1);
  assert.equal(pearson([{ a: 1, b: 1 }, { a: 2, b: 2 }]), null);
});

test('movingAverage smooths over the window', () => {
  const s = [{ day: 'a', value: 0 }, { day: 'b', value: 10 }, { day: 'c', value: 20 }];
  const ma = movingAverage(s, 2);
  assert.equal(ma[0].avg, 0);
  assert.equal(ma[1].avg, 5);
  assert.equal(ma[2].avg, 15);
});

// ---- DB flow ----

test('seedDefaultsIfEmpty seeds once and is idempotent', () => {
  const db = openDb(':memory:');
  const u = freshUser(db);
  const created = seedDefaultsIfEmpty(db, u);
  assert.equal(created.length, DEFAULT_TRACKERS.length);
  const again = seedDefaultsIfEmpty(db, u);
  assert.equal(again.length, 0);
  assert.equal(db.countTrackers.get(u.id).n, DEFAULT_TRACKERS.length);
});

test('tracker entries: insert, latest, range filter, count, cascade delete', () => {
  const db = openDb(':memory:');
  const u = freshUser(db);
  const t = mkTracker(db, u);
  db.insertEntry.run({ tracker_id: t.id, value: 80, text_value: null, day: '2026-01-01', note: null, now: 1 });
  db.insertEntry.run({ tracker_id: t.id, value: 79, text_value: null, day: '2026-01-10', note: null, now: 2 });
  assert.equal(db.latestEntry.get(t.id).value, 79);
  assert.equal(db.listEntries.all(t.id, '2026-01-05').length, 1);
  assert.equal(db.countEntries.get(u.id).n, 2);
  // deleting the tracker cascades to its entries
  db.deleteTracker.run(t.id, u.id);
  assert.equal(db.countEntries.get(u.id).n, 0);
});

test('personal records upsert keeps the better estimated 1RM', () => {
  const db = openDb(':memory:');
  const u = freshUser(db);
  db.upsertPR.run({ user_id: u.id, exercise: 'Bench', weight: 80, reps: 5, est_1rm: est1RM(80, 5), day: '2026-01-01', now: 1 });
  let pr = db.getPR.get(u.id, 'Bench');
  assert.equal(pr.weight, 80);
  // a heavier single beats it
  db.upsertPR.run({ user_id: u.id, exercise: 'Bench', weight: 95, reps: 1, est_1rm: est1RM(95, 1), day: '2026-02-01', now: 2 });
  pr = db.getPR.get(u.id, 'Bench');
  assert.equal(pr.weight, 95);
  assert.equal(db.listPRs.all(u.id).length, 1);
});

test('user_options CRUD for editable pickers', () => {
  const db = openDb(':memory:');
  const u = freshUser(db);
  const o = db.insertOption.get({ user_id: u.id, domain: 'activity', label: 'Schwimmen', icon: '🏊', color: null, sort: 0 });
  assert.equal(db.listOptions.all(u.id, 'activity').length, 1);
  db.deleteOption.run(o.id, u.id);
  assert.equal(db.listOptions.all(u.id, 'activity').length, 0);
});

test('choice/text entries store text_value', () => {
  const db = openDb(':memory:');
  const u = freshUser(db);
  const t = mkTracker(db, u, { type: 'choice', options: JSON.stringify(['A', 'B']) });
  const e = db.insertEntry.get({ tracker_id: t.id, value: null, text_value: 'A', day: '2026-01-01', note: null, now: 1 });
  assert.equal(e.text_value, 'A');
  assert.equal(e.value, null);
});
