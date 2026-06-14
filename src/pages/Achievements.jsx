import { useEffect, useState } from 'react';
import { api } from '../api/client.js';

export default function Achievements() {
  const [data, setData] = useState(null);
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
          <div key={a.code} className={'badge' + (a.unlocked ? '' : ' locked')}>
            <span className="emoji">{a.icon}</span>
            <span className="bn">{a.name}</span>
            <span className="bd">{a.desc}</span>
          </div>
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
    </div>
  );
}

function labelFor(reason) {
  if (reason === 'checkin') return '🔥 Check-in';
  if (reason === 'workout') return '🏋️ Workout';
  if (reason === 'nutrition') return '🥗 Ernährung getrackt';
  if (reason === 'streak_bonus') return '⚡ Streak-Bonus';
  if (reason.startsWith('metric:')) return '📏 ' + reason.slice(7) + ' erfasst';
  if (reason.startsWith('achievement:')) return '🏆 Erfolg freigeschaltet';
  return reason;
}
