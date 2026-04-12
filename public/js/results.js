/* ===========================
   Tech Escape Arena – Results & Leaderboard
   =========================== */

(function () {
  'use strict';

  const tbody = document.getElementById('results-body');

  function renderLeaderboard() {
    const allTeams = Storage.getAllTeams();
    const teamsArray = Object.values(allTeams);

    // Sort strategy:
    // 1. Most puzzles solved
    // 2. Shortest time taken (endTime - startTime)
    // 3. If still ongoing, just rank by puzzles solved.

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
      
      // Top 15 are Qualified
      const isQualified = rank <= 15 && team.puzzlesSolved > 0;
      const statusText = isQualified ? 'QUALIFIED' : 'ELIMINATED';
      const statusClass = isQualified ? 'status-qualified' : 'status-eliminated';
      
      // Format time
      let timeStr = 'IN PROGRESS';
      if (team.endTime) {
        const ms = team.endTime - team.startTime;
        const mins = Math.floor(ms / 60000);
        const secs = Math.floor((ms % 60000) / 1000);
        timeStr = String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
      }

      tr.innerHTML = `
        <td class="rank-cell">#${rank}</td>
        <td>${team.id}</td>
        <td>${team.name || 'Unknown'}</td>
        <td>${team.puzzlesSolved} / 4</td>
        <td>${timeStr}</td>
        <td class="${statusClass}">${statusText}</td>
      `;
      tbody.appendChild(tr);

      // Save qualified status back to Storage
      if(team.isQualified !== isQualified) {
        team.isQualified = isQualified;
        Storage.saveAllTeams({...Storage.getAllTeams(), [team.id]: team});
      }
    });
  }

  // Initial render
  renderLeaderboard();

  // Auto-update every 5 seconds
  setInterval(renderLeaderboard, 5000);
})();
