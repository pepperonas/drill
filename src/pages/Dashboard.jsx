import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { useToast } from '../components/Toast.jsx';
import { CountUp, useCountUp } from '../components/CountUp.jsx';
import { useTilt } from '../lib/useTilt.js';

export default function Dashboard() {
  const { user } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const heroRef = useTilt({ max: 5 });

  const load = useCallback(async () => { setData(await api.dashboard()); }, []);
  useEffect(() => { load(); }, [load]);

  const quickCheckin = async () => {
    setBusy(true);
    try {
      const res = await api.checkin({ kind: 'gym' });
      if (res.isNew) toast.show('🔥 Eingecheckt! +25 XP');
      if (res.frozen > 0) toast.show(`${data.freeze?.icon || '🧊'} Serie geschützt – ${res.frozen} Tag(e) überbrückt`, { celebrate: true });
      toast.celebrate(res.gami, res.leveled);
      await load();
    } finally { setBusy(false); }
  };

  if (!data) return <Loading />;
  const lvl = data.level;

  return (
    <div>
      <div style={{ margin: '4px 4px 18px' }}>
        <div className="label">{greetingFor()}</div>
        <div className="headline">{(user?.name || '').split(' ')[0] || 'Athlet'} 👋</div>
      </div>

      {/* Level + streak hero — the reactive signature moment */}
      <div className="card tilt" ref={heroRef} style={{ background: 'var(--surface-container-high)' }}>
        <div className="ring-wrap">
          <StreakRing value={data.streak.current} />
          <div style={{ flex: 1 }}>
            <div className="title">Level {lvl.level}</div>
            <div className="body" style={{ margin: '4px 0 8px' }}>{lvl.levelXp} / {lvl.levelNeed} XP</div>
            <div className="progress-track"><div className="progress-fill" style={{ width: lvl.pct + '%' }} /></div>
          </div>
        </div>
        {data.freeze?.enabled && (
          <div className="list-item" style={{ borderBottom: 'none', padding: '12px 2px 2px', gap: 8 }} title={data.freeze.name}>
            <span style={{ fontSize: '1.2rem' }}>{data.freeze.icon}</span>
            <span className="body" style={{ flex: 1 }}>{data.freeze.name}</span>
            <span className="mono-num" style={{ fontWeight: 700, color: data.freeze.color || 'var(--primary)' }}>
              {data.freeze.balance} / {data.freeze.max}
            </span>
          </div>
        )}
      </div>

      {/* Check-in CTA */}
      <div style={{ marginTop: 14 }}>
        {data.checkedInToday ? (
          <div className="card tap" onClick={() => nav('/attendance')} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ fontSize: '2rem' }}>✅</span>
            <div>
              <div className="title">Heute erledigt!</div>
              <div className="body">Serie: {data.streak.current} Tage 🔥 · Bestleistung {data.streak.best}</div>
            </div>
          </div>
        ) : (
          <button className="btn filled block" disabled={busy} onClick={quickCheckin} style={{ padding: '18px', fontSize: '1.1rem' }}>
            🔥 Heute einchecken
          </button>
        )}
      </div>

      {/* Week stats */}
      <div className="grid cols-3" style={{ marginTop: 14 }}>
        <Tile count={data.week.checkins} k="Check-ins / Woche" />
        <Tile count={data.week.workouts} k="Workouts / Woche" />
        <Tile count={data.week.xpWeek} prefix="+" k="XP / Woche" accent />
      </div>

      {/* Goals */}
      {data.goals?.length > 0 && (
        <>
          <div className="section-title"><span className="title">Deine Ziele</span><button className="btn text" onClick={() => nav('/trackers')}>Alle →</button></div>
          <div className="grid">
            {data.goals.map((g) => (
              <div className="card tap" key={g.id} onClick={() => nav(`/trackers/${g.id}`)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span style={{ fontSize: '1.3rem' }}>{g.icon || '🎯'}</span>
                  <span className="title" style={{ flex: 1 }}>{g.name}</span>
                  <span className="mono-num" style={{ color: g.color || 'var(--primary)', fontWeight: 700 }}>
                    {g.goal.latest ?? '–'} / {g.goal.goal}{g.unit ? ' ' + g.unit : ''}
                  </span>
                </div>
                <div className="progress-track"><div className="progress-fill" style={{ width: g.goal.pct + '%', background: g.color || 'var(--primary)' }} /></div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Personal records */}
      {data.records?.length > 0 && (
        <>
          <div className="section-title"><span className="title">Bestleistungen 🏅</span><button className="btn text" onClick={() => nav('/training')}>Training →</button></div>
          <div className="card">
            {data.records.map((p) => (
              <div className="list-item" key={p.exercise}>
                <span style={{ flex: 1 }}>{p.exercise}</span>
                <span className="mono-num"><b>{p.weight} kg</b> × {p.reps}</span>
                <span className="body" style={{ marginLeft: 10 }}>≈ {p.est_1rm} kg 1RM</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Stats + Insights + totals */}
      <div className="section-title"><span className="title">Mehr</span></div>
      <div className="card tap" onClick={() => nav('/stats')} style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
        <span style={{ fontSize: '1.8rem' }}>📊</span>
        <div style={{ flex: 1 }}><div className="title">Statistik</div><div className="body">XP-Wachstum, Heatmap, Balance & mehr</div></div>
        <span style={{ color: 'var(--primary)' }}>→</span>
      </div>
      <div className="card tap" onClick={() => nav('/insights')} style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
        <span style={{ fontSize: '1.8rem' }}>🔍</span>
        <div style={{ flex: 1 }}><div className="title">Insights</div><div className="body">Zusammenhänge zwischen deinen Trackern entdecken</div></div>
        <span style={{ color: 'var(--primary)' }}>→</span>
      </div>

      <div className="grid cols-3">
        <Tile count={data.totals.checkins} k="Check-ins gesamt" />
        <Tile count={data.totals.workouts} k="Workouts gesamt" />
        <Tile v={Math.round(data.totals.volume / 1000) + 't'} k="Volumen bewegt" />
      </div>
    </div>
  );
}

function StreakRing({ value }) {
  const shown = useCountUp(value, 800);
  const pct = Math.min(100, (value % 7) / 7 * 100) || (value > 0 ? 100 : 0);
  return (
    <div style={{
      width: 92, height: 92, borderRadius: '50%', flexShrink: 0,
      background: `conic-gradient(var(--primary) ${pct}%, var(--surface-container-highest) 0)`,
      display: 'grid', placeItems: 'center',
    }}>
      <div style={{ width: 74, height: 74, borderRadius: '50%', background: 'var(--surface-container-high)', display: 'grid', placeItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.7rem', fontWeight: 800, lineHeight: 1 }}>{shown}</div>
          <div style={{ fontSize: '.62rem', letterSpacing: '.05em', color: 'var(--on-surface-variant)' }}>🔥 STREAK</div>
        </div>
      </div>
    </div>
  );
}

function Tile({ v, count, prefix, suffix, k, accent }) {
  return (
    <div className="tile">
      <span className={'v' + (accent ? ' accent' : '')}>
        {count != null ? <CountUp value={count} prefix={prefix} suffix={suffix} /> : v}
      </span>
      <span className="k">{k}</span>
    </div>
  );
}

function Loading() {
  return <div className="grid" style={{ marginTop: 12 }}>
    <div className="skeleton" style={{ height: 120 }} />
    <div className="skeleton" style={{ height: 64 }} />
    <div className="skeleton" style={{ height: 180 }} />
  </div>;
}

function greetingFor() {
  const h = new Date().getHours();
  if (h < 11) return 'Guten Morgen';
  if (h < 18) return 'Servus';
  return 'Guten Abend';
}

export const tooltipStyle = {
  background: 'var(--inverse-surface)', color: 'var(--inverse-on-surface)',
  border: 'none', borderRadius: 12, fontWeight: 600,
};
