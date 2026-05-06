/* ===========================
   Tech Escape Arena – Round 4 Admin
   =========================== */
(function () {
  'use strict';
  const socket = io();
  const token = sessionStorage.getItem('tea_admin_token');
  if (!token) {
    let p = window.location.pathname; const parts = p.split('/'); parts.pop();
    window.location.href = parts.join('/') || '/system-override'; return;
  }
  const headers = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token };

  // Nav links
  let basePath = window.location.pathname.replace(/\/round4$/, '');
  document.getElementById('nav-r1').href = basePath + '/dashboard';
  document.getElementById('nav-r2').href = basePath + '/round2';

  const adminTimer = document.getElementById('admin-timer');
  const timerStatus = document.getElementById('timer-status');
  let modalCallback = null;

  // Modal
  function showModal(title, text, cb) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-text').textContent = text;
    document.getElementById('modal-img').style.display = 'none';
    modalCallback = cb;
    document.getElementById('modal-overlay').classList.add('active');
  }
  document.getElementById('modal-confirm').onclick = () => { document.getElementById('modal-overlay').classList.remove('active'); if (modalCallback) modalCallback(); };
  document.getElementById('modal-cancel').onclick = () => { document.getElementById('modal-overlay').classList.remove('active'); };

  async function post(url, body = {}) { return (await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })).json(); }
  async function get(url) { return (await fetch(url, { headers })).json(); }

  // Timer
  socket.on('timer:r4', (d) => updateTimerUI(d.remaining, d.status));
  function updateTimerUI(remaining, status) {
    const btnStart = document.getElementById('btn-start'), btnPause = document.getElementById('btn-pause'), btnResume = document.getElementById('btn-resume');
    if (status === 'waiting') { adminTimer.textContent = '--:--'; timerStatus.textContent = 'WAITING'; btnStart.style.display=''; btnPause.style.display='none'; btnResume.style.display='none'; }
    else if (status === 'running') {
      const m = Math.floor(remaining/60000), s = Math.floor((remaining%60000)/1000);
      adminTimer.textContent = String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
      timerStatus.textContent = 'RUNNING'; timerStatus.style.color = '#00ffaa';
      btnStart.style.display='none'; btnPause.style.display=''; btnResume.style.display='none';
    } else if (status === 'paused') {
      const m = Math.floor(remaining/60000), s = Math.floor((remaining%60000)/1000);
      adminTimer.textContent = String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
      timerStatus.textContent = 'PAUSED'; timerStatus.style.color = '#ffaa00';
      btnStart.style.display='none'; btnPause.style.display='none'; btnResume.style.display='';
    } else if (status === 'ended') {
      adminTimer.textContent = '00:00'; timerStatus.textContent = "ENDED"; timerStatus.style.color = '#ff003c';
      btnStart.style.display='none'; btnPause.style.display='none'; btnResume.style.display='none';
    }
  }

  document.getElementById('btn-start').onclick = () => showModal('START TIMER','Start the countdown for all teams?', () => post('/api/admin/r4/timer/start'));
  document.getElementById('btn-pause').onclick = () => post('/api/admin/r4/timer/pause');
  document.getElementById('btn-resume').onclick = () => post('/api/admin/r4/timer/resume');
  document.getElementById('btn-reset').onclick = () => showModal('RESET TIMER','Reset timer?', () => post('/api/admin/r4/timer/reset'));
  document.getElementById('btn-end').onclick = () => showModal('END ROUND','End Round 4? This locks everything.', () => post('/api/admin/r4/end'));

  // Save answers
  document.getElementById('btn-save-answers').onclick = async () => {
    const stageAnswers = { 1: document.getElementById('ans-1').value, 2: document.getElementById('ans-2').value, 3: document.getElementById('ans-3').value };
    await post('/api/admin/r4/config', { stageAnswers });
    document.getElementById('btn-save-answers').textContent = '✅ SAVED!';
    setTimeout(() => document.getElementById('btn-save-answers').textContent = 'SAVE ANSWERS', 2000);
  };

  // Save hints
  document.getElementById('btn-save-hints').onclick = async () => {
    const stageHints = { 1: document.getElementById('hint-1').value, 2: document.getElementById('hint-2').value, 3: document.getElementById('hint-3').value, 4: document.getElementById('hint-4').value };
    await post('/api/admin/r4/config', { stageHints });
    document.getElementById('btn-save-hints').textContent = '✅ SAVED!';
    setTimeout(() => document.getElementById('btn-save-hints').textContent = 'SAVE HINTS', 2000);
  };

  // Lock
  document.getElementById('btn-lock').onclick = () => post('/api/admin/r4/lock');

  // Reset
  document.getElementById('btn-reset-round').onclick = () => showModal('⚠ RESET ROUND 4','Delete ALL Round 4 progress and submissions?', () => post('/api/admin/r4/reset'));

  // Refresh data
  async function refresh() {
    try {
      const config = await get('/api/admin/r4/config');
      if (config.meta?.stageAnswers) {
        document.getElementById('ans-1').value = config.meta.stageAnswers[1] || '';
        document.getElementById('ans-2').value = config.meta.stageAnswers[2] || '';
        document.getElementById('ans-3').value = config.meta.stageAnswers[3] || '';
      }
      if (config.meta?.stageHints) {
        document.getElementById('hint-1').value = config.meta.stageHints[1] || '';
        document.getElementById('hint-2').value = config.meta.stageHints[2] || '';
        document.getElementById('hint-3').value = config.meta.stageHints[3] || '';
        document.getElementById('hint-4').value = config.meta.stageHints[4] || '';
      }

      const data = await get('/api/admin/r4/progress');
      const { progress, submissions } = data;

      // Stats
      document.getElementById('stat-teams').textContent = progress.length;
      document.getElementById('stat-s1').textContent = progress.filter(p => p.stages?.some(s => s.stage === 1)).length;
      document.getElementById('stat-s2').textContent = progress.filter(p => p.stages?.some(s => s.stage === 2)).length;
      document.getElementById('stat-s3').textContent = progress.filter(p => p.stages?.some(s => s.stage === 3)).length;
      document.getElementById('stat-done').textContent = progress.filter(p => p.completed).length;

      // Progress table
      const pb = document.getElementById('progress-body');
      pb.innerHTML = '';
      progress.forEach(p => {
        const tr = document.createElement('tr');
        const stageCheck = (n) => p.stages?.some(s => s.stage === n) ? '✅' : '⬜';
        let statusBadge;
        if (p.disqualified) statusBadge = '<span class="badge badge-red">DQ</span>';
        else if (p.completed) statusBadge = '<span class="badge badge-green">DONE</span>';
        else statusBadge = `<span class="badge badge-yellow">S${p.currentStage}</span>`;

        tr.innerHTML = `
          <td>${p.teamId}</td><td>${p.teamName||'—'}</td><td style="font-size:1rem;font-weight:bold;color:var(--neon);">S${p.currentStage}</td>
          <td>${stageCheck(1)}</td><td>${stageCheck(2)}</td><td>${stageCheck(3)}</td><td>${stageCheck(4)}</td>
          <td>${statusBadge}</td>
          <td>
            <select class="a4-input" style="width:auto;display:inline;padding:4px;font-size:0.7rem;margin:0;" onchange="unlockStage('${p.teamId}',this.value)">
              <option value="">Unlock→</option><option value="2">S2</option><option value="3">S3</option><option value="4">S4</option>
            </select>
            <button class="a4-btn danger" style="font-size:0.6rem;padding:3px 8px;" onclick="disqualify('${p.teamId}',${!p.disqualified})">${p.disqualified?'RE-Q':'DQ'}</button>
          </td>
        `;
        pb.appendChild(tr);
      });

      // Submissions table
      const sb = document.getElementById('submissions-body');
      sb.innerHTML = '';
      submissions.forEach(s => {
        const tr = document.createElement('tr');
        const time = s.submissionTime ? new Date(s.submissionTime).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit'}) : '--';
        const valBadge = s.validationStatus === 'approved' ? '<span class="badge badge-green">APPROVED</span>'
          : s.validationStatus === 'rejected' ? '<span class="badge badge-red">REJECTED</span>'
          : '<span class="badge badge-yellow">PENDING</span>';

        tr.innerHTML = `
          <td style="font-weight:bold;color:#FFD700;">#${s.rank}</td><td>${s.teamId}</td><td>${s.teamName||'—'}</td>
          <td>${s.imageData !== '[IMAGE]' ? '—' : '<button class="a4-btn" style="font-size:0.6rem;padding:3px 8px;" onclick="viewImage(\''+s.teamId+'\')">VIEW</button>'}</td>
          <td>${time}</td><td>${valBadge}</td>
          <td>
            <button class="a4-btn green" style="font-size:0.6rem;padding:3px 8px;" onclick="validateSub('${s.teamId}','approved')">✅</button>
            <button class="a4-btn danger" style="font-size:0.6rem;padding:3px 8px;" onclick="validateSub('${s.teamId}','rejected')">❌</button>
          </td>
        `;
        sb.appendChild(tr);
      });
    } catch(e) { console.error(e); }
  }

  window.unlockStage = (teamId, stage) => { if(stage) post('/api/admin/r4/unlock-stage',{teamId,stage:parseInt(stage)}); };
  window.disqualify = (teamId, dq) => {
    showModal(dq?'DISQUALIFY':'RE-QUALIFY', `${dq?'Disqualify':'Re-qualify'} team ${teamId}?`, () => post('/api/admin/r4/disqualify',{teamId,disqualified:dq}));
  };
  window.validateSub = (teamId, status) => post('/api/admin/r4/validate-submission',{teamId,status});
  window.viewImage = async (teamId) => {
    const data = await get(`/api/admin/r4/submission/${teamId}/image`);
    if(data.imageData) {
      const img = document.getElementById('modal-img');
      img.src = `data:${data.imageType};base64,${data.imageData}`;
      img.style.display = 'block';
      document.getElementById('modal-title').textContent = 'SUBMISSION: ' + teamId;
      document.getElementById('modal-text').textContent = '';
      document.getElementById('modal-overlay').classList.add('active');
    }
  };

  // Export CSV
  document.getElementById('btn-export').onclick = async () => {
    const data = await get('/api/admin/r4/progress');
    let csv = 'Team ID,Name,Current Stage,S1,S2,S3,S4,Completed,DQ\n';
    data.progress.forEach(p => {
      csv += `"${p.teamId}","${p.teamName}",${p.currentStage},${p.stages?.some(s=>s.stage===1)},${p.stages?.some(s=>s.stage===2)},${p.stages?.some(s=>s.stage===3)},${p.stages?.some(s=>s.stage===4)},${p.completed},${p.disqualified}\n`;
    });
    const blob = new Blob([csv],{type:'text/csv'}); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download='Round4_Progress.csv'; a.click(); URL.revokeObjectURL(url);
  };

  socket.on('r4:progress', refresh);
  socket.on('r4:submission', refresh);
  refresh();
  setInterval(refresh, 4000);
  fetch('/api/round4/timer').then(r=>r.json()).then(d=>updateTimerUI(d.remaining,d.status)).catch(()=>{});
})();
