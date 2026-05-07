const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');

require('dotenv').config();

// Models
const Team = require('./models/Team');
const RoundConfig = require('./models/RoundConfig');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/views', express.static(path.join(__dirname, 'views')));

// Make io accessible to route files
app.set('io', io);

// ─────────────── MongoDB Connection ───────────────
const MONGO_URI = process.env.MONGODB_URI;
if (!MONGO_URI) {
  console.error('❌ MONGODB_URI not set in .env');
  process.exit(1);
}

mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB connected successfully'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });

mongoose.connection.on('disconnected', () => console.warn('⚠️  MongoDB disconnected – reconnecting…'));
mongoose.connection.on('reconnected', () => console.log('✅ MongoDB reconnected'));
mongoose.connection.on('error', err => console.error('❌ MongoDB error:', err.message));

// ─────────────── Admin Config ───────────────
const ADMIN_PATH = process.env.ADMIN_PATH || '/system-override';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';

function requireAuth(req, res, next) {
  const authMsg = req.headers['authorization'];
  if (authMsg !== `Bearer ${ADMIN_PASSWORD}`) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

// ─────────────── Admin Page Routes ───────────────
app.get(ADMIN_PATH, (req, res) => {
  res.sendFile(path.join(__dirname, 'views/admin-login.html'));
});
app.get(`${ADMIN_PATH}/dashboard`, (req, res) => {
  res.sendFile(path.join(__dirname, 'views/admin.html'));
});
app.get(`${ADMIN_PATH}/round2`, (req, res) => {
  res.sendFile(path.join(__dirname, 'views/admin-r2.html'));
});
app.get(`${ADMIN_PATH}/round4`, (req, res) => {
  res.sendFile(path.join(__dirname, 'views/admin-r4.html'));
});

// ─────────────── Login Code Pool ───────────────
const LOGIN_WORDS = [
  "SYSTEM","NEXUS","ROUTER","SERVER","MATRIX","PORTAL","ACCESS","ENCODER",
  "CYBER","KERNEL","DOMAIN","NODE","PACKET","CIPHER","PROXY","HACKER",
  "CLIENT","SOCKET","BINARY","BOTNET","UPLINK","TROJAN","CACHE",
  "FIREWALL","MALWARE","SUBNET","SWITCH","VECTOR","WIDGET",
  "APOLLO","GALAXY","ORACLE","PHANTOM","QUANTUM","RADAR","TITAN","VIRUS",
  "DELTA","OMEGA","SIGMA","ALPHA","BRAVO","STORM","BLAZE","FROST"
];

async function generateLoginCode() {
  const teams = await Team.find({}, 'loginCode');
  const usedCodes = new Set(teams.map(t => t.loginCode).filter(Boolean));
  const available = LOGIN_WORDS.filter(w => !usedCodes.has(w));
  if (available.length === 0) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * 26)];
    return code;
  }
  return available[Math.floor(Math.random() * available.length)];
}

function textToBinary(text) {
  return text.split('').map(c => c.charCodeAt(0).toString(2).padStart(8, '0')).join(' ');
}

// ─────────────── PUBLIC API: Teams (Round 1 compat) ───────────────

