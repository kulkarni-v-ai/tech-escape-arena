const express = require('express');
const router = express.Router();
const multer = require('multer');
const Round4Progress = require('../models/Round4Progress');
const FinalSubmission = require('../models/FinalSubmission');
const RoundConfig = require('../models/RoundConfig');
const Team = require('../models/Team');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Helper: get Round 4 config
async function getR4Config() {
  let config = await RoundConfig.findOne({ roundNumber: 4 });
  if (!config) config = await RoundConfig.create({ roundNumber: 4, duration: 60 * 60 * 1000, correctAnswer: JSON.stringify({
    stageAnswers: { 1: '', 2: '', 3: '' },
    stageHints: {
      1: 'Solve the crossword puzzle. Enter the keyword it reveals.',
      2: 'Follow the clue to find the hidden chit. Enter the code written on it.',
      3: 'Find the Rubik\'s Cube. Solve one color. Get the keyword from the volunteer.',
      4: 'Find the pendrive. Recreate the pose shown in the image and upload your photo.'
    }
  }) });
  return config;
}

function parseConfigMeta(config) {
  try {
    return JSON.parse(config.correctAnswer || '{}');
  } catch { return { stageAnswers: {}, stageHints: {} }; }
}

// GET /api/round4/timer
router.get('/timer', async (req, res) => {
  try {
    const config = await getR4Config();
    res.json({
      remaining: config.getRemaining(),
      status: config.status,
      isLocked: config.isLocked
    });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// GET /api/round4/progress/:teamId
router.get('/progress/:teamId', async (req, res) => {
  try {
    const { teamId } = req.params;
    let progress = await Round4Progress.findOne({ teamId });
    if (!progress) {
      const team = await Team.findOne({ teamId });
      if (!team) return res.status(404).json({ error: 'Team not found' });
      if (team.eliminated) return res.status(403).json({ error: 'ACCESS DENIED: Team has been eliminated.' });
      progress = await Round4Progress.create({ teamId, teamName: team.teamName });
    } else {
      // Also verify if the team is eliminated even if progress exists
      const team = await Team.findOne({ teamId });
      if (team && team.eliminated) return res.status(403).json({ error: 'ACCESS DENIED: Team has been eliminated.' });
    }
    const config = await getR4Config();
    const meta = parseConfigMeta(config);
    const currentHint = meta.stageHints?.[progress.currentStage] || '';

    res.json({
      teamId: progress.teamId,
      teamName: progress.teamName,
      currentStage: progress.currentStage,
      stages: progress.stages,
      completed: progress.completed,
      completedAt: progress.completedAt,
      disqualified: progress.disqualified,
      currentHint
    });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// POST /api/round4/submit-stage — submit answer for stages 1-3
router.post('/submit-stage', async (req, res) => {
  try {
    const { teamId, stage, answer } = req.body;
    if (!teamId || !stage || !answer) return res.status(400).json({ error: 'Missing fields' });

    const config = await getR4Config();
    if (config.isLocked) return res.status(403).json({ error: 'Submissions locked' });
    if (config.status !== 'running') return res.status(403).json({ error: 'Round not active' });

    let progress = await Round4Progress.findOne({ teamId });
    if (!progress) return res.status(404).json({ error: 'Team not registered for Round 4' });
    if (progress.disqualified) return res.status(403).json({ error: 'Team disqualified' });
    
    const team = await Team.findOne({ teamId });
    if (team && team.eliminated) return res.status(403).json({ error: 'Team eliminated' });

    if (progress.completed) return res.status(409).json({ error: 'Already completed all stages' });
    if (progress.currentStage !== stage) return res.status(403).json({ error: `You are on stage ${progress.currentStage}, not stage ${stage}` });

    // Validate answer
    const meta = parseConfigMeta(config);
    const correctAnswer = (meta.stageAnswers?.[stage] || '').trim().toLowerCase();
    const isCorrect = correctAnswer && answer.trim().toLowerCase() === correctAnswer;

    if (!isCorrect) return res.json({ success: false, error: 'Incorrect answer. Try again.' });

    // Mark stage complete
    progress.stages.push({ stage, answer: answer.trim(), completedAt: new Date() });
    progress.currentStage = stage + 1;

    // If stage 3 completed, move to stage 4 (image upload)
    if (stage >= 4) {
      progress.completed = true;
      progress.completedAt = new Date();
    }

    await progress.save();

    // Broadcast progress
    const io = req.app.get('io');
    if (io) io.emit('r4:progress', { teamId, currentStage: progress.currentStage, completed: progress.completed });

    // Get next hint
    const nextHint = meta.stageHints?.[progress.currentStage] || '';

    res.json({ success: true, currentStage: progress.currentStage, nextHint, completed: progress.completed });
  } catch (err) {
    console.error('R4 submit error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/round4/submit-final — upload final image (stage 4)
router.post('/submit-final', upload.single('image'), async (req, res) => {
  try {
    const { teamId } = req.body;
    if (!teamId) return res.status(400).json({ error: 'Missing team ID' });

    const config = await getR4Config();
    if (config.isLocked) return res.status(403).json({ error: 'Submissions locked' });

    let progress = await Round4Progress.findOne({ teamId });
    if (!progress) return res.status(404).json({ error: 'Team not found' });
    if (progress.disqualified) return res.status(403).json({ error: 'Team disqualified' });

    const team = await Team.findOne({ teamId });
    if (team && team.eliminated) return res.status(403).json({ error: 'Team eliminated' });

    if (progress.currentStage < 4) return res.status(403).json({ error: 'Complete all previous stages first' });

    // Check duplicate
    const existing = await FinalSubmission.findOne({ teamId });
    if (existing) return res.status(409).json({ error: 'Already submitted' });

    if (!req.file) return res.status(400).json({ error: 'No image uploaded' });

    // Store image as base64
    const imageData = req.file.buffer.toString('base64');
    const imageType = req.file.mimetype;

    // Count existing submissions for rank
    const submissionCount = await FinalSubmission.countDocuments();

    const submission = await FinalSubmission.create({
      teamId,
      teamName: progress.teamName,
      imageData,
      imageType,
      submissionTime: new Date(),
      rank: submissionCount + 1
    });

    // Mark progress as completed
    progress.stages.push({ stage: 4, answer: 'IMAGE_UPLOADED', completedAt: new Date() });
    progress.completed = true;
    progress.completedAt = new Date();
    await progress.save();

    const io = req.app.get('io');
    if (io) {
      io.emit('r4:progress', { teamId, currentStage: 5, completed: true });
      io.emit('r4:submission', { teamId, teamName: progress.teamName, rank: submission.rank });
    }

    res.json({ success: true, rank: submission.rank, completedAt: progress.completedAt });
  } catch (err) {
    console.error('R4 final submit error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/round4/standings
router.get('/standings', async (req, res) => {
  try {
    const progress = await Round4Progress.find().lean();
    const submissions = await FinalSubmission.find().sort({ rank: 1 }).lean();
    res.json({ progress, submissions });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
