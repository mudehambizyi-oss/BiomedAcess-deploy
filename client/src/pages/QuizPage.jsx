import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';

export default function QuizPage() {
  const { id } = useParams();
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api(`/topics/${id}/quiz`).then(setQuiz).catch((e) => setError(e.message));
  }, [id]);

  async function submit(e) {
    e.preventDefault();
    if (!quiz) return;
    if (Object.keys(answers).length < quiz.questions.length) {
      if (!window.confirm('Some questions are unanswered. Submit anyway?')) return;
    }
    setBusy(true); setError('');
    try {
      const r = await api(`/quizzes/${quiz.id}/attempt`, { method: 'POST', body: { answers } });
      setResult(r);
      window.scrollTo(0, 0);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  if (error && !quiz) return <div className="container"><div className="alert error">{error}</div></div>;
  if (!quiz) return <div className="container"><p className="muted">Loading quiz...</p></div>;

  if (result) {
    return (
      <div className="container">
        <div className="card result-card">
          <div className="score-ring">{result.percent}%</div>
          <h2>{result.score} of {result.total} correct</h2>
          <p className="muted">{result.percent >= 70 ? 'Nice work. You are above the 70% passing mark.' : 'Below the 70% mark. Review the explanations and try again.'}</p>
          <div className="row" style={{ justifyContent: 'center' }}>
            <button className="btn" onClick={() => { setResult(null); setAnswers({}); }}>Retake quiz</button>
            <Link to={`/topics/${id}`} className="btn light">Back to topic</Link>
            <Link to="/analytics" className="btn light">View analytics</Link>
          </div>
        </div>
        {result.details.map((d, i) => (
          <div key={d.question_id} className={`card q-review ${d.is_correct ? 'ok' : 'bad'}`}>
            <div><strong>Q{i + 1}. {d.prompt}</strong></div>
            <div className="small">Your answer: {d.selected_index == null ? 'not answered' : d.options[d.selected_index]}</div>
            {!d.is_correct && <div className="small">Correct answer: {d.options[d.correct_index]}</div>}
            {d.explanation && <div className="small muted">{d.explanation}</div>}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="container">
      <div className="breadcrumb"><Link to={`/topics/${id}`}>Back to topic</Link></div>
      <div className="page-head"><div><h1>{quiz.title}</h1><p className="muted">{quiz.topic.title} · {quiz.questions.length} questions · {Object.keys(answers).length} answered</p></div></div>
      {error && <div className="alert error">{error}</div>}
      <form onSubmit={submit}>
        {quiz.questions.map((q, i) => (
          <div key={q.id} className="card question">
            <div><strong>{i + 1}. {q.prompt}</strong></div>
            {q.options.map((opt, oi) => (
              <label key={oi} className={`option ${answers[q.id] === oi ? 'selected' : ''}`}>
                <input type="radio" name={`q${q.id}`} checked={answers[q.id] === oi} onChange={() => setAnswers({ ...answers, [q.id]: oi })} />
                {opt}
              </label>
            ))}
          </div>
        ))}
        <button className="btn teal" disabled={busy}>{busy ? 'Grading...' : 'Submit answers'}</button>
      </form>
    </div>
  );
}
