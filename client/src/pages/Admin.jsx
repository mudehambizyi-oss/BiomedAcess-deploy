import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import AdminMaterials from '../components/AdminMaterials.jsx';
import Announcements from '../components/Announcements.jsx';
import { AdminPayments } from '../components/ManualUnlock.jsx';
import InstantNotesUpload from '../components/InstantNotesUpload.jsx';
import AdminContent from '../components/AdminContent.jsx';

// Admin dashboard: course/topic/resource/quiz management, user list, uploads, platform stats.
export default function Admin() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [students, setStudents] = useState([]);
  const [studentSort, setStudentSort] = useState('quiz');
  const [courses, setCourses] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [course, setCourse] = useState({ title: '', description: '', level: 'Beginner', is_paid: false, price_cents: 0 });
  const [selCourse, setSelCourse] = useState('');
  const [topic, setTopic] = useState({ title: '' });
  const [sub, setSub] = useState({ topic_id: '', title: '', content: '' });
  const [upload, setUpload] = useState({ subtopic_id: '', title: '', file: null });
  const [tab, setTab] = useState('overview');

  const load = () => {
    const requests = user?.role === 'admin'
      ? Promise.all([api('/admin/stats'), api('/admin/users'), api('/admin/courses'), api('/admin/analytics'), api('/admin/students')])
      : Promise.all([Promise.resolve(null), Promise.resolve([]), api('/admin/courses'), Promise.resolve(null), Promise.resolve([])]);
    return requests.then(async ([s, u, c, a, st]) => {
      const full = await Promise.all(c.map((x) => api(`/courses/${x.id}`).then((d) => ({ ...x, topics: d.topics })).catch(() => ({ ...x, topics: [] }))));
      setStats(s); setUsers(u); setStudents(st); setCourses(full); setAnalytics(a);
    }).catch((e) => setError(e.message));
  };
  useEffect(() => { load(); }, [user?.role]);

  const run = async (fn, ok) => {
    setError(''); setMsg('');
    try { await fn(); setMsg(ok); load(); } catch (e) { setError(e.message); }
  };

  const topics = courses.flatMap((c) => (c.topics || []).map((t) => ({ ...t, course: c.title })));
  const subtopics = courses.flatMap((c) => (c.topics || []).flatMap((t) => (t.subtopics || []).map((s) => ({ ...s, topic: t.title, course: c.title }))));

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <h1>{user?.role === 'admin' ? 'Admin dashboard' : user?.role === 'tutor' ? 'Tutor dashboard' : 'Moderator dashboard'}</h1>
          <p className="muted">{user?.role === 'admin' ? 'Manage courses, content, quizzes and learners.' : user?.role === 'tutor' ? 'Manage your courses, learning materials, quizzes and exams.' : 'Manage learning content and communities.'}</p>
        </div>
      </div>
      {error && <div className="error">{error}</div>}
      {msg && <div className="info">{msg}</div>}

