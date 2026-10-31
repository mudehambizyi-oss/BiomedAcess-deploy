import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

const emptyForm = { quote: '', name: '', role: '' };

export default function AdminTestimonials() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => api('/testimonials').then(setItems).catch((err) => setError(err.message));
  useEffect(() => { load(); }, []);

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api(editingId ? `/admin/testimonials/${editingId}` : '/admin/testimonials', {
        method: editingId ? 'PUT' : 'POST',
        body: form,
      });
      setForm(emptyForm);
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function edit(item) {
    setEditingId(item.id);
    setForm({ quote: item.quote, name: item.name, role: item.role });
    setError('');
  }

  async function remove(item) {
    if (!window.confirm(`Delete the testimonial from ${item.name}?`)) return;
    setError('');
    try {
      await api(`/admin/testimonials/${item.id}`, { method: 'DELETE' });
      if (editingId === item.id) { setEditingId(null); setForm(emptyForm); }
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="card" style={{ marginTop: 16 }}>
      <h2>Testimonials</h2>
      <p className="small muted">Add a student's quote to show it on the landing page.</p>
      <form className="form-inline" onSubmit={save}>
        <textarea className="input" placeholder="Quote" rows={3} maxLength={2000} required value={form.quote} onChange={(e) => setForm({ ...form, quote: e.target.value })} />
        <input className="input" placeholder="Name" maxLength={120} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="input" placeholder="Role" maxLength={160} required value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
        {error && <div className="error">{error}</div>}
        <div className="row" style={{ gap: 8 }}>
          <button className="btn teal" type="submit" disabled={busy}>{busy ? 'Saving...' : editingId ? 'Save changes' : 'Add testimonial'}</button>
          {editingId && <button className="btn ghost" type="button" onClick={() => { setEditingId(null); setForm(emptyForm); setError(''); }}>Cancel</button>}
        </div>
      </form>
      <div className="stack" style={{ marginTop: 16 }}>
        {items.map((item) => (
          <div className="card" key={item.id}>
            <blockquote style={{ margin: 0 }}><p>“{item.quote}”</p><cite>{item.name} · {item.role}</cite></blockquote>
            <div className="row" style={{ gap: 8, marginTop: 10 }}>
              <button className="btn ghost small" type="button" onClick={() => edit(item)}>Edit</button>
              <button className="btn ghost small" type="button" onClick={() => remove(item)}>Delete</button>
            </div>
          </div>
        ))}
        {!items.length && <p className="small muted">No testimonials yet.</p>}
      </div>
    </section>
  );
}
