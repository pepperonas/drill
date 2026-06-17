import { test, before } from 'node:test';
import assert from 'node:assert/strict';

// cron.js → config.js requires these at import time.
process.env.GOOGLE_CLIENT_ID = 'test.apps.googleusercontent.com';
process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
process.env.OAUTH_REDIRECT_URI = 'https://drill.celox.io/api/auth/callback';
process.env.APP_ORIGIN = 'https://drill.celox.io';
process.env.SESSION_SECRET = 'testsecrettestsecrettestsecret12';

let openDb, jobs, ensureFreeze, dayInTz, addDays;
before(async () => {
  ({ openDb } = await import('../db.js'));
  ({ jobs } = await import('../cron.js'));
  ({ ensureFreeze } = await import('../streakfreeze.js'));
  ({ dayInTz, addDays } = await import('../time.js'));
});

function userWithMissedYesterday(db, { balance, autoApply = 1 } = {}) {
  const u = db.upsertUser.get({ google_sub: 'fz' + Math.random(), email: 'f@b.c', name: 'F', picture: null, now: 1 });
  const today = dayInTz(u.tz);
  // active 5-day streak whose last check-in was 2 days ago → yesterday is missing
  db.updateUserGami.run({ id: u.id, xp: 0, level: 1, streak_current: 5, streak_best: 5, last_checkin_day: addDays(today, -2) });
  const f = ensureFreeze(db, u);
  f.balance = balance;
  f.auto_apply = autoApply;
  db.updateFreezeState.run({ user_id: u.id, balance, ck_milestone: f.ck_milestone, st_milestone: f.st_milestone, lvl_milestone: f.lvl_milestone, last_weekly_grant: f.last_weekly_grant });
  db.updateFreezeConfig.get({
    user_id: u.id, enabled: 1, name: f.name, icon: f.icon, color: f.color, description: f.description,
    max_freezes: f.max_freezes, count_mode: f.count_mode, auto_apply: autoApply,
    earn_per_checkins: 0, earn_per_streak: 0, earn_weekly: 0, earn_on_levelup: 0, now: 1,
  });
  return u;
}

test('runFreezeApply bridges a missed day by consuming a freeze', () => {
  const db = openDb(':memory:');
  const u = userWithMissedYesterday(db, { balance: 1 });
  const today = dayInTz(u.tz);

  jobs.runFreezeApply(db);

  const after = db.getUserById.get(u.id);
  const f = db.getFreeze.get(u.id);
  assert.equal(after.last_checkin_day, addDays(today, -1)); // streak kept alive through yesterday
  assert.equal(f.balance, 0);                                // the freeze was spent
  assert.ok(db.listFreezeEvents.all(u.id, 10).some((e) => e.type === 'apply' && e.reason === 'auto_bridge'));
});

test('runFreezeApply does NOT bridge when no freeze is available — streak lapses', () => {
  const db = openDb(':memory:');
  const u = userWithMissedYesterday(db, { balance: 0 });
  const today = dayInTz(u.tz);

  jobs.runFreezeApply(db);

  const after = db.getUserById.get(u.id);
  assert.equal(after.last_checkin_day, addDays(today, -2)); // unchanged → will reset on next check-in
});
