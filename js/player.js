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

  // ---------- INPUT ----------
  // Analog stick takes priority. `analog` is 0..1 and scales both the
  // acceleration rate and the speed cap, so a light push creeps and a full
  // push runs.
  let ax = 0, ay = 0, analog = 1;
  if (!stunned && !dashing) {
    if (G.joy) {
      ax = G.joy.x; ay = G.joy.y; analog = G.joy.m;
    } else {
      if (K.up)    ay -= 1;
      if (K.down)  ay += 1;
      if (K.left)  ax -= 1;
      if (K.right) ax += 1;
    }
  }
  const len = Math.hypot(ax, ay);
  const sprinting = K.sprint && G.stamina > 5 && len > 0 && !dashing && !stunned;

  if (len > 0.001) {
    ax /= len; ay /= len;
    // Keyboard faces movement direction. On touch we leave facing alone and
    // let autoStaff() snap it at swing time.
    if (!G.joy) p.angle = Math.atan2(ay, ax);
    p.vx += ax * PLAYER_ACCEL * dt * analog;
    p.vy += ay * PLAYER_ACCEL * dt * analog;
  }
  p.vx -= p.vx * PLAYER_FRICTION * dt;
  p.vy -= p.vy * PLAYER_FRICTION * dt;

  // ---------- SPEED CAP ----------
  const baseSpeed = dashing ? DASH_SPEED : (sprinting ? PLAYER_SPRINT : PLAYER_WALK);
  // On touch, an analog push below 35% is clamped so creeping is still usable.
  const analogCap = (G.joy && !dashing) ? Math.max(0.35, analog) : 1;
  const maxSpeed = baseSpeed * (dashing ? 1 : G.up.speed) * analogCap;
  const sp = Math.hypot(p.vx, p.vy);
  if (sp > maxSpeed) {
    p.vx = p.vx / sp * maxSpeed;
    p.vy = p.vy / sp * maxSpeed;
  }

  // ---------- STAMINA ----------
  if (dashing) {}
  else if (sprinting) G.stamina = Math.max(0, G.stamina - SPRINT_DRAIN * dt);
  else G.stamina = Math.min(G.maxStamina, G.stamina + STAMINA_REGEN * G.up.regen * dt);

  // ---------- POSITION ----------
  const prevX = p.x, prevY = p.y;
  p.x += p.vx * dt;
  p.y += p.vy * dt;

  const { l, t, r, b } = G.bounds;
  p.x = clamp(p.x, l + p.radius, r - p.radius);
  p.y = clamp(p.y, t + p.radius, b - p.radius);

  // ---------- OBSTACLE COLLISION ----------
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

  // ---------- FOOTPRINTS / FOOTSTEPS ----------
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

  // ---------- STORM ----------
  if (G.stormSpeed > 0 && p.y + p.radius >= G.stormY) {
    playerCaught();
    return;
  }

  // ---------- AUTO-STAFF (touch only) ----------
  if (G.touchMode) autoStaff();

  // ---------- DISCOVERY PROXIMITY ----------
  if (G.roomType === 'explore') {
    let near = null;
    for (const d of G.discoveries) {
      if (d.found) continue;
      if (dist(p.x, p.y, d.x, d.y) < DISCOVERY_RANGE) { near = d; break; }
    }
    G.discoveryNear = near;
    const prompt = document.getElementById('discPrompt');
    if (prompt) prompt.classList.toggle('show', !!near && !G.discoveryOpen);
  }

  // ---------- GATES (dwell mechanic) ----------
  if (G.roomType !== 'explore' && now >= G.gateCooldownUntil) {
    const pad = G.touchMode ? GATE_PAD_TOUCH : 0;
    let inGate = null;
    for (const g of G.gates) {
      if (g.done) continue;
      if (Math.abs(p.x - g.x) < g.w / 2 + pad &&
          Math.abs(p.y - g.y) < g.h / 2 + pad) {
        inGate = g;
        break;
      }
    }
    const WRONG_DWELL_MS = 450;
    if (inGate && inGate.isTarget) {
      gateCorrect(inGate);
      G.inWrongGate = null;
    } else if (inGate && !inGate.isTarget) {
      if (G.inWrongGate === inGate) {
        if (now - G.inWrongSince >= WRONG_DWELL_MS) {
          gateWrong(inGate);
          G.inWrongGate = null;
        }
      } else {
        G.inWrongGate = inGate;
        G.inWrongSince = now;
      }
    } else {
      G.inWrongGate = null;
    }
  } else if (G.roomType !== 'explore') {
    G.inWrongGate = null;
  }
}

