const mongoose = require('mongoose');

const finalSubmissionSchema = new mongoose.Schema({
  teamId: { type: String, required: true, unique: true, index: true },
  teamName: { type: String, default: '' },
  imageData: { type: String, default: '' },
  imageType: { type: String, default: '' },
  submissionTime: { type: Date, default: Date.now },
  rank: { type: Number, default: 0 },
  validationStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' }
}, { timestamps: true });

module.exports = mongoose.model('FinalSubmission', finalSubmissionSchema);
