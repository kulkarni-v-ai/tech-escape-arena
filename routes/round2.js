const express = require('express');
const router = express.Router();
const Round2Submission = require('../models/Round2Submission');
const RoundConfig = require('../models/RoundConfig');
const Team = require('../models/Team');

// GET /api/round2/timer — get current timer state
router.get('/timer', async (req, res) => {
  try {
    let config = await RoundConfig.findOne({ roundNumber: 2 });
    if (!config) {
      config = await RoundConfig.create({ roundNumber: 2 });
    }
    res.json({
      remaining: config.getRemaining(),
      status: config.status,
      isLocked: config.isLocked,
      leaderboardRevealed: config.leaderboardRevealed
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/round2/submit — submit final answer (one-time per team)
router.post('/submit', async (req, res) => {
  try {
    const { teamId, finalAnswer } = req.body;
    if (!teamId || !finalAnswer) {
      return res.status(400).json({ error: 'Team ID and answer are required' });
    }

    // Check team exists
    const team = await Team.findOne({ teamId });
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (team.eliminated) return res.status(403).json({ error: 'ACCESS DENIED: Team has been eliminated.' });

    // Check if already submitted
    const existing = await Round2Submission.findOne({ teamId });
    if (existing) return res.status(409).json({ error: 'Already submitted', submission: existing });

    // Check if submissions are locked
    let config = await RoundConfig.findOne({ roundNumber: 2 });
    if (!config) config = await RoundConfig.create({ roundNumber: 2 });
    if (config.isLocked) return res.status(403).json({ error: 'Submissions are locked' });

    // Check if timer has ended
    if (config.status === 'ended') return res.status(403).json({ error: 'Time is up' });

    // Check correctness
    const correctAnswer = (config.correctAnswer || '').trim().toLowerCase();
    const isCorrect = correctAnswer ? finalAnswer.trim().toLowerCase() === correctAnswer : false;

    // Save submission
    const submission = await Round2Submission.create({
      teamId,
      teamName: team.teamName,
      finalAnswer: finalAnswer.trim(),
      submissionTime: new Date(),
      isCorrect
    });

    // Notify via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.emit('submission:new', {
        teamId, teamName: team.teamName,
        submissionTime: submission.submissionTime,
        isCorrect
      });
    }

    res.json({ success: true, submission });
  } catch (err) {
    console.error('Submission error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/round2/leaderboard — ranked leaderboard
router.get('/leaderboard', async (req, res) => {
  try {
    const config = await RoundConfig.findOne({ roundNumber: 2 });
    const submissions = await Round2Submission.find().lean();

    // Separate correct and incorrect
    const correct = submissions.filter(s => s.isCorrect).sort((a, b) =>
      new Date(a.submissionTime) - new Date(b.submissionTime)
    );
    const incorrect = submissions.filter(s => !s.isCorrect).sort((a, b) =>
      new Date(a.submissionTime) - new Date(b.submissionTime)
    );

    const ranked = [...correct, ...incorrect].map((s, i) => ({
      ...s,
      rank: i + 1,
      qualified: i < 8 && s.isCorrect
    }));

    // Update ranks in DB
    for (const entry of ranked) {
      await Round2Submission.updateOne(
        { teamId: entry.teamId },
        { rank: entry.rank, qualified: entry.qualified }
      );
    }

    res.json({
      leaderboard: ranked,
      revealed: config?.leaderboardRevealed || false,
      totalSubmissions: submissions.length
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