{user?.role === 'admin' && <>
          <div className="row" style={{ gap: 8, margin: '12px 0' }}>
            <button className={`btn small ${tab === 'overview' ? 'teal' : 'ghost'}`} onClick={() => setTab('overview')}>Overview</button>
            <button className={`btn small ${tab === 'payments' ? 'teal' : 'ghost'}`} onClick={() => setTab('payments')}>Payments / Requests</button>
            <button className={`btn small ${tab === 'content' ? 'teal' : 'ghost'}`} onClick={() => setTab('content')}>Communities, cases & contact</button>
          </div>
          {tab === 'payments' && <AdminPayments />}
          {tab === 'content' && <AdminContent />}
        </>}

      {(user?.role !== 'admin' || tab === 'overview') && <>

      {stats && (
        <div className="grid cols-4 stat-row">
          <div className="card stat"><span className="small muted">Students</span><strong>{stats.students}</strong></div>
          <div className="card stat"><span className="small muted">Courses</span><strong>{stats.courses}</strong></div>
          <div className="card stat"><span className="small muted">Enrollments</span><strong>{stats.enrollments}</strong></div>
          <div className="card stat"><span className="small muted">Avg quiz score</span><strong>{stats.avg_score ?? 'n/a'}</strong></div>
        </div>
      )}

      {user?.role === 'admin' && (() => {
        const activeSince = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const activeCount = students.filter((s) => s.last_active && Date.parse(`${String(s.last_active).replace(' ', 'T')}Z`) >= activeSince).length;
        const sorted = [...students].sort((a, b) => {
          if (studentSort === 'active') return (Date.parse(`${String(b.last_active || '').replace(' ', 'T')}Z`) || 0) - (Date.parse(`${String(a.last_active || '').replace(' ', 'T')}Z`) || 0);
          const field = studentSort === 'exam' ? 'exam_avg_percent' : 'quiz_avg_percent';
          return (Number(b[field]) || -1) - (Number(a[field]) || -1);
        });
        const formatDate = (value) => value ? new Date(`${String(value).replace(' ', 'T')}Z`).toLocaleDateString() : 'Never';
        const pct = (value) => value == null ? 'n/a' : `${value}%`;
        return <section className="card" style={{ marginBottom: 16 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div><h2>Student performance</h2><p className="small muted">Quiz and exam results, course enrollment, and recent activity.</p></div>
            <label className="small">Sort by{' '}
              <select className="input small" value={studentSort} onChange={(e) => setStudentSort(e.target.value)}>
                <option value="quiz">Quiz average</option><option value="exam">Exam average</option><option value="active">Last active</option>
              </select>
            </label>
          </div>
          <div className="grid cols-3 stat-row" style={{ margin: '12px 0 18px' }}>
            <div className="card stat"><span className="small muted">Total students</span><strong>{students.length}</strong></div>
            <div className="card stat"><span className="small muted">Active in last 7 days</span><strong>{activeCount}</strong></div>
            <div className="card stat"><span className="small muted">Average quiz score</span><strong>{pct(stats?.avg_quiz_percent)}</strong></div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="table small">
              <thead><tr><th>Student</th><th>Courses</th><th>Quizzes</th><th>Quiz avg</th><th>Exams</th><th>Exam avg</th><th>Last active</th><th></th></tr></thead>
              <tbody>
                {sorted.map((s) => <tr key={s.id}>
                  <td>{s.name}<div className="muted">{s.email}</div></td><td>{s.enrollments}</td><td>{s.quizzes_taken}</td><td>{pct(s.quiz_avg_percent)}</td><td>{s.exams_taken}</td><td>{pct(s.exam_avg_percent)}</td><td>{formatDate(s.last_active)}</td>
                  <td><button className="btn ghost small" onClick={() => {
                    if (window.confirm(`Delete ${s.name || s.email}'s student account and learning records? This cannot be undone.`)) {
                      run(() => api(`/admin/users/${s.id}`, { method: 'DELETE' }), 'Student account deleted.');
                    }
                  }}>Remove</button></td>
                </tr>)}
                {!sorted.length && <tr><td colSpan="8" className="muted">No students yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>;
      })()}

      <div className="split">
        <section className="stack">
          <div className="card">
            <h2>Courses</h2>
            <table className="table">
              <thead><tr><th>Title</th><th>Level</th><th>Status</th><th>Enrolled</th><th></th></tr></thead>
              <tbody>
                {courses.map((c) => (
                  <tr key={c.id}>
                    <td><Link to={`/courses/${c.id}`}>{c.title}</Link></td>
                    <td>{c.level}</td>
                    <td><span className={`badge ${c.published ? '' : 'warn'}`}>{c.published ? 'Published' : 'Draft'}</span></td>
                    <td>{c.enrollments ?? 'n/a'}</td>
                    <td><button className="btn ghost small" onClick={() => run(() => api(`/admin/courses/${c.id}`, { method: 'PATCH', body: { published: !c.published } }), 'Course updated.')}>{c.published ? 'Unpublish' : 'Publish'}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <form className="form-inline" onSubmit={(e) => { e.preventDefault(); run(() => api('/admin/courses', { method: 'POST', body: course }), 'Course created.'); }}>
              <input className="input" placeholder="Course title" required value={course.title} onChange={(e) => setCourse({ ...course, title: e.target.value })} />
              <input className="input" placeholder="Description" value={course.description} onChange={(e) => setCourse({ ...course, description: e.target.value })} />
              <select className="input" value={course.level} onChange={(e) => setCourse({ ...course, level: e.target.value })}>
                <option>Beginner</option><option>Intermediate</option><option>Advanced</option>
              </select>
              <button className="btn teal" type="submit">Add course</button>
            </form>
          </div>

          <InstantNotesUpload courses={courses} onImported={() => load()} />

          <div className="card">
            <h2>Topics and subtopics</h2>
            <form className="form-inline" onSubmit={(e) => { e.preventDefault(); run(() => api(`/admin/courses/${selCourse}/topics`, { method: 'POST', body: topic }), 'Topic added.'); setTopic({ title: '' }); }}>
              <select className="input" required value={selCourse} onChange={(e) => setSelCourse(e.target.value)}>
                <option value="">Choose course</option>
                {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
              <input className="input" placeholder="New topic title" required value={topic.title} onChange={(e) => setTopic({ title: e.target.value })} />
              <button className="btn ghost" type="submit">Add topic</button>
            </form>
            <form className="form-inline" onSubmit={(e) => { e.preventDefault(); run(() => api(`/admin/topics/${sub.topic_id}/subtopics`, { method: 'POST', body: { title: sub.title, content: sub.content } }), 'Subtopic added.'); setSub({ ...sub, title: '', content: '' }); }}>
              <select className="input" required value={sub.topic_id} onChange={(e) => setSub({ ...sub, topic_id: e.target.value })}>
                <option value="">Choose topic</option>
                {topics.map((t) => <option key={t.id} value={t.id}>{t.course}: {t.title}</option>)}
              </select>
              <input className="input" placeholder="Subtopic title" required value={sub.title} onChange={(e) => setSub({ ...sub, title: e.target.value })} />
              <button className="btn ghost" type="submit">Add subtopic</button>
            </form>
          </div>

          {user?.role === 'admin' && <Announcements admin />}

          <AdminMaterials courses={courses} onChanged={() => {}} />

          <div className="card">
            <h2>Upload material</h2>
            <form className="form-inline" onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData();
              form.append('file', upload.file);
              form.append('title', upload.title || upload.file?.name || 'Resource');
              run(() => api(`/admin/subtopics/${upload.subtopic_id}/resources`, { method: 'POST', form }), 'Resource uploaded.');
            }}>
              <select className="input" required value={upload.subtopic_id} onChange={(e) => setUpload({ ...upload, subtopic_id: e.target.value })}>
                <option value="">Choose subtopic</option>
                {subtopics.map((s) => <option key={s.id} value={s.id}>{s.course} / {s.title}</option>)}
              </select>
              <input className="input" placeholder="Title" value={upload.title} onChange={(e) => setUpload({ ...upload, title: e.target.value })} />
              <input className="input" type="file" required onChange={(e) => setUpload({ ...upload, file: e.target.files[0] })} />
              <button className="btn teal" type="submit">Upload</button>
            </form>
          </div>
        </section>

        <aside className="stack">
      {user?.role === 'admin' && <div className="card">
          <h2>Quiz accuracy by course</h2>
          {analytics?.courses?.length ? analytics.courses.map((c) => (
            <div key={c.id} className="score-line small"><span>{c.title}</span><strong>{c.quiz_avg_percent ?? 'n/a'}%</strong></div>
          )) : <p className="small muted">No quiz attempts yet.</p>}
        </div>}
          {user?.role === 'admin' && <div className="card">
            <h2>Users</h2>
            <table className="table small">
              <thead><tr><th>Name</th><th>Role</th><th>Courses</th><th>Manage role</th></tr></thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.name}<div className="muted">{u.email}</div></td>
                    <td>{u.role}</td>
                    <td>{u.enrollments ?? 0}</td>
                    <td>
                      <select
                        className="input small"
                        aria-label={`Role for ${u.name || u.email}`}
                        value={u.role}
                        disabled={Number(u.id) === Number(user?.id)}
                        onChange={(e) => run(() => api(`/admin/users/${u.id}/role`, { method: 'PATCH', body: { role: e.target.value } }), `${u.name || 'User'} role updated.`)}
                      >
                        <option value="student">Student</option>
                        <option value="moderator">Moderator</option>
                        <option value="tutor">Tutor</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>}
        </aside>
      </div>
      </>}
    </div>
  );
}
