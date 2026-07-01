/**
 * Device pairing + Bearer-token auth: the web mints a code, the app claims it
 * for an opaque token, and that token authenticates API calls (and is revocable).
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

let server, base, cookie, db, userId;

before(async () => {
  db = openDb(':memory:');
  const user = db.upsertUser.get({ google_sub: 'pair-test', email: 'p@b.c', name: 'Pair', picture: null, now: 1700000000 });
  userId = user.id;
  cookie = 'drill_session=' + sign({ uid: user.id, exp: 9999999999 }, process.env.SESSION_SECRET);
  await new Promise((res) => { server = createApp(db).listen(0, res); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server && server.close());

const json = (method, path, { body, cookie: ck, bearer } = {}) => fetch(base + path, {
  method,
  headers: {
    ...(ck ? { cookie: ck } : {}),
    ...(bearer ? { authorization: 'Bearer ' + bearer } : {}),
    ...(body ? { 'content-type': 'application/json' } : {}),
  },
  body: body ? JSON.stringify(body) : undefined,
});

test('pairing start (authed) issues a code; claim (public) returns a device token', async () => {
  const started = await (await json('POST', '/api/pairing/start', { cookie })).json();
  assert.match(started.code, /^[A-Z0-9]{6}$/);
  assert.ok(started.expires_at > 1700000000);

  // claim needs NO session
  const claimed = await (await json('POST', '/api/pairing/claim', { body: { code: started.code, device_name: 'Pixel' } })).json();
  assert.ok(claimed.token && claimed.token.length >= 32);
  assert.equal(claimed.user.email, 'p@b.c');

  // the token authenticates an API call via Bearer
  const list = await json('GET', '/api/activities', { bearer: claimed.token });
  assert.equal(list.status, 200);
  assert.deepEqual((await list.json()).activities, []);

  // it shows up in the device list
  const devs = await (await json('GET', '/api/pairing/devices', { cookie })).json();
  assert.ok(devs.devices.some((d) => d.name === 'Pixel'));
});

test('a code cannot be claimed twice', async () => {
  const { code } = await (await json('POST', '/api/pairing/start', { cookie })).json();
  const first = await json('POST', '/api/pairing/claim', { body: { code } });
  assert.equal(first.status, 200);
  const second = await json('POST', '/api/pairing/claim', { body: { code } });
  assert.equal(second.status, 400);
});

test('an unknown / bad code is rejected; a bad bearer is unauthenticated', async () => {
  const bad = await json('POST', '/api/pairing/claim', { body: { code: 'ZZZZZZ' } });
  assert.equal(bad.status, 400);
  const noauth = await json('GET', '/api/activities', { bearer: 'deadbeef-not-a-token' });
  assert.equal(noauth.status, 401);
});

test('revoking a device invalidates its token', async () => {
  const { code } = await (await json('POST', '/api/pairing/start', { cookie })).json();
  const token = (await (await json('POST', '/api/pairing/claim', { body: { code, device_name: 'ToRevoke' } })).json()).token;
  assert.equal((await json('GET', '/api/activities', { bearer: token })).status, 200);

  const devs = (await (await json('GET', '/api/pairing/devices', { cookie })).json()).devices;
  const dev = devs.find((d) => d.name === 'ToRevoke');
  await json('POST', `/api/pairing/devices/${dev.id}/revoke`, { cookie });

  assert.equal((await json('GET', '/api/activities', { bearer: token })).status, 401);
});

test('expired codes are rejected', async () => {
  // insert an already-expired code directly
  db.insertPairing.run({ code: 'EXPIRED', user_id: userId, now: 1, expires: 2 });
  const res = await json('POST', '/api/pairing/claim', { body: { code: 'EXPIRED' } });
  assert.equal(res.status, 400);
});
