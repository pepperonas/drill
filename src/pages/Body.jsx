import { useEffect, useState, useCallback } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { useToast } from '../components/Toast.jsx';
import { Sheet } from '../components/Sheet.jsx';
import { METRIC_KINDS, fmtDay } from '../lib/util.js';
import { tooltipStyle } from './Dashboard.jsx';

export default function Body() {
  const { today } = useAuth();
  const toast = useToast();
  const [sel, setSel] = useState('weight');
  const [series, setSeries] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ value: '', day: today, note: '' });
  const [busy, setBusy] = useState(false);

  const def = METRIC_KINDS.find((m) => m.kind === sel) || METRIC_KINDS[0];

  const load = useCallback(async () => {
    const { metrics } = await api.metrics(sel);
    setSeries(metrics.map((m) => ({ id: m.id, day: fmtDay(m.day), raw: m.day, value: m.value })));
  }, [sel]);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    const v = Number(form.value);
    if (!Number.isFinite(v)) { toast.show('Bitte gültigen Wert eingeben'); return; }
    setBusy(true);
    try {
      const res = await api.addMetric({ kind: sel, value: v, unit: def.unit, day: form.day, note: form.note });
      toast.show(`${def.label} gespeichert · +10 XP`);
      toast.celebrate(res.gami);
      setOpen(false); setForm({ value: '', day: today, note: '' });
      await load();
    } finally { setBusy(false); }
  };

  const remove = async (id) => { await api.delMetric(id); await load(); };

  const latest = series[series.length - 1];
  const first = series[0];
  const delta = latest && first ? Math.round((latest.value - first.value) * 10) / 10 : null;

  return (
    <div>
      <h1 className="headline" style={{ margin: '4px 4px 16px' }}>Körper</h1>

      <div className="chips" style={{ marginBottom: 16 }}>
        {METRIC_KINDS.map((m) => (
          <button key={m.kind} className={'chip' + (sel === m.kind ? ' sel' : '')} onClick={() => setSel(m.kind)}>{m.label}</button>
        ))}
      </div>

      <div className="grid cols-3" style={{ marginBottom: 14 }}>
        <div className="tile"><span className="v accent">{latest ? latest.value : '–'}</span><span className="k">Aktuell ({def.unit})</span></div>
        <div className="tile"><span className="v">{first ? first.value : '–'}</span><span className="k">Start</span></div>
        <div className="tile"><span className="v" style={{ color: delta > 0 ? 'var(--tertiary)' : 'var(--primary)' }}>{delta == null ? '–' : (delta > 0 ? '+' : '') + delta}</span><span className="k">Differenz</span></div>
      </div>

      {series.length >= 2 ? (
        <div className="card" style={{ padding: '16px 8px 8px' }}>
          <ResponsiveContainer width="100%" height={230}>
            <LineChart data={series} margin={{ top: 6, right: 14, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--outline-variant)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="day" stroke="var(--on-surface-variant)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--on-surface-variant)" fontSize={11} tickLine={false} axisLine={false} domain={['dataMin - 1', 'dataMax + 1']} width={44} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={3} dot={{ r: 3, fill: 'var(--primary)' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="card empty"><div className="big">📏</div><div className="body">Noch zu wenig Daten für einen Chart. Erfasse mindestens zwei {def.label}-Werte.</div></div>
      )}

      <div className="section-title"><span className="title">Einträge</span></div>
      <div className="card">
        {series.length === 0 && <div className="body">Noch keine Einträge.</div>}
        {[...series].reverse().map((m) => (
          <div className="list-item" key={m.id}>
            <span style={{ flex: 1 }} className="mono-num"><b>{m.value}</b> {def.unit}</span>
            <span className="body">{m.day}</span>
            <button className="btn text danger" style={{ padding: '6px 10px' }} onClick={() => remove(m.id)}>✕</button>
          </div>
        ))}
      </div>

      <button className="fab" onClick={() => setOpen(true)}><span className="plus">+</span> {def.label}</button>

      <Sheet open={open} onClose={() => setOpen(false)} title={def.label + ' erfassen'}>
        <label className="field"><span>Wert ({def.unit})</span>
          <input className="input" type="number" inputMode="decimal" step="0.1" autoFocus value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
        </label>
        <label className="field"><span>Datum</span>
          <input className="input" type="date" value={form.day} max={today} onChange={(e) => setForm({ ...form, day: e.target.value })} />
        </label>
        <label className="field"><span>Notiz (optional)</span>
          <input className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        </label>
        <button className="btn filled block" disabled={busy} onClick={save}>Speichern</button>
      </Sheet>
    </div>
  );
}
