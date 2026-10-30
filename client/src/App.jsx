import React from 'react';
import { Routes, Route, Navigate, NavLink, Link, useLocation } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import { applyTheme, getStoredTheme, storeTheme } from './lib/theme.js';
import Landing from './pages/Landing.jsx';
import { Login, Signup } from './pages/Auth.jsx';
import Courses from './pages/Courses.jsx';
import CourseDetail from './pages/CourseDetail.jsx';
import TopicPage from './pages/TopicPage.jsx';
import ExamPage from './pages/ExamPage.jsx';
import QuizPage from './pages/QuizPage.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Profile from './pages/Profile.jsx';
import Analytics from './pages/Analytics.jsx';
import Admin from './pages/Admin.jsx';
import { Communities, CommunityThreads, ThreadView, Cases, CaseDetail } from './pages/Community.jsx';
import { PrivacyPage, TermsPage } from './pages/Legal.jsx';
import Contact from './pages/Contact.jsx';
import { SearchBar, SearchPage } from './components/Features.jsx';
import LiveChatWidget from './components/LiveChatWidget.jsx';

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="container"><p className="muted">Loading...</p></div>;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return children;
}

function RequireModerator({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!['moderator', 'tutor', 'admin'].includes(user.role)) return <div className="container"><div className="alert error">Content managers only.</div></div>;
  return children;
}

function RequireAdmin({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <div className="container"><div className="alert error">Admins only.</div></div>;
  return children;
}

function ThemeToggle() {
  // Telegram Mini App: auto-login with Telegram identity when opened inside Telegram.
  React.useEffect(() => {
    const tg = window.Telegram && window.Telegram.WebApp;
    if (!tg || !tg.initData || window.__tgLoginDone) return;
    window.__tgLoginDone = true;
    try { tg.expand(); tg.ready(); } catch {}
    fetch('/api/auth/telegram', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ initData: tg.initData }) })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d && d.token) { window.location.reload(); localStorage.setItem('biomedaccess_token', d.token); } })
      .catch(() => {});
  }, []);

  const [theme, setTheme] = React.useState(getStoredTheme);
  React.useEffect(() => {
    applyTheme(theme);
    storeTheme(theme);
  }, [theme]);
  const next = theme === 'light' ? 'dark' : 'light';
  return (
    <button
      type="button"
      className="btn light small theme-toggle"
      onClick={() => setTheme(next)}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
    >
      {theme === 'light' ? '\u263E' : '\u2600'}
    </button>
  );
}

function Nav() {
  const { user, logout } = useAuth();
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link to={user ? '/dashboard' : '/'} className="brand">
          <img src="/images/logo.jpg" alt="BiomedAccess" style={{ width: 34, height: 34, borderRadius: 8, objectFit: 'cover' }} /> BiomedAccess
        </Link>
        <nav className="nav">
          <NavLink to="/courses">Courses</NavLink>
          {user && <NavLink to={['admin', 'moderator', 'tutor'].includes(user.role) ? '/admin' : '/dashboard'}>{user.role === 'admin' ? 'Admin' : user.role === 'moderator' ? 'Moderator' : user.role === 'tutor' ? 'Tutor' : 'Dashboard'}</NavLink>}
          {user && <NavLink to="/communities">Communities</NavLink>}
          {user && <NavLink to="/cases">Case studies</NavLink>}
          {user && !['tutor'].includes(user.role) && <NavLink to="/analytics">Analytics</NavLink>}
          {user && <NavLink to="/profile">Profile</NavLink>}
          <span className="spacer" />
          <SearchBar />
          <ThemeToggle />
          {user ? (
            <>
              <span className="nav-user">{user.name}</span>
              <button className="btn light small" onClick={logout}>Log out</button>
            </>
          ) : (
            <>
              <NavLink to="/login">Log in</NavLink>
              <Link to="/signup" className="btn teal small">Sign up free</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

export default function App() {
  return (
    <>
      <Nav />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/courses" element={<Courses />} />
        <Route path="/courses/:id" element={<CourseDetail />} />
        <Route path="/topics/:id" element={<RequireAuth><TopicPage /></RequireAuth>} />
        <Route path="/topics/:id/sub/:subId" element={<RequireAuth><TopicPage /></RequireAuth>} />
        <Route path="/topics/:id/quiz" element={<RequireAuth><QuizPage /></RequireAuth>} />
        <Route path="/exams/:id" element={<RequireAuth><ExamPage /></RequireAuth>} />
        <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/communities" element={<RequireAuth><Communities /></RequireAuth>} />
        <Route path="/communities/:id" element={<RequireAuth><CommunityThreads /></RequireAuth>} />
        <Route path="/threads/:id" element={<RequireAuth><ThreadView /></RequireAuth>} />
        <Route path="/cases" element={<RequireAuth><Cases /></RequireAuth>} />
        <Route path="/cases/:id" element={<RequireAuth><CaseDetail /></RequireAuth>} />
        <Route path="/analytics" element={<RequireAuth><Analytics /></RequireAuth>} />
        <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
        <Route path="/admin" element={<RequireModerator><Admin /></RequireModerator>} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="*" element={<div className="container"><div className="empty"><h2>Page not found</h2><Link to="/">Back to home</Link></div></div>} />
      </Routes>
      <LiveChatWidget />
      {location.pathname !== '/' && (
      <footer className="footer">
        <div>© 2026 BiomedAccess. All rights reserved. Sample content for learning only, not medical advice.</div>
        <div className="footer-links">
          <Link to="/privacy">Privacy Policy</Link>
          <span aria-hidden="true"> · </span>
          <Link to="/terms">Terms of Service</Link>
          <span aria-hidden="true"> · </span>
          <Link to="/contact">Contact us</Link>
        </div>
      </footer>
      )}
    </>
  );
}
