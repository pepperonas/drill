import { loginUrl } from '../api/client.js';

export default function Login() {
  const err = new URLSearchParams(location.search).get('auth_error');
  return (
    <div className="app" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', paddingBottom: 40 }}>
      <div className="topbar"><span className="brand">drill<span className="brand-dot">.</span></span></div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 28, padding: '8px 4px' }}>
        <div>
          <div className="display">
            Train.<br />Track.<br /><span style={{ color: 'var(--primary)' }}>Transform.</span>
          </div>
          <p className="body" style={{ fontSize: '1.05rem', marginTop: 16, maxWidth: 420 }}>
            Tracke Training, Körper & Ernährung – flexibel, mit Charts, Streaks und Erfolgen.
            drill hält dich dran, bis Bewegung zur Gewohnheit wird.
          </p>
        </div>

        <div className="grid cols-3">
          {[['🔥', 'Streaks'], ['📈', 'Charts'], ['🏆', 'Erfolge']].map(([e, t]) => (
            <div className="tile" key={t} style={{ alignItems: 'center', textAlign: 'center' }}>
              <span style={{ fontSize: '1.9rem' }}>{e}</span>
              <span className="k">{t}</span>
            </div>
          ))}
        </div>

        {err && (
          <div className="card" style={{ background: 'var(--error-container)', color: 'var(--on-error-container)', borderColor: 'transparent' }}>
            Anmeldung fehlgeschlagen: {err}
          </div>
        )}

        <a className="btn filled block" href={loginUrl()} style={{ padding: '16px 22px', fontSize: '1.05rem' }}>
          <GoogleG /> Mit Google anmelden
        </a>
        <p className="body" style={{ fontSize: '.8rem', textAlign: 'center' }}>
          Mit der Anmeldung stimmst du der Verarbeitung deiner Trainingsdaten zu.
          Du kannst sie jederzeit exportieren oder dein Konto löschen.
        </p>
      </div>
    </div>
  );
}

function GoogleG() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.1-11.3-7.6l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.6l6.2 5.2C39.9 36.5 44 31 44 24c0-1.3-.1-2.3-.4-3.5z" />
    </svg>
  );
}
