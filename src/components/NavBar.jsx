const ITEMS = [
  { path: '/', icon: '🏠', label: 'Start' },
  { path: '/attendance', icon: '🔥', label: 'Streak' },
  { path: '/training', icon: '🏋️', label: 'Training' },
  { path: '/body', icon: '📏', label: 'Körper' },
  { path: '/nutrition', icon: '🥗', label: 'Ernährung' },
  { path: '/achievements', icon: '🏆', label: 'Erfolge' },
];

export function NavBar({ current, onNavigate }) {
  return (
    <nav className="navbar">
      <div className="navbar-inner">
        {ITEMS.map((it) => {
          const active = current === it.path;
          return (
            <button key={it.path} className={'nav-item' + (active ? ' active' : '')} onClick={() => onNavigate(it.path)}>
              <span className="ic">{it.icon}</span>
              <span>{it.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
