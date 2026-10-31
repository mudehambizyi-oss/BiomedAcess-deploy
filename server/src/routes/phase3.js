import { Router } from 'express';
import db from '../db.js';
import { requireAuth, requireContentManager } from '../lib/auth.js';

const router = Router();
const tracks = new Set(['preclinical','clinical','examprep','practicing','labmanager','researcher']);
function parseTrack(value) {
  if (value == null || value === '') return [];
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return String(value).split(',').map((x) => x.trim()).filter(Boolean); }
}
function validateCase(body) {
  const title = String(body.title || '').trim();
  const stem = String(body.stem || '').trim();
  const difficulty = Number(body.difficulty);
  const questions = body.questions;
  const trackList = Array.isArray(body.track) ? body.track : body.track ? String(body.track).split(',').map((x) => x.trim()).filter(Boolean) : [];
  if (!title || !stem) return { error: 'Title and patient scenario are required.' };
  if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 3) return { error: 'Difficulty must be 1, 2 or 3.' };
  if (!Array.isArray(questions) || !questions.length || questions.length > 30) return { error: 'Add between 1 and 30 questions.' };
  if (trackList.some((x) => !tracks.has(x))) return { error: 'Choose valid tracks.' };
  for (const [i, q] of questions.entries()) {
    if (!String(q.prompt || '').trim() || !Array.isArray(q.options) || q.options.length !== 4 || q.options.some((o) => !String(o).trim())) return { error: `Question ${i + 1} needs a prompt and four options.` };
    if (!Number.isInteger(q.correct_index) || q.correct_index < 0 || q.correct_index > 3) return { error: `Question ${i + 1} needs a correct answer.` };
  }
  return { title, specialty: String(body.specialty || '').trim().slice(0,100), stem, difficulty, track: trackList.length ? JSON.stringify([...new Set(trackList)]) : null, questions: JSON.stringify(questions.map((q) => ({ prompt: String(q.prompt).trim(), options: q.options.map((x) => String(x).trim()), correct_index: q.correct_index, explanation: String(q.explanation || '').trim() }))) };
}
router.get('/clinical-cases', requireAuth, async (req,res) => {
  const rows = await db.all('SELECT id,title,specialty,difficulty,track,stem,questions FROM clinical_cases ORDER BY created_at DESC,id DESC');
  const visible = rows.filter((c) => {
    const targets = parseTrack(c.track);
    return !targets.length || ['admin','moderator','tutor'].includes(req.user.role) || (req.user.track && targets.includes(req.user.track));
  });
  res.json(await Promise.all(visible.map(async (c) => ({ id:c.id,title:c.title,specialty:c.specialty,difficulty:c.difficulty,track:c.track,question_count:JSON.parse(c.questions).length,attempted:!!(await db.get('SELECT 1 AS x FROM clinical_case_attempts WHERE user_id=? AND case_id=?',[req.user.id,c.id])) }))));
});
router.get('/clinical-cases/:id', requireAuth, async (req,res) => {
  const c = await db.get('SELECT * FROM clinical_cases WHERE id=?',[req.params.id]);
  if (!c) return res.status(404).json({error:'Case not found.'});
  const targeted = parseTrack(c.track);
  if (targeted.length && !['admin','moderator','tutor'].includes(req.user.role) && (!req.user.track || !targeted.includes(req.user.track))) return res.status(404).json({error:'Case not found.'});
  const attempt = ['admin','moderator','tutor'].includes(req.user.role) ? null : await db.get('SELECT answers,score,total,created_at FROM clinical_case_attempts WHERE user_id=? AND case_id=?',[req.user.id,c.id]);
  let questions = JSON.parse(c.questions);
  if (!attempt && !['admin','moderator','tutor'].includes(req.user.role)) questions = questions.map(({prompt,options})=>({prompt,options}));
  res.json({...c,track:parseTrack(c.track),questions,attempt:attempt ? {...attempt,answers:JSON.parse(attempt.answers),results:JSON.parse(c.questions).map((q,i)=>({prompt:q.prompt,options:q.options,correct_index:q.correct_index,explanation:q.explanation,selected_index:JSON.parse(attempt.answers)[i]}))} : null});
});
router.post('/clinical-cases/:id/submit', requireAuth, async (req,res) => {
  const c = await db.get('SELECT * FROM clinical_cases WHERE id=?',[req.params.id]);
  if (!c) return res.status(404).json({error:'Case not found.'});
  if (['admin','moderator','tutor'].includes(req.user.role)) return res.status(403).json({error:'Admin accounts do not submit student attempts.'});
  const targeted = parseTrack(c.track);
  if (targeted.length && (!req.user.track || !targeted.includes(req.user.track))) return res.status(404).json({error:'Case not found.'});
  const qs = JSON.parse(c.questions), answers = req.body?.answers;
  if (!Array.isArray(answers) || answers.length !== qs.length || answers.some((x)=>!Number.isInteger(x)||x<0||x>3)) return res.status(400).json({error:'Answer every question before submitting.'});
  const score = qs.reduce((n,q,i)=>n+(answers[i]===q.correct_index?1:0),0);
  try { await db.run('INSERT INTO clinical_case_attempts (case_id,user_id,answers,score,total) VALUES (?,?,?,?,?)',[c.id,req.user.id,JSON.stringify(answers),score,qs.length]); }
  catch (e) { if (String(e.message).includes('UNIQUE')) return res.status(409).json({error:'You have already used your attempt for this case.'}); throw e; }
  res.status(201).json({score,total:qs.length,results:qs.map((q,i)=>({prompt:q.prompt,options:q.options,selected_index:answers[i],correct_index:q.correct_index,is_correct:answers[i]===q.correct_index,explanation:q.explanation}))});
});
router.get('/jobs', async (_req,res)=>res.json(await db.all('SELECT id,title,org,location,deadline,apply_url,description,created_at FROM jobs ORDER BY created_at DESC,id DESC')));
router.get('/admin/phase3/cases', requireContentManager, async (_req,res)=>res.json(await db.all('SELECT id,title,specialty,difficulty,track,stem,questions FROM clinical_cases ORDER BY id DESC')));
router.post('/admin/clinical-cases', requireContentManager, async (req,res)=>{
  const c=validateCase(req.body||{}); if(c.error)return res.status(400).json({error:c.error});
  const r=await db.run('INSERT INTO clinical_cases(title,specialty,difficulty,track,stem,questions) VALUES(?,?,?,?,?,?)',[c.title,c.specialty,c.difficulty,c.track,c.stem,c.questions]); res.status(201).json({id:r.lastInsertRowid});
});
router.put('/admin/clinical-cases/:id', requireContentManager, async (req,res)=>{
  const old=await db.get('SELECT id FROM clinical_cases WHERE id=?',[req.params.id]); if(!old)return res.status(404).json({error:'Case not found.'});
  const c=validateCase(req.body||{}); if(c.error)return res.status(400).json({error:c.error});
  await db.run('UPDATE clinical_cases SET title=?,specialty=?,difficulty=?,track=?,stem=?,questions=? WHERE id=?',[c.title,c.specialty,c.difficulty,c.track,c.stem,c.questions,old.id]); res.json({ok:true});
});
router.delete('/admin/clinical-cases/:id', requireContentManager, async (req,res)=>{const r=await db.run('DELETE FROM clinical_cases WHERE id=?',[req.params.id]);if(!r.changes)return res.status(404).json({error:'Case not found.'});res.json({ok:true});});
function validJob(b){ const title=String(b.title||'').trim(),org=String(b.org||'').trim(),location=String(b.location||'').trim(),apply_url=String(b.apply_url||'').trim(); if(!title||!org||!location||!apply_url||!/^https?:\/\//i.test(apply_url))return null; return {title,org,location,apply_url,deadline:String(b.deadline||'').trim()||null,description:String(b.description||'').trim()}; }
router.get('/admin/jobs',requireContentManager,async (_req,res)=>res.json(await db.all('SELECT * FROM jobs ORDER BY id DESC')));
router.post('/admin/jobs',requireContentManager,async (req,res)=>{const j=validJob(req.body||{});if(!j)return res.status(400).json({error:'Add a title, organisation, location and valid application URL.'});const r=await db.run('INSERT INTO jobs(title,org,location,deadline,apply_url,description) VALUES(?,?,?,?,?,?)',[j.title,j.org,j.location,j.deadline,j.apply_url,j.description]);res.status(201).json({id:r.lastInsertRowid});});
router.put('/admin/jobs/:id',requireContentManager,async (req,res)=>{const j=validJob(req.body||{});if(!j)return res.status(400).json({error:'Add a title, organisation, location and valid application URL.'});const r=await db.run('UPDATE jobs SET title=?,org=?,location=?,deadline=?,apply_url=?,description=? WHERE id=?',[j.title,j.org,j.location,j.deadline,j.apply_url,j.description,req.params.id]);if(!r.changes)return res.status(404).json({error:'Job not found.'});res.json({ok:true});});
router.delete('/admin/jobs/:id',requireContentManager,async (req,res)=>{const r=await db.run('DELETE FROM jobs WHERE id=?',[req.params.id]);if(!r.changes)return res.status(404).json({error:'Job not found.'});res.json({ok:true});});
export default router;
