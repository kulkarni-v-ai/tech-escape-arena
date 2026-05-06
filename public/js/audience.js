/* =====================================================
   Tech Escape Arena – Round 3: Audience/Projector View
   Reads from localStorage, auto-syncs with battle page
   ===================================================== */
(function () {
  'use strict';

  const STORAGE_KEY = 'tea_r3_state';
  let lastState = null;
  let currentTimerVal = 0;

  function getState() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { return null; }
  }

  function render() {
    const state = getState();
    if (!state) return;

    const match = state.bracket[state.currentMatch];
    if (!match) return;

    // Names & scores
    document.getElementById('au-name-a').textContent = match.teamA || 'TEAM A';
    document.getElementById('au-name-b').textContent = match.teamB || 'TEAM B';
    document.getElementById('au-score-a').textContent = match.scoreA;
    document.getElementById('au-score-b').textContent = match.scoreB;
    document.getElementById('au-match-info').textContent = `MATCH ${state.currentMatch + 1} OF 4 · Q ${state.currentQuestion + 1}/${state.questionsPerBattle}`;

    const waiting = document.getElementById('au-waiting');
    const qCard = document.getElementById('au-q-card');
    const winnerEl = document.getElementById('au-winner');

    // Show/hide states
    if (state.battleStatus === 'waiting' || state.battleStatus === 'setup') {
      waiting.classList.remove('hidden');
      qCard.classList.remove('visible');
      winnerEl.classList.remove('active');
    } else if (state.battleStatus === 'finished' && match.winner) {
      waiting.classList.add('hidden');
      qCard.classList.remove('visible');
      document.getElementById('au-winner-name').textContent = match.winner;
      winnerEl.classList.add('active');
    } else {
      waiting.classList.add('hidden');
      winnerEl.classList.remove('active');
    }

    // Question
    if (state.currentQ && (state.battleStatus === 'question' || state.battleStatus === 'revealed' || state.battleStatus === 'paused')) {
      qCard.classList.add('visible');
      document.getElementById('au-q-cat').textContent = state.currentQ.category.toUpperCase();
      document.getElementById('au-q-text').textContent = state.currentQ.question;

      const timerEl = document.getElementById('au-q-timer');
      timerEl.textContent = state.timeLeft || state.currentQ.timer;
      timerEl.className = 'au-q-timer';
      if (state.timeLeft <= 5) timerEl.classList.add('danger');
      else if (state.timeLeft <= 10) timerEl.classList.add('warning');

      // Options
      const optDiv = document.getElementById('au-options');
      optDiv.innerHTML = '';
      state.currentQ.options.forEach((opt, i) => {
        const el = document.createElement('div');
        el.className = 'au-opt';
        el.textContent = String.fromCharCode(65 + i) + '. ' + opt;

        if (state.battleStatus === 'revealed') {
          if (opt === state.currentQ.correctAnswer) el.classList.add('correct');
          else el.classList.add('wrong');
          if (state.answerA !== null && state.currentQ.options[state.answerA] === opt) el.classList.add('selected-a');
          if (state.answerB !== null && state.currentQ.options[state.answerB] === opt) el.classList.add('selected-b');
        }
        optDiv.appendChild(el);
      });
    } else if (state.battleStatus !== 'finished') {
      qCard.classList.remove('visible');
    }

    // Check for all matches done → show qualification
    const allDone = state.bracket.every(m => m.status === 'done');
    if (allDone && !document.getElementById('au-qualify').classList.contains('active')) {
      showQualification(state);
    }

    lastState = JSON.stringify(state);
  }

  function showQualification(state) {
    const qualifyEl = document.getElementById('au-qualify');
    const listEl = document.getElementById('au-qualify-list');
    listEl.innerHTML = '';

    const winners = state.bracket.filter(m => m.winner).map(m => m.winner);
    winners.forEach(name => {
      const div = document.createElement('div');
      div.className = 'au-qualify-team';
      div.textContent = name;
      listEl.appendChild(div);
    });

    qualifyEl.classList.add('active');

    // Cinematic reveal one by one
    const teams = listEl.querySelectorAll('.au-qualify-team');
    teams.forEach((el, i) => {
      setTimeout(() => el.classList.add('revealed'), (i + 1) * 1500);
    });
  }

  // Poll localStorage every 200ms for changes
  setInterval(() => {
    const current = localStorage.getItem(STORAGE_KEY);
    if (current !== lastState) {
      render();
    }
  }, 200);

  // Also listen for storage events (cross-tab)
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) render();
  });

  render();
})();
