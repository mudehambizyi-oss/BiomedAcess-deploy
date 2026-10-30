import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import db, { SCHEMA, UPLOAD_DIR, DB_PATH, stmt } from './db.js';
import { COURSES } from './seed-data.js';
import { COMMUNITIES, CASE_STUDIES, COMMUNITY_THREADS, DEMO_COMMUNITY_MEMBERS } from './seed-extra.js';
import { makePdf } from './lib/pdf.js';

const reset = process.argv.includes('--reset');

if (reset) {
  await db.exec(`PRAGMA foreign_keys=OFF; DROP TABLE IF EXISTS case_answers; DROP TABLE IF EXISTS case_attempts; DROP TABLE IF EXISTS case_questions; DROP TABLE IF EXISTS case_studies; DROP TABLE IF EXISTS replies; DROP TABLE IF EXISTS threads; DROP TABLE IF EXISTS community_members; DROP TABLE IF EXISTS communities; DROP TABLE IF EXISTS attempt_answers; DROP TABLE IF EXISTS quiz_attempts; DROP TABLE IF EXISTS questions; DROP TABLE IF EXISTS quizzes; DROP TABLE IF EXISTS comments; DROP TABLE IF EXISTS resources; DROP TABLE IF EXISTS subtopics; DROP TABLE IF EXISTS topics; DROP TABLE IF EXISTS enrollments; DROP TABLE IF EXISTS progress; DROP TABLE IF EXISTS activity; DROP TABLE IF EXISTS payments; DROP TABLE IF EXISTS courses; PRAGMA foreign_keys=ON;`);
  await db.exec(SCHEMA);
  for (const f of fs.readdirSync(UPLOAD_DIR)) {
    if (f.startsWith('seed-')) fs.rmSync(path.join(UPLOAD_DIR, f));
  }
  console.log(`reset database at ${DB_PATH}`);
}

// Users: demo admin + demo student (only created if missing)
async function ensureUser(email, name, role, password) {
  const existing = (await db.get('SELECT id FROM users WHERE email = ?', [email]));
  if (existing) return existing.id;
  const hash = bcrypt.hashSync(password, 10);
  return (await db.run('INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)', [email, hash, name, role])).lastInsertRowid;
}
const adminId = await ensureUser('admin@biomedaccess.local', 'Platform Admin', 'admin', 'admin1234');
await ensureUser('student@biomedaccess.local', 'Demo Student', 'student', 'student1234');

const courseCount = (await db.get('SELECT COUNT(*) AS n FROM courses', [])).n;
if (courseCount > 0) {
  console.log('courses already present; skipping course seed (use --reset to rebuild)');
} else {
  const insCourse = stmt('INSERT INTO courses (slug, title, description, level, is_paid, price_cents, position) VALUES (?,?,?,?,?,?,?)');
  const insTopic = stmt('INSERT INTO topics (course_id, title, description, position) VALUES (?,?,?,?)');
  const insSub = stmt('INSERT INTO subtopics (topic_id, title, body, position) VALUES (?,?,?,?)');
  const insRes = stmt('INSERT INTO resources (subtopic_id, title, kind, file_path, original_name, mime, size, uploaded_by) VALUES (?,?,?,?,?,?,?,?)');
  const insQuiz = stmt('INSERT INTO quizzes (topic_id, title) VALUES (?,?)');
  const insQ = stmt('INSERT INTO questions (quiz_id, prompt, options, correct_index, explanation, position) VALUES (?,?,?,?,?,?)');

  for (const [ci, c] of COURSES.entries()) {
    const courseId = (await insCourse.run(c.slug, c.title, c.description, c.level, c.is_paid, c.price_cents, ci)).lastInsertRowid;
    for (const [ti, t] of c.topics.entries()) {
      const topicId = (await insTopic.run(courseId, t.title, t.description, ti)).lastInsertRowid;
      for (const [si, s] of t.subtopics.entries()) {
        const subId = (await insSub.run(topicId, s.title, s.body, si)).lastInsertRowid;
        const fname = `seed-${c.slug}-${topicId}-${subId}.pdf`;
        const pdf = makePdf(s.title, s.notes);
        fs.writeFileSync(path.join(UPLOAD_DIR, fname), pdf);
        (await insRes.run(subId, `${s.title} (lecture notes)`, 'pdf', fname, `${c.slug}-${subId}-notes.pdf`, 'application/pdf', pdf.length, adminId));
      };
      if (t.quiz) {
        const quizId = (await insQuiz.run(topicId, t.quiz.title)).lastInsertRowid;
        for (const [qi, q] of t.quiz.questions.entries()) {
          (await insQ.run(quizId, q.prompt, JSON.stringify(q.options), q.correct, q.explanation, qi));
        };
      }
    };
  };
  console.log(`seeded ${COURSES.length} courses`);
}

const demoStudent = (await db.get("SELECT id FROM users WHERE email = 'student@biomedaccess.local'", []));
console.log('seed complete. demo admin: admin@biomedaccess.local / admin1234; demo student: student@biomedaccess.local / student1234 (admin id ' + adminId + ', student id ' + demoStudent.id + ')');

// Communities, threads and case studies (only when empty)
if ((await db.get('SELECT COUNT(*) n FROM communities', [])).n === 0) {
  const insC = stmt('INSERT INTO communities (slug, name, description, tag) VALUES (?,?,?,?)');
  const ids = {};
  for (const c of COMMUNITIES) ids[c.slug] = (await insC.run(c.slug, c.name, c.description, c.tag)).lastInsertRowid;
  const studentId = (await db.get("SELECT id FROM users WHERE email = 'student@biomedaccess.local'", []))?.id;
  const insT = stmt('INSERT INTO threads (community_id, user_id, title, body) VALUES (?,?,?,?)');
  const insR = stmt('INSERT INTO replies (thread_id, user_id, body) VALUES (?,?,?)');
  const insM = stmt('INSERT OR IGNORE INTO community_members (community_id, user_id) VALUES (?,?)');
  for (const t of COMMUNITY_THREADS) {
    const tid = (await insT.run(ids[t.community], studentId || adminId, t.title, t.body)).lastInsertRowid;
    for (const r of t.replies) { await insR.run(tid, adminId, r); };
  }
  for (const email of DEMO_COMMUNITY_MEMBERS) {
    const uid = (await db.get('SELECT id FROM users WHERE email = ?', [email]))?.id;
    if (uid) for (const id of Object.values(ids)) (await insM.run(id, uid));
  }
  console.log(`seeded ${COMMUNITIES.length} communities with threads`);
}
if ((await db.get('SELECT COUNT(*) n FROM case_studies', [])).n === 0) {
  const insCase = stmt('INSERT INTO case_studies (slug, title, specialty, patient, presentation, vitals, published) VALUES (?,?,?,?,?,?,1)');
  const insQ = stmt('INSERT INTO case_questions (case_id, stage, prompt, options, correct_index, explanation, position) VALUES (?,?,?,?,?,?,?)');
  for (const c of CASE_STUDIES) {
    const cid = (await insCase.run(c.slug, c.title, c.specialty, c.patient, c.presentation, c.vitals)).lastInsertRowid;
    for (const [i, q] of c.questions.entries()) { await insQ.run(cid, q.stage, q.prompt, JSON.stringify(q.options), q.correct_index, q.explanation, i); };
  };
  console.log(`seeded ${CASE_STUDIES.length} case studies`);
}
