/* ===========================
   Tech Escape Arena – Flow Controller
   (Intro -> Registration -> Waiting Lobby -> Binary Login)
   =========================== */

(function () {
  'use strict';

  const TOTAL_TIME = 45 * 60 * 1000; // 45 minutes

  // --- Views ---
  const views = {
    intro: document.getElementById('intro-view'),
    registration: document.getElementById('registration-view'),
    waiting: document.getElementById('waiting-view'),
    login: document.getElementById('login-view')
  };

  function showView(viewName) {
    Object.values(views).forEach(v => {
      if (v) v.classList.remove('active');
    });
    if (views[viewName]) {
      views[viewName].classList.add('active');
    }
  }

  // --- Boot Sequence ---
  if (Storage.isLoggedIn()) {
    window.location.href = 'dashboard.html';
    return;
  }

  const teamId = Storage.getTeamId();
  if (teamId && Storage.teamExists(teamId)) {
    // Already registered — go to waiting or login
    if (Storage.isIntroPlayed()) {
      enterWaitingOrLogin();
    } else {
      playIntro(() => { enterWaitingOrLogin(); });
    }
  } else {
    // Not registered
    if (Storage.isIntroPlayed()) {
      showView('registration');
    } else {
      playIntro(() => { showView('registration'); });
    }
  }

  // Decide whether to show waiting lobby or login based on admin state
  function enterWaitingOrLogin() {
    checkAdminState().then(adminState => {
      if (adminState && adminState.roundStartedAt) {
        // Round already started — go straight to login
        showView('login');
        initLogin();
      } else {
        // Round hasn't started — show waiting lobby
        showView('waiting');
        initWaiting();
      }
    });
  }

  async function checkAdminState() {
    try {
      const res = await fetch('/api/adminState');
      if (res.ok) return await res.json();
    } catch (e) {}
    // Fallback to localStorage
    try {
      const val = localStorage.getItem('tea_admin_state');
      if (val) return JSON.parse(val);
    } catch (e) {}
    return { isPaused: false, isLocked: false, roundStartedAt: null };
  }

  // --- Intro Logic ---
  function playIntro(onComplete) {
    showView('intro');
    Storage.setIntroPlayed();
    
    console.log(
      '%c Welcome to Tech Escape Arena ',
      'background: #ff1a1a; color: #fff; font-size: 16px; font-weight: bold; padding: 8px 16px; border-radius: 4px;'
    );
    
    const logo = document.getElementById('logo');
    const title = document.getElementById('title');
    const accessText = document.getElementById('access-text');
    const hLine = document.getElementById('h-line');

    setTimeout(() => logo.classList.add('glitch-in'), 400);
    setTimeout(() => {
      logo.classList.remove('glitch-in');
      logo.classList.add('stable', 'glow');
    }, 2000);
    setTimeout(() => title.classList.add('visible'), 2300);
    setTimeout(() => title.classList.add('flicker'), 3000);
    setTimeout(() => hLine.classList.add('expand'), 2800);
    setTimeout(() => accessText.classList.add('typing'), 3200);
    setTimeout(() => {
      accessText.classList.remove('typing');
      accessText.classList.add('done');
    }, 4600);
    
    // Fade out
    setTimeout(() => {
      views.intro.style.transition = 'opacity 0.8s ease';
      views.intro.style.opacity = '0';
    }, 5800);

    setTimeout(() => {
      views.intro.style.opacity = '1'; 
      views.intro.style.display = 'none';
      onComplete();
    }, 6600);

    // Subtle audio blip on glitch
    setTimeout(() => {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const bufferSize = ctx.sampleRate * 0.12;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * 0.15;
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
        noise.connect(gain);
        gain.connect(ctx.destination);
        noise.start();
      } catch (e) { }
    }, 400);
  }

  // --- Registration Logic ---
  const regBtn = document.getElementById('btn-register');
  const regName = document.getElementById('reg-team-name');
  const regMembers = document.getElementById('reg-members');
  const regError = document.getElementById('reg-error-msg');

  if (regBtn) {
    regBtn.addEventListener('click', handleRegistration);
  }

  function handleRegistration() {
    const name = regName.value.trim();
    const members = regMembers.value.trim();

    if (!name || !members) {
      regError.textContent = 'Please fill in all fields.';
      return;
    }

    const newTeamId = Storage.registerTeam(name, members);
    Storage.setTeamId(newTeamId);
    
    // Go to waiting lobby
    showView('waiting');
    initWaiting();
  }

  // ==========================
  // WAITING LOBBY
  // ==========================
  let waitingInterval = null;
  let waitingTimerInterval = null;

  function initWaiting() {
    const teamBadge = document.getElementById('waiting-team-id');
    const waitingTimer = document.getElementById('waiting-timer');
    const waitingText = document.getElementById('waiting-text');
    
    if (teamBadge) teamBadge.textContent = 'TEAM: ' + Storage.getTeamId();

    // Spawn floating particles
    spawnWaitingParticles();

    // Poll admin state every 2 seconds
    waitingInterval = setInterval(async () => {
      const adminState = await checkAdminState();
      if (adminState && adminState.roundStartedAt) {
        // Round started! Transition to login
        clearInterval(waitingInterval);
        clearInterval(waitingTimerInterval);
        
        // Set team start time
        if (!Storage.getStartTime()) {
          Storage.setStartTime(adminState.roundStartedAt);
        }

        // Animate transition
        waitingText.textContent = 'ROUND STARTED!';
        waitingText.style.color = '#ff1a1a';
        waitingTimer.style.color = '#ff1a1a';

        setTimeout(() => {
          showView('login');
          initLogin();
        }, 1200);
      }
    }, 2000);

    // Update timer display in waiting lobby (shows -- until started)
    waitingTimerInterval = setInterval(async () => {
      const adminState = await checkAdminState();
      if (adminState && adminState.roundStartedAt) {
        const elapsed = Date.now() - adminState.roundStartedAt;
        const remaining = Math.max(0, TOTAL_TIME - elapsed);
        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        waitingTimer.textContent = String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
      } else {
        waitingTimer.textContent = '--:--';
      }
    }, 1000);
  }

  function spawnWaitingParticles() {
    const container = document.getElementById('waiting-particles');
    if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < 30; i++) {
      const p = document.createElement('div');
      p.className = 'floating-particle';
      p.style.left = Math.random() * 100 + '%';
      p.style.top = Math.random() * 100 + '%';
      p.style.animationDelay = (Math.random() * 5) + 's';
      p.style.animationDuration = (3 + Math.random() * 4) + 's';
      p.style.width = p.style.height = (2 + Math.random() * 4) + 'px';
      container.appendChild(p);
    }
  }

  // ==========================
  // LOGIN (Binary Decode Challenge)
  // ==========================
  let loginInitialized = false;
  let loginTimerInterval = null;

  function initLogin() {
    if (loginInitialized) return;
    loginInitialized = true;

    const displayId = document.getElementById('login-team-display');
    if (displayId) {
      displayId.textContent = '// ' + Storage.getTeamId() + ' – binary transmission intercepted';
    }

    // Fetch binary code from server
    fetchBinaryCode();

    // Start login timer
    startLoginTimer();

    // Console messages for the binary challenge
    showConsoleMessages();

    // Restore attempt count hint
    const extraHint = document.getElementById('extra-hint');
    if (Storage.getLoginAttempts() >= 3 && extraHint) {
      extraHint.classList.add('visible');
    }
  }

  async function fetchBinaryCode() {
    const binaryDisplay = document.getElementById('binary-code');
    const teamId = Storage.getTeamId();

    try {
      const res = await fetch(`/api/team/${teamId}/code`);
      if (res.ok) {
        const data = await res.json();
        if (data.started && data.binary) {
          // Animate the binary code appearing
          binaryDisplay.textContent = '';
          const chars = data.binary.split('');
          let idx = 0;
          const typeInterval = setInterval(() => {
            if (idx < chars.length) {
              binaryDisplay.textContent += chars[idx];
              idx++;
            } else {
              clearInterval(typeInterval);
            }
          }, 30);
        } else {
          binaryDisplay.textContent = 'AWAITING TRANSMISSION...';
        }
      }
    } catch (e) {
      binaryDisplay.textContent = 'CONNECTION ERROR';
    }
  }

  function startLoginTimer() {
    const timerEl = document.getElementById('login-timer-display');
    if (!timerEl) return;

    loginTimerInterval = setInterval(async () => {
      const adminState = await checkAdminState();
      if (adminState && adminState.roundStartedAt) {
        const elapsed = Date.now() - adminState.roundStartedAt;
        const remaining = Math.max(0, TOTAL_TIME - elapsed);
        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);

        timerEl.textContent = String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');

        timerEl.classList.remove('warning', 'danger');
        if (remaining <= 5 * 60 * 1000) {
          timerEl.classList.add('danger');
        } else if (remaining <= 15 * 60 * 1000) {
          timerEl.classList.add('warning');
        }

        if (adminState.isPaused) {
          timerEl.textContent = 'PAUSED';
          timerEl.classList.add('warning');
        }
      }
    }, 1000);
  }

  function showConsoleMessages() {
    console.clear();
    console.log('%c ⛔ ACCESS RESTRICTED ⛔ ', 'background: #ff003c; color: #fff; font-size: 18px; font-weight: bold; padding: 10px 20px; border-radius: 4px;');
    console.log('%c Binary is the language of machines... ', 'color: #ff6b3d; font-size: 13px; font-style: italic; padding: 5px 0;');
    console.log('%c 💡 Each 8-bit group = one ASCII character ', 'color: #00ffaa; font-size: 13px; background: #111; padding: 6px 12px; border: 1px solid #00ffaa; border-radius: 4px;');
    console.log('%c // Convert binary → decimal → ASCII letter ', 'color: #555; font-size: 11px; font-style: italic;');
  }

  const accessInput = document.getElementById('access-key');
  const submitBtn = document.getElementById('submit-key');
  const errorMsg = document.getElementById('error-msg');
  const extraHint = document.getElementById('extra-hint');
  const overlay = document.getElementById('access-granted-overlay');

  if (submitBtn) {
    submitBtn.addEventListener('click', handleLoginSubmit);
  }
  if (accessInput) {
    accessInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleLoginSubmit();
    });
  }

  async function handleLoginSubmit() {
    const value = accessInput.value.trim().toUpperCase();

    if (!value) {
      showError('Enter a decoded access key.');
      shakeInput();
      return;
    }

    // Validate against the team's unique login code from server
    const teamId = Storage.getTeamId();
    try {
      const res = await fetch(`/api/team/${teamId}`);
      if (res.ok) {
        const team = await res.json();
        if (value === team.loginCode) {
          onAccessGranted();
        } else {
          const attempts = Storage.incrementLoginAttempts();
          showError('Access Denied. Incorrect decoding.');
          shakeInput();

          if (attempts >= 3 && extraHint) {
            extraHint.classList.add('visible');
          }
        }
      }
    } catch (e) {
      showError('Connection error. Try again.');
    }
  }

  function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.classList.add('visible');
    setTimeout(() => errorMsg.classList.remove('visible'), 3000);
  }

  function shakeInput() {
    accessInput.style.animation = 'none';
    accessInput.offsetHeight;
    accessInput.style.animation = 'shake 0.4s ease';
  }

  function onAccessGranted() {
    Storage.setLoggedIn(true);

    // Timer already started by admin; ensure team has start time
    if (!Storage.getStartTime()) {
      checkAdminState().then(adminState => {
        if (adminState && adminState.roundStartedAt) {
          Storage.setStartTime(adminState.roundStartedAt);
        }
      });
    }

    if (loginTimerInterval) clearInterval(loginTimerInterval);

    overlay.classList.add('active');

    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.setValueAtTime(800, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + 0.5);
    } catch (e) { }

    setTimeout(() => {
      window.location.href = 'dashboard.html';
    }, 2200);
  }

  // Add shake keyframes dynamically
  const style = document.createElement('style');
  style.textContent = `
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-8px); }
      50% { transform: translateX(8px); }
      75% { transform: translateX(-4px); }
    }
  `;
  document.head.appendChild(style);

})();
