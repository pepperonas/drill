import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, Tooltip, CartesianGrid, ZAxis } from 'recharts';
import { api } from '../api/client.js';
import { tooltipStyle } from './Dashboard.jsx';

const RANGES = [['30', '30T'], ['90', '90T'], ['365', '1J'], ['all', 'Alles']];

export default function Insights() {
  const nav = useNavigate();
  const [trackers, setTrackers] = useState([]);
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [range, setRange] = useState('90');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.trackers().then(({ trackers }) => {
      const numeric = trackers.filter((t) => !['text', 'choice', 'boolean'].includes(t.type));
      setTrackers(numeric);
      if (numeric[0]) setA(String(numeric[0].id));
      if (numeric[1]) setB(String(numeric[1].id));
    });
  }, []);

  useEffect(() => {
    if (!a || !b || a === b) { setData(null); return; }
    setLoading(true);
    api.correlation(a, b, range).then(setData).finally(() => setLoading(false));
  }, [a, b, range]);

  const strength = (r) => {
    if (r == null) return 'zu wenig Daten';
    const x = Math.abs(r);
    const s = x > 0.7 ? 'starker' : x > 0.4 ? 'mittlerer' : x > 0.2 ? 'schwacher' : 'kaum';
    return `${s} ${r >= 0 ? 'positiver' : 'negativer'} Zusammenhang`;
  };

  return (
    <div>
      <div className="topbar" style={{ position: 'static', padding: '4px 4px 12px' }}>
        <button className="btn text" style={{ padding: '6px 8px' }} onClick={() => nav('/')}>←</button>
        <span className="headline" style={{ flex: 1 }}>Insights</span>
      </div>

      <div className="card">
        <div className="body" style={{ marginBottom: 14 }}>Vergleiche zwei Tracker und entdecke Zusammenhänge — z. B. Schlaf vs. Stimmung oder Kalorien vs. Gewicht.</div>
        <div className="row">
          <label className="field"><span>Tracker A</span>
            <select className="input" value={a} onChange={(e) => setA(e.target.value)}>
              {trackers.map((t) => <option key={t.id} value={t.id}>{t.icon} {t.name}</option>)}
            </select>
          </label>
          <label className="field"><span>Tracker B</span>
            <select className="input" value={b} onChange={(e) => setB(e.target.value)}>
              {trackers.map((t) => <option key={t.id} value={t.id}>{t.icon} {t.name}</option>)}
            </select>
          </label>
        </div>
        <div className="chips">
          {RANGES.map(([k, l]) => <button key={k} className={'chip' + (range === k ? ' sel' : '')} onClick={() => setRange(k)}>{l}</button>)}
        </div>
      </div>

      {trackers.length < 2 && <div className="card empty"><div className="big">🔍</div><div className="body">Du brauchst mindestens zwei numerische Tracker mit Einträgen.</div></div>}

      {loading && <div className="skeleton" style={{ height: 260, marginTop: 14 }} />}

      {data && !loading && (
        <>
          <div className="card" style={{ marginTop: 14, textAlign: 'center' }}>
            <div className="display" style={{ fontSize: '2.6rem', color: 'var(--primary)' }}>{data.r == null ? '–' : data.r}</div>
            <div className="label">Korrelation (r)</div>
            <div className="body" style={{ marginTop: 6 }}>{strength(data.r)} · {data.n} gemeinsame Tage</div>
          </div>

          {data.pairs.length >= 3 && (
            <div className="card" style={{ marginTop: 14, padding: '16px 8px 8px' }}>
              <ResponsiveContainer width="100%" height={260}>
                <ScatterChart margin={{ top: 10, right: 16, left: 0, bottom: 10 }}>
                  <CartesianGrid stroke="var(--outline-variant)" strokeDasharray="3 3" />
                  <XAxis type="number" dataKey="a" name={data.a.name} stroke="var(--on-surface-variant)" fontSize={11} tickLine={false} axisLine={false} domain={['auto', 'auto']}
                    label={{ value: data.a.name, position: 'insideBottom', offset: -4, fill: 'var(--on-surface-variant)', fontSize: 11 }} />
                  <YAxis type="number" dataKey="b" name={data.b.name} stroke="var(--on-surface-variant)" fontSize={11} tickLine={false} axisLine={false} width={44} domain={['auto', 'auto']} />
                  <ZAxis range={[60, 60]} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ strokeDasharray: '3 3' }} />
                  <Scatter data={data.pairs} fill="var(--primary)" />
                </ScatterChart>
              </ResponsiveContainer>
              <div className="k" style={{ textAlign: 'center', marginTop: 6 }}>X: {data.a.name} · Y: {data.b.name}</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
