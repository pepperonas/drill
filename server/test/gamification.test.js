import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../db.js';
import {
  xpForLevel, levelForXp, levelProgress, awardXp, recomputeStreak,
  effectiveStreak, checkAchievements, reverseXpByRef, rebuildXp, activityXp, XP,
} from '../gamification.js';
import { workoutIntensity, intensityXp } from '../trackers.js';

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

test('reverseXpByRef removes an action\'s XP and recomputes the rollup', () => {
  const db = openDb(':memory:');
  const u = freshUser(db);
  awardXp(db, u, 25, 'checkin', '2026-01-01', 'checkin:2026-01-01');
  awardXp(db, u, 5, 'streak_bonus', '2026-01-01', 'checkin:2026-01-01');
  awardXp(db, u, 40, 'workout', '2026-01-01', 'workout:1');
  assert.equal(u.xp, 70);
  reverseXpByRef(db, u, 'checkin:2026-01-01');  // undo the check-in (base + bonus)
  assert.equal(u.xp, 40);                       // only the workout remains
  assert.equal(u.level, levelForXp(40));
});

test('rebuildXp self-heals an inflated ledger to ground truth', () => {
  const db = openDb(':memory:');
  const u = freshUser(db);
  const now = 1700000000;
  // ground truth: one check-in on 06-14 and the first_checkin achievement
  db.upsertCheckin.get({ user_id: u.id, day: '2026-06-14', kind: 'gym', note: null, now });
  db.insertAchievement.run(u.id, 'first_checkin', now); // bonus 20
  // simulate drift: orphan XP from undone check-ins still in the ledger
  db.insertXp.run({ user_id: u.id, amount: 70, reason: 'orphan', day: '2026-06-15', now, ref: null });
  db.updateUserGami.run({ id: u.id, xp: 120, level: 2, streak_current: 2, streak_best: 2, last_checkin_day: '2026-06-15' });

  const r = rebuildXp(db, u);
  // 25 (checkin) + 5 (streak bonus, streak 1) + 20 (first_checkin) = 50
  assert.equal(r.xp, 50);
  assert.equal(r.level, 1);
  assert.equal(u.streak_current, 1);
  assert.equal(u.last_checkin_day, '2026-06-14');
});

test('rebuildXp re-derives XP from check-ins, workouts, nutrition, entries and achievements', () => {
  const db = openDb(':memory:');
  const u = freshUser(db);
  const now = 1;
  db.upsertCheckin.get({ user_id: u.id, day: '2026-01-01', kind: 'gym', note: null, now });
  db.insertWorkout.get({ user_id: u.id, day: '2026-01-01', category: 'Push', title: null, duration_min: 60, place: null, intensity: null, note: null, now });
  db.upsertNutrition.get({ user_id: u.id, day: '2026-01-01', kcal: 2000, protein_g: 150, carbs_g: 200, fat_g: 60, quality: 4, water_ml: 2000, note: null, now });
  const t = db.insertTracker.get({
    user_id: u.id, name: 'Gewicht', type: 'number', unit: 'kg', icon: null, color: null, category: 'body',
    options: null, goal_value: null, goal_direction: null, scale_min: null, scale_max: null, xp: 10, reminder_time: null, sort: 0, now,
  });
  db.insertEntry.run({ tracker_id: t.id, value: 80, text_value: null, day: '2026-01-01', note: null, now });
  db.insertAchievement.run(u.id, 'first_checkin', now); // bonus 20

  const r = rebuildXp(db, u);
  // checkin 25 + streak bonus 5 + workout 40 + nutrition 15 + entry 10 + achievement 20 = 115
  assert.equal(r.xp, 115);
});

test('rebuildXp re-derives GPS activity XP (regression: was dropped on rebuild)', () => {
  const db = openDb(':memory:');
  const u = freshUser(db);
  db.insertActivity.get({
    user_id: u.id, type: 'run', day: '2026-01-01', start_time: 1, end_time: 2,
    distance_m: 5000, duration_s: 1800, moving_time_s: 1700, avg_speed_mps: 2.9,
    max_speed_mps: 4, elevation_gain_m: null, steps: 6000, polyline: 'abc',
    point_count: 3, title: null, note: null, source: 'test', client_uuid: 'r1', now: 1,
  });
  const r = rebuildXp(db, u);
  assert.equal(r.xp, activityXp(5000));          // 50 — the activity XP is restored
  reverseXpByRef(db, u, 'activity:1');
  assert.equal(u.xp, 0);
});

test('progress percentage stays within 0..100', () => {
  for (const xp of [0, 1, 99, 100, 500, 5000]) {
    const p = levelProgress(xp);
    assert.ok(p.pct >= 0 && p.pct <= 100);
  }
});

test('levelProgress exposes correct level boundaries', () => {
  // xpForLevel(2)=100, xpForLevel(3)=round(100*2^1.6)=303
  const p = levelProgress(150);
  assert.equal(p.level, 2);
  assert.equal(p.levelXp, 50);          // 150 - 100
  assert.equal(p.levelNeed, 203);       // 303 - 100
  assert.equal(p.nextLevelXp, 303);
  assert.equal(p.pct, 25);              // round(50/203*100)
});

test('rebuildXp re-derives a workout\'s intensity bonus and ties it to the same ref', () => {
  const db = openDb(':memory:');
  const u = freshUser(db);
  const w = db.insertWorkout.get({
    user_id: u.id, day: '2026-01-01', category: 'Beine', title: null,
    duration_min: null, place: 'gym', intensity: null, note: null, now: 1,
  });
  db.insertSet.run({ workout_id: w.id, exercise: 'Kniebeuge', weight: 50, reps: 10, set_count: 3, sort: 0 });

  const bonus = intensityXp(workoutIntensity(db.listSets.all(w.id)).points);
  assert.equal(bonus, 15);                       // 1500/150 + 30/10 + 3*0.5 = 14.5 -> 15
  const r = rebuildXp(db, u);
  assert.equal(r.xp, XP.workout + bonus);         // 40 base + 15 intensity = 55

  // base + intensity share `workout:<id>`, so one undo reverses both
  reverseXpByRef(db, u, `workout:${w.id}`);
  assert.equal(u.xp, 0);
});

test('rebuildXp caps the per-day streak bonus at 50', () => {
  const db = openDb(':memory:');
  const u = freshUser(db);
  // 12 consecutive check-ins, no achievements unlocked
  for (let d = 1; d <= 12; d++) {
    db.upsertCheckin.get({ user_id: u.id, day: `2026-03-${String(d).padStart(2, '0')}`, kind: 'gym', note: null, now: d });
  }
  const r = rebuildXp(db, u);
  // base 25*12 = 300; bonus days 1..10 = 5+10+...+50 = 275, days 11..12 capped = 50+50
  // (uncapped would be 55+60); 275 + 100 = 375  ->  total 675
  assert.equal(r.xp, 675);
  assert.equal(u.streak_current, 12);
});
