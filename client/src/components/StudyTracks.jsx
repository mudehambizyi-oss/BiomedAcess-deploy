import React, { useState } from 'react';
import { api } from '../api.js';

export const STUDY_TRACKS = [
  { group: 'Students', options: [
    { value: 'preclinical', label: 'Student - Year 1-2', detail: 'Preclinical' },
    { value: 'clinical', label: 'Student - Year 3-4', detail: 'Clinical' },
    { value: 'examprep', label: 'Student - Exam prep', detail: 'Exam preparation' },
  ] },
  { group: 'Professionals', options: [
    { value: 'practicing', label: 'Practicing scientist', detail: 'Professional' },
    { value: 'labmanager', label: 'Lab manager', detail: 'Professional' },
    { value: 'researcher', label: 'Researcher / CPD', detail: 'Professional development' },
  ] },
];
export const TRACK_VALUES = STUDY_TRACKS.flatMap((group) => group.options.map((option) => option.value));
export const TRACK_LABELS = Object.fromEntries(STUDY_TRACKS.flatMap((group) => group.options.map((option) => [option.value, option.label])));

export function TrackOptions({ value, onChange, name = 'study-track' }) {
  return <div className="stack" role="radiogroup" aria-label="Choose your study track">
    {STUDY_TRACKS.map((group) => <fieldset key={group.group} className="card" style={{ padding: 16 }}>
      <legend><strong>{group.group}</strong></legend>
      {group.options.map((option) => <label key={option.value} className="row" style={{ justifyContent: 'flex-start', gap: 10, padding: '8px 0', cursor: 'pointer' }}>
        <input type="radio" name={name} value={option.value} checked={value === option.value} onChange={() => onChange(option.value)} />
        <span><strong>{option.label}</strong><span className="small muted" style={{ display: 'block' }}>{option.detail}</span></span>
      </label>)}
    </fieldset>)}
  </div>;
}

export function TrackChooser({ user, onDone }) {
  const [track, setTrack] = useState(user?.track || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function save(value) {
    setError(''); setBusy(true);
    try {
      const result = await api('/auth/profile/track', { method: 'POST', body: { track: value || null } });
      onDone(result.track ?? null);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return <main className="container" style={{ maxWidth: 720, paddingTop: 36, paddingBottom: 48 }}>
    <section className="card">
      <p className="tagline">Personalize your learning</p>
      <h1>Choose your track</h1>
      <p className="muted">We’ll highlight courses that fit your level. You can change this anytime in your profile.</p>
      {error && <div className="alert error">{error}</div>}
      <TrackOptions value={track} onChange={setTrack} />
      <div className="row mt" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <button className="btn teal" disabled={!track || busy} onClick={() => save(track)}>{busy ? 'Saving...' : 'Continue'}</button>
        <button className="btn ghost" disabled={busy} onClick={() => save(null)}>Decide later</button>
      </div>
    </section>
  </main>;
}

export function TrackEditor({ initialTrack, onSaved }) {
  const [track, setTrack] = useState(initialTrack || '');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault(); setError(''); setMessage(''); setBusy(true);
    try {
      const result = await api('/auth/profile/track', { method: 'POST', body: { track: track || null } });
      onSaved?.(result.track ?? null); setMessage('Study track saved.');
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <form onSubmit={submit}>
    <TrackOptions value={track} onChange={setTrack} name="profile-study-track" />
    {error && <div className="alert error">{error}</div>}{message && <div className="info">{message}</div>}
    <button className="btn teal mt" disabled={busy}>{busy ? 'Saving...' : 'Save track'}</button>
  </form>;
}
