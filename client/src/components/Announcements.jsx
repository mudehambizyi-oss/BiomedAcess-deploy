import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

// Shared announcement list. Admins get a composer when admin props is true.
export default function Announcements({ admin = false }) {
  const [items, setItems] = useState(null);
  const [form, setForm] = useState({ title: '', body: '', pinned: false });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = () => api('/announcements').then(setItems).catch(() => setItems([]));
  useEffect(() => { load(); }, []);

  async function post(e) {
    e.preventDefault();
    if (!form.title.trim()) return setErr('Give the announcement a title.');
    setBusy(true); setErr('');
    try {
      await api('/admin/announcements', { method: 'POST', body: form });
      setForm({ title: '', body: '', pinned: false });
      load();
    } catch (er) { setErr(er.message); } finally { setBusy(false); }
  }

  async function remove(id) {
    if (!window.confirm('Delete this announcement?')) return;
    try { await api(`/admin/announcements/${id}`, { method: 'DELETE' }); load(); } catch (er) { setErr(er.message); }
  }

  async function togglePin(a) {
    try { await api(`/admin/announcements/${a.id}`, { method: 'PATCH', body: { pinned: !a.pinned } }); load(); } catch (er) { setErr(er.message); }
  }

  return (
    <section className="announcements">
      <h2>Announcements</h2>
      {admin && (
        <form className="card mb" onSubmit={post}>
          <input className="input" placeholder="Title" maxLength={120} value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <textarea className="input mt" placeholder="What do you want to announce?" rows={3} maxLength={3000} value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })} />
          <label className="small" style={{ display: 'block', margin: '6px 0' }}>
            <input type="checkbox" checked={form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked })} /> Pin to top
          </label>
          {err && <div className="alert error mt">{err}</div>}
          <button className="btn teal" type="submit" disabled={busy}>{busy ? 'Posting...' : 'Post announcement'}</button>
        </form>
      )}
      {items === null ? <p className="muted small">Loading…</p> : items.length === 0 ? (
        <p className="muted small">No announcements yet.</p>
      ) : (
        items.map((a) => (
          <div key={a.id} className="card ann-item" style={{ borderLeft: a.pinned ? '3px solid #e07b39' : undefined }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <strong>{a.pinned ? '📌 ' : ''}{a.title}</strong>
              <time className="muted small" dateTime={a.created_at}>{new Date(a.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</time>
              {admin && (
                <span className="row">
                  <button className="btn ghost small" type="button" onClick={() => togglePin(a)}>{a.pinned ? 'Unpin' : 'Pin'}</button>
                  <button className="btn ghost small" type="button" onClick={() => remove(a.id)}>Delete</button>
                </span>
              )}
            </div>
            {a.body && <p className="small" style={{ whiteSpace: 'pre-wrap' }}>{a.body}</p>}
            <div className="muted small">{new Date(a.created_at).toLocaleString()}{a.author ? ` · ${a.author}` : ''}</div>
          </div>
        ))
      )}
    </section>
  );
}
