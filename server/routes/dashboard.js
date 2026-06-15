/**
 * Read-only aggregate routes for the dashboard + gamification overview.
 */
import express from 'express';
import { dashboardSummary } from '../stats.js';
import { computeStats } from '../analytics.js';
import { allAchievements, levelProgress } from '../gamification.js';

export function dashboardRoutes(db, auth) {
  const r = express.Router();
  r.use(auth.requireUser);

  r.get('/dashboard', (req, res) => {
    res.json(dashboardSummary(db, req.user));
  });

  r.get('/stats', (req, res) => {
    res.json(computeStats(db, req.user));
  });

  r.get('/gamification', (req, res) => {
    const have = new Map(db.listAchievements.all(req.user.id).map(a => [a.code, a.unlocked_at]));
    const achievements = allAchievements().map(a => ({
      ...a, unlocked: have.has(a.code), unlocked_at: have.get(a.code) || null,
    }));
    res.json({
      level: levelProgress(req.user.xp),
      streak: { current: req.user.streak_current, best: req.user.streak_best },
      achievements,
      recentXp: db.recentXp.all(req.user.id, 20),
    });
  });

  return r;
}
