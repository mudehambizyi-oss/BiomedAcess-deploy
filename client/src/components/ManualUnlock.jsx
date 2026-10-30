import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { formatPrice } from './CourseCard.jsx';

// Student side: "Buy course" opens payment instructions with the mobile money number,
// then a form for the transaction reference and sender name. Creates a pending request.
export function ManualUnlockPanel({ courseId, course, onUnlocked }) {
  const [info, setInfo] = useState(null);
  const [status, setStatus] = useState(null);
  const [form, setForm] = useState({ reference: '', sender_name: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadStatus = () => api(`/payments/manual/requests/${courseId}`).then(setStatus).catch(() => {});
  useEffect(() => {
    api('/payments/manual/info').then(setInfo).catch((e) => setError(e.message));
    loadStatus();
  }, [courseId]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError(''); setNotice('');
    try {
      const r = await api(`/payments/manual/requests/${courseId}`, { method: 'POST', body: form });
      if (r.enrolled) { onUnlocked?.(); return; }
      setNotice('Request received. It is pending review. The course unlocks once an admin confirms your payment.');
      setForm({ reference: '', sender_name: '' });
      loadStatus();
    } catch (err) {
      setError(err.message);
      loadStatus();
    } finally { setBusy(false); }
  }

  const pending = status?.request?.status === 'pending';
  const rejected = status?.request?.status === 'rejected';

  return (
    <div className="card" style={{ borderColor: '#e07b39', marginTop: 14, minWidth: 280 }}>
      <h3 style={{ marginTop: 0 }}>Pay with mobile money</h3>
      <p className="small muted" style={{ marginTop: 0 }}>
        Price: <strong>{formatPrice(course.price_cents, course.currency)}</strong>
      </p>

      {info && !info.enabled && (
        <div className="alert error">Mobile money payments are not set up on this server yet. Please check back later.</div>
      )}

      {info?.enabled && (
        <div className="small" style={{ marginBottom: 12 }}>
          <div>Send {formatPrice(course.price_cents, course.currency)} via <strong>{info.network}</strong> to:</div>
          {info.numbers_with_labels.map((n, i) => (
            <div key={i} style={{ fontSize: '1.4rem', fontWeight: 700, color: '#10b981', margin: '6px 0' }}>
              {n.label ? <span style={{ fontSize: '0.85rem', color: '#e07b39', marginRight: 8 }}>{n.label}</span> : null}{n.number}
            </div>
          ))}
          {info.account_name && <div className="muted">Account name: {info.account_name}</div>}
          <ol className="small muted" style={{ paddingLeft: 18, marginBottom: 0 }}>
            {info.instructions.map((s, i) => <li key={i}>{s}</li>)}
          </ol>
        </div>
      )}

      {pending && <div className="alert info">Your payment request is pending review{status.request.reference ? ` (reference ${status.request.reference})` : ''}. You will get access as soon as it is approved.</div>}
      {rejected && <div className="alert error">Your last request was rejected. Check the reference and send it again.</div>}
      {notice && <div className="alert info">{notice}</div>}
      {error && <div className="alert error">{error}</div>}

      {info?.enabled && !pending && (
        <form onSubmit={submit} className="stack" style={{ gap: 8 }}>
          <input className="input" placeholder="Transaction reference or message ID" required minLength={3} maxLength={60}
            value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
          <input className="input" placeholder="Name the payment was sent from" required minLength={2} maxLength={80}
            value={form.sender_name} onChange={(e) => setForm({ ...form, sender_name: e.target.value })} />
          <button className="btn teal" type="submit" disabled={busy}>{busy ? 'Submitting...' : 'I have paid, submit for review'}</button>
        </form>
      )}
    </div>
  );
}

// Admin side: Payments/Requests tab listing requests with Approve/Reject.
export function AdminPayments() {
  const [filter, setFilter] = useState('pending');
  const [rows, setRows] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = (status = filter) => api(`/payments/admin/requests?status=${status}`).then(setRows).catch((e) => setError(e.message));
  useEffect(() => { load(filter); }, [filter]);

  async function act(id, action) {
    setBusyId(id); setError(''); setMsg('');
    try {
      await api(`/payments/admin/requests/${id}/${action}`, { method: 'POST' });
      setMsg(action === 'approve' ? 'Approved. The course is unlocked for that student.' : 'Rejected.');
      load(filter);
    } catch (e) { setError(e.message); load(filter); } finally { setBusyId(null); }
  }

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>Payment requests</h2>
        <div className="row" style={{ gap: 6 }}>
          {['pending', 'approved', 'rejected'].map((s) => (
            <button key={s} className={`btn small ${filter === s ? 'teal' : 'ghost'}`} onClick={() => setFilter(s)}>{s[0].toUpperCase() + s.slice(1)}</button>
          ))}
        </div>
      </div>
      {error && <div className="alert error mt">{error}</div>}
      {msg && <div className="alert info mt">{msg}</div>}
      {rows.length === 0 ? (
        <p className="small muted">No {filter} requests.</p>
      ) : (
        <table className="table small">
          <thead><tr><th>Student</th><th>Course</th><th>Amount</th><th>Reference</th><th>Sender</th><th>Submitted</th><th></th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.user_name}<div className="muted">{r.user_email}</div></td>
                <td>{r.course_title}</td>
                <td>{formatPrice(r.amount_cents, r.currency)}</td>
                <td>{r.reference}</td>
                <td>{r.sender_name}</td>
                <td>{String(r.created_at).slice(0, 16)}</td>
                <td>
                  {r.status === 'pending' ? (
                    <div className="row" style={{ gap: 6 }}>
                      <button className="btn teal small" disabled={busyId === r.id} onClick={() => act(r.id, 'approve')}>Approve</button>
                      <button className="btn small" style={{ background: '#ef4444', color: '#fff', borderColor: '#ef4444' }} disabled={busyId === r.id} onClick={() => act(r.id, 'reject')}>Reject</button>
                    </div>
                  ) : <span className={`badge ${r.status === 'approved' ? 'teal' : 'warn'}`}>{r.status}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
