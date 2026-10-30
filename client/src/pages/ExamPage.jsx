import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';

// In-app exam: students answer each question, submit once, and see their score.
// Questions come from GET /api/exams/:id (no correct answers for students). React renders the text as plain text.
export default function ExamPage() {
  const { id } = useParams();
  const [exam, setExam] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());

  // Live countdown while the exam is open: ticks every second until the end time.
  useEffect(() => {
    if (!exam?.closes_at || exam.closed) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [exam?.closes_at, exam?.closed]);

  useEffect(() => {
    setExam(null); setResult(null); setAnswers({}); setError('');
    api(`/exams/${id}`).then(setExam).catch((e) => setError(e.message));
  }, [id]);

  async function submit(e) {
    e.preventDefault();
    if (!exam) return;
    const unanswered = exam.questions.filter((q) => answers[q.id] === undefined).length;
    if (unanswered > 0 && !window.confirm(`${unanswered} question(s) are unanswered. Submit anyway?`)) return;
    setBusy(true); setError('');
    try {
      const r = await api(`/exams/${exam.id}/submit`, { method: 'POST', body: { answers } });
      setResult(r);
      window.scrollTo(0, 0);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  if (error && !exam) return <div className="container"><div className="alert error">{error}</div></div>;
  if (!exam) return <div className="container"><p className="muted">Loading exam...</p></div>;

  if (!exam.open) {
    return (
      <div className="container">
        <div className="card">
          <h2>{exam.title}</h2>
          <p className="muted">{exam.locked_message || 'This exam is locked. Ask your tutor to open it.'}</p>
          <Link to={`/courses/${exam.course_id}`} className="btn light">Back to course</Link>
        </div>
      </div>
    );
  }

  const msLeft = exam?.closes_at && !exam.closed ? new Date(exam.closes_at).getTime() - now : null;
  const closed = !!exam?.closed || (msLeft !== null && msLeft <= 0);
  function fmt(ms) {
    const t = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), sec = t % 60;
    return (h ? `${h}h ` : '') + `${m}m ${sec}s`;
  }

  if (closed && !result && exam.questions?.length) {
    return (
      <div className="container">
        <div className="card">
          <h2>{exam.title}</h2>
          <p className="muted">This exam has closed. Submissions are no longer accepted.</p>
          <Link to={`/courses/${exam.course_id}`} className="btn light">Back to course</Link>
        </div>
      </div>
    );
  }

  if (result) {
    return (
      <div className="container">
        <div className="card result-card">
          <div className="score-ring">{result.percent == null ? '-' : `${result.percent}%`}</div>
          <h2>{result.score} of {result.total} correct</h2>
          {result.unmarked > 0 && <p className="small muted">{result.unmarked} question(s) have no answer marked yet, so they were not scored.</p>}
          <div className="row" style={{ justifyContent: 'center' }}>
            <button className="btn" onClick={() => { setResult(null); setAnswers({}); window.scrollTo(0, 0); }}>Retake exam</button>
            <Link to={`/courses/${exam.course_id}`} className="btn light">Back to course</Link>
          </div>
        </div>
        {result.details.map((d, i) => (
          <div key={d.question_id} className={`card q-review ${d.is_correct === true ? 'ok' : d.is_correct === false ? 'bad' : ''}`}>
            <div><strong>Q{i + 1}. {d.prompt}</strong></div>
            <div className="small">Your answer: {d.selected_index == null ? 'not answered' : d.options[d.selected_index]}</div>
            {d.correct_index != null && !d.is_correct && <div className="small">Correct answer: {d.options[d.correct_index]}</div>}
            {d.correct_index == null && <div className="small muted">No answer marked yet. Not scored.</div>}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="container">
      <Link to={`/courses/${exam.course_id}`} className="small muted">Back to course</Link>
      <h1>{exam.title}</h1>
      {msLeft !== null && !closed && (
        <div className="alert" style={{ background: msLeft < 5 * 60 * 1000 ? '#fde8e8' : undefined, fontWeight: 600 }}>
          Time left: {fmt(msLeft)}
        </div>
      )}
      {exam.closes_at && closed && <div className="alert error">This exam has closed.</div>}
      {exam.body && <p className="muted" style={{ whiteSpace: 'pre-wrap' }}>{exam.body}</p>}
      {(!exam.questions || exam.questions.length === 0) && <div className="alert error">This exam has no in-app questions.</div>}
      <form onSubmit={submit}>
        {(exam.questions || []).map((q, i) => (
          <div key={q.id} className="card q-card">
            <div><strong>Q{i + 1}. {q.prompt}</strong></div>
            <div className="mt">
              {q.options.map((o, oi) => (
                <label key={oi} className="small" style={{ display: 'block', margin: '4px 0', cursor: 'pointer' }}>
                  <input type="radio" name={`q${q.id}`} checked={answers[q.id] === oi} onChange={() => setAnswers((a) => ({ ...a, [q.id]: oi }))} />{' '}
                  {String.fromCharCode(65 + oi)}. {o}
                </label>
              ))}
            </div>
          </div>
        ))}
        {error && <div className="alert error mt">{error}</div>}
        {exam.questions?.length > 0 && (
          <button className="btn teal" type="submit" disabled={busy || closed}>{closed ? 'Exam closed' : busy ? 'Submitting...' : 'Submit exam'}</button>
        )}
      </form>
    </div>
  );
}
