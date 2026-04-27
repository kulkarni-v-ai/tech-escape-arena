/* ===========================
   Tech Escape Arena – Flow Controller
   (Intro -> Registration -> Waiting Lobby -> Binary Login)
   =========================== */

(function () {
  'use strict';

  const TOTAL_TIME = 45 * 60 * 1000; // 45 minutes

  // --- Views ---
  const views = {
    gate: document.getElementById('gate-view'),
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
    // Already registered — skip gate, go to waiting or login
    if (Storage.isIntroPlayed()) {
      enterWaitingOrLogin();
    } else {
      // Show gate, then play intro on tap
      setupGate(() => { playIntro(() => { enterWaitingOrLogin(); }); });
    }
  } else {
    // Not registered
    if (Storage.isIntroPlayed()) {
      showView('registration');
    } else {
      // Show gate, then play intro on tap
      setupGate(() => { playIntro(() => { showView('registration'); }); });
    }
  }

  // --- Gate (tap to unlock audio) ---
  function setupGate(onTap) {
    showView('gate');
    const gateEl = views.gate;
    gateEl.addEventListener('click', function handleGate() {
      gateEl.removeEventListener('click', handleGate);
      // Fade out gate
      gateEl.style.transition = 'opacity 0.5s ease';
      gateEl.style.opacity = '0';
      setTimeout(() => {
        gateEl.style.display = 'none';
        onTap();
      }, 500);
    }, { once: true });
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

    // === GLITCH SOUND DESIGN ===
    let audioCtx;
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}

    function playGlitchBurst(ctx, time, duration, volume) {
      // Distorted noise burst
      const bufSize = ctx.sampleRate * duration;
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) {
        d[i] = (Math.random() * 2 - 1) * (1 - i / bufSize); // decaying noise
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      // Bandpass filter for digital texture
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 2000 + Math.random() * 3000;
      bp.Q.value = 5;
      const g = ctx.createGain();
      g.gain.setValueAtTime(volume, time);
      g.gain.exponentialRampToValueAtTime(0.001, time + duration);
      src.connect(bp); bp.connect(g); g.connect(ctx.destination);
      src.start(time); src.stop(time + duration);
    }

    function playBassHit(ctx, time, freq, duration) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, time);
      osc.frequency.exponentialRampToValueAtTime(20, time + duration);
      g.gain.setValueAtTime(0.15, time);
      g.gain.exponentialRampToValueAtTime(0.001, time + duration);
      // Distortion
      const dist = ctx.createWaveShaper();
      const curve = new Float32Array(256);
      for (let i = 0; i < 256; i++) { const x = (i * 2) / 256 - 1; curve[i] = (Math.PI + 3) * x / (Math.PI + 3 * Math.abs(x)); }
      dist.curve = curve;
      osc.connect(dist); dist.connect(g); g.connect(ctx.destination);
      osc.start(time); osc.stop(time + duration);
    }

    function playPowerUp(ctx, time) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(200, time);
      osc.frequency.exponentialRampToValueAtTime(1200, time + 0.5);
      g.gain.setValueAtTime(0.08, time);
      g.gain.setValueAtTime(0.08, time + 0.35);
      g.gain.exponentialRampToValueAtTime(0.001, time + 0.6);
      osc.connect(g); g.connect(ctx.destination);
      osc.start(time); osc.stop(time + 0.6);
    }

    function playConfirmTone(ctx, time) {
      [880, 1100].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        g.gain.setValueAtTime(0.06, time + i * 0.12);
        g.gain.exponentialRampToValueAtTime(0.001, time + i * 0.12 + 0.25);
        osc.connect(g); g.connect(ctx.destination);
        osc.start(time + i * 0.12); osc.stop(time + i * 0.12 + 0.25);
      });
    }

    if (audioCtx) {
      const t = audioCtx.currentTime;

      // 0.4s — Logo appears: initial glitch burst + bass
      setTimeout(() => {
        const t = audioCtx.currentTime;
        playGlitchBurst(audioCtx, t, 0.15, 0.12);
        playBassHit(audioCtx, t, 80, 0.3);
      }, 400);

      // 0.6s–1.5s — Rapid stutter glitches during glitch-in animation
      [600, 800, 950, 1100, 1350].forEach(ms => {
        setTimeout(() => {
          playGlitchBurst(audioCtx, audioCtx.currentTime, 0.06 + Math.random() * 0.06, 0.08);
        }, ms);
      });

      // 1.6s — Secondary bass hit
      setTimeout(() => {
        playBassHit(audioCtx, audioCtx.currentTime, 60, 0.25);
      }, 1600);

      // 2.0s — Logo stabilizes: power-up sweep
      setTimeout(() => {
        playPowerUp(audioCtx, audioCtx.currentTime);
      }, 2000);

      // 2.3s — Title appears: subtle bass thud
      setTimeout(() => {
        playBassHit(audioCtx, audioCtx.currentTime, 50, 0.2);
      }, 2300);

      // 3.2s — ACCESS LOCKED typing: typewriter key clicks
      setTimeout(() => {
        const text = 'ACCESS LOCKED';
        const charInterval = 1200 / text.length; // ~85ms per char matching CSS animation
        for (let i = 0; i < text.length; i++) {
          setTimeout(() => {
            const t = audioCtx.currentTime;
            // Key click: short noise burst with high-pass filter
            const bufSize = audioCtx.sampleRate * 0.025;
            const buf = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
            const d = buf.getChannelData(0);
            for (let j = 0; j < bufSize; j++) {
              d[j] = (Math.random() * 2 - 1) * (1 - j / bufSize);
            }
            const src = audioCtx.createBufferSource();
            src.buffer = buf;
            const hp = audioCtx.createBiquadFilter();
            hp.type = 'highpass';
            hp.frequency.value = 3000 + Math.random() * 2000;
            const g = audioCtx.createGain();
            g.gain.setValueAtTime(0.08 + Math.random() * 0.04, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.025);
            src.connect(hp); hp.connect(g); g.connect(audioCtx.destination);
            src.start(t); src.stop(t + 0.025);
          }, i * charInterval);
        }
        // Final confirmation beep after all characters typed
        setTimeout(() => {
          playConfirmTone(audioCtx, audioCtx.currentTime);
        }, 1300);
      }, 3200);

      // 5.8s — Fade out: low rumble
      setTimeout(() => {
        const osc = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 35;
        g.gain.setValueAtTime(0.1, audioCtx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.8);
        osc.connect(g); g.connect(audioCtx.destination);
        osc.start(); osc.stop(audioCtx.currentTime + 0.8);
      }, 5800);
    }
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

    // Start progressive timed hints
    startTimedHints();

    // Console messages for the binary challenge
    showConsoleMessages();

    // Restore attempt count hint
    const extraHint = document.getElementById('extra-hint');
    if (Storage.getLoginAttempts() >= 3 && extraHint) {
      extraHint.classList.add('visible');
    }
  }

  // ==========================
  // PROGRESSIVE TIMED HINTS
  // ==========================
  let timedHintInterval = null;
  let cachedLoginCode = null;
  let cachedBinary = null;

  async function startTimedHints() {
    const teamId = Storage.getTeamId();

    // Fetch team data for hints
    try {
      const [teamRes, codeRes] = await Promise.all([
        fetch(`/api/team/${teamId}`),
        fetch(`/api/team/${teamId}/code`)
      ]);
      if (teamRes.ok) {
        const team = await teamRes.json();
        cachedLoginCode = team.loginCode;
      }
      if (codeRes.ok) {
        const codeData = await codeRes.json();
        if (codeData.binary) cachedBinary = codeData.binary;
      }
    } catch (e) {}

    // Check hints every 5 seconds
    timedHintInterval = setInterval(() => updateTimedHints(), 5000);
    updateTimedHints(); // run once immediately
  }

  function updateTimedHints() {
    const hint10 = document.getElementById('hint-10min');
    const hint20 = document.getElementById('hint-20min');
    const hint30 = document.getElementById('hint-30min');
    const text10 = document.getElementById('hint-10min-text');
    const text20 = document.getElementById('hint-20min-text');
    const text30 = document.getElementById('hint-30min-text');

    // Get elapsed time from round start
    let elapsed = 0;
    try {
      const adminState = JSON.parse(localStorage.getItem('tea_admin_state') || '{}');
      if (adminState.roundStartedAt) {
        elapsed = Date.now() - adminState.roundStartedAt;
      }
    } catch (e) {}

    const elapsedMin = elapsed / (60 * 1000);

    // 10 minutes: General hint
    if (elapsedMin >= 10 && hint10.style.display === 'none') {
      hint10.style.display = 'block';
      text10.innerHTML = '💡 The binary code is hidden in the <strong style="color:#ff6b3d;">browser console</strong>. Press <strong style="color:#00ffaa;">F12</strong> → Console tab. Each group of 8 digits (0s and 1s) represents one letter using ASCII encoding.';
    }

    // 20 minutes: Stronger help — show decimal values
    if (elapsedMin >= 20 && hint20.style.display === 'none' && cachedBinary) {
      hint20.style.display = 'block';
      const groups = cachedBinary.split(' ');
      const decimals = groups.map(g => parseInt(g, 2));
      text20.innerHTML = '🔢 The binary groups convert to these decimal numbers: <strong style="color:#ffaa00;">' + decimals.join(', ') + '</strong><br><span style="color:var(--text-dim); font-size:0.75rem;">Look up each number in an ASCII table to find the letter.</span>';
    }

    // 30 minutes: Give the password
    if (elapsedMin >= 30 && hint30.style.display === 'none' && cachedLoginCode) {
      hint30.style.display = 'block';
      text30.textContent = cachedLoginCode;
      if (timedHintInterval) clearInterval(timedHintInterval);
    }
  }

  async function fetchBinaryCode() {
    const teamId = Storage.getTeamId();

    try {
      const res = await fetch(`/api/team/${teamId}/code`);
      if (res.ok) {
        const data = await res.json();
        if (data.started && data.binary) {
          // Output binary code ONLY to browser console
          console.log('%c ▼ INTERCEPTED BINARY TRANSMISSION ▼ ', 'background: #111; color: #00ffaa; font-size: 14px; font-weight: bold; padding: 8px 16px; border: 1px solid #00ffaa; border-radius: 4px;');
          console.log('%c ' + data.binary + ' ', 'background: #0a0a0a; color: #00ff88; font-size: 16px; font-family: monospace; padding: 10px 16px; border: 1px solid #333; border-radius: 4px; letter-spacing: 2px;');
          console.log('%c 💡 Decode: binary → decimal → ASCII character ', 'color: #ffaa00; font-size: 12px; padding: 4px 0;');
        } else {
          console.log('%c ⏳ Binary transmission not yet available — round not started ', 'color: #888; font-size: 12px;');
        }
      }
    } catch (e) {
      console.log('%c ❌ Could not fetch binary code ', 'color: #ff003c;');
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
