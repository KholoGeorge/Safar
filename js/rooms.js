function makeRoom(i) {
  const lesson = G.currentLesson;
  const rng = G.rng;
  const D = DIFFICULTY[G.difficulty] || DIFFICULTY.normal;

  const weighted = [];
  for (const it of lesson) {
    const copies = G.daily ? 1 : 1 + Math.min(3, G.misses[it.ar] || 0);
    for (let c = 0; c < copies; c++) weighted.push(it);
  }
  const shuffled = shuffle(weighted, rng);

  let count, storm, obs, orbCfg, isBoss, bossHp = 6, name;
  if (i < 5) {
    count = ROOM_GATE_COUNT[i]; storm = ROOM_STORM_SPEED[i];
    obs = ROOM_OBSTACLE_COUNT[i]; orbCfg = ROOM_ORB_CONFIG[i];
    isBoss = i === 4; name = ROOM_NAMES[i];
  } else {
    const k = i - 4;
    isBoss = (i + 1) % 5 === 0;
    if (isBoss) {
      count = 4; storm = 0; obs = 3;
      orbCfg = [{ type: 'drifter', count: Math.min(4, 2 + Math.floor(k / 5)) }];
      bossHp = 6 + Math.floor((i - 4) / 5) * 3;
      name = 'Shadow Throne ×' + Math.floor((i + 1) / 5);
    } else {
      count = 3 + (i % 3);
      storm = Math.min(42, 23 + k * 2.2);
      obs = 4 + (i % 4);
      orbCfg = [
        { type: 'drifter', count: Math.min(5, 2 + Math.floor(k / 2)) },
        { type: 'charger', count: Math.min(4, 1 + Math.floor(k / 2)) },
        { type: 'splitter', count: Math.min(3, Math.floor((k + 1) / 2)) },
      ].filter(c => c.count > 0);
      name = 'Endless ' + (i + 1);
    }
  }

  count = Math.max(2, Math.round(count * D.gateMul));
  if (storm > 0) storm = Math.max(4, Math.round(storm * D.stormMul));
  orbCfg = orbCfg.map(c => ({ type: c.type, count: Math.max(1, Math.round(c.count * D.orbMul)) }));
  bossHp = Math.max(3, Math.round(bossHp * D.bossMul));

  const gates = [];
  const usedAr = new Set();
  let cursor = 0;
  while (gates.length < count) {
    const item = shuffled[cursor % shuffled.length];
    cursor++;
    if (usedAr.has(item.ar)) { if (cursor > shuffled.length * 4) break; continue; }
    usedAr.add(item.ar);
    gates.push(item);
  }
  return { gates, stormSpeed: storm, obstacleCount: obs, orbConfig: orbCfg, isBoss, bossHp, name };
}

function buildRun() {
  G.rng = G.daily ? mulberry32(dayNum() * 7919 + 13) : Math.random;
  const rooms = [];
  for (let i = 0; i < 5; i++) rooms.push(makeRoom(i));
  return rooms;
}

