/**
 * Express app wiring: middleware, auth, and all API routers under /api.
 * Exported separately from index.js so tests can import the app without
 * binding a port or starting cron.
 */
import express from 'express';
import cookieParser from 'cookie-parser';
import { config, BOOT_TIME } from './config.js';
import { makeAuth } from './auth.js';
import { createLimiter } from './rate-limit.js';
import { trackingRoutes } from './routes/tracking.js';
import { trackerRoutes } from './routes/trackers.js';
import { streakFreezeRoutes } from './routes/streakfreeze.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { accountRoutes } from './routes/account.js';
import { pairingRoutes } from './routes/pairing.js';
import { activitiesRoutes } from './routes/activities.js';

export function createApp(db) {
  const auth = makeAuth(db);
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '256kb' }));
  app.use(cookieParser());

  const limitAll = createLimiter({ windowMs: 60_000, max: 300 });
  const limitAuth = createLimiter({ windowMs: 60_000, max: 30 });
  app.use('/api/', limitAll);
  app.use('/api/auth/', limitAuth);
  app.use('/api/pairing/', limitAuth);   // stricter: guards code claim/brute-force

  // health
  app.get('/api/health', (req, res) =>
    res.json({ ok: true, uptime_s: Math.floor((Date.now() - BOOT_TIME) / 1000), email: config.emailEnabled }));

  // auth
  app.get('/api/auth/google', auth.startOAuth);
  app.get('/api/auth/callback', auth.oauthCallback);
  app.post('/api/auth/logout', auth.logout);
  app.get('/api/auth/me', auth.requireUser, (req, res) => {
    const u = req.user;
    res.json({ id: u.id, email: u.email, name: u.name, picture: u.picture, tz: u.tz });
  });

  // accountRoutes + pairingRoutes FIRST: they carry *public* endpoints (email
  // confirm/unsubscribe links; the app's /pairing/claim) that must be reachable
  // without a session. The other feature routers apply a blanket `requireUser`,
  // so if they were mounted earlier they would 401 those public routes first.
  app.use('/api', accountRoutes(db, auth));
  app.use('/api', pairingRoutes(db, auth));

  // feature routers (each self-gates with requireUser)
  app.use('/api', trackingRoutes(db, auth));
  app.use('/api', activitiesRoutes(db, auth));
  app.use('/api', trackerRoutes(db, auth));
  app.use('/api', streakFreezeRoutes(db, auth));
  app.use('/api', dashboardRoutes(db, auth));

  app.use('/api', (req, res) => res.status(404).json({ error: 'not_found' }));
  return app;
}
