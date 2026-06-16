import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './auth/AuthContext.jsx';
import { useScrollRestoration } from './lib/useScrollRestoration.js';
import { TopBar } from './components/TopBar.jsx';
import { NavBar } from './components/NavBar.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Trackers from './pages/Trackers.jsx';
import TrackerDetail from './pages/TrackerDetail.jsx';
import Insights from './pages/Insights.jsx';
import Stats from './pages/Stats.jsx';
import Training from './pages/Training.jsx';
import Nutrition from './pages/Nutrition.jsx';
import Attendance from './pages/Attendance.jsx';
import Achievements from './pages/Achievements.jsx';
import Settings from './pages/Settings.jsx';

export default function App() {
  const { loading, user } = useAuth();
  const loc = useLocation();
  const nav = useNavigate();
  const navType = useScrollRestoration();

  if (loading) {
    return (
      <div className="app">
        <div className="topbar"><span className="brand">drill<span className="brand-dot">.</span></span></div>
        <div className="grid" style={{ marginTop: 12 }}>
          <div className="skeleton" style={{ height: 120 }} />
          <div className="grid cols-3"><div className="skeleton" style={{ height: 90 }} /><div className="skeleton" style={{ height: 90 }} /><div className="skeleton" style={{ height: 90 }} /></div>
          <div className="skeleton" style={{ height: 220 }} />
        </div>
      </div>
    );
  }

  if (!user) return <Login />;

  return (
    <div className="app">
      <TopBar />
      <div className={'page' + (navType !== 'POP' ? ' page-anim' : '')} key={loc.pathname}>
      <Routes location={loc}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/trackers" element={<Trackers />} />
        <Route path="/trackers/:id" element={<TrackerDetail />} />
        <Route path="/insights" element={<Insights />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="/training" element={<Training />} />
        <Route path="/nutrition" element={<Nutrition />} />
        <Route path="/attendance" element={<Attendance />} />
        <Route path="/achievements" element={<Achievements />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </div>
      <NavBar current={loc.pathname} onNavigate={(p) => nav(p)} />
    </div>
  );
}
