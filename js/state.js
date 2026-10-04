const G = {
  running: false, paused: false, pausedMs: 0, pauseStart: 0,
  routes: {},
  stats: loadStats(),
  misses: loadMisses(),
  currentName: '',
  currentLesson: [],
  mode: 'en-ar',
  reading: 'full',
  voice: true,
  daily: false,
  endless: false,
  difficulty: 'normal',
  story: true,
  lastWrong: null,
  roomPhrases: [],
  roomType: 'combat',
  seenThisRun: null,
  discoveries: [],
  discoveryNear: null,
  discoveryOpen: null,

  // ---- touch ----
  joy: null,           // { x, y, m } from the floating analog stick, or null
  touchMode: IS_TOUCH, // opt into auto-staff, gate padding, layout strip

  rng: Math.random,
  roomIdx: 0, rooms: [], roomsCleared: 0, stars: 3,
  player: null, gates: [], obstacles: [], pickups: [],
  orbs: [], projectiles: [], dust: [], footprints: [],
  particles: [], rings: [], floatingText: [], boss: null,
  stormY: 0, stormSpeed: 0,
  targetGate: null, targetShownAt: 0,
  bounds: { l: 0, t: 0, r: 0, b: 0 },
  correct: 0, wrong: 0, kills: 0, bossDefeated: false, startTime: 0,
  score: 0, combo: 0, bestCombo: 0,
  shield: false,
  up: { speed: 1, regen: 1, range: 1, burstCd: 1, storm: 1 },
  tension: 0, heartTimer: 0,
  stamina: 100, maxStamina: 100,
  dashCooldownUntil: 0, dashUntil: 0, dashing: false,
  stunUntil: 0, invulnUntil: 0,
  staffCooldownUntil: 0, burstCooldownUntil: 0,
  gateCooldownUntil: 0,
  userPaused: false,
  bossRespawnAt: 0,
  bossKilledThisRoom: false,
  inWrongGate: null,
  inWrongSince: 0,
  flashUntil: 0, flashColor: '#e8dfc8', flashAlpha: 0,
  statusText: 'Awaiting orders',
  statusSub: 'WASD · SHIFT sprint · SPACE dash · J staff · K burst',
  statusClass: '', statusUntil: 0,
  keys: {}, lastTime: 0,
  shakeUntil: 0, shakeMag: 0, hitstopUntil: 0,
  footstepTimer: 0,
};

function setStatus(text, sub, cls = '', ms = 0) {
  G.statusText = text;
  G.statusSub = sub || G.statusSub;
  G.statusClass = cls;
  G.statusUntil = ms ? nowMs() + ms : 0;
}
function flash(color, alpha = 0.15, ms = 150) { G.flashUntil = nowMs() + ms; G.flashColor = color; G.flashAlpha = alpha; }
function shake(mag, ms = 250) { G.shakeUntil = nowMs() + ms; G.shakeMag = mag; }
function hitstop(ms = 60) { G.hitstopUntil = nowMs() + ms; }
function spawnParticles(x, y, color, count, power = 1) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = rand(80, 340) * power;
    G.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, life: rand(0.4, 0.9), max: 0.7, color, size: rand(2, 4.5) });
  }
}
function spawnRing(x, y, color, maxR = 140, dur = 0.45) {
  G.rings.push({ x, y, r: 8, maxR, life: dur, max: dur, color });
}
function spawnFloatText(x, y, text, color, life = 1.0, size = 26) {
  G.floatingText.push({ x, y, text, color, life, max: life, vy: -70, size });
}
function pauseOn() { if (!G.paused) { G.paused = true; G.pauseStart = nowMs(); } }
function pauseOff() { if (G.paused) { G.paused = false; G.pausedMs += nowMs() - G.pauseStart; } }
