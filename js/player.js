function absorbHit() {
  if (!G.shield) return false;
  G.shield = false;
  const p = G.player;
  S.shieldBreak();
  if (p) { spawnRing(p.x, p.y, COL.shield, 70, 0.4); spawnParticles(p.x, p.y, COL.shield, 18, 1); }
  flash(COL.shield, 0.2, 200);
  setStatus('Shield broke', '', 'ok', 900);
  return true;
}

function updatePlayer(dt) {
  const p = G.player;
  if (!p) return;
  const now = nowMs();
  const stunned = now < G.stunUntil;
  const dashing = G.dashing && now < G.dashUntil;
  const K = G.keys;

  let ax = 0, ay = 0;
  if (!stunned && !dashing) {
    if (K.up)    ay -= 1;
    if (K.down)  ay += 1;
    if (K.left)  ax -= 1;
    if (K.right) ax += 1;
  }
  const len = Math.hypot(ax, ay);
  const sprinting = K.sprint && G.stamina > 5 && len > 0 && !dashing && !stunned;

  if (len > 0) {
    ax /= len; ay /= len;
    p.angle = Math.atan2(ay, ax);
    p.vx += ax * PLAYER_ACCEL * dt;
    p.vy += ay * PLAYER_ACCEL * dt;
  }
  p.vx -= p.vx * PLAYER_FRICTION * dt;
  p.vy -= p.vy * PLAYER_FRICTION * dt;

  const baseSpeed = dashing ? DASH_SPEED : (sprinting ? PLAYER_SPRINT : PLAYER_WALK);
  const maxSpeed = baseSpeed * (dashing ? 1 : G.up.speed);
  const sp = Math.hypot(p.vx, p.vy);
  if (sp > maxSpeed) { p.vx = p.vx / sp * maxSpeed; p.vy = p.vy / sp * maxSpeed; }

  if (dashing) {}
  else if (sprinting) G.stamina = Math.max(0, G.stamina - SPRINT_DRAIN * dt);
  else G.stamina = Math.min(G.maxStamina, G.stamina + STAMINA_REGEN * G.up.regen * dt);

  const prevX = p.x, prevY = p.y;
  p.x += p.vx * dt; p.y += p.vy * dt;

  const { l, t, r, b } = G.bounds;
  p.x = clamp(p.x, l + p.radius, r - p.radius);
  p.y = clamp(p.y, t + p.radius, b - p.radius);

  for (const o of G.obstacles) {
    const d = dist(p.x, p.y, o.x, o.y);
    const min = p.radius + o.r;
    if (d < min && d > 0.001) {
      const overlap = min - d;
      const nx = (p.x - o.x) / d, ny = (p.y - o.y) / d;
      p.x += nx * overlap; p.y += ny * overlap;
      const vn = p.vx * nx + p.vy * ny;
      if (vn < 0) { p.vx -= vn * nx; p.vy -= vn * ny; }
    }
  }

  if (sp > 25) p.walkPhase += dt * sp * 0.045;
  else p.walkPhase *= 0.88;

  const moved = dist(p.x, p.y, prevX, prevY);
  if (moved > 1.2) {
    G.footstepTimer -= dt;
    if (G.footstepTimer <= 0 && sp > 60) {
      S.footstep();
      G.footstepTimer = sp > 250 ? 0.22 : 0.32;
    }
    const lastPrint = G.footprints[G.footprints.length - 1];
    if (!lastPrint || dist(p.x, p.y, lastPrint.x, lastPrint.y) > 26) {
      G.footprints.push({ x: p.x, y: p.y, angle: p.angle, life: 4.0, max: 4.0 });
      if (G.footprints.length > 80) G.footprints.shift();
    }
  }

  if (p.y + p.radius >= G.stormY) { playerCaught(); return; }

  for (const pk of G.pickups) {
    if (pk.collected) continue;
    if (dist(p.x, p.y, pk.x, pk.y) < p.radius + pk.r) {
      pk.collected = true;
      G.stamina = Math.min(G.maxStamina, G.stamina + 40);
      G.stormY = Math.min(G.bounds.b + 260, G.stormY + 90);
      S.lantern();
      flash(COL.gold, 0.20, 180);
      shake(6, 150);
      setStatus('Lantern found', 'Storm pushed back', 'ok', 1400);
    }
  }

    if (now >= G.gateCooldownUntil) {
    for (const g of G.gates) {
      if (g.done) continue;
          // Must be inside the gate's rectangle (not just near it)
        if (Math.abs(p.x - g.x) < g.w / 2 &&
        Math.abs(p.y - g.y) < g.h / 2) {
          if (g.isTarget) gateCorrect(g);
          else gateWrong(g);
          break;
        }
      }
    }
}

