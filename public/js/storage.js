/* ===========================
   Tech Escape Arena – Storage
   LocalStorage utility module with Background API Sync
   =========================== */

const Storage = (() => {
  const KEYS = {
    CURRENT_TEAM: 'tea_current_team',
    ALL_TEAMS: 'tea_all_teams',
    INTRO_PLAYED: 'tea_intro_played'
  };

  function set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function get(key, fallback = null) {
    const val = localStorage.getItem(key);
    if (val === null) return fallback;
    try {
      return JSON.parse(val);
    } catch {
      return val;
    }
  }

  function remove(key) {
    localStorage.removeItem(key);
  }
  
  // --- SYNC ENGINE ---
  async function syncWithServer() {
    try {
      const token = sessionStorage.getItem('tea_admin_token');
      const headers = token ? { 'Authorization': 'Bearer ' + token } : {};
      
      const resTeams = await fetch('/api/teams', { headers });
      if (resTeams.ok) {
        const serverTeams = await resTeams.json();
        set(KEYS.ALL_TEAMS, serverTeams);
      }
      
      const resAdmin = await fetch('/api/adminState', { headers });
      if (resAdmin.ok) {
        const st = await resAdmin.json();
        localStorage.setItem('tea_admin_state', JSON.stringify(st));
      }
    } catch(e) {}
  }
  
  // Auto-sync every 2 seconds
  setInterval(syncWithServer, 2000);
  // Initial sync immediately
  setTimeout(syncWithServer, 100);

  function pushTeam(id) {
     const teams = getAllTeams();
     if (!teams[id]) return;
     fetch(`/api/team/${id}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(teams[id])
     }).catch(e=>{});
  }

  // --- Intro Status ---
  function isIntroPlayed() {
    return sessionStorage.getItem(KEYS.INTRO_PLAYED) === 'true';
  }

  function setIntroPlayed() {
    sessionStorage.setItem(KEYS.INTRO_PLAYED, 'true');
  }

  // --- Multi-team Architecture ---
  function getAllTeams() {
    return get(KEYS.ALL_TEAMS, {});
  }

  function saveAllTeams(teams) {
    set(KEYS.ALL_TEAMS, teams);
  }

  function getActiveTeamId() {
    return get(KEYS.CURRENT_TEAM);
  }

  function setActiveTeamId(id) {
    set(KEYS.CURRENT_TEAM, id);
  }

  function getActiveTeam() {
    const id = getActiveTeamId();
    const teams = getAllTeams();
    return id && teams[id] ? teams[id] : null;
  }

  function saveActiveTeam(data) {
    const id = getActiveTeamId();
    if (!id) return;
    const teams = getAllTeams();
    if (!teams[id]) {
      teams[id] = { id };
    }
    teams[id] = { ...teams[id], ...data };
    saveAllTeams(teams);
    pushTeam(id);
  }

  // Admin / Registration Helper
  function registerTeam(name, membersStr) {
    let id = 'TEA-' + Math.random().toString(36).substring(2, 6).toUpperCase();
    const teams = getAllTeams();
    // Ensure unique
    while (teams[id]) {
        id = 'TEA-' + Math.random().toString(36).substring(2, 6).toUpperCase();
    }
    
    let roundStart = null;
    try {
        const adState = JSON.parse(localStorage.getItem('tea_admin_state') || '{}');
        if (adState.roundStartedAt) roundStart = adState.roundStartedAt;
    } catch(e) {}

    teams[id] = {
      id,
      name,
      members: membersStr,
      loginCode: null,
      startTime: roundStart,
      endTime: null,
      puzzlesSolved: 0,
      puzzleAnswers: {},
      puzzleAttempts: {},
      loginAttempts: 0,
      loggedIn: false,
      isQualified: false
    };
    saveAllTeams(teams);
    
    // Register with server — server generates the loginCode
    fetch('/api/register', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ id, name, members: membersStr })
    }).then(res => res.json()).then(data => {
      if (data.loginCode) {
        const t = getAllTeams();
        if (t[id]) {
          t[id].loginCode = data.loginCode;
          saveAllTeams(t);
        }
      }
    }).catch(e=>{});
    
    return id;
  }

  // Verify Team ID exists
  function teamExists(id) {
    const teams = getAllTeams();
    return !!teams[id];
  }

  // --- Compatibility Getters / Setters ---
  
  function getTeamId() {
    return getActiveTeamId();
  }

  function setTeamId(id) {
    setActiveTeamId(id);
  }

  function getStartTime() {
    const t = getActiveTeam();
    return t ? t.startTime : null;
  }

  function setStartTime(time) {
    saveActiveTeam({ startTime: time });
  }

  function getEndTime() {
    const t = getActiveTeam();
    return t ? t.endTime : null;
  }

  function setEndTime(time) {
    saveActiveTeam({ endTime: time });
  }

  function getPuzzlesSolved() {
    const t = getActiveTeam();
    return t ? (t.puzzlesSolved || 0) : 0;
  }

  function setPuzzlesSolved(count) {
    saveActiveTeam({ puzzlesSolved: count });
  }

  function getPuzzleAnswers() {
    const t = getActiveTeam();
    return t ? (t.puzzleAnswers || {}) : {};
  }

  function savePuzzleAnswer(puzzleNum, answer) {
    const answers = getPuzzleAnswers();
    answers[puzzleNum] = answer;
    saveActiveTeam({ puzzleAnswers: answers });
  }

  function getPuzzleAttempts(puzzleNum) {
    const t = getActiveTeam();
    const attempts = t ? (t.puzzleAttempts || {}) : {};
    return attempts[puzzleNum] || 0;
  }

  function incrementPuzzleAttempts(puzzleNum) {
    const t = getActiveTeam();
    const attempts = t ? (t.puzzleAttempts || {}) : {};
    attempts[puzzleNum] = (attempts[puzzleNum] || 0) + 1;
    saveActiveTeam({ puzzleAttempts: attempts });
    return attempts[puzzleNum];
  }

  function getLoginAttempts() {
    const t = getActiveTeam();
    return t ? (t.loginAttempts || 0) : 0;
  }

  function incrementLoginAttempts() {
    const current = getLoginAttempts();
    saveActiveTeam({ loginAttempts: current + 1 });
    return current + 1;
  }

  function isLoggedIn() {
    const t = getActiveTeam();
    return t ? (t.loggedIn || false) : false;
  }

  function setLoggedIn(val) {
    saveActiveTeam({ loggedIn: val });
  }

  function resetAll() {
    Object.values(KEYS).forEach(key => remove(key));
  }

  return {
    isIntroPlayed,
    setIntroPlayed,
    getAllTeams,
    saveAllTeams,
    registerTeam,
    teamExists,
    getTeamId,
    setTeamId,
    getStartTime,
    setStartTime,
    getEndTime,
    setEndTime,
    getPuzzlesSolved,
    setPuzzlesSolved,
    getPuzzleAnswers,
    savePuzzleAnswer,
    getPuzzleAttempts,
    incrementPuzzleAttempts,
    getLoginAttempts,
    incrementLoginAttempts,
    isLoggedIn,
    setLoggedIn,
    resetAll,
  };
})();
