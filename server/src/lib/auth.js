import jwt from 'jsonwebtoken';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import db, { DATA_DIR } from '../db.js';

function loadSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  const file = path.join(DATA_DIR, '.jwt_secret');
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8').trim();
  const secret = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(file, secret, { mode: 0o600 });
  return secret;
}
export const JWT_SECRET = loadSecret();

export function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
}

async function readUser(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = (await db.get('SELECT id, email, name, role, created_at FROM users WHERE id = ?', [payload.sub]));
    return user || null;
  } catch {
    return null;
  }
}

export async function optionalAuth(req, _res, next) {
  try { req.user = await readUser(req); } catch (e) { return next(e); }
  next();
}

export async function requireAuth(req, res, next) {
  try { req.user = await readUser(req); } catch (e) { return next(e); }
  if (!req.user) return res.status(401).json({ error: 'Please log in to continue.' });
  next();
}

export async function requireModerator(req, res, next) {
  try { req.user = await readUser(req); } catch (e) { return next(e); }
  if (!req.user) return res.status(401).json({ error: 'Please log in to continue.' });
  if (!['moderator', 'admin'].includes(req.user.role)) return res.status(403).json({ error: 'Moderators only.' });
  next();
}

// Content authoring is available to tutors, moderators, and admins. Keep admin-only routes
// such as user management, analytics, and settings behind requireAdmin.
export async function requireContentManager(req, res, next) {
  try { req.user = await readUser(req); } catch (e) { return next(e); }
  if (!req.user) return res.status(401).json({ error: 'Please log in to continue.' });
  if (!['tutor', 'moderator', 'admin'].includes(req.user.role)) return res.status(403).json({ error: 'Tutors only.' });
  next();
}

// Exams were admin-only. Tutors may author/manage them, while moderator access is unchanged.
export async function requireAdminOrTutor(req, res, next) {
  try { req.user = await readUser(req); } catch (e) { return next(e); }
  if (!req.user) return res.status(401).json({ error: 'Please log in to continue.' });
  if (!['tutor', 'admin'].includes(req.user.role)) return res.status(403).json({ error: 'Tutors only.' });
  next();
}

export async function requireAdmin(req, res, next) {
  try { req.user = await readUser(req); } catch (e) { return next(e); }
  if (!req.user) return res.status(401).json({ error: 'Please log in to continue.' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only.' });
  next();
}
