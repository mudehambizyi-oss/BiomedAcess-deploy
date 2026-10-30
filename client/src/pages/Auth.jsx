import React, { useState } from 'react';
import '../auth.css';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { api, setToken } from '../api.js';

// Same Unsplash lab photo used as the landing hero (Landing.jsx HERO_BG).
const AUTH_PHOTO = 'https://images.unsplash.com/photo-1582719471384-894fbb16e074?w=1800&q=70&auto=format&fit=crop';

function AuthShell({ title, sub, children, footer }) {
  return (
    <div className="auth-split">
      <aside className="auth-photo" style={{ backgroundImage: `url(${AUTH_PHOTO})` }} aria-hidden="true">
        <div className="auth-photo-copy">
          <span className="auth-photo-eyebrow">BiomedAccess</span>
          <h2>Built for the <span>Laboratory Scientist</span></h2>
          <p>Professional digital residency for biomedical sciences: courses, quizzes, communities and case studies in one place.</p>
        </div>
      </aside>
      <div className="auth-form-side">
        <div className="auth-wrap" style={{ minHeight: 0, padding: 0, background: 'none' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><img src="/images/logo.jpg" alt="BiomedAccess" style={{ width: 84, height: 84, borderRadius: 18, objectFit: 'cover' }} /></div>
          <div className="card auth-card">
            <h1>{title}</h1>
            <p className="sub">{sub}</p>
            {children}
            <div className="mt small muted" style={{ textAlign: 'center' }}>{footer}</div>
          </div>
        </div>
      </div>
    </div>
  );
}


// Server-side Google OAuth. Shows only when the server has GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET set.
// Returns null (so the old Firebase button keeps working) when they are not set.
function useGoogleServer() {
  const [enabled, setEnabled] = React.useState(false);
  React.useEffect(() => {
    api('/auth/google/config').then((d) => setEnabled(!!d?.enabled)).catch(() => setEnabled(false));
  }, []);
  return enabled;
}

function GoogleServerButton({ label }) {
  return (
    <a className="btn ghost" href="/api/auth/google" style={{ width: '100%', display: 'block', textAlign: 'center', textDecoration: 'none' }}>{label}</a>
  );
}

// Picks up the token the Google callback hands back (#google_token=...) or an error (?google_error=...)
function useGoogleReturn() {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [googleError, setGoogleError] = React.useState('');
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('google_error')) setGoogleError(params.get('google_error'));
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const tok = hash.get('google_token');
    if (tok) {
      window.history.replaceState(null, '', '/login');
      setToken(tok);
      api('/auth/me').then((u) => { setUser(u); navigate(u?.role === 'admin' ? '/admin' : '/dashboard', { replace: true }); })
        .catch(() => { setToken(null); setGoogleError('Google sign-in failed. Please try again.'); });
    }
  }, []);
  return googleError;
}

