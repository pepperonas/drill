import { test, before } from 'node:test';
import assert from 'node:assert/strict';

// email-templates.js imports config.js, which requires these at load time.
process.env.GOOGLE_CLIENT_ID = 'test.apps.googleusercontent.com';
process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
process.env.OAUTH_REDIRECT_URI = 'https://drill.celox.io/api/auth/callback';
process.env.APP_ORIGIN = 'https://drill.celox.io';
process.env.SESSION_SECRET = 'testsecrettestsecrettestsecret12';

let T;
before(async () => { T = await import('../email-templates.js'); });

test('user-provided name is HTML-escaped (no XSS in emails)', () => {
  const m = T.streakAlertEmail({ name: '<script>alert(1)</script>', token: 'tok', streak: 5 });
  assert.ok(!m.html.includes('<script>alert(1)</script>'));
  assert.ok(m.html.includes('&lt;script&gt;'));
});

test('confirm email contains the confirm link with the token', () => {
  const m = T.confirmEmail({ name: 'Max', token: 'abc123' });
  assert.ok(m.subject && m.subject.length > 0);
  assert.ok(m.html.includes('/api/email/confirm?token=abc123'));
});

test('every recurring email carries an unsubscribe link with the token', () => {
  const stats = { checkins: 4, workouts: 2, streak: 3, level: 5, xpWeek: 200, weightDelta: -0.5, message: 'stark' };
  const weekly = T.weeklyEmail({ name: 'Max', token: 'T1', stats });
  const nudge = T.dailyNudgeEmail({ name: 'Max', token: 'T2', line: { subject: 's', title: 't', body: 'b' } });
  assert.ok(weekly.html.includes('/api/email/unsubscribe?token=T1'));
  assert.ok(nudge.html.includes('/api/email/unsubscribe?token=T2'));
  assert.ok(weekly.subject.includes('4')); // check-in count surfaced in subject
});
