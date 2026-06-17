import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sign, verify } from '../session.js';

const SECRET = 'a-very-secret-key-for-tests-only';
const future = Math.floor(Date.now() / 1000) + 3600;

test('sign/verify round-trips the payload', () => {
  const tok = sign({ uid: 42, exp: future }, SECRET);
  const p = verify(tok, SECRET);
  assert.equal(p.uid, 42);
});

test('verify rejects a token signed with a different secret', () => {
  const tok = sign({ uid: 1, exp: future }, SECRET);
  assert.equal(verify(tok, 'wrong-secret'), null);
});

test('verify rejects a tampered payload or signature', () => {
  const tok = sign({ uid: 1, exp: future }, SECRET);
  const [body, sig] = tok.split('.');
  // flip last char of the body
  assert.equal(verify(`${body.slice(0, -1)}${body.slice(-1) === 'A' ? 'B' : 'A'}.${sig}`, SECRET), null);
  // flip last char of the signature
  assert.equal(verify(`${body}.${sig.slice(0, -1)}${sig.slice(-1) === 'A' ? 'B' : 'A'}`, SECRET), null);
});

test('verify rejects expired tokens but accepts ones without exp', () => {
  assert.equal(verify(sign({ uid: 1, exp: 1 }, SECRET), SECRET), null); // 1970 → expired
  assert.deepEqual(verify(sign({ uid: 7 }, SECRET), SECRET), { uid: 7 }); // no exp → no expiry check
});

test('verify rejects malformed input', () => {
  for (const bad of [null, undefined, '', 'garbage', 'only-one-part', 'a.b.c', 123]) {
    assert.equal(verify(bad, SECRET), null);
  }
});
