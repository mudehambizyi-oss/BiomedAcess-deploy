import React, { useEffect, useState } from 'react';
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { formatPrice } from '../components/CourseCard.jsx';
import { BookmarkButton } from '../components/Features.jsx';
import CourseMaterials from '../components/Materials.jsx';
import { CertificateCard } from '../components/Certificates.jsx';
import { ManualUnlockPanel } from '../components/ManualUnlock.jsx';
import RichText from '../components/RichText.jsx';

export default function CourseDetail() {
  const { id } = useParams();
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [course, setCourse] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [payStatus, setPayStatus] = useState(null);
  const [showManual, setShowManual] = useState(false);

  const load = () => api(`/courses/${id}`).then(setCourse).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [id, user?.id]);

  useEffect(() => {
    const sid = params.get('session_id');
    if (params.get('paid') && sid) {
      api(`/payments/verify/${sid}`).then(() => { setNotice('Payment confirmed. You are enrolled.'); load(); }).catch((e) => setNotice(e.message));
    } else if (params.get('cancelled')) {
      setNotice('Checkout was cancelled. You have not been charged.');
    }
  }, []);

  async function enrollFree() {
    if (!user) return navigate('/login', { state: { from: `/courses/${id}` } });
    setBusy(true); setError('');
    try { await api(`/courses/${course.id}/enroll`, { method: 'POST' }); await load(); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  async function checkout() {
    if (!user) return navigate('/login', { state: { from: `/courses/${id}` } });
    setBusy(true); setError('');
    try {
      const r = await api(`/payments/checkout/${course.id}`, { method: 'POST' });
      if (r.url) { window.location.href = r.url; return; }
      if (r.enrolled) { setNotice(r.message || 'Enrolled.'); await load(); }
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  // Buy course: card checkout when Stripe is on; otherwise manual mobile money.
  async function buyCourse() {
    if (!user) return navigate('/login', { state: { from: `/courses/${id}` } });
    let st = payStatus;
    if (!st) { st = await api('/payments/status').catch(() => ({ enabled: false })); setPayStatus(st); }
    if (st.enabled || st.demo_unlock) return checkout();
    setShowManual(true);
  }

  if (error && !course) return <div className="container"><div className="alert error">{error}</div></div>;
  if (!course) return <div className="container"><p className="muted">Loading...</p></div>;

  const canView = course.has_access;
  const totalSub = course.topics.reduce((a, t) => a + t.subtopics.length, 0);

  return (
    <div className="container">
      <div className="breadcrumb"><Link to="/courses">Courses</Link> / {course.title}</div>
      <div className="card hero-card">
        {course.image_url && <img className="course-cover" src={course.image_url} alt={`${course.title} cover`} loading="lazy" />}
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <span className="badge">{course.level}</span>
            <h1 style={{ marginTop: 10 }}>{course.title} <BookmarkButton kind="course" id={course.id} /></h1>
            <div className="course-description"><RichText text={course.description} /></div>
            <p className="small muted">{course.topics.length} topics, {totalSub} subtopics</p>
          </div>
          <div className="cta-box">
            {course.progress && canView && <div className="small"><strong>{course.progress.percent}%</strong> complete</div>}
            {canView ? (
              <span className="badge teal">Enrolled</span>
            ) : course.is_paid ? (
              <>
                <div className="price">{formatPrice(course.price_cents, course.currency)}</div>
                <button className="btn teal" disabled={busy} onClick={buyCourse}>{busy ? 'Starting...' : 'Buy course'}</button>
              </>
            ) : (
              <button className="btn teal" disabled={busy} onClick={enrollFree}>{busy ? 'Enrolling...' : 'Enroll free'}</button>
            )}
          </div>
        </div>
        {notice && <div className="alert info mt">{notice}</div>}
        {error && <div className="alert error mt">{error}</div>}
      </div>

      {showManual && course.is_paid && !canView && (
        <ManualUnlockPanel courseId={course.id} course={course} onUnlocked={() => { setShowManual(false); setNotice('You are enrolled.'); load(); }} />
      )}

      <CourseMaterials courseId={course.id} canView={canView} />
      {canView && <CertificateCard courseId={course.id} />}

      <h2>Course outline</h2>
      <p className="small muted outline-hint">
        {canView
          ? 'Click any subtopic to read it on the page. Each one has its own PDF download at the end.'
          : course.is_paid
            ? 'Preview the full outline below. Buy the course to unlock reading and PDF downloads.'
            : 'Preview the full outline below. Enroll free to unlock reading and PDF downloads.'}
      </p>
      <div className="outline">
        {course.topics.map((t, i) => {
          const done = t.subtopics.filter((s) => s.completed).length;
          const total = t.subtopics.length;
          const pct = total ? Math.round((done / total) * 100) : 0;
          const firstId = t.subtopics[0]?.id;
          return (
            <section key={t.id} className={`card outline-topic ${canView ? '' : 'locked'}`}>
              <div className="outline-topic-head">
                <div className="outline-topic-title">
                  <span className="small muted">Topic {i + 1}</span>
                  <h3 style={{ margin: '2px 0' }}>{t.title} {!canView && <span className="lock-tag" aria-label="locked">🔒 Locked</span>}</h3>
                  {t.description && <p className="small muted" style={{ margin: 0 }}>{t.description}</p>}
                </div>
                <div className="outline-topic-meta">
                  {canView && total > 0 && <span className="small"><strong>{done}/{total}</strong> done</span>}
                  {t.quiz && <span className="small muted">Quiz: {t.quiz.title}</span>}
                </div>
              </div>
              {canView && total > 0 && <div className="progress outline-progress"><span style={{ width: `${pct}%` }} /></div>}
              <ol className="outline-subs">
                {t.subtopics.map((s, si) => {
                  const inner = (
                    <>
                      <span className={`outline-state ${canView ? (s.completed ? 'done' : 'open') : 'lock'}`} aria-hidden="true">
                        {canView ? (s.completed ? '✓' : '○') : '🔒'}
                      </span>
                      <span className="outline-sub-title">{si + 1}. {s.title}</span>
                      {canView && <span className="small muted outline-go">Read →</span>}
                    </>
                  );
                  return (
                    <li key={s.id}>
                      {canView ? (
                        <Link to={`/topics/${t.id}/sub/${s.id}`} className="outline-sub">{inner}</Link>
                      ) : (
                        <div className="outline-sub disabled">{inner}</div>
                      )}
                    </li>
                  );
                })}
              </ol>
              {canView && firstId && (
                <div className="outline-topic-foot">
                  <Link to={`/topics/${t.id}/sub/${firstId}`} className="btn small">{done > 0 && done < total ? 'Continue topic' : 'Open topic'}</Link>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
