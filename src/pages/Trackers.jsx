import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { useToast } from '../components/Toast.jsx';
import { Sheet } from '../components/Sheet.jsx';
import { TrackerForm, EntryInput } from '../components/TrackerForm.jsx';
import { CATEGORIES, fmtValue, catLabel } from '../lib/trackerTypes.js';

export default function Trackers() {
  const { today } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [trackers, setTrackers] = useState(null);
  const [creating, setCreating] = useState(false);
  const [quick, setQuick] = useState(null);    // tracker being quick-logged
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { trackers } = await api.trackers();
    setTrackers(trackers);
  }, []);
  useEffect(() => { load(); }, [load]);

  const create = async (form) => {
    setBusy(true);
    try { await api.createTracker(form); toast.show('Tracker erstellt ✨'); setCreating(false); await load(); }
    finally { setBusy(false); }
  };

  if (!trackers) return <div className="skeleton" style={{ height: 300, marginTop: 12 }} />;

  // group by category
  const groups = {};
  for (const t of trackers) (groups[t.category] = groups[t.category] || []).push(t);
  const orderedCats = CATEGORIES.map((c) => c.key).filter((k) => groups[k]);

  return (
    <div>
      <h1 className="headline" style={{ margin: '4px 4px 16px' }}>Tracker</h1>

      {trackers.length === 0 && (
        <div className="card empty"><div className="big">📊</div><div className="body">Lege deinen ersten Tracker an — verfolge alles, was du willst.</div></div>
      )}

      {orderedCats.map((cat) => (
        <div key={cat}>
          <div className="section-title"><span className="label">{catLabel(cat)}</span></div>
          <div className="grid cols-2">
            {groups[cat].map((t) => (
              <TrackerCard key={t.id} t={t} onOpen={() => nav(`/trackers/${t.id}`)} onQuick={() => setQuick(t)} />
            ))}
          </div>
        </div>
      ))}

      <button className="fab" onClick={() => setCreating(true)}><span className="plus">+</span> Tracker</button>

      <Sheet open={creating} onClose={() => setCreating(false)} title="Neuer Tracker">
        <TrackerForm onSave={create} busy={busy} />
      </Sheet>

      <QuickAdd tracker={quick} today={today} onClose={() => setQuick(null)} onDone={load} />
    </div>
  );
}

function TrackerCard({ t, onOpen, onQuick }) {
  const g = t.goal;
  return (
    <div className="tile" style={{ gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={onOpen}>
        <span style={{ fontSize: '1.4rem' }}>{t.icon || '📊'}</span>
        <span style={{ fontWeight: 700, flex: 1 }}>{t.name}</span>
      </div>
      <div onClick={onOpen} style={{ cursor: 'pointer' }}>
        <span className="v" style={{ color: t.color || 'var(--primary)', fontSize: '1.5rem' }}>{fmtValue(t, t.latest)}</span>
      </div>
      {g && (
        <div>
          <div className="progress-track" style={{ height: 8 }}>
            <div className="progress-fill" style={{ width: g.pct + '%', background: t.color || 'var(--primary)' }} />
          </div>
          <div className="k" style={{ marginTop: 4 }}>Ziel {g.goal}{t.unit ? ' ' + t.unit : ''} {g.reached ? '✓' : ''}</div>
        </div>
      )}
      <button className="btn tonal" style={{ padding: '8px', marginTop: 2 }} onClick={onQuick}>+ Eintrag</button>
    </div>
  );
}

export function QuickAdd({ tracker, today, onClose, onDone }) {
  const toast = useToast();
  const [value, setValue] = useState(tracker?.type === 'boolean' ? 1 : '');
  const [day, setDay] = useState(today);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setValue(tracker?.type === 'boolean' ? 1 : '');
    setDay(today); setNote('');
  }, [tracker, today]);

  if (!tracker) return null;
  const save = async () => {
    setBusy(true);
    try {
      const res = await api.addEntry(tracker.id, { value, day, note });
      toast.show(`${tracker.icon || '📊'} ${tracker.name} gespeichert · +${tracker.xp} XP`);
      toast.celebrate(res.gami);
      onClose(); await onDone();
    } finally { setBusy(false); }
  };

  return (
    <Sheet open={!!tracker} onClose={onClose} title={`${tracker.icon || ''} ${tracker.name}`}>
      <div className="field"><span>Wert</span><EntryInput tracker={tracker} value={value} onChange={setValue} autoFocus /></div>
      <label className="field"><span>Datum</span>
        <input className="input" type="date" value={day} max={today} onChange={(e) => setDay(e.target.value)} />
      </label>
      <label className="field"><span>Notiz (optional)</span>
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <button className="btn filled block" disabled={busy} onClick={save}>Speichern</button>
    </Sheet>
  );
}
