const mongoose = require('mongoose');
require('dotenv').config();
const Team = require('./models/Team');

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('Connected to DB');
    const result = await Team.collection.deleteMany({ teamId: { $exists: false } });
    console.log('Deleted missing teamId:', result.deletedCount);
    const result2 = await Team.collection.deleteMany({ teamId: null });
    console.log('Deleted null teamId:', result2.deletedCount);
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
