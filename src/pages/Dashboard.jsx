import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { useToast } from '../components/Toast.jsx';
import { fmtDay } from '../lib/util.js';

export default function Dashboard() {
  const { user, today } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [weights, setWeights] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [d, w] = await Promise.all([api.dashboard(), api.metrics('weight').catch(() => ({ metrics: [] }))]);
    setData(d);
    setWeights((w.metrics || []).map((m) => ({ day: fmtDay(m.day), value: m.value })));
  }, []);

  useEffect(() => { load(); }, [load]);

  const quickCheckin = async () => {
    setBusy(true);
    try {
      const res = await api.checkin({ day: today, kind: 'gym' });
      if (res.isNew) toast.show('🔥 Eingecheckt! +' + 25 + ' XP');
      toast.celebrate(res.gami, res.leveled);
      await load();
    } finally { setBusy(false); }
  };

  if (!data) return <Loading />;

  const lvl = data.level;
  const greeting = greetingFor(today);

  return (
    <div>
      <div style={{ margin: '4px 4px 18px' }}>
        <div className="label">{greeting}</div>
        <div className="headline">{(user?.name || '').split(' ')[0] || 'Athlet'} 👋</div>
      </div>

      {/* Level + streak hero */}
      <div className="card" style={{ background: 'var(--surface-container-high)' }}>
        <div className="ring-wrap">
          <StreakRing value={data.streak.current} />
          <div style={{ flex: 1 }}>
            <div className="title">Level {lvl.level}</div>
            <div className="body" style={{ margin: '4px 0 8px' }}>{lvl.levelXp} / {lvl.levelNeed} XP</div>
            <div className="progress-track"><div className="progress-fill" style={{ width: lvl.pct + '%' }} /></div>
          </div>
        </div>
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

      {/* Stat tiles */}
      <div className="grid cols-3" style={{ marginTop: 14 }}>
        <Tile v={data.week.checkins} k="Check-ins / Woche" />
        <Tile v={data.week.workouts} k="Workouts / Woche" />
        <Tile v={'+' + data.week.xpWeek} k="XP / Woche" accent />
      </div>

      {/* Weight chart */}
      <div className="section-title">
        <span className="title">Gewichtsverlauf</span>
        <button className="btn text" onClick={() => nav('/body')}>Alle →</button>
      </div>
      {weights.length >= 2 ? (
        <div className="card" style={{ padding: '16px 8px 8px' }}>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={weights} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" stroke="var(--on-surface-variant)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--on-surface-variant)" fontSize={11} tickLine={false} axisLine={false} domain={['dataMin - 1', 'dataMax + 1']} width={44} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'var(--on-surface-variant)' }} />
              <Area type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={3} fill="url(#g)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="card empty">
          <div className="big">📈</div>
          <div className="body">Noch keine Gewichtsdaten. Trag deinen ersten Wert ein, um den Verlauf zu sehen.</div>
          <button className="btn tonal" style={{ marginTop: 14 }} onClick={() => nav('/body')}>Gewicht erfassen</button>
        </div>
      )}

      {/* Totals */}
      <div className="grid cols-3" style={{ marginTop: 22 }}>
        <Tile v={data.totals.checkins} k="Check-ins gesamt" />
        <Tile v={data.totals.workouts} k="Workouts gesamt" />
        <Tile v={Math.round(data.totals.volume / 1000) + 't'} k="Volumen bewegt" />
      </div>
    </div>
  );
}

function StreakRing({ value }) {
  const pct = Math.min(100, (value % 7) / 7 * 100) || (value > 0 ? 100 : 0);
  return (
    <div style={{
      width: 92, height: 92, borderRadius: '50%', flexShrink: 0,
      background: `conic-gradient(var(--primary) ${pct}%, var(--surface-container-highest) 0)`,
      display: 'grid', placeItems: 'center',
    }}>
      <div style={{ width: 74, height: 74, borderRadius: '50%', background: 'var(--surface-container-high)', display: 'grid', placeItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.7rem', fontWeight: 800, lineHeight: 1 }}>{value}</div>
          <div style={{ fontSize: '.62rem', letterSpacing: '.05em', color: 'var(--on-surface-variant)' }}>🔥 STREAK</div>
        </div>
      </div>
    </div>
  );
}

function Tile({ v, k, accent }) {
  return <div className="tile"><span className={'v' + (accent ? ' accent' : '')}>{v}</span><span className="k">{k}</span></div>;
}

function Loading() {
  return <div className="grid" style={{ marginTop: 12 }}>
    <div className="skeleton" style={{ height: 120 }} />
    <div className="skeleton" style={{ height: 64 }} />
    <div className="skeleton" style={{ height: 220 }} />
  </div>;
}

function greetingFor(day) {
  const h = new Date().getHours();
  if (h < 11) return 'Guten Morgen';
  if (h < 18) return 'Servus';
  return 'Guten Abend';
}

export const tooltipStyle = {
  background: 'var(--inverse-surface)', color: 'var(--inverse-on-surface)',
  border: 'none', borderRadius: 12, fontWeight: 600,
};
