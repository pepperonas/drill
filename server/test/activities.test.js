/**
 * GPS activity upload: awards XP + achievements, feeds the streak via an
 * idempotent check-in, is idempotent on client_uuid, and reverses XP on delete.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.GOOGLE_CLIENT_ID = 'test.apps.googleusercontent.com';
process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
process.env.OAUTH_REDIRECT_URI = 'http://localhost/api/auth/callback';
process.env.APP_ORIGIN = 'http://localhost';
process.env.SESSION_SECRET = 'testsecrettestsecrettestsecret12';

const { openDb } = await import('../db.js');
const { createApp } = await import('../app.js');
const { sign } = await import('../session.js');
const { activityXp } = await import('../routes/activities.js');

let server, base, db;

before(async () => {
  db = openDb(':memory:');
  await new Promise((res) => { server = createApp(db).listen(0, res); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server && server.close());

function freshUserCookie(sub) {
  const u = db.upsertUser.get({ google_sub: sub, email: sub + '@b.c', name: 'A', picture: null, now: 1700000000 });
  return { u, cookie: 'drill_session=' + sign({ uid: u.id, exp: 9999999999 }, process.env.SESSION_SECRET) };
}
const call = (method, path, cookie, body) => fetch(base + path, {
  method, headers: { cookie, ...(body ? { 'content-type': 'application/json' } : {}) },
  body: body ? JSON.stringify(body) : undefined,
});
const xpOf = (cookie) => call('GET', '/api/dashboard', cookie).then((r) => r.json()).then((d) => d.level.xp);

const POLY = 'a~l~Fjk~uOwHJy@P'; // any non-empty encoded polyline

test('activityXp scales with distance and is clamped', () => {
  assert.equal(activityXp(0), 20);        // base
  assert.equal(activityXp(5000), 50);     // 20 + 5*6
  assert.equal(activityXp(10_000_000), 120); // cap
});

test('uploading an activity awards XP + first_activity and advances the streak', async () => {
  const { cookie } = freshUserCookie('act-1');
  const before = await xpOf(cookie);
  const res = await (await call('POST', '/api/activities', cookie, {
    type: 'run', distance_m: 5000, duration_s: 1800, moving_time_s: 1700,
    avg_speed_mps: 2.94, steps: 6000, polyline: POLY, point_count: 300,
    client_uuid: 'uuid-run-1', day: '2026-07-01',
  })).json();

  assert.equal(res.activity.type, 'run');
  assert.equal(res.activity.distance_m, 5000);
  assert.ok(res.gami.unlocked.some((a) => a.code === 'first_activity'));
  assert.equal(res.gami.streak, 1);                      // the run counted as a check-in
  // activity XP (50) + checkin (25) + streak bonus (5) + first_activity (30) + first_checkin (20)
  assert.equal(await xpOf(cookie) - before, 50 + 25 + 5 + 30 + 20);
});

test('re-uploading the same client_uuid is idempotent (no double XP)', async () => {
  const { cookie } = freshUserCookie('act-2');
  const body = { type: 'walk', distance_m: 2000, polyline: POLY, client_uuid: 'dup-1', day: '2026-07-02' };
  const first = await (await call('POST', '/api/activities', cookie, body)).json();
  const afterFirst = await xpOf(cookie);
  const second = await (await call('POST', '/api/activities', cookie, body)).json();
  assert.equal(second.duplicate, true);
  assert.equal(second.activity.id, first.activity.id);
  assert.equal(await xpOf(cookie), afterFirst);          // unchanged
});

test('deleting an activity reverses its activity XP (the check-in stays)', async () => {
  const { cookie } = freshUserCookie('act-3');
  const res = await (await call('POST', '/api/activities', cookie, {
    type: 'cycle', distance_m: 12000, polyline: POLY, client_uuid: 'del-1', day: '2026-07-03',
  })).json();
  const withActivity = await xpOf(cookie);
  await call('DELETE', '/api/activities/' + res.activity.id, cookie);
  const afterDelete = await xpOf(cookie);
  // only the activity XP (base 20 + 12*6 = 92) is reversed; check-in XP remains
  assert.equal(withActivity - afterDelete, 92);
  assert.ok(afterDelete > 0);
});

test('validation: bad type, tiny distance and missing polyline are rejected', async () => {
  const { cookie } = freshUserCookie('act-4');
  assert.equal((await call('POST', '/api/activities', cookie, { type: 'teleport', distance_m: 5000, polyline: POLY })).status, 400);
  assert.equal((await call('POST', '/api/activities', cookie, { type: 'run', distance_m: 3, polyline: POLY })).status, 400);
  assert.equal((await call('POST', '/api/activities', cookie, { type: 'run', distance_m: 5000 })).status, 400);
});

test('GET lists activities and returns a single one with its polyline', async () => {
  const { cookie } = freshUserCookie('act-5');
  const created = await (await call('POST', '/api/activities', cookie, {
    type: 'hike', distance_m: 8000, polyline: POLY, client_uuid: 'get-1',
  })).json();
  const list = await (await call('GET', '/api/activities', cookie)).json();
  assert.equal(list.activities.length, 1);
  const one = await (await call('GET', '/api/activities/' + created.activity.id, cookie)).json();
  assert.equal(one.activity.polyline, POLY);
});
