import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceLine,
  BarChart, Bar, Legend, RadarChart, PolarGrid, PolarAngleAxis, Radar,
  PieChart, Pie, Cell,
} from 'recharts';
import { api } from '../api/client.js';
import { fmtDay, addDays } from '../lib/util.js';
import { tooltipStyle } from './Dashboard.jsx';
import { CountUp } from '../components/CountUp.jsx';

const CHART_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];

export default function Stats() {
  const nav = useNavigate();
  const [d, setD] = useState(null);
  useEffect(() => { api.stats().then(setD); }, []);
  if (!d) return <div className="skeleton" style={{ height: 320, marginTop: 12 }} />;

  const curve = d.xpCurve.map((p) => ({ ...p, label: fmtDay(p.day) }));
  const markers = d.levelMarkers.slice(-4); // keep it readable

  return (
    <div>
      <div className="topbar" style={{ position: 'static', padding: '4px 4px 12px' }}>
        <button className="btn text" style={{ padding: '6px 8px' }} onClick={() => nav('/')}>←</button>
        <span className="headline" style={{ flex: 1 }}>Statistik</span>
      </div>

      {/* motivational headline */}
      <div className="grid cols-3" style={{ marginBottom: 6 }}>
        <div className="tile"><span className="v accent"><CountUp value={d.headline.xp30} prefix="+" /></span><span className="k">XP / 30 Tage</span></div>
        <div className="tile"><span className="v"><CountUp value={d.headline.activeDays30} prefix="🔥 " /></span><span className="k">Aktive Tage</span></div>
        <div className="tile"><span className="v">{d.headline.bestDay ? <CountUp value={d.headline.bestDay.amt} prefix="⭐ " /> : '–'}</span><span className="k">Bester Tag (XP)</span></div>
      </div>

      {/* XP growth curve */}
      <Section title="XP-Wachstum" hint="Jede Aktion bringt dich weiter nach oben.">
        {curve.length >= 2 ? (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={curve} margin={{ top: 6, right: 14, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="xpg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" stroke="var(--on-surface-variant)" fontSize={11} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={28} />
              <YAxis stroke="var(--on-surface-variant)" fontSize={11} tickLine={false} axisLine={false} width={40} />
              <Tooltip contentStyle={tooltipStyle} />
              {markers.map((m) => (
                <ReferenceLine key={m.level} y={m.xp} stroke="var(--outline)" strokeDasharray="4 4"
                  label={{ value: 'Lvl ' + m.level, fill: 'var(--on-surface-variant)', fontSize: 10, position: 'insideTopRight' }} />
              ))}
              <Area type="monotone" dataKey="xp" stroke="var(--primary)" strokeWidth={3} fill="url(#xpg)" />
            </AreaChart>
          </ResponsiveContainer>
        ) : <Empty icon="📈" text="Sammle ein paar Tage XP – dann steigt die Kurve." />}
      </Section>

      {/* activity heatmap */}
      <Section title="Aktivitäts-Heatmap" hint="Halte die Kette am Leben – Tag für Tag.">
        <Heatmap map={d.heatmap} from={d.heatmapFrom} today={d.today} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, justifyContent: 'flex-end', fontSize: '.72rem', color: 'var(--on-surface-variant)' }}>
          weniger
          <span className="hm-cell" /><span className="hm-cell l1" /><span className="hm-cell l2" /><span className="hm-cell l3" />
          mehr
        </div>
      </Section>

      {/* weekly rhythm */}
      {d.weekly.length > 0 && (
        <Section title="Wochen-Rhythmus" hint="Check-ins & Workouts pro Woche.">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={d.weekly} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
              <XAxis dataKey="label" stroke="var(--on-surface-variant)" fontSize={10} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis stroke="var(--on-surface-variant)" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--surface-container-highest)' }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="checkins" name="Check-ins" fill="var(--chart-1)" radius={[5, 5, 0, 0]} />
              <Bar dataKey="workouts" name="Workouts" fill="var(--chart-2)" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Section>
      )}

      {/* balance radar */}
      <Section title="Deine Balance" hint="30-Tage-Überblick – fülle die Form aus!">
        <ResponsiveContainer width="100%" height={260}>
          <RadarChart data={d.radar} outerRadius="72%">
            <PolarGrid stroke="var(--outline-variant)" />
            <PolarAngleAxis dataKey="area" tick={{ fill: 'var(--on-surface-variant)', fontSize: 11 }} />
            <Radar dataKey="value" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.4} strokeWidth={2} />
            <Tooltip contentStyle={tooltipStyle} />
          </RadarChart>
        </ResponsiveContainer>
      </Section>

      {/* workout category donut */}
      {d.categories.length > 0 && (
        <Section title="Trainings-Mix" hint="Wie sich deine Workouts verteilen.">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={d.categories} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92} paddingAngle={3} stroke="none">
                {d.categories.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </Section>
      )}

      <button className="btn tonal block" style={{ marginTop: 8 }} onClick={() => nav('/insights')}>🔍 Zusammenhänge entdecken (Insights)</button>
    </div>
  );
}

function Section({ title, hint, children }) {
  return (
    <>
      <div className="section-title"><span className="title">{title}</span></div>
      {hint && <div className="body" style={{ margin: '-6px 4px 10px', fontSize: '.85rem' }}>{hint}</div>}
      <div className="card" style={{ padding: '16px 8px 10px' }}>{children}</div>
    </>
  );
}

function Empty({ icon, text }) {
  return <div className="empty" style={{ padding: '24px 8px' }}><div className="big">{icon}</div><div className="body">{text}</div></div>;
}

function Heatmap({ map, from, today }) {
  const cells = [];
  let cur = from;
  while (cur <= today) { cells.push(cur); cur = addDays(cur, 1); }
  const level = (amt) => (!amt ? '' : amt > 60 ? 'l3' : amt > 25 ? 'l2' : 'l1');
  return (
    <div className="heatmap">
      {cells.map((day) => (
        <div key={day} className={'hm-cell ' + level(map[day])} title={`${day}${map[day] ? ' · ' + map[day] + ' XP' : ''}`} />
      ))}
    </div>
  );
}
