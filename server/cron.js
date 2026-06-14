/**
 * Scheduled motivational emails (node-cron). All jobs respect per-user opt-in
 * (email_prefs.confirmed + the specific flag) and dedupe via email_log so a
 * restart can't double-send on the same day.
 *
 *  - daily nudge      : 18:00 local, only if no check-in yet today and user opted in
 *  - streak-at-risk   : 20:30 local, only if active streak >= 2 and no check-in today
 *  - weekly summary   : Sunday 19:00 local
 *
 * Day boundaries use each user's own tz; the cron fires on the server tz
 * (config.tz) and we recompute per-user "today" inside.
 */
import cron from 'node-cron';
import { config } from './config.js';
import { dayInTz, addDays, diffDays } from './time.js';
import { effectiveStreak } from './gamification.js';
import { weeklyGrant, reconcileEarn, consumeFreeze, persistFreezeState } from './streakfreeze.js';
import { rangeStats, weeklyMessage, nudgeForDay } from './stats.js';
import { sendMail } from './mailer.js';
import * as T from './email-templates.js';
import { levelProgress } from './gamification.js';

function eligible(db, user, flag) {
  const p = db.getPrefs.get(user.id);
  if (!p || !p.confirmed || !p[flag]) return null;
  return p;
}

async function markAndSend(db, user, type, day, build) {
  if (db.wasEmailSent.get(user.id, type, day)) return false;
  const p = db.getPrefs.get(user.id);
  const mail = build(p.token);
  try {
    await sendMail({ to: user.email, subject: mail.subject, html: mail.html });
    db.logEmail.run(user.id, type, day, Math.floor(Date.now() / 1000));
    return true;
  } catch (err) {
    console.error(`[cron] send ${type} to ${user.email} failed:`, err.message);
    return false;
  }
}

async function runDailyNudge(db) {
  for (const user of db.allConfirmedUsers.all()) {
    if (!eligible(db, user, 'daily_nudge')) continue;
    const today = dayInTz(user.tz);
    if (db.getCheckin.get(user.id, today)) continue; // already active today
    const line = nudgeForDay(today);
    await markAndSend(db, user, 'daily_nudge', today,
      (token) => T.dailyNudgeEmail({ name: user.name, token, line }));
  }
}

async function runStreakAlert(db) {
  for (const user of db.allConfirmedUsers.all()) {
    if (!eligible(db, user, 'streak_alert')) continue;
    const today = dayInTz(user.tz);
    const streak = effectiveStreak(user, today);
    if (streak < 2) continue;                         // nothing meaningful to lose
    if (db.getCheckin.get(user.id, today)) continue;  // safe today
    await markAndSend(db, user, 'streak_alert', today,
      (token) => T.streakAlertEmail({ name: user.name, token, streak }));
  }
}

async function runWeekly(db) {
  for (const user of db.allConfirmedUsers.all()) {
    if (!eligible(db, user, 'weekly')) continue;
    const today = dayInTz(user.tz);
    const from = addDays(today, -6);
    const s = rangeStats(db, user, from, today);
    const prog = levelProgress(user.xp);
    const stats = {
      ...s,
      streak: effectiveStreak(user, today),
      level: prog.level,
      message: weeklyMessage(s),
    };
    await markAndSend(db, user, 'weekly', today,
      (token) => T.weeklyEmail({ name: user.name, token, stats }));
  }
}

/**
 * Daily streak-freeze maintenance: weekly gifts, milestone earning reconciliation
 * (catches level-ups from any action) and auto-bridging of missed days so a
 * streak survives without a check-in while freezes last.
 */
function runFreezeApply(db) {
  for (const user of db.allConfirmedUsers.all()) {
    const cfg = db.getFreeze.get(user.id);
    if (!cfg) continue;
    const today = dayInTz(user.tz);
    weeklyGrant(db, user, cfg, today);
    reconcileEarn(db, user, cfg, today, db.countCheckins.get(user.id).n);

    if (!cfg.enabled || !cfg.auto_apply || cfg.balance <= 0 || user.streak_current <= 0) continue;
    const prev = user.last_checkin_day;
    if (!prev) continue;
    const yest = addDays(today, -1);
    if (prev >= yest) continue;                 // already current (checked in today/yesterday)
    const gap = diffDays(prev, yest);           // missed days from prev+1 .. yesterday
    if (cfg.balance < gap) continue;            // can't fully cover -> let it lapse
    consumeFreeze(db, user, cfg, gap, 'auto_bridge', yest);
    const streak = user.streak_current + (cfg.count_mode === 'grow' ? gap : 0);
    const best = Math.max(user.streak_best, streak);
    db.updateUserGami.run({
      id: user.id, xp: user.xp, level: user.level,
      streak_current: streak, streak_best: best, last_checkin_day: yest,
    });
    persistFreezeState(db, cfg);
  }
}

export function startCron(db) {
  const opts = { timezone: config.tz };
  // Streak-freeze runs regardless of email config (00:30 local).
  cron.schedule('30 0 * * *', () => { try { runFreezeApply(db); } catch (e) { console.error(e); } }, opts);
  console.log(`[cron] scheduled streak-freeze maintenance (tz=${config.tz})`);

  if (!config.emailEnabled) {
    console.log('[cron] email disabled (no SMTP creds) — email jobs not scheduled');
    return;
  }
  cron.schedule('0 18 * * *', () => runDailyNudge(db).catch(e => console.error(e)), opts);
  cron.schedule('30 20 * * *', () => runStreakAlert(db).catch(e => console.error(e)), opts);
  cron.schedule('0 19 * * 0', () => runWeekly(db).catch(e => console.error(e)), opts);
  console.log(`[cron] scheduled daily/streak/weekly emails (tz=${config.tz})`);
}

// Exposed for manual triggering / tests.
export const jobs = { runDailyNudge, runStreakAlert, runWeekly, runFreezeApply };
