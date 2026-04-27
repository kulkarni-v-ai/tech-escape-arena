const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

require('dotenv').config(); // Ensure dotenv loads if present

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/views', express.static(path.join(__dirname, 'views')));

const ADMIN_PATH = process.env.ADMIN_PATH || '/system-override';

app.get(ADMIN_PATH, (req, res) => {
  res.sendFile(path.join(__dirname, 'views/admin-login.html'));
});
app.get(`${ADMIN_PATH}/dashboard`, (req, res) => {
  res.sendFile(path.join(__dirname, 'views/admin.html'));
});

// Word pool for unique login codes
const LOGIN_WORDS = [
  "SYSTEM","NEXUS","ROUTER","SERVER","MATRIX","PORTAL","ACCESS","ENCODER",
  "CYBER","KERNEL","DOMAIN","NODE","PACKET","CIPHER","PROXY","HACKER",
  "CLIENT","SOCKET","BINARY","BOTNET","UPLINK","TROJAN","CACHE",
  "FIREWALL","MALWARE","SUBNET","SWITCH","VECTOR","WIDGET",
  "APOLLO","GALAXY","ORACLE","PHANTOM","QUANTUM","RADAR","TITAN","VIRUS",
  "DELTA","OMEGA","SIGMA","ALPHA","BRAVO","STORM","BLAZE","FROST"
];

// In-memory data store
let teams = {};
let adminState = { isPaused: false, isLocked: false, roundStartedAt: null, currentRound: 1 };
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';

// Persist simple state to disk locally
const DATA_FILE = path.join(__dirname, 'data.json');
try {
  if (fs.existsSync(DATA_FILE)) {
    const data = JSON.parse(fs.readFileSync(DATA_FILE));
    teams = data.teams || {};
    adminState = { ...adminState, ...(data.adminState || {}) };
  }
} catch (err) { console.log('Starting fresh database.'); }

function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ teams, adminState }));
  } catch (err) { console.error('Could not write data file', err); }
}

// Generate a unique login code for a team
function generateLoginCode() {
  const usedCodes = new Set(Object.values(teams).map(t => t.loginCode).filter(Boolean));
  const available = LOGIN_WORDS.filter(w => !usedCodes.has(w));
  if (available.length === 0) {
    // Fallback: generate random 5-letter code
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * 26)];
    return code;
  }
  return available[Math.floor(Math.random() * available.length)];
}

// Convert a string to space-separated binary
function textToBinary(text) {
  return text.split('').map(c => c.charCodeAt(0).toString(2).padStart(8, '0')).join(' ');
}

// -------- API ENDPOINTS --------

// --- PUBLIC TEAMS API ---
app.get('/api/teams', (req, res) => {
  res.json(teams);
});

app.post('/api/register', (req, res) => {
  const { id, name, members } = req.body;
  if (!id) return res.status(400).json({ error: 'missing id' });

  const loginCode = generateLoginCode();

  teams[id] = {
    id, name, members,
    loginCode,
    startTime: adminState.roundStartedAt ? adminState.roundStartedAt : null,
    endTime: null,
    puzzlesSolved: 0,
    puzzleAnswers: {},
    puzzleAttempts: {},
    loginAttempts: 0,
    loggedIn: false,
    isQualified: false
  };
  saveData();
  res.json({ id, loginCode });
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

// Get team's login code as binary (public endpoint for the team)
app.get('/api/team/:id/code', (req, res) => {
  const { id } = req.params;
  if (!teams[id]) return res.status(404).json({ error: 'Team not found' });

  // Only reveal the binary code if the round has started
  if (!adminState.roundStartedAt) {
    return res.json({ binary: null, started: false });
  }

  res.json({
    binary: textToBinary(teams[id].loginCode),
    started: true
  });
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
  } else if (updates.restartRound) {
    // Restart the timer from now without changing the round number
    adminState.roundStartedAt = Date.now();
    adminState.isPaused = false;
    Object.keys(teams).forEach(id => {
      teams[id].startTime = adminState.roundStartedAt;
      teams[id].endTime = null;
    });
  } else if (updates.resetRound) {
    // Reset for a new round
    adminState.roundStartedAt = null;
    adminState.currentRound = updates.currentRound || (adminState.currentRound + 1);
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

app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Arena listening on port ${PORT}`));
