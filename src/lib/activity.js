// Helpers for GPS activities: type metadata, formatters, and a polyline decoder.

export const ACTIVITY_TYPES = {
  walk:  { label: 'Spaziergang', icon: '🚶' },
  run:   { label: 'Joggen',      icon: '🏃' },
  cycle: { label: 'Radfahren',   icon: '🚴' },
  hike:  { label: 'Wandern',     icon: '🥾' },
  other: { label: 'Aktivität',   icon: '🗺️' },
};
export const activityMeta = (t) => ACTIVITY_TYPES[t] || ACTIVITY_TYPES.other;

export function fmtDistance(m) {
  const km = (Number(m) || 0) / 1000;
  return km >= 10 ? `${km.toFixed(1)} km` : `${km.toFixed(2)} km`;
}

export function fmtDuration(s) {
  s = Math.max(0, Math.round(Number(s) || 0));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const p = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${p(m)}:${p(sec)}` : `${m}:${p(sec)}`;
}

// Cycling reads better as speed (km/h); foot activities as pace (min/km).
export function fmtSpeedOrPace(type, distanceM, movingS) {
  const dist = Number(distanceM) || 0, t = Number(movingS) || 0;
  if (dist < 1 || t < 1) return '–';
  if (type === 'cycle') return `${((dist / 1000) / (t / 3600)).toFixed(1)} km/h`;
  const paceSecPerKm = t / (dist / 1000);
  const m = Math.floor(paceSecPerKm / 60), s = Math.round(paceSecPerKm % 60);
  return `${m}:${String(s).padStart(2, '0')} /km`;
}

/**
 * Decode a Google-encoded polyline into [[lat, lng], ...].
 * `precision` is 5 by default (matches the app's encoder).
 */
export function decodePolyline(str, precision = 5) {
  if (!str) return [];
  const factor = Math.pow(10, precision);
  const coords = [];
  let index = 0, lat = 0, lng = 0;
  while (index < str.length) {
    let result = 0, shift = 0, b;
    do { b = str.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);
    result = 0; shift = 0;
    do { b = str.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);
    coords.push([lat / factor, lng / factor]);
  }
  return coords;
}
