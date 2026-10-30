import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import db, { stmt } from '../db.js';
import { signToken, requireAuth, JWT_SECRET } from '../lib/auth.js';

const router = Router();

router.post('/signup', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const name = String(req.body?.name || '').trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  if (!name) return res.status(400).json({ error: 'Please enter your name.' });
  if ((await db.get('SELECT 1 FROM users WHERE email = ?', [email]))) return res.status(409).json({ error: 'An account with this email already exists.' });
  const hash = bcrypt.hashSync(password, 10);
  const id = (await db.run('INSERT INTO users (email, password_hash, name, role) VALUES (?,?,?,?)', [email, hash, name, 'student'])).lastInsertRowid;
  const user = (await db.get('SELECT id, email, name, role FROM users WHERE id = ?', [id]));
  res.status(201).json({ token: signToken(user), user });
});

router.post('/login', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const row = (await db.get('SELECT * FROM users WHERE email = ?', [email]));
  if (!row || !bcrypt.compareSync(password, row.password_hash)) return res.status(401).json({ error: 'Incorrect email or password.' });
  const user = { id: row.id, email: row.email, name: row.name, role: row.role };
  res.json({ token: signToken(user), user });
});

router.get('/me', requireAuth, (req, res) => {
  res.json(req.user);
});


// Telegram Mini App login: verify initData signature, upsert user, return app JWT.
router.post('/telegram', async (req, res) => {
  const initData = String(req.body?.initData || '');
  if (!initData) return res.status(400).json({ error: 'Missing Telegram data.' });
  const token = process.env.BOT_TOKEN;
  if (!token) return res.status(500).json({ error: 'Telegram login is not configured.' });
  const secret = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  params.delete('hash');
  params.sort();
  const check = crypto.createHmac('sha256', secret).update(params.toString()).digest('hex');
  if (check !== hash) return res.status(401).json({ error: 'Telegram verification failed.' });
  const user = JSON.parse(params.get('user') || '{}');
  if (!user.id) return res.status(400).json({ error: 'No Telegram user.' });
  const email = `tg${user.id}@telegram.biomedaccess`;
  let row = (await db.get('SELECT id, email, name, role FROM users WHERE email = ?', [email]));
  if (!row) {
    const id = (await db.run('INSERT INTO users (email, password_hash, name, role) VALUES (?,?,?,?,?)'.replace('(?,?,?,?,?)','(?,?,?,?)'), [email, 'telegram', (user.first_name || '') + ' ' + (user.last_name || '') || 'Telegram user', 'student'])).lastInsertRowid;
    row = { id, email, name: (user.first_name || '') + ' ' + (user.last_name || '') || 'Telegram user', role: 'student' };
  }
  res.json({ token: signToken(row), user: { id: row.id, email: row.email, name: row.name, role: row.role } });
});

export default router;

// Firebase Google sign-in: verify the Google ID token (Firebase issues real Google tokens), then issue our JWT
router.post('/firebase', async (req, res) => {
  try {
    const { accessToken, idToken } = req.body || {};
    let email = null; let name = null;
    // Path 1: Google OAuth access token
    if (accessToken) {
      const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: 'Bearer ' + accessToken } });
      if (r.ok) {
        const info = await r.json();
        if (info.email && info.email_verified !== false) { email = String(info.email).toLowerCase(); name = info.name; }
      }
    }
    // Path 2: Firebase ID token, verified against Google's public certs
    if (!email && idToken) {
      try {
        const jwt = (await import('jsonwebtoken')).default;
        const dec = jwt.decode(idToken, { complete: true });
        const PROJECT = process.env.FIREBASE_PROJECT_ID || 'biomedaccess-15ef1';
        if (dec && dec.payload.iss === 'https://securetoken.google.com/' + PROJECT && dec.payload.aud === PROJECT) {
          const certsRes = await fetch('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com');
          const certs = await certsRes.json();
          const cert = certs[dec.header.kid];
          if (cert) {
            const payload = jwt.verify(idToken, cert, { issuer: 'https://securetoken.google.com/' + PROJECT, audience: PROJECT });
            if (payload.email && payload.email_verified !== false && payload.email_verified !== 'false') {
              email = String(payload.email).toLowerCase(); name = payload.name;
            }
          }
        }
      } catch (ve) { console.error('idToken verify failed:', ve.message); }
    }
    if (!email) return res.status(401).json({ error: 'Could not verify your Google sign-in. Try again.' });
    let user = (await db.get('SELECT * FROM users WHERE email = ?', [email]));
    if (!user) {
      const uname = name || email.split('@')[0];
      const ins = stmt('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)');
      const r2 = (await ins.run(uname, email, 'firebase-google', 'student'));
      user = { id: r2.lastInsertRowid, name: uname, email, role: 'student' };
    }
    const token = signToken({ id: user.id, role: user.role });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Google sign-in failed' }); }
});



