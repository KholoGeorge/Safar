function roomTypeFor(i) {
  if (i < ROOM_PATTERN.length) return ROOM_PATTERN[i].type;
  const k = i - ROOM_PATTERN.length + 1;
  if (k % 5 === 0) return 'boss';
  return (k % 2 === 1) ? 'combat' : 'explore';
}

function makeRoom(i) {
  const type = roomTypeFor(i);
  const D = DIFFICULTY[G.difficulty] || DIFFICULTY.normal;
  const T = IS_TOUCH ? TOUCH_MODIFIERS : { gateMul: 1, stormMul: 1, orbMul: 1, bossMul: 1 };
  const M = {
    gateMul:  D.gateMul  * T.gateMul,
    stormMul: D.stormMul * T.stormMul,
    orbMul:   D.orbMul   * T.orbMul,
    bossMul:  D.bossMul  * T.bossMul,
  };

  if (type === 'explore') {
    let n = 0;
    for (let j = 0; j < i; j++) if (roomTypeFor(j) === 'explore') n++;
    return {
      type: 'explore',
      name: EXPLORE_NAMES[n % EXPLORE_NAMES.length],
      gates: [], stormSpeed: 0, obstacleCount: 3, orbConfig: [], isBoss: false, bossHp: 0,
    };
  }

  let base;
  if (i < ROOM_PATTERN.length) {
    base = ROOM_PATTERN[i];
  } else {
    const k = i - ROOM_PATTERN.length;
    const isBoss = (k + 1) % 5 === 0;
    if (isBoss) {
      base = {
        type: 'boss',
        name: 'Shadow Throne ×' + Math.floor((k + 1) / 5 + 1),
        gates: 4, storm: 0, obs: 3,
        orbs: [{ type: 'drifter', count: Math.min(4, 2 + Math.floor(k / 5)) }],
        bossHp: 6 + Math.floor(k / 5) * 3,
      };
    } else {
      base = {
        type: 'combat',
        name: 'Endless ' + (i + 1),
        gates: 3 + (i % 3),
        storm: Math.min(42, 21 + k * 2.2),
        obs: 4 + (i % 4),
        orbs: [
          { type: 'drifter', count: Math.min(5, 2 + Math.floor(k / 2)) },
          { type: 'charger', count: Math.min(4, 1 + Math.floor(k / 2)) },
          { type: 'splitter', count: Math.min(3, Math.floor((k + 1) / 2)) },
        ],
      };
    }
  }

  const lesson = G.currentLesson;
  const rng = G.rng;
  const weighted = [];
  for (const it of lesson) {
    const copies = G.daily ? 1 : 1 + Math.min(3, G.misses[it.ar] || 0);
    for (let c = 0; c < copies; c++) weighted.push(it);
  }
  const shuffled = shuffle(weighted, rng);

  const count = Math.max(2, Math.round(base.gates * M.gateMul));
  const storm = base.storm > 0 ? Math.max(4, Math.round(base.storm * M.stormMul)) : 0;
  const orbCfg = base.orbs.map(c => ({ type: c.type, count: Math.max(1, Math.round(c.count * M.orbMul)) }));
  const bossHp = base.bossHp ? Math.max(3, Math.round(base.bossHp * M.bossMul)) : 0;

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

  return {
    type: base.type,
    gates, stormSpeed: storm, obstacleCount: base.obs,
    orbConfig: orbCfg, isBoss: base.type === 'boss',
    bossHp, name: base.name,
  };
}

function buildRun() {
  G.rng = G.daily ? mulberry32(dayNum() * 7919 + 13) : Math.random;
  const rooms = [];
  for (let i = 0; i < ROOM_PATTERN.length; i++) rooms.push(makeRoom(i));
  return rooms;
}

