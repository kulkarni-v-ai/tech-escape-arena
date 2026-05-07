/* ===========================
   Tech Escape Arena – Round 2
   Team-facing timer + submission
   =========================== */

(function () {
  'use strict';

  const socket = io();
  const timerEl = document.getElementById('r2-timer');
  const statusEl = document.getElementById('r2-status');
  const formSection = document.getElementById('form-section');
  const teamInput = document.getElementById('team-id-input');
  const answerInput = document.getElementById('answer-input');
  const btnSubmit = document.getElementById('btn-submit');
  const errorMsg = document.getElementById('error-msg');
  const successOverlay = document.getElementById('success-overlay');
  const successTeam = document.getElementById('success-team');

  let submitted = false;
  let currentStatus = 'waiting';

  // ── Timer Sync via Socket.IO ──
  socket.on('timer:sync', (data) => {
    currentStatus = data.status;
    updateTimerDisplay(data.remaining, data.status);
    updateFormState(data);
  });

  function updateTimerDisplay(remaining, status) {
    if (status === 'waiting') {
      timerEl.textContent = '45:00';
      timerEl.className = 'r2-timer';
      statusEl.textContent = 'WAITING FOR HOST';
      statusEl.className = 'r2-status';
      return;
    }
    if (status === 'paused') {
      statusEl.textContent = '⏸ PAUSED';
      statusEl.className = 'r2-status paused-status';
    } else if (status === 'ended') {
      timerEl.textContent = '00:00';
      timerEl.className = 'r2-timer ended';
      statusEl.textContent = "⏱ TIME'S UP";
      statusEl.className = 'r2-status ended-status';
      return;
    } else {
      statusEl.textContent = '● ROUND ACTIVE';
      statusEl.className = 'r2-status active-status';
    }

    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    timerEl.textContent = String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');

    timerEl.className = 'r2-timer';
    if (remaining <= 5 * 60 * 1000) timerEl.classList.add('danger');
    else if (remaining <= 15 * 60 * 1000) timerEl.classList.add('warning');
  }

  function updateFormState(data) {
    if (submitted) return;
    
    // Lock form if round is waiting, paused, ended, or explicitly locked
    const isLockedState = data.isLocked || data.status === 'waiting' || data.status === 'paused' || data.status === 'ended';
    
    if (isLockedState) {
      formSection.classList.add('locked-form');
      btnSubmit.disabled = true;
      if (data.status === 'waiting') {
         btnSubmit.textContent = 'WAITING FOR HOST...';
      } else if (data.status === 'paused') {
         btnSubmit.textContent = 'ROUND PAUSED';
      } else {
         btnSubmit.textContent = 'SUBMISSIONS LOCKED';
      }
    } else if (data.status === 'running') {
      formSection.classList.remove('locked-form');
      btnSubmit.disabled = false;
      btnSubmit.textContent = 'SUBMIT ANSWER';
    } else if (data.status === 'ended') {
      // Auto-show success overlay and then redirect to Round 3 after 5 seconds
      showSuccess(teamInput.value || Storage.getTeamId() || 'UNSYNCED');
      setTimeout(() => {
        window.location.href = '/round3.html';
      }, 5000);
    }
  }

  // ── Check if already submitted (from localStorage) ──
  const savedSubmission = localStorage.getItem('tea_r2_submitted');
  if (savedSubmission) {
    submitted = true;
    showSuccess(JSON.parse(savedSubmission).teamId);
  }

  // Poll for round changes to force-redirect to Round 3
  setInterval(async () => {
    try {
      const res = await fetch('/api/adminState');
      if (res.ok) {
        const state = await res.json();
        if (state.currentRound >= 3) {
          window.location.href = '/round3.html';
        }
      }
    } catch(e) {}
  }, 5000);

  // ── Submit Answer ──
  btnSubmit.addEventListener('click', async () => {
    errorMsg.textContent = '';
    const teamId = teamInput.value.trim().toUpperCase();
    const answer = answerInput.value.trim();

    if (!teamId) { showError('Enter your Team ID'); return; }
    if (!answer) { showError('Enter your final answer'); return; }

    btnSubmit.disabled = true;
    btnSubmit.textContent = 'SUBMITTING...';

    try {
      const res = await fetch('/api/round2/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId, finalAnswer: answer })
      });

      const data = await res.json();

      if (!res.ok) {
        showError(data.error || 'Submission failed');
        btnSubmit.disabled = false;
        btnSubmit.textContent = 'SUBMIT ANSWER';
        return;
      }

      // Success!
      submitted = true;
      localStorage.setItem('tea_r2_submitted', JSON.stringify({ teamId }));
      showSuccess(teamId);

    } catch (err) {
      showError('Network error. Try again.');
      btnSubmit.disabled = false;
      btnSubmit.textContent = 'SUBMIT ANSWER';
    }
  });

  function showError(msg) {
    errorMsg.textContent = '❌ ' + msg;
    errorMsg.style.animation = 'none';
    errorMsg.offsetHeight; // trigger reflow
    errorMsg.style.animation = 'fadeIn 0.3s ease';
  }

  function showSuccess(teamId) {
    formSection.classList.add('locked-form');
    successTeam.textContent = teamId;
    successOverlay.classList.add('active');
  }

  // ── Initial fetch (fallback if Socket.IO hasn't connected yet) ──
  fetch('/api/round2/timer')
    .then(r => r.json())
    .then(data => {
      updateTimerDisplay(data.remaining, data.status);
      updateFormState(data);
    })
    .catch(() => {});

})();
