/* ===========================
   Tech Escape Arena – Results & Leaderboard
   Multi-Round with Tabs
   =========================== */

(function () {
  'use strict';

  const TOTAL_TIME = 45 * 60 * 1000;
  const tbody = document.getElementById('results-body');
  const roundTabs = document.getElementById('round-tabs');
  const thPuzzles = document.getElementById('th-puzzles');
  const roundSummary = document.getElementById('round-summary');
  const lbTimer = document.getElementById('lb-timer');

  let currentTab = 'all';

  // --- Tab Click Handling ---
  roundTabs.addEventListener('click', (e) => {
    const tab = e.target.closest('.round-tab');
    if (!tab) return;
    
    document.querySelectorAll('.round-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    
    currentTab = tab.getAttribute('data-round');
    renderLeaderboard();
  });

  // --- Live Timer ---
  function updateTimer() {
    let adminState = {};
    try {
      const val = localStorage.getItem('tea_admin_state');
      if (val) adminState = JSON.parse(val);
    } catch(e) {}

    if (!adminState.roundStartedAt) {
      lbTimer.textContent = 'NOT STARTED';
      lbTimer.classList.remove('warning', 'danger');
      return;
    }

    if (adminState.isPaused) {
      lbTimer.textContent = 'PAUSED';
      lbTimer.classList.add('warning');
      lbTimer.classList.remove('danger');
      return;
    }

    const elapsed = Date.now() - adminState.roundStartedAt;
    const remaining = Math.max(0, TOTAL_TIME - elapsed);
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);

    lbTimer.textContent = String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');

    lbTimer.classList.remove('warning', 'danger');
    if (remaining <= 5 * 60 * 1000) {
      lbTimer.classList.add('danger');
    } else if (remaining <= 15 * 60 * 1000) {
      lbTimer.classList.add('warning');
    }
  }

  // --- Render Leaderboard ---
  function renderLeaderboard() {
    const allTeams = Storage.getAllTeams();
    const teamsArray = Object.values(allTeams);

    if (currentTab === 'all') {
      renderOverall(teamsArray);
    } else {
      renderRound(teamsArray, parseInt(currentTab));
    }

    updateRoundSummary(teamsArray);
  }

  function renderOverall(teamsArray) {
    if (thPuzzles) thPuzzles.textContent = 'Puzzles Solved';

    // Sort: most puzzles solved, then shortest time
    teamsArray.sort((a, b) => {
      if (b.puzzlesSolved !== a.puzzlesSolved) {
        return b.puzzlesSolved - a.puzzlesSolved;
      }
      const timeA = a.endTime ? (a.endTime - a.startTime) : Infinity;
      const timeB = b.endTime ? (b.endTime - b.startTime) : Infinity;
      return timeA - timeB;
    });

    tbody.innerHTML = '';

    teamsArray.forEach((team, index) => {
      const tr = document.createElement('tr');
      const rank = index + 1;
      
      const isQualified = rank <= 15 && team.puzzlesSolved > 0;
      const statusText = team.endTime ? 'COMPLETED' : (team.puzzlesSolved > 0 ? 'IN PROGRESS' : 'NOT STARTED');
      const statusClass = team.endTime ? 'status-qualified' : (team.puzzlesSolved > 0 ? 'status-inprogress' : 'status-eliminated');
      
      let timeStr = '--:--';
      if (team.endTime && team.startTime) {
        const ms = team.endTime - team.startTime;
        const mins = Math.floor(ms / 60000);
        const secs = Math.floor((ms % 60000) / 1000);
        timeStr = String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
      } else if (team.startTime) {
        timeStr = 'RUNNING';
      }

      const rankClass = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : '';

      tr.innerHTML = `
        <td class="rank-cell ${rankClass}">#${rank}</td>
        <td>${team.id}</td>
        <td>${team.name || 'Unknown'}</td>
        <td>${team.puzzlesSolved} / 4</td>
        <td>${timeStr}</td>
        <td class="${statusClass}">${statusText}</td>
      `;
      tbody.appendChild(tr);

      // Save qualified status
      if (team.isQualified !== isQualified) {
        team.isQualified = isQualified;
        Storage.saveAllTeams({...Storage.getAllTeams(), [team.id]: team});
      }
    });
  }

  function renderRound(teamsArray, roundNum) {
    if (thPuzzles) thPuzzles.textContent = `Round ${roundNum} Status`;

    // For a specific round, show if they've solved puzzle N
    // Sort by: solved this round first, then by time
    teamsArray.sort((a, b) => {
      const aSolved = (a.puzzlesSolved || 0) >= roundNum;
      const bSolved = (b.puzzlesSolved || 0) >= roundNum;
      
      if (aSolved !== bSolved) return bSolved - aSolved;
      
      // Both solved or both not — sort by total time if solved
      if (aSolved && bSolved) {
        const timeA = a.endTime ? (a.endTime - a.startTime) : Infinity;
        const timeB = b.endTime ? (b.endTime - b.startTime) : Infinity;
        return timeA - timeB;
      }
      
      // Neither solved — sort by puzzles solved desc
      return (b.puzzlesSolved || 0) - (a.puzzlesSolved || 0);
    });

    tbody.innerHTML = '';

    teamsArray.forEach((team, index) => {
      const tr = document.createElement('tr');
      const rank = index + 1;
      const solved = (team.puzzlesSolved || 0) >= roundNum;
      
      let statusText, statusClass;
      if (solved) {
        statusText = '✅ CLEARED';
        statusClass = 'status-qualified';
      } else if ((team.puzzlesSolved || 0) === roundNum - 1) {
        statusText = '⏳ ATTEMPTING';
        statusClass = 'status-inprogress';
      } else if ((team.puzzlesSolved || 0) < roundNum - 1) {
        statusText = '🔒 LOCKED';
        statusClass = 'status-eliminated';
      } else {
        statusText = '—';
        statusClass = 'status-eliminated';
      }

      let timeStr = '--:--';
      if (team.endTime && team.startTime) {
        const ms = team.endTime - team.startTime;
        const mins = Math.floor(ms / 60000);
        const secs = Math.floor((ms % 60000) / 1000);
        timeStr = String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
      } else if (team.startTime) {
        timeStr = 'RUNNING';
      }

      const rankClass = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : '';

      tr.innerHTML = `
        <td class="rank-cell ${rankClass}">#${rank}</td>
        <td>${team.id}</td>
        <td>${team.name || 'Unknown'}</td>
        <td>${statusText}</td>
        <td>${timeStr}</td>
        <td class="${solved ? 'status-qualified' : 'status-eliminated'}">${solved ? 'QUALIFIED' : 'PENDING'}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  function updateRoundSummary(teamsArray) {
    const total = teamsArray.length;
    const completed = teamsArray.filter(t => t.endTime).length;
    const inProgress = teamsArray.filter(t => t.startTime && !t.endTime && t.puzzlesSolved > 0).length;

    let summaryHtml = `<strong>${total}</strong> teams registered`;
    summaryHtml += ` · <strong>${completed}</strong> completed`;
    summaryHtml += ` · <strong>${inProgress}</strong> in progress`;

    // Per-round breakdown
    summaryHtml += '<div style="margin-top:0.5rem;">';
    for (let r = 1; r <= 4; r++) {
      const cleared = teamsArray.filter(t => (t.puzzlesSolved || 0) >= r).length;
      summaryHtml += `<span style="margin-right:1rem;">R${r}: <strong style="color:var(--neon);">${cleared}</strong>/${total}</span>`;
    }
    summaryHtml += '</div>';

    roundSummary.innerHTML = summaryHtml;
  }

  // --- Update round tab badges ---
  function updateTabBadges() {
    const allTeams = Object.values(Storage.getAllTeams());
    const total = allTeams.length;

    for (let r = 1; r <= 4; r++) {
      const tab = document.querySelector(`.round-tab[data-round="${r}"]`);
      if (!tab) continue;
      const badge = tab.querySelector('.round-badge');
      if (!badge) continue;

      const cleared = allTeams.filter(t => (t.puzzlesSolved || 0) >= r).length;
      
      badge.className = 'round-badge';
      if (cleared === total && total > 0) {
        badge.classList.add('completed');
      } else if (cleared > 0) {
        badge.classList.add('active-round');
      } else {
        badge.classList.add('pending');
      }
    }
  }

  // Initial render
  renderLeaderboard();
  updateTimer();
  updateTabBadges();

  // Auto-update every 3 seconds
  setInterval(() => {
    renderLeaderboard();
    updateTimer();
    updateTabBadges();
  }, 3000);
})();
