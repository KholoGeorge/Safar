function showScreen(el) {
  [homeScreen, manualScreen, briefScreen, endScreen, upgradeScreen, chooseScreen, dialogueScreen, reviewScreen]
    .forEach(s => s.classList.remove('show'));
  if (el) el.classList.add('show');
}

function refreshHome() {
  lessonGrid.innerHTML = '';
  const names = Object.keys(G.routes);

  const D = loadDaily();
  const dn = dayNum();
  const streak = (D.lastDay === dn || D.lastDay === dn - 1) ? (D.streak || 0) : 0;
  const todayBest = D.todayDay === dn ? (D.todayBest || 0) : 0;
  const dailyName = names.length ? names[dn % names.length] : '—';
  $('dailyLine').textContent = names.length
    ? `Today: ${dailyName} · best ${todayBest} · 🔥 ${streak} day streak`
    : '';

  if (!names.length) {
    lessonGrid.innerHTML = '<div style="color:#6a5a3d; font-family:monospace;">No routes found in lessons/.</div>';
    return;
  }
  for (const name of names) {
    const route = G.routes[name];
    const stat = G.stats[name];
    const card = document.createElement('div');
    card.className = 'lesson-card';
    let meta = `${route.length} phrases`;
    if (stat?.bestRooms != null) meta += ` · ${stat.bestRooms} rooms`;
    if (stat?.bestScore) meta += ` · ${stat.bestScore} pts`;
    card.innerHTML = `<div class="name"></div><div class="meta">${meta}</div>`;
    card.querySelector('.name').textContent = name;
    card.onclick = () => openBriefing(name, false);
    lessonGrid.appendChild(card);
  }
}

function openBriefing(name, daily = false) {
  G.daily = daily;
  G.currentName = name;
  G.currentLesson = G.routes[name] || [];
  briefTitle.textContent = daily ? 'DAILY ROUTE' : name;
  const stat = G.stats[name];
  let sub = (daily ? name + ' · ' : '') + `${G.currentLesson.length} phrases`;
  if (!daily && stat?.bestScore) sub += ` · best ${stat.bestScore} pts`;
  briefSub.textContent = sub;
  $('briefInfo').textContent = daily
    ? 'Same gate order for everyone today. 6 rooms. One shot at your best score.'
    : '6 rooms. Read fast, fight hard. The boss waits in the dark — and beyond it, the endless road.';
  modeRow.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.mode === G.mode));
  voiceRow.querySelectorAll('button').forEach(b => b.classList.toggle('active', (b.dataset.voice === '1') === G.voice));
  difficultyRow.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.diff === G.difficulty));
  storyRow.querySelectorAll('button').forEach(b => b.classList.toggle('active', (b.dataset.story === '1') === G.story));
  preloadLessonAudio(G.currentLesson);
  showScreen(briefScreen);
}

function startRun() {
  initAudio();
  if (ac && ac.state === 'suspended') ac.resume();
  showScreen(null);
  G.rooms = buildRun();
  G.roomIdx = 0; G.roomsCleared = 0; G.stars = 3;
  G.correct = 0; G.wrong = 0; G.kills = 0; G.bossDefeated = false;
  G.score = 0; G.combo = 0; G.bestCombo = 0;
  G.shield = false; G.endless = false;
  G.lastWrong = null;
  updateLastWrongPanel();
  G.seenThisRun = new Set();
  G.maxStamina = 100;
  G.up = { speed: 1, regen: 1, range: 1, burstCd: 1, storm: 1 };
  G.paused = false; G.pausedMs = 0;
  G.keys = {};
  G.startTime = nowMs();
  G.running = true;
  preloadLessonAudio(G.currentLesson);
  showDialogue(STORY.intro, () => enterRoom(0));
}

