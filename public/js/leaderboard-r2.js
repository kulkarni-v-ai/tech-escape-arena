/* ===========================
   Tech Escape Arena – Round 2 Leaderboard
   Cinematic reveal + real-time updates
   =========================== */

(function () {
  'use strict';

  const socket = io();
  const lbTimer = document.getElementById('lb-timer');
  const lbBody = document.getElementById('lb-body');
  const waitingOverlay = document.getElementById('waiting-overlay');
  const statTeams = document.getElementById('stat-teams');
  const statSubmitted = document.getElementById('stat-submitted');
  const statCorrect = document.getElementById('stat-correct');

  let revealed = false;
  let leaderboardData = [];

  // ── Timer sync ──
  socket.on('timer:sync', (data) => {
    updateTimer(data.remaining, data.status);
  });

  function updateTimer(remaining, status) {
    if (status === 'waiting') {
      lbTimer.textContent = 'NOT STARTED';
      lbTimer.className = 'lb-timer';
      return;
    }
    if (status === 'paused') {
      lbTimer.textContent = 'PAUSED';
      lbTimer.className = 'lb-timer warning';
      return;
    }
    if (status === 'ended') {
      lbTimer.textContent = '00:00';
      lbTimer.className = 'lb-timer danger';
      return;
    }
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    lbTimer.textContent = String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
    lbTimer.className = 'lb-timer';
    if (remaining <= 5 * 60 * 1000) lbTimer.classList.add('danger');
    else if (remaining <= 15 * 60 * 1000) lbTimer.classList.add('warning');
  }

  // ── Reveal event ──
  socket.on('reveal:leaderboard', async () => {
    // Force an immediate data fetch before revealing
    await fetchLeaderboard();
    revealed = true;
    waitingOverlay.classList.add('hidden');
    cinematicReveal();
  });

  // ── Fetch leaderboard ──
  async function fetchLeaderboard() {
    try {
      const res = await fetch('/api/round2/leaderboard');
      const data = await res.json();
      leaderboardData = data.leaderboard || [];

      // Update stats
      statSubmitted.textContent = data.totalSubmissions || 0;
      statCorrect.textContent = leaderboardData.filter(s => s.isCorrect).length;

      // Fetch team count
      const teamsRes = await fetch('/api/teams');
      const teams = await teamsRes.json();
      statTeams.textContent = Object.keys(teams).length;

      if (data.revealed && !revealed) {
        revealed = true;
        waitingOverlay.classList.add('hidden');
      }

      renderTable();
    } catch (err) {}
  }

  function renderTable() {
    lbBody.innerHTML = '';

    leaderboardData.forEach((entry, index) => {
      const tr = document.createElement('tr');
      if (revealed) tr.classList.add('revealed');

      const rank = entry.rank || index + 1;
      const rankClass = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : '';

      const timeStr = entry.submissionTime
        ? new Date(entry.submissionTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : '--:--';

      let statusHtml;
      if (entry.qualified) {
        statusHtml = '<span class="qualify-badge q">✅ QUALIFIED</span>';
      } else if (entry.isCorrect) {
        statusHtml = '<span class="qualify-badge q" style="opacity:0.6;">CORRECT</span>';
      } else {
        statusHtml = '<span class="qualify-badge e">❌ ELIMINATED</span>';
      }

      tr.innerHTML = `
        <td class="rank-cell ${rankClass}">#${rank}</td>
        <td>${entry.teamName || entry.teamId}</td>
        <td>${timeStr}</td>
        <td>${statusHtml}</td>
      `;
      lbBody.appendChild(tr);
    });
  }

  // ── Cinematic reveal: rows appear one by one ──
  function cinematicReveal() {
    const rows = lbBody.querySelectorAll('tr');
    rows.forEach(row => row.classList.remove('revealed'));

    rows.forEach((row, i) => {
      setTimeout(() => {
        row.classList.add('revealed');
        // Flash effect
        row.style.background = 'rgba(255,26,26,0.15)';
        setTimeout(() => { row.style.background = ''; }, 500);
      }, i * 300);
    });
  }

  // ── Round reset ──
  socket.on('round:reset', () => {
    revealed = false;
    waitingOverlay.classList.remove('hidden');
    leaderboardData = [];
    renderTable();
  });

  // ── Initial load + polling ──
  fetchLeaderboard();
  setInterval(fetchLeaderboard, 3000);

  // Initial timer fetch
  fetch('/api/round2/timer')
    .then(r => r.json())
    .then(data => {
      updateTimer(data.remaining, data.status);
      if (data.leaderboardRevealed) {
        revealed = true;
        waitingOverlay.classList.add('hidden');
      }
    })
    .catch(() => {});

})();
