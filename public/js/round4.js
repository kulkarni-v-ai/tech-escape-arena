/* ===========================
   Tech Escape Arena – Round 4
   Team Portal – Stage-by-stage
   =========================== */
(function () {
  'use strict';
  const socket = io();

  const STAGE_TITLES = {
    1: 'CROSSWORD PUZZLE',
    2: 'HIDDEN CHIT HUNT',
    3: "RUBIK'S CUBE CHALLENGE",
    4: 'PENDRIVE CLUE'
  };
  const STAGE_CLEARED_MSG = {
    1: 'Stage 1 Cleared.',
    2: 'New coordinates unlocked.',
    3: 'Challenge completed.',
    4: 'Escape Sequence Completed.'
  };

  let teamId = localStorage.getItem('tea_r4_team') || '';
  let progress = null;
  let selectedFile = null;

  const timerEl = document.getElementById('r4-timer');
  const identifySection = document.getElementById('identify-section');
  const progressSection = document.getElementById('progress-section');
  const stageContent = document.getElementById('stage-content');
  const clearedOverlay = document.getElementById('cleared-overlay');
  const clearedTitle = document.getElementById('cleared-title');
  const clearedSub = document.getElementById('cleared-sub');
  const victoryScreen = document.getElementById('victory-screen');
  const victoryRank = document.getElementById('victory-rank');
  const victoryTime = document.getElementById('victory-time');
  const disqualifiedSection = document.getElementById('disqualified-section');
  const teamInput = document.getElementById('team-id-input');
  const btnIdentify = document.getElementById('btn-identify');
  const identifyError = document.getElementById('identify-error');
  const stageFill = document.getElementById('stage-fill');

  // Timer
  socket.on('timer:r4', (data) => updateTimer(data.remaining, data.status));

  function updateTimer(remaining, status) {
    if (status === 'waiting') { timerEl.textContent = 'WAITING'; timerEl.className = 'r4-timer'; return; }
    if (status === 'paused') { timerEl.textContent = 'PAUSED'; timerEl.className = 'r4-timer warning'; return; }
    if (status === 'ended') { timerEl.textContent = '00:00'; timerEl.className = 'r4-timer danger'; return; }
    const m = Math.floor(remaining / 60000), s = Math.floor((remaining % 60000) / 1000);
    timerEl.textContent = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    timerEl.className = 'r4-timer';
    if (remaining <= 5 * 60 * 1000) timerEl.classList.add('danger');
    else if (remaining <= 15 * 60 * 1000) timerEl.classList.add('warning');
  }

  // Identify team
  if (teamId) { loadProgress(); }

  btnIdentify.addEventListener('click', () => {
    const id = teamInput.value.trim().toUpperCase();
    if (!id) { identifyError.textContent = '❌ Enter your Team ID'; identifyError.className = 'r4-feedback error'; return; }
    teamId = id;
    localStorage.setItem('tea_r4_team', id);
    loadProgress();
  });

  async function loadProgress() {
    try {
      const res = await fetch(`/api/round4/progress/${teamId}`);
      if (!res.ok) {
        const data = await res.json();
        identifyError.textContent = '❌ ' + (data.error || 'Team not found');
        identifyError.className = 'r4-feedback error';
        teamId = ''; localStorage.removeItem('tea_r4_team');
        return;
      }
      progress = await res.json();
      identifySection.style.display = 'none';

      if (progress.disqualified) {
        disqualifiedSection.style.display = '';
        return;
      }

      if (progress.completed) {
        showVictory();
        return;
      }

      progressSection.style.display = '';
      stageContent.style.display = '';
      updateProgressDots();
      renderStage();
    } catch (err) {
      identifyError.textContent = '❌ Network error'; identifyError.className = 'r4-feedback error';
    }
  }

  function updateProgressDots() {
    if (!progress) return;
    const dots = document.querySelectorAll('.r4-stage-dot');
    dots.forEach(dot => {
      const stage = parseInt(dot.dataset.stage);
      dot.className = 'r4-stage-dot';
      if (progress.stages.find(s => s.stage === stage)) dot.classList.add('completed');
      else if (stage === progress.currentStage) dot.classList.add('active');
    });
    const pct = ((progress.currentStage - 1) / 3) * 100;
    stageFill.style.width = Math.min(pct, 100) + '%';
  }

  function renderStage() {
    if (!progress || progress.completed) return;
    const stage = progress.currentStage;
    if (stage > 4) { showVictory(); return; }

    const title = STAGE_TITLES[stage] || 'STAGE ' + stage;
    const hint = progress.currentHint || 'Follow the instructions...';

    if (stage <= 3) {
      stageContent.innerHTML = `
        <div class="r4-stage-card">
          <div class="r4-stage-num">STAGE ${stage} OF 4</div>
          <div class="r4-stage-title">${title}</div>
          <div class="r4-hint">${hint}</div>
          <input type="text" class="r4-answer-input" id="stage-answer" placeholder="Enter answer..." autocomplete="off" spellcheck="false" />
          <button class="r4-submit-btn" id="btn-stage-submit">SUBMIT ANSWER</button>
          <p class="r4-feedback" id="stage-feedback"></p>
        </div>
      `;
      document.getElementById('btn-stage-submit').addEventListener('click', submitStageAnswer);
    } else {
      stageContent.innerHTML = `
        <div class="r4-stage-card">
          <div class="r4-stage-num">FINAL STAGE</div>
          <div class="r4-stage-title">${title}</div>
          <div class="r4-hint">${hint}</div>
          <div class="r4-upload-area" id="upload-area">
            <div class="r4-upload-icon">📸</div>
            <div class="r4-upload-text">TAP TO UPLOAD YOUR RECREATED PHOTO</div>
            <input type="file" id="file-input" accept="image/*" style="display:none;" />
            <img class="r4-preview" id="preview-img" />
          </div>
          <button class="r4-submit-btn" id="btn-final-submit" disabled>SUBMIT FINAL IMAGE</button>
          <p class="r4-feedback" id="stage-feedback"></p>
        </div>
      `;
      const uploadArea = document.getElementById('upload-area');
      const fileInput = document.getElementById('file-input');
      const previewImg = document.getElementById('preview-img');

      uploadArea.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', (e) => {
        if (e.target.files[0]) {
          selectedFile = e.target.files[0];
          const reader = new FileReader();
          reader.onload = (ev) => {
            previewImg.src = ev.target.result;
            previewImg.style.display = 'block';
            uploadArea.classList.add('has-file');
            document.getElementById('btn-final-submit').disabled = false;
          };
          reader.readAsDataURL(selectedFile);
        }
      });
      document.getElementById('btn-final-submit').addEventListener('click', submitFinalImage);
    }
  }

  async function submitStageAnswer() {
    const answer = document.getElementById('stage-answer').value.trim();
    const feedback = document.getElementById('stage-feedback');
    if (!answer) { feedback.textContent = '❌ Enter an answer'; feedback.className = 'r4-feedback error'; return; }

    const btn = document.getElementById('btn-stage-submit');
    btn.disabled = true; btn.textContent = 'CHECKING...';

    try {
      const res = await fetch('/api/round4/submit-stage', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId, stage: progress.currentStage, answer })
      });
      const data = await res.json();
      if (data.success) {
        showCleared(progress.currentStage, () => {
          progress.currentStage = data.currentStage;
          progress.currentHint = data.nextHint;
          progress.stages.push({ stage: progress.currentStage - 1 });
          if (data.completed) { showVictory(); return; }
          updateProgressDots();
          renderStage();
        });
      } else {
        feedback.textContent = '❌ ' + (data.error || 'Wrong answer');
        feedback.className = 'r4-feedback error';
        btn.disabled = false; btn.textContent = 'SUBMIT ANSWER';
      }
    } catch (err) {
      feedback.textContent = '❌ Network error'; feedback.className = 'r4-feedback error';
      btn.disabled = false; btn.textContent = 'SUBMIT ANSWER';
    }
  }

  async function submitFinalImage() {
    if (!selectedFile) return;
    const feedback = document.getElementById('stage-feedback');
    const btn = document.getElementById('btn-final-submit');
    btn.disabled = true; btn.textContent = 'UPLOADING...';

    try {
      const formData = new FormData();
      formData.append('teamId', teamId);
      formData.append('image', selectedFile);

      const res = await fetch('/api/round4/submit-final', { method: 'POST', body: formData });
      const data = await res.json();

      if (data.success) {
        showVictoryWithRank(data.rank, data.completedAt);
      } else {
        feedback.textContent = '❌ ' + (data.error || 'Upload failed');
        feedback.className = 'r4-feedback error';
        btn.disabled = false; btn.textContent = 'SUBMIT FINAL IMAGE';
      }
    } catch (err) {
      feedback.textContent = '❌ Network error'; feedback.className = 'r4-feedback error';
      btn.disabled = false; btn.textContent = 'SUBMIT FINAL IMAGE';
    }
  }

  function showCleared(stage, callback) {
    clearedTitle.textContent = STAGE_CLEARED_MSG[stage] || 'STAGE CLEARED';
    clearedSub.textContent = stage < 4 ? 'Unlocking next coordinates...' : 'Finalizing...';
    clearedOverlay.classList.add('active');
    setTimeout(() => { clearedOverlay.classList.remove('active'); if (callback) callback(); }, 3000);
  }

  function showVictory() { victoryScreen.classList.add('active'); }

  function showVictoryWithRank(rank, completedAt) {
    victoryRank.textContent = '#' + rank;
    if (completedAt) {
      const d = new Date(completedAt);
      victoryTime.textContent = 'Completed at ' + d.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
    }
    victoryScreen.classList.add('active');
  }

  // Live updates
  socket.on('r4:progress', (data) => {
    if (data.teamId === teamId) loadProgress();
  });
  socket.on('r4:reset', () => {
    localStorage.removeItem('tea_r4_team');
    window.location.reload();
  });

  // Initial timer
  fetch('/api/round4/timer').then(r => r.json()).then(d => updateTimer(d.remaining, d.status)).catch(() => {});
})();