function tryDash() {
  const now = nowMs();
  if (now < G.dashCooldownUntil) return;
  if (G.stamina < DASH_COST) return;
  if (now < G.stunUntil) return;
  const p = G.player;
  if (!p) return;
  G.dashing = true;
  G.dashUntil = now + DASH_DURATION;
  G.dashCooldownUntil = now + DASH_COOLDOWN;
  G.stamina = Math.max(0, G.stamina - DASH_COST);
  const sp = Math.hypot(p.vx, p.vy);
  let dx, dy;
  if (sp > 30) { dx = p.vx / sp; dy = p.vy / sp; }
  else { dx = Math.cos(p.angle); dy = Math.sin(p.angle); }
  p.vx = dx * DASH_SPEED; p.vy = dy * DASH_SPEED;
  for (let i = 0; i < 6; i++) {
    G.footprints.push({ x: p.x + rand(-3, 3), y: p.y + rand(-3, 3), angle: p.angle, life: 1.2, max: 1.2 });
  }
  flash(COL.khakiBr, 0.08, 100);
}

function tryStaff() {
  const now = nowMs();
  if (now < G.staffCooldownUntil) return;
  if (now < G.stunUntil) return;
  const p = G.player;
  if (!p) return;
  G.staffCooldownUntil = now + STAFF_COOLDOWN;
  p.staffUntil = now + STAFF_ACTIVE;
  S.staff();
  const reach = STAFF_RANGE * G.up.range + p.radius;
  const arc = STAFF_ARC;
  const inArc = (ex, ey, er) => {
    const d = dist(p.x, p.y, ex, ey);
    if (d > reach + er) return false;
    let diff = Math.atan2(ey - p.y, ex - p.x) - p.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return Math.abs(diff) < arc / 2;
  };
  for (const o of G.orbs) if (!o.dead && inArc(o.x, o.y, o.r)) damageOrb(o, 1, 320);
  if (G.boss && !G.boss.dead && inArc(G.boss.x, G.boss.y, G.boss.r)) damageBoss(1);
}

function tryBurst() {
  const now = nowMs();
  if (now < G.burstCooldownUntil) return;
  if (G.stamina < BURST_COST) { S.wrong(); return; }
  if (now < G.stunUntil) return;
  const p = G.player;
  if (!p) return;
  G.burstCooldownUntil = now + BURST_COOLDOWN * G.up.burstCd;
  G.stamina = Math.max(0, G.stamina - BURST_COST);
  S.burst();
  flash(COL.gold, 0.30, 260);
  shake(14, 280);
  spawnRing(p.x, p.y, COL.gold, BURST_RADIUS, 0.5);
  spawnRing(p.x, p.y, COL.khakiBr, BURST_RADIUS * 0.7, 0.4);
  spawnParticles(p.x, p.y, COL.gold, 28, 1.4);
  spawnParticles(p.x, p.y, COL.khakiBr, 20, 1.0);
  for (const o of G.orbs) if (!o.dead && dist(p.x, p.y, o.x, o.y) < BURST_RADIUS + o.r) damageOrb(o, 2, 520);
  if (G.boss && !G.boss.dead && dist(p.x, p.y, G.boss.x, G.boss.y) < BURST_RADIUS + G.boss.r) {
    damageBoss(2);
    const d = dist(p.x, p.y, G.boss.x, G.boss.y) || 1;
    G.boss.vx = (G.boss.x - p.x) / d * 300;
    G.boss.vy = (G.boss.y - p.y) / d * 300;
    G.boss.stunUntil = now + 500;
  }
  for (const pr of G.projectiles) if (dist(p.x, p.y, pr.x, pr.y) < BURST_RADIUS) pr.life = 0;
  G.stormY = Math.min(G.bounds.b + 260, G.stormY + 40);
}

