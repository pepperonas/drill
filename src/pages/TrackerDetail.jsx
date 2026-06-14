import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { useToast } from '../components/Toast.jsx';
import { Sheet } from '../components/Sheet.jsx';
import { TrackerForm } from '../components/TrackerForm.jsx';
import { QuickAdd } from './Trackers.jsx';
import { fmtValue } from '../lib/trackerTypes.js';
import { fmtDay } from '../lib/util.js';
import { tooltipStyle } from './Dashboard.jsx';

const RANGES = [['7', '7T'], ['30', '30T'], ['90', '90T'], ['365', '1J'], ['all', 'Alles']];

export default function TrackerDetail() {
  const { id } = useParams();
  const { today } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [entries, setEntries] = useState([]);
  const [range, setRange] = useState('90');
  const [showAvg, setShowAvg] = useState(true);
  const [editing, setEditing] = useState(false);
  const [quick, setQuick] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [s, e] = await Promise.all([api.trackerSeries(id, range), api.trackerEntries(id)]);
    setData(s); setEntries(e.entries);
  }, [id, range]);
  useEffect(() => { load(); }, [load]);

  if (!data) return <div className="skeleton" style={{ height: 300, marginTop: 12 }} />;
  const t = data.tracker;
  const numeric = !['text', 'choice', 'boolean'].includes(t.type);
  const chart = data.series.map((p) => ({ ...p, label: fmtDay(p.day) }));

  const saveEdit = async (form) => {
    setBusy(true);
    try { await api.updateTracker(id, form); toast.show('Gespeichert'); setEditing(false); await load(); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (!confirm(`Tracker „${t.name}" und alle Einträge löschen?`)) return;
    await api.deleteTracker(id); nav('/trackers');
  };
  const delEntry = async (eid) => { await api.delEntry(eid); await load(); };

  return (
    <div>
      <div className="topbar" style={{ position: 'static', padding: '4px 4px 12px' }}>
        <button className="btn text" style={{ padding: '6px 8px' }} onClick={() => nav('/trackers')}>←</button>
        <span className="headline" style={{ flex: 1 }}>{t.icon} {t.name}</span>
        <button className="btn text" onClick={() => setEditing(true)}>Bearbeiten</button>
      </div>

      {/* stats */}
      <div className="grid cols-3" style={{ marginBottom: 14 }}>
        <div className="tile"><span className="v accent" style={{ color: t.color }}>{fmtValue(t, data.series.length ? { ...t, value: data.series[data.series.length - 1].value, text_value: null } : null)}</span><span className="k">Aktuell</span></div>
        <div className="tile"><span className="v">{entries.length}</span><span className="k">Einträge</span></div>
        {data.goal
          ? <div className="tile"><span className="v" style={{ color: data.goal.reached ? 'var(--primary)' : 'var(--on-surface)' }}>{data.goal.pct}%</span><span className="k">Ziel {data.goal.goal}{t.unit ? ' ' + t.unit : ''}</span></div>
          : <div className="tile"><span className="v">{numeric && data.series.length ? Math.round((data.series.reduce((a, p) => a + p.value, 0) / data.series.length) * 10) / 10 : '–'}</span><span className="k">Ø</span></div>}
      </div>

      {/* range selector */}
      {numeric && (
        <>
          <div className="chips" style={{ marginBottom: 12 }}>
            {RANGES.map(([k, l]) => <button key={k} className={'chip' + (range === k ? ' sel' : '')} onClick={() => setRange(k)}>{l}</button>)}
            <button className={'chip' + (showAvg ? ' sel' : '')} onClick={() => setShowAvg((v) => !v)}>Ø-Linie</button>
          </div>
          {chart.length >= 2 ? (
            <div className="card" style={{ padding: '16px 8px 8px' }}>
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={chart} margin={{ top: 6, right: 14, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={t.color || 'var(--primary)'} stopOpacity={0.45} />
                      <stop offset="100%" stopColor={t.color || 'var(--primary)'} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--outline-variant)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" stroke="var(--on-surface-variant)" fontSize={11} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis stroke="var(--on-surface-variant)" fontSize={11} tickLine={false} axisLine={false} domain={['auto', 'auto']} width={44} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="value" stroke={t.color || 'var(--primary)'} strokeWidth={3} fill="url(#tg)" />
                  {showAvg && <Line type="monotone" dataKey="avg" stroke="var(--secondary)" strokeWidth={2} dot={false} strokeDasharray="5 4" />}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="card empty"><div className="body">Mindestens zwei Einträge für einen Chart nötig.</div></div>
          )}
        </>
      )}

      <div className="section-title"><span className="title">Einträge</span></div>
      <div className="card">
        {entries.length === 0 && <div className="body">Noch keine Einträge.</div>}
        {[...entries].reverse().map((e) => (
          <div className="list-item" key={e.id}>
            <span style={{ flex: 1 }} className="mono-num"><b>{fmtValue(t, e)}</b>{e.note ? <span className="body" style={{ marginLeft: 8 }}>{e.note}</span> : null}</span>
            <span className="body">{fmtDay(e.day)}</span>
            <button className="btn text danger" style={{ padding: '6px 10px' }} onClick={() => delEntry(e.id)}>✕</button>
          </div>
        ))}
      </div>

      <button className="fab" onClick={() => setQuick(t)}><span className="plus">+</span> Eintrag</button>

      <Sheet open={editing} onClose={() => setEditing(false)} title="Tracker bearbeiten">
        <TrackerForm initial={t} onSave={saveEdit} onCancel={() => setEditing(false)} busy={busy} />
        <button className="btn danger block" style={{ marginTop: 16 }} onClick={remove}>Tracker löschen</button>
      </Sheet>

      <QuickAdd tracker={quick} today={today} onClose={() => setQuick(null)} onDone={load} />
    </div>
  );
}