function endRun(victory) {
  if (!G.running) return;
  G.running = false;
  pauseOff();
  G.keys = {};
  upgradeScreen.classList.remove('show');
  chooseScreen.classList.remove('show');

  const elapsed = Math.max(0, Math.round((nowMs() - G.startTime - G.pausedMs) / 1000));
  const mins = Math.floor(elapsed / 60);
  const secs = String(elapsed % 60).padStart(2, '0');
  const title = victory ? 'JOURNEY COMPLETE' : 'STORM TOOK YOU';
  let sub = victory ? `${G.rooms.length} rooms crossed` : `Fell in room ${G.roomIdx + 1}${G.endless ? '' : ' of ' + G.rooms.length}`;
  if (G.daily) sub = 'DAILY · ' + sub;

  const prev = G.stats[G.currentName] || {};
  const isHigh = G.score > 0 && G.score > (prev.bestScore || 0);
  if (isHigh) sub += ' · NEW HIGH SCORE';

  $('endTitle').textContent = title;
  $('endTitle').className = 'end-title' + (victory ? '' : ' warn');
  $('endSub').textContent = `${G.currentName} · ${sub}`;
  $('endScore').textContent = G.score;
  $('endCombo').textContent = 'x' + G.bestCombo;
  $('endCorrect').textContent = G.correct;
  $('endWrong').textContent = G.wrong;
  $('endKills').textContent = G.kills;
  $('endBoss').textContent = G.bossDefeated ? '✓ Defeated' : '—';
  $('endTime').textContent = `${mins}:${secs}`;
  $('endRooms').textContent = G.endless ? `${G.roomsCleared}` : `${G.roomsCleared}/${G.rooms.length}`;

  G.stats[G.currentName] = {
    bestRooms: Math.max(prev.bestRooms || 0, G.roomsCleared),
    bestScore: Math.max(prev.bestScore || 0, G.score),
    plays: (prev.plays || 0) + 1,
    lastPlayed: Date.now(),
  };
  saveStats(G.stats);

  if (G.daily) {
    const D = loadDaily();
    const dn = dayNum();
    if (D.todayDay !== dn) { D.todayDay = dn; D.todayBest = 0; }
    D.todayBest = Math.max(D.todayBest || 0, G.score);
    if (D.lastDay !== dn) {
      D.streak = (D.lastDay === dn - 1) ? (D.streak || 0) + 1 : 1;
      D.lastDay = dn;
    }
    saveDaily(D);
  }

  const showEnd = () => {
    if (victory) S.victory(); else S.death();
    showScreen(endScreen);
  };
  if (victory && G.story && !G.daily) {
    showDialogue(STORY.victory, showEnd);
  } else {
    showEnd();
  }
}

// UI event bindings
$('openManualBtn').onclick = () => { showScreen(manualScreen); startDemo(); };
$('closeManualBtn').onclick = () => { refreshHome(); showScreen(homeScreen); };
$('dailyBtn').onclick = () => {
  const names = Object.keys(G.routes);
  if (!names.length) return;
  openBriefing(names[dayNum() % names.length], true);
};
$('backHomeBtn').onclick = () => { refreshHome(); showScreen(homeScreen); };
$('startBtn').onclick = () => startRun();
$('endBackBtn').onclick = () => { refreshHome(); showScreen(homeScreen); };
$('againBtn').onclick = () => startRun();
$('claimBtn').onclick = () => {
  chooseScreen.classList.remove('show');
  pauseOff();
  endRun(true);
};
$('pressOnBtn').onclick = () => {
  chooseScreen.classList.remove('show');
  pauseOff();
  G.endless = true;
  showDialogue(STORY.endless, () => enterRoom(G.roomIdx));
};
modeRow.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  modeRow.querySelectorAll('button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  G.mode = btn.dataset.mode;
});
voiceRow.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  voiceRow.querySelectorAll('button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  G.voice = btn.dataset.voice === '1';
  if (G.voice) preloadLessonAudio(G.currentLesson);
});
difficultyRow.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  difficultyRow.querySelectorAll('button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  G.difficulty = btn.dataset.diff;
});
storyRow.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  storyRow.querySelectorAll('button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  G.story = btn.dataset.story === '1';
});
objReplay.addEventListener('click', (e) => {
  e.stopPropagation();
  if (G.targetGate) speakAr(G.targetGate.item);
});
objSubReplay.addEventListener('click', (e) => {
  e.stopPropagation();
  if (G.lastWrong) speakAr(G.lastWrong.item);
});

