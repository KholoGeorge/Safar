const USE_3D = true;

const $ = id => document.getElementById(id);

// Touch detection — declared first so DPR, state, and input can all read it
// without hitting the temporal dead zone.
const IS_TOUCH = matchMedia('(hover: none) and (pointer: coarse)').matches
              || 'ontouchstart' in window
              || navigator.maxTouchPoints > 0;
// Very slow device? Adreno 306-class (Galaxy Tab E, older budget phones).
// Detected by low core count or low reported memory. Used to strip the
// expensive parts of the render path.
const IS_SLOW = (() => {
  if (typeof navigator === 'undefined') return false;
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4;
  return cores <= 4 && mem <= 2;
})();

// HUD refs
const stormFill = $('stormFill');
const objLabel = $('objLabel');
const objText = $('objText');
const objReplay = $('objReplay');
const objSub = $('objSub');
const objSubText = $('objSubText');
const objSubReplay = $('objSubReplay');
const roomVal = $('roomVal');
const roomNameEl = $('roomNameEl');
const scoreEl = $('scoreEl');
const starsEl = $('stars');
const statusEl = $('statusEl');
const staminaFill = $('staminaFill');
const dashReady = $('dashReady');
const bossBar = $('bossBar');
const bossFill = $('bossFill');
const bossLabel = $('bossLabel');
const staffAbility = $('staffAbility');
const burstAbility = $('burstAbility');
const shieldAbility = $('shieldAbility');

// Screen refs
const homeScreen = $('homeScreen');
const manualScreen = $('manualScreen');
const briefScreen = $('briefScreen');
const endScreen = $('endScreen');
const upgradeScreen = $('upgradeScreen');
const chooseScreen = $('chooseScreen');
const dialogueScreen = $('dialogueScreen');
const reviewScreen = $('reviewScreen');
const loadingScreen = $('loadingScreen');
const studyScreen = $('studyScreen');
const lessonGrid = $('lessonGrid');
const briefTitle = $('briefTitle');
const briefSub = $('briefSub');
const modeRow = $('modeRow');
const voiceRow = $('voiceRow');
const difficultyRow = $('difficultyRow');

// Canvas
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let DPR = Math.min(
window.devicePixelRatio || 1,
  IS_SLOW ? 1 : (IS_TOUCH ? 1.5 : 2)
);
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  canvas.width = w * DPR; canvas.height = h * DPR;
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 120));
if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);
resize();

// Palette
const COL = {
  void: '#0e0c08', floor: '#18150e', floorDark: '#12100a',
  sand: '#1f1a10', rock: '#2a2418', rockHi: '#3d3524',
  border: '#3a3020', borderBr: '#6a5a3d',
  khaki: '#8a7a5a', khakiBr: '#c9b88a',
  text: '#e8dfc8', gold: '#d4af37',
  danger: '#8a3a3a', shield: '#7ab8c9',
  orb: '#1a0810', orbRing: '#5a2a3a', orbEye: '#d46a4a',
  charger: '#2a1a08', chargerRing: '#7a4a1a', chargerEye: '#f5a04a',
  splitter: '#1a0820', splitterRing: '#5a2a6a', splitterEye: '#b86ae0',
  boss: '#3a0808', bossRing: '#8a2020', bossEye: '#f5a04a',
  projectile: '#6a1414',
  storm: '#1a1408', stormEdge: '#8a6a3d',
};

// Helpers
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const nowMs = () => performance.now();
const comboMult = () => 1 + Math.min(4, Math.floor(G.combo / 3));

