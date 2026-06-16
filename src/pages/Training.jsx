import { useEffect, useState, useCallback } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { useToast } from '../components/Toast.jsx';
import { Sheet } from '../components/Sheet.jsx';
import { Select } from '../components/Select.jsx';
import { WORKOUT_CATEGORIES, fmtDayLong } from '../lib/util.js';

const emptySet = () => ({ exercise: '', weight: '', reps: '' });

export default function Training() {
  const { today } = useAuth();
  const toast = useToast();
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(initForm(today));
  const [exercises, setExercises] = useState([]);     // autocomplete library
  const [customCats, setCustomCats] = useState([]);   // user-defined categories

  const load = useCallback(async () => {
    const [{ workouts }, ex, opt] = await Promise.all([
      api.workouts(60), api.exercises().catch(() => ({ exercises: [] })),
      api.options('workout_category').catch(() => ({ options: [] })),
    ]);
    setList(workouts);
    setExercises(ex.exercises || []);
    setCustomCats((opt.options || []).map((o) => o.label));
  }, []);
  useEffect(() => { load(); }, [load]);

  const categories = [...WORKOUT_CATEGORIES, ...customCats.filter((c) => !WORKOUT_CATEGORIES.includes(c))];
  const addCategory = async () => {
    const label = prompt('Neue Kategorie:');
    if (!label || !label.trim()) return;
    await api.addOption('workout_category', { label: label.trim() });
    setForm((f) => ({ ...f, category: label.trim() }));
    await load();
  };

  const addSetRow = () => setForm((f) => ({ ...f, sets: [...f.sets, emptySet()] }));
  const setSet = (i, key, val) => setForm((f) => ({ ...f, sets: f.sets.map((s, j) => j === i ? { ...s, [key]: val } : s) }));
  const rmSet = (i) => setForm((f) => ({ ...f, sets: f.sets.filter((_, j) => j !== i) }));

  const save = async () => {
    setBusy(true);
    try {
      const sets = form.sets
        .filter((s) => s.exercise.trim())
        .map((s) => ({ exercise: s.exercise, weight: s.weight === '' ? null : Number(s.weight), reps: s.reps === '' ? null : Number(s.reps) }));
      const res = await api.addWorkout({
        day: form.day, category: form.category, title: form.title || null,
        duration_min: form.duration ? Number(form.duration) : null, sets,
      });
      toast.show('💪 Workout gespeichert · +40 XP');
      toast.celebrate(res.gami);
      for (const pr of res.prs || []) {
        toast.show(`🏅 Neuer Rekord: ${pr.exercise} ${pr.weight} kg × ${pr.reps}!`, { celebrate: true, duration: 3400 });
      }
      setOpen(false); setForm(initForm(today));
      await load();
    } finally { setBusy(false); }
  };

  const remove = async (id) => { await api.delWorkout(id); await load(); };

  return (
    <div>
      <h1 className="headline" style={{ margin: '4px 4px 16px' }}>Training</h1>

      {list.length === 0 && (
        <div className="card empty"><div className="big">🏋️</div><div className="body">Noch keine Workouts. Protokolliere dein erstes Training!</div></div>
      )}

      <div className="grid">
        {list.map((w) => (
          <div className="card" key={w.id}>
            <div className="card-h">
              <div style={{ flex: 1 }}>
                <div className="title">{w.title || w.category || 'Workout'}</div>
                <div className="label" style={{ marginTop: 2 }}>{fmtDayLong(w.day)}{w.duration_min ? ` · ${w.duration_min} min` : ''}{w.category && w.title ? ` · ${w.category}` : ''}</div>
              </div>
              <button className="btn text danger" style={{ padding: '6px 10px' }} onClick={() => remove(w.id)}>✕</button>
            </div>
            {w.sets.length > 0 && (
              <div>
                {w.sets.map((s) => (
                  <div className="list-item" key={s.id} style={{ padding: '8px 2px' }}>
                    <span style={{ flex: 1 }}>{s.exercise}</span>
                    <span className="body mono-num">{s.weight != null ? `${s.weight} kg` : ''}{s.weight != null && s.reps != null ? ' × ' : ''}{s.reps != null ? `${s.reps}` : ''}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <button className="fab" onClick={() => setOpen(true)}><span className="plus">+</span> Workout</button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Workout protokollieren">
        <div className="row">
          <label className="field"><span>Datum</span>
            <input className="input" type="date" value={form.day} max={today} onChange={(e) => setForm({ ...form, day: e.target.value })} />
          </label>
          <label className="field"><span>Dauer (min)</span>
            <input className="input" type="number" inputMode="numeric" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} />
          </label>
        </div>
        <label className="field"><span>Kategorie</span>
          <div className="row" style={{ gap: 8 }}>
            <div style={{ flex: 1 }}>
              <Select ariaLabel="Kategorie" value={form.category} onChange={(v) => setForm({ ...form, category: v })}
                options={categories.map((c) => ({ value: c, label: c }))} />
            </div>
            <button type="button" className="btn outline" style={{ flex: '0 0 auto' }} onClick={addCategory}>+ Eigene</button>
          </div>
        </label>
        <label className="field"><span>Titel (optional)</span>
          <input className="input" placeholder="z. B. Bankdrücken-Tag" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </label>

        <div className="label" style={{ margin: '6px 0 10px' }}>Sätze</div>
        <datalist id="exercise-library">
          {exercises.map((ex) => <option key={ex} value={ex} />)}
        </datalist>
        {form.sets.map((s, i) => (
          <div className="row" key={i} style={{ marginBottom: 10, alignItems: 'center' }}>
            <input className="input" style={{ flex: 2 }} list="exercise-library" placeholder="Übung" value={s.exercise} onChange={(e) => setSet(i, 'exercise', e.target.value)} />
            <input className="input" placeholder="kg" type="number" inputMode="decimal" value={s.weight} onChange={(e) => setSet(i, 'weight', e.target.value)} />
            <input className="input" placeholder="Wdh" type="number" inputMode="numeric" value={s.reps} onChange={(e) => setSet(i, 'reps', e.target.value)} />
            <button className="btn text danger" style={{ flex: '0 0 auto', padding: '6px 8px' }} onClick={() => rmSet(i)}>✕</button>
          </div>
        ))}
        <button className="btn outline block" style={{ marginBottom: 16 }} onClick={addSetRow}>+ Satz hinzufügen</button>

        <button className="btn filled block" disabled={busy} onClick={save}>Workout speichern</button>
      </Sheet>
    </div>
  );
}

function initForm(today) {
  return { day: today, duration: '', category: 'Push', title: '', sets: [emptySet()] };
}
