const express = require('express');
const router = express.Router();
const RoundConfig = require('../models/RoundConfig');
const Round4Progress = require('../models/Round4Progress');
const FinalSubmission = require('../models/FinalSubmission');
const Team = require('../models/Team');

function getAuth(req, res, next) {
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';
  if (req.headers['authorization'] !== `Bearer ${ADMIN_PASSWORD}`) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

async function getR4Config() {
  let config = await RoundConfig.findOne({ roundNumber: 4 });
  if (!config) config = await RoundConfig.create({ roundNumber: 4, duration: 60 * 60 * 1000, correctAnswer: JSON.stringify({
    stageAnswers: { 1: '', 2: '', 3: '' },
    stageHints: { 1: 'Solve the crossword puzzle.', 2: 'Find the hidden chit.', 3: 'Solve the Rubik\'s Cube.', 4: 'Find the pendrive and upload.' }
  }) });
  return config;
}

// Timer controls
router.post('/r4/timer/start', getAuth, async (req, res) => {
  try {
    const config = await getR4Config();
    config.startedAt = Date.now(); config.status = 'running'; config.totalPausedMs = 0; config.pausedAt = null;
    await config.save();
    const io = req.app.get('io');
    if (io) io.emit('timer:r4', { remaining: config.getRemaining(), status: 'running', isLocked: config.isLocked });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.post('/r4/timer/pause', getAuth, async (req, res) => {
  try {
    const config = await getR4Config();
    if (config.status !== 'running') return res.status(400).json({ error: 'Not running' });
    config.pausedAt = Date.now(); config.status = 'paused'; await config.save();
    const io = req.app.get('io');
    if (io) io.emit('timer:r4', { remaining: config.getRemaining(), status: 'paused', isLocked: config.isLocked });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.post('/r4/timer/resume', getAuth, async (req, res) => {
  try {
    const config = await getR4Config();
    if (config.status !== 'paused') return res.status(400).json({ error: 'Not paused' });
    config.totalPausedMs = (config.totalPausedMs || 0) + (Date.now() - (config.pausedAt || Date.now()));
    config.pausedAt = null; config.status = 'running'; await config.save();
    const io = req.app.get('io');
    if (io) io.emit('timer:r4', { remaining: config.getRemaining(), status: 'running', isLocked: config.isLocked });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.post('/r4/timer/reset', getAuth, async (req, res) => {
  try {
    const config = await getR4Config();
    config.startedAt = null; config.pausedAt = null; config.totalPausedMs = 0; config.status = 'waiting';
    await config.save();
    const io = req.app.get('io');
    if (io) io.emit('timer:r4', { remaining: config.duration, status: 'waiting', isLocked: config.isLocked });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// Set stage answers + hints
router.post('/r4/config', getAuth, async (req, res) => {
  try {
    const { stageAnswers, stageHints } = req.body;
    const config = await getR4Config();
    const meta = JSON.parse(config.correctAnswer || '{}');
    if (stageAnswers) meta.stageAnswers = stageAnswers;
    if (stageHints) meta.stageHints = stageHints;
    config.correctAnswer = JSON.stringify(meta);
    await config.save();
    res.json({ success: true, meta });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.get('/r4/config', getAuth, async (req, res) => {
  try {
    const config = await getR4Config();
    const meta = JSON.parse(config.correctAnswer || '{}');
    res.json({ ...config.toObject(), meta });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// Lock/unlock submissions
router.post('/r4/lock', getAuth, async (req, res) => {
  try {
    const config = await getR4Config();
    config.isLocked = !config.isLocked; await config.save();
    res.json({ success: true, isLocked: config.isLocked });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// Get all progress
router.get('/r4/progress', getAuth, async (req, res) => {
  try {
    const progress = await Round4Progress.find().lean();
    const submissions = await FinalSubmission.find().sort({ rank: 1 }).lean();
    // Strip image data for listing (too large)
    submissions.forEach(s => { s.imageData = s.imageData ? '[IMAGE]' : ''; });
    res.json({ progress, submissions });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// Get submission image
router.get('/r4/submission/:teamId/image', getAuth, async (req, res) => {
  try {
    const sub = await FinalSubmission.findOne({ teamId: req.params.teamId });
    if (!sub || !sub.imageData) return res.status(404).json({ error: 'No image' });
    res.json({ imageData: sub.imageData, imageType: sub.imageType });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// Manually unlock stage for a team
router.post('/r4/unlock-stage', getAuth, async (req, res) => {
  try {
    const { teamId, stage } = req.body;
    let progress = await Round4Progress.findOne({ teamId });
    if (!progress) {
      const team = await Team.findOne({ teamId });
      progress = await Round4Progress.create({ teamId, teamName: team?.teamName || '' });
    }
    progress.currentStage = stage;
    // Add stage entries for all previous stages
    for (let i = 1; i < stage; i++) {
      if (!progress.stages.find(s => s.stage === i)) {
        progress.stages.push({ stage: i, answer: 'ADMIN_OVERRIDE', completedAt: new Date() });
      }
    }
    await progress.save();
    const io = req.app.get('io');
    if (io) io.emit('r4:progress', { teamId, currentStage: stage });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// Disqualify/re-qualify team
router.post('/r4/disqualify', getAuth, async (req, res) => {
  try {
    const { teamId, disqualified } = req.body;
    await Round4Progress.updateOne({ teamId }, { disqualified: disqualified !== false });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// Validate final submission
router.post('/r4/validate-submission', getAuth, async (req, res) => {
  try {
    const { teamId, status } = req.body;
    await FinalSubmission.updateOne({ teamId }, { validationStatus: status });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// Reset round 4
router.post('/r4/reset', getAuth, async (req, res) => {
  try {
    await Round4Progress.deleteMany({});
    await FinalSubmission.deleteMany({});
    const config = await getR4Config();
    config.startedAt = null; config.pausedAt = null; config.totalPausedMs = 0;
    config.status = 'waiting'; config.isLocked = false;
    await config.save();
    const io = req.app.get('io');
    if (io) io.emit('r4:reset', {});
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// End round
router.post('/r4/end', getAuth, async (req, res) => {
  try {
    const config = await getR4Config();
    config.status = 'ended'; config.isLocked = true; await config.save();
    const io = req.app.get('io');
    if (io) io.emit('timer:r4', { remaining: 0, status: 'ended', isLocked: true });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
