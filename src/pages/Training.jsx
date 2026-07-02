import { useEffect, useState, useCallback } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { useToast } from '../components/Toast.jsx';
import { Sheet } from '../components/Sheet.jsx';
import { Select } from '../components/Select.jsx';
import { WORKOUT_CATEGORIES, fmtDayLong } from '../lib/util.js';
import {
  WORKOUT_PLACES, WORKOUT_TEMPLATES, BODYWEIGHT_EXERCISES, GYM_EXERCISES, placeMeta,
} from '../lib/workoutTemplates.js';

const emptySet = () => ({ exercise: '', setCount: '', weight: '', reps: '' });

// "3 × 12 × 20 kg" style summary for a logged set row.
function fmtSet(s) {
  const n = s.set_count > 1 ? `${s.set_count} × ` : '';
  const reps = s.reps != null ? `${s.reps}` : '–';
  const w = s.weight != null ? ` × ${s.weight} kg` : '';
  return `${n}${reps}${w}`;
}

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

  // the user's own exercises + built-in gym + bodyweight names, de-duplicated.
  const exerciseLibrary = [...new Set([...exercises, ...GYM_EXERCISES, ...BODYWEIGHT_EXERCISES])];
  const categories = [...WORKOUT_CATEGORIES, ...customCats.filter((c) => !WORKOUT_CATEGORIES.includes(c))];

  const openSheet = () => { setForm(initForm(today)); setOpen(true); };

  // Selecting a place picks a sensible bodyweight default (gym = weights,
  // home/outdoor = bodyweight) — still freely overridable via the toggle.
  const pickPlace = (place) =>
    setForm((f) => ({ ...f, place, bodyweight: place !== 'gym' }));

  const applyTemplate = (t) => setForm((f) => ({
    ...f,
    place: t.place, bodyweight: !!t.bodyweight, category: t.category, title: t.label,
    duration: t.duration ? String(t.duration) : '',
    sets: t.sets.length
      ? t.sets.map((s) => ({ exercise: s.exercise, setCount: s.count ? String(s.count) : '', weight: '', reps: s.reps == null ? '' : String(s.reps) }))
      : [emptySet()],
  }));

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
        .map((s) => ({
          exercise: s.exercise,
          setCount: s.setCount === '' ? 1 : Number(s.setCount),
          weight: form.bodyweight || s.weight === '' ? null : Number(s.weight),
          reps: s.reps === '' ? null : Number(s.reps),
        }));
      const res = await api.addWorkout({
        day: form.day, category: form.category, title: form.title || null,
        place: form.place, duration_min: form.duration ? Number(form.duration) : null, sets,
      });
      const it = res.intensity || { points: 0, xp: 0 };
      toast.show(`💪 Workout gespeichert · ⚡ ${it.points} Intensität · +${40 + (it.xp || 0)} XP`);
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
        <div className="card empty"><div className="big">🏋️</div><div className="body">Noch keine Workouts. Protokolliere dein erstes Training — im Gym oder kurz zuhause.</div></div>
      )}

      <div className="grid">
        {list.map((w) => {
          const pm = placeMeta(w.place);
          return (
            <div className="card" key={w.id}>
              <div className="card-h">
                <div style={{ flex: 1 }}>
                  <div className="title">{pm ? `${pm.icon} ` : ''}{w.title || w.category || 'Workout'}</div>
                  <div className="label" style={{ marginTop: 2 }}>{fmtDayLong(w.day)}{w.duration_min ? ` · ${w.duration_min} min` : ''}{w.category && w.title ? ` · ${w.category}` : ''}{w.intensity > 0 ? ` · ⚡ ${w.intensity}` : ''}</div>
                </div>
                <button className="btn text danger" style={{ padding: '6px 10px' }} onClick={() => remove(w.id)}>✕</button>
              </div>
              {w.sets.length > 0 && (
                <div>
                  {w.sets.map((s) => (
                    <div className="list-item" key={s.id} style={{ padding: '8px 2px' }}>
                      <span style={{ flex: 1 }}>{s.exercise}</span>
                      <span className="body mono-num">{fmtSet(s)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button className="fab" onClick={openSheet}><span className="plus">+</span> Workout</button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Workout protokollieren">
        {/* Quick-start: log a session in two taps — grouped Gym / Zuhause. */}
        <div className="label" style={{ marginBottom: 8 }}>🏋️ Gym · Schnellstart</div>
        <div className="chips" style={{ marginBottom: 14 }}>
          {WORKOUT_TEMPLATES.filter((t) => t.group === 'gym').map((t) => (
            <button type="button" key={t.id} className="chip" onClick={() => applyTemplate(t)}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
        <div className="label" style={{ marginBottom: 8 }}>🏠 Zuhause · Schnellstart</div>
        <div className="chips" style={{ marginBottom: 16 }}>
          {WORKOUT_TEMPLATES.filter((t) => t.group === 'home').map((t) => (
            <button type="button" key={t.id} className="chip" onClick={() => applyTemplate(t)}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <label className="field"><span>Ort</span>
          <div className="chips">
            {WORKOUT_PLACES.map((p) => (
              <button type="button" key={p.id} className={`chip${form.place === p.id ? ' sel' : ''}`} aria-pressed={form.place === p.id} onClick={() => pickPlace(p.id)}>
                {p.icon} {p.label}
              </button>
            ))}
          </div>
        </label>

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

        <BodyweightSwitch checked={form.bodyweight} onChange={(v) => setForm((f) => ({ ...f, bodyweight: v }))} />

        <div className="label" style={{ margin: '6px 0 10px' }}>Sätze</div>
        <datalist id="exercise-library">
          {exerciseLibrary.map((ex) => <option key={ex} value={ex} />)}
        </datalist>
        <div className="row mono-num" style={{ gap: 6, marginBottom: 4, paddingRight: 34 }}>
          <span className="label" style={{ flex: 2, minWidth: 0 }}>Übung</span>
          <span className="label" style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>Sätze</span>
          <span className="label" style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>Wdh</span>
          {!form.bodyweight && <span className="label" style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>kg</span>}
        </div>
        {form.sets.map((s, i) => (
          <div className="row" key={i} style={{ marginBottom: 10, alignItems: 'center', gap: 6 }}>
            <input className="input" style={{ flex: 2, minWidth: 0 }} list="exercise-library" placeholder="Übung" value={s.exercise} onChange={(e) => setSet(i, 'exercise', e.target.value)} />
            <input className="input" style={{ flex: 1, minWidth: 0, textAlign: 'center' }} placeholder="3" type="number" inputMode="numeric" value={s.setCount} onChange={(e) => setSet(i, 'setCount', e.target.value)} />
            <input className="input" style={{ flex: 1, minWidth: 0, textAlign: 'center' }} placeholder="12" type="number" inputMode="numeric" value={s.reps} onChange={(e) => setSet(i, 'reps', e.target.value)} />
            {!form.bodyweight && (
              <input className="input" style={{ flex: 1, minWidth: 0, textAlign: 'center' }} placeholder="kg" type="number" inputMode="decimal" value={s.weight} onChange={(e) => setSet(i, 'weight', e.target.value)} />
            )}
            <button className="btn text danger" style={{ flex: '0 0 auto', padding: '6px 8px' }} onClick={() => rmSet(i)}>✕</button>
          </div>
        ))}
        <div className="body" style={{ fontSize: '.8rem', margin: '-2px 2px 10px' }}>
          Gewicht ist optional — 3 Sätze mit Wiederholungen genügen. Alle Sätze, Wdh. &amp; Gewichte zählen in die ⚡ Intensität.
        </div>
        <button className="btn outline block" onClick={addSetRow}>+ Satz hinzufügen</button>

        <div className="sheet-actions">
          <button className="btn filled block" disabled={busy} onClick={save}>Workout speichern</button>
        </div>
      </Sheet>
    </div>
  );
}

function BodyweightSwitch({ checked, onChange }) {
  return (
    <div className="list-item" style={{ alignItems: 'flex-start', marginBottom: 6 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 650 }}>Körpergewicht</div>
        <div className="body" style={{ fontSize: '.82rem' }}>Ohne Gewichte — nur Wiederholungen erfassen.</div>
      </div>
      <button type="button" role="switch" aria-checked={checked} aria-label="Körpergewicht" onClick={() => onChange(!checked)}
        style={{ width: 52, height: 32, borderRadius: 999, border: 'none', cursor: 'pointer',
          background: checked ? 'var(--primary)' : 'var(--surface-container-highest)', position: 'relative', flexShrink: 0 }}>
        <span style={{ position: 'absolute', top: 4, left: checked ? 24 : 4, width: 24, height: 24, borderRadius: '50%',
          background: checked ? 'var(--on-primary)' : 'var(--outline)', transition: 'left .2s var(--ease-spatial)' }} />
      </button>
    </div>
  );
}

function initForm(today) {
  return { day: today, duration: '', place: 'gym', bodyweight: false, category: 'Push', title: '', sets: [emptySet()] };
}
