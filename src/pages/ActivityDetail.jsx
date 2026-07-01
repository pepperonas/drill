import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { fmtDayLong } from '../lib/util.js';
import {
  activityMeta, fmtDistance, fmtDuration, fmtSpeedOrPace, decodePolyline,
} from '../lib/activity.js';

export default function ActivityDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [a, setA] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const mapEl = useRef(null);

  useEffect(() => {
    api.activity(id).then((r) => setA(r.activity)).catch(() => setNotFound(true));
  }, [id]);

  // Lazy-load MapLibre only when a route is present (keeps it out of the main bundle).
  useEffect(() => {
    if (!a || !a.polyline) return;
    const coords = decodePolyline(a.polyline);
    if (coords.length < 2) return;
    let map, cancelled = false;
    (async () => {
      const maplibregl = (await import('maplibre-gl')).default;
      await import('maplibre-gl/dist/maplibre-gl.css');
      if (cancelled || !mapEl.current) return;
      const primary = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#c6ff00';
      const line = coords.map(([lat, lng]) => [lng, lat]); // GeoJSON = [lng, lat]
      map = new maplibregl.Map({
        container: mapEl.current,
        style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
        cooperativeGestures: true,
      });
      map.on('load', () => {
        map.addSource('route', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: line } } });
        map.addLayer({
          id: 'route', type: 'line', source: 'route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': primary, 'line-width': 4, 'line-opacity': 0.95 },
        });
        new maplibregl.Marker({ color: '#8f9285' }).setLngLat(line[0]).addTo(map);
        new maplibregl.Marker({ color: primary }).setLngLat(line[line.length - 1]).addTo(map);
        const b = line.reduce((bb, c) => bb.extend(c), new maplibregl.LngLatBounds(line[0], line[0]));
        map.fitBounds(b, { padding: 44, duration: 0 });
      });
    })();
    return () => { cancelled = true; if (map) map.remove(); };
  }, [a]);

  const remove = async () => {
    if (!confirm('Diese Aktivität löschen?')) return;
    await api.delActivity(id);
    nav('/activities', { replace: true });
  };

  if (notFound) return <div className="card empty"><div className="big">🤷</div><div className="body">Aktivität nicht gefunden.</div></div>;
  if (!a) return <div className="card"><div className="skeleton" style={{ height: 220 }} /></div>;

  const m = activityMeta(a.type);
  const stats = [
    ['Strecke', fmtDistance(a.distance_m)],
    ['Zeit', fmtDuration(a.duration_s || a.moving_time_s)],
    [a.type === 'cycle' ? 'Ø Tempo' : 'Ø Pace', fmtSpeedOrPace(a.type, a.distance_m, a.moving_time_s || a.duration_s)],
    a.max_speed_mps ? ['Max', `${(a.max_speed_mps * 3.6).toFixed(1)} km/h`] : null,
    a.steps ? ['Schritte', a.steps.toLocaleString('de-DE')] : null,
    a.elevation_gain_m ? ['Höhenmeter', `${Math.round(a.elevation_gain_m)} m`] : null,
  ].filter(Boolean);

  return (
    <div>
      <div className="row" style={{ alignItems: 'center', gap: 10, margin: '4px 4px 14px' }}>
        <button className="btn text" style={{ padding: '6px 10px' }} onClick={() => nav('/activities')}>←</button>
        <h1 className="headline" style={{ flex: 1 }}>{m.icon} {a.title || m.label}</h1>
      </div>
      <div className="label" style={{ margin: '0 4px 12px' }}>{fmtDayLong(a.day)}</div>

      {a.polyline && decodePolyline(a.polyline).length >= 2 && (
        <div ref={mapEl} className="card" style={{ height: 300, padding: 0, overflow: 'hidden', marginBottom: 16 }} />
      )}

      <div className="grid cols-3" style={{ marginBottom: 16 }}>
        {stats.map(([k, v]) => (
          <div className="tile" key={k}>
            <span className="v accent mono-num">{v}</span>
            <span className="k">{k}</span>
          </div>
        ))}
      </div>

      <button className="btn text danger block" onClick={remove}>Aktivität löschen</button>
    </div>
  );
}
