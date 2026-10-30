import path from 'node:path';
import multer from 'multer';
import { extractText, getDocumentProxy } from 'unpdf';

// Bulk notes: turn one long .txt / .md / .pdf document into topics and subtopics.
// Rules (applied line by line):
//   topic heading    = "# Title", an ALL-CAPS line, or "Topic N" / "Chapter N" / "Module N" / "Unit N" / "Lesson N"
//   subtopic heading = "## Title", "### Title", or a numbered line like "1.2 Title"
// Text before the first subtopic heading of a topic becomes that topic's intro subtopic.
// A topic with no subtopic headings becomes one subtopic that carries the topic's whole text.

export const BULK_MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED_EXT = new Set(['.txt', '.md', '.markdown', '.pdf']);
const MIN_WORDS_SUBTOPIC = 1;

const bulkMulter = multer({ storage: multer.memoryStorage(), limits: { fileSize: BULK_MAX_BYTES } }).single('file');
// Multer middleware that answers upload errors (too large, bad form) with JSON instead of an HTML 500.
export const bulkUpload = (req, res, next) => bulkMulter(req, res, (err) => {
  if (err) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'File is larger than 15 MB.' : (err.message || 'Upload failed.') });
  next();
});

export const wordCount = (s) => String(s || '').split(/\s+/).filter(Boolean).length;

const cleanTitle = (s) => String(s || '')
  .replace(/^#+\s*/, '')
  .replace(/^\*+|\*+$/g, '')
  .replace(/^_+|_+$/g, '')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, 200);

function isAllCapsHeading(line) {
  if (/[a-z]/.test(line)) return false;
  if (/[.;,:!?]$/.test(line)) return false;
  const letters = line.replace(/[^A-Za-z]/g, '');
  return letters.length >= 5 && line.length <= 80 && /^[A-Z0-9 ,:&()'\-/]+$/.test(line);
}

// Returns { level: 'topic'|'subtopic', title } or null
export function classifyLine(rawLine) {
  const line = rawLine.trim();
  if (!line) return null;
  const md1 = line.match(/^#\s+(.+)$/);
  if (md1) { const t = cleanTitle(md1[1]); return t ? { level: 'topic', title: t } : null; }
  const md2 = line.match(/^#{2,6}\s+(.+)$/);
  if (md2) { const t = cleanTitle(md2[1]); return t ? { level: 'subtopic', title: t } : null; }
  const chap = line.match(/^(?:topic|chapter|module|unit|lesson)\s+\d+\b[\s:.\-]*(.*)$/i);
  if (chap && line.length <= 140) return { level: 'topic', title: cleanTitle(line) };
  if (isAllCapsHeading(line)) return { level: 'topic', title: cleanTitle(line) };
  const num = line.match(/^(\d+\.\d+(?:\.\d+)*)\.?\s+(\S.{0,130})$/);
  if (num && !/[;,]$/.test(line)) return { level: 'subtopic', title: cleanTitle(`${num[1]} ${num[2]}`) };
  return null;
}

function tidyBody(lines) {
  return lines.join('\n')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Pure function: text in, structure out. Used by both preview and import so indexes line up.
export function parseBulkNotes(text, fallbackTitle = 'Notes') {
  const warnings = [];
  const src = String(text || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  if (!src.trim()) throw new Error('The file is empty.');

  const topics = [];
  let topic = null;
  let section = null;
  const ensureTopic = (title) => {
    topic = { title, subs: [{ title: null, lines: [] }] };
    section = topic.subs[0];
    topics.push(topic);
  };

  let headingsTopic = 0;
  let headingsSub = 0;
  for (const line of src.split('\n')) {
    const h = classifyLine(line);
    if (h?.level === 'topic') {
      headingsTopic++;
      ensureTopic(h.title);
    } else if (h?.level === 'subtopic') {
      headingsSub++;
      if (!topic) ensureTopic(fallbackTitle);
      section = { title: h.title, lines: [] };
      topic.subs.push(section);
    } else {
      if (!topic) ensureTopic(fallbackTitle);
      section.lines.push(line);
    }
  }

  if (headingsTopic === 0 && headingsSub === 0) {
    warnings.push('No headings found. The whole document was imported as one topic with one subtopic. Add "#" headings or Chapter/Topic lines for a better split.');
  }

  const out = [];
  for (const t of topics) {
    const titled = t.subs.filter((s) => s.title !== null);
    const intro = t.subs[0].title === null ? tidyBody(t.subs[0].lines) : '';
    const subs = [];
    if (titled.length === 0) {
      subs.push({ title: t.title, body: intro });
    } else {
      if (intro) subs.push({ title: t.title, body: intro });
      for (const s of titled) subs.push({ title: s.title, body: tidyBody(s.lines) });
    }
    const kept = [];
    for (const s of subs) {
      const words = wordCount(s.body);
      if (words < MIN_WORDS_SUBTOPIC) { warnings.push(`Skipped empty subtopic "${s.title}".`); continue; }
      kept.push({ title: s.title, body: s.body, words });
    }
    if (kept.length === 0) { warnings.push(`Skipped topic "${t.title}" because it has no text.`); continue; }
    out.push({ title: t.title, subtopics: kept, words: kept.reduce((a, s) => a + s.words, 0) });
  }

  if (out.length === 0) throw new Error('No readable text was found in this file.');
  const total = out.reduce((a, t) => a + t.words, 0);
  if (total < 20) warnings.push('This document has very little text.');
  return { topics: out, warnings, word_count: total, topic_headings: headingsTopic, subtopic_headings: headingsSub };
}

// Reads the uploaded buffer as plain text (PDF text extracted in pure JS via unpdf).
export async function readUploadedText(file) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (!ALLOWED_EXT.has(ext)) throw new Error('Unsupported file. Upload a .txt, .md or .pdf file.');
  if (ext === '.pdf') {
    if (file.buffer.subarray(0, 4).toString('latin1') !== '%PDF') throw new Error('This does not look like a valid PDF.');
    try {
      const pdf = await getDocumentProxy(new Uint8Array(file.buffer));
      const { text } = await extractText(pdf, { mergePages: true });
      // Drop bare page footers ("1 / 1", "Page 3", "3") that PDF text extraction leaves behind.
      const cleaned = String(text || '').split('\n').filter((l) => !/^\s*(page\s+)?\d+(\s*\/\s*\d+)?\s*$/i.test(l)).join('\n');
      return { text: cleaned, format: 'pdf' };
    } catch (e) {
      throw new Error(`Could not read this PDF (${e.message}). If it is a scanned image, copy the text into a .txt or .md file.`);
    }
  }
  return { text: file.buffer.toString('utf8'), format: ext.slice(1) };
}

export const baseTitle = (name) => cleanTitle(path.parse(String(name || 'Notes')).name) || 'Notes';
