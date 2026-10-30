import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

// Admin: documents per course/topic, exams (PDF or question set) with lock/unlock and release time.
// React renders all dynamic text as plain text (no HTML injection).

function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString();
}

// datetime-local value (YYYY-MM-DDTHH:mm) for an ISO string
function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AdminMaterials({ courses, onChanged }) {
  const [exams, setExams] = useState([]);
  const [pwEdit, setPwEdit] = useState({});
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [docCourse, setDocCourse] = useState('');
  const [docTopic, setDocTopic] = useState('');
  const [docTitle, setDocTitle] = useState('');
  const [docFile, setDocFile] = useState(null);
  const [docs, setDocs] = useState([]);
  const [exCourse, setExCourse] = useState('');
  const [exForm, setExForm] = useState({ title: '', body: '', locked: true, unlock_at: '', unlock_password: '', closes_at: '' });
  const [closeEdit, setCloseEdit] = useState({});
  const [exFile, setExFile] = useState(null);
  const [qFile, setQFile] = useState(null);
  const [qPreview, setQPreview] = useState(null); // { questions, warnings, ready, stats, title_suggestion }
  const [qConfirmed, setQConfirmed] = useState(false);
  const [qBusy, setQBusy] = useState(false);
  const [editing, setEditing] = useState({});

  const loadExams = () => api('/admin/exams').then(setExams).catch((e) => setError(e.message));
  useEffect(() => { loadExams(); }, []);

  // Documents for the selected course come from the course tree (already loaded by the parent via courses prop)
  const selected = courses.find((c) => String(c.id) === String(docCourse));
  const topicsOfDoc = selected?.topics || [];
  useEffect(() => {
    if (!docCourse) { setDocs([]); return; }
    api(`/courses/${docCourse}/materials`).then((m) => setDocs(m.documents)).catch((e) => setError(e.message));
  }, [docCourse, msg]);

  const flash = (ok) => { setError(''); setMsg(ok); };
  const fail = (e) => { setMsg(''); setError(e.message); };

  async function uploadDoc(e) {
    e.preventDefault();
    if (!docFile) return setError('Choose a file first.');
    const form = new FormData();
    form.append('file', docFile);
    form.append('title', docTitle || docFile.name);
    if (docTopic) form.append('topic_id', docTopic);
    try {
      await api(`/admin/courses/${docCourse}/documents`, { method: 'POST', form });
      setDocTitle(''); setDocFile(null); e.target.reset();
      flash('Document uploaded. Students enrolled in this course can download it now.');
      api(`/courses/${docCourse}/materials`).then((m) => setDocs(m.documents));
      onChanged?.();
    } catch (err) { fail(err); }
  }

  async function removeDoc(id) {
    if (!window.confirm('Delete this document? This cannot be undone.')) return;
    try { await api(`/admin/documents/${id}`, { method: 'DELETE' }); flash('Document deleted.'); api(`/courses/${docCourse}/materials`).then((m) => setDocs(m.documents)); onChanged?.(); }
    catch (err) { fail(err); }
  }

  async function previewQuestions(fileOverride = null) {
    const f = fileOverride || qFile;
    if (!f) return setError('Choose a .txt, .md or .pdf question file.');
    setError(''); setQBusy(true); setQPreview(null); setQConfirmed(false);
    try {
      const form = new FormData();
      form.append('file', f);
      const data = await api('/admin/exam-questions/preview', { method: 'POST', form });
      if (data.ready) setQConfirmed(true); else setQConfirmed(false);
      setQPreview(data);
      if (!exForm.title.trim() && data.title_suggestion) setExForm((f) => ({ ...f, title: data.title_suggestion }));
    } catch (err) { fail(err); } finally { setQBusy(false); }
  }

  function clearQuestions() { setQFile(null); setQPreview(null); setQConfirmed(false); }

  async function createExam(e) {
    e.preventDefault();
    if (qPreview && !qConfirmed) return setError(qPreview.error || 'Some questions failed to parse. Fix them or use a smaller file.');
    if (!qConfirmed) return setError('Upload a question file (.txt, .md or .pdf) first.');
    const form = new FormData();
    form.append('title', exForm.title);
    form.append('body', exForm.body);
    form.append('locked', exForm.locked ? '1' : '0');
    if (exForm.locked && exForm.unlock_at) form.append('unlock_at', new Date(exForm.unlock_at).toISOString());
    if (exForm.closes_at) form.append('closes_at', new Date(exForm.closes_at).toISOString());
    if (exForm.unlock_password) form.append('unlock_password', exForm.unlock_password);
    if (qConfirmed && qPreview) form.append('questions', JSON.stringify(qPreview.questions));
    try {
      await api(`/admin/courses/${exCourse}/exams`, { method: 'POST', form });
      setExForm({ title: '', body: '', locked: true, unlock_at: '', unlock_password: '', closes_at: '' }); setExFile(null); clearQuestions(); e.target.reset();
      flash('Exam created. It stays locked until you unlock it.');
      loadExams(); onChanged?.();
    } catch (err) { fail(err); }
  }

  async function setLock(exam, locked) {
    try {
      await api(`/admin/exams/${exam.id}`, { method: 'PATCH', body: { locked } });
      flash(locked ? 'Exam locked.' : 'Exam unlocked. Students can view it now.');
      loadExams();
    } catch (err) { fail(err); }
  }

  async function savePassword(exam) {
    const v = pwEdit[exam.id];
    if (v === undefined) return;
    if (v.trim() && v.trim().length < 4) return setError('Unlock password must be at least 4 characters.');
    try {
      await api(`/admin/exams/${exam.id}`, { method: 'PATCH', body: { unlock_password: v.trim() } });
      setPwEdit((s) => ({ ...s, [exam.id]: undefined }));
      flash(v.trim() ? 'Unlock password saved. Students must enter it to unlock this exam.' : 'Unlock password removed.');
      loadExams();
    } catch (err) { fail(err); }
  }

  async function saveRelease(exam) {
    const v = editing[exam.id];
    try {
      await api(`/admin/exams/${exam.id}`, { method: 'PATCH', body: { locked: true, unlock_at: v ? new Date(v).toISOString() : null } });
      setEditing((s) => ({ ...s, [exam.id]: undefined }));
      flash(v ? 'Release time saved. The exam opens automatically at that time unless you lock it again.' : 'Release time cleared. The exam stays locked until you unlock it.');
      loadExams();
    } catch (err) { fail(err); }
  }

  async function saveEnd(exam) {
    const v = closeEdit[exam.id];
    try {
      await api(`/admin/exams/${exam.id}`, { method: 'PATCH', body: { closes_at: v ? new Date(v).toISOString() : null } });
      setCloseEdit((s) => ({ ...s, [exam.id]: undefined }));
      flash(v ? 'End time saved. Students can no longer submit after that moment.' : 'End time cleared. The exam stays open until you change it.');
      loadExams();
    } catch (err) { fail(err); }
  }

  async function removeExam(exam) {
    if (!window.confirm(`Delete exam "${exam.title}"? Students will lose access to it.`)) return;
    try { await api(`/admin/exams/${exam.id}`, { method: 'DELETE' }); flash('Exam deleted.'); loadExams(); onChanged?.(); }
    catch (err) { fail(err); }
  }

  return (
    <>
      {error && <div className="error">{error}</div>}
      {msg && <div className="info">{msg}</div>}

      <div className="card mb">
        <h2>Course documents</h2>
        <p className="small muted">Upload PDFs (or DOCX, TXT, MD, PNG, JPG up to 25 MB) per course and topic. Enrolled students can download them from the course page.</p>
        <form className="form-inline" onSubmit={uploadDoc}>
          <select className="input" required value={docCourse} onChange={(e) => { setDocCourse(e.target.value); setDocTopic(''); }}>
            <option value="">Choose course</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
          <select className="input" value={docTopic} onChange={(e) => setDocTopic(e.target.value)} disabled={!docCourse}>
            <option value="">Whole course</option>
            {topicsOfDoc.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
          <input className="input" placeholder="Document title" value={docTitle} onChange={(e) => setDocTitle(e.target.value)} />
          <input className="input" type="file" required onChange={(e) => setDocFile(e.target.files[0] || null)} />
          <button className="btn teal" type="submit" disabled={!docCourse}>Upload document</button>
        </form>
        {docCourse && (
          <table className="table small mt">
            <thead><tr><th>Title</th><th>Topic</th><th>File</th><th></th></tr></thead>
            <tbody>
              {docs.length === 0 && <tr><td colSpan={4} className="muted">No documents yet for this course.</td></tr>}
              {docs.map((d) => (
                <tr key={d.id}>
                  <td>{d.title}</td>
                  <td>{d.topic_title || 'Whole course'}</td>
                  <td className="muted">{d.original_name}</td>
                  <td><button className="btn ghost small" onClick={() => removeDoc(d.id)}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card mb">
        <h2>Create exam</h2>
        <p className="small muted">New exams start locked. Students see the exam and a lock notice until you unlock it or its release time passes.</p>
        <form className="form-inline" onSubmit={createExam}>
          <select className="input" required value={exCourse} onChange={(e) => setExCourse(e.target.value)}>
            <option value="">Choose course</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
          <input className="input" placeholder="Exam title" required value={exForm.title} onChange={(e) => setExForm({ ...exForm, title: e.target.value })} />
          <div style={{ width: '100%' }}>
            <p className="small muted" style={{ margin: '0 0 6px' }}>Question file (.txt, .md or .pdf). It is converted into an in-app exam students answer on the site.</p>
            <div className="row">
              <input className="input" type="file" accept=".txt,.md,.pdf,text/plain,text/markdown,application/pdf" onChange={(e) => { const f = e.target.files[0] || null; setQFile(f); setQPreview(null); setQConfirmed(false); if (f) setTimeout(() => previewQuestions(f), 0); }} />
              {qPreview && <button className="btn ghost small" type="button" onClick={clearQuestions}>Remove</button>}
            </div>
            {qPreview && (
              <div className="card mt">
                <p className="small"><strong>{qPreview.stats.total}</strong> question(s) found. {qPreview.stats.unmarked > 0 ? `${qPreview.stats.unmarked} have no answer marked and will not be scored until you mark them.` : 'All have an answer marked.'}</p>
                {qPreview.warnings?.length > 0 && <ul className="small">{qPreview.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>}
                <ol className="small" style={{ maxHeight: 260, overflow: 'auto' }}>
                  {qPreview.questions.slice(0, 50).map((q) => (
                    <li key={q.position} style={{ marginBottom: 6 }}>
                      {q.prompt}
                      <div className="muted">{q.options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}${q.correct_index === i ? ' (answer)' : ''}`).join('  |  ')}</div>
                      {q.correct_index === null && <div className="muted">No answer marked. Saved unmarked.</div>}
                    </li>
                  ))}
                </ol>
                {qPreview.questions.length > 50 && <p className="small muted">Showing the first 50 of {qPreview.questions.length}.</p>}
                {!qConfirmed ? (
                  <button className="btn teal small mt" type="button" disabled={!qPreview.ready} onClick={() => setQConfirmed(true)}>
                    {qPreview.ready ? 'Use these questions' : 'Fix the file before using it'}
                  </button>
                ) : <p className="small">Questions confirmed. They will be saved with the exam.</p>}
              </div>
            )}
          </div>
          <label className="small">Release at (optional)
            <input className="input" type="datetime-local" value={exForm.unlock_at} onChange={(e) => setExForm({ ...exForm, unlock_at: e.target.value })} />
          </label>
          <label className="small">End time (optional)
            <input className="input" type="datetime-local" value={exForm.closes_at} onChange={(e) => setExForm({ ...exForm, closes_at: e.target.value })} />
          </label>
          <p className="small muted" style={{ width: '100%', margin: 0 }}>Students see a live countdown and can no longer submit after this moment.</p>
          <label className="small">Unlock password (optional)
            <input className="input" type="text" autoComplete="off" minLength={4} maxLength={72} placeholder="e.g. tutor code" value={exForm.unlock_password} onChange={(e) => setExForm({ ...exForm, unlock_password: e.target.value })} />
          </label>
          <p className="small muted" style={{ width: '100%', margin: 0 }}>Students must enter this to unlock the exam. It is stored hashed and shown to nobody after you save it.</p>
          <button className="btn teal" type="submit" disabled={!exCourse || (!!qPreview && !qConfirmed)}>Create locked exam</button>
        </form>
      </div>

      <div className="card mb">
        <h2>Exams</h2>
        {exams.length === 0 ? <p className="small muted">No exams yet.</p> : (
          <table className="table small">
            <thead><tr><th>Exam</th><th>Course</th><th>Status</th><th>Release time</th><th>End time</th><th>Unlock password</th><th></th></tr></thead>
            <tbody>
              {exams.map((x) => (
                <tr key={x.id}>
                  <td>{x.title}<div className="muted">{x.has_file ? x.original_name : 'Question set'}</div></td>
                  <td>{x.course_title}</td>
                  <td><span className={`badge ${x.open ? 'teal' : 'warn'}`}>{x.open ? 'Open' : 'Locked'}</span></td>
                  <td>
                    <div className="row">
                      <input className="input" type="datetime-local" style={{ padding: '4px 6px' }}
                        value={editing[x.id] !== undefined ? editing[x.id] : toLocalInput(x.unlock_at)}
                        onChange={(e) => setEditing((s) => ({ ...s, [x.id]: e.target.value }))} />
                      {editing[x.id] !== undefined && <button className="btn ghost small" onClick={() => saveRelease(x)}>Save</button>}
                    </div>
                    {x.unlock_at && editing[x.id] === undefined && <div className="muted small">{fmtTime(x.unlock_at)}</div>}
                  </td>
                  <td>
                    <div className="row">
                      <input className="input" type="datetime-local" style={{ padding: '4px 6px' }}
                        value={closeEdit[x.id] !== undefined ? closeEdit[x.id] : toLocalInput(x.closes_at)}
                        onChange={(e) => setCloseEdit((s) => ({ ...s, [x.id]: e.target.value }))} />
                      {closeEdit[x.id] !== undefined && <button className="btn ghost small" onClick={() => saveEnd(x)}>Save</button>}
                    </div>
                    {x.closes_at && closeEdit[x.id] === undefined && <div className="muted small">{fmtTime(x.closes_at)}{x.closed ? ' (closed)' : ''}</div>}
                  </td>
                  <td>
                    <div className="row">
                      <input className="input" type="text" autoComplete="off" maxLength={72} style={{ padding: '4px 6px', width: 150 }}
                        placeholder={x.has_password ? 'Password set (type to change)' : 'No password'}
                        value={pwEdit[x.id] !== undefined ? pwEdit[x.id] : ''}
                        onChange={(e) => setPwEdit((s) => ({ ...s, [x.id]: e.target.value }))} />
                      {pwEdit[x.id] !== undefined && <button className="btn ghost small" onClick={() => savePassword(x)}>Save</button>}
                    </div>
                    <div className="muted small">Students must enter this to unlock</div>
                  </td>
                  <td className="row">
                    {x.locked && !x.open ? (
                      <button className="btn teal small" onClick={() => setLock(x, false)}>Unlock now</button>
                    ) : (
                      <button className="btn ghost small" onClick={() => setLock(x, true)}>{x.locked ? 'Lock again' : 'Lock'}</button>
                    )}
                    <button className="btn ghost small" onClick={() => removeExam(x)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
