const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
  teamId: { type: String, required: true, unique: true, index: true },
  teamName: { type: String, default: '' },
  members: { type: String, default: '' },
  loginCode: { type: String, default: null },
  startTime: { type: Number, default: null },
  endTime: { type: Number, default: null },
  puzzlesSolved: { type: Number, default: 0 },
  puzzleAnswers: { type: mongoose.Schema.Types.Mixed, default: {} },
  puzzleAttempts: { type: mongoose.Schema.Types.Mixed, default: {} },
  loginAttempts: { type: Number, default: 0 },
  loggedIn: { type: Boolean, default: false },
  isQualified: { type: Boolean, default: false },
  currentRound: { type: Number, default: 1 },
  eliminated: { type: Boolean, default: false },
  score: { type: Number, default: 0 }
}, { timestamps: true });

// Virtual to keep compatibility with existing frontend expecting 'id'
teamSchema.virtual('id').get(function () { return this.teamId; });
teamSchema.set('toObject', { virtuals: true });
teamSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Team', teamSchema);