app.get('/api/teams', async (req, res) => {
  try {
    const teams = await Team.find().lean();
    const teamsObj = {};
    teams.forEach(t => { 
      teamsObj[t.teamId] = { 
        ...t, 
        id: t.teamId, 
        name: t.teamName 
      }; 
    });
    res.json(teamsObj);
  } catch (err) {
    console.error('GET /api/teams error:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/register', async (req, res) => {
  try {
    const { id, name, members } = req.body;
    if (!id) return res.status(400).json({ error: 'missing id' });

    const loginCode = await generateLoginCode();
    const config = await RoundConfig.findOne({ roundNumber: 1 });

    await Team.findOneAndUpdate(
      { teamId: id },
      {
        teamId: id, teamName: name, members, loginCode,
        startTime: config?.startedAt || null, endTime: null,
        puzzlesSolved: 0, puzzleAnswers: {}, puzzleAttempts: {},
        loginAttempts: 0, loggedIn: false, isQualified: false,
        currentRound: 1, eliminated: false, score: 0
      },
      { upsert: true, returnDocument: 'after' }
    );
    res.json({ id, loginCode });
  } catch (err) {
    console.error('POST /api/register error:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/team/:id/update', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };
    
    // Auto-qualify if 4 or more puzzles solved in Round 1
    if (updates.puzzlesSolved >= 4) {
      updates.isQualified = true;
    }
    
    const team = await Team.findOneAndUpdate({ teamId: id }, updates, { returnDocument: 'after' }).lean();
    if (!team) return res.status(404).json({ error: 'Team not found' });
    
    res.json({ 
      success: true, 
      team: { ...team, id: team.teamId, name: team.teamName } 
    });
  } catch (err) {
    console.error('Update team error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/login-verify', async (req, res) => {
  try {
    const { teamId, loginCode } = req.body;
    if (!teamId || !loginCode) return res.status(400).json({ error: 'Missing teamId or loginCode' });

    const team = await Team.findOne({ teamId });
    if (!team) return res.status(404).json({ error: 'Team not found' });

    if (team.loginCode !== loginCode.toUpperCase()) {
      return res.status(401).json({ error: 'Incorrect decoding' });
    }

    // Generate new session token (current timestamp is enough for uniqueness per team)
    const sessionToken = Date.now().toString();
    
    team.loggedIn = true;
    team.sessionToken = sessionToken;
    await team.save();

    res.json({ 
      success: true, 
      sessionToken,
      team: { ...team.toObject(), id: team.teamId, name: team.teamName }
    });
  } catch (err) {
    console.error('Login verify error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/team/:id', async (req, res) => {
  try {
    const team = await Team.findOne({ teamId: req.params.id });
    if (!team) return res.status(404).json({ error: 'Team not found' });
    res.json({ ...team.toObject(), id: team.teamId });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/team/:id/code', async (req, res) => {
  try {
    const team = await Team.findOne({ teamId: req.params.id });
    if (!team) return res.status(404).json({ error: 'Team not found' });

    const config = await RoundConfig.findOne({ roundNumber: 1 });
    if (!config?.startedAt) return res.json({ binary: null, started: false });

    res.json({ binary: textToBinary(team.loginCode), started: true });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// ─────────────── ADMIN STATE (Round 1 compat) ───────────────

app.get('/api/adminState', async (req, res) => {
  try {
    // Check if there's a running/paused round
    let config = await RoundConfig.findOne({ status: { $in: ['running', 'paused'] } });
    
    if (!config) {
      // No active round — use the admin's selected round (stored in a special doc)
      const selector = await RoundConfig.findOne({ roundNumber: 0 }); // roundNumber 0 = admin selection tracker
      const selectedRound = selector?.selectedRound || 1;
      config = await RoundConfig.findOne({ roundNumber: selectedRound });
    }

    const roundNum = Math.min(config?.roundNumber || 1, 4);
    const isPaused = config?.status === 'paused';
    const isLocked = config?.isLocked || false;
    let roundStartedAt = config?.startedAt || null;

    res.json({ isPaused, isLocked, roundStartedAt, currentRound: roundNum });
  } catch (err) {
    res.json({ isPaused: false, isLocked: false, roundStartedAt: null, currentRound: 1 });
  }
});

app.post('/api/adminState', requireAuth, async (req, res) => {
  try {
    const updates = req.body;

    // Find current active config
    let config = await RoundConfig.findOne({ status: { $in: ['running', 'paused'] } });
    
    // If no running round, use the selector doc (round 0)
    const selector = await RoundConfig.findOne({ roundNumber: 0 });
    let roundNum = updates.currentRound || selector?.selectedRound || 1;

    if (!config) {
      config = await RoundConfig.findOne({ roundNumber: roundNum });
      if (!config) {
        // Create it if missing
        config = await RoundConfig.create({ roundNumber: roundNum, status: 'waiting' });
      }
    }

    if (updates.startRound) {
      await RoundConfig.updateMany({ roundNumber: { $ne: roundNum } }, { status: 'ended', startedAt: null });
      await RoundConfig.findOneAndUpdate(
        { roundNumber: roundNum },
        { startedAt: Date.now(), status: 'running', totalPausedMs: 0, pausedAt: null },
        { upsert: true }
      );
      await Team.updateMany({ startTime: null }, { startTime: Date.now() });

    } else if (updates.restartRound) {
      await RoundConfig.updateMany({ roundNumber: { $ne: roundNum } }, { status: 'ended', startedAt: null });
      await RoundConfig.findOneAndUpdate(
        { roundNumber: roundNum },
        { startedAt: Date.now(), status: 'running', totalPausedMs: 0, pausedAt: null },
        { upsert: true }
      );
      await Team.updateMany({}, { startTime: Date.now(), endTime: null });
    }

    if (updates.resetRound) {
      // UNIVERSAL STOP
      await RoundConfig.updateMany({}, { startedAt: null, status: 'waiting', totalPausedMs: 0, pausedAt: null });
      await RoundConfig.findOneAndUpdate({ roundNumber: 0 }, { selectedRound: 1 }, { upsert: true });
      roundNum = 1;
    }

    if (updates.resetProgress) {
      await Team.updateMany({}, {
        puzzlesSolved: 0,
        puzzleAnswers: {},
        puzzleAttempts: {},
        startTime: null,
        endTime: null,
        eliminated: false,
        isQualified: false
      });
      await RoundConfig.updateMany({}, { startedAt: null, status: 'waiting', totalPausedMs: 0, pausedAt: null });
      await RoundConfig.findOneAndUpdate({ roundNumber: 0 }, { selectedRound: 1 }, { upsert: true });
      roundNum = 1;
    }
    
    const updateObj = {};
    if (updates.isPaused !== undefined) {
      if (updates.isPaused) {
        updateObj.status = 'paused';
        updateObj.pausedAt = Date.now();
      } else {
        updateObj.status = 'running';
        if (config?.pausedAt) {
          updateObj.totalPausedMs = (config.totalPausedMs || 0) + (Date.now() - config.pausedAt);
        }
        updateObj.pausedAt = null;
      }
    }
    if (updates.isLocked !== undefined) updateObj.isLocked = updates.isLocked;
    if (updates.currentRound !== undefined) {
      roundNum = Math.min(updates.currentRound, 4);
      // Save the admin's selection
      await RoundConfig.findOneAndUpdate(
        { roundNumber: 0 },
        { roundNumber: 0, selectedRound: roundNum },
        { upsert: true }
      );
      await RoundConfig.findOneAndUpdate(
        { roundNumber: roundNum },
        { $setOnInsert: { status: 'waiting', duration: 45 * 60 * 1000 } },
        { upsert: true }
      );
    }
    if (Object.keys(updateObj).length > 0) {
      await RoundConfig.findOneAndUpdate({ roundNumber: roundNum }, updateObj, { upsert: true });
    }

    // Build response
    const finalConfig = await RoundConfig.findOne({ roundNumber: roundNum });
    const teams = await Team.find().lean();
    const teamsObj = {};
    teams.forEach(t => { teamsObj[t.teamId] = { ...t, id: t.teamId, name: t.teamName }; });

    res.json({
      adminState: {
        isPaused: finalConfig?.status === 'paused',
        isLocked: finalConfig?.isLocked || false,
        roundStartedAt: finalConfig?.startedAt || null,
        currentRound: roundNum
      },
      teams: teamsObj
    });
  } catch (err) {
    console.error('POST /api/adminState error:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/admin/teams', requireAuth, async (req, res) => {
  try {
    const teams = req.body.teams;
    for (const [id, data] of Object.entries(teams)) {
      await Team.findOneAndUpdate({ teamId: id }, { ...data, teamId: id }, { upsert: true });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/admin/auth', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.json({ success: true, token: ADMIN_PASSWORD });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
});

// ─────────────── Team Management API ───────────────
app.post('/api/admin/import-teams', requireAuth, async (req, res) => {
  try {
    const { teams } = req.body;
    if (!Array.isArray(teams)) return res.status(400).json({ error: 'teams must be an array' });
    const results = [];
    for (const t of teams) {
      const teamId = t.teamId || 'TEA-' + Math.random().toString(36).substring(2, 6).toUpperCase();
      const loginCode = await generateLoginCode();
      await Team.findOneAndUpdate(
        { teamId },
        { teamId, teamName: t.teamName || '', members: t.members || '', loginCode, currentRound: 1, eliminated: false, score: 0 },
        { upsert: true, returnDocument: 'after' }
      );
      results.push(teamId);
    }
    res.json({ success: true, imported: results.length, teamIds: results });
  } catch (err) { 
    console.error('import-teams error:', err);
    res.status(500).json({ error: err.message || 'Database error' }); 
  }
});

app.post('/api/admin/edit-team', requireAuth, async (req, res) => {
  try {
    const { teamId, teamName, members, loginCode, puzzlesSolved, score, eliminated, isQualified } = req.body;
    const updateObj = { teamName, members };
    if (loginCode !== undefined) updateObj.loginCode = loginCode;
    if (puzzlesSolved !== undefined) updateObj.puzzlesSolved = parseInt(puzzlesSolved) || 0;
    if (score !== undefined) updateObj.score = parseInt(score) || 0;
    if (eliminated !== undefined) updateObj.eliminated = !!eliminated;
    if (isQualified !== undefined) updateObj.isQualified = !!isQualified;

    const team = await Team.findOneAndUpdate({ teamId }, updateObj, { returnDocument: 'after' });
    if (!team) return res.status(404).json({ error: 'Team not found' });
    res.json({ success: true, team });
  } catch (err) { 
    console.error('edit-team error:', err);
    res.status(500).json({ error: err.message || 'Database error' }); 
  }
});

app.post('/api/admin/delete-team', requireAuth, async (req, res) => {
  try {
    await Team.deleteOne({ teamId: req.body.teamId });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Database error' }); }
});

// ─────────────── Mount Round 2 & 4 Routes ───────────────
app.use('/api/round2', require('./routes/round2'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/round4', require('./routes/round4'));
app.use('/api/admin', require('./routes/admin-r4'));

// ─────────────── Socket.IO ───────────────
  // Round 3 (Cyber Battle) State
  let r3State = {
    bracket: [],
    currentMatch: 0,
    currentQuestion: -1,
    battleStatus: 'setup',
    currentQ: null,
    timeLeft: 0
  };

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Sync R3 State on join
    socket.emit('r3:state', r3State);

    socket.on('r3:updateState', (newState) => {
      // Only Admin should be able to update state (ideally verify token)
      r3State = { ...r3State, ...newState };
      io.emit('r3:state', r3State);
    });

    socket.on('r3:submit', (data) => {
      // Broadcast submission to Host/Viewer
      io.emit('r3:submission', data);
    });
  socket.on('disconnect', () => console.log('🔌 Client disconnected:', socket.id));
});

// Broadcast timers every second
setInterval(async () => {
  try {
    // Round 2 timer
    const r2 = await RoundConfig.findOne({ roundNumber: 2 });
    if (r2) {
      const remaining = r2.getRemaining();
      if (remaining <= 0 && r2.status === 'running') {
        r2.status = 'ended'; r2.isLocked = true; await r2.save();
      }
      io.emit('timer:sync', { remaining, status: r2.status, isLocked: r2.isLocked });
    }
    // Round 4 timer
    const r4 = await RoundConfig.findOne({ roundNumber: 4 });
    if (r4) {
      const remaining = r4.getRemaining();
      if (remaining <= 0 && r4.status === 'running') {
        r4.status = 'ended'; r4.isLocked = true; await r4.save();
      }
      io.emit('timer:r4', { remaining, status: r4.status, isLocked: r4.isLocked });
    }
  } catch (err) { /* silently retry */ }
}, 1000);

// ─────────────── Fallback ───────────────
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🏟️  Arena listening on port ${PORT}`));
