// ============================================================
//  run_save.js — persist an unfinished run so you can close the
//  tab and pick up where you left off.
// ============================================================

const RUN_KEY = 'safar_run_v1';

function saveRun() {
  if (!G.running) return;
  try {
    const elapsedMs = nowMs() - G.startTime - G.pausedMs;
    const snap = {
      v: 1,
      savedAt: Date.now(),
      currentName: G.currentName,
      roomIdx: G.roomIdx,
      rooms: G.rooms,
      runQueue: G.runQueue,
      queueCursor: G.queueCursor,
      score: G.score,
      stars: G.stars,
      combo: G.combo,
      bestCombo: G.bestCombo,
      correct: G.correct,
      wrong: G.wrong,
      kills: G.kills,
      bossDefeated: G.bossDefeated,
      roomsCleared: G.roomsCleared,
      endless: G.endless,
      daily: G.daily,
      mode: G.mode,
      reading: G.reading,
      difficulty: G.difficulty,
      voice: G.voice,
      elapsedMs: elapsedMs,
      startWall: G.startWall,
    };
    localStorage.setItem(RUN_KEY, JSON.stringify(snap));
  } catch (e) {
    console.warn('saveRun failed:', e);
  }
}

function loadRun() {
  try {
    const raw = localStorage.getItem(RUN_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || s.v !== 1) return null;
    if (!s.currentName || !G.routes[s.currentName]) return null;
    return s;
  } catch (_) {
    return null;
  }
}

function hasRun() {
  return !!loadRun();
}

function clearRun() {
  try { localStorage.removeItem(RUN_KEY); } catch (_) {}
}

function updateContinueUI() {
  const btn = document.getElementById('continueBtn');
  if (!btn) return;
  const s = loadRun();
  if (!s) { btn.style.display = 'none'; return; }
  const label = document.getElementById('continueLabel');
  const total = (s.rooms && s.rooms.length) ? s.rooms.length : 7;
  if (label) {
    label.textContent = s.currentName + ' · Room ' + (s.roomIdx + 1) + ' / ' + total;
  }
  btn.style.display = 'inline-flex';
}

function continueRun() {
  const s = loadRun();
  if (!s) return;
  const lesson = G.routes[s.currentName];
  if (!lesson) { clearRun(); updateContinueUI(); return; }

  G.currentName = s.currentName;
  G.currentLesson = lesson;
  G.currentCards = lesson.cards || lesson;

  G.daily = !!s.daily;
  G.endless = !!s.endless;
  G.mode = s.mode || G.mode;
  G.reading = s.reading || G.reading;
  G.difficulty = s.difficulty || G.difficulty;
  G.voice = s.voice !== false;

  G.rooms = s.rooms || [];
  G.roomIdx = s.roomIdx || 0;
  G.runQueue = s.runQueue || [];
  G.queueCursor = s.queueCursor || 0;

  G.score = s.score || 0;
  G.stars = s.stars != null ? s.stars : 3;
  G.combo = s.combo || 0;
  G.bestCombo = s.bestCombo || 0;
  G.correct = s.correct || 0;
  G.wrong = s.wrong || 0;
  G.kills = s.kills || 0;
  G.bossDefeated = !!s.bossDefeated;
  G.roomsCleared = s.roomsCleared || 0;
  G.startWall = s.startWall || Date.now();

  G.startTime = nowMs() - (s.elapsedMs || 0);
  G.pausedMs = 0;

  // Reset per-run transient state we don't persist.
  G.seenThisRun = new Set();
  G.gradedThisRun = new Set();
  G.gatesNear = new Set();
  G.tgt = null;
  G.lastWrong = null;
  G.paused = false;
  G.userPaused = false;
  G.keys = {};
  G.up = { speed: 1, regen: 1, range: 1, burstCd: 1, storm: 1 };
  G.maxStamina = 100;
  G.shield = false;
  G.advancing = false;
  G.exitAnnounced = false;
  G.whisperLastIdx = -1;
  G.touchSprint = false;
  const sb = document.getElementById('sprintBtn');
  if (sb) sb.classList.remove('active');

  G.running = true;

  initAudio();
  if (ac && ac.state === 'suspended') ac.resume();
  if (typeof startWind === 'function') startWind();
  preloadLessonAudio(G.currentLesson);
  showScreen(null);
  showLoading(G.currentName, 'Resuming', 1000, function () { enterRoom(G.roomIdx); });
}
