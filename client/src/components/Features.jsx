import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

// Save / unsave a course or case study. Signed-out users are sent to log in.
export function BookmarkButton({ kind, id }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    api(`/bookmarks/${kind}/${id}`).then((r) => setSaved(!!r.saved)).catch(() => {});
  }, [kind, id, user?.id]);

  async function toggle() {
    if (!user) return navigate('/login', { state: { from: window.location.pathname } });
    setBusy(true); setError('');
    try {
      if (saved) {
        await api(`/bookmarks/${kind}/${id}`, { method: 'DELETE' });
        setSaved(false);
      } else {
        await api('/bookmarks', { method: 'POST', body: { kind, id } });
        setSaved(true);
      }
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  return (
    <span className="bookmark-wrap">
      <button type="button" className={`btn small ${saved ? 'teal' : 'light'}`} disabled={busy} onClick={toggle} aria-pressed={saved}>
        {busy ? '...' : saved ? 'Saved' : 'Save'}
      </button>
      {error && <span className="small bookmark-error">{error}</span>}
    </span>
  );
}

// Global search bar in the navbar: submits to /search?q=...
export function SearchBar() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  function submit(e) {
    e.preventDefault();
    const term = q.trim();
    if (term.length < 2) return;
    navigate(`/search?q=${encodeURIComponent(term)}`);
    setQ('');
  }
  return (
    <form className="search-bar" role="search" onSubmit={submit}>
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search courses, topics, cases" aria-label="Search" maxLength={100} />
    </form>
  );
}

// Search results page: /search?q=...
export function SearchPage() {
  const [params] = useSearchParams();
  const term = (params.get('q') || '').trim();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setData(null); setError('');
    if (term.length < 2) { setData({ courses: [], topics: [], cases: [] }); return; }
    api(`/search?q=${encodeURIComponent(term)}`).then(setData).catch((e) => setError(e.message));
  }, [term]);

  const none = data && !data.courses.length && !data.topics.length && !data.cases.length;
  return (
    <div className="container">
      <div className="page-head">
        <div>
          <h1>Search</h1>
          <p className="muted">{term ? <>Results for &ldquo;{term}&rdquo;</> : 'Type at least 2 characters in the search bar.'}</p>
        </div>
      </div>
      {error && <div className="alert error">{error}</div>}
      {!data && !error && term.length >= 2 && <p className="muted">Searching…</p>}
      {none && <div className="empty card">Nothing matched. Try a shorter word.</div>}
      {data && data.courses.length > 0 && (
        <section className="search-group">
          <h2>Courses</h2>
          {data.courses.map((c) => (
            <Link key={`c${c.id}`} to={`/courses/${c.id}`} className="card search-hit">
              <strong>{c.title}</strong> <span className="badge">{c.level}</span>
              <p className="small muted">{c.description}</p>
            </Link>
          ))}
        </section>
      )}
      {data && data.topics.length > 0 && (
        <section className="search-group">
          <h2>Topics</h2>
          {data.topics.map((t) => (
            <Link key={`t${t.id}`} to={user ? `/topics/${t.id}` : `/courses/${t.course_id}`} className="card search-hit">
              <strong>{t.title}</strong>
              <p className="small muted">{t.course_title}</p>
            </Link>
          ))}
        </section>
      )}
      {data && data.cases.length > 0 && (
        <section className="search-group">
          <h2>Case studies</h2>
          {data.cases.map((c) => (
            <Link key={`s${c.id}`} to={`/cases/${c.id}`} className="card search-hit">
              <strong>{c.title}</strong> <span className="badge">{c.specialty}</span>
            </Link>
          ))}
        </section>
      )}
      {data && !user && (
        <p className="small muted">Case studies are shown to signed-in users. <Link to="/login">Log in</Link> to search them.</p>
      )}
    </div>
  );
}

// Lab of the week card: one community per ISO week, same for everyone that week.
export function LabOfTheWeek() {
  const { user } = useAuth();
  const [lab, setLab] = useState(null);
  useEffect(() => {
    if (!user) return;
    api('/lab-of-the-week').then(setLab).catch(() => {});
  }, [user?.id]);
  if (!user || !lab) return null;
  const c = lab.community;
  return (
    <div className="card lab-card">
      <span className="badge teal">Lab of the week · {lab.label}</span>
      <h3>{c.name}</h3>
      <p className="small muted">{c.description}</p>
      <div className="meta-row small muted">
        <span>{c.member_count} members</span>
        <span>{c.thread_count} threads</span>
      </div>
      <Link to={`/communities/${c.id}`} className="btn small teal" style={{ marginTop: 10 }}>Visit this lab</Link>
    </div>
  );
}

// Saved items section on the dashboard
export function SavedSection() {
  const [saved, setSaved] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api('/bookmarks').then(setSaved).catch((e) => setError(e.message));
  }, []);
  if (error) return <div className="card"><p className="small muted">Saved items could not load.</p></div>;
  if (!saved) return null;
  const none = !saved.courses.length && !saved.cases.length;
  return (
    <div className="card">
      <h3>Saved</h3>
      {none && <p className="small muted">Tap Save on a course or case study to find it here.</p>}
      <ul className="plain">
        {saved.courses.map((c) => (
          <li key={`c${c.id}`}><Link to={`/courses/${c.id}`}>{c.title}</Link> <span className="small muted">· course</span></li>
        ))}
        {saved.cases.map((c) => (
          <li key={`s${c.id}`}><Link to={`/cases/${c.id}`}>{c.title}</Link> <span className="small muted">· case study</span></li>
        ))}
      </ul>
    </div>
  );
}

// Quiz streak card for the dashboard
export function StreakCard() {
  const [s, setS] = useState(null);
  useEffect(() => { api('/streak').then(setS).catch(() => {}); }, []);
  if (!s) return null;
  return (
    <div className="card streak-card">
      <h3>Daily streak</h3>
      <div className="streak-num"><strong>{s.current}</strong> <span className="small muted">day{s.current === 1 ? '' : 's'} in a row</span></div>
      <p className="small muted">
        {s.active_today ? 'You completed a quiz today.' : s.current > 0 ? 'Complete a quiz today to keep your streak.' : 'Complete a quiz today to start a streak.'}
        {' '}Best: {s.longest} day{s.longest === 1 ? '' : 's'}.
      </p>
    </div>
  );
}