// ---- Google OAuth sign-up / sign-in (server-side flow) ----
// Needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the environment. If they are absent,
// everything here reports "not configured" and nothing else in the app changes.
const googleEnabled = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

function googleRedirectUri(req) {
  const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'https').split(',')[0].trim();
  return `${proto}://${req.headers.host}/api/auth/google/callback`;
}

router.get('/google/config', (_req, res) => {
  res.json({ enabled: googleEnabled() });
});

router.get('/google', (req, res) => {
  if (!googleEnabled()) return res.redirect('/login?google_error=' + encodeURIComponent('Google sign-in is not set up yet. Use email for now.'));
  const state = jwt.sign({ purpose: 'google_oauth' }, JWT_SECRET, { expiresIn: '10m' });
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: googleRedirectUri(req),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  });
  res.redirect('https://accounts.google.com/o/oauth2/v2/auth?' + params.toString());
});

router.get('/google/callback', async (req, res) => {
  const fail = (msg) => res.redirect('/login?google_error=' + encodeURIComponent(msg));
  try {
    if (!googleEnabled()) return fail('Google sign-in is not set up yet. Use email for now.');
    if (req.query.error) return fail('Google sign-in was cancelled.');
    const code = String(req.query.code || '');
    const state = String(req.query.state || '');
    try { jwt.verify(state, JWT_SECRET); } catch { return fail('Google sign-in expired. Please try again.'); }
    if (!code) return fail('Google sign-in failed. Please try again.');

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: googleRedirectUri(req),
        grant_type: 'authorization_code',
      }),
    });
    const tokenData = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('google token exchange failed:', tokenData.error || tokenRes.status);
      return fail('Google sign-in failed. Please try again.');
    }

    const infoRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: 'Bearer ' + tokenData.access_token },
    });
    const info = await infoRes.json().catch(() => ({}));
    if (!infoRes.ok || !info.email) return fail('Could not read your Google account. Please try again.');
    if (info.email_verified === false) return fail('Please verify your Google email first.');

    const email = String(info.email).trim().toLowerCase();
    const name = String(info.name || '').trim() || email.split('@')[0];
    let row = (await db.get('SELECT * FROM users WHERE email = ?', [email]));
    if (!row) {
      // Random unusable hash: this account signs in with Google only (email login stays blocked until a password reset).
      const hash = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 10);
      const id = (await db.run('INSERT INTO users (email, password_hash, name, role) VALUES (?,?,?,?)', [email, hash, name, 'student'])).lastInsertRowid;
      row = (await db.get('SELECT * FROM users WHERE id = ?', [id]));
    }
    const user = { id: row.id, email: row.email, name: row.name, role: row.role };
    const token = signToken(user);
    // Hand the token to the frontend in the URL fragment (never sent to servers again).
    res.redirect('/login#google_token=' + encodeURIComponent(token));
  } catch (e) {
    console.error('google callback error:', e);
    fail('Google sign-in failed. Please try again.');
  }
});
