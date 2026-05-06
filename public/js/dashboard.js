/* ===========================
   Tech Escape Arena – Dashboard
   =========================== */

(function () {
  'use strict';

  // --- Auth guard ---
  if (!Storage.isLoggedIn()) {
    window.location.href = 'index.html';
    return;
  }

  const { puzzles: Puzzles, finalCode: FINAL_CODE } = getPuzzlesForTeam(Storage.getTeamId());
  
  const TOTAL_TIME = 45 * 60 * 1000; // 45 minutes in ms
  const TOTAL_PUZZLES = Puzzles.length;

  // --- Console easter egg ---
  console.log(
    '%c 🎮 Welcome to Tech Escape Arena 🎮 ',
    'background: #0a0a0a; color: #ff1a1a; font-size: 16px; font-weight: bold; padding: 10px 20px; border: 1px solid #ff1a1a; border-radius: 4px;'
  );
  console.log(
    '%c "The only way out is through." ',
    'color: #888; font-size: 12px; font-style: italic; padding: 3px 0;'
  );

  // --- DOM ---
  const timerDisplay = document.getElementById('timer-display');
  const teamDisplay = document.getElementById('team-id');
  const roundLabel = document.getElementById('round-label');
  const progressFill = document.getElementById('progress-fill');
  const progressLabel = document.getElementById('progress-label');
  const puzzleGrid = document.getElementById('puzzle-grid');
  const finalSection = document.getElementById('final-section');
  const finalInput = document.getElementById('final-input');
  const finalSubmitBtn = document.getElementById('final-submit');
  const finalFeedback = document.getElementById('final-feedback');
  const congratsOverlay = document.getElementById('congrats-overlay');
  const congratsTime = document.getElementById('congrats-time');

  // --- Init ---
  teamDisplay.textContent = 'TEAM: ' + Storage.getTeamId();

  // Update round label from admin state
  try {
    const val = localStorage.getItem('tea_admin_state');
    if (val) {
      const st = JSON.parse(val);
      const round = st.currentRound || 1;
      if (roundLabel) roundLabel.textContent = `ROUND ${round} – Time Remaining`;
    }
  } catch(e) {}

  let puzzlesSolved = Storage.getPuzzlesSolved();

  // --- Timer ---
  function getStartTime() {
    // First check if the team already has a startTime recorded
    const teamStart = Storage.getStartTime();
    if (teamStart) return teamStart;

    // Otherwise check if the admin has started the round
    let adminState = {};
    try { const val = localStorage.getItem('tea_admin_state'); if (val) adminState = JSON.parse(val); } catch(e) {}

    if (adminState.roundStartedAt) {
      // Round was started — record it as this team's start time
      Storage.setStartTime(adminState.roundStartedAt);
      return adminState.roundStartedAt;
    }

    return null; // Round hasn't started yet
  }

  function updateTimer() {
    let adminState = { isPaused: false, isLocked: false };
    try { const val = localStorage.getItem('tea_admin_state'); if (val) adminState = JSON.parse(val); } catch(e) {}

    if (adminState.isPaused) {
      timerDisplay.textContent = "PAUSED";
      timerDisplay.classList.add('warning');
      return;
    }

    const startTime = getStartTime();

    if (!startTime) {
      timerDisplay.textContent = "WAITING...";
      timerDisplay.classList.remove('warning', 'danger');
      return;
    }

    const elapsed = Date.now() - startTime;
    const remaining = Math.max(0, TOTAL_TIME - elapsed);

    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);

    timerDisplay.textContent =
      String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');

    // Color states
    timerDisplay.classList.remove('warning', 'danger');
    if (remaining <= 5 * 60 * 1000) {
      timerDisplay.classList.add('danger');
    } else if (remaining <= 15 * 60 * 1000) {
      timerDisplay.classList.add('warning');
    }

    if (remaining <= 0) {
      timerDisplay.textContent = '00:00';
      timerDisplay.classList.add('danger');
    }
  }

  updateTimer();
  setInterval(updateTimer, 1000);

  // --- Progress ---
  function updateProgress() {
    const pct = (puzzlesSolved / TOTAL_PUZZLES) * 100;
    progressFill.style.width = pct + '%';
    progressLabel.textContent = puzzlesSolved + ' / ' + TOTAL_PUZZLES + ' PUZZLES SOLVED';
  }

  // --- Render Puzzles ---
  function renderPuzzles() {
    puzzleGrid.innerHTML = '';

    Puzzles.forEach((puzzle, index) => {
      const card = document.createElement('div');
      card.className = 'puzzle-card';
      card.id = 'puzzle-card-' + puzzle.id;

      const isSolved = index < puzzlesSolved;
      const isActive = index === puzzlesSolved;
      const isLocked = index > puzzlesSolved;

      if (isSolved) card.classList.add('solved');
      else if (isActive) card.classList.add('active');
      else card.classList.add('locked');

      const savedAnswers = Storage.getPuzzleAnswers();
      const attempts = Storage.getPuzzleAttempts(puzzle.id);

      card.innerHTML = `
        <div class="puzzle-lock-icon">🔒</div>
        <div class="puzzle-header">
          <span class="puzzle-number">Puzzle ${puzzle.id}</span>
          <span class="puzzle-difficulty">${puzzle.difficulty}</span>
        </div>
        <div class="puzzle-title">${puzzle.title}</div>
        <div class="puzzle-description">${puzzle.description}</div>
        <div class="puzzle-challenge">${puzzle.challenge}</div>
        ${puzzle.customHtml ? puzzle.customHtml : ''}
        <p class="puzzle-hint-text">${puzzle.hintText}</p>
        <div class="puzzle-input-area">
          <input type="text" id="puzzle-input-${puzzle.id}" placeholder="Enter answer..." autocomplete="off" ${isSolved || isLocked ? 'disabled' : ''} />
          <button id="puzzle-btn-${puzzle.id}" ${isSolved || isLocked ? 'disabled' : ''}>SUBMIT</button>
        </div>
        <div class="puzzle-feedback" id="puzzle-feedback-${puzzle.id}"></div>
        <div class="puzzle-solved-badge">✅ Solved: ${savedAnswers[puzzle.id] || ''}</div>
      `;

      puzzleGrid.appendChild(card);

      // Attach event listener for active puzzle
      if (isActive) {
        const input = card.querySelector(`#puzzle-input-${puzzle.id}`);
        const btn = card.querySelector(`#puzzle-btn-${puzzle.id}`);
        const feedback = card.querySelector(`#puzzle-feedback-${puzzle.id}`);

        btn.addEventListener('click', () => submitPuzzleAnswer(puzzle, input, feedback));
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') submitPuzzleAnswer(puzzle, input, feedback);
        });

        // Show hint if enough attempts
        if (attempts >= 3) {
          feedback.textContent = '💡 Hint: ' + puzzle.hint;
          feedback.className = 'puzzle-feedback hint';
        }

        // Render dynamic QR code if it's Puzzle 3 and active/solved
        const qrNode = card.querySelector('#qr-code-payload');
        if (qrNode && !qrNode.innerHTML) {
            new QRCode(qrNode, {
                text: qrNode.getAttribute('data-qr'),
                width: 128, height: 128,
                colorDark: "#000", colorLight: "#ffffff",
                correctLevel : QRCode.CorrectLevel.H
            });
        }
      } else if (isSolved) {
        const qrNode = card.querySelector('#qr-code-payload');
        if (qrNode && !qrNode.innerHTML) {
            new QRCode(qrNode, {
                text: qrNode.getAttribute('data-qr'),
                width: 128, height: 128,
                colorDark: "#000", colorLight: "#ffffff",
                correctLevel : QRCode.CorrectLevel.H
            });
        }
      }
    });

    updateProgress();

    // Show final section if all solved
    if (puzzlesSolved >= TOTAL_PUZZLES) {
      finalSection.classList.add('visible');
    }
  }

  // --- Submit Puzzle Answer ---
  function submitPuzzleAnswer(puzzle, inputEl, feedbackEl) {
    let adminState = { isPaused: false, isLocked: false };
    try { const val = localStorage.getItem('tea_admin_state'); if (val) adminState = JSON.parse(val); } catch(e) {}
    
    if (adminState.isLocked) {
      feedbackEl.textContent = '🔒 Submissions are currently locked by System Admin.';
      feedbackEl.className = 'puzzle-feedback error';
      return;
    }

    const value = inputEl.value.trim();
    if (!value) {
      feedbackEl.textContent = 'Please enter an answer.';
      feedbackEl.className = 'puzzle-feedback error';
      return;
    }

    if (puzzle.validate(value)) {
      // Correct!
      puzzlesSolved++;
      Storage.setPuzzlesSolved(puzzlesSolved);
      Storage.savePuzzleAnswer(puzzle.id, value.toUpperCase());

      feedbackEl.textContent = '✅ Correct!';
      feedbackEl.className = 'puzzle-feedback success';

      // Play unlock sound
      playUnlockSound();

      // Re-render after animation
      setTimeout(() => {
        renderPuzzles();

        // Animate the newly active card
        const nextCard = document.getElementById('puzzle-card-' + (puzzle.id + 1));
        if (nextCard) {
          nextCard.classList.add('unlock-anim');
          nextCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 600);

    } else {
      // Wrong
      const attempts = Storage.incrementPuzzleAttempts(puzzle.id);
      feedbackEl.textContent = '❌ Incorrect. Try again.';
      feedbackEl.className = 'puzzle-feedback error';

      // Shake input
      inputEl.style.animation = 'none';
      inputEl.offsetHeight;
      inputEl.style.animation = 'shake 0.4s ease';

      if (attempts >= 3) {
        setTimeout(() => {
          feedbackEl.textContent = '💡 Hint: ' + puzzle.hint;
          feedbackEl.className = 'puzzle-feedback hint';
        }, 1500);
      }
    }
  }

  // --- Final Submission ---
  finalSubmitBtn.addEventListener('click', handleFinalSubmit);
  finalInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleFinalSubmit();
  });

  function handleFinalSubmit() {
    let adminState = { isPaused: false, isLocked: false };
    try { const val = localStorage.getItem('tea_admin_state'); if (val) adminState = JSON.parse(val); } catch(e) {}

    if (adminState.isLocked) {
      finalFeedback.textContent = '🔒 Submissions are currently locked by System Admin.';
      finalFeedback.className = 'puzzle-feedback error';
      return;
    }

    const value = finalInput.value.trim().toUpperCase();

    if (!value) {
      finalFeedback.textContent = 'Enter the combined code.';
      finalFeedback.className = 'puzzle-feedback error';
      return;
    }

    if (value === FINAL_CODE) {
      // Success!
      const endTime = Date.now();
      Storage.setEndTime(endTime);

      finalFeedback.textContent = 'Evaluating results...';
      finalFeedback.className = 'puzzle-feedback success';
      finalFeedback.style.animation = 'pulse 1s infinite alternate';

      // Play victory sound
      playVictorySound();

      setTimeout(() => {
        showWaitOverlay();
      }, 2500);
    } else {
      finalFeedback.textContent = '❌ Incorrect code. Format: ANSWER1-ANSWER2-ANSWER3-ANSWER4';
      finalFeedback.className = 'puzzle-feedback error';
    }
  }

  // --- Wait Overlay ---
  function showWaitOverlay() {
    const overlay = document.getElementById('r1-complete-overlay');
    if (!overlay) return;
    overlay.style.display = 'block';

    const teamStart = Storage.getStartTime();
    const teamEnd = Storage.getEndTime();
    
    document.getElementById('wait-team-id').textContent = Storage.getTeamId();
    if (teamStart && teamEnd) {
      const ms = teamEnd - teamStart;
      const mins = Math.floor(ms / 60000);
      const secs = Math.floor((ms % 60000) / 1000);
      document.getElementById('wait-time').textContent = String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
    }

    // Refresh leaderboard
    updateWaitLeaderboard();
    setInterval(updateWaitLeaderboard, 3000);
  }

  function updateWaitLeaderboard() {
    const tbody = document.getElementById('wait-leaderboard');
    if (!tbody) return;

    const allTeams = Object.values(Storage.getAllTeams());
    allTeams.sort((a, b) => {
      const aS = (a.puzzlesSolved || 0);
      const bS = (b.puzzlesSolved || 0);
      if (bS !== aS) return bS - aS;
      const tA = a.endTime ? (a.endTime - a.startTime) : Infinity;
      const tB = b.endTime ? (b.endTime - b.startTime) : Infinity;
      return tA - tB;
    });

    tbody.innerHTML = '';
    allTeams.forEach((t, i) => {
      const rank = i + 1;
      const solved = t.puzzlesSolved || 0;
      const cleared = solved >= TOTAL_PUZZLES;
      const statusText = cleared ? '✅ CLEARED' : (solved > 0 ? `⏳ ${solved}/${TOTAL_PUZZLES} PUZZLES` : '🔒 PENDING');
      
      let timeStr = '--:--';
      if (t.endTime && t.startTime) {
        const ms = t.endTime - t.startTime;
        timeStr = String(Math.floor(ms/60000)).padStart(2,'0') + ':' + String(Math.floor((ms%60000)/1000)).padStart(2,'0');
      } else if (t.startTime) {
        timeStr = 'RUNNING';
      }

      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid rgba(255,26,26,0.1)';
      tr.innerHTML = `
        <td style="padding:8px;font-family:var(--font-mono);font-size:0.8rem;color:${rank===1?'#FFD700':rank===2?'#C0C0C0':rank===3?'#CD7F32':'var(--text-primary)'}">#${rank}</td>
        <td style="padding:8px;font-family:var(--font-mono);font-size:0.8rem;color:var(--text-primary)">${t.id}</td>
        <td style="padding:8px;font-family:var(--font-mono);font-size:0.8rem;color:var(--text-secondary)">${solved}/${TOTAL_PUZZLES}</td>
        <td style="padding:8px;font-family:var(--font-mono);font-size:0.8rem;color:var(--text-secondary)">${timeStr}</td>
        <td style="padding:8px;font-family:var(--font-mono);font-size:0.8rem;color:${cleared?'#00ffaa':(solved>0?'#ffaa00':'var(--neon)')}">${statusText}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // --- Sound Effects ---
  function playUnlockSound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1047, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    } catch (e) {}
  }

  function playVictorySound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const notes = [523, 659, 784, 1047];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.15);
        gain.gain.setValueAtTime(0.1, ctx.currentTime + i * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.4);
        osc.start(ctx.currentTime + i * 0.15);
        osc.stop(ctx.currentTime + i * 0.15 + 0.4);
      });
    } catch (e) {}
  }

  // --- Particle Effect ---
  function spawnParticles() {
    const canvas = document.getElementById('particle-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = [];
    for (let i = 0; i < 120; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4 - 2,
        size: Math.random() * 4 + 1,
        alpha: 1,
        color: Math.random() > 0.5 ? '#ff1a1a' : '#ff6b3d',
      });
    }

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;

      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.03;
        p.alpha -= 0.008;
        if (p.alpha <= 0) return;
        alive = true;

        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.globalAlpha = 1;
      if (alive) requestAnimationFrame(animate);
    }

    animate();
  }

  // --- Shake keyframes ---
  const shakeStyle = document.createElement('style');
  shakeStyle.textContent = `
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-8px); }
      50% { transform: translateX(8px); }
      75% { transform: translateX(-4px); }
    }
  `;
  document.head.appendChild(shakeStyle);

  // --- Init ---
  const activeTeam = Storage.getActiveTeam();
  if (activeTeam && activeTeam.eliminated) {
    document.body.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#000;color:#ff003c;font-family:'Courier New', monospace;text-align:center;">
        <h1 style="font-size:3rem;text-shadow:0 0 10px #ff003c;letter-spacing:5px;">ELIMINATED</h1>
        <p style="font-size:1.2rem;color:#888;">Your squad has been disconnected from the arena.</p>
        <button style="margin-top:20px;padding:10px 20px;background:transparent;border:1px solid #ff003c;color:#ff003c;cursor:pointer;" onclick="Storage.resetAll();window.location.href='index.html';">DISCONNECT</button>
      </div>
    `;
    return;
  }

  renderPuzzles();

  // If already complete, show overlay immediately
  if (puzzlesSolved >= TOTAL_PUZZLES && Storage.getEndTime()) {
    showWaitOverlay();
  }

  // Periodic check for elimination
  setInterval(() => {
    const t = Storage.getActiveTeam();
    if (t && t.eliminated) {
      window.location.reload(); // Will hit the block above
    }
  }, 5000);

})();
