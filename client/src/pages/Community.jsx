import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { BookmarkButton } from '../components/Features.jsx';

export function Communities() {
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const load = () => api('/communities').then(setList).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  async function toggle(c) {
    setError('');
    try {
      await api(`/communities/${c.id}/${c.joined ? 'leave' : 'join'}`, { method: c.joined ? 'DELETE' : 'POST' });
      load();
    } catch (e) { setError(e.message); }
  }

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <h1>Communities</h1>
          <p className="muted">Study circles for each discipline. Join one to start threads and reply.</p>
        </div>
      </div>
      {error && <div className="error">{error}</div>}
      {!list ? <p className="muted">Loading communities…</p> : (
        <div className="grid cols-2">
          {list.map((c) => (
            <div key={c.id} className="card community-card">
              <span className="badge">{c.tag}</span>
              {c.image_data && <img className="content-image" src={c.image_data} alt="" loading="lazy" />}
              <h3>{c.name}</h3>
              <p className="muted small">{c.description}</p>
              <div className="meta-row small muted">
                <span>{c.member_count} members</span>
                <span>{c.thread_count} threads</span>
              </div>
              <div className="card-actions">
                <Link to={`/communities/${c.id}`} className="btn ghost small">Open</Link>
                <button className={`btn small ${c.joined ? 'light' : 'teal'}`} onClick={() => toggle(c)}>
                  {c.joined ? 'Leave' : 'Join'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Live chat for a community: polls every 2.5s. Messages render as plain text (React escapes them).
export function CommunityChat({ communityId }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);
  const stickRef = useRef(true);

  useEffect(() => {
    let alive = true;
    const pull = () => api(`/communities/${communityId}/messages`)
      .then((rows) => { if (alive) { setMessages(rows); setError(''); } })
      .catch((e) => { if (alive) setError(e.message); });
    setMessages([]);
    pull();
    const timer = setInterval(pull, 2500);
    return () => { alive = false; clearInterval(timer); };
  }, [communityId]);

  useEffect(() => {
    const el = listRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  function onScroll() {
    const el = listRef.current;
    if (el) stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  }

  async function send(e) {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true); setError('');
    try {
      const row = await api(`/communities/${communityId}/messages`, { method: 'POST', body: { body } });
      stickRef.current = true;
      setText('');
      setMessages((m) => [...m.slice(-99), row]);
    } catch (err) { setError(err.message); }
    finally { setSending(false); }
  }

  function onKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(e); }
  }

  return (
    <section className="card chat-card">
      <h2>Live chat</h2>
      <p className="muted small">Last 100 messages. Updates every few seconds.</p>
      <div className="chat-list" ref={listRef} onScroll={onScroll}>
        {messages.length === 0 && <div className="muted small">No messages yet. Say hello.</div>}
        {messages.map((m) => (
          <div key={m.id} className="chat-msg">
            <div className="chat-meta small">
              <strong>{m.author}</strong> <span className="muted">· {new Date(m.created_at + 'Z').toLocaleString()}</span>
            </div>
            <div className="chat-body">{m.body}</div>
          </div>
        ))}
      </div>
      {error && <div className="error">{error}</div>}
      <form onSubmit={send} className="chat-form">
        <textarea className="input" rows={2} maxLength={1000} placeholder="Write a message (Enter to send, Shift+Enter for a new line)"
          value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKey} />
        <button className="btn teal" type="submit" disabled={sending || !text.trim()}>Send</button>
      </form>
    </section>
  );
}

export function CommunityThreads() {
  const { id } = useParams();
  const [community, setCommunity] = useState(null);
  const [threads, setThreads] = useState(null);
  const [form, setForm] = useState({ title: '', body: '' });
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = () => Promise.all([api(`/communities/${id}`), api(`/communities/${id}/threads`)])
    .then(([c, t]) => { setCommunity(c); setThreads(t); })
    .catch((e) => setError(e.message));
  useEffect(() => { load(); }, [id]);

  async function createThread(e) {
    e.preventDefault(); setError(''); setMsg('');
    try {
      await api(`/communities/${id}/threads`, { method: 'POST', body: form });
      setForm({ title: '', body: '' });
      setMsg('Thread posted.');
      load();
    } catch (err) { setError(err.message); }
  }

  if (error && !community) return <div className="container"><div className="error">{error}</div></div>;
  if (!community || !threads) return <div className="container"><p className="muted">Loading…</p></div>;

  return (
    <div className="container">
      <nav className="breadcrumb small"><Link to="/communities">Communities</Link> / {community.name}</nav>
      <div className="page-head">
        <div>
          <h1>{community.name}</h1>
          <p className="muted">{community.description}</p>
        </div>
      </div>
      {error && <div className="error">{error}</div>}
      {msg && <div className="info">{msg}</div>}
      <CommunityChat communityId={id} />
      <div className="split">
        <section>
          <h2>Threads</h2>
          {threads.length === 0 && <div className="empty card">No threads yet. Start the first one.</div>}
          {threads.map((t) => (
            <Link key={t.id} to={`/threads/${t.id}`} className="card thread-row">
              <h3>{t.title}</h3>
              <p className="muted small">by {t.author} · {t.reply_count} repl{t.reply_count === 1 ? 'y' : 'ies'}</p>
            </Link>
          ))}
        </section>
        <aside className="card">
          <h3>Start a thread</h3>
          <form onSubmit={createThread} className="stack">
            <label className="field">Title
              <input className="input" required maxLength={160} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </label>
            <label className="field">Details
              <textarea className="input" rows={5} maxLength={4000} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
            </label>
            <button className="btn teal" type="submit">Post thread</button>
            <p className="hint small">You need to join this community before you can post.</p>
          </form>
        </aside>
      </div>
    </div>
  );
}

export function ThreadView() {
  const { id } = useParams();
  const [thread, setThread] = useState(null);
  const [reply, setReply] = useState('');
  const [error, setError] = useState('');

  const load = () => api(`/threads/${id}`).then(setThread).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [id]);

  async function postReply(e) {
    e.preventDefault(); setError('');
    try {
      await api(`/threads/${id}/replies`, { method: 'POST', body: { body: reply } });
      setReply('');
      load();
    } catch (err) { setError(err.message); }
  }

  if (error && !thread) return <div className="container"><div className="error">{error}</div></div>;
  if (!thread) return <div className="container"><p className="muted">Loading…</p></div>;

  return (
    <div className="container narrow">
      <nav className="breadcrumb small">
        <Link to="/communities">Communities</Link> / <Link to={`/communities/${thread.community?.id}`}>{thread.community?.name}</Link>
      </nav>
      <article className="card thread-main">
        <h1>{thread.title}</h1>
        <p className="muted small">by {thread.author} · {new Date(thread.created_at + 'Z').toLocaleString()}</p>
        <div className="body-text">{thread.body}</div>
      </article>
      <h2>{thread.replies.length} repl{thread.replies.length === 1 ? 'y' : 'ies'}</h2>
      {thread.replies.map((r) => (
        <div key={r.id} className="card reply">
          <div className="reply-author small"><strong>{r.author}</strong> <span className="muted">· {new Date(r.created_at + 'Z').toLocaleString()}</span></div>
          <div className="body-text">{r.body}</div>
        </div>
      ))}
      <form onSubmit={postReply} className="card stack">
        <label className="field">Your reply
          <textarea className="input" rows={4} required maxLength={4000} value={reply} onChange={(e) => setReply(e.target.value)} />
        </label>
        {error && <div className="error">{error}</div>}
        <button className="btn teal" type="submit">Post reply</button>
      </form>
    </div>
  );
}

export function Cases() {
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api('/cases').then(setList).catch((e) => setError(e.message)); }, []);
  return (
    <div className="container">
      <div className="page-head">
        <div>
          <h1>Case studies</h1>
          <p className="muted">Work through a clinical case stage by stage: diagnosis, lab tests, treatment and explanation.</p>
        </div>
      </div>
      {error && <div className="error">{error}</div>}
      {!list ? <p className="muted">Loading cases…</p> : (
        <div className="grid cols-2">
          {list.map((c) => (
            <Link key={c.id} to={`/cases/${c.id}`} className="card case-card">
              {c.image_data && <img className="content-image" src={c.image_data} alt="" loading="lazy" />}
              <span className="badge">{c.specialty}</span>
              <h3>{c.title}</h3>
              <p className="muted small">{c.patient} · {c.question_count} questions</p>
              <p className="small">{c.my_best_percent == null ? 'Not attempted yet' : `Your best: ${c.my_best_percent}%`}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

const STAGE_LABEL = { diagnosis: 'Diagnosis', lab: 'Lab tests', treatment: 'Treatment', explanation: 'Explanation' };

export function CaseDetail() {
  const { id } = useParams();
  const [c, setCase] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]);

  useEffect(() => {
    api(`/cases/${id}`).then(setCase).catch((e) => setError(e.message));
    api(`/cases/${id}/history`).then(setHistory).catch(() => {});
  }, [id]);

  async function submit(e) {
    e.preventDefault(); setError('');
    try {
      const r = await api(`/cases/${id}/attempt`, { method: 'POST', body: { answers } });
      setResult(r);
      api(`/cases/${id}/history`).then(setHistory).catch(() => {});
    } catch (err) { setError(err.message); }
  }

  if (error && !c) return <div className="container"><div className="error">{error}</div></div>;
  if (!c) return <div className="container"><p className="muted">Loading case…</p></div>;

  const answered = c.questions.filter((q) => answers[q.id] !== undefined).length;

  return (
    <div className="container narrow">
      <nav className="breadcrumb small"><Link to="/cases">Case studies</Link> / {c.title}</nav>
      <article className="card case-head">
        {c.image_data && <img className="content-image" src={c.image_data} alt="" />}
        <span className="badge">{c.specialty}</span>
        <h1>{c.title} <BookmarkButton kind="case" id={c.id} /></h1>
        <p className="muted small">{c.patient}</p>
        <h3>Presentation</h3>
        <p className="body-text">{c.presentation}</p>
        {c.vitals && <div className="vitals small"><strong>Vitals:</strong> {c.vitals}</div>}
      </article>

      {!result ? (
        <form onSubmit={submit} className="stack">
          {c.questions.map((q, i) => (
            <fieldset key={q.id} className="card question">
              <legend className="small muted">{i + 1}. {STAGE_LABEL[q.stage] || q.stage}</legend>
              <p><strong>{q.prompt}</strong></p>
              {q.options.map((opt, oi) => (
                <label key={oi} className={`option ${answers[q.id] === oi ? 'selected' : ''}`}>
                  <input type="radio" name={`q${q.id}`} checked={answers[q.id] === oi} onChange={() => setAnswers({ ...answers, [q.id]: oi })} />
                  {opt}
                </label>
              ))}
            </fieldset>
          ))}
          {error && <div className="error">{error}</div>}
          <button className="btn teal" type="submit" disabled={answered < c.questions.length}>
            Submit answers ({answered}/{c.questions.length})
          </button>
        </form>
      ) : (
        <section className="stack">
          <div className="card result-card">
            <h2>Score: {result.score} / {result.total}</h2>
            <div className="stage-grid">
              {Object.entries(result.stages).map(([stage, s]) => (
                <div key={stage} className="stat"><span className="small muted">{STAGE_LABEL[stage] || stage}</span><strong>{s.correct}/{s.total}</strong></div>
              ))}
            </div>
          </div>
          {c.questions.map((q, i) => {
            const r = result.results.find((x) => x.question_id === q.id);
            return (
              <div key={q.id} className={`card question ${r?.is_correct ? 'ok' : 'miss'}`}>
                <div className="small muted">{i + 1}. {STAGE_LABEL[q.stage]} · {r?.is_correct ? 'Correct' : 'Incorrect'}</div>
                <p><strong>{q.prompt}</strong></p>
                <p className="small">Your answer: {r && r.selected_index != null ? q.options[r.selected_index] : 'not answered'}</p>
                <p className="small">Correct answer: {q.options[r.correct_index]}</p>
                {r?.explanation && <p className="small explanation">{r.explanation}</p>}
              </div>
            );
          })}
          <button className="btn ghost" onClick={() => { setResult(null); setAnswers({}); }}>Try again</button>
        </section>
      )}

      {history.length > 0 && (
        <section className="card">
          <h3>Previous attempts</h3>
          <ul className="plain">
            {history.map((h) => <li key={h.id} className="small">{h.score}/{h.total} · {new Date(h.created_at + 'Z').toLocaleString()}</li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