function enterRoom(idx) {
  while (G.rooms.length <= idx) G.rooms.push(makeRoom(G.rooms.length));
  const w = window.innerWidth, h = window.innerHeight;
  const playW = Math.min(w - 20, h * 0.6);
  const px0 = (w - playW) / 2;
  G.bounds = { l: px0 + 20, t: 118, r: px0 + playW - 20, b: h - 78 };
  const room = G.rooms[idx];
  const { l, t, r, b } = G.bounds;

  G.player = { x: (l + r) / 2, y: b - 90, vx: 0, vy: 0, angle: -Math.PI / 2, radius: 14, walkPhase: 0 };
  G.stamina = G.maxStamina;
  G.dashing = false; G.dashUntil = 0; G.dashCooldownUntil = 0;
  G.stunUntil = 0; G.invulnUntil = 0;
  G.staffCooldownUntil = 0; G.burstCooldownUntil = 0;
  G.tension = 0; G.heartTimer = 0;
  G.lastWrong = null; updateLastWrongPanel();

  const count = room.gates.length;
  const margin = 60;
  const usable = (b - t) - margin * 2;
  const spacing = count > 1 ? usable / (count - 1) : 0;
  const startY = t + margin;

  G.gates = room.gates.map((item, i) => {
    const isLeft = (i % 2) === 1;
    const gx = isLeft ? l + 44 : r - 44;
    return {
      x: gx, y: startY + i * spacing,
      w: 88, h: 56, isLeft,
      item, done: false, isTarget: false, wobble: 0,
      correctFlashUntil: 0, wrongFlashUntil: 0,
    };
  });

  G.obstacles = [];
  let tries = 0;
  while (G.obstacles.length < room.obstacleCount && tries < 200) {
    tries++;
    const ox = rand(l + 60, r - 60);
    const oy = rand(t + 40, b - 80);
    const oradius = rand(22, 38);
    if (dist(ox, oy, G.player.x, G.player.y) < oradius + 80) continue;
    let blocked = false;
    for (const g of G.gates) if (dist(ox, oy, g.x, g.y) < oradius + 70) { blocked = true; break; }
    if (blocked) continue;
    for (const o of G.obstacles) if (dist(ox, oy, o.x, o.y) < oradius + o.r + 20) { blocked = true; break; }
    if (blocked) continue;
    G.obstacles.push({ x: ox, y: oy, r: oradius, variant: Math.floor(Math.random() * 3) });
  }

  G.pickups = [];

  G.orbs = [];
  G.boss = null;
  for (const config of room.orbConfig) {
    for (let i = 0; i < config.count; i++) spawnOrb(config.type, idx);
  }
  let carried = 0;
  const maxCarry = idx === 0 ? 1 : 2;
  for (const o of G.orbs) {
    if (o.type === 'drifter' && carried < maxCarry) { o.carry = true; carried++; }
  }
  if (room.isBoss) spawnBoss(room.bossHp);

  G.stormY = b + 260;
  G.stormSpeed = room.stormSpeed;
  G.projectiles = [];

  G.dust = [];
  for (let i = 0; i < 70; i++) {
    G.dust.push({ x: rand(l, r), y: rand(t, b), vx: rand(-10, 30), vy: rand(-8, 8), size: rand(0.8, 2.2), alpha: rand(0.15, 0.5) });
  }
  G.footprints = []; G.particles = []; G.rings = []; G.floatingText = [];

  pickTarget();
  roomVal.textContent = `${idx + 1} / ${G.endless ? '∞' : G.rooms.length}`;
  roomNameEl.textContent = room.name;
  updateStars();
  bossBar.classList.toggle('show', room.isBoss);
  if (room.isBoss) {
    bossLabel.textContent = room.name.toUpperCase();
    bossFill.style.width = '100%';
  }
  S.roomEnter();
  setStatus(room.name, 'Read the target. Fight if you must.', '', 2500);
}

let orbIdSeq = 0;

function randomOrbPos(radius, minPlayerDist = 240) {
  const { l, t, r, b } = G.bounds;
  const p = G.player;
  let x = (l + r) / 2;
  let y = (t + b) / 2;
  for (let i = 0; i < 60; i++) {
    x = rand(l + 50, r - 50);
    y = rand(t + 80, b - 60);
    if (p && dist(x, y, p.x, p.y) < minPlayerDist) continue;
    let blocked = false;
    for (const o of G.obstacles) {
      if (dist(x, y, o.x, o.y) < o.r + radius + 14) { blocked = true; break; }
    }
    if (blocked) continue;
    return { x, y };
  }
  return { x, y };
}

function spawnOrb(type, idx) {
  const k = Math.min(idx, 12);
  const stats = {
    drifter:  { r: 17, hp: 1, speed: 78 + k * 6, color: COL.orb,      ring: COL.orbRing,      eye: COL.orbEye,      eyes: 1 },
    charger:  { r: 14, hp: 1, speed: 90,          color: COL.charger,  ring: COL.chargerRing,  eye: COL.chargerEye,  eyes: 2 },
    splitter: { r: 22, hp: 2, speed: 58 + k * 4,  color: COL.splitter, ring: COL.splitterRing, eye: COL.splitterEye, eyes: 3 },
  }[type];
  const { x, y } = randomOrbPos(stats.r, 240);
  G.orbs.push({
    id: ++orbIdSeq, type, x, y, vx: 0, vy: 0,
    r: stats.r, hp: stats.hp, maxHp: stats.hp, speed: stats.speed,
    color: stats.color, ring: stats.ring, eye: stats.eye, eyes: stats.eyes,
    dead: false, stunUntil: 0, hitFlashUntil: 0,
    bob: Math.random() * Math.PI * 2,
    chargeState: 'idle', chargeAt: 0, chargeVx: 0, chargeVy: 0,
    splitDone: false, spawnFlash: 1,
    respawnAt: 0, noRespawn: false, parent: 0,
    carry: false, wordItem: null, wordTrue: false,
  });
}

