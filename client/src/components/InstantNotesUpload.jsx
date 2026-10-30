import React, { useState } from 'react';
import { api } from '../api.js';

// Selecting a file uploads, parses and saves the notes in one action.
export default function InstantNotesUpload({ courses, onImported }) {
  const [courseId, setCourseId] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function upload(file) {
    if (!file) return;
    if (!courseId) { setError('Choose a course before selecting a notes file.'); return; }
    setBusy(true); setError(''); setMessage('');
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('course_id', courseId);
      const result = await api('/admin/notes/upload', { method: 'POST', form });
      setMessage(`Added ${result.topics} topic${result.topics === 1 ? '' : 's'} and ${result.subtopics} section${result.subtopics === 1 ? '' : 's'} to ${result.course_title}. Notes are live in the course now.`);
      if (onImported) onImported(result);
    } catch (e) {
      setError(e.message || 'Notes could not be imported.');
    } finally {
      setBusy(false);
    }
  }

  return <div className="card">
    <h2>Upload course notes</h2>
    <p className="small muted">Choose a course, then select a .txt, .md or .pdf file. Notes are converted and added to the course immediately.</p>
    {error && <div className="error">{error}</div>}
    {message && <div className="info">{message}</div>}
    {busy && <div className="info">Reading and adding notes...</div>}
    <div className="form-inline">
      <select className="input" required value={courseId} disabled={busy} onChange={(e) => { setCourseId(e.target.value); setError(''); }}>
        <option value="">Choose course</option>
        {courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
      </select>
      <input className="input" type="file" accept=".txt,.md,.markdown,.pdf,text/plain,text/markdown,application/pdf" disabled={busy || !courseId} onChange={(e) => { const file = e.target.files?.[0]; upload(file); e.target.value = ''; }} />
    </div>
  </div>;
}