function damageOrb(o, dmg, knockback) {
  o.hp -= dmg;
  o.hitFlashUntil = nowMs() + 200;
  if (o.hp <= 0) {
    o.dead = true;
    G.kills++;
    G.score += 10 * comboMult();
    if (!o.noRespawn) o.respawnAt = nowMs() + ORB_RESPAWN_MS;
    S.orbDeath();
    spawnParticles(o.x, o.y, COL.gold, 22, 1.2);
    spawnRing(o.x, o.y, COL.gold, 90, 0.35);
    shake(7, 160);
    hitstop(55);
    if (o.wordItem) {
      if (o.wordTrue) {
        G.shield = true; S.shieldUp();
        spawnFloatText(o.x, o.y - 30, 'SHIELD', COL.shield, 1.2, 22);
        spawnRing(o.x, o.y, COL.shield, 110, 0.5);
      } else {
        const bonus = 150 * comboMult();
        G.score += bonus;
        spawnFloatText(o.x, o.y - 30, 'DECOY +' + bonus, COL.gold, 1.2, 22);
      }
      o.wordItem = null;
    }
    if (o.type === 'splitter' && !o.splitDone) {
      o.splitDone = true;
      for (let i = 0; i < 2; i++) {
        const a = Math.random() * Math.PI * 2;
        spawnSplitChild(o.x + Math.cos(a) * 24, o.y + Math.sin(a) * 24, o.id);
      }
    }
    if (Math.random() < 0.3) G.pickups.push({ x: o.x, y: o.y, r: 12, collected: false, bob: 0 });
  } else {
    S.hit();
    const d = dist(o.x, o.y, G.player.x, G.player.y) || 1;
    o.vx = (o.x - G.player.x) / d * knockback;
    o.vy = (o.y - G.player.y) / d * knockback;
    o.stunUntil = nowMs() + 300;
    hitstop(45);
    shake(5, 120);
    spawnParticles(o.x, o.y, o.eye, 10, 0.8);
  }
}

function respawnOrb(o) {
  if (o.type === 'splitter') {
    for (const c of G.orbs) {
      if (c.parent === o.id && !c.dead) {
        c.dead = true; c.noRespawn = true; c.respawnAt = 0;
        spawnParticles(c.x, c.y, c.ring, 8, 0.6);
      }
    }
  }
  const { x, y } = randomOrbPos(o.r, 280);
  o.x = x; o.y = y;
  o.vx = 0; o.vy = 0;
  o.hp = o.maxHp;
  o.dead = false; o.respawnAt = 0; o.hitFlashUntil = 0;
  o.spawnFlash = 1; o.stunUntil = nowMs() + 200;
  o.bob = Math.random() * Math.PI * 2;
  o.chargeState = 'idle'; o.chargeAt = nowMs();
  o.chargeVx = 0; o.chargeVy = 0;
  o.splitDone = false;
  assignOrbWord(o);
  spawnRing(o.x, o.y, o.ring, 80, 0.4);
  spawnParticles(o.x, o.y, o.ring, 12, 0.8);
  S.orbSpawn();
}

function spawnSplitChild(x, y, parentId) {
  G.orbs.push({
    id: ++orbIdSeq, parent: parentId || 0, noRespawn: true,
    type: 'drifter', x, y, vx: 0, vy: 0,
    r: 12, hp: 1, maxHp: 1, speed: 85,
    color: COL.splitter, ring: COL.splitterRing, eye: COL.splitterEye, eyes: 1,
    dead: false, stunUntil: 0, hitFlashUntil: 0,
    bob: Math.random() * Math.PI * 2,
    chargeState: 'idle', chargeAt: 0, chargeVx: 0, chargeVy: 0,
    splitDone: false, spawnFlash: 1, respawnAt: 0,
    carry: false, wordItem: null, wordTrue: false,
  });
}

