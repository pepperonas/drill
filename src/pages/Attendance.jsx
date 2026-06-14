import { useEffect, useState, useCallback } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { useToast } from '../components/Toast.jsx';
import { addDays, fmtDayLong, CHECKIN_KINDS } from '../lib/util.js';

export default function Attendance() {
  const { today } = useAuth();
  const toast = useToast();
  const [map, setMap] = useState({});       // day -> checkin
  const [busy, setBusy] = useState(false);
  const [custom, setCustom] = useState([]); // user-defined activity types

  const from = addDays(today, -118);        // ~17 weeks for the heatmap
  const load = useCallback(async () => {
    const [{ checkins }, opt] = await Promise.all([
      api.checkins(from), api.options('activity').catch(() => ({ options: [] })),
    ]);
    setMap(Object.fromEntries(checkins.map((c) => [c.day, c])));
    setCustom(opt.options || []);
  }, [from]);
  useEffect(() => { load(); }, [load]);

  // Built-in + user-defined activity types (custom kind === label).
  const kinds = [
    ...CHECKIN_KINDS,
    ...custom.map((o) => ({ kind: o.label, label: o.label, icon: o.icon || '⭐' })),
  ];
  const addActivity = async () => {
    const label = prompt('Neue Aktivität (z. B. Schwimmen):');
    if (!label || !label.trim()) return;
    const icon = prompt('Symbol (Emoji, optional):') || '⭐';
    await api.addOption('activity', { label: label.trim(), icon });
    await load();
  };

  const check = async (kind) => {
    setBusy(true);
    try {
      const res = await api.checkin({ day: today, kind });
      if (res.isNew) toast.show('🔥 Eingecheckt! Serie: ' + res.gami.streak);
      toast.celebrate(res.gami, res.leveled);
      await load();
    } finally { setBusy(false); }
  };
  const uncheck = async () => {
    setBusy(true);
    try { await api.uncheck(today); toast.show('Check-in entfernt'); await load(); }
    finally { setBusy(false); }
  };

  const todays = map[today];

  return (
    <div>
      <h1 className="headline" style={{ margin: '4px 4px 16px' }}>Anwesenheit</h1>

      <div className="card">
        <div className="label" style={{ marginBottom: 10 }}>{fmtDayLong(today)}</div>
        {todays ? (
          <div>
            <div className="title" style={{ marginBottom: 12 }}>
              {(kinds.find((k) => k.kind === todays.kind)?.icon) || '✅'} Heute eingecheckt{todays.kind ? ` · ${kinds.find((k) => k.kind === todays.kind)?.label || todays.kind}` : ''}
            </div>
            <button className="btn outline" disabled={busy} onClick={uncheck}>Rückgängig</button>
          </div>
        ) : (
          <>
            <div className="body" style={{ marginBottom: 12 }}>Was hast du heute gemacht?</div>
            <div className="grid cols-2">
              {kinds.map((k) => (
                <button key={k.kind} className="btn tonal" disabled={busy} onClick={() => check(k.kind)} style={{ padding: '16px', justifyContent: 'flex-start', gap: 10 }}>
                  <span style={{ fontSize: '1.3rem' }}>{k.icon}</span> {k.label}
                </button>
              ))}
              <button className="btn outline" onClick={addActivity} style={{ padding: '16px', justifyContent: 'flex-start', gap: 10 }}>
                <span style={{ fontSize: '1.3rem' }}>＋</span> Eigene
              </button>
            </div>
          </>
        )}
      </div>

      <div className="section-title"><span className="title">Letzte 17 Wochen</span></div>
      <div className="card">
        <Heatmap map={map} today={today} from={from} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, justifyContent: 'flex-end', fontSize: '.72rem', color: 'var(--on-surface-variant)' }}>
          weniger
          <span className="hm-cell" /><span className="hm-cell l1" /><span className="hm-cell l2" /><span className="hm-cell l3" />
          mehr
        </div>
      </div>
    </div>
  );
}

function Heatmap({ map, today, from }) {
  // Build columns of 7 days (Mon..Sun) from `from` to today.
  const cells = [];
  let cur = from;
  while (cur <= today) { cells.push(cur); cur = addDays(cur, 1); }
  return (
    <div className="heatmap">
      {cells.map((day) => {
        const c = map[day];
        const cls = c ? (c.kind === 'rest' ? 'l1' : c.kind === 'home' ? 'l2' : 'l3') : '';
        return <div key={day} className={'hm-cell ' + cls} title={day + (c ? ' · ' + c.kind : '')} />;
      })}
    </div>
  );
}
