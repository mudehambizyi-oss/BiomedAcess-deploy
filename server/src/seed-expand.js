// Idempotent expansion seed: adds courses, topics (with one content stub each),
// and communities. Safe to run on every boot: every insert is guarded by a
// lookup on the natural key (course slug, topic title within course,
// subtopic title within topic, community slug). Existing rows are never changed.
import db, { stmt } from './db.js';
import { EXPANSION_COURSES, EXPANSION_COMMUNITIES } from './seed-expand-data.js';

export async function runExpansionSeed(log = console.log) {
  const counts = { courses: 0, topics: 0, subtopics: 0, communities: 0 };

  const findCourse = stmt('SELECT id FROM courses WHERE slug = ?');
  const insCourse = stmt('INSERT INTO courses (slug, title, description, level, is_paid, price_cents, published, position) VALUES (?,?,?,?,0,0,1,?)');
  const findTopic = stmt('SELECT id FROM topics WHERE course_id = ? AND title = ?');
  const insTopic = stmt('INSERT INTO topics (course_id, title, description, position) VALUES (?,?,?,?)');
  const findSub = stmt('SELECT id FROM subtopics WHERE topic_id = ? AND title = ?');
  const insSub = stmt('INSERT INTO subtopics (topic_id, title, body, position) VALUES (?,?,?,?)');
  const findComm = stmt('SELECT id FROM communities WHERE slug = ?');
  const insComm = stmt('INSERT INTO communities (slug, name, description, tag) VALUES (?,?,?,?)');

  await db.tx(async () => {
    for (const [ci, c] of EXPANSION_COURSES.entries()) {
      let course = (await findCourse.get(c.slug));
      if (!course) {
        const id = (await insCourse.run(c.slug, c.title, c.description, c.level, 100 + ci)).lastInsertRowid;
        course = { id };
        counts.courses++;
      }
      for (const [ti, t] of c.topics.entries()) {
        let topic = (await findTopic.get(course.id, t.title));
        if (!topic) {
          const id = (await insTopic.run(course.id, t.title, t.description, ti)).lastInsertRowid;
          topic = { id };
          counts.topics++;
        }
        if (!(await findSub.get(topic.id, `${t.title}: overview`))) {
          (await insSub.run(topic.id, `${t.title}: overview`, t.body, 0));
          counts.subtopics++;
        }
      };
    };
    for (const m of EXPANSION_COMMUNITIES) {
      if (!(await findComm.get(m.slug))) {
        (await insComm.run(m.slug, m.name, m.description, m.tag));
        counts.communities++;
      }
    }
  });
  log(`expansion seed: added ${counts.courses} courses, ${counts.topics} topics, ${counts.subtopics} subtopics, ${counts.communities} communities (existing rows untouched)`);
  return counts;
}

// CLI: node src/seed-expand.js  (uses DATA_DIR / DB path from db.js)
if (import.meta.url === `file://${process.argv[1]}`) {
  runExpansionSeed();
}
