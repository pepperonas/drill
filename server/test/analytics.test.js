import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../db.js';
import { computeStats } from '../analytics.js';
import { awardXp } from '../gamification.js';
import { dayInTz, addDays } from '../time.js';

function freshUser(db) {
  return db.upsertUser.get({ google_sub: 'a' + Math.random(), email: 'a@b.c', name: 'A', picture: null, now: 1700000000 });
}

test('computeStats builds xp curve, heatmap, radar, weekly and categories', () => {
  const db = openDb(':memory:');
  const u = freshUser(db);
  const today = dayInTz(u.tz);
  const d = (o) => addDays(today, o);

  awardXp(db, u, 25, 'checkin', today, 'c');
  awardXp(db, u, 10, 'streak_bonus', today, 'c');
  awardXp(db, u, 120, 'bonus', today, 'b');     // pushes total over level 2 (xpForLevel(2)=100)
  awardXp(db, u, 40, 'workout', d(-1), 'w');
  awardXp(db, u, 15, 'nutrition', d(-2), 'n');

  db.upsertCheckin.get({ user_id: u.id, day: today, kind: 'gym', note: null, now: 1 });
  db.upsertCheckin.get({ user_id: u.id, day: d(-1), kind: 'gym', note: null, now: 1 });
  db.insertWorkout.get({ user_id: u.id, day: d(-1), category: 'Push', title: null, duration_min: 60, place: null, intensity: null, note: null, now: 1 });
  const t = db.insertTracker.get({
    user_id: u.id, name: 'Gewicht', type: 'number', unit: 'kg', icon: null, color: null,
    category: 'body', options: null, goal_value: null, goal_direction: null,
    scale_min: null, scale_max: null, xp: 10, reminder_time: null, sort: 0, now: 1,
  });
  db.insertEntry.run({ tracker_id: t.id, value: 80, text_value: null, day: today, note: null, now: 1 });

  const s = computeStats(db, u);

  assert.equal(s.totalXp, 210);
  assert.equal(s.xpCurve[s.xpCurve.length - 1].xp, 210);     // cumulative ends at total
  assert.equal(s.heatmap[today], 155);                       // 25+10+120 earned today
  assert.ok(s.levelMarkers.length >= 1 && s.levelMarkers[0].level === 2 && s.levelMarkers[0].xp === 100);

  assert.equal(s.radar.length, 5);
  assert.ok(s.radar.every((r) => r.value >= 0 && r.value <= 100));
  assert.ok(s.radar.find((r) => r.area === 'Konsistenz').value > 0); // 2 check-ins/30d
  assert.ok(s.radar.find((r) => r.area === 'Körper').value > 0);     // 1 body entry/30d

  assert.ok(s.categories.some((c) => c.name === 'Push' && c.value === 1));
  assert.ok(Array.isArray(s.weekly) && s.weekly.length >= 1);
  assert.ok(s.headline.activeDays30 >= 1 && s.headline.bestDay.amt === 155);
});

test('computeStats on an empty account is safe and zeroed', () => {
  const db = openDb(':memory:');
  const u = freshUser(db);
  const s = computeStats(db, u);
  assert.equal(s.totalXp, 0);
  assert.deepEqual(s.xpCurve, []);
  assert.equal(s.levelMarkers.length, 0);
  assert.equal(s.radar.length, 5);
  assert.ok(s.radar.every((r) => r.value === 0));
  assert.equal(s.headline.bestDay, null);
});
