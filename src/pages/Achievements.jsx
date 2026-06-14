import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { Sheet } from '../components/Sheet.jsx';

export default function Achievements() {
  const [data, setData] = useState(null);
  const [sel, setSel] = useState(null);   // achievement opened in the detail sheet
  useEffect(() => { api.gamification().then(setData); }, []);
  if (!data) return <div className="skeleton" style={{ height: 300, marginTop: 12 }} />;

  const unlocked = data.achievements.filter((a) => a.unlocked).length;
  const lvl = data.level;

  return (
    <div>
      <h1 className="headline" style={{ margin: '4px 4px 16px' }}>Erfolge</h1>

      <div className="card" style={{ background: 'var(--surface-container-high)' }}>
        <div className="ring-wrap">
          <div style={{ textAlign: 'center', minWidth: 92 }}>
            <div className="display" style={{ fontSize: '3rem', color: 'var(--primary)' }}>{lvl.level}</div>
            <div className="label">Level</div>
          </div>
          <div style={{ flex: 1 }}>
            <div className="title" style={{ marginBottom: 6 }}>{lvl.xp} XP gesamt</div>
            <div className="progress-track"><div className="progress-fill" style={{ width: lvl.pct + '%' }} /></div>
            <div className="body" style={{ marginTop: 6 }}>Noch {lvl.levelNeed - lvl.levelXp} XP bis Level {lvl.level + 1}</div>
          </div>
        </div>
        <div className="grid cols-2" style={{ marginTop: 16 }}>
          <div className="tile"><span className="v accent">🔥 {data.streak.current}</span><span className="k">Aktuelle Serie</span></div>
          <div className="tile"><span className="v">{data.streak.best}</span><span className="k">Beste Serie</span></div>
        </div>
      </div>

      <div className="section-title">
        <span className="title">Abzeichen</span>
        <span className="label">{unlocked} / {data.achievements.length}</span>
      </div>
      <div className="grid cols-3">
        {data.achievements.map((a) => (
          <button key={a.code} className={'badge tap' + (a.unlocked ? '' : ' locked')} onClick={() => setSel(a)}
            style={{ border: 'none', cursor: 'pointer', font: 'inherit', color: 'inherit' }}>
            <span className="emoji">{a.icon}</span>
            <span className="bn">{a.name}</span>
            <span className="bd">{a.desc}</span>
            <span className="bd" style={{ color: a.unlocked ? 'var(--primary)' : 'var(--on-surface-variant)', fontWeight: 700, marginTop: 2 }}>
              {a.unlocked ? '✓ Erreicht' : (a.xp > 0 ? `+${a.xp} XP` : 'Gesperrt')}
            </span>
          </button>
        ))}
      </div>

      {data.recentXp.length > 0 && (
        <>
          <div className="section-title"><span className="title">XP-Verlauf</span></div>
          <div className="card">
            {data.recentXp.map((e) => (
              <div className="list-item" key={e.id} style={{ padding: '10px 2px' }}>
                <span style={{ flex: 1 }} className="body">{labelFor(e.reason)}</span>
                <span className="mono-num" style={{ color: 'var(--primary)', fontWeight: 700 }}>+{e.amount}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <Sheet open={!!sel} onClose={() => setSel(null)} title={null}>
        {sel && (
          <div style={{ textAlign: 'center', padding: '4px 4px 8px' }}>
            <div style={{ fontSize: '4rem', lineHeight: 1, filter: sel.unlocked ? 'none' : 'grayscale(1)', opacity: sel.unlocked ? 1 : 0.5 }}>{sel.icon}</div>
            <div className="headline" style={{ marginTop: 12 }}>{sel.name}</div>

            <div className="card" style={{ marginTop: 16, textAlign: 'left', background: 'var(--surface-container-high)' }}>
              <div className="label" style={{ marginBottom: 6 }}>So schaltest du es frei</div>
              <div className="body" style={{ color: 'var(--on-surface)', fontSize: '1rem' }}>{conditionText(sel.desc)}</div>
            </div>

            <div className="grid cols-2" style={{ marginTop: 14 }}>
              <div className="tile"><span className="v accent">{sel.xp > 0 ? `+${sel.xp}` : '—'}</span><span className="k">XP-Bonus</span></div>
              <div className="tile">
                <span className="v" style={{ color: sel.unlocked ? 'var(--primary)' : 'var(--on-surface-variant)', fontSize: '1.2rem' }}>
                  {sel.unlocked ? '✓ Erreicht' : 'Offen'}
                </span>
                <span className="k">{sel.unlocked && sel.unlocked_at ? fmtUnlocked(sel.unlocked_at) : 'noch nicht freigeschaltet'}</span>
              </div>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}

// Turn the terse condition ("7 Tage Streak") into a friendly full sentence.
function conditionText(desc) {
  const d = String(desc || '');
  if (/Erster Check-in/i.test(d)) return 'Checke zum ersten Mal ein.';
  if (/Streak/i.test(d)) return `Halte eine Serie von ${d.match(/\d+/)?.[0] ?? ''} aufeinanderfolgenden Tagen mit Check-in.`;
  if (/Check-ins gesamt/i.test(d)) return `Sammle insgesamt ${d.match(/\d+/)?.[0] ?? ''} Check-ins.`;
  if (/Workouts/i.test(d)) return `Protokolliere insgesamt ${d.match(/\d+/)?.[0] ?? ''} Workouts.`;
  if (/Volumen/i.test(d)) return `Bewege in Summe ${d.match(/[\d.]+ t/)?.[0] ?? ''} an Trainingsvolumen (Gewicht × Wdh.).`;
  if (/Bestleistung/i.test(d)) return d.includes('Erste') ? 'Stelle in einem Workout deine erste Bestleistung (1RM) auf.' : `Stelle ${d.match(/\d+/)?.[0] ?? ''} Bestleistungen über verschiedene Übungen auf.`;
  if (/Level/i.test(d)) return `Erreiche durch XP ${d}.`;
  if (/Tracker-Wert/i.test(d)) return 'Erfasse deinen ersten Wert in einem beliebigen Tracker.';
  if (/Tracker im Einsatz/i.test(d)) return `Lege ${d.match(/\d+/)?.[0] ?? ''} verschiedene Tracker an.`;
  if (/Tracker-Einträge/i.test(d)) return `Erfasse insgesamt ${d.match(/\d+/)?.[0] ?? ''} Tracker-Einträge.`;
  if (/Ernährung/i.test(d)) return `Tracke an ${d.match(/\d+/)?.[0] ?? ''} Tagen deine Ernährung.`;
  return d;
}

function fmtUnlocked(ts) {
  try {
    return 'am ' + new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(ts * 1000));
  } catch { return ''; }
}

function labelFor(reason) {
  if (reason === 'checkin') return '🔥 Check-in';
  if (reason === 'workout') return '🏋️ Workout';
  if (reason === 'nutrition') return '🥗 Ernährung getrackt';
  if (reason === 'streak_bonus') return '⚡ Streak-Bonus';
  if (reason.startsWith('metric:')) return '📏 ' + reason.slice(7) + ' erfasst';
  if (reason.startsWith('tracker:')) return '📊 ' + reason.slice(8);
  if (reason.startsWith('achievement:')) return '🏆 Erfolg freigeschaltet';
  return reason;
}
