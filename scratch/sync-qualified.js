
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();
const Team = require('../models/Team');

async function sync() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');
    
    const result = await Team.updateMany(
      { puzzlesSolved: { $gte: 4 } },
      { $set: { isQualified: true } }
    );
    
    console.log('Qualified sync complete:', result);
    process.exit(0);
  } catch (err) {
    console.error('Sync failed:', err);
    process.exit(1);
  }
}

sync();
