let ac = null, masterGain = null;
function initAudio() {
  if (ac) return;
  try {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = ac.createGain();
    masterGain.gain.value = 0.5;
    masterGain.connect(ac.destination);
  } catch (_) {}
}
function tone({ freq = 440, dur = 0.1, vol = 0.06, type = 'sine', slideTo = null, delay = 0 }) {
  if (!ac || !masterGain) return;
  const t0 = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(masterGain);
  osc.start(t0); osc.stop(t0 + dur + 0.05);
}
function noise({ dur = 0.1, vol = 0.04, lowpass = 2000 }) {
  if (!ac || !masterGain) return;
  const t0 = ac.currentTime;
  const bufSize = ac.sampleRate * dur;
  const buf = ac.createBuffer(1, bufSize, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufSize, 2);
  const src = ac.createBufferSource(); src.buffer = buf;
  const filter = ac.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = lowpass;
  const g = ac.createGain(); g.gain.value = vol;
  src.connect(filter).connect(g).connect(masterGain);
  src.start(t0);
}

const S = {
  footstep: () => noise({ dur: 0.06, vol: 0.02, lowpass: 400 }),
  staff: () => { tone({ freq: 900, slideTo: 200, dur: 0.14, vol: 0.055, type: 'sawtooth' }); noise({ dur: 0.08, vol: 0.025 }); },
  burst: () => {
    tone({ freq: 220, slideTo: 1400, dur: 0.35, vol: 0.07 });
    tone({ freq: 440, slideTo: 1760, dur: 0.3, vol: 0.045, type: 'triangle', delay: 0.02 });
  },
  hit: () => tone({ freq: 220, slideTo: 120, dur: 0.1, vol: 0.08, type: 'square' }),
  orbDeath: () => { tone({ freq: 400, slideTo: 80, dur: 0.22, vol: 0.07, type: 'square' }); noise({ dur: 0.15, vol: 0.035 }); },
  orbSpawn: () => { tone({ freq: 120, slideTo: 320, dur: 0.22, vol: 0.055, type: 'triangle' }); noise({ dur: 0.14, vol: 0.02, lowpass: 900 }); },
  bossHit: () => { tone({ freq: 100, slideTo: 40, dur: 0.25, vol: 0.1, type: 'sawtooth' }); noise({ dur: 0.2, vol: 0.05 }); },
  bossLunge: () => tone({ freq: 180, slideTo: 60, dur: 0.3, vol: 0.09, type: 'sawtooth' }),
  bossDeath: () => {
    for (let i = 0; i < 6; i++) tone({ freq: 200 - i * 25, dur: 0.4, vol: 0.09, type: 'sawtooth', delay: i * 0.12 });
    noise({ dur: 1.2, vol: 0.06, lowpass: 400 });
  },
  correct: (combo = 0) => {
    const m = 1 + Math.min(combo, 10) * 0.06;
    tone({ freq: 523 * m, dur: 0.12, vol: 0.06 });
    tone({ freq: 784 * m, dur: 0.18, vol: 0.05, delay: 0.08 });
  },
  wrong: () => tone({ freq: 140, slideTo: 60, dur: 0.28, vol: 0.09, type: 'sawtooth' }),
  lantern: () => { tone({ freq: 880, dur: 0.1, vol: 0.05 }); tone({ freq: 1320, dur: 0.18, vol: 0.04, delay: 0.08 }); },
  hound: () => tone({ freq: 90, slideTo: 60, dur: 0.18, vol: 0.06, type: 'sawtooth' }),
  roomEnter: () => { tone({ freq: 220, dur: 0.35, vol: 0.07, type: 'triangle' }); noise({ dur: 0.4, vol: 0.025, lowpass: 500 }); },
  death: () => { for (let i = 0; i < 7; i++) tone({ freq: 400 - i * 50, dur: 0.18, vol: 0.07, type: 'sawtooth', delay: i * 0.08 }); },
  victory: () => [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, dur: 0.22, vol: 0.07, delay: i * 0.1 })),
  projectile: () => tone({ freq: 1200, slideTo: 300, dur: 0.14, vol: 0.045, type: 'sawtooth' }),
  starLoss: () => { tone({ freq: 200, slideTo: 90, dur: 0.3, vol: 0.09, type: 'sawtooth' }); noise({ dur: 0.2, vol: 0.04 }); },
  heartbeat: (v = 0.1) => {
    tone({ freq: 62, slideTo: 38, dur: 0.12, vol: v, type: 'sine' });
    tone({ freq: 58, slideTo: 36, dur: 0.14, vol: v * 0.8, type: 'sine', delay: 0.15 });
  },
  boon: () => [440, 660, 880].forEach((f, i) => tone({ freq: f, dur: 0.16, vol: 0.05, type: 'triangle', delay: i * 0.07 })),
  shieldUp: () => tone({ freq: 660, slideTo: 1320, dur: 0.25, vol: 0.06, type: 'triangle' }),
  shieldBreak: () => { tone({ freq: 900, slideTo: 200, dur: 0.22, vol: 0.07, type: 'square' }); noise({ dur: 0.18, vol: 0.04 }); },
};

// ============================================================
//  Audio playback — no TTS, ever. Silence if no file.
// ============================================================
const AUDIO_DIR = 'audio/';
let curAudio = null;
const audioCache = new Map();

function resolveAudioPath(au) {
  if (!au) return null;
  const s = String(au).trim();
  if (!s) return null;
  if (/^(https?:|data:|blob:)/i.test(s)) return s;
  if (s.startsWith('/')) return s;
  if (s.includes('/')) return s;
  return AUDIO_DIR + s;
}

function getAudioEl(path) {
  let a = audioCache.get(path);
  if (!a) {
    a = new Audio(path);
    a.preload = 'auto';
    a.crossOrigin = 'anonymous';
    audioCache.set(path, a);
  }
  return a;
}

function preloadLessonAudio(items) {
  if (!items) return;
  for (const it of items) {
    const path = resolveAudioPath(it && it.au);
    if (!path || audioCache.has(path)) continue;
    getAudioEl(path);
  }
  // Also preload the whole-dialogue file
  const dpath = resolveAudioPath(items.dialogueAudio);
  if (dpath && !audioCache.has(dpath)) getAudioEl(dpath);
}

// Play a single phrase's audio file (used in-game on correct/wrong).
// Silent if no file. No TTS.
function speakAr(item) {
  if (!G.voice || !item) return;
  const path = resolveAudioPath(item.au);
  if (!path) return;
  stopAllAudio();
  const a = getAudioEl(path);
  try { a.currentTime = 0; } catch (_) {}
  curAudio = a;
  a.play().catch(() => {});
}

// Play the full dialogue audio file. Returns the Audio element or null.
function playDialogueAudio(path) {
  const resolved = resolveAudioPath(path);
  if (!resolved) return null;
  stopAllAudio();
  const a = getAudioEl(resolved);
  try { a.currentTime = 0; } catch (_) {}
  curAudio = a;
  a.play().catch(() => {});
  return a;
}

function stopAllAudio() {
  if (curAudio) {
    try { curAudio.pause(); curAudio.currentTime = 0; } catch (_) {}
    curAudio = null;
  }
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}