// ---- Touch assist: auto-swing at the nearest enemy in reach ----
function autoStaff() {
  if (!G.running || G.paused) return;
  const p = G.player; if (!p) return;
  const now = nowMs();
  if (now < G.staffCooldownUntil) return;
  if (now < G.stunUntil) return;

  const reach = (STAFF_RANGE * G.up.range + p.radius) * AUTO_STAFF_REACH;
  let best = null, bd = Infinity;
  for (const o of G.orbs) {
    if (o.dead) continue;
    const d = dist(p.x, p.y, o.x, o.y) - o.r;
    if (d < bd) { bd = d; best = o; }
  }
  if (G.boss && !G.boss.dead) {
    const d = dist(p.x, p.y, G.boss.x, G.boss.y) - G.boss.r;
    if (d < bd) { bd = d; best = G.boss; }
  }
  if (best && bd < reach) {
    p.angle = Math.atan2(best.y - p.y, best.x - p.x);
    tryStaff();
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
  else if (G.joy) { dx = G.joy.x; dy = G.joy.y; }
  else { dx = Math.cos(p.angle); dy = Math.sin(p.angle); }
  const dl = Math.hypot(dx, dy) || 1;
  dx /= dl; dy /= dl;
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
    if (o.type === 'splitter' && !o.splitDone) {
      o.splitDone = true;
      for (let i = 0; i < 2; i++) {
        const a = Math.random() * Math.PI * 2;
        spawnSplitChild(o.x + Math.cos(a) * 24, o.y + Math.sin(a) * 24, o.id);
      }
    }
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
    const bx = G.boss.x, by = G.boss.y;
    const firstKill = !G.bossKilledThisRoom;
    G.boss = null;
    G.bossRespawnAt = nowMs() + 10000;
    G.bossDefeated = true;
    S.bossDeath();
    shake(30, 800);
    flash(COL.bossRing, 0.5, 500);
    spawnParticles(bx, by, COL.bossEye, 60, 2.0);
    spawnParticles(bx, by, COL.gold, 40, 1.5);
    spawnRing(bx, by, COL.gold, 300, 0.9);
    spawnRing(bx, by, COL.bossRing, 400, 1.1);
    if (firstKill) {
      G.bossKilledThisRoom = true;
      G.score += 1000;
      spawnFloatText(bx, by - 60, '+1000', COL.gold, 1.6, 32);
      setStatus('The throne falls', 'Clear the gates to ascend', 'ok', 3000);
    } else {
      G.score += 200;
      spawnFloatText(bx, by - 60, '+200', COL.gold, 1.2, 24);
    }
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
  G.roomPhrases.push({ item: g.item, correct: true });
  S.correct(G.combo);
  speakAr(g.item);
  if (G.seenThisRun) G.seenThisRun.add(g.item.ar);
  flash(COL.gold, 0.18, 180);
  shake(7, 180);
  spawnParticles(g.x, g.y, COL.gold, 20, 1.2);
  navigator.vibrate?.(15);
  setStatus('Correct', 'Continue north', 'ok', 1500);
  const p = G.player;
  p.vx = 0; p.vy = 0;
  if (G.gates.filter(x => !x.done).length > 0) pickTarget();
  else { G.targetGate = null; }
}

function gateWrong(g) {
  g.wobble = 1;
  g.wrongFlashUntil = nowMs() + 900;
  G.wrong++;
  G.combo = 0;
  const tgt = G.targetGate && G.targetGate.item;
  if (tgt) { G.misses[tgt.ar] = (G.misses[tgt.ar] || 0) + 1; saveMisses(); }
  G.lastWrong = { item: g.item, at: nowMs() };
  if (tgt) G.roomPhrases.push({ item: tgt, correct: false });
  updateLastWrongPanel();
  S.wrong();
  flash(COL.danger, 0.32, 220);
  shake(16, 300);
  navigator.vibrate?.([30, 50, 30]);

  const p = G.player;
  const { l, r } = G.bounds;

  if (g.isLeft) {
    p.vx = 320;
    p.x = Math.max(p.x, l + 110);
  } else {
    p.vx = -320;
    p.x = Math.min(p.x, r - 110);
  }
  p.vy = -80;

  G.gateCooldownUntil = nowMs() + 900;
  G.inWrongGate = null;

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
  navigator.vibrate?.(120);
  endRun(false);
}
