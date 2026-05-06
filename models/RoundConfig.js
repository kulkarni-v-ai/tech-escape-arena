const mongoose = require('mongoose');

const roundConfigSchema = new mongoose.Schema({
  roundNumber: { type: Number, required: true, unique: true, index: true },
  startedAt: { type: Number, default: null },
  pausedAt: { type: Number, default: null },
  totalPausedMs: { type: Number, default: 0 },
  duration: { type: Number, default: 45 * 60 * 1000 },
  status: { type: String, enum: ['waiting', 'running', 'paused', 'ended'], default: 'waiting' },
  isLocked: { type: Boolean, default: false },
  correctAnswer: { type: String, default: '' },
  leaderboardRevealed: { type: Boolean, default: false },
  selectedRound: { type: Number, default: null }
}, { timestamps: true });

// Helper: get remaining time in ms
roundConfigSchema.methods.getRemaining = function () {
  if (this.status === 'waiting' || this.status === 'ended') return this.duration;
  const now = this.status === 'paused' && this.pausedAt ? this.pausedAt : Date.now();
  const elapsed = now - this.startedAt - (this.totalPausedMs || 0);
  return Math.max(0, this.duration - elapsed);
};

module.exports = mongoose.model('RoundConfig', roundConfigSchema);
