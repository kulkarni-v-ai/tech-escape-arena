const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// In-memory data store
let teams = {};
let adminState = { isPaused: false, isLocked: false, roundStartedAt: null };
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';

// Persist simple state to disk locally
const DATA_FILE = path.join(__dirname, 'data.json');
try {
  if (fs.existsSync(DATA_FILE)) {
    const data = JSON.parse(fs.readFileSync(DATA_FILE));
    teams = data.teams || {};
    adminState = data.adminState || adminState;
  }
} catch (err) { console.log('Starting fresh database.'); }

function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ teams, adminState }));
  } catch (err) { console.error('Could not write data file', err); }
}

// -------- API ENDPOINTS --------

// --- PUBLIC TEAMS API ---
app.get('/api/teams', (req, res) => {
  res.json(teams);
});

app.post('/api/register', (req, res) => {
  const { id, name, members } = req.body;
  if (!id) return res.status(400).json({error: 'missing id'});
  
  teams[id] = {
    id, name, members,
    startTime: adminState.roundStartedAt ? Date.now() : null,
    endTime: null,
    puzzlesSolved: 0,
    puzzleAnswers: {}, 
    puzzleAttempts: {},
    loginAttempts: 0, 
    loggedIn: false, 
    isQualified: false
  };
  saveData();
  res.json({ id });
});

// Update specific team by ID
app.post('/api/team/:id/update', (req, res) => {
  const { id } = req.params;
  if (!teams[id]) return res.status(404).json({ error: 'Team not found' });
  
  // Merge the partial updates sent from frontend
  teams[id] = { ...teams[id], ...req.body };
  saveData();
  res.json({ success: true, team: teams[id] });
});

// Get team by ID
app.get('/api/team/:id', (req, res) => {
  const { id } = req.params;
  if (!teams[id]) return res.status(404).json({ error: 'Team not found' });
  res.json(teams[id]);
});

// --- ADMIN STATE API ---
app.get('/api/adminState', (req, res) => {
  res.json(adminState);
});

// ADMIN PROTECTED ROUTES
function requireAuth(req, res, next) {
  const authMsg = req.headers['authorization'];
  if (authMsg !== `Bearer ${ADMIN_PASSWORD}`) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

app.post('/api/admin/auth', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.json({ success: true, token: ADMIN_PASSWORD });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
});

app.post('/api/adminState', requireAuth, (req, res) => {
  const updates = req.body;
  
  if (updates.startRound) {
      adminState.roundStartedAt = Date.now();
      Object.keys(teams).forEach(id => {
          if (!teams[id].startTime) teams[id].startTime = adminState.roundStartedAt;
      });
  } else {
      adminState = { ...adminState, ...updates };
  }
  
  saveData();
  res.json({ adminState, teams });
});

app.post('/api/admin/teams', requireAuth, (req, res) => {
    teams = req.body.teams; // Full override
    saveData();
    res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Arena listening on port ${PORT}`));