function enterRoom(idx) {
  while (G.rooms.length <= idx) G.rooms.push(makeRoom(G.rooms.length));

  const w = window.innerWidth, h = window.innerHeight;
  const topPad = IS_TOUCH ? Math.min(140, Math.round(h * 0.18)) : 118;
  const botPad = IS_TOUCH ? Math.min(120, Math.round(h * 0.18)) : 78;
  const playW = Math.min(w - 40, h * 0.6);
  const px0 = (w - playW) / 2;
  G.bounds = { l: px0 + 20, t: topPad, r: px0 + playW - 20, b: h - botPad };

  const room = G.rooms[idx];
  const { l, t, r, b } = G.bounds;

  G.player = { x: (l + r) / 2, y: b - 90, vx: 0, vy: 0, angle: -Math.PI / 2, radius: 14, walkPhase: 0 };
  G.stamina = G.maxStamina;
  G.dashing = false; G.dashUntil = 0; G.dashCooldownUntil = 0;
  G.stunUntil = 0; G.invulnUntil = 0;
  G.staffCooldownUntil = 0; G.burstCooldownUntil = 0;
  G.tension = 0; G.heartTimer = 0;

  G.lastWrong = null;
  updateLastWrongPanel();
  G.roomPhrases = [];
  G.bossRespawnAt = 0;
  G.bossKilledThisRoom = false;
  G.inWrongGate = null;
  G.inWrongSince = 0;
  G.gateCooldownUntil = 0;

  // Clear any leftover hint
  const hintEl = document.getElementById('objHint');
  if (hintEl) { hintEl.textContent = ''; hintEl.style.display = 'none'; }

  G.roomType = room.type || 'combat';
  G.discoveries = [];
  G.discoveryNear = null;
  G.discoveryOpen = null;

  if (G.roomType === 'explore') {
    G.gates = [];
    G.obstacles = [];
    G.pickups = [];
    G.orbs = [];
    G.boss = null;
    G.projectiles = [];
    G.stormY = G.bounds.b + 1000;
    G.stormSpeed = 0;
    G.dust = [];
    for (let i = 0; i < 70; i++) {
      G.dust.push({ x: rand(l, r), y: rand(t, b), vx: rand(-10, 30), vy: rand(-8, 8), size: rand(0.8, 2.2), alpha: rand(0.15, 0.5) });
    }
    G.footprints = []; G.particles = []; G.rings = []; G.floatingText = [];

    let tries = 0;
    while (G.obstacles.length < room.obstacleCount && tries < 100) {
      tries++;
      const ox = rand(l + 60, r - 60);
      const oy = rand(t + 60, b - 100);
      const oradius = rand(20, 36);
      if (dist(ox, oy, G.player.x, G.player.y) < oradius + 90) continue;
      let blocked = false;
      for (const o of G.obstacles) if (dist(ox, oy, o.x, o.y) < oradius + o.r + 20) { blocked = true; break; }
      if (blocked) continue;
      G.obstacles.push({ x: ox, y: oy, r: oradius, variant: Math.floor(Math.random() * 3) });
    }

    const unseen = G.currentLesson.filter(it => !G.seenThisRun || !G.seenThisRun.has(it.ar));
    const pool = unseen.length >= DISCOVERIES_PER_ROOM ? unseen : G.currentLesson;
    const picks = shuffle(pool, Math.random).slice(0, DISCOVERIES_PER_ROOM);
    for (let i = 0; i < picks.length; i++) {
      let px = 0, py = 0, ok = false;
      for (let tries2 = 0; tries2 < 60 && !ok; tries2++) {
        px = rand(l + 70, r - 70);
        py = rand(t + 90, b - 120);
        if (dist(px, py, G.player.x, G.player.y) < 140) continue;
        let blocked = false;
        for (const o of G.obstacles) if (dist(px, py, o.x, o.y) < o.r + 40) { blocked = true; break; }
        for (const d of G.discoveries) if (dist(px, py, d.x, d.y) < 140) { blocked = true; break; }
        if (blocked) continue;
        ok = true;
      }
      if (!ok) continue;
      G.discoveries.push({
        x: px, y: py,
        phrase: picks[i],
        scene: DISCOVERY_SCENES[Math.floor(Math.random() * DISCOVERY_SCENES.length)],
        found: false,
        bob: Math.random() * Math.PI * 2,
      });
    }

    objLabel.textContent = 'Explore';
    objText.textContent = room.name;
    objText.classList.remove('arabic');

    roomVal.textContent = `${idx + 1} / ${G.endless ? '∞' : G.rooms.length}`;
    roomNameEl.textContent = room.name;
    updateStars();
    bossBar.classList.remove('show');
    S.roomEnter();
    setStatus('Explore', 'Take your time. Nothing hunts you here.', 'ok', 2500);
    return;
  }

  // ---- Combat / Boss ----
  const count = room.gates.length;
  const margin = IS_TOUCH ? 52 : 60;
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
  let x = (l + r) / 2, y = (t + b) / 2;
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

function pickTarget() {
  if (G.roomType === 'explore') return;
  const available = G.gates.filter(g => !g.done);
  const hintEl = document.getElementById('objHint');

  if (!available.length) {
    G.targetGate = null;
    if (hintEl) { hintEl.textContent = ''; hintEl.style.display = 'none'; }
    return;
  }
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
  if (hintEl) {
    if (g.item.hint) {
      hintEl.textContent = g.item.hint;
      hintEl.style.display = 'block';
    } else {
      hintEl.textContent = '';
      hintEl.style.display = 'none';
    }
  }
}

function updateStars() {
  let html = '';
  for (let i = 0; i < 3; i++) html += `<div class="star ${i < G.stars ? '' : 'lost'}"></div>`;
  starsEl.innerHTML = html;
}

function offerChoice() {
  pauseOn();
  chooseScreen.classList.add('show');
}
