import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { StreakCard, SavedSection, LabOfTheWeek } from '../components/Features.jsx';
import { CertificatesSection } from '../components/Certificates.jsx';
import Announcements from '../components/Announcements.jsx';

// Student dashboard: enrolled courses, progress, recent topics, weak areas, quiz scores, recommendations.
export default function Dashboard() {
  const [data, setData] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/dashboard').then(setData).catch((e) => setError(e.message));
    api('/analytics/quizzes').then(setAnalytics).catch(() => {});
  }, []);

  if (error) return <div className="container"><div className="error">{error}</div></div>;
  if (!data) return <div className="container"><p className="muted">Loading your dashboard…</p></div>;

  const s = data.summary;
  const pctOf = (c) => Math.min(100, Math.max(0, Math.round(c.progress?.percent ?? c.percent ?? 0)));
  return (
    <div className="container">
      <Announcements />
      <div className="page-head welcome-head">
        <div>
          <p className="tagline">Your dashboard</p>
          <h1>Welcome back, {(data.user.name || '').split(' ')[0] || 'there'}</h1>
          <p className="muted">Pick up where you left off or work on your weak areas. <Link to="/cases">Explore clinical cases</Link> · <Link to="/careers">Browse careers</Link></p>
        </div>
      </div>

      <div className="streak-banner">
        <StreakCard />
      </div>

      <div className="grid cols-4 stat-row">
        <div className="card stat"><span className="small muted">Enrolled courses</span><strong>{s.enrolled_courses}</strong></div>
        <div className="card stat"><span className="small muted">Topics completed</span><strong>{s.subtopics_completed}/{s.subtopics_total}</strong></div>
        <div className="card stat"><span className="small muted">Overall progress</span><strong>{s.overall_percent}%</strong></div>
        <div className="card stat"><span className="small muted">Quizzes taken</span><strong>{s.quizzes_taken}</strong></div>
      </div>

      <div className="split">
        <section>
          {data.for_track_courses?.length > 0 && <>
            <h2>For your track</h2>
            <div className="grid cols-2">
              {data.for_track_courses.map((c) => <Link key={c.id} to={`/courses/${c.id}`} className="card course-tile">{c.image_url && <img className="course-cover" src={c.image_url} alt={`${c.title} cover`} loading="lazy" />}<div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}><h3>{c.title}</h3><span className="badge">{c.track_targets?.length ? 'For your track' : 'All tracks'}</span></div><p className="small muted">{c.level}{c.discipline ? ` · ${c.discipline}` : ''}</p><p className="small">{c.description}</p></Link>)}
            </div>
          </>}
          {data.other_courses?.length > 0 && <>
            <h2>Other courses</h2>
            <div className="grid cols-2">{data.other_courses.map((c) => <Link key={c.id} to={`/courses/${c.id}`} className="card course-tile"><h3>{c.title}</h3><p className="small muted">{c.level}{c.discipline ? ` · ${c.discipline}` : ''}</p></Link>)}</div>
          </>}
          <h2>Your courses</h2>
          {data.courses.length === 0 && (
            <div className="empty card">You are not enrolled in any course yet. <Link to="/courses">Browse courses</Link>.</div>
          )}
          <div className="grid cols-2">
            {data.courses.map((c) => (
              <Link key={c.id} to={`/courses/${c.id}`} className="card course-tile">
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h3>{c.title}</h3>
                  {c.discipline && <span className="badge">{c.discipline}</span>}
                </div>
                <div className="progress" role="progressbar" aria-valuenow={pctOf(c)} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${pctOf(c)}%` }} /></div>
                <p className="small muted">{pctOf(c)}% complete</p>
              </Link>
            ))}
          </div>

          <CertificatesSection courses={data.courses} />

          <h2>Recently accessed</h2>
          {data.recent_topics.length === 0 ? (
            <p className="muted small">Topics you open will appear here.</p>
          ) : (
            <div className="card">
              <ul className="plain">
                {data.recent_topics.map((t) => (
                  <li key={t.id}><Link to={`/topics/${t.id}`}>{t.title}</Link> <span className="small muted">· {t.course_title}</span></li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <aside className="stack">
          <SavedSection />
          <LabOfTheWeek />
          <div className="card">
            <h3>Quiz scores</h3>
            <p className="small muted">Overall accuracy: {analytics?.overall?.accuracy != null ? `${analytics.overall.accuracy}%` : 'no quizzes yet'}</p>
            {analytics?.recent_attempts?.slice(0, 5).map((a, i) => (
              <div key={i} className="score-line small"><span>{a.topic_title || a.title || 'Quiz'}</span><strong>{a.score}/{a.total}</strong></div>
            ))}
          </div>
          <div className="card weak">
            <h3>Weak areas</h3>
            {analytics?.weak_areas?.length ? (
              <ul className="plain">
                {analytics.weak_areas.slice(0, 5).map((w) => (
                  <li key={w.topic_id || w.id}><Link to={`/topics/${w.topic_id || w.id}/quiz`}>{w.topic_title || w.title}</Link> <span className="small muted">{w.accuracy}%</span></li>
                ))}
              </ul>
            ) : <p className="small muted">Take a few quizzes and your weakest topics will show here.</p>}
          </div>
          <div className="card">
            <h3>Recommended</h3>
            <ul className="plain">
              {data.recommended_courses.slice(0, 4).map((c) => (
                <li key={c.id}><Link to={`/courses/${c.id}`}>{c.title}</Link> <span className="small muted">· {c.level}</span></li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
