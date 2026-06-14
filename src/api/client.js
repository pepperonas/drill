/**
 * Thin fetch wrapper around the drill-api. Cookies carry the session, so every
 * request uses credentials:'include'. Throws ApiError on non-2xx.
 */
export class ApiError extends Error {
  constructor(status, body) {
    super(body?.error || `HTTP ${status}`);
    this.status = status;
    this.body = body;
  }
}

async function req(method, path, body) {
  const res = await fetch('/api' + path, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json() : null;
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

export const api = {
  get: (p) => req('GET', p),
  post: (p, b) => req('POST', p, b),
  put: (p, b) => req('PUT', p, b),
  del: (p) => req('DELETE', p),

  // typed helpers
  me: () => req('GET', '/me'),
  dashboard: () => req('GET', '/dashboard'),
  gamification: () => req('GET', '/gamification'),

  metrics: (kind) => req('GET', '/metrics' + (kind ? `?kind=${encodeURIComponent(kind)}` : '')),
  addMetric: (m) => req('POST', '/metrics', m),
  delMetric: (id) => req('DELETE', `/metrics/${id}`),

  checkins: (from) => req('GET', '/checkins' + (from ? `?from=${from}` : '')),
  checkin: (b) => req('POST', '/checkins', b),
  uncheck: (day) => req('DELETE', `/checkins/${day}`),

  workouts: (limit = 50) => req('GET', `/workouts?limit=${limit}`),
  addWorkout: (w) => req('POST', '/workouts', w),
  delWorkout: (id) => req('DELETE', `/workouts/${id}`),

  nutrition: (from) => req('GET', '/nutrition' + (from ? `?from=${from}` : '')),
  addNutrition: (n) => req('POST', '/nutrition', n),

  setEmailPrefs: (p) => req('PUT', '/email-prefs', p),
  setTz: (tz) => req('PUT', '/me', { tz }),
  deleteAccount: () => req('DELETE', '/me'),

  // ---- flexible trackers ----
  trackers: () => req('GET', '/trackers'),
  allTrackers: () => req('GET', '/trackers/all'),
  createTracker: (t) => req('POST', '/trackers', t),
  updateTracker: (id, t) => req('PUT', `/trackers/${id}`, t),
  deleteTracker: (id) => req('DELETE', `/trackers/${id}`),
  reorderTrackers: (order) => req('POST', '/trackers/reorder', { order }),
  trackerEntries: (id, from) => req('GET', `/trackers/${id}/entries` + (from ? `?from=${from}` : '')),
  addEntry: (id, e) => req('POST', `/trackers/${id}/entries`, e),
  delEntry: (id) => req('DELETE', `/entries/${id}`),
  trackerSeries: (id, range = '90', avg = 7) => req('GET', `/trackers/${id}/series?range=${range}&avg=${avg}`),
  correlation: (a, b, range = '90') => req('GET', `/insights/correlation?a=${a}&b=${b}&range=${range}`),

  // ---- user-editable option lists ----
  options: (domain) => req('GET', `/options/${domain}`),
  addOption: (domain, o) => req('POST', `/options/${domain}`, o),
  delOption: (id) => req('DELETE', `/options/${id}`),

  // ---- records + exercise library ----
  records: () => req('GET', '/records'),
  exercises: () => req('GET', '/exercises'),

  // ---- streak freeze ----
  streakFreeze: () => req('GET', '/streak-freeze'),
  updateStreakFreeze: (cfg) => req('PUT', '/streak-freeze', cfg),
};

export function loginUrl() { return '/api/auth/google'; }
export async function logout() {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
}
