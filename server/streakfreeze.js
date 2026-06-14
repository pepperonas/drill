/**
 * Configurable streak-freeze system.
 *
 * Every user gets a `streak_freeze` config row they fully control — both the
 * *scoring* (max freezes, how they're earned, whether a frozen day grows or only
 * preserves the streak, auto-apply) and the *presentation* (name/icon/color).
 *
 * Earning is milestone-based and idempotent: we store the highest milestone
 * already granted (ck/st/lvl) and only award the delta, so reconcileEarn can run
 * as often as we like (on every check-in and once daily in cron) without
 * double-granting. A frozen (missed) day is bridged automatically — see
 * `recomputeStreak` (on check-in) and `runFreezeApply` (daily cron).
 */
const now = () => Math.floor(Date.now() / 1000);

export const COUNT_MODES = ['grow', 'preserve'];

export function ensureFreeze(db, user) {
  let f = db.getFreeze.get(user.id);
  if (!f) {
    f = db.createFreeze.get({
      user_id: user.id,
      description: 'Schützt deine Serie an einem verpassten Tag.',
      now: now(),
    });
  }
  return f;
}

export function persistFreezeState(db, cfg) {
  db.updateFreezeState.run({
    user_id: cfg.user_id, balance: cfg.balance, ck_milestone: cfg.ck_milestone,
    st_milestone: cfg.st_milestone, lvl_milestone: cfg.lvl_milestone,
    last_weekly_grant: cfg.last_weekly_grant ?? null,
  });
}

/** Add up to `n` freezes, capped at max_freezes. Returns how many were added. */
export function grantFreeze(db, user, cfg, n, reason, day) {
  if (n <= 0) return 0;
  const added = Math.min(n, cfg.max_freezes - cfg.balance);
  if (added > 0) {
    cfg.balance += added;
    db.insertFreezeEvent.run({ user_id: user.id, type: 'earn', amount: added, reason, day, now: now() });
  }
  return added;
}

/** Consume `n` freezes (caller guarantees balance >= n) and log the application. */
export function consumeFreeze(db, user, cfg, n, reason, day) {
  cfg.balance -= n;
  db.insertFreezeEvent.run({ user_id: user.id, type: 'apply', amount: n, reason, day, now: now() });
}

/**
 * Reconcile all milestone-based earning. Idempotent: only grants the delta above
 * the stored milestone. Also lowers the streak milestone when a streak resets so
 * the next run of the streak can earn again.
 */
export function reconcileEarn(db, user, cfg, day, totalCheckins) {
  if (cfg.earn_per_checkins > 0) {
    const m = Math.floor(totalCheckins / cfg.earn_per_checkins);
    if (m > cfg.ck_milestone) grantFreeze(db, user, cfg, m - cfg.ck_milestone, 'per_checkins', day);
    cfg.ck_milestone = m;
  }
  if (cfg.earn_per_streak > 0) {
    const m = Math.floor(user.streak_current / cfg.earn_per_streak);
    if (m > cfg.st_milestone) grantFreeze(db, user, cfg, m - cfg.st_milestone, 'per_streak', day);
    cfg.st_milestone = m; // also drops back down when the streak resets
  } else {
    cfg.st_milestone = 0;
  }
  if (cfg.earn_on_levelup && user.level > cfg.lvl_milestone) {
    grantFreeze(db, user, cfg, user.level - cfg.lvl_milestone, 'level_up', day);
  }
  cfg.lvl_milestone = Math.max(cfg.lvl_milestone, user.level);
  persistFreezeState(db, cfg);
}

/** Weekly gift: top up once per ISO week (deduped via last_weekly_grant). */
export function weeklyGrant(db, user, cfg, day) {
  if (cfg.earn_weekly <= 0) return 0;
  const wk = isoWeekKey(day);
  if (cfg.last_weekly_grant === wk) return 0;
  const added = grantFreeze(db, user, cfg, cfg.earn_weekly, 'weekly', day);
  cfg.last_weekly_grant = wk;
  persistFreezeState(db, cfg);
  return added;
}

/** ISO-8601 week key like '2026-W24' from a 'YYYY-MM-DD' day string. */
export function isoWeekKey(dayStr) {
  const [y, m, d] = dayStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dayNum = (dt.getUTCDay() + 6) % 7;        // Mon=0 … Sun=6
  dt.setUTCDate(dt.getUTCDate() - dayNum + 3);     // move to the week's Thursday
  const firstThu = new Date(Date.UTC(dt.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(
    ((dt - firstThu) / 86400000 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
  return `${dt.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}