export function Login() {
  const { login, setUser } = useAuth();
  const googleServer = useGoogleServer();
  const googleReturnError = useGoogleReturn();
  async function loginWithFirebase(idToken) { await api('/auth/firebase', { method: 'POST', body: { idToken } }); }
  const navigate = useNavigate();
  const location = useLocation();
  React.useEffect(() => {
    (async () => {
      try {
        const { getRedirectResult } = await import('../lib/firebase.js');
        const { firebaseAuth } = await import('../lib/firebase.js');
        const res = await getRedirectResult(firebaseAuth);
        if (res && res.user) {
          const oc = (await import('../lib/firebase.js')).GoogleAuthProvider.credentialFromResult(res);
          const idToken = await res.user.getIdToken();
          const data = await api('/auth/firebase', { method: 'POST', body: { accessToken: oc?.accessToken, idToken } });
          setToken(data.token); setUser(data.user);
          navigate('/dashboard', { replace: true });
        }
      } catch (e) { /* silent */ }
    })();
  }, []);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      const u = await login(email, password);
      const home = u?.role === 'admin' ? '/admin' : '/dashboard';
      navigate(location.state?.from || home, { replace: true });
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  return (
    <AuthShell title="Welcome back" sub="Log in to continue your courses." footer={<>New here? <Link to="/signup">Create an account</Link></>}>
      {(error || googleReturnError) && <div className="alert error">{error || googleReturnError}</div>}
      {googleServer && <div className="mt"><GoogleServerButton label="Continue with Google" /></div>}
      <form onSubmit={submit}>
        <div className="field"><label>Email</label><input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></div>
        <div className="field"><label>Password</label><input className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></div>
        <button className="btn" style={{ width: '100%' }} disabled={busy}>{busy ? 'Logging in...' : 'Log in'}</button>
      </form>
      {!googleServer && <div className="row mt" style={{ justifyContent: 'center' }}>
        <button type="button" className="btn ghost" style={{ width: '100%' }} disabled={busy} onClick={async () => {
          setError(''); setBusy(true);
          try {
            const { signInWithPopup, GoogleAuthProvider, firebaseAuth } = await import('../lib/firebase.js');
            const cred = await signInWithPopup(firebaseAuth, new GoogleAuthProvider());
            const idToken = await cred.user.getIdToken();
            await loginWithFirebase(idToken);
            navigate('/dashboard', { replace: true });
          } catch (err) { setError(err.message || 'Google sign-in failed'); }
          finally { setBusy(false); }
        }}>Continue with Google</button>
      </div>}
    </AuthShell>
  );
}

export function Signup() {
  const { signup, setUser } = useAuth();
  const navigate = useNavigate();
  const googleServer = useGoogleServer();
  const googleReturnError = useGoogleReturn();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      await signup(name, email, password);
      navigate('/courses', { replace: true });
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  return (
    <AuthShell title="Create your account" sub="Free to join. Enroll in free courses instantly." footer={<>Already have an account? <Link to="/login">Log in</Link></>}>
      {(error || googleReturnError) && <div className="alert error">{error || googleReturnError}</div>}
      {googleServer && <div className="mt"><GoogleServerButton label="Continue with Google" /></div>}
      <form onSubmit={submit}>
        <div className="field"><label>Full name</label><input className="input" required value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="field"><label>Email</label><input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></div>
        <div className="field"><label>Password (8+ characters)</label><input className="input" type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" /></div>
        <button className="btn teal" style={{ width: '100%' }} disabled={busy}>{busy ? 'Creating account...' : 'Create account'}</button>
      </form>

      {!googleServer && <div className="row mt" style={{ justifyContent: 'center' }}>
        <button type="button" className="btn ghost" style={{ width: '100%' }} disabled={busy} onClick={async () => {
          setError(''); setBusy(true);
          try {
            const { signInWithPopup, GoogleAuthProvider, firebaseAuth } = await import('../lib/firebase.js');
            try {
              const cred = await signInWithPopup(firebaseAuth, new GoogleAuthProvider());
              const oc = GoogleAuthProvider.credentialFromResult(cred);
              const idToken = await cred.user.getIdToken();
              const data = await api('/auth/firebase', { method: 'POST', body: { accessToken: oc?.accessToken, idToken } });
              setToken(data.token); setUser(data.user);
              navigate('/dashboard', { replace: true });
            } catch (pe) {
              if (pe.code === 'auth/popup-blocked' || pe.code === 'auth/operation-not-supported-in-this-environment' || pe.code === 'auth/cancelled-popup-request') {
                const { signInWithRedirect, getRedirectResult } = await import('../lib/firebase.js');
                await signInWithRedirect(firebaseAuth, new GoogleAuthProvider());
              } else { throw pe; }
            }
          } catch (err) { setError(err.message || 'Google sign-in failed'); }
          finally { setBusy(false); }
        }}>Continue with Google</button>
      </div>}
          </AuthShell>
  );
}