const ROOM_PATTERN = [
  {
    type: 'combat',
    name: 'The Dust Road',
    gates: 3, storm: 6, obs: 4, weather: 'dust',
    orbs: [{ type: 'drifter', count: 1 }],
  },
  {
    type: 'combat',
    name: 'Broken Ruins',
    gates: 4, storm: 9, obs: 5, weather: 'storm',
    orbs: [
      { type: 'drifter', count: 2 },
      { type: 'charger', count: 1 },
    ],
  },
  {
    type: 'combat',
    name: 'The Long Passage',
    gates: 5, storm: 14, obs: 5, weather: 'storm',
    orbs: [
      { type: 'drifter', count: 3 },
      { type: 'charger', count: 1 },
      { type: 'splitter', count: 1 },
    ],
  },
  {
    type: 'combat',
    name: 'The Silent Stones',
    gates: 5, storm: 16, obs: 6, weather: 'storm',
    orbs: [
      { type: 'drifter', count: 3 },
      { type: 'charger', count: 2 },
      { type: 'splitter', count: 1 },
    ],
  },
  {
    type: 'combat',
    name: 'The Long Watch',
    gates: 6, storm: 18, obs: 6, weather: 'storm',
    orbs: [
      { type: 'drifter', count: 4 },
      { type: 'charger', count: 2 },
      { type: 'splitter', count: 2 },
    ],
  },
  {
    type: 'combat',
    name: 'An Empty Shrine',
    gates: 6, storm: 20, obs: 6, weather: 'storm',
    orbs: [
      { type: 'drifter', count: 4 },
      { type: 'charger', count: 2 },
      { type: 'splitter', count: 2 },
    ],
  },
  {
    type: 'boss',
    name: 'The Shadow Throne',
    gates: 4, storm: 0, obs: 3, weather: 'clear',
    orbs: [],
    bossHp: 6,
  },
];

const EXPLORE_NAMES = ['The Dry Well', 'Fallen Pillars', 'A Broken Cart', 'An Empty Shrine', 'The Silent Stones', 'The Long Watch'];

const DISCOVERIES_PER_ROOM = 3;
const DISCOVERY_RANGE = 70;
const DISCOVERY_TAP_RADIUS = 64;
const ORB_RESPAWN_MS = 2000;

// Difficulty
const DIFFICULTY = {
  easy:   { gateMul: 0.75, stormMul: 0.55, orbMul: 0.6, bossMul: 0.7 },
  normal: { gateMul: 1.0,  stormMul: 1.0,  orbMul: 1.0, bossMul: 1.0 },
  hard:   { gateMul: 1.25, stormMul: 1.5,  orbMul: 1.5, bossMul: 1.3 },
};

// Extra tilt applied on top of the player's chosen difficulty when playing
// with thumbs. Touch input is less precise, so we lean toward reading and
// away from reflex.
const TOUCH_MODIFIERS = { gateMul: 1.0, stormMul: 0.80, orbMul: 0.60, bossMul: 0.90 };

// Player tuning
const PLAYER_WALK = 200, PLAYER_SPRINT = 320, PLAYER_ACCEL = 2000, PLAYER_FRICTION = 15;
const DASH_SPEED = 720, DASH_DURATION = 150, DASH_COOLDOWN = 1200, DASH_COST = 34;
const SPRINT_DRAIN = 42, STAMINA_REGEN = 22;
const STAFF_COOLDOWN = 400, STAFF_ACTIVE = 200, STAFF_RANGE = 72, STAFF_ARC = Math.PI * 0.72;
const BURST_COOLDOWN = 7000, BURST_COST = 40, BURST_RADIUS = 85;

// Touch
const JOY_MAX_R = 52;
const JOY_DEAD = 0.18;
const JOY_SPRINT = 0.80;
const AUTO_STAFF_REACH = 0.85;   // fraction of staff reach that triggers an auto-swing
const GATE_PAD_TOUCH = 14;       // hit-test forgiveness on gates for thumbs

// Harakat (vowel mark) handling for the reading modes.
const HARAKAT = /[\u064B-\u065F\u0670\u06D6-\u06ED]/g;
const HARAKAT_TIGHT = /[\u064B-\u065F\u0670]/;

function stripHarakat(text) {
  return String(text || '').replace(HARAKAT, '');
}

function keepLastHaraka(text) {
  const s = String(text || '');
  let lastIdx = -1;
  for (let i = 0; i < s.length; i++) {
    if (HARAKAT_TIGHT.test(s[i])) lastIdx = i;
  }
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (!HARAKAT_TIGHT.test(s[i])) out += s[i];
    else if (i === lastIdx) out += s[i];
  }
  return out;
}

function renderAr(phrase, contextPhrases, mode) {
  const ar = phrase.ar || '';
  if (mode === 'full') return ar;
  const bare = stripHarakat(ar);
  if (mode === 'bare') return bare;
  const collides = (contextPhrases || []).some(p =>
    p !== phrase && stripHarakat(p.ar || '') === bare
  );
  return collides ? keepLastHaraka(ar) : bare;
}
