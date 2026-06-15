/**
 * Account + email-preference routes, plus public confirm/unsubscribe endpoints
 * (the latter are reachable from email links without a session).
 */
import express from 'express';
import { randomBytes } from 'node:crypto';
import { config } from '../config.js';
import { sendMail } from '../mailer.js';
import { confirmEmail } from '../email-templates.js';

// Allowed theme ids (mirror of src/theme/themes.js).
const THEMES = new Set(['lime', 'ember', 'aqua', 'grape']);

function ensurePrefs(db, user) {
  let p = db.getPrefs.get(user.id);
  if (!p) {
    p = db.upsertPrefs.get({
      user_id: user.id, weekly: 0, streak_alert: 0, daily_nudge: 0,
      confirmed: 0, token: randomBytes(24).toString('hex'),
      now: Math.floor(Date.now() / 1000),
    });
  }
  return p;
}

export function accountRoutes(db, auth) {
  const r = express.Router();

  r.get('/me', auth.requireUser, (req, res) => {
    const u = req.user;
    const prefs = ensurePrefs(db, u);
    res.json({
      user: { id: u.id, email: u.email, name: u.name, picture: u.picture, tz: u.tz, theme: u.theme || 'lime' },
      emailEnabled: config.emailEnabled,
      prefs: {
        weekly: !!prefs.weekly, streak_alert: !!prefs.streak_alert,
        daily_nudge: !!prefs.daily_nudge, confirmed: !!prefs.confirmed,
      },
    });
  });

  r.put('/me', auth.requireUser, (req, res) => {
    const tz = req.body && req.body.tz;
    if (tz && typeof tz === 'string') db.setUserTz.run(tz.slice(0, 64), req.user.id);
    const theme = req.body && req.body.theme;
    if (theme && THEMES.has(String(theme))) db.setUserTheme.run(String(theme), req.user.id);
    res.json({ ok: true });
  });

  // Update email preferences. Turning any flag on while unconfirmed triggers a
  // double-opt-in confirmation email.
  r.put('/email-prefs', auth.requireUser, async (req, res) => {
    const b = req.body || {};
    const cur = ensurePrefs(db, req.user);
    const wantsAny = !!b.weekly || !!b.streak_alert || !!b.daily_nudge;
    const next = db.upsertPrefs.get({
      user_id: req.user.id,
      weekly: b.weekly ? 1 : 0,
      streak_alert: b.streak_alert ? 1 : 0,
      daily_nudge: b.daily_nudge ? 1 : 0,
      confirmed: cur.confirmed,
      token: cur.token,
      now: Math.floor(Date.now() / 1000),
    });
    let confirmationSent = false;
    if (wantsAny && !cur.confirmed && config.emailEnabled) {
      const mail = confirmEmail({ name: req.user.name, token: next.token });
      try {
        await sendMail({ to: req.user.email, subject: mail.subject, html: mail.html });
        confirmationSent = true;
      } catch (e) { console.error('[account] confirm mail failed:', e.message); }
    }
    res.json({
      prefs: {
        weekly: !!next.weekly, streak_alert: !!next.streak_alert,
        daily_nudge: !!next.daily_nudge, confirmed: !!next.confirmed,
      },
      confirmationSent,
    });
  });

  // Public: confirm opt-in from email link.
  r.get('/email/confirm', (req, res) => {
    const p = db.prefsByToken.get(String(req.query.token || ''));
    if (!p) return res.status(400).send('Ungültiger oder abgelaufener Link.');
    db.setConfirmed.run(1, p.user_id);
    res.redirect(config.appOrigin + '/settings?confirmed=1');
  });

  // Public: one-click unsubscribe from email link.
  r.get('/email/unsubscribe', (req, res) => {
    const p = db.prefsByToken.get(String(req.query.token || ''));
    if (!p) return res.status(400).send('Ungültiger Link.');
    db.setUnsubscribed.run(p.token);
    res.redirect(config.appOrigin + '/settings?unsubscribed=1');
  });

  // Full account + data deletion (GDPR).
  r.delete('/me', auth.requireUser, (req, res) => {
    db.deleteUser.run(req.user.id); // cascades to all child tables
    res.clearCookie(config.sessionCookie, { path: '/' });
    res.json({ ok: true });
  });

  // Export all of the user's data as JSON (GDPR portability).
  r.get('/export', auth.requireUser, (req, res) => {
    const uid = req.user.id;
    res.json({
      user: { email: req.user.email, name: req.user.name, tz: req.user.tz },
      metrics: db.listAllMetrics.all(uid),
      checkins: db.listCheckins.all(uid, '0000-00-00'),
      workouts: db.listWorkouts.all(uid, 100000).map(w => ({ ...w, sets: db.listSets.all(w.id) })),
      nutrition: db.listNutrition.all(uid, '0000-00-00'),
      achievements: db.listAchievements.all(uid),
      xp: db.recentXp.all(uid, 100000),
    });
  });

  return r;
}
