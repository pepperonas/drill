/**
 * Shared gamification-context helpers used by the write routes (tracking,
 * activities). `gamiCtx` gathers the cheap counters `checkAchievements` needs;
 * `gamiResult` shapes the delta the client uses to celebrate.
 */
export function gamiCtx(db, user) {
  return {
    checkins: db.countCheckins.get(user.id).n,
    workouts: db.countWorkouts.get(user.id).n,
    volume: db.sumVolume.get(user.id).v,
    metrics: db.countEntries.get(user.id).n,
    nutritionDays: db.listNutrition.all(user.id, '0000-00-00').length,
    records: db.listPRs.all(user.id).length,
    trackers: db.countTrackers.get(user.id).n,
    activities: db.countActivities.get(user.id).n,
    totalDistanceM: db.sumActivityDistance.get(user.id).m,
    runCount: db.countActivitiesByType.get(user.id, 'run').n,
    cycleCount: db.countActivitiesByType.get(user.id, 'cycle').n,
  };
}

export function gamiResult(db, user, newly) {
  return {
    xp: user.xp, level: user.level,
    streak: user.streak_current,
    unlocked: newly,
  };
}
