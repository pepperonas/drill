/**
 * Integration test: boots the real Express app against an in-memory DB and
 * drives the flexible-tracker endpoints over HTTP with a valid session cookie.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

// Config reads env at import time — set required vars BEFORE importing the app.
process.env.GOOGLE_CLIENT_ID = 'test.apps.googleusercontent.com';
process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
process.env.OAUTH_REDIRECT_URI = 'http://localhost/api/auth/callback';
process.env.APP_ORIGIN = 'http://localhost';
process.env.SESSION_SECRET = 'testsecrettestsecrettestsecret12';

const { openDb } = await import('../db.js');
const { createApp } = await import('../app.js');
const { sign } = await import('../session.js');

let server, base, cookie, db;

before(async () => {
  db = openDb(':memory:');
  const user = db.upsertUser.get({ google_sub: 'api-test', email: 'a@b.c', name: 'API', picture: null, now: 1700000000 });
  cookie = 'drill_session=' + sign({ uid: user.id, exp: 9999999999 }, process.env.SESSION_SECRET);
  await new Promise((res) => { server = createApp(db).listen(0, res); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server && server.close());

const call = (method, path, body) => fetch(base + path, {
  method, headers: { cookie, ...(body ? { 'content-type': 'application/json' } : {}) },
  body: body ? JSON.stringify(body) : undefined,
});

test('GET /api/trackers seeds defaults for a new user', async () => {
  const res = await call('GET', '/api/trackers');
  assert.equal(res.status, 200);
  const { trackers } = await res.json();
  assert.ok(trackers.length >= 5, 'defaults seeded');
});

test('unauthenticated requests are rejected', async () => {
  const res = await fetch(base + '/api/trackers');
  assert.equal(res.status, 401);
});

test('create tracker, add entry (awards XP), read series', async () => {
  const created = await (await call('POST', '/api/trackers', {
    name: 'Liegestütze', type: 'number', unit: 'Wdh', category: 'training', xp: 12,
  })).json();
  const id = created.tracker.id;
  assert.equal(created.tracker.name, 'Liegestütze');

  const e1 = await (await call('POST', `/api/trackers/${id}/entries`, { value: 30, day: '2026-01-01' })).json();
  assert.equal(e1.entry.value, 30);
  assert.ok(e1.gami.xp >= 12, 'xp awarded');

  await call('POST', `/api/trackers/${id}/entries`, { value: 35, day: '2026-01-02' });
  const series = await (await call('GET', `/api/trackers/${id}/series?range=all`)).json();
  assert.equal(series.series.length, 2);
  assert.equal(series.series[1].value, 35);
});

test('goal progress is returned for a tracker with a goal', async () => {
  const created = await (await call('POST', '/api/trackers', {
    name: 'Wasser2', type: 'number', unit: 'ml', goal_value: 2000, goal_direction: 'up',
  })).json();
  const id = created.tracker.id;
  await call('POST', `/api/trackers/${id}/entries`, { value: 1000, day: '2026-01-01' });
  const list = await (await call('GET', '/api/trackers')).json();
  const w = list.trackers.find((t) => t.id === id);
  assert.equal(w.goal.pct, 50);
});

test('correlation endpoint aligns two trackers', async () => {
  const a = (await (await call('POST', '/api/trackers', { name: 'CorrA', type: 'number' })).json()).tracker;
  const b = (await (await call('POST', '/api/trackers', { name: 'CorrB', type: 'number' })).json()).tracker;
  for (let i = 1; i <= 4; i++) {
    const day = `2026-03-0${i}`;
    await call('POST', `/api/trackers/${a.id}/entries`, { value: i, day });
    await call('POST', `/api/trackers/${b.id}/entries`, { value: i * 2, day });
  }
  const corr = await (await call('GET', `/api/insights/correlation?a=${a.id}&b=${b.id}&range=all`)).json();
  assert.equal(corr.n, 4);
  assert.equal(corr.r, 1);
});

test('editable option lists (activity types) round-trip', async () => {
  const created = await (await call('POST', '/api/options/activity', { label: 'Schwimmen', icon: '🏊' })).json();
  assert.equal(created.option.label, 'Schwimmen');
  const list = await (await call('GET', '/api/options/activity')).json();
  assert.equal(list.options.length, 1);
});

test('workout logging detects a personal record', async () => {
  const res = await (await call('POST', '/api/workouts', {
    day: '2026-01-01', category: 'Push',
    sets: [{ exercise: 'Bankdrücken', weight: 100, reps: 5 }],
  })).json();
  assert.ok(res.prs.length === 1 && res.prs[0].exercise === 'Bankdrücken');
});

test('a short bodyweight workout at home logs (no weights, no PR) and persists the place', async () => {
  const res = await (await call('POST', '/api/workouts', {
    day: '2026-04-01', category: 'Ganzkörper', title: 'Bodyweight', place: 'home', duration_min: 20,
    sets: [{ exercise: 'Liegestütze', weight: null, reps: 12 }, { exercise: 'Plank', weight: null, reps: null }],
  })).json();
  assert.equal(res.workout.place, 'home');
  assert.equal(res.workout.sets.length, 2);
  assert.equal(res.workout.sets[0].weight, null);  // bodyweight = no weight stored
  assert.ok((res.prs || []).length === 0, 'no PR from a weightless set');
  assert.ok(res.gami.xp > 0, 'workout still awards XP');

  // it comes back over GET with its place intact
  const got = await (await call('GET', '/api/workouts?limit=10')).json();
  assert.ok(got.workouts.some((w) => w.place === 'home' && w.title === 'Bodyweight'));
});

test('3 dumbbell sets with reps but NO weight: one row stands for N sets, scores intensity, awards bonus XP', async () => {
  const user = db.upsertUser.get({ google_sub: 'inten-user', email: 'i@b.c', name: 'I', picture: null, now: 1700000000 });
  const ck = 'drill_session=' + sign({ uid: user.id, exp: 9999999999 }, process.env.SESSION_SECRET);
  const xp = async () => (await (await fetch(base + '/api/dashboard', { headers: { cookie: ck } })).json()).level.xp;

  const before = await xp();
  const res = await (await fetch(base + '/api/workouts', {
    method: 'POST', headers: { cookie: ck, 'content-type': 'application/json' },
    body: JSON.stringify({
      day: '2026-08-01', category: 'Oberkörper',
      sets: [{ exercise: 'Kurzhantel-Curls', setCount: 3, reps: 12 }],  // weight omitted entirely
    }),
  })).json();

  assert.equal(res.workout.sets.length, 1);          // ONE stored row...
  assert.equal(res.workout.sets[0].set_count, 3);    // ...representing 3 sets
  assert.equal(res.workout.sets[0].weight, null);    // no weight required
  assert.equal(res.workout.intensity, res.intensity.points);
  assert.ok(res.intensity.points > 0, 'reps + sets produce a score without weight');
  assert.ok((res.prs || []).length === 0, 'no PR without weight');

  // base workout XP (40) + the intensity bonus were both awarded
  assert.equal(await xp() - before, 40 + res.intensity.xp);
  assert.ok(res.intensity.xp > 0);
});

test('an invalid place is rejected (stored as null), not persisted verbatim', async () => {
  const res = await (await call('POST', '/api/workouts', {
    day: '2026-04-02', category: 'Cardio', place: 'mars', sets: [],
  })).json();
  assert.equal(res.workout.place, null);
});

test('stats endpoint returns visualization aggregates', async () => {
  const s = await (await call('GET', '/api/stats')).json();
  assert.ok(Array.isArray(s.xpCurve) && s.xpCurve.length > 0, 'xp curve present');
  assert.ok(s.totalXp > 0);
  assert.equal(s.radar.length, 5);
  assert.ok(s.radar.every((d) => d.value >= 0 && d.value <= 100));
  assert.ok(s.categories.some((c) => c.name === 'Push'), 'workout category counted');
  assert.equal(typeof s.heatmap, 'object');
  assert.ok(s.headline && typeof s.headline.xp30 === 'number');
});

test('streak-freeze config is readable and updatable', async () => {
  const got = await (await call('GET', '/api/streak-freeze')).json();
  assert.equal(got.config.balance, 1);            // default starter freeze
  assert.equal(got.config.count_mode, 'preserve');
  const upd = await (await call('PUT', '/api/streak-freeze', {
    enabled: true, name: 'Eisschild', icon: '❄️', color: '#8fd6ff',
    count_mode: 'grow', auto_apply: true, max_freezes: 5,
    earn_per_checkins: 0, earn_per_streak: 7, earn_weekly: 0, earn_on_levelup: true,
  })).json();
  assert.equal(upd.config.name, 'Eisschild');
  assert.equal(upd.config.count_mode, 'grow');
  assert.equal(upd.config.max_freezes, 5);
});

test('undoing a check-in reverses its XP and recomputes the streak', async () => {
  const user = db.upsertUser.get({ google_sub: 'undo-user', email: 'u@b.c', name: 'U', picture: null, now: 1700000000 });
  const ck = 'drill_session=' + sign({ uid: user.id, exp: 9999999999 }, process.env.SESSION_SECRET);
  const post = (day) => fetch(base + '/api/checkins', {
    method: 'POST', headers: { cookie: ck, 'content-type': 'application/json' },
    body: JSON.stringify({ day, kind: 'gym' }),
  }).then((r) => r.json());
  const xp = async () => (await (await fetch(base + '/api/dashboard', { headers: { cookie: ck } })).json()).level.xp;

  await post('2026-07-01');                       // 25 + 5 bonus + 20 first_checkin = 50
  assert.equal(await xp(), 50);
  await post('2026-07-02');                       // + 25 + 10 bonus = 85
  assert.equal(await xp(), 85);

  await fetch(base + '/api/checkins/2026-07-02', { method: 'DELETE', headers: { cookie: ck } });
  assert.equal(await xp(), 50);                   // the second check-in's XP is gone again
});

test('a missed day is auto-bridged by a freeze on the next check-in', async () => {
  // fresh user so streak state is clean
  const user = db.upsertUser.get({ google_sub: 'freeze-user', email: 'f@b.c', name: 'F', picture: null, now: 1700000000 });
  const ck = 'drill_session=' + sign({ uid: user.id, exp: 9999999999 }, process.env.SESSION_SECRET);
  const post = (day) => fetch(base + '/api/checkins', {
    method: 'POST', headers: { cookie: ck, 'content-type': 'application/json' },
    body: JSON.stringify({ day, kind: 'gym' }),
  }).then((r) => r.json());

  await post('2026-05-01');                 // streak 1
  const bridged = await post('2026-05-03'); // missed 05-02 -> freeze bridges it
  assert.equal(bridged.frozen, 1);
  assert.equal(bridged.gami.streak, 2);     // preserve: +1 for the check-in day
  const after = await (await fetch(base + '/api/streak-freeze', { headers: { cookie: ck } })).json();
  assert.equal(after.config.balance, 0);    // the starter freeze was consumed
});
