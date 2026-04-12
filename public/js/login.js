/* ===========================
   Tech Escape Arena – Flow Controller
   (Intro -> Registration -> Login)
   =========================== */

(function () {
  'use strict';

  // --- Views ---
  const views = {
    intro: document.getElementById('intro-view'),
    registration: document.getElementById('registration-view'),
    login: document.getElementById('login-view')
  };

  function showView(viewName) {
    Object.values(views).forEach(v => {
      if(v) v.classList.remove('active');
    });
    if(views[viewName]) {
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
    // Already registered, go to login
    if (Storage.isIntroPlayed()) {
       showView('login');
       initLogin();
    } else {
       playIntro(() => { showView('login'); initLogin(); });
    }
  } else {
    // Not registered
    if (Storage.isIntroPlayed()) {
       showView('registration');
    } else {
       playIntro(() => { showView('registration'); });
    }
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
      views.intro.style.display = 'none'; // Ensure it doesn't block clicks
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
    
    showView('login');
    initLogin();
  }

  // --- Login Terminal Logic ---
  const ACCESS_KEY = 'ENTERARENA';
  let loginInitialized = false;

  function initLogin() {
    if (loginInitialized) return;
    loginInitialized = true;
    showConsoleMessages();
    
    const displayId = document.getElementById('login-team-display');
    if (displayId) {
      displayId.textContent = '// ' + Storage.getTeamId() + ' authenticated via Reg-Protocol';
    }

    // Restore attempt count hint
    const extraHint = document.getElementById('extra-hint');
    if (Storage.getLoginAttempts() >= 3 && extraHint) {
      extraHint.classList.add('visible');
    }
  }

  function showConsoleMessages() {
    console.clear();
    console.log('%c ⛔ ACCESS RESTRICTED ⛔ ', 'background: #ff003c; color: #fff; font-size: 18px; font-weight: bold; padding: 10px 20px; border-radius: 4px;');
    console.log('%c Only the curious will proceed... ', 'color: #ff6b3d; font-size: 13px; font-style: italic; padding: 5px 0;');
    console.log('%c 🔑 RU5URVJBUkVOQQ== ', 'color: #ff1a1a; font-size: 15px; font-weight: bold; background: #111; padding: 8px 14px; border: 1px solid #ff1a1a; border-radius: 4px;');
    console.log('%c // It\'s encoding, not encryption ', 'color: #555; font-size: 11px; font-style: italic;');
  }

  const accessInput = document.getElementById('access-key');
  const submitBtn = document.getElementById('submit-key');
  const errorMsg = document.getElementById('error-msg');
  const extraHint = document.getElementById('extra-hint');
  const overlay = document.getElementById('access-granted-overlay');

  if(submitBtn) {
    submitBtn.addEventListener('click', handleLoginSubmit);
  }
  if(accessInput) {
    accessInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleLoginSubmit();
    });
  }

  function handleLoginSubmit() {
    const value = accessInput.value.trim().toUpperCase();

    if (!value) {
      showError('Enter an access key.');
      shakeInput();
      return;
    }

    if (value === ACCESS_KEY) {
      onAccessGranted();
    } else {
      const attempts = Storage.incrementLoginAttempts();
      showError('Access Denied. Invalid key.');
      shakeInput();

      if (attempts >= 3 && extraHint) {
        extraHint.classList.add('visible');
      }
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

    if (!Storage.getStartTime()) {
      Storage.setStartTime(Date.now());
    }

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
