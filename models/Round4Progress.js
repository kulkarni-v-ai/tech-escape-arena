const mongoose = require('mongoose');

const stageEntrySchema = new mongoose.Schema({
  stage: Number,
  answer: { type: String, default: '' },
  completedAt: { type: Date, default: null }
}, { _id: false });

const round4ProgressSchema = new mongoose.Schema({
  teamId: { type: String, required: true, unique: true, index: true },
  teamName: { type: String, default: '' },
  currentStage: { type: Number, default: 1 },
  stages: { type: [stageEntrySchema], default: [] },
  completed: { type: Boolean, default: false },
  completedAt: { type: Date, default: null },
  disqualified: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Round4Progress', round4ProgressSchema);
