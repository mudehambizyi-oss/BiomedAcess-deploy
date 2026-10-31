import React, { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { api, downloadResource, downloadSubtopicPdf, downloadTopicPdf } from '../api.js';
import RichText from '../components/RichText.jsx';

function Comments({ resourceId }) {
  const [list, setList] = useState([]);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const load = () => api(`/resources/${resourceId}/comments`).then(setList).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [resourceId]);
  async function post(e) {
    e.preventDefault();
    if (!text.trim()) return;
    try {
      await api(`/resources/${resourceId}/comments`, { method: 'POST', body: { body: text } });
      setText(''); load();
    } catch (err) { setError(err.message); }
  }
  return (
    <div className="comments">
      <div className="small muted" style={{ fontWeight: 600 }}>Discussion</div>
      {error && <div className="alert error">{error}</div>}
      <form onSubmit={post} className="comment-form">
        <input className="input" placeholder="Ask a question or share a note" value={text} maxLength={2000} onChange={(e) => setText(e.target.value)} />
        <button className="btn small">Post</button>
      </form>
      {list.map((c) => (
        <div key={c.id} className="comment">
          <div className="small"><strong>{c.author}</strong> {c.author_role === 'admin' && <span className="badge teal">Instructor</span>} <span className="muted">{new Date(c.created_at + (c.created_at.endsWith('Z') ? '' : 'Z')).toLocaleString()}</span></div>
          <div>{c.body}</div>
        </div>
      ))}
      {list.length === 0 && <div className="small muted">No comments yet.</div>}
    </div>
  );
}

// Reader: one subtopic at a time, full text on the page, prev/next across the whole course.
// Route: /topics/:id/sub/:subId (and /topics/:id, which opens the first subtopic).
export default function TopicPage() {
  const { id, subId } = useParams();
  const [topic, setTopic] = useState(null);
  const [course, setCourse] = useState(null);
  const [error, setError] = useState('');
  const [dlError, setDlError] = useState('');
  const [openComments, setOpenComments] = useState({});

  async function refresh() {
    try {
      const t = await api(`/topics/${id}`);
      setTopic(t);
      const c = await api(`/courses/${t.course.id}`);
      setCourse(c);
    } catch (e) { setError(e.message); }
  }
  useEffect(() => { setTopic(null); setCourse(null); setError(''); setDlError(''); refresh(); }, [id]);

  async function toggle(sub) {
    try {
      if (sub.completed) await api(`/subtopics/${sub.id}/complete`, { method: 'DELETE' });
      else await api(`/subtopics/${sub.id}/complete`, { method: 'POST' });
      refresh();
    } catch (e) { setError(e.message); }
  }

  function download(fn) {
    setDlError('');
    fn().catch((e) => setDlError(e.message));
  }

  if (error) return <div className="container"><div className="alert error">{error}</div><Link to="/dashboard">Back to dashboard</Link></div>;
  // Guard against showing the previous topic while the new one loads.
  const current = topic && String(topic.id) === String(id) ? topic : null;
  if (!current) return <div className="container"><p className="muted">Loading...</p></div>;

  if (current.subtopics.length === 0) {
    return (
      <div className="container">
        <div className="breadcrumb"><Link to="/courses">Courses</Link> / <Link to={`/courses/${current.course.id}`}>{current.course.title}</Link> / {current.title}</div>
        <h1>{current.title}</h1>
        <p className="muted">{current.description}</p>
        <div className="empty">No subtopics have been added to this topic yet.</div>
      </div>
    );
  }

  const idx = current.subtopics.findIndex((s) => String(s.id) === String(subId));
  if (idx < 0) return <Navigate to={`/topics/${id}/sub/${current.subtopics[0].id}`} replace />;

  const sub = current.subtopics[idx];
  const isLastInTopic = idx === current.subtopics.length - 1;
  const flat = course ? course.topics.flatMap((t) => t.subtopics.map((s) => ({ ...s, topicId: t.id, topicTitle: t.title }))) : [];
  const pos = flat.findIndex((s) => String(s.id) === String(sub.id));
  const prev = pos > 0 ? flat[pos - 1] : null;
  const next = pos >= 0 && pos < flat.length - 1 ? flat[pos + 1] : null;
  const slug = (s) => `${s}`.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'subtopic';
  const readPos = pos >= 0 ? `Section ${pos + 1} of ${flat.length}` : '';

  return (
    <div className="container reader-page">
      <div className="breadcrumb"><Link to="/courses">Courses</Link> / <Link to={`/courses/${current.course.id}`}>{current.course.title}</Link> / <Link to={`/courses/${current.course.id}`}>Outline</Link> / {current.title}</div>

      <div className="reader-top">
        <div className="small muted">{current.title} · subtopic {idx + 1} of {current.subtopics.length}{readPos && ` · ${readPos} in course`}</div>
        <div className="reader-top-actions">
          {current.quiz && <Link to={`/topics/${id}/quiz`} className="btn small teal">Take quiz ({current.quiz.question_count})</Link>}
        </div>
      </div>

      <article className="reader">
        <h1 className="reader-title">{sub.title}</h1>
        <div className="reader-body"><RichText text={sub.body || 'This section has no text yet.'} /></div>
      </article>

      <div className="reader-foot card">
        <div className="reader-foot-row">
          <button className={`btn small ${sub.completed ? 'light' : ''}`} onClick={() => toggle(sub)}>{sub.completed ? 'Completed ✓ (undo)' : 'Mark complete'}</button>
          <button className="btn small light" onClick={() => download(() => downloadSubtopicPdf(sub.id, `${slug(current.course.title)}_${slug(sub.title)}.pdf`))}>Download this section (PDF)</button>
          {isLastInTopic && <button className="btn small light" onClick={() => download(() => downloadTopicPdf(current.id, `${slug(current.title)}.pdf`))}>Download whole topic (PDF)</button>}
        </div>
        {dlError && <div className="alert error mt">{dlError}</div>}
        <div className="reader-nav">
          {prev ? (
            <Link to={`/topics/${prev.topicId}/sub/${prev.id}`} className="reader-nav-btn prev">
              <span className="small muted">← Previous</span>
              <strong>{prev.title}</strong>
            </Link>
          ) : <span />}
          {next ? (
            <Link to={`/topics/${next.topicId}/sub/${next.id}`} className="reader-nav-btn next">
              <span className="small muted">Next →</span>
              <strong>{next.title}</strong>
            </Link>
          ) : <span />}
        </div>
      </div>

      <details className="card reader-extras">
        <summary><strong>Resources and discussion for this section</strong></summary>
        {sub.resources.length === 0 && <div className="small muted mt">No resources uploaded yet.</div>}
        {sub.resources.map((r) => (
          <div key={r.id} className="resource">
            <div>
              <div><strong>{r.title}</strong> <span className="badge">{r.kind}</span></div>
              <div className="small muted">{r.original_name} · {(r.size / 1024).toFixed(0)} KB</div>
            </div>
            <div className="row">
              <button className="btn small light" onClick={() => downloadResource(r.id, r.original_name).catch((e) => setDlError(e.message))}>Download</button>
              <button className="btn small light" onClick={() => setOpenComments((o) => ({ ...o, [r.id]: !o[r.id] }))}>Comments ({r.comment_count})</button>
            </div>
            {openComments[r.id] && <Comments resourceId={r.id} />}
          </div>
        ))}
      </details>

      <div className="small muted reader-back"><Link to={`/courses/${current.course.id}`}>Back to course outline</Link></div>
    </div>
  );
}
