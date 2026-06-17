import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLimiter } from '../rate-limit.js';

function fakeReqRes(ip) {
  const res = { statusCode: 200, headers: {}, set(k, v) { this.headers[k] = v; return this; }, status(c) { this.statusCode = c; return this; }, json() { return this; } };
  let passed = false;
  return { req: { ip }, res, next: () => { passed = true; }, get passed() { return passed; } };
}

test('allows up to max requests per window, then 429s', () => {
  const limit = createLimiter({ windowMs: 60_000, max: 3 });
  for (let i = 0; i < 3; i++) {
    const c = fakeReqRes('1.2.3.4');
    limit(c.req, c.res, c.next);
    assert.ok(c.passed, `request ${i + 1} should pass`);
    assert.equal(c.res.statusCode, 200);
  }
  const blocked = fakeReqRes('1.2.3.4');
  limit(blocked.req, blocked.res, blocked.next);
  assert.equal(blocked.passed, false);
  assert.equal(blocked.res.statusCode, 429);
  assert.ok(blocked.res.headers['Retry-After']);
});

test('limits are per-IP', () => {
  const limit = createLimiter({ windowMs: 60_000, max: 1 });
  const a = fakeReqRes('10.0.0.1');
  limit(a.req, a.res, a.next);
  assert.ok(a.passed);
  // a second IP still gets its own allowance
  const b = fakeReqRes('10.0.0.2');
  limit(b.req, b.res, b.next);
  assert.ok(b.passed);
  // but the first IP is now blocked
  const a2 = fakeReqRes('10.0.0.1');
  limit(a2.req, a2.res, a2.next);
  assert.equal(a2.res.statusCode, 429);
});
