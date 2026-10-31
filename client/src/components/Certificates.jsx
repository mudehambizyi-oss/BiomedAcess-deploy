import React, { useEffect, useState } from 'react';
import { api, downloadBlob } from '../api.js';

export function CertificateCard({ courseId, compact = false }) {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (courseId) api(`/certificates/status/${courseId}`).then(setStatus).catch(() => {});
  }, [courseId]);

  if (!status) return null;
  async function download() {
    setBusy(true); setError('');
    try { await downloadBlob(`/certificates/${courseId}/pdf`, `BiomedAccess-certificate-${courseId}.pdf`); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className={compact ? 'small' : 'card'} style={{ borderColor: '#10b981', marginTop: compact ? 6 : 14 }}>
      {status.eligible ? (
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span><strong style={{ color: '#10b981' }}>Course complete.</strong> <span className="muted">Your certificate is ready.</span></span>
          <button className="btn small" style={{ background: '#e07b39', borderColor: '#e07b39', color: '#fff' }} disabled={busy} onClick={download}>
            {busy ? 'Preparing...' : 'Download PDF'}
          </button>
        </div>
      ) : <span className="muted small">Certificate on completion: finish every topic ({status.progress.done}/{status.progress.total} done).</span>}
      {error && <div className="alert error mt">{error}</div>}
    </div>
  );
}

export function CertificatesSection({ courses }) {
  const [earned, setEarned] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!courses?.length) { setEarned([]); return; }
    api('/certificates').then(setEarned).catch(() => setEarned([]));
  }, [courses?.map((c) => c.id).join(',')]);

  async function download(courseId) {
    setBusyId(courseId); setError('');
    try { await downloadBlob(`/certificates/${courseId}/pdf`, `BiomedAccess-certificate-${courseId}.pdf`); }
    catch (e) { setError(e.message); }
    finally { setBusyId(null); }
  }

  return (
    <section>
      <h2>Certificates</h2>
      {earned.length ? (
        <div className="grid cols-2">
          {earned.map((cert) => (
            <div key={cert.id} className="card">
              <h3 style={{ margin: '2px 0' }}>{cert.course_title}</h3>
              <p className="small muted">Completed {new Date(`${cert.issued_at.replace(' ', 'T')}Z`).toLocaleDateString()}</p>
              <button className="btn teal" disabled={busyId === cert.course_id} onClick={() => download(cert.course_id)}>
                {busyId === cert.course_id ? 'Preparing...' : 'Download PDF'}
              </button>
            </div>
          ))}
        </div>
      ) : <p className="small muted">Finish every topic in a course to earn a certificate. Your certificates will appear here.</p>}
      {error && <div className="alert error mt">{error}</div>}
    </section>
  );
}
