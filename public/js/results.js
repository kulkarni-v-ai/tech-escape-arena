/* ===========================
   Tech Escape Arena – Results & Leaderboard
   Multi-Round with Tabs — Per-round data
   =========================== */

(function () {
  'use strict';

  const tbody = document.getElementById('results-body');
  const roundTabs = document.getElementById('round-tabs');
  const thPuzzles = document.getElementById('th-puzzles');
  const roundSummary = document.getElementById('round-summary');
  const lbTimer = document.getElementById('lb-timer');

  let currentTab = 'all';
  let r2Data = [];
  let r4Data = [];

  // --- Tab Click ---
  roundTabs.addEventListener('click', (e) => {
    const tab = e.target.closest('.round-tab');
    if (!tab) return;
    document.querySelectorAll('.round-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentTab = tab.getAttribute('data-round');
    renderLeaderboard();
  });

  // --- Live Timer (sync from server) ---
  async function syncTimer() {
    try {
      const res = await fetch('/api/adminState');
      const data = await res.json();
      localStorage.setItem('tea_admin_state', JSON.stringify(data));
    } catch (e) {}
  }

  function updateTimer() {
    let st = {};
    try { const val = localStorage.getItem('tea_admin_state'); if (val) st = JSON.parse(val); } catch (e) {}

    if (!st.roundStartedAt) {
      lbTimer.textContent = 'NOT STARTED';
      lbTimer.classList.remove('warning', 'danger');
      return;
    }
    if (st.isPaused) {
      lbTimer.textContent = 'PAUSED';
      lbTimer.classList.add('warning');
      lbTimer.classList.remove('danger');
      return;
    }
    const TOTAL = 45 * 60 * 1000;
    const remaining = Math.max(0, TOTAL - (Date.now() - st.roundStartedAt));
    const m = Math.floor(remaining / 60000);
    const s = Math.floor((remaining % 60000) / 1000);
    lbTimer.textContent = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    lbTimer.classList.remove('warning', 'danger');
    if (remaining <= 5 * 60 * 1000) lbTimer.classList.add('danger');
    else if (remaining <= 15 * 60 * 1000) lbTimer.classList.add('warning');
  }

  // --- Fetch R2 / R4 from server ---
  async function fetchRoundData() {
    try { const r = await fetch('/api/round2/leaderboard'); r2Data = (await r.json()).leaderboard || []; } catch (e) { r2Data = []; }
    try { const r = await fetch('/api/round4/progress'); const d = await r.json(); r4Data = Array.isArray(d) ? d : (d.progress || []); } catch (e) { r4Data = []; }
  }

  // --- Render ---
  function renderLeaderboard() {
    const allTeams = Storage.getAllTeams();
    const teams = Object.values(allTeams);

    if (currentTab === 'all') renderOverall(teams);
    else if (currentTab === '1') renderRound1(teams);
    else if (currentTab === '2') renderRound2();
    else if (currentTab === '3') renderRound3();
    else if (currentTab === '4') renderRound4();

    updateSummary(teams);
  }

  function fmtTime(ms) {
    return String(Math.floor(ms / 60000)).padStart(2, '0') + ':' + String(Math.floor((ms % 60000) / 1000)).padStart(2, '0');
  }
  function rankClass(r) { return r === 1 ? 'rank-1' : r === 2 ? 'rank-2' : r === 3 ? 'rank-3' : ''; }

  // ── OVERALL ──
  function renderOverall(teams) {
    if (thPuzzles) thPuzzles.textContent = 'R1 Puzzles';
    teams.sort((a, b) => {
      if ((b.puzzlesSolved || 0) !== (a.puzzlesSolved || 0)) return (b.puzzlesSolved || 0) - (a.puzzlesSolved || 0);
      const tA = a.endTime ? (a.endTime - a.startTime) : Infinity;
      const tB = b.endTime ? (b.endTime - b.startTime) : Infinity;
      return tA - tB;
    });
    tbody.innerHTML = '';
    teams.forEach((t, i) => {
      const rank = i + 1;
      const status = t.endTime ? 'R1 COMPLETED' : ((t.puzzlesSolved || 0) > 0 ? 'IN PROGRESS' : 'NOT STARTED');
      const cls = t.endTime ? 'status-qualified' : ((t.puzzlesSolved || 0) > 0 ? 'status-inprogress' : 'status-eliminated');
      const time = t.endTime && t.startTime ? fmtTime(t.endTime - t.startTime) : (t.startTime ? 'RUNNING' : '--:--');
      const tr = document.createElement('tr');
      tr.innerHTML = `<td class="rank-cell ${rankClass(rank)}">#${rank}</td><td>${t.id}</td><td>${t.teamName || t.name || '—'}</td><td>${t.puzzlesSolved || 0}/4</td><td>${time}</td><td class="${cls}">${status}</td>`;
      tbody.appendChild(tr);
    });
  }

  // ── ROUND 1 ──
  function renderRound1(teams) {
    if (thPuzzles) thPuzzles.textContent = 'Round 1 Status';
    teams.sort((a, b) => {
      const aS = (a.puzzlesSolved || 0), bS = (b.puzzlesSolved || 0);
      if (bS !== aS) return bS - aS;
      const tA = a.endTime ? (a.endTime - a.startTime) : Infinity;
      const tB = b.endTime ? (b.endTime - b.startTime) : Infinity;
      return tA - tB;
    });
    tbody.innerHTML = '';
    teams.forEach((t, i) => {
      const rank = i + 1;
      const solved = (t.puzzlesSolved || 0);
      const cleared = solved >= 4;
      const statusText = cleared ? '✅ CLEARED' : (solved > 0 ? `⏳ ${solved}/4 PUZZLES` : '🔒 NOT STARTED');
      const time = t.endTime && t.startTime ? fmtTime(t.endTime - t.startTime) : (t.startTime ? 'RUNNING' : '--:--');
      const tr = document.createElement('tr');
      tr.innerHTML = `<td class="rank-cell ${rankClass(rank)}">#${rank}</td><td>${t.id}</td><td>${t.teamName || t.name || '—'}</td><td>${statusText}</td><td>${time}</td><td class="${cleared ? 'status-qualified' : 'status-eliminated'}">${cleared ? 'QUALIFIED' : 'PENDING'}</td>`;
      tbody.appendChild(tr);
    });
  }

  // ── ROUND 2 (server data) ──
  function renderRound2() {
    if (thPuzzles) thPuzzles.textContent = 'Round 2 Status';
    tbody.innerHTML = '';
    if (!r2Data.length) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-dim);padding:2rem;">No Round 2 data yet</td></tr>'; return; }
    r2Data.forEach((s, i) => {
      const tr = document.createElement('tr');
      const time = s.submissionTime ? new Date(s.submissionTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--';
      tr.innerHTML = `<td class="rank-cell ${rankClass(s.rank || i + 1)}">#${s.rank || i + 1}</td><td>${s.teamId}</td><td>${s.teamName || 'Unknown'}</td><td>${s.isCorrect ? '✅ CORRECT' : '❌ WRONG'}</td><td>${time}</td><td class="${s.qualified ? 'status-qualified' : 'status-eliminated'}">${s.qualified ? 'QUALIFIED' : 'ELIMINATED'}</td>`;
      tbody.appendChild(tr);
    });
  }

  // ── ROUND 3 (localStorage battle state) ──
  function renderRound3() {
    if (thPuzzles) thPuzzles.textContent = 'Round 3 Status';
    tbody.innerHTML = '';
    let r3 = null;
    try { r3 = JSON.parse(localStorage.getItem('tea_r3_state')); } catch (e) {}
    if (!r3 || !r3.bracket) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-dim);padding:2rem;">No Round 3 data — battles not configured</td></tr>'; return; }
    r3.bracket.forEach((m, i) => {
      [{ name: m.teamA, score: m.scoreA, isWinner: m.winner === m.teamA }, { name: m.teamB, score: m.scoreB, isWinner: m.winner === m.teamB }].forEach((t, j) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td class="rank-cell">${j === 0 ? 'M' + (i + 1) : ''}</td><td colspan="2">${t.name || 'TBD'}</td><td>Score: ${t.score || 0}</td><td>${m.status === 'done' ? 'FINISHED' : (m.status || 'PENDING')}</td><td class="${t.isWinner ? 'status-qualified' : (m.winner ? 'status-eliminated' : '')}">${t.isWinner ? '🏆 WINNER' : (m.winner ? 'ELIMINATED' : '—')}</td>`;
        tbody.appendChild(tr);
      });
    });
  }

  // ── ROUND 4 (server data) ──
  function renderRound4() {
    if (thPuzzles) thPuzzles.textContent = 'Round 4 Status';
    tbody.innerHTML = '';
    if (!r4Data.length) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-dim);padding:2rem;">No Round 4 data yet</td></tr>'; return; }
    r4Data.forEach((p, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td class="rank-cell ${rankClass(i + 1)}">#${i + 1}</td><td>${p.teamId}</td><td>${p.teamName || 'Unknown'}</td><td>Stage ${p.currentStage || 1}/4</td><td>${p.completed ? 'FINISHED' : 'IN PROGRESS'}</td><td class="${p.completed ? 'status-qualified' : 'status-inprogress'}">${p.completed ? '🏆 COMPLETED' : '⏳ STAGE ' + (p.currentStage || 1)}</td>`;
      tbody.appendChild(tr);
    });
  }

  // ── Summary ──
  function updateSummary(teams) {
    const total = teams.length;
    const r1 = teams.filter(t => (t.puzzlesSolved || 0) >= 4).length;
    const r2 = r2Data.filter(s => s.qualified).length;
    const r4 = r4Data.filter(p => p.completed).length;
    let html = `<strong>${total}</strong> teams registered`;
    html += `<div style="margin-top:0.5rem;">`;
    html += `<span style="margin-right:1rem;">R1: <strong style="color:var(--neon);">${r1}</strong>/${total}</span>`;
    html += `<span style="margin-right:1rem;">R2: <strong style="color:var(--neon);">${r2}</strong></span>`;
    html += `<span style="margin-right:1rem;">R3: <strong style="color:var(--neon);">—</strong></span>`;
    html += `<span>R4: <strong style="color:var(--neon);">${r4}</strong></span></div>`;
    roundSummary.innerHTML = html;
  }

  // ── Tab Badges ──
  function updateBadges() {
    const teams = Object.values(Storage.getAllTeams());
    const total = teams.length;
    setBadge('1', teams.filter(t => (t.puzzlesSolved || 0) >= 4).length, total);
    setBadge('2', r2Data.filter(s => s.qualified).length, r2Data.length || 1);
    let r3w = 0; try { r3w = JSON.parse(localStorage.getItem('tea_r3_state'))?.bracket?.filter(m => m.winner).length || 0; } catch (e) {}
    setBadge('3', r3w, 4);
    setBadge('4', r4Data.filter(p => p.completed).length, r4Data.length || 1);
  }

  function setBadge(r, cleared, total) {
    const tab = document.querySelector(`.round-tab[data-round="${r}"]`);
    if (!tab) return;
    const b = tab.querySelector('.round-badge');
    if (!b) return;
    b.className = 'round-badge';
    if (cleared === total && total > 0) b.classList.add('completed');
    else if (cleared > 0) b.classList.add('active-round');
    else b.classList.add('pending');
  }

  // ── Init ──
  async function init() {
    await Promise.all([syncTimer(), fetchRoundData()]);
    renderLeaderboard();
    updateTimer();
    updateBadges();
  }
  init();

  setInterval(async () => {
    await Promise.all([syncTimer(), fetchRoundData()]);
    renderLeaderboard();
    updateTimer();
    updateBadges();
  }, 5000);
})();
