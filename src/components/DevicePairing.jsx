import { useEffect, useState, useCallback, useRef } from 'react';
import { api } from '../api/client.js';
import { useToast } from './Toast.jsx';

/**
 * Pair the native "drill · go" Android app: the web mints a short-lived code the
 * user types into the app, which exchanges it for a device token. Also lists
 * paired devices with a revoke action.
 */
export function DevicePairing() {
  const toast = useToast();
  const [devices, setDevices] = useState([]);
  const [pair, setPair] = useState(null); // { code, expires_at }
  const [remaining, setRemaining] = useState(0);
  const [busy, setBusy] = useState(false);
  const tick = useRef(null);

  const loadDevices = useCallback(async () => {
    try { setDevices((await api.pairingDevices()).devices); } catch { /* ignore */ }
  }, []);
  useEffect(() => { loadDevices(); }, [loadDevices]);

  // Countdown for the active code.
  useEffect(() => {
    clearInterval(tick.current);
    if (!pair) return;
    const update = () => {
      const left = pair.expires_at - Math.floor(Date.now() / 1000);
      setRemaining(left);
      if (left <= 0) { setPair(null); clearInterval(tick.current); }
    };
    update();
    tick.current = setInterval(update, 1000);
    return () => clearInterval(tick.current);
  }, [pair]);

  const start = async () => {
    setBusy(true);
    try {
      const res = await api.pairingStart();
      setPair(res);
      loadDevices();
    } catch { toast.show('Konnte keinen Code erzeugen'); }
    finally { setBusy(false); }
  };

  const revoke = async (id) => {
    if (!confirm('Dieses Gerät entkoppeln? Die App muss danach neu gekoppelt werden.')) return;
    await api.revokeDevice(id);
    loadDevices();
  };

  const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <>
      <div className="section-title"><span className="title">Gerät koppeln</span></div>
      <div className="card">
        <div className="body" style={{ marginBottom: 14 }}>
          Verbinde die <strong>drill · go</strong> Android-App, um Spaziergänge, Läufe und
          Radtouren per GPS aufzuzeichnen. Tippe „Code erzeugen" und gib den Code in der App ein.
        </div>

        {pair ? (
          <div className="card" style={{ background: 'var(--primary-container)', color: 'var(--on-primary-container)', borderColor: 'transparent', textAlign: 'center', marginBottom: 12 }}>
            <div className="label" style={{ color: 'inherit', opacity: 0.8 }}>Kopplungscode</div>
            <div className="mono-num" style={{ fontSize: '2.6rem', fontWeight: 800, letterSpacing: '.18em', margin: '6px 0' }}>{pair.code}</div>
            <div className="body" style={{ color: 'inherit' }}>Gültig noch {mmss(Math.max(0, remaining))} min · in der App eingeben</div>
          </div>
        ) : (
          <button className="btn filled block" disabled={busy} onClick={start} style={{ marginBottom: 12 }}>
            🔗 Code erzeugen
          </button>
        )}

        {devices.length > 0 && (
          <>
            <div className="label" style={{ margin: '8px 0 6px' }}>Gekoppelte Geräte</div>
            {devices.map((d) => (
              <div className="list-item" key={d.id} style={{ alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 650 }}>📱 {d.name || 'Gerät'}</div>
                  <div className="body" style={{ fontSize: '.78rem' }}>
                    {d.last_seen_at ? `zuletzt aktiv ${new Date(d.last_seen_at * 1000).toLocaleDateString('de-DE')}` : 'noch nicht aktiv'}
                  </div>
                </div>
                <button className="btn text danger" style={{ padding: '6px 10px' }} onClick={() => revoke(d.id)}>Entkoppeln</button>
              </div>
            ))}
          </>
        )}
      </div>
    </>
  );
}
