const $ = id => document.getElementById(id);

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
const lessonGrid = $('lessonGrid');
const briefTitle = $('briefTitle');
const briefSub = $('briefSub');
const modeRow = $('modeRow');
const voiceRow = $('voiceRow');
const difficultyRow = $('difficultyRow');
const storyRow = $('storyRow');

// Canvas
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let DPR = Math.min(window.devicePixelRatio || 1, 2);
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  canvas.width = w * DPR; canvas.height = h * DPR;
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener('resize', resize); resize();

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

// Room tuning
const ROOM_NAMES = ['The Dust Road', 'The Old Well', 'Broken Ruins', 'The Long Passage', 'The Shadow Throne'];
const ROOM_GATE_COUNT = [3, 4, 4, 5, 4];
const ROOM_STORM_SPEED = [10, 13, 17, 21, 0];
const ROOM_OBSTACLE_COUNT = [4, 6, 7, 5, 3];
const ROOM_ORB_CONFIG = [
  [{ type: 'drifter', count: 2 }],
  [{ type: 'drifter', count: 2 }, { type: 'charger', count: 1 }],
  [{ type: 'drifter', count: 2 }, { type: 'charger', count: 2 }, { type: 'splitter', count: 1 }],
  [{ type: 'drifter', count: 3 }, { type: 'charger', count: 2 }, { type: 'splitter', count: 1 }],
  [{ type: 'drifter', count: 2 }],
];
const ORB_RESPAWN_MS = 2000;

// Difficulty
const DIFFICULTY = {
  easy:   { gateMul: 0.75, stormMul: 0.55, orbMul: 0.6, bossMul: 0.7 },
  normal: { gateMul: 1.0,  stormMul: 1.0,  orbMul: 1.0, bossMul: 1.0 },
  hard:   { gateMul: 1.25, stormMul: 1.5,  orbMul: 1.5, bossMul: 1.3 },
};

// Player tuning
const PLAYER_WALK = 200, PLAYER_SPRINT = 320, PLAYER_ACCEL = 2000, PLAYER_FRICTION = 15;
const DASH_SPEED = 720, DASH_DURATION = 150, DASH_COOLDOWN = 1200, DASH_COST = 34;
const SPRINT_DRAIN = 42, STAMINA_REGEN = 22;
const STAFF_COOLDOWN = 400, STAFF_ACTIVE = 200, STAFF_RANGE = 72, STAFF_ARC = Math.PI * 0.72;
const BURST_COOLDOWN = 3000, BURST_COST = 40, BURST_RADIUS = 85;
