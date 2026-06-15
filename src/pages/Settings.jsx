import { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { useToast } from '../components/Toast.jsx';
import { api } from '../api/client.js';
import { StreakFreezeSettings } from '../components/StreakFreezeSettings.jsx';
import { useTheme } from '../theme/ThemeContext.jsx';

export default function Settings() {
  const { user, prefs, emailEnabled, logout, refresh } = useAuth();
  const { theme, themes, setTheme } = useTheme();
  const toast = useToast();
  const [p, setP] = useState(prefs || { weekly: false, streak_alert: false, daily_nudge: false, confirmed: false });
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (prefs) setP(prefs); }, [prefs]);
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    if (q.get('confirmed')) toast.show('✅ E-Mails bestätigt!');
    if (q.get('unsubscribed')) toast.show('Abgemeldet.');
  }, [toast]);

  const savePrefs = async (next) => {
    setP(next);
    setSaving(true);
    try {
      const res = await api.setEmailPrefs(next);
      if (res.confirmationSent) toast.show('📧 Bestätigungs-Mail gesendet – bitte Postfach prüfen.', { duration: 4000 });
      await refresh();
    } catch { toast.show('Speichern fehlgeschlagen'); }
    finally { setSaving(false); }
  };

  const exportData = async () => {
    const data = await api.get('/export');
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'drill-export.json'; a.click();
    URL.revokeObjectURL(url);
  };

  const deleteAccount = async () => {
    if (!confirm('Konto und ALLE Daten unwiderruflich löschen?')) return;
    await api.deleteAccount();
    location.href = '/';
  };

  return (
    <div>
      <h1 className="headline" style={{ margin: '4px 4px 16px' }}>Einstellungen</h1>

      <div className="card">
        <div className="card-h">
          {user?.picture && <img className="avatar" src={user.picture} alt="" referrerPolicy="no-referrer" />}
          <div>
            <div className="title">{user?.name}</div>
            <div className="body">{user?.email}</div>
          </div>
        </div>
        <button className="btn outline" onClick={logout}>Abmelden</button>
      </div>

      <div className="section-title"><span className="title">Design</span></div>
      <div className="grid cols-2">
        {themes.map((t) => (
          <button key={t.id} onClick={() => setTheme(t.id)}
            style={{
              cursor: 'pointer', textAlign: 'left', padding: 14, borderRadius: 'var(--shape-lg)',
              background: t.surface, color: '#fff',
              border: theme === t.id ? `2.5px solid ${t.primary}` : '2px solid var(--outline-variant)',
              display: 'flex', flexDirection: 'column', gap: 12,
              boxShadow: theme === t.id ? `0 0 0 4px color-mix(in srgb, ${t.primary} 25%, transparent)` : 'none',
            }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: '.95rem' }}>{t.name}</span>
              {theme === t.id && <span style={{ color: t.primary, fontWeight: 800 }}>✓</span>}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <span style={{ width: 26, height: 26, borderRadius: '50%', background: t.primary }} />
              <span style={{ width: 26, height: 26, borderRadius: '50%', background: t.secondary }} />
              <span style={{ flex: 1, height: 26, borderRadius: 8, background: t.bg, border: '1px solid rgba(255,255,255,.12)' }} />
            </div>
          </button>
        ))}
      </div>

      <StreakFreezeSettings />

      <div className="section-title"><span className="title">Motivations-Mails</span></div>
      <div className="card">
        {!emailEnabled && <div className="body" style={{ marginBottom: 12 }}>E-Mail-Versand ist serverseitig nicht konfiguriert.</div>}
        {emailEnabled && !p.confirmed && (p.weekly || p.streak_alert || p.daily_nudge) && (
          <div className="card" style={{ background: 'var(--tertiary-container)', color: 'var(--on-tertiary-container)', borderColor: 'transparent', marginBottom: 12 }}>
            Bitte bestätige den Link in der E-Mail, damit wir dir schreiben dürfen.
          </div>
        )}
        <Toggle label="Wöchentliche Zusammenfassung" desc="Sonntags dein Fortschritts-Report." checked={p.weekly} disabled={!emailEnabled || saving} onChange={(v) => savePrefs({ ...p, weekly: v })} />
        <Toggle label="Streak-in-Gefahr-Alert" desc="Abends, wenn deine Serie zu reißen droht." checked={p.streak_alert} disabled={!emailEnabled || saving} onChange={(v) => savePrefs({ ...p, streak_alert: v })} />
        <Toggle label="Täglicher Nudge" desc="Kurze Motivation an Tagen ohne Check-in." checked={p.daily_nudge} disabled={!emailEnabled || saving} onChange={(v) => savePrefs({ ...p, daily_nudge: v })} />
      </div>

      <div className="section-title"><span className="title">Deine Daten</span></div>
      <div className="card">
        <button className="btn tonal block" style={{ marginBottom: 12 }} onClick={exportData}>📥 Daten exportieren (JSON)</button>
        <button className="btn danger block" onClick={deleteAccount}>Konto & alle Daten löschen</button>
      </div>

      <p className="body" style={{ textAlign: 'center', margin: '24px 0 8px', fontSize: '.78rem' }}>
        drill · train. track. transform.
      </p>
    </div>
  );
}

function Toggle({ label, desc, checked, disabled, onChange }) {
  return (
    <div className="list-item" style={{ alignItems: 'flex-start' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 650 }}>{label}</div>
        <div className="body" style={{ fontSize: '.82rem' }}>{desc}</div>
      </div>
      <button
        role="switch" aria-checked={checked} disabled={disabled}
        onClick={() => onChange(!checked)}
        style={{
          width: 52, height: 32, borderRadius: 999, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
          background: checked ? 'var(--primary)' : 'var(--surface-container-highest)',
          position: 'relative', transition: 'background .2s', flexShrink: 0, opacity: disabled ? 0.5 : 1,
        }}>
        <span style={{
          position: 'absolute', top: 4, left: checked ? 24 : 4, width: 24, height: 24, borderRadius: '50%',
          background: checked ? 'var(--on-primary)' : 'var(--outline)', transition: 'left .2s var(--ease-spatial)',
        }} />
      </button>
    </div>
  );
}
