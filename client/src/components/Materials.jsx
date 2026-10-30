import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, getToken } from '../api.js';

// Authenticated download: keeps the Authorization header, then saves the blob with the original filename.
export async function downloadFile(url, filename) {
  const token = getToken();
  const res = await fetch(`/api${url}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Download failed.');
  }
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename || 'download';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const fmtSize = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : n > 0 ? `${Math.max(1, Math.round(n / 1024))} KB` : '');

// Course page block: documents (download for enrolled students) and exams (locked until opened).
export default function CourseMaterials({ courseId, canView }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [pw, setPw] = useState({});
  const [pwErr, setPwErr] = useState({});
  const [pwBusy, setPwBusy] = useState({});

  const reload = () => api(`/courses/${courseId}/materials`).then(setData).catch((e) => setError(e.message));
  useEffect(() => { reload(); }, [courseId, canView]);

  async function unlockExam(x) {
    const value = (pw[x.id] || '').trim();
    if (!value) return setPwErr((s) => ({ ...s, [x.id]: 'Enter the unlock password.' }));
    setPwBusy((s) => ({ ...s, [x.id]: true }));
    setPwErr((s) => ({ ...s, [x.id]: '' }));
    try {
      await api(`/exams/${x.id}/unlock`, { method: 'POST', body: { password: value } });
      setPw((s) => ({ ...s, [x.id]: '' }));
      await reload();
    } catch (e) {
      setPwErr((s) => ({ ...s, [x.id]: e.message }));
    } finally {
      setPwBusy((s) => ({ ...s, [x.id]: false }));
    }
  }

  if (error) return <div className="alert error mt">{error}</div>;
  if (!data) return null;
  if (data.documents.length === 0 && data.exams.length === 0) return null;

  const dl = async (url, name) => {
    setNote('');
    try { await downloadFile(url, name); } catch (e) { setNote(e.message); }
  };

  return (
    <div className="materials">
      {data.documents.length > 0 && (
        <>
          <h2>Course documents</h2>
          <div className="grid cols-2">
            {data.documents.map((d) => (
              <div key={d.id} className="card doc-card">
                <div className="small muted">{d.topic_title || 'Whole course'}</div>
                <h3 style={{ margin: '2px 0' }}>{d.title}</h3>
                <div className="small muted">{d.original_name}{d.size ? ` · ${fmtSize(d.size)}` : ''}</div>
                {canView ? (
                  <button className="btn small" onClick={() => dl(`/documents/${d.id}/download`, d.original_name)}>Download</button>
                ) : (
                  <span className="small muted">Enroll to download</span>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {data.exams.length > 0 && (
        <>
          <h2>Exams</h2>
          <div className="grid cols-2">
            {data.exams.map((x) => {
              const open = x.open && canView && !x.closed;
              return (
                <div key={x.id} className={`card exam-card ${open ? 'open' : 'locked'}`}>
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <h3 style={{ margin: 0 }}>{x.title}</h3>
                    <span className={`badge ${open ? 'teal' : 'lock'}`}>{open ? 'Open' : 'Locked'}</span>
                  </div>
                  {!canView && <p className="small muted">Enroll in this course to take exams.</p>}
                  {canView && x.closed && (
                    <p className="small lock-note">This exam has closed. It no longer accepts submissions.</p>
                  )}
                  {canView && !x.closed && x.closes_at && (
                    <p className="small muted">Ends on {new Date(x.closes_at).toLocaleString()}</p>
                  )}
                  {canView && !x.open && !x.closed && !x.has_password && (
                    <p className="small lock-note">
                      This exam is locked. {x.unlock_at ? `It opens on ${new Date(x.unlock_at).toLocaleString()} or when the admin unlocks it.` : 'It will open when the admin unlocks it.'}
                    </p>
                  )}
                  {canView && !x.open && !x.closed && x.has_password && (
                    <form className="unlock-form mt" onSubmit={(e) => { e.preventDefault(); unlockExam(x); }}>
                      <p className="small lock-note">
                        This exam is locked. {x.unlock_at ? `It also opens on ${new Date(x.unlock_at).toLocaleString()}. ` : ''}Enter the unlock password from your tutor.
                      </p>
                      <div className="row">
                        <input className="input" type="password" autoComplete="off" placeholder="Enter unlock password" aria-label="Enter unlock password"
                          value={pw[x.id] || ''} onChange={(e) => setPw((s) => ({ ...s, [x.id]: e.target.value }))} />
                        <button className="btn small" type="submit" disabled={!!pwBusy[x.id]}>{pwBusy[x.id] ? 'Checking...' : 'Unlock'}</button>
                      </div>
                      {pwErr[x.id] && <div className="alert error mt">{pwErr[x.id]}</div>}
                    </form>
                  )}
                  {open && x.question_count > 0 && (
                    <Link className="btn small mt" to={`/exams/${x.id}`}>Take exam ({x.question_count} questions)</Link>
                  )}
                  {open && x.has_file && (
                    <button className="btn small" onClick={() => dl(`/exams/${x.id}/download`, x.original_name)}>Download PDF</button>
                  )}
                  {open && !x.has_file && x.question_count === 0 && <span className="small muted">Question set is open. Ask your tutor if you need a copy.</span>}
                </div>
              );
            })}
          </div>
          {note && <div className="alert error mt">{note}</div>}
        </>
      )}
    </div>
  );
}
