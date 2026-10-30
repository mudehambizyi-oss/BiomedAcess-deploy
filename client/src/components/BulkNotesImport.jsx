import React, { useState } from 'react';
import { api } from '../api.js';

// Admin: upload one long .txt / .md / .pdf and import it as topics and subtopics.
// Step 1 preview (parses on the server, writes nothing) -> step 2 edit names -> step 3 import (server re-parses and writes in one transaction).
// React renders all text as plain text (no HTML injection).

export default function BulkNotesImport({ courses, onImported }) {
  const [courseId, setCourseId] = useState('');
  const [topicId, setTopicId] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null); // { file_name, format, topics:[{title, words, subtopics:[{title, body, words}]}], warnings, word_count }
  const [busy, setBusy] = useState(''); // '' | 'Reading file...' | 'Importing...'
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const course = courses.find((c) => String(c.id) === String(courseId));
  const topicOptions = course?.topics || [];

  const reset = () => { setPreview(null); setError(''); setResult(null); };

  const doPreview = async (e) => {
    e.preventDefault();
    if (!file) return setError('Choose a .txt, .md or .pdf file.');
    reset();
    setBusy('Reading file...');
    try {
      const form = new FormData();
      form.append('file', file);
      const data = await api('/admin/bulk-notes/preview', { method: 'POST', form });
      setPreview(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };

  const editTopic = (i, title) => setPreview((p) => ({ ...p, topics: p.topics.map((t, j) => (j === i ? { ...t, title } : t)) }));
  const editSub = (i, j, title) => setPreview((p) => ({
    ...p,
    topics: p.topics.map((t, ti) => (ti !== i ? t : { ...t, subtopics: t.subtopics.map((s, si) => (si === j ? { ...s, title } : s)) })),
  }));

  const doImport = async () => {
    if (!courseId) return setError('Choose a course first.');
    if (!preview) return;
    setError('');
    setResult(null);
    setBusy('Importing...');
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('course_id', courseId);
      if (topicId) form.append('topic_id', topicId);
      // Send only the edited titles. The server re-parses the file and checks the shape.
      form.append('structure', JSON.stringify(preview.topics.map((t) => ({
        title: t.title,
        subtopics: t.subtopics.map((s) => ({ title: s.title })),
      }))));
      const data = await api('/admin/bulk-notes/import', { method: 'POST', form });
      setResult(data);
      setPreview(null);
      setFile(null);
      if (onImported) onImported(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };

  const totalSubs = preview ? preview.topics.reduce((a, t) => a + t.subtopics.length, 0) : 0;

  return (
    <div className="card">
      <h2>Bulk notes import</h2>
      <p className="small muted">Upload one long document (.txt, .md or .pdf). Headings like "# Title", "Chapter 2", ALL-CAPS lines become topics, and "## Title" or "1.2 Title" become subtopics. Preview and rename before importing.</p>

      {error && <div className="error">{error}</div>}
      {busy && <div className="info">{busy}</div>}
      {result && (
        <div className="info">
          Imported into {result.course_title}: {result.topics} new topic{result.topics === 1 ? '' : 's'}, {result.subtopics} subtopic{result.subtopics === 1 ? '' : 's'}, about {result.words} words.
          {result.topic_id ? ' Subtopics were added to the chosen topic.' : ''}
          {result.warnings?.length ? <ul className="small">{result.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul> : null}
        </div>
      )}

      <form className="form-inline" onSubmit={doPreview}>
        <select className="input" required value={courseId} onChange={(e) => { setCourseId(e.target.value); setTopicId(''); reset(); }}>
          <option value="">Choose course</option>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
        <select className="input" value={topicId} onChange={(e) => { setTopicId(e.target.value); reset(); }} disabled={!courseId}>
          <option value="">New topics from headings</option>
          {topicOptions.map((t) => <option key={t.id} value={t.id}>Add subtopics to: {t.title}</option>)}
        </select>
        <input className="input" type="file" accept=".txt,.md,.markdown,.pdf,text/plain,text/markdown,application/pdf" required onChange={(e) => { setFile(e.target.files[0] || null); reset(); }} />
        <button className="btn ghost" type="submit" disabled={!!busy || !courseId || !file}>Preview structure</button>
      </form>

      {preview && (
        <div className="stack" style={{ marginTop: 16 }}>
          <div className="small muted">
            {preview.file_name} ({preview.format}): {preview.topics.length} topic{preview.topics.length === 1 ? '' : 's'}, {totalSubs} subtopic{totalSubs === 1 ? '' : 's'}, {preview.word_count} words.
            {topicId ? ' Subtopics will be added to the chosen topic.' : ''}
          </div>
          {preview.warnings?.length ? <div className="info">{preview.warnings.map((w, i) => <div key={i}>{w}</div>)}</div> : null}

          {preview.topics.map((t, i) => (
            <div key={i} className="card" style={{ padding: 12 }}>
              <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                <span className="small muted">Topic {i + 1}</span>
                <input className="input" style={{ flex: 1 }} value={t.title} disabled={!!topicId} onChange={(e) => editTopic(i, e.target.value)} />
                <span className="small muted">{t.words} words</span>
              </div>
              <ul className="small" style={{ listStyle: 'none', paddingLeft: 0, marginTop: 8 }}>
                {t.subtopics.map((s, j) => (
                  <li key={j} className="row" style={{ gap: 8, alignItems: 'center', marginTop: 6 }}>
                    <input className="input" style={{ flex: 1 }} value={s.title} onChange={(e) => editSub(i, j, e.target.value)} />
                    <span className="muted">{s.words} words</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div className="row" style={{ gap: 8 }}>
            <button className="btn teal" type="button" onClick={doImport} disabled={!!busy}>Import {totalSubs} subtopic{totalSubs === 1 ? '' : 's'}</button>
            <button className="btn ghost" type="button" onClick={reset} disabled={!!busy}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
