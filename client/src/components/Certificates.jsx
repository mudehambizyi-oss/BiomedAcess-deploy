import React, { useEffect, useState } from 'react';
import { api, getToken } from '../api.js';

// Certificate for one course: shows progress until complete, then a download button.
// Download fetches the PDF with the auth header and saves it (the PDF route needs a token).
export function CertificateCard({ courseId, compact = false }) {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!courseId || !getToken()) return;
    api(`/certificates/status/${courseId}`).then(setStatus).catch(() => {});
  }, [courseId]);

  if (!status) return null;
  const p = status.progress;

  async function download() {
    setBusy(true); setError('');
    try {
      const res = await fetch(`/api/courses/${courseId}/certificate.pdf`, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Download failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `BiomedAccess-certificate-${courseId}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setStatus((s) => ({ ...s, certificate: s.certificate || { id: 'issued' } }));
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  return (
    <div className={compact ? 'small' : 'card'} style={{ borderColor: '#10b981', marginTop: compact ? 6 : 14 }}>
      {status.eligible ? (
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span><strong style={{ color: '#10b981' }}>Course complete.</strong> <span className="muted">Your certificate is ready.</span></span>
          <button className="btn small" style={{ background: '#e07b39', borderColor: '#e07b39', color: '#fff' }} disabled={busy} onClick={download}>
            {busy ? 'Preparing...' : 'Download certificate (PDF)'}
          </button>
        </div>
      ) : (
        <span className="muted small">Certificate unlocks when you finish every topic ({p.done}/{p.total} done).</span>
      )}
      {error && <div className="alert error mt">{error}</div>}
    </div>
  );
}

// Dashboard: list completed courses with download buttons.
export function CertificatesSection({ courses }) {
  const [ready, setReady] = useState([]);
  useEffect(() => {
    if (!courses?.length) return;
    Promise.all(courses.map((c) => api(`/certificates/status/${c.id}`).then((s) => ({ ...s, title: c.title })).catch(() => null)))
      .then((all) => setReady(all.filter((s) => s && s.eligible)));
  }, [courses?.map((c) => c.id).join(',')]);
  if (!ready.length) return null;
  return (
    <section>
      <h2>Certificates</h2>
      <div className="grid cols-2">
        {ready.map((s) => (
          <div key={s.course_id} className="card">
            <h3 style={{ margin: '2px 0' }}>{s.title}</h3>
            <CertificateCard courseId={s.course_id} compact />
          </div>
        ))}
      </div>
    </section>
  );
}
