/* ===========================
   Tech Escape Arena – Round 2 Admin
   Full control panel
   =========================== */

(function () {
  'use strict';

  const socket = io();

  // Auth check
  // Auth check
  let token = sessionStorage.getItem('tea_admin_token') || localStorage.getItem('tea_admin_token');
  if (!token) {
    // Try to get from URL (for easy transition from R1)
    const urlParams = new URLSearchParams(window.location.search);
    token = urlParams.get('token');
    if (token) sessionStorage.setItem('tea_admin_token', token);
  }

  if (!token) {
    window.location.href = '/system-override'; // Direct redirect to login
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token
  };

  // ── Elements ──
  const adminTimer = document.getElementById('admin-timer');
  const timerStatus = document.getElementById('timer-status');
  const btnStart = document.getElementById('btn-start');
  const btnPause = document.getElementById('btn-pause');
  const btnResume = document.getElementById('btn-resume');
  const btnReset = document.getElementById('btn-reset');
  const answerInput = document.getElementById('answer-input');
  const btnSetAnswer = document.getElementById('btn-set-answer');
  const btnLock = document.getElementById('btn-lock');
  const btnReveal = document.getElementById('btn-reveal');
  const btnResetRound = document.getElementById('btn-reset-round');
  const btnExport = document.getElementById('btn-export');
  const submissionsBody = document.getElementById('submissions-body');
  const teamsBody = document.getElementById('teams-body');
  const statTotal = document.getElementById('stat-total');
  const statSubmitted = document.getElementById('stat-submitted');
  const statCorrect = document.getElementById('stat-correct');
  const statQualified = document.getElementById('stat-qualified');
  const modalOverlay = document.getElementById('modal-overlay');
  const modalTitle = document.getElementById('modal-title');
  const modalText = document.getElementById('modal-text');
  const modalConfirm = document.getElementById('modal-confirm');
  const modalCancel = document.getElementById('modal-cancel');
  const navR1 = document.getElementById('nav-r1-admin');

  // Set admin links
  let basePath = window.location.pathname.replace(/\/round2$/, '');
  navR1.href = basePath + '/dashboard';
  const navR4 = document.getElementById('nav-r4-admin');
  if (navR4) navR4.href = basePath + '/round4';

  let currentConfig = {};
  let modalCallback = null;

  // ── Modal ──
  function showModal(title, text, callback) {
    modalTitle.textContent = title;
    modalText.textContent = text;
    modalCallback = callback;
    modalOverlay.classList.add('active');
  }
  modalConfirm.addEventListener('click', () => {
    modalOverlay.classList.remove('active');
    if (modalCallback) modalCallback();
  });
  modalCancel.addEventListener('click', () => {
    modalOverlay.classList.remove('active');
    modalCallback = null;
  });

  // ── API helpers ──
  async function adminPost(url, body = {}) {
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    return res.json();
  }
  async function adminGet(url) {
    const res = await fetch(url, { headers });
    return res.json();
  }

  // ── Timer sync ──
  socket.on('timer:sync', (data) => {
    updateTimerUI(data.remaining, data.status, data.isLocked);
  });

  function updateTimerUI(remaining, status, isLocked) {
    currentConfig.status = status;
    currentConfig.isLocked = isLocked;

    if (status === 'waiting') {
      adminTimer.textContent = '45:00';
      timerStatus.textContent = 'WAITING';
      btnStart.style.display = '';
      btnPause.style.display = 'none';
      btnResume.style.display = 'none';
    } else if (status === 'running') {
      const m = Math.floor(remaining / 60000);
      const s = Math.floor((remaining % 60000) / 1000);
      adminTimer.textContent = String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
      timerStatus.textContent = 'RUNNING';
      timerStatus.style.color = '#00ffaa';
      btnStart.style.display = 'none';
      btnPause.style.display = '';
      btnResume.style.display = 'none';
    } else if (status === 'paused') {
      const m = Math.floor(remaining / 60000);
      const s = Math.floor((remaining % 60000) / 1000);
      adminTimer.textContent = String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
      timerStatus.textContent = 'PAUSED';
      timerStatus.style.color = '#ffaa00';
      btnStart.style.display = 'none';
      btnPause.style.display = 'none';
      btnResume.style.display = '';
    } else if (status === 'ended') {
      adminTimer.textContent = '00:00';
      timerStatus.textContent = "TIME'S UP";
      timerStatus.style.color = '#ff003c';
      btnStart.style.display = 'none';
      btnPause.style.display = 'none';
      btnResume.style.display = 'none';
    }

    // Lock button text
    btnLock.textContent = isLocked ? '🔓 UNLOCK SUBMISSIONS' : '🔒 LOCK SUBMISSIONS';
    if (isLocked) btnLock.classList.add('active-btn');
    else btnLock.classList.remove('active-btn');
  }

  // ── Timer Controls ──
  btnStart.addEventListener('click', () => {
    showModal('START TIMER', 'Start the 45-minute countdown? All teams will see the timer.', () => {
      adminPost('/api/admin/timer/start');
    });
  });
  btnPause.addEventListener('click', () => adminPost('/api/admin/timer/pause'));
  btnResume.addEventListener('click', () => adminPost('/api/admin/timer/resume'));
  btnReset.addEventListener('click', () => {
    showModal('RESET TIMER', 'Reset the timer to 45:00? This cannot be undone.', () => {
      adminPost('/api/admin/timer/reset');
    });
  });

  // ── Set Answer ──
  btnSetAnswer.addEventListener('click', async () => {
    const answer = answerInput.value.trim();
    if (!answer) return;
    await adminPost('/api/admin/set-answer', { answer });
    btnSetAnswer.textContent = '✅ SAVED!';
    setTimeout(() => { btnSetAnswer.textContent = 'SAVE ANSWER'; }, 2000);
  });

  // ── Lock Submissions ──
  btnLock.addEventListener('click', () => adminPost('/api/admin/lock-submissions'));

  // ── Reveal Leaderboard ──
  btnReveal.addEventListener('click', () => {
    showModal('REVEAL LEADERBOARD', 'Reveal the leaderboard to all viewers? This triggers the cinematic animation.', () => {
      adminPost('/api/admin/reveal-leaderboard');
    });
  });

  // ── Reset Round ──
  btnResetRound.addEventListener('click', () => {
    showModal('⚠ RESET ROUND 2', 'This will DELETE all Round 2 submissions and reset the timer. Are you absolutely sure?', () => {
      adminPost('/api/admin/reset-round');
      localStorage.removeItem('tea_r2_submitted');
    });
  });

  // ── Submission notification ──
  socket.on('submission:new', (data) => {
    // Flash notification
    const flash = document.createElement('div');
    flash.style.cssText = 'position:fixed;top:1rem;right:1rem;background:rgba(0,255,170,0.15);border:1px solid #00ffaa;border-radius:8px;padding:12px 20px;z-index:9999;font-family:var(--font-mono);font-size:0.8rem;color:#00ffaa;animation:fadeIn 0.3s ease;';
    flash.textContent = `📡 New: ${data.teamName || data.teamId} ${data.isCorrect ? '✅' : '❌'}`;
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 4000);
    refreshData();
  });

  // ── Data Refresh ──
  async function refreshData() {
    try {
      // Get config
      const config = await adminGet('/api/admin/r2/config');
      currentConfig = config;
      if (config.correctAnswer) answerInput.value = config.correctAnswer;

      // Get submissions
      const submissions = await adminGet('/api/admin/r2/submissions');

      // Get leaderboard (ranked)
      const lbRes = await fetch('/api/round2/leaderboard');
      const lbData = await lbRes.json();
      const ranked = lbData.leaderboard || [];

      // Get teams
      const teams = await adminGet('/api/admin/r2/teams');

      // Stats
      statTotal.textContent = teams.length;
      statSubmitted.textContent = submissions.length;
      statCorrect.textContent = submissions.filter(s => s.isCorrect).length;
      statQualified.textContent = ranked.filter(s => s.qualified).length;

      // Render submissions table
      submissionsBody.innerHTML = '';
      ranked.forEach(s => {
        const tr = document.createElement('tr');
        const timeStr = s.submissionTime
          ? new Date(s.submissionTime).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', second:'2-digit' })
          : '--';
        tr.innerHTML = `
          <td style="font-weight:bold;color:${s.rank<=3?'#FFD700':'var(--text-primary)'}">#${s.rank}</td>
          <td>${s.teamId}</td>
          <td>${s.teamName || '—'}</td>
          <td style="color:var(--neon-cyan);max-width:150px;overflow:hidden;text-overflow:ellipsis;">${s.finalAnswer}</td>
          <td>${s.isCorrect ? '<span class="badge badge-green">✅ YES</span>' : '<span class="badge badge-red">❌ NO</span>'}</td>
          <td>${timeStr}</td>
          <td>${s.qualified ? '<span class="badge badge-green">QUALIFIED</span>' : '<span class="badge badge-red">ELIMINATED</span>'}</td>
        `;
        submissionsBody.appendChild(tr);
      });

      // Render teams table
      teamsBody.innerHTML = '';
      if (!Array.isArray(teams)) {
        console.error('Teams data is not an array:', teams);
        return;
      }

      teams.forEach(t => {
        const tr = document.createElement('tr');
        const sub = t.round2Submission;
        let statusBadge;
        
        // Use Round 1 qualification if no R2 data yet
        if (t.eliminated) {
          statusBadge = '<span class="badge badge-red">ELIMINATED</span>';
        } else if (sub?.qualified) {
          statusBadge = '<span class="badge badge-green">QUALIFIED</span>';
        } else if (sub) {
          statusBadge = '<span class="badge badge-yellow">R2 SUBMITTED</span>';
        } else if (t.isQualified) {
          statusBadge = '<span class="badge badge-green">R1 QUALIFIED</span>';
        } else {
          statusBadge = '<span class="badge badge-dim">PENDING</span>';
        }

        tr.innerHTML = `
          <td>${t.teamId}</td>
          <td>${t.teamName || '—'}</td>
          <td style="max-width:120px;overflow:hidden;text-overflow:ellipsis;" title="${t.members||''}">${t.members || '—'}</td>
          <td>${statusBadge}</td>
          <td>
            <button class="a2-btn green" style="font-size:0.65rem;padding:4px 8px;" onclick="qualifyTeam('${t.teamId}')">QUALIFY</button>
            <button class="a2-btn danger" style="font-size:0.65rem;padding:4px 8px;" onclick="eliminateTeam('${t.teamId}')">ELIMINATE</button>
          </td>
        `;
        teamsBody.appendChild(tr);
      });

    } catch (err) {
      console.error('Refresh error:', err);
    }
  }

  // ── Eliminate / Qualify (global functions for inline onclick) ──
  window.eliminateTeam = function (teamId) {
    showModal('ELIMINATE TEAM', `Eliminate team ${teamId}? They will be marked as disqualified.`, async () => {
      await adminPost('/api/admin/eliminate', { teamId });
      refreshData();
    });
  };

  window.qualifyTeam = function (teamId) {
    showModal('QUALIFY TEAM', `Manually qualify team ${teamId} for Round 3?`, async () => {
      await adminPost('/api/admin/qualify', { teamId });
      refreshData();
    });
  };

  // ── Export CSV ──
  btnExport.addEventListener('click', async () => {
    const lbRes = await fetch('/api/round2/leaderboard');
    const lbData = await lbRes.json();
    const ranked = lbData.leaderboard || [];

    let csv = 'Rank,Team ID,Team Name,Answer,Correct,Submission Time,Qualified\n';
    ranked.forEach(s => {
      csv += `${s.rank},"${s.teamId}","${s.teamName}","${s.finalAnswer}",${s.isCorrect},${s.submissionTime},${s.qualified}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'Round2_Results.csv';
    a.click(); URL.revokeObjectURL(url);
  });

  // ── Initial load + polling ──
  refreshData();
  setInterval(refreshData, 3000);

  // Initial timer state
  fetch('/api/round2/timer')
    .then(r => r.json())
    .then(data => updateTimerUI(data.remaining, data.status, data.isLocked))
    .catch(() => {});

})();
