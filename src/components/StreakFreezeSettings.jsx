import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useToast } from './Toast.jsx';
import { Sheet } from './Sheet.jsx';
import { ICONS, COLORS } from '../lib/trackerTypes.js';

const EARN_REASONS = {
  per_streak: '⚡ Streak-Meilenstein', per_checkins: '🔥 Check-ins',
  weekly: '🎁 Wochengeschenk', level_up: '⭐ Level-Up', auto_bridge: '🧊 Tag geschützt',
};

export function StreakFreezeSettings() {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => { const d = await api.streakFreeze(); setData(d); setF(d.config); };
  useEffect(() => { load(); }, []);
  if (!data) return null;
  const c = data.config;
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setBusy(true);
    try { const r = await api.updateStreakFreeze(f); setData((d) => ({ ...d, config: r.config })); setF(r.config); setOpen(false); toast.show('Streak-Schutz gespeichert 🧊'); }
    finally { setBusy(false); }
  };

  return (
    <>
      <div className="section-title"><span className="title">Streak-Schutz</span></div>
      <div className="card tap" onClick={() => setOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <span style={{ fontSize: '2rem' }}>{c.icon}</span>
        <div style={{ flex: 1 }}>
          <div className="title">{c.name}</div>
          <div className="body">{c.enabled ? `${c.balance} / ${c.max_freezes} verfügbar · ${c.count_mode === 'grow' ? 'Serie wächst' : 'nur erhalten'}` : 'Deaktiviert'}</div>
        </div>
        <span style={{ color: 'var(--primary)' }}>⚙️</span>
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} title="Streak-Schutz konfigurieren">
        {f && (
          <>
            <Switch label="Aktiviert" checked={f.enabled} onChange={(v) => set('enabled', v)} />

            <div className="label" style={{ margin: '18px 0 8px' }}>Gestaltung</div>
            <label className="field"><span>Name</span>
              <input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} />
            </label>
            <label className="field"><span>Beschreibung</span>
              <input className="input" value={f.description || ''} onChange={(e) => set('description', e.target.value)} />
            </label>
            <div className="field"><span>Symbol</span>
              <div className="chips">
                {['🧊', '❄️', '🛡️', '🔥', '⭐', '🥶', '💠', '🪅', ...ICONS].slice(0, 16).map((ic) => (
                  <button type="button" key={ic} className={'chip' + (f.icon === ic ? ' sel' : '')} style={{ fontSize: '1.1rem' }} onClick={() => set('icon', ic)}>{ic}</button>
                ))}
              </div>
            </div>
            <div className="field"><span>Farbe</span>
              <div className="chips">
                {COLORS.map((col) => (
                  <button type="button" key={col} onClick={() => set('color', col)}
                    style={{ width: 34, height: 34, borderRadius: '50%', background: col, border: f.color === col ? '3px solid var(--on-surface)' : '2px solid var(--outline-variant)', cursor: 'pointer' }} />
                ))}
              </div>
            </div>

            <div className="label" style={{ margin: '18px 0 8px' }}>Wertung</div>
            <div className="field"><span>Ein geschützter Tag …</span>
              <div className="chips">
                <button type="button" className={'chip' + (f.count_mode === 'preserve' ? ' sel' : '')} onClick={() => set('count_mode', 'preserve')}>erhält die Serie</button>
                <button type="button" className={'chip' + (f.count_mode === 'grow' ? ' sel' : '')} onClick={() => set('count_mode', 'grow')}>lässt sie wachsen</button>
              </div>
            </div>
            <label className="field"><span>Maximale Anzahl Schutzschilde</span>
              <input className="input" type="number" min="0" max="30" value={f.max_freezes} onChange={(e) => set('max_freezes', e.target.value)} />
            </label>
            <Switch label="Automatisch einsetzen" desc="Verbraucht bei einem verpassten Tag automatisch einen Schild." checked={f.auto_apply} onChange={(v) => set('auto_apply', v)} />

            <div className="label" style={{ margin: '18px 0 8px' }}>Verdienen (0 = aus)</div>
            <div className="row">
              <label className="field"><span>Alle X Streak-Tage</span>
                <input className="input" type="number" min="0" value={f.earn_per_streak} onChange={(e) => set('earn_per_streak', e.target.value)} />
              </label>
              <label className="field"><span>Alle X Check-ins</span>
                <input className="input" type="number" min="0" value={f.earn_per_checkins} onChange={(e) => set('earn_per_checkins', e.target.value)} />
              </label>
            </div>
            <label className="field"><span>Geschenk pro Woche</span>
              <input className="input" type="number" min="0" max="30" value={f.earn_weekly} onChange={(e) => set('earn_weekly', e.target.value)} />
            </label>
            <Switch label="Bei Level-Up +1" checked={f.earn_on_levelup} onChange={(v) => set('earn_on_levelup', v)} />

            {data.events.length > 0 && (
              <>
                <div className="label" style={{ margin: '20px 0 8px' }}>Verlauf</div>
                <div className="card" style={{ padding: '4px 14px' }}>
                  {data.events.slice(0, 8).map((e) => (
                    <div className="list-item" key={e.id} style={{ padding: '10px 2px' }}>
                      <span style={{ flex: 1 }} className="body">{EARN_REASONS[e.reason] || e.reason}</span>
                      <span className="mono-num" style={{ color: e.type === 'earn' ? 'var(--primary)' : 'var(--tertiary)', fontWeight: 700 }}>
                        {e.type === 'earn' ? '+' : '−'}{e.amount}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="sheet-actions">
              <button className="btn filled block" disabled={busy} onClick={save}>Speichern</button>
            </div>
          </>
        )}
      </Sheet>
    </>
  );
}

function Switch({ label, desc, checked, onChange }) {
  return (
    <div className="list-item" style={{ alignItems: 'flex-start' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 650 }}>{label}</div>
        {desc && <div className="body" style={{ fontSize: '.82rem' }}>{desc}</div>}
      </div>
      <button role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        style={{ width: 52, height: 32, borderRadius: 999, border: 'none', cursor: 'pointer',
          background: checked ? 'var(--primary)' : 'var(--surface-container-highest)', position: 'relative', flexShrink: 0 }}>
        <span style={{ position: 'absolute', top: 4, left: checked ? 24 : 4, width: 24, height: 24, borderRadius: '50%',
          background: checked ? 'var(--on-primary)' : 'var(--outline)', transition: 'left .2s var(--ease-spatial)' }} />
      </button>
    </div>
  );
}
