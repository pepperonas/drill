import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

export function TopBar() {
  const { user } = useAuth();
  const nav = useNavigate();
  return (
    <div className="topbar">
      <span className="brand" onClick={() => nav('/')} style={{ cursor: 'pointer' }}>
        drill<span className="brand-dot">.</span>
      </span>
      <span className="spacer" />
      {user?.picture
        ? <img className="avatar" src={user.picture} alt={user.name} referrerPolicy="no-referrer" onClick={() => nav('/settings')} />
        : <button className="avatar" onClick={() => nav('/settings')} style={{ background: 'var(--primary-container)', color: 'var(--on-primary-container)', border: 'none', fontWeight: 800 }}>
            {(user?.name || '?').slice(0, 1).toUpperCase()}
          </button>}
    </div>
  );
}
