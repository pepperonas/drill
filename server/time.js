/**
 * Timezone-aware day helpers. All "day" strings are 'YYYY-MM-DD' in a given IANA
 * timezone so streaks and "today" match the user's wall clock, not UTC.
 */
export function dayInTz(tz, date = new Date()) {
  // en-CA gives ISO-ish YYYY-MM-DD output.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

export function addDays(dayStr, delta) {
  const [y, m, d] = dayStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

export function diffDays(a, b) {
  // days from a -> b (b - a)
  const da = Date.UTC(...a.split('-').map((v, i) => (i === 1 ? v - 1 : +v)));
  const db = Date.UTC(...b.split('-').map((v, i) => (i === 1 ? v - 1 : +v)));
  return Math.round((db - da) / 86400000);
}

export function weekdayInTz(tz, date = new Date()) {
  // 0 = Sunday ... 6 = Saturday
  const wd = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(date);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(wd);
}
