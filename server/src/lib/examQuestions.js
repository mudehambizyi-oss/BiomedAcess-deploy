// Exam questions: parse a .txt / .md / .pdf of multiple-choice questions into structured rows.
// Recognised shapes (line by line):
//   question start = "1. text", "1) text", "Q1. text", "Q1: text", "Question 1: text", or any line ending in "?" (when not inside options)
//   option         = "A. text", "B) text", "(C) text", "D: text", or a "- " / "* " / "• " bullet (options are labelled in order)
//   answer         = "Answer: B", "Answer - 2", "Correct answer: C" (letter, or 1-based number). Attaches to the current question.
// A question with no answer line gets correct_index null: it is kept, shown in the preview as needing a tutor's answer,
// and it is not scored when students submit.

export const EXAM_MAX_QUESTIONS = 1000;
export const EXAM_MAX_OPTIONS = 8;

const Q_START = /^\s*(?:Q\s*\d+\s*[.):\-]\s*|Question\s*\d+\s*[.):\-]?\s*|\d+\s*[.)]\s+)(\S.*)$/i;
const OPTION_LETTER = /^\s*\(?([A-Ea-e])\s*[.):]\s+(\S.*)$/;
const OPTION_BULLET = /^\s*[-*•]\s+(\S.*)$/;
const ANSWER = /^\s*(?:correct\s+)?answer(?:\s+key)?\s*[:\-]\s*(?:option\s+)?\(?\s*([A-Za-z0-9]{1,3})\b/i;

const clean = (s) => String(s ?? '').replace(/\*\*|__/g, '').replace(/\s+/g, ' ').trim();

// Pure function: text in, { questions, warnings, stats } out.
export function parseExamQuestions(text) {
  const warnings = [];
  const src = String(text || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  if (!src.trim()) throw new Error('The file is empty.');

  const questions = []; // { prompt, options: [], answerRaw: null, line }
  let cur = null;
  let skipped = 0;

  const startQuestion = (prompt, lineNo) => {
    cur = { prompt: clean(prompt), options: [], answerRaw: null, line: lineNo };
    questions.push(cur);
  };

  const lines = src.split('\n');
  lines.forEach((raw, idx) => {
    const lineNo = idx + 1;
    const line = raw.replace(/\s+$/, '');
    if (!line.trim()) return;

    const ans = line.replace(/\*\*/g, '').match(ANSWER);
    if (ans) {
      if (cur) cur.answerRaw = ans[1].toUpperCase();
      else skipped++;
      return;
    }

    const q = line.match(Q_START);
    if (q) { startQuestion(q[1], lineNo); return; }

    const opt = line.match(OPTION_LETTER) || null;
    const bullet = !opt ? line.match(OPTION_BULLET) : null;
    if (cur && (opt || bullet)) {
      const text = clean(opt ? opt[2] : bullet[1]);
      if (cur.options.length >= EXAM_MAX_OPTIONS) { warnings.push(`Question ${questions.indexOf(cur) + 1} has more than ${EXAM_MAX_OPTIONS} options; extra options were ignored.`); return; }
      cur.options.push(text);
      return;
    }

    // A line ending in "?" starts a new question once options have started, or when there is no current question.
    if (/\?\s*$/.test(line.trim()) && (!cur || cur.options.length > 0)) { startQuestion(line, lineNo); return; }

    if (cur) {
      // Continuation: wrapped option text, or a multi-line prompt before the options.
      if (cur.options.length > 0) cur.options[cur.options.length - 1] = clean(`${cur.options[cur.options.length - 1]} ${line}`);
      else cur.prompt = clean(`${cur.prompt} ${line}`);
      return;
    }
    skipped++; // intro text before the first question (title, instructions)
  });

  if (questions.length === 0) throw new Error('No questions were found. Start each question with a number ("1." or "Q1.") or end it with "?", and list options as "A. ... B. ...".');
  if (questions.length > EXAM_MAX_QUESTIONS) throw new Error(`This file has ${questions.length} questions. The limit is ${EXAM_MAX_QUESTIONS} per exam.`);

  let unmarked = 0;
  const out = questions.map((q, i) => {
    const n = i + 1;
    let correct = null;
    if (q.answerRaw) {
      const c = /^[A-E]$/.test(q.answerRaw) ? q.answerRaw.charCodeAt(0) - 65 : Number(q.answerRaw) - 1;
      if (Number.isInteger(c) && c >= 0 && c < q.options.length) correct = c;
      else warnings.push(`Question ${n}: the answer "${q.answerRaw}" does not match one of its options. It is left unmarked.`);
    }
    if (correct === null) unmarked++;
    if (!q.prompt) warnings.push(`Question ${n} has no prompt text.`);
    if (q.options.length < 2) warnings.push(`Question ${n} has fewer than 2 options. Fix the file before confirming.`);
    return { position: n, prompt: q.prompt, options: q.options, correct_index: correct };
  });

  if (unmarked > 0) warnings.push(`${unmarked} question${unmarked === 1 ? '' : 's'} have no usable answer. ${unmarked === 1 ? 'It' : 'They'} will be saved unmarked and not scored until a tutor marks ${unmarked === 1 ? 'it' : 'them'}.`);
  if (skipped > 0) warnings.push(`${skipped} line${skipped === 1 ? '' : 's'} before the first question or outside a question were skipped.`);

  const ready = out.every((q) => q.prompt && q.options.length >= 2);
  return {
    questions: out,
    warnings,
    ready,
    stats: { total: out.length, marked: out.length - unmarked, unmarked },
  };
}

// Validates a questions array coming from the client (the admin's confirmed preview). Returns { questions } or { error }.
export function normalizeExamQuestions(input) {
  if (!Array.isArray(input) || input.length === 0) return { error: 'Preview the questions file before creating the exam.' };
  if (input.length > EXAM_MAX_QUESTIONS) return { error: `An exam can have at most ${EXAM_MAX_QUESTIONS} questions.` };
  const out = [];
  for (let i = 0; i < input.length; i++) {
    const q = input[i] || {};
    const prompt = clean(q.prompt).slice(0, 2000);
    if (!prompt) return { error: `Question ${i + 1} has no prompt.` };
    if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > EXAM_MAX_OPTIONS) return { error: `Question ${i + 1} needs between 2 and ${EXAM_MAX_OPTIONS} options.` };
    const options = q.options.map((o) => clean(o).slice(0, 1000));
    if (options.some((o) => !o)) return { error: `Question ${i + 1} has an empty option.` };
    let correct = null;
    if (q.correct_index !== null && q.correct_index !== undefined && q.correct_index !== '') {
      const c = Number(q.correct_index);
      if (!Number.isInteger(c) || c < 0 || c >= options.length) return { error: `Question ${i + 1} has an answer outside its options.` };
      correct = c;
    }
    out.push({ position: i + 1, prompt, options, correct_index: correct });
  }
  return { questions: out };
}