function damageBoss(dmg) {
  if (!G.boss || G.boss.dead) return;
  G.boss.hp -= dmg;
  G.boss.hitFlashUntil = nowMs() + 250;
  bossFill.style.width = Math.max(0, G.boss.hp / G.boss.maxHp * 100) + '%';
  S.bossHit();
  shake(18, 300); hitstop(80);
  spawnParticles(G.boss.x, G.boss.y, COL.bossEye, 20, 1.2);
  spawnRing(G.boss.x, G.boss.y, COL.bossRing, 120, 0.4);
  if (G.boss.hp <= 0) {
    G.boss.dead = true; G.bossDefeated = true;
    G.score += 1000;
    spawnFloatText(G.boss.x, G.boss.y - 60, '+1000', COL.gold, 1.6, 32);
    S.bossDeath();
    shake(30, 800);
    flash(COL.bossRing, 0.5, 500);
    spawnParticles(G.boss.x, G.boss.y, COL.bossEye, 60, 2.0);
    spawnParticles(G.boss.x, G.boss.y, COL.gold, 40, 1.5);
    spawnRing(G.boss.x, G.boss.y, COL.gold, 300, 0.9);
    spawnRing(G.boss.x, G.boss.y, COL.bossRing, 400, 1.1);
    for (let i = 0; i < 3; i++) {
      const a = Math.random() * Math.PI * 2;
      G.pickups.push({ x: G.boss.x + Math.cos(a) * 60, y: G.boss.y + Math.sin(a) * 60, r: 12, collected: false, bob: 0 });
    }
    setStatus('The throne falls', 'Clear the gates to ascend', 'ok', 3000);
  }
}

function gateCorrect(g) {
  g.done = true;
  g.correctFlashUntil = nowMs() + 600;
  G.correct++;
  G.combo++; G.bestCombo = Math.max(G.bestCombo, G.combo);
  const speedBonus = Math.max(0, 100 - Math.floor((nowMs() - G.targetShownAt) / 100));
  const pts = (100 + speedBonus) * comboMult();
  G.score += pts;
  spawnFloatText(g.x - 60, g.y - 70, '+' + pts, COL.gold);
  if (G.combo >= 3) spawnFloatText(G.player.x, G.player.y - 40, 'x' + comboMult() + ' COMBO', COL.khakiBr, 1.0, 20);
  if (G.misses[g.item.ar]) { G.misses[g.item.ar]--; if (G.misses[g.item.ar] <= 0) delete G.misses[g.item.ar]; saveMisses(); }
  S.correct(G.combo);
  speakAr(g.item);
  flash(COL.gold, 0.18, 180);
  shake(7, 180);
  spawnParticles(g.x, g.y, COL.gold, 20, 1.2);
  setStatus('Correct', 'Continue north', 'ok', 1500);
  const p = G.player;
  p.vx = 0; p.vy = 0;
  if (G.gates.filter(x => !x.done).length > 0) pickTarget();
  else { G.targetGate = null; assignOrbWords(); }
}

function gateWrong(g) {
  g.wobble = 1;
  g.wrongFlashUntil = nowMs() + 900;
  G.wrong++;
  G.combo = 0;
  const tgt = G.targetGate && G.targetGate.item;
  if (tgt) { G.misses[tgt.ar] = (G.misses[tgt.ar] || 0) + 1; saveMisses(); }
  G.lastWrong = { item: g.item, at: nowMs() };
  updateLastWrongPanel();
  S.wrong();
  flash(COL.danger, 0.32, 220);
  shake(16, 300);

  const p = G.player;
  const { l, r } = G.bounds;

  // Push DOWN (toward the storm) and AWAY from the wall
  p.vy = 240;
  if (g.isLeft) {
    p.vx = 320;
    p.x = Math.max(p.x, l + 100);   // clear the gate's right edge
  } else {
    p.vx = -320;
    p.x = Math.min(p.x, r - 100);   // clear the gate's left edge
  }

  // Grace window so you can actually walk away
  G.gateCooldownUntil = nowMs() + 900;

  if (absorbHit()) { setStatus('Shield took it', 'Fall back', 'ok', 1400); return; }
  G.stars--;
  updateStars();
  setStatus('Wrong gate', 'Fall back', 'warn', 1400);
  if (G.stars <= 0) endRun(false);
}

function playerCaught() {
  G.stars = 0;
  updateStars();
  setStatus('The storm', '', 'warn', 1500);
  flash(COL.danger, 0.42, 320);
  shake(24, 400);
  endRun(false);
}
