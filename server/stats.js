/**
 * Aggregations shared by the dashboard API and the email jobs.
 */
import { dayInTz, addDays } from './time.js';
import { effectiveStreak, levelProgress } from './gamification.js';
import { goalProgress } from './trackers.js';

const NUDGES = [
  { subject: 'Heute zählt 💥', title: 'Ein Prozent besser', body: 'Du musst nicht alles geben – nur etwas. Ein kurzer Check-in hält die Maschine am Laufen.' },
  { subject: 'Dein Körper wartet', title: 'Bewegung schlägt Motivation', body: 'Warte nicht auf Lust. Fang an – die Energie kommt beim Tun.' },
  { subject: 'Kleine Schritte, große Wirkung', title: 'Konstanz > Intensität', body: 'Wer dranbleibt, gewinnt. Trag heute einen Wert ein und halte deine Serie.' },
  { subject: 'Wasser, Eiweiß, Bewegung', title: 'Die Basics zählen', body: 'Genug trinken, genug Protein, ein bisschen Bewegung. Heute machbar?' },
  { subject: 'Future-You sagt danke', title: 'Heute investieren', body: 'Jedes Workout ist ein Geschenk an dein zukünftiges Ich.' },
];

export function nudgeForDay(dayStr) {
  // deterministic per day so a user gets the same nudge across a day
  const n = dayStr.split('-').reduce((a, p) => a + Number(p), 0);
  return NUDGES[n % NUDGES.length];
}

export function rangeStats(db, user, fromDay, toDay) {
  const checkins = db.listCheckins.all(user.id, fromDay).filter(c => c.day <= toDay);
  const workouts = db.listWorkouts.all(user.id, 10000).filter(w => w.day >= fromDay && w.day <= toDay);
  const nutrition = db.listNutrition.all(user.id, fromDay).filter(n => n.day <= toDay);
  const xpWeek = db.recentXp.all(user.id, 500)
    .filter(e => e.day >= fromDay && e.day <= toDay)
    .reduce((a, e) => a + e.amount, 0);

  // weight delta across window
  const weights = db.listMetrics.all(user.id, 'weight').filter(m => m.day >= fromDay && m.day <= toDay);
  let weightDelta = null;
  if (weights.length >= 2) {
    weightDelta = Math.round((weights[weights.length - 1].value - weights[0].value) * 10) / 10;
  }
  return {
    checkins: checkins.length,
    workouts: workouts.length,
    nutritionDays: nutrition.length,
    xpWeek,
    weightDelta,
  };
}

export function weeklyMessage(s) {
  if (s.checkins === 0) return 'Diese Woche war ruhig – ein perfekter Moment für einen Neustart. Du schaffst das! 💪';
  if (s.checkins >= 5) return 'Wahnsinns-Woche! Diese Konstanz bringt echte Ergebnisse. Weiter so! 🚀';
  if (s.checkins >= 3) return 'Solide Woche – du baust gerade richtig gute Gewohnheiten auf.';
  return 'Ein Anfang ist gemacht. Nächste Woche legst du noch eine Schippe drauf!';
}

export function dashboardSummary(db, user) {
  const today = dayInTz(user.tz);
  const last30 = addDays(today, -29);
  const last90 = addDays(today, -89);
  const prog = levelProgress(user.xp);
  const streak = effectiveStreak(user, today);
  const week = rangeStats(db, user, addDays(today, -6), today);

  const checkedInToday = !!db.getCheckin.get(user.id, today);
  const totals = {
    checkins: db.countCheckins.get(user.id).n,
    workouts: db.countWorkouts.get(user.id).n,
    volume: db.sumVolume.get(user.id).v,
  };

  // Active trackers that have a goal, with current progress (for the dashboard).
  const goals = db.listTrackers.all(user.id)
    .filter((t) => t.goal_value != null)
    .map((t) => {
      const latest = db.latestEntry.get(t.id);
      return {
        id: t.id, name: t.name, icon: t.icon, color: t.color, unit: t.unit,
        goal: goalProgress(t, latest ? latest.value : null),
      };
    })
    .filter((g) => g.goal);

  const f = db.getFreeze.get(user.id);
  const freeze = f && f.enabled
    ? { enabled: true, name: f.name, icon: f.icon, color: f.color, balance: f.balance, max: f.max_freezes }
    : { enabled: false };

  return {
    today,
    checkedInToday,
    level: prog,
    streak: { current: streak, best: user.streak_best },
    week,
    totals,
    goals,
    freeze,
    records: db.listPRs.all(user.id).slice(0, 5),
    achievements: db.listAchievements.all(user.id),
  };
}