function spawnBoss(hp = 6) {
  const { l, t, r, b } = G.bounds;
  const x = l + (r - l) * 0.7;
  const y = (t + b) / 2;
  G.boss = {
    x, y, vx: 0, vy: 0, r: 44, hp, maxHp: hp, speed: 48,
    stunUntil: 0, hitFlashUntil: 0,
    nextAction: nowMs() + 3000, spawnFlash: 1, bob: 0, dead: false,
  };
}

function assignOrbWord(o) {
  const tg = G.targetGate;
  if (!o.carry || !tg) { o.wordItem = null; o.wordTrue = false; return; }
  const others = G.currentLesson.filter(x => x.ar !== tg.item.ar);
  if (Math.random() < 0.4 || !others.length) { o.wordItem = tg.item; o.wordTrue = true; }
  else { o.wordItem = others[Math.floor(Math.random() * others.length)]; o.wordTrue = false; }
}
function assignOrbWords() { for (const o of G.orbs) assignOrbWord(o); }

function pickTarget() {
  const available = G.gates.filter(g => !g.done);
  if (!available.length) { G.targetGate = null; assignOrbWords(); return; }
  const g = available[Math.floor(Math.random() * available.length)];
  for (const x of G.gates) x.isTarget = false;
  g.isTarget = true;
  G.targetGate = g;
  G.targetShownAt = nowMs();
  objLabel.textContent = 'Find';
  if (G.mode === 'en-ar') {
    objText.textContent = g.item.en;
    objText.classList.remove('arabic');
  } else {
    objText.textContent = g.item.ar;
    objText.classList.add('arabic');
  }
  speakAr(g.item);
  G.lastWrong = null;
  updateLastWrongPanel();
  G.bossRespawnAt = 0;
  G.bossKilledThisRoom = false;
  assignOrbWords();
}

function updateStars() {
  let html = '';
  for (let i = 0; i < 3; i++) html += `<div class="star ${i < G.stars ? '' : 'lost'}"></div>`;
  starsEl.innerHTML = html;
}

const UPGRADES = [
  { n: 'Swift Sandals',  d: '+15% move speed',               f: () => { G.up.speed *= 1.15; } },
  { n: 'Deep Lungs',     d: '+25 max stamina, faster regen', f: () => { G.maxStamina += 25; G.up.regen *= 1.25; } },
  { n: 'Long Staff',     d: '+30% staff reach',              f: () => { G.up.range *= 1.3; } },
  { n: 'Quick Light',    d: 'Burst cooldown -35%',           f: () => { G.up.burstCd *= 0.65; } },
  { n: 'Storm Ward',     d: 'Storm moves 25% slower',        f: () => { G.up.storm *= 0.75; } },
  { n: 'Lantern Heart',  d: 'Restore 1 condition',           f: () => { G.stars = Math.min(3, G.stars + 1); updateStars(); }, ok: () => G.stars < 3 },
  { n: 'Veil of Dust',   d: 'Gain a shield for the next hit', f: () => { G.shield = true; S.shieldUp(); } },
];

function offerUpgrade(done) {
  pauseOn();
  const grid = $('upgradeGrid'); grid.innerHTML = '';
  const pool = UPGRADES.filter(u => !u.ok || u.ok());
  shuffle(pool, Math.random).slice(0, 3).forEach(u => {
    const c = document.createElement('div');
    c.className = 'lesson-card';
    c.innerHTML = `<div class="name">${u.n}</div><div class="meta">${u.d}</div>`;
    c.onclick = () => {
      u.f(); S.boon();
      upgradeScreen.classList.remove('show');
      pauseOff();
      done();
    };
    grid.appendChild(c);
  });
  upgradeScreen.classList.add('show');
}

function offerChoice() {
  pauseOn();
  chooseScreen.classList.add('show');
}
