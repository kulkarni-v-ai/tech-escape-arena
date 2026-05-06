const mongoose = require('mongoose');

const round2SubmissionSchema = new mongoose.Schema({
  teamId: { type: String, required: true, unique: true, index: true },
  teamName: { type: String, default: '' },
  finalAnswer: { type: String, required: true },
  submissionTime: { type: Date, default: Date.now },
  isCorrect: { type: Boolean, default: false },
  rank: { type: Number, default: 0 },
  qualified: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Round2Submission', round2SubmissionSchema);
