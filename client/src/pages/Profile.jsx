import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

export default function Profile() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api('/profile').then(setData).catch((e) => setError(e.message)); }, []);
  if (error) return <div className="container"><div className="alert error">{error}</div></div>;
  if (!data) return <div className="container"><p className="muted">Loading profile...</p></div>;
  return (
    <div className="container">
      <div className="page-head"><div><h1>{data.user.name}</h1><p className="muted">{data.user.email} · {data.user.role === 'admin' ? 'Instructor' : 'Student'}</p></div></div>

      <section className="card">
        <h2>Enrolled courses</h2>
        {data.courses.length === 0 && <div className="small muted">No enrollments yet.</div>}
        {data.courses.map((c) => (
          <Link key={c.id} to={`/courses/${c.id}`} className="course-line">
            <div style={{ flex: 1 }}>
              <strong>{c.title}</strong> <span className="badge">{c.level}</span>
              <div className="progress"><span style={{ width: `${c.progress.percent}%` }} /></div>
            </div>
            <span className="small">{c.progress.done}/{c.progress.total} subtopics</span>
          </Link>
        ))}
      </section>

      <section className="card mt">
        <h2>Achievements</h2>
        <div className="grid cols-3">
          {data.achievements.map((a) => (
            <div key={a.id} className={`achievement ${a.earned ? 'earned' : ''}`}>
              <div className="ach-icon">{a.earned ? '★' : '☆'}</div>
              <div><strong>{a.title}</strong><div className="small muted">{a.description}</div></div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
