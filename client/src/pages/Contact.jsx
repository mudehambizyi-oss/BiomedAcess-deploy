import React, { useState } from 'react';
import { api } from '../api.js';

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      await api('/contact', { method: 'POST', body: form });
      setForm({ name: '', email: '', message: '' }); setSent(true);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  return <div className="container narrow">
    <div className="page-head"><div><h1>Contact us</h1><p className="muted">Send a message to the BiomedAccess team.</p></div></div>
      <div className="contact-details card stack">
        <h2>Reach the team</h2>
        <p><strong>Email:</strong> <a href="mailto:biomedacess@gmail.com">biomedacess@gmail.com</a></p>
        <p><strong>Phone:</strong> <a href="tel:+260973053584">+260973053584</a></p>
        <p><strong>WhatsApp:</strong> <a href="https://wa.me/260973053584" target="_blank" rel="noreferrer">Message us on WhatsApp</a></p>
        <p><strong>Telegram:</strong> <a href="https://t.me/+260973053584" target="_blank" rel="noreferrer">Message us on Telegram</a></p>
      </div>
      {sent && <div className="info">Your message has been sent.</div>}
      {error && <div className="error">{error}</div>}
      <form className="card stack" onSubmit={submit}>
      <label className="field">Name<input className="input" required maxLength={120} autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
      <label className="field">Email<input className="input" type="email" required maxLength={254} autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
      <label className="field">Message<textarea className="input" required rows={7} maxLength={10000} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></label>
      <button className="btn teal" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send message'}</button>
    </form>
  </div>;
}
