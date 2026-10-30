import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

const emptyCommunity = { title: '', description: '', tag: 'General', image_data: '', image_file: null };
const emptyCase = { title: '', specialty: '', patient: '', presentation: '', vitals: '', published: true, image_data: '', image_file: null };

async function readImage(file) {
  if (!file) return '';
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) throw new Error('Choose a JPEG, PNG, WebP or GIF image.');
  if (file.size > 300 * 1024) throw new Error('Image must be 300 KB or smaller.');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read that image.'));
    reader.readAsDataURL(file);
  });
}

export default function AdminContent() {
  const [communities, setCommunities] = useState([]);
  const [cases, setCases] = useState([]);
  const [messages, setMessages] = useState([]);
  const [community, setCommunity] = useState(emptyCommunity);
  const [caseForm, setCaseForm] = useState(emptyCase);
  const [editingCommunity, setEditingCommunity] = useState(null);
  const [editingCase, setEditingCase] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = async () => {
    try {
      const [communityRows, caseRows, contactRows] = await Promise.all([
        api('/admin/communities'), api('/admin/cases'), api('/admin/contact-messages'),
      ]);
      setCommunities(communityRows);
      setCases(caseRows);
      setMessages(contactRows);
    } catch (e) { setError(e.message); }
  };
  useEffect(() => { load(); }, []);

  const run = async (fn, success) => {
    setError(''); setNotice('');
    try { await fn(); setNotice(success); await load(); }
    catch (e) { setError(e.message); }
  };

  const saveCommunity = async (e) => {
    e.preventDefault();
    const id = editingCommunity;
    try {
      setError('');
      const image_data = community.image_file ? await readImage(community.image_file) : community.image_data || '';
      await run(() => api(id ? `/admin/communities/${id}` : '/admin/communities', { method: id ? 'PATCH' : 'POST', body: { ...community, image_data } }), id ? 'Community updated.' : 'Community created.');
      setCommunity(emptyCommunity); setEditingCommunity(null);
    } catch (e) { setError(e.message); }
  };

  const editCommunity = (c) => {
    setEditingCommunity(c.id); setCommunity({ title: c.name, description: c.description || '', tag: c.tag || 'General', image_data: c.image_data || '', image_file: null });
  };

  const saveCase = async (e) => {
    e.preventDefault();
    const id = editingCase;
    try {
      setError('');
      const image_data = caseForm.image_file ? await readImage(caseForm.image_file) : caseForm.image_data || '';
      await run(() => api(id ? `/admin/cases/${id}` : '/admin/cases', { method: id ? 'PATCH' : 'POST', body: { ...caseForm, image_data } }), id ? 'Case study updated.' : 'Case study created.');
      setCaseForm(emptyCase); setEditingCase(null);
    } catch (e) { setError(e.message); }
  };

  const editCase = async (c) => {
    setError('');
    try {
      const full = await api(`/cases/${c.id}`);
      setEditingCase(c.id);
      setCaseForm({ title: full.title, specialty: full.specialty || '', patient: full.patient || '', presentation: full.presentation || '', vitals: full.vitals || '', published: !!full.published, image_data: full.image_data || '', image_file: null });
    } catch (e) { setError(e.message); }
  };

  return <div className="stack">
    {error && <div className="error">{error}</div>}
    {notice && <div className="info">{notice}</div>}
    <section className="card stack">
      <h2>Communities</h2>
      <p className="muted small">Manage what appears in the public Communities section. Add an optional image, up to 300 KB.</p>
      {communities.map((c) => <div key={c.id} className="card-actions">
        <div><strong>{c.name}</strong><div className="muted small">{c.tag} · {c.description}</div>{c.image_data && <img src={c.image_data} alt="" style={{ width: 90, height: 60, objectFit: 'cover', borderRadius: 6, marginTop: 6 }} />}</div>
        <button className="btn ghost small" onClick={() => editCommunity(c)}>Edit</button>
        <button className="btn ghost small" onClick={() => run(() => api(`/admin/communities/${c.id}`, { method: 'DELETE' }), 'Community deleted.')}>Delete</button>
      </div>)}
      <form className="stack" onSubmit={saveCommunity}>
        <h3>{editingCommunity ? 'Edit community' : 'Add community'}</h3>
        <input className="input" required maxLength={120} placeholder="Title" value={community.title} onChange={(e) => setCommunity({ ...community, title: e.target.value })} />
        <input className="input" maxLength={60} placeholder="Discipline tag" value={community.tag} onChange={(e) => setCommunity({ ...community, tag: e.target.value })} />
        <textarea className="input" rows={3} maxLength={2000} placeholder="Description" value={community.description} onChange={(e) => setCommunity({ ...community, description: e.target.value })} />
        <input className="input" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(e) => setCommunity({ ...community, image_file: e.target.files?.[0] || null })} />
        <p className="muted small">Optional image, JPEG/PNG/WebP/GIF, up to 300 KB. {community.image_data && !community.image_file ? 'Current image will be kept.' : ''}</p>
        {community.image_data && !community.image_file && <img src={community.image_data} alt="Current community" style={{ maxWidth: 180, maxHeight: 120, objectFit: 'cover', borderRadius: 8 }} />}
        <div className="row"><button className="btn teal" type="submit">{editingCommunity ? 'Save community' : 'Create community'}</button>{editingCommunity && <button className="btn ghost" type="button" onClick={() => { setEditingCommunity(null); setCommunity(emptyCommunity); }}>Cancel</button>}</div>
      </form>
    </section>

    <section className="card stack">
      <h2>Case studies</h2>
      <p className="muted small">Manage public case studies. Add a discipline and case presentation; questions can be authored in the case quiz tools.</p>
      {cases.map((c) => <div key={c.id} className="card-actions">
        <div><strong>{c.title}</strong><div className="muted small">{c.specialty || 'No discipline'} · {c.published ? 'Published' : 'Draft'}</div>{c.image_data && <img src={c.image_data} alt="" style={{ width: 90, height: 60, objectFit: 'cover', borderRadius: 6, marginTop: 6 }} />}</div>
        <button className="btn ghost small" onClick={() => editCase(c)}>Edit</button>
        <button className="btn ghost small" onClick={() => run(() => api(`/admin/cases/${c.id}`, { method: 'DELETE' }), 'Case study deleted.')}>Delete</button>
      </div>)}
      <form className="stack" onSubmit={saveCase}>
        <h3>{editingCase ? 'Edit case study' : 'Add case study'}</h3>
        <input className="input" required maxLength={180} placeholder="Title" value={caseForm.title} onChange={(e) => setCaseForm({ ...caseForm, title: e.target.value })} />
        <input className="input" maxLength={100} placeholder="Discipline / specialty" value={caseForm.specialty} onChange={(e) => setCaseForm({ ...caseForm, specialty: e.target.value })} />
        <input className="input" maxLength={300} placeholder="Patient summary" value={caseForm.patient} onChange={(e) => setCaseForm({ ...caseForm, patient: e.target.value })} />
        <textarea className="input" required rows={6} maxLength={12000} placeholder="Case body / presentation" value={caseForm.presentation} onChange={(e) => setCaseForm({ ...caseForm, presentation: e.target.value })} />
        <input className="input" maxLength={1000} placeholder="Vitals (optional)" value={caseForm.vitals} onChange={(e) => setCaseForm({ ...caseForm, vitals: e.target.value })} />
        <label className="field"><input type="checkbox" checked={caseForm.published} onChange={(e) => setCaseForm({ ...caseForm, published: e.target.checked })} /> Publish case study</label>
        <input className="input" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(e) => setCaseForm({ ...caseForm, image_file: e.target.files?.[0] || null })} />
        <p className="muted small">Optional image, JPEG/PNG/WebP/GIF, up to 300 KB. {caseForm.image_data && !caseForm.image_file ? 'Current image will be kept.' : ''}</p>
        {caseForm.image_data && !caseForm.image_file && <img src={caseForm.image_data} alt="Current case study" style={{ maxWidth: 180, maxHeight: 120, objectFit: 'cover', borderRadius: 8 }} />}
        <div className="row"><button className="btn teal" type="submit">{editingCase ? 'Save case study' : 'Create case study'}</button>{editingCase && <button className="btn ghost" type="button" onClick={() => { setEditingCase(null); setCaseForm(emptyCase); }}>Cancel</button>}</div>
      </form>
    </section>

    <section className="card stack">
      <h2>Contact messages</h2>
      {messages.length === 0 ? <p className="muted">No messages yet.</p> : messages.map((m) => <article className="card" key={m.id}>
        <strong>{m.name}</strong> · <a href={`mailto:${m.email}`}>{m.email}</a>
        <p className="muted small">{new Date(`${m.created_at}Z`).toLocaleString()}</p>
        <p className="body-text">{m.message}</p>
      </article>)}
    </section>
  </div>;
}
