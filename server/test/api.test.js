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
