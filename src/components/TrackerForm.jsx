import { useState } from 'react';
import { TYPES, CATEGORIES, GOAL_DIRECTIONS, COLORS, ICONS, TEMPLATES } from '../lib/trackerTypes.js';
import { Select } from './Select.jsx';

/** Renders the correct entry input for a tracker type. Controlled via value/onChange. */
export function EntryInput({ tracker, value, onChange, autoFocus }) {
  if (tracker.type === 'boolean') {
    return (
      <div className="chips">
        <button type="button" className={'chip' + (value === 1 ? ' sel' : '')} onClick={() => onChange(1)}>✅ Ja</button>
        <button type="button" className={'chip' + (value === 0 ? ' sel' : '')} onClick={() => onChange(0)}>✕ Nein</button>
      </div>
    );
  }
  if (tracker.type === 'scale') {
    const min = tracker.scale_min ?? 1, max = tracker.scale_max ?? 5;
    const opts = [];
    for (let i = min; i <= max; i++) opts.push(i);
    return (
      <div className="chips">
        {opts.map((n) => (
          <button type="button" key={n} className={'chip' + (Number(value) === n ? ' sel' : '')} onClick={() => onChange(n)}>{n}</button>
        ))}
      </div>
    );
  }
  if (tracker.type === 'choice') {
    const opts = tracker.options || [];
    return (
      <div className="chips">
        {opts.map((o) => (
          <button type="button" key={o} className={'chip' + (value === o ? ' sel' : '')} onClick={() => onChange(o)}>{o}</button>
        ))}
      </div>
    );
  }
  if (tracker.type === 'text') {
    return <textarea className="input" rows={3} autoFocus={autoFocus} value={value || ''} onChange={(e) => onChange(e.target.value)} />;
  }
  // number | duration
  return (
    <input className="input" type="number" inputMode="decimal" step="any" autoFocus={autoFocus}
      placeholder={tracker.type === 'duration' ? 'Minuten' : (tracker.unit || 'Wert')}
      value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
  );
}

/** Create/edit a tracker definition. */
export function TrackerForm({ initial, onSave, onCancel, busy }) {
  const [f, setF] = useState(() => ({
    name: '', type: 'number', unit: '', icon: '⭐', color: COLORS[0], category: 'custom',
    options: [], goal_value: '', goal_direction: '', scale_min: 1, scale_max: 5, xp: 10,
    ...(initial || {}),
  }));
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const applyTemplate = (t) => setF((p) => ({ ...p, ...t, goal_value: t.goal_value ?? '', goal_direction: t.goal_direction || '' }));

  return (
    <div>
      {!initial && (
        <>
          <div className="label" style={{ marginBottom: 8 }}>Vorlage (optional)</div>
          <div className="chips" style={{ marginBottom: 18 }}>
            {TEMPLATES.map((t) => (
              <button type="button" key={t.name} className="chip" onClick={() => applyTemplate(t)}>{t.icon} {t.name}</button>
            ))}
          </div>
        </>
      )}

      <label className="field"><span>Name</span>
        <input className="input" autoFocus value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="z. B. Liegestütze" />
      </label>

      <div className="field">
        <span>Typ</span>
        <div className="chips">
          {TYPES.map((t) => (
            <button type="button" key={t.type} className={'chip' + (f.type === t.type ? ' sel' : '')} onClick={() => set('type', t.type)}>{t.icon} {t.label}</button>
          ))}
        </div>
      </div>

      {(f.type === 'number' || f.type === 'duration') && (
        <label className="field"><span>Einheit</span>
          <input className="input" value={f.unit} onChange={(e) => set('unit', e.target.value)} placeholder="kg, ml, Stück …" />
        </label>
      )}

      {f.type === 'scale' && (
        <div className="row">
          <label className="field"><span>Skala min</span><input className="input" type="number" value={f.scale_min} onChange={(e) => set('scale_min', e.target.value)} /></label>
          <label className="field"><span>Skala max</span><input className="input" type="number" value={f.scale_max} onChange={(e) => set('scale_max', e.target.value)} /></label>
        </div>
      )}

      {f.type === 'choice' && (
        <label className="field"><span>Optionen (kommagetrennt)</span>
          <input className="input" value={Array.isArray(f.options) ? f.options.join(', ') : f.options}
            onChange={(e) => set('options', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
            placeholder="Gym, Lauf, Yoga" />
        </label>
      )}

      <div className="field">
        <span>Kategorie</span>
        <div className="chips">
          {CATEGORIES.map((c) => (
            <button type="button" key={c.key} className={'chip' + (f.category === c.key ? ' sel' : '')} onClick={() => set('category', c.key)}>{c.icon} {c.label}</button>
          ))}
        </div>
      </div>

      <div className="field">
        <span>Symbol</span>
        <div className="chips">
          {ICONS.map((ic) => (
            <button type="button" key={ic} className={'chip' + (f.icon === ic ? ' sel' : '')} style={{ fontSize: '1.1rem', padding: '8px 12px' }} onClick={() => set('icon', ic)}>{ic}</button>
          ))}
        </div>
      </div>

      <div className="field">
        <span>Farbe</span>
        <div className="chips">
          {COLORS.map((c) => (
            <button type="button" key={c} onClick={() => set('color', c)}
              style={{ width: 34, height: 34, borderRadius: '50%', background: c, border: f.color === c ? '3px solid var(--on-surface)' : '2px solid var(--outline-variant)', cursor: 'pointer' }} />
          ))}
        </div>
      </div>

      {(f.type === 'number' || f.type === 'duration' || f.type === 'scale') && (
        <div className="row">
          <label className="field"><span>Ziel (optional)</span>
            <input className="input" type="number" value={f.goal_value} onChange={(e) => set('goal_value', e.target.value)} />
          </label>
          <label className="field"><span>Richtung</span>
            <Select ariaLabel="Zielrichtung" value={f.goal_direction || ''} onChange={(v) => set('goal_direction', v)}
              options={[{ value: '', label: '—' }, ...GOAL_DIRECTIONS.map((g) => ({ value: g.key, label: g.label }))]} />
          </label>
        </div>
      )}

      <label className="field"><span>XP pro Eintrag</span>
        <input className="input" type="number" value={f.xp} onChange={(e) => set('xp', e.target.value)} />
      </label>

      <div className="sheet-actions">
        <button className="btn filled block" disabled={busy || !f.name.trim()} onClick={() => onSave(f)}>
          {initial ? 'Änderungen speichern' : 'Tracker erstellen'}
        </button>
        {initial && <button className="btn text block" onClick={onCancel}>Abbrechen</button>}
      </div>
    </div>
  );
}
