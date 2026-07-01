import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { fmtDayLong } from '../lib/util.js';
import { RouteThumb } from '../components/RouteThumb.jsx';
import { activityMeta, fmtDistance, fmtDuration, fmtSpeedOrPace } from '../lib/activity.js';

export default function Activities() {
  const nav = useNavigate();
  const [list, setList] = useState(null);

  const load = useCallback(async () => {
    const { activities } = await api.activities(100);
    setList(activities);
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <h1 className="headline" style={{ margin: '4px 4px 16px' }}>Aktivitäten</h1>

      {list && list.length === 0 && (
        <div className="card empty">
          <div className="big">🗺️</div>
          <div className="body">
            Noch keine Aktivitäten. Zeichne mit der <strong>drill · go</strong> App
            (Android) Spaziergänge, Läufe und Radtouren auf — sie erscheinen hier mit
            Route, Strecke und Tempo. Koppeln unter <em>Einstellungen → Gerät koppeln</em>.
          </div>
        </div>
      )}

      <div className="grid">
        {(list || []).map((a) => {
          const m = activityMeta(a.type);
          return (
            <div className="card tap" key={a.id} onClick={() => nav(`/activities/${a.id}`)}
              style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <RouteThumb polyline={a.polyline} size={84} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="title">{m.icon} {a.title || m.label}</div>
                <div className="label" style={{ marginTop: 2 }}>{fmtDayLong(a.day)}</div>
                <div className="row" style={{ gap: 14, marginTop: 8, flexWrap: 'wrap' }}>
                  <Metric v={fmtDistance(a.distance_m)} k="Strecke" />
                  <Metric v={fmtDuration(a.duration_s || a.moving_time_s)} k="Zeit" />
                  <Metric v={fmtSpeedOrPace(a.type, a.distance_m, a.moving_time_s || a.duration_s)} k={a.type === 'cycle' ? 'Tempo' : 'Pace'} />
                  {a.steps ? <Metric v={a.steps.toLocaleString('de-DE')} k="Schritte" /> : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Metric({ v, k }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <span className="mono-num" style={{ fontWeight: 800, fontSize: '1.05rem' }}>{v}</span>
      <span className="label" style={{ fontSize: '.66rem' }}>{k}</span>
    </div>
  );
}
