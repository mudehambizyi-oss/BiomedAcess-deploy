import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function Analytics() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api('/analytics/quizzes').then(setData).catch((e) => setError(e.message)); }, []);
  if (error) return <div className="container"><div className="alert error">{error}</div></div>;
  if (!data) return <div className="container"><p className="muted">Loading analytics...</p></div>;
  return (
    <div className="container">
      <div className="page-head"><div><h1>Quiz analytics</h1><p className="muted">Accuracy across every question you have answered.</p></div></div>
      <div className="grid cols-3">
        <div className="card stat"><div className="stat-value">{data.overall.accuracy == null ? '-' : `${data.overall.accuracy}%`}</div><div className="small muted">Overall accuracy</div></div>
        <div className="card stat"><div className="stat-value">{data.overall.attempted}</div><div className="small muted">Questions answered</div></div>
        <div className="card stat"><div className="stat-value">{data.recent_attempts.length}</div><div className="small muted">Attempts (recent)</div></div>
      </div>

      <section className="card mt">
        <h2>Per-topic accuracy</h2>
        {data.per_topic.length === 0 && <div className="small muted">Submit a quiz to see your topic accuracy.</div>}
        {data.per_topic.map((t) => (
          <div key={t.topic_id} className="course-line">
            <div style={{ flex: 1 }}>
              <strong>{t.topic_title}</strong> <span className="small muted">{t.course_title}</span>
              <div className="progress"><span style={{ width: `${t.accuracy}%`, background: t.accuracy < 70 ? 'var(--warn)' : undefined }} /></div>
            </div>
            <span className="small">{t.accuracy}% ({t.correct}/{t.attempted})</span>
          </div>
        ))}
      </section>

      <section className="card mt">
        <h2>Weak areas</h2>
        {data.weak_areas.length === 0 && <div className="small muted">No weak areas flagged.</div>}
        {data.weak_areas.map((w) => <div key={w.topic_id} className="course-line"><strong>{w.topic_title}</strong><span className="badge warn">{w.accuracy}%</span></div>)}
      </section>

      <section className="card mt">
        <h2>Score history</h2>
        {data.recent_attempts.length === 0 && <div className="small muted">No attempts yet.</div>}
        <table className="table">
          <thead><tr><th>Quiz</th><th>Topic</th><th>Score</th><th>Date</th></tr></thead>
          <tbody>
            {data.recent_attempts.map((a) => (
              <tr key={a.id}><td>{a.quiz_title}</td><td>{a.topic_title}</td><td>{a.score}/{a.total} ({a.percent}%)</td><td className="small muted">{new Date(a.created_at + 'Z').toLocaleString()}</td></tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
