// Idempotent case study seed: inserts any case whose slug is missing, with its questions.
// Existing cases (matched by slug) are never changed. Safe on every boot.
import db, { stmt } from './db.js';
import { EXTRA_CASE_STUDIES } from './seed-cases-data.js';

export async function runCaseSeed(log = console.log) {
  const findCase = stmt('SELECT id FROM case_studies WHERE slug = ?');
  const insCase = stmt('INSERT INTO case_studies (slug, title, specialty, patient, presentation, vitals, published) VALUES (?,?,?,?,?,?,1)');
  const insQ = stmt('INSERT INTO case_questions (case_id, stage, prompt, options, correct_index, explanation, position) VALUES (?,?,?,?,?,?,?)');
  let added = 0;
  await db.tx(async () => {
    for (const c of EXTRA_CASE_STUDIES) {
      if ((await findCase.get(c.slug))) continue;
      const cid = (await insCase.run(c.slug, c.title, c.specialty, c.patient, c.presentation, c.vitals)).lastInsertRowid;
      for (const [i, q] of c.questions.entries()) { await insQ.run(cid, q.stage, q.prompt, JSON.stringify(q.options), q.correct_index, q.explanation, i); };
      added++;
    }
  });
  log(`case seed: added ${added} case studies (existing slugs untouched)`);
  return added;
}

if (import.meta.url === `file://${process.argv[1]}`) runCaseSeed();
