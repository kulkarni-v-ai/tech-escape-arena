/* =====================================================
   Tech Escape Arena – Round 3: Cyber Battle Engine
   Main controller (cyberbattle.html)
   ===================================================== */
(function () {
  'use strict';

  const STORAGE_KEY = 'tea_r3_state';
  let questions = [];
  let state = null;
  let timerInterval = null;
  let timeLeft = 0;
  let answerA = null, answerB = null;
  let revealed = false;

  // Audio
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const audioCtx = new AudioCtx();
  function beep(freq, dur, type='sine') {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.15, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + dur);
  }
  function sfxCorrect() { beep(880, 0.15); setTimeout(() => beep(1100, 0.2), 150); }
  function sfxWrong() { beep(200, 0.3, 'sawtooth'); }
  function sfxTick() { beep(600, 0.05); }
  function sfxVictory() { [0,200,400,600].forEach((d,i) => setTimeout(() => beep(440+i*110, 0.3), d)); }

  // Load questions
  fetch('data/questions.json').then(r => r.json()).then(q => { questions = q; init(); });

  function getDefaultState() {
    return {
      bracket: [
        { id: 1, teamA: '', teamB: '', scoreA: 0, scoreB: 0, winner: null, status: 'pending', usedQuestions: [] },
        { id: 2, teamA: '', teamB: '', scoreA: 0, scoreB: 0, winner: null, status: 'pending', usedQuestions: [] },
        { id: 3, teamA: '', teamB: '', scoreA: 0, scoreB: 0, winner: null, status: 'pending', usedQuestions: [] },
        { id: 4, teamA: '', teamB: '', scoreA: 0, scoreB: 0, winner: null, status: 'pending', usedQuestions: [] }
      ],
      currentMatch: -1,
      currentQuestion: -1,
      questionsPerBattle: 10,
      battleStatus: 'setup', // setup, waiting, active, paused, question, revealed, finished
      currentQ: null,
      answerA: null, answerB: null,
      timeLeft: 0
    };
  }

  const socket = io();
  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (socket) socket.emit('r3:updateState', state);
  }
  function loadState() {
    const s = localStorage.getItem(STORAGE_KEY);
    return s ? JSON.parse(s) : null;
  }

  async function init() {
    // SECURITY: Only allow Admin to access the setup/control panel
    const token = sessionStorage.getItem('tea_admin_token') || localStorage.getItem('tea_admin_token');
    const ADMIN_PASS = 'admin'; // Fallback if env not accessible client-side
    
    // In a real app, we'd verify this token with the server. 
    // For now, if no token exists, we assume it's a participant and redirect them.
    if (!token) {
      console.warn('Unauthorized access to CyberBattle. Redirecting to Participant Terminal.');
      window.location.href = '/round3.html';
      return;
    }

    try { await Storage.syncWithServer(); } catch(e){}
    state = loadState();
    if (!state || state.battleStatus === 'setup') {
      state = getDefaultState();
      saveState();
      showSetup();
    } else {
      document.getElementById('setup-screen').classList.add('hidden');
      renderBattle();
    }
    bindControls();
    bindKeyboard();
  }

  // ─── Setup ───
  function showSetup() {
    document.getElementById('setup-screen').classList.remove('hidden');
    const container = document.getElementById('setup-matches');
    container.innerHTML = '';

    // Get all registered teams from Storage - filter for Qualified teams only
    // Get all registered teams from Storage
    const allTeams = Storage.getAllTeams();
    const teamsArray = Array.isArray(allTeams) ? allTeams : Object.values(allTeams);
    const teamNames = teamsArray
      .map(t => t.name || t.teamName || t.teamId)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));

    const getOptions = (selected) => {
      let opts = '<option value="">-- Select Team --</option>';
      teamNames.forEach(name => {
        opts += `<option value="${name}" ${name === selected ? 'selected' : ''}>${name}</option>`;
      });
      return opts;
    };

    for (let i = 0; i < 4; i++) {
      const m = state.bracket[i];
      container.innerHTML += `
        <div class="cb-setup-match">
          <div class="cb-setup-match-title">MATCH ${i + 1}</div>
          <div class="cb-setup-row">
            <span class="cb-setup-label" style="color:var(--neon);">TEAM A</span>
            <select class="cb-setup-input" id="setup-a-${i}">${getOptions(m.teamA)}</select>
          </div>
          <div class="cb-setup-row">
            <span class="cb-setup-label" style="color:#00aaff;">TEAM B</span>
            <select class="cb-setup-input" id="setup-b-${i}">${getOptions(m.teamB)}</select>
          </div>
        </div>`;
    }
  }

  document.getElementById('btn-save-bracket').addEventListener('click', () => {
    for (let i = 0; i < 4; i++) {
      state.bracket[i].teamA = document.getElementById(`setup-a-${i}`).value.trim() || `Team ${i*2+1}`;
      state.bracket[i].teamB = document.getElementById(`setup-b-${i}`).value.trim() || `Team ${i*2+2}`;
    }
    state.questionsPerBattle = parseInt(document.getElementById('qPerBattle').value) || 10;
    state.forceBroadcast = document.getElementById('forceBroadcast').checked;
    state.battleStatus = 'waiting';
    state.currentMatch = 0;
    saveState();
    document.getElementById('setup-screen').classList.add('hidden');
    renderBattle();
    populateMatchSelect();
  });

  // ─── Rendering ───
  function renderBattle() {
    const match = state.bracket[state.currentMatch];
    if (!match) return;

    document.getElementById('team-a-name').textContent = match.teamA;
    document.getElementById('team-b-name').textContent = match.teamB;
    document.getElementById('score-a').textContent = match.scoreA;
    document.getElementById('score-b').textContent = match.scoreB;
    document.getElementById('ans-label-a').textContent = match.teamA;
    document.getElementById('ans-label-b').textContent = match.teamB;
    document.getElementById('match-info').textContent = `MATCH ${state.currentMatch + 1} OF 4 · Q ${state.currentQuestion + 1}/${state.questionsPerBattle}`;

    const waiting = document.getElementById('waiting-screen');
    const qCard = document.getElementById('question-card');

    if (state.battleStatus === 'waiting') {
      waiting.classList.remove('hidden');
      qCard.classList.remove('visible');
    } else {
      waiting.classList.add('hidden');
    }

    if (state.currentQ && (state.battleStatus === 'question' || state.battleStatus === 'revealed' || state.battleStatus === 'paused')) {
      renderQuestion(state.currentQ);
    }
    populateMatchSelect();
  }

  function renderQuestion(q) {
    const qCard = document.getElementById('question-card');
    qCard.classList.add('visible');
    document.getElementById('q-category').textContent = q.category.toUpperCase();
    document.getElementById('q-text').textContent = q.question;
    document.getElementById('q-timer').textContent = timeLeft || q.timer;

    // Options display (visual only)
    const optDiv = document.getElementById('q-options');
    optDiv.innerHTML = '';
    q.options.forEach((opt, i) => {
      const btn = document.createElement('div');
      btn.className = 'cb-option';
      btn.textContent = String.fromCharCode(65 + i) + '. ' + opt;
      btn.dataset.idx = i;
      if (revealed) {
        if (opt === q.correctAnswer) btn.classList.add('correct');
        else btn.classList.add('wrong');
        if (answerA !== null && q.options[answerA] === opt) btn.classList.add('selected-a');
        if (answerB !== null && q.options[answerB] === opt) btn.classList.add('selected-b');
      }
      optDiv.appendChild(btn);
    });

    // Answer buttons for admin
    const panel = document.getElementById('answer-panel');
    if (state.battleStatus === 'question') {
      panel.classList.add('visible');
      renderAnswerButtons(q);
    } else {
      panel.classList.remove('visible');
    }
  }

  function renderAnswerButtons(q) {
    const btnsA = document.getElementById('ans-btns-a');
    const btnsB = document.getElementById('ans-btns-b');
    btnsA.innerHTML = ''; btnsB.innerHTML = '';

    q.options.forEach((opt, i) => {
      const label = String.fromCharCode(65 + i);
      // Team A button
      const btnA = document.createElement('button');
      btnA.className = 'cb-ans-btn team-a' + (answerA === i ? ' locked' : '') + (answerA !== null && answerA !== i ? ' locked' : '');
      btnA.textContent = label;
      btnA.onclick = () => { if (answerA === null) { answerA = i; renderAnswerButtons(q); checkAnswered(); } };
      btnsA.appendChild(btnA);

      // Team B button
      const btnB = document.createElement('button');
      btnB.className = 'cb-ans-btn team-b' + (answerB === i ? ' locked' : '') + (answerB !== null && answerB !== i ? ' locked' : '');
      btnB.textContent = label;
      btnB.onclick = () => { if (answerB === null) { answerB = i; renderAnswerButtons(q); checkAnswered(); } };
      btnsB.appendChild(btnB);
    });
  }

  function checkAnswered() {
    if (answerA !== null || answerB !== null) {
      setTimeout(revealAnswer, 500);
    }
  }

  function revealAnswer() {
    if (!state.currentQ) return;
    clearInterval(timerInterval);
    revealed = true;
    state.battleStatus = 'revealed';

    const match = state.bracket[state.currentMatch];
    const correct = state.currentQ.correctAnswer;

    const aCorrect = answerA !== null && state.currentQ.options[answerA] === correct;
    const bCorrect = answerB !== null && state.currentQ.options[answerB] === correct;

    if (aCorrect) { match.scoreA++; sfxCorrect(); }
    if (bCorrect) { match.scoreB++; if(!aCorrect) sfxCorrect(); }
    if (!aCorrect && !bCorrect) sfxWrong();

    document.getElementById('score-a').textContent = match.scoreA;
    document.getElementById('score-b').textContent = match.scoreB;
    document.getElementById('status-a').textContent = aCorrect ? '✅ CORRECT' : '❌ WRONG';
    document.getElementById('status-a').className = 'cb-team-status ' + (aCorrect ? 'cb-status-correct' : 'cb-status-wrong');
    document.getElementById('status-b').textContent = bCorrect ? '✅ CORRECT' : '❌ WRONG';
    document.getElementById('status-b').className = 'cb-team-status ' + (bCorrect ? 'cb-status-correct' : 'cb-status-wrong');

    state.answerA = answerA; state.answerB = answerB;
    saveState();
    renderQuestion(state.currentQ);

    // Auto advance after 1.5 seconds for high-speed gameplay
    setTimeout(() => {
      if (state.battleStatus === 'revealed') nextQuestion();
    }, 1500);
  }

  // ─── Question Flow ───
  function nextQuestion() {
    const match = state.bracket[state.currentMatch];
    state.currentQuestion++;

    if (state.currentQuestion >= state.questionsPerBattle) {
      endBattle();
      return;
    }

    // Pick random unused question
    const unused = questions.filter(q => !match.usedQuestions.includes(q.id));
    if (unused.length === 0) { endBattle(); return; }
    const q = unused[Math.floor(Math.random() * unused.length)];
    match.usedQuestions.push(q.id);

    state.currentQ = q;
    answerA = null; answerB = null; revealed = false;
    state.answerA = null; state.answerB = null;
    state.battleStatus = 'question';
    timeLeft = q.timer;
    state.timeLeft = timeLeft;
    saveState();

    document.getElementById('status-a').textContent = '';
    document.getElementById('status-b').textContent = '';
    renderBattle();
    renderQuestion(q);
    startTimer();
  }

  function startTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      timeLeft--;
      state.timeLeft = timeLeft;
      const el = document.getElementById('q-timer');
      el.textContent = timeLeft;
      el.className = 'cb-q-timer';
      if (timeLeft <= 5) { el.classList.add('danger'); sfxTick(); }
      else if (timeLeft <= 10) el.classList.add('warning');

      saveState();

      if (timeLeft <= 0) {
        clearInterval(timerInterval);
        // Time's up — force reveal with whatever answers exist
        if (answerA === null) answerA = -1;
        if (answerB === null) answerB = -1;
        revealAnswer();
      }
    }, 1000);
  }

  function endBattle() {
    clearInterval(timerInterval);
    const match = state.bracket[state.currentMatch];

    if (match.scoreA > match.scoreB) match.winner = match.teamA;
    else if (match.scoreB > match.scoreA) match.winner = match.teamB;
    else match.winner = null; // tie

    match.status = 'done';
    state.battleStatus = 'finished';
    state.currentQ = null;
    saveState();

    if (match.winner) {
      sfxVictory();
      document.getElementById('winner-name').textContent = match.winner;
      document.getElementById('winner-overlay').classList.add('active');
    } else {
      // Tie — admin must declare
      alert('TIE! Use "Declare Winner" to pick manually, or add a sudden death question.');
    }
    renderBattle();
  }

  window.dismissWinner = function () {
    document.getElementById('winner-overlay').classList.remove('active');
    // Move to next match
    const nextMatch = state.bracket.findIndex(m => m.status === 'pending');
    if (nextMatch >= 0) {
      state.currentMatch = nextMatch;
      state.currentQuestion = -1;
      state.battleStatus = 'waiting';
      state.currentQ = null;
      saveState();
      renderBattle();
    }
  };

  // ─── Controls ───
  function bindControls() {
    document.getElementById('btn-start-battle').onclick = () => {
      if (state.battleStatus === 'waiting' || state.battleStatus === 'finished') {
        state.currentQuestion = -1;
        state.bracket[state.currentMatch].scoreA = 0;
        state.bracket[state.currentMatch].scoreB = 0;
        state.bracket[state.currentMatch].usedQuestions = [];
        state.bracket[state.currentMatch].status = 'active';
        saveState();
        nextQuestion();
      }
    };

    document.getElementById('btn-pause').onclick = () => {
      if (state.battleStatus === 'question') {
        clearInterval(timerInterval);
        state.battleStatus = 'paused';
        saveState();
      } else if (state.battleStatus === 'paused') {
        state.battleStatus = 'question';
        startTimer();
        saveState();
      }
    };

    document.getElementById('btn-next').onclick = () => nextQuestion();
    document.getElementById('btn-skip').onclick = () => nextQuestion();

    document.getElementById('btn-declare-winner').onclick = () => {
      const match = state.bracket[state.currentMatch];
      const who = prompt(`Declare winner:\n1 = ${match.teamA}\n2 = ${match.teamB}`);
      if (who === '1') { match.winner = match.teamA; match.status = 'done'; }
      else if (who === '2') { match.winner = match.teamB; match.status = 'done'; }
      else return;
      state.battleStatus = 'finished';
      sfxVictory();
      saveState();
      document.getElementById('winner-name').textContent = match.winner;
      document.getElementById('winner-overlay').classList.add('active');
    };

    document.getElementById('btn-reset-match').onclick = () => {
      if (!confirm('Reset current match?')) return;
      clearInterval(timerInterval);
      const m = state.bracket[state.currentMatch];
      m.scoreA = 0; m.scoreB = 0; m.winner = null; m.status = 'pending'; m.usedQuestions = [];
      state.currentQuestion = -1; state.battleStatus = 'waiting'; state.currentQ = null;
      answerA = null; answerB = null; revealed = false;
      saveState(); renderBattle();
    };

    document.getElementById('btn-reset-all').onclick = () => {
      if (!confirm('RESET ENTIRE TOURNAMENT?')) return;
      localStorage.removeItem(STORAGE_KEY);
      state = getDefaultState(); saveState(); showSetup();
    };

    document.getElementById('btn-bracket').onclick = () => {
      renderBracket();
      document.getElementById('bracket-overlay').classList.add('active');
    };

    document.getElementById('match-select').onchange = (e) => {
      const idx = parseInt(e.target.value);
      if (isNaN(idx)) return;
      clearInterval(timerInterval);
      state.currentMatch = idx;
      state.currentQuestion = -1;
      state.battleStatus = 'waiting';
      state.currentQ = null;
      answerA = null; answerB = null;
      saveState(); renderBattle();
    };
  }

  function bindKeyboard() {
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space') { e.preventDefault(); document.getElementById('btn-pause').click(); }
      if (e.code === 'KeyN') { nextQuestion(); }
      if (e.code === 'KeyW') { document.getElementById('btn-declare-winner').click(); }
    });
  }

  function populateMatchSelect() {
    const sel = document.getElementById('match-select');
    sel.innerHTML = '';
    state.bracket.forEach((m, i) => {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = `M${i + 1}: ${m.teamA || '?'} vs ${m.teamB || '?'} ${m.winner ? '✅' : ''}`;
      if (i === state.currentMatch) opt.selected = true;
      sel.appendChild(opt);
    });
  }

  function renderBracket() {
    const grid = document.getElementById('bracket-grid');
    grid.innerHTML = '';
    state.bracket.forEach((m, i) => {
      const div = document.createElement('div');
      div.className = 'cb-bracket-match' + (i === state.currentMatch ? ' active-match' : '') + (m.status === 'done' ? ' done' : '');
      div.innerHTML = `
        <div style="font-family:var(--font-mono);font-size:0.65rem;color:var(--neon-cyan);letter-spacing:2px;margin-bottom:0.5rem;">MATCH ${i + 1}</div>
        <div class="cb-bracket-team ${m.winner === m.teamA ? 'winner' : (m.winner ? 'loser' : '')}">${m.teamA} ${m.status === 'done' ? '(' + m.scoreA + ')' : ''}</div>
        <div style="font-family:var(--font-heading);font-size:0.6rem;color:var(--text-dim);">VS</div>
        <div class="cb-bracket-team ${m.winner === m.teamB ? 'winner' : (m.winner ? 'loser' : '')}">${m.teamB} ${m.status === 'done' ? '(' + m.scoreB + ')' : ''}</div>
      `;
      grid.appendChild(div);
    });
  }
})();
