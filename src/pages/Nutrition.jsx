import { useEffect, useState, useCallback } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip, Cell } from 'recharts';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { useToast } from '../components/Toast.jsx';
import { Sheet } from '../components/Sheet.jsx';
import { addDays, fmtDay } from '../lib/util.js';
import { tooltipStyle } from './Dashboard.jsx';

export default function Nutrition() {
  const { today } = useAuth();
  const toast = useToast();
  const [logs, setLogs] = useState([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(blank(today));

  const from = addDays(today, -29);
  const load = useCallback(async () => {
    const { nutrition } = await api.nutrition(from);
    setLogs(nutrition);
  }, [from]);
  useEffect(() => { load(); }, [load]);

  const openFor = (day) => {
    const ex = logs.find((l) => l.day === day);
    setForm(ex ? { ...blank(day), ...numify(ex) } : blank(day));
    setOpen(true);
  };

  const save = async () => {
    setBusy(true);
    try {
      const res = await api.addNutrition({ ...form });
      toast.show('🥗 Ernährung gespeichert');
      toast.celebrate(res.gami);
      setOpen(false);
      await load();
    } finally { setBusy(false); }
  };

  const chartData = logs.map((l) => ({ day: fmtDay(l.day), kcal: l.kcal || 0, quality: l.quality || 0 }));
  const todayLog = logs.find((l) => l.day === today);
  const avgKcal = logs.filter((l) => l.kcal).length
    ? Math.round(logs.reduce((a, l) => a + (l.kcal || 0), 0) / logs.filter((l) => l.kcal).length) : null;

  return (
    <div>
      <h1 className="headline" style={{ margin: '4px 4px 16px' }}>Ernährung</h1>

      <div className="grid cols-3" style={{ marginBottom: 14 }}>
        <div className="tile"><span className="v accent">{todayLog?.kcal || '–'}</span><span className="k">Heute kcal</span></div>
        <div className="tile"><span className="v">{avgKcal || '–'}</span><span className="k">Ø kcal (30 T.)</span></div>
        <div className="tile"><span className="v">{logs.length}</span><span className="k">Tage getrackt</span></div>
      </div>

      {chartData.some((d) => d.kcal > 0) ? (
        <div className="card" style={{ padding: '16px 8px 8px' }}>
          <div className="label" style={{ padding: '0 8px 6px' }}>Kalorien (30 Tage)</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
              <XAxis dataKey="day" stroke="var(--on-surface-variant)" fontSize={10} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--surface-container-highest)' }} />
              <Bar dataKey="kcal" radius={[6, 6, 0, 0]}>
                {chartData.map((_, i) => <Cell key={i} fill="var(--primary)" />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="card empty"><div className="big">🥗</div><div className="body">Tracke deine Ernährung – Kalorien & Makros oder einfach eine Tagesbewertung.</div></div>
      )}

      <div className="section-title"><span className="title">Verlauf</span></div>
      <div className="card">
        {logs.length === 0 && <div className="body">Noch keine Einträge.</div>}
        {[...logs].reverse().map((l) => (
          <div className="list-item tap" key={l.day} onClick={() => openFor(l.day)}>
            <span style={{ flex: 1 }} className="body">{fmtDay(l.day)}</span>
            {l.kcal ? <span className="mono-num"><b>{l.kcal}</b> kcal</span> : null}
            {l.quality ? <span title="Qualität">{'⭐'.repeat(l.quality)}</span> : null}
          </div>
        ))}
      </div>

      <button className="fab" onClick={() => openFor(today)}><span className="plus">+</span> Eintrag</button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Ernährung erfassen">
        <label className="field"><span>Datum</span>
          <input className="input" type="date" value={form.day} max={today} onChange={(e) => setForm({ ...form, day: e.target.value })} />
        </label>
        <div className="row">
          <label className="field"><span>Kalorien</span><input className="input" type="number" inputMode="numeric" value={form.kcal} onChange={(e) => setForm({ ...form, kcal: e.target.value })} /></label>
          <label className="field"><span>Wasser (ml)</span><input className="input" type="number" inputMode="numeric" value={form.water_ml} onChange={(e) => setForm({ ...form, water_ml: e.target.value })} /></label>
        </div>
        <div className="row">
          <label className="field"><span>Protein (g)</span><input className="input" type="number" value={form.protein_g} onChange={(e) => setForm({ ...form, protein_g: e.target.value })} /></label>
          <label className="field"><span>Carbs (g)</span><input className="input" type="number" value={form.carbs_g} onChange={(e) => setForm({ ...form, carbs_g: e.target.value })} /></label>
          <label className="field"><span>Fett (g)</span><input className="input" type="number" value={form.fat_g} onChange={(e) => setForm({ ...form, fat_g: e.target.value })} /></label>
        </div>
        <div className="field">
          <span>Wie gesund hast du gegessen?</span>
          <div className="chips">
            {[1, 2, 3, 4, 5].map((q) => (
              <button key={q} className={'chip' + (Number(form.quality) === q ? ' sel' : '')} onClick={() => setForm({ ...form, quality: q })}>{'⭐'.repeat(q)}</button>
            ))}
          </div>
        </div>
        <div className="sheet-actions">
          <button className="btn filled block" disabled={busy} onClick={save}>Speichern</button>
        </div>
      </Sheet>
    </div>
  );
}

function blank(day) { return { day, kcal: '', protein_g: '', carbs_g: '', fat_g: '', quality: '', water_ml: '' }; }
function numify(l) {
  const o = {};
  for (const k of ['kcal', 'protein_g', 'carbs_g', 'fat_g', 'quality', 'water_ml']) o[k] = l[k] == null ? '' : l[k];
  return o;
}