function showRoomReview(done) {
  const seen = G.roomPhrases || [];
  const wrong = seen.filter(p => !p.correct);
  const right = seen.filter(p => p.correct);

  // Prioritize: wrong first, then correct, deduped by phrase
  const shown = [];
  const seenAr = new Set();
  for (const p of wrong) {
    if (shown.length >= 3) break;
    if (seenAr.has(p.item.ar)) continue;
    seenAr.add(p.item.ar);
    shown.push(p);
  }
  for (const p of right) {
    if (shown.length >= 4) break;
    if (seenAr.has(p.item.ar)) continue;
    seenAr.add(p.item.ar);
    shown.push(p);
  }

  if (!shown.length) { done(); return; }

    const prevRoom = G.rooms[G.roomIdx - 1];
  const nextRoom = G.rooms[G.roomIdx];
  const prevRoomName = (prevRoom && prevRoom.name) || 'The road';
  const nextRoomName = nextRoom
    ? nextRoom.name
    : (G.endless ? 'The endless road' : 'The road home');

  const list = $('reviewList');
  list.innerHTML = '';
  for (const p of shown) {
    const row = document.createElement('div');
    row.className = 'review-row ' + (p.correct ? 'ok' : 'bad');
    const ar = G.mode === 'en-ar' ? p.item.ar : p.item.en;
    const en = G.mode === 'en-ar' ? p.item.en : p.item.ar;
    const dir = G.mode === 'en-ar' ? 'rtl' : 'ltr';
    row.innerHTML = `
      <div class="review-mark">${p.correct ? '✓' : '✗'}</div>
      <div class="review-body">
        <div class="review-ar" dir="${dir}">${ar}</div>
        <div class="review-en">${en}</div>
      </div>
    `;
    list.appendChild(row);
  }

  $('reviewFrom').textContent = prevRoomName;
  $('reviewTo').textContent = nextRoomName;

  reviewScreen.classList.add('show');
  pauseOn();

  // Stagger the rows in
  const rows = list.querySelectorAll('.review-row');
  let idx = 0;
  function reveal() {
    if (idx >= rows.length) return;
    rows[idx].classList.add('shown');
    idx++;
    setTimeout(reveal, 550);
  }
  setTimeout(reveal, 300);

    // Auto-advance
  const totalTime = 500 + shown.length * 550 + 2200;
  const timer = setTimeout(() => {
    reviewScreen.classList.remove('show');
    pauseOff();
    done();
  }, totalTime);

  // Tap to skip — but only after the last row has revealed, so a joystick
  // release or a stray tap during the animation doesn't dismiss it.
  const revealDone = 300 + shown.length * 550 + 600;
  let armed = false;
  let downOnReview = false;

  setTimeout(() => { armed = true; }, revealDone);

  reviewScreen.addEventListener('pointerdown', () => { downOnReview = true; });
  reviewScreen.addEventListener('pointerup', () => {
    if (!armed) { downOnReview = false; return; }
    if (!downOnReview) return;
    downOnReview = false;
    clearTimeout(timer);
    reviewScreen.classList.remove('show');
    pauseOff();
    done();
  });

function enterPause() {
  if (G.userPaused) return;
  G.userPaused = true;
  pauseScreen.classList.add('show');
  pauseOn();
  G.keys = {};
}
function resumeFromPause() {
  if (!G.userPaused) return;
  G.userPaused = false;
  pauseScreen.classList.remove('show');
  pauseOff();
}
function togglePause() {
  if (!G.running) return;
  if (dialogueScreen.classList.contains('show')) return;
  if (upgradeScreen.classList.contains('show')) return;
  if (chooseScreen.classList.contains('show')) return;
  if (G.userPaused) resumeFromPause();
  else enterPause();
}
document.getElementById('pauseBtn').addEventListener('click', togglePause);
document.getElementById('pauseResume').addEventListener('click', resumeFromPause);
document.getElementById('pauseQuit').addEventListener('click', () => {
  resumeFromPause();
  endRun(false);
});
