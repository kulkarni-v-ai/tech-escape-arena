const express = require('express');
const router = express.Router();
const RoundConfig = require('../models/RoundConfig');
const Round2Submission = require('../models/Round2Submission');
const Team = require('../models/Team');

// Middleware: auth check (applied per-route using app-level middleware reference)
function getAuth(req, res, next) {
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';
  const authMsg = req.headers['authorization'];
  if (authMsg !== `Bearer ${ADMIN_PASSWORD}`) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

// Helper: get or create Round 2 config
async function getR2Config() {
  let config = await RoundConfig.findOne({ roundNumber: 2 });
  if (!config) config = await RoundConfig.create({ roundNumber: 2 });
  return config;
}

// POST /api/admin/timer/start
router.post('/timer/start', getAuth, async (req, res) => {
  try {
    const config = await getR2Config();
    if (config.status === 'running') return res.status(400).json({ error: 'Timer already running' });
    config.startedAt = Date.now();
    config.status = 'running';
    config.totalPausedMs = 0;
    config.pausedAt = null;
    await config.save();
    const io = req.app.get('io');
    if (io) io.emit('timer:sync', { remaining: config.getRemaining(), status: 'running', isLocked: config.isLocked });
    res.json({ success: true, remaining: config.getRemaining() });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// POST /api/admin/timer/pause
router.post('/timer/pause', getAuth, async (req, res) => {
  try {
    const config = await getR2Config();
    if (config.status !== 'running') return res.status(400).json({ error: 'Timer not running' });
    config.pausedAt = Date.now();
    config.status = 'paused';
    await config.save();
    const io = req.app.get('io');
    if (io) io.emit('timer:sync', { remaining: config.getRemaining(), status: 'paused', isLocked: config.isLocked });
    res.json({ success: true, remaining: config.getRemaining() });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// POST /api/admin/timer/resume
router.post('/timer/resume', getAuth, async (req, res) => {
  try {
    const config = await getR2Config();
    if (config.status !== 'paused') return res.status(400).json({ error: 'Timer not paused' });
    const pausedDuration = Date.now() - (config.pausedAt || Date.now());
    config.totalPausedMs = (config.totalPausedMs || 0) + pausedDuration;
    config.pausedAt = null;
    config.status = 'running';
    await config.save();
    const io = req.app.get('io');
    if (io) io.emit('timer:sync', { remaining: config.getRemaining(), status: 'running', isLocked: config.isLocked });
    res.json({ success: true, remaining: config.getRemaining() });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// POST /api/admin/timer/reset
router.post('/timer/reset', getAuth, async (req, res) => {
  try {
    const config = await getR2Config();
    config.startedAt = null;
    config.pausedAt = null;
    config.totalPausedMs = 0;
    config.status = 'waiting';
    await config.save();
    const io = req.app.get('io');
    if (io) io.emit('timer:sync', { remaining: config.duration, status: 'waiting', isLocked: config.isLocked });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// POST /api/admin/eliminate — mark team as eliminated
router.post('/eliminate', getAuth, async (req, res) => {
  try {
    const { teamId } = req.body;
    await Team.updateOne({ teamId }, { eliminated: true, isQualified: false });
    await Round2Submission.updateOne({ teamId }, { qualified: false });
    const io = req.app.get('io');
    if (io) io.emit('team:status', { teamId, eliminated: true });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// POST /api/admin/qualify — mark team as qualified
router.post('/qualify', getAuth, async (req, res) => {
  try {
    const { teamId } = req.body;
    await Team.updateOne({ teamId }, { eliminated: false, isQualified: true });
    await Round2Submission.updateOne({ teamId }, { qualified: true });
    const io = req.app.get('io');
    if (io) io.emit('team:status', { teamId, qualified: true });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// POST /api/admin/lock-submissions
router.post('/lock-submissions', getAuth, async (req, res) => {
  try {
    const config = await getR2Config();
    config.isLocked = !config.isLocked;
    await config.save();
    const io = req.app.get('io');
    if (io) io.emit('timer:sync', { remaining: config.getRemaining(), status: config.status, isLocked: config.isLocked });
    res.json({ success: true, isLocked: config.isLocked });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// POST /api/admin/reveal-leaderboard
router.post('/reveal-leaderboard', getAuth, async (req, res) => {
  try {
    const config = await getR2Config();
    config.leaderboardRevealed = true;
    await config.save();
    const io = req.app.get('io');
    if (io) io.emit('reveal:leaderboard', { revealed: true });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// POST /api/admin/set-answer — set the correct answer
router.post('/set-answer', getAuth, async (req, res) => {
  try {
    const { answer } = req.body;
    const config = await getR2Config();
    config.correctAnswer = answer || '';
    await config.save();
    res.json({ success: true, answer: config.correctAnswer });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// POST /api/admin/override-rank
router.post('/override-rank', getAuth, async (req, res) => {
  try {
    const { teamId, rank, qualified } = req.body;
    await Round2Submission.updateOne({ teamId }, { rank, qualified });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// POST /api/admin/reset-round — clear all Round 2 data
router.post('/reset-round', getAuth, async (req, res) => {
  try {
    await Round2Submission.deleteMany({});
    const config = await getR2Config();
    config.startedAt = null;
    config.pausedAt = null;
    config.totalPausedMs = 0;
    config.status = 'waiting';
    config.isLocked = false;
    config.leaderboardRevealed = false;
    await config.save();
    await Team.updateMany({}, { eliminated: false });
    const io = req.app.get('io');
    if (io) io.emit('round:reset', {});
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// GET /api/admin/r2/teams — all teams with round 2 status
router.get('/r2/teams', getAuth, async (req, res) => {
  try {
    const teams = await Team.find().lean();
    const submissions = await Round2Submission.find().lean();
    const subMap = {};
    submissions.forEach(s => { subMap[s.teamId] = s; });

    const result = teams.map(t => ({
      ...t,
      id: t.teamId,
      round2Submission: subMap[t.teamId] || null
    }));
    res.json(result);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// GET /api/admin/r2/submissions — all Round 2 submissions
router.get('/r2/submissions', getAuth, async (req, res) => {
  try {
    const submissions = await Round2Submission.find().sort({ submissionTime: 1 }).lean();
    res.json(submissions);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// GET /api/admin/r2/config — get round 2 config
router.get('/r2/config', getAuth, async (req, res) => {
  try {
    const config = await getR2Config();
    res.json(config.toObject());
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
