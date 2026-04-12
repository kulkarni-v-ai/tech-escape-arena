/* ===========================
   Tech Escape Arena – Admin Panel
   =========================== */

(function () {
  'use strict';

  const tbody = document.getElementById('admin-tbody');
  const btnExport = document.getElementById('btn-export-csv');
  const btnTimer = document.getElementById('btn-toggle-timer');
  const btnLock = document.getElementById('btn-toggle-lock');

  const btnStart = document.getElementById('btn-start-round');

  // --- Auth Check ---
  const token = sessionStorage.getItem('tea_admin_token');
  if (!token) {
    window.location.href = 'admin-login.html';
  }

  // --- Admin State ---
  const ADMIN_STATE_KEY = 'tea_admin_state';
  function getAdminState() {
    const defaultState = { isPaused: false, isLocked: false, roundStartedAt: null };
    const val = localStorage.getItem(ADMIN_STATE_KEY);
    return val ? JSON.parse(val) : defaultState;
  }
  
  async function pushAdminState(payload) {
    await fetch('/api/adminState', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify(payload)
    });
    updateAdminUI(); // relies on local sync in storage.js doing a pull
  }

  function updateAdminUI() {
    const st = getAdminState();
    btnTimer.textContent = st.isPaused ? 'Resume Timer' : 'Pause Timer';
    btnTimer.style.background = st.isPaused ? 'var(--neon)' : '';
    btnTimer.style.color = st.isPaused ? '#000' : '';

    btnLock.textContent = st.isLocked ? 'Unlock Submissions' : 'Lock Submissions';
    btnLock.style.background = st.isLocked ? 'var(--neon)' : '';
    btnLock.style.color = st.isLocked ? '#000' : '';
    
    if (st.roundStartedAt) {
      btnStart.textContent = 'Round Active';
      btnStart.style.opacity = '0.5';
      btnStart.style.pointerEvents = 'none';
      btnStart.style.background = 'var(--neon)';
      btnStart.style.color = '#000';
    }
  }

  btnStart.addEventListener('click', () => {
    if (confirm("START ROUND? The 45-minute countdown will begin immediately for all teams (including their time to find the Access Key).")) {
      pushAdminState({ startRound: true });
    }
  });

  btnTimer.addEventListener('click', () => {
    const st = getAdminState();
    pushAdminState({ isPaused: !st.isPaused });
  });

  btnLock.addEventListener('click', () => {
    const st = getAdminState();
    pushAdminState({ isLocked: !st.isLocked });
  });

  async function pushAllTeams(updatedTeams) {
    await fetch('/api/admin/teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ teams: updatedTeams })
    });
  }

  // --- Render Table ---
  function renderTable() {
    const teams = Object.values(Storage.getAllTeams());
    tbody.innerHTML = '';
    
    teams.forEach(t => {
      const tr = document.createElement('tr');
      
      let status = t.endTime ? 'Completed' : (t.startTime ? 'In Progress' : 'Not Started');
      let statusColor = t.endTime ? '#00ffaa' : (t.startTime ? '#ffaa00' : '#888');

      let ansText = 'N/A';
      try {
        const { finalCode } = getPuzzlesForTeam(t.id);
        ansText = finalCode;
      } catch(e){}

      tr.innerHTML = `
        <td>${t.id}</td>
        <td>${t.name}</td>
        <td style="max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${t.members}">${t.members}</td>
        <td>
          <input type="number" class="override-input" data-id="${t.id}" value="${t.puzzlesSolved}" min="0" max="4" />
        </td>
        <td style="color:${statusColor};">${status}</td>
        <td><small style="color:var(--neon-cyan); font-size:0.8rem;">${ansText}</small></td>
        <td>
          <button class="btn-admin update-btn" data-id="${t.id}">Update</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // Attach override events
    document.querySelectorAll('.update-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.getAttribute('data-id');
        const input = document.querySelector(`.override-input[data-id="${id}"]`);
        const newVal = parseInt(input.value, 10);
        
        if (!isNaN(newVal) && newVal >= 0 && newVal <= 4) {
          const allTeams = Storage.getAllTeams();
          allTeams[id].puzzlesSolved = newVal;
          Storage.saveAllTeams(allTeams);
          e.target.textContent = 'Saving...';
          await pushAllTeams(allTeams);
          e.target.textContent = 'Saved!';
          setTimeout(() => { e.target.textContent = 'Update'; renderTable(); }, 1000);
        }
      });
    });
  }

  // --- CSV Export ---
  btnExport.addEventListener('click', () => {
    const teams = Object.values(Storage.getAllTeams());
    let csv = 'Team ID,Name,Members,Puzzles Solved,Start Time,End Time,Total Time (ms),Qualified\n';
    
    teams.forEach(t => {
      const totalTime = (t.endTime && t.startTime) ? (t.endTime - t.startTime) : '';
      csv += `"${t.id}","${t.name}","${t.members}",${t.puzzlesSolved},${t.startTime || ''},${t.endTime || ''},${totalTime},${t.isQualified}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'TechEscapeArena_Results.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  });

  // Init
  updateAdminUI();
  renderTable();
  setInterval(renderTable, 5000);
})();
