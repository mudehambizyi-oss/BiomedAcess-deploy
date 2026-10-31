import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { formatPrice } from '../components/CourseCard.jsx';

export default function Practice() {
  const [courses, setCourses] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api('/courses').then(setCourses).catch((e) => setError(e.message)); }, []);
  const available = useMemo(() => (courses || []).filter((c) => (c.quiz_count || 0) + (c.exam_count || 0) > 0), [courses]);
  return <main className="container">
    <div className="page-head"><div><p className="tagline">Test what you know</p><h1>Quizzes &amp; exams</h1><p className="muted">Choose a course to find its topic quizzes and available exams.</p></div></div>
    {error && <div className="alert error">{error}</div>}
    {!courses && !error && <p className="muted">Loading practice options...</p>}
    {courses && !available.length && <div className="card empty">Practice activities will appear here as they are added to courses.</div>}
    <div className="grid cols-3">{available.map((c) => <article className="card stack" key={c.id}>
      <span className="badge">{c.level}</span><h2>{c.title}</h2>
      <p className="muted">{c.quiz_count} topic quizzes · {c.exam_count} exams</p>
      <Link className="btn teal" to={`/courses/${c.id}`}>Open course practice</Link>
      {c.is_paid && <p className="small muted">Course price: {formatPrice(c.price_cents, c.currency)}</p>}
    </article>)}</div>
  </main>;
}
