// Small shared helpers used across pages.

export function todayStr(tz) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz || undefined, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export function addDays(dayStr, delta) {
  const [y, m, d] = dayStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

export function fmtDay(dayStr) {
  const [y, m, d] = dayStr.split('-').map(Number);
  return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: 'short' })
    .format(new Date(Date.UTC(y, m - 1, d)));
}

export function fmtDayLong(dayStr) {
  const [y, m, d] = dayStr.split('-').map(Number);
  return new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: 'long' })
    .format(new Date(Date.UTC(y, m - 1, d)));
}

export const METRIC_KINDS = [
  { kind: 'weight', label: 'Gewicht', unit: 'kg' },
  { kind: 'bodyfat', label: 'Körperfett', unit: '%' },
  { kind: 'waist', label: 'Taille', unit: 'cm' },
  { kind: 'chest', label: 'Brust', unit: 'cm' },
  { kind: 'hip', label: 'Hüfte', unit: 'cm' },
  { kind: 'arm', label: 'Arm', unit: 'cm' },
  { kind: 'thigh', label: 'Oberschenkel', unit: 'cm' },
  { kind: 'neck', label: 'Hals', unit: 'cm' },
];

export const WORKOUT_CATEGORIES = ['Push', 'Pull', 'Beine', 'Oberkörper', 'Ganzkörper', 'Cardio', 'Mobility', 'Sonstiges'];
export const CHECKIN_KINDS = [
  { kind: 'gym', label: 'Gym', icon: '🏋️' },
  { kind: 'sport', label: 'Sport', icon: '⚽' },
  { kind: 'home', label: 'Home', icon: '🏠' },
  { kind: 'rest', label: 'Aktive Pause', icon: '🧘' },
];
