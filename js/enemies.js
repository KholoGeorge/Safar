function updateOrbs(dt) {
  const p = G.player;
  if (!p) return;
  const now = nowMs();
  for (const o of G.orbs) {
    if (o.dead) {
      if (o.respawnAt && now >= o.respawnAt) respawnOrb(o);
      continue;
    }
    o.spawnFlash = Math.max(0, o.spawnFlash - dt * 2);

    if (now < o.stunUntil) {
      o.x += o.vx * dt; o.y += o.vy * dt;
      o.vx *= 0.88; o.vy *= 0.88;
    } else {
      const dx = p.x - o.x, dy = p.y - o.y;
      const d = Math.hypot(dx, dy) || 1;
      if (o.type === 'charger') {
        if (o.chargeState === 'idle') {
          if (now > o.chargeAt + 1200) { o.chargeState = 'windup'; o.chargeAt = now; }
          o.x += dx / d * 25 * dt; o.y += dy / d * 25 * dt;
        } else if (o.chargeState === 'windup') {
          if (now > o.chargeAt + 400) {
            o.chargeState = 'charge'; o.chargeAt = now;
            o.chargeVx = dx / d * 460; o.chargeVy = dy / d * 460;
          }
        } else if (o.chargeState === 'charge') {
          o.x += o.chargeVx * dt; o.y += o.chargeVy * dt;
          if (now > o.chargeAt + 400) { o.chargeState = 'idle'; o.chargeAt = now; o.chargeVx = 0; o.chargeVy = 0; }
        }
      } else {
        o.x += dx / d * o.speed * dt;
        o.y += dy / d * o.speed * dt;
      }
    }

    for (const other of G.orbs) {
      if (other === o || other.dead) continue;
      const ddx = o.x - other.x, ddy = o.y - other.y;
      const dd = Math.hypot(ddx, ddy) || 1;
      const min = o.r + other.r + 6;
      if (dd < min) {
        const push = (min - dd) * 0.5;
        o.x += ddx / dd * push; o.y += ddy / dd * push;
      }
    }

    o.x = clamp(o.x, G.bounds.l + o.r, G.bounds.r - o.r);
    o.y = clamp(o.y, G.bounds.t + o.r, G.bounds.b - o.r);

    const pd = dist(p.x, p.y, o.x, o.y);
    if (pd < p.radius + o.r && now >= G.invulnUntil) {
      const nx = (p.x - o.x) / (pd || 1), ny = (p.y - o.y) / (pd || 1);
      if (absorbHit()) {
        G.invulnUntil = now + 900;
        o.stunUntil = now + 600;
        o.vx = -nx * 260; o.vy = -ny * 260;
      } else {
        p.vx += nx * 340; p.vy += ny * 340;
        G.stunUntil = now + 700;
        G.invulnUntil = now + 1400;
        o.stunUntil = now + 600;
        o.vx = -nx * 180; o.vy = -ny * 180;
        G.stamina = Math.max(0, G.stamina - 25);
        G.combo = 0;
        S.hound();
        flash(COL.orbRing, 0.22, 200);
        shake(14, 260);
        setStatus('Orb!', 'Pull back', 'warn', 900);
      }
    }
  }
}

function updateBoss(dt) {
  if (!G.boss || G.boss.dead) return;
  const b = G.boss, p = G.player;
  if (!p) return;
  const now = nowMs();
  b.spawnFlash = Math.max(0, b.spawnFlash - dt * 2);
  b.bob += dt * 3;

  if (now < b.stunUntil) {
    b.x += b.vx * dt; b.y += b.vy * dt;
    b.vx *= 0.9; b.vy *= 0.9;
  } else {
    if (now > b.nextAction) {
      b.nextAction = now + 2500 + Math.random() * 1200;
      if (Math.random() < 0.5) {
        const dx = p.x - b.x, dy = p.y - b.y;
        const d = Math.hypot(dx, dy) || 1;
        b.vx = dx / d * 480; b.vy = dy / d * 480;
        b.stunUntil = now + 350;
        S.bossLunge();
      } else {
        const dx = p.x - b.x, dy = p.y - b.y;
        const baseAngle = Math.atan2(dy, dx);
        for (let i = -1; i <= 1; i++) {
          const a = baseAngle + i * 0.25;
          G.projectiles.push({ x: b.x, y: b.y, vx: Math.cos(a) * 240, vy: Math.sin(a) * 240, r: 8, life: 3, max: 3 });
        }
        S.projectile();
      }
    }
    const dx = p.x - b.x, dy = p.y - b.y;
    const d = Math.hypot(dx, dy) || 1;
    b.x += dx / d * b.speed * dt;
    b.y += dy / d * b.speed * dt;
  }

  b.x = clamp(b.x, G.bounds.l + b.r, G.bounds.r - b.r);
  b.y = clamp(b.y, G.bounds.t + b.r, G.bounds.b - b.r);

  const pd = dist(p.x, p.y, b.x, b.y);
  if (pd < p.radius + b.r && now >= G.invulnUntil) {
    const nx = (p.x - b.x) / (pd || 1), ny = (p.y - b.y) / (pd || 1);
    if (absorbHit()) {
      p.vx += nx * 300; p.vy += ny * 300;
      G.invulnUntil = now + 1000;
    } else {
      p.vx += nx * 500; p.vy += ny * 500;
      G.stunUntil = now + 900;
      G.invulnUntil = now + 1600;
      G.stamina = Math.max(0, G.stamina - 40);
      G.combo = 0;
      S.bossHit();
      flash(COL.bossRing, 0.32, 260);
      shake(22, 400);
      setStatus('Struck by the throne', '', 'warn', 1200);
    }
  }
}

function updateProjectiles(dt) {
  const p = G.player;
  const now = nowMs();
  for (const pr of G.projectiles) {
    pr.life -= dt;
    pr.x += pr.vx * dt; pr.y += pr.vy * dt;
    if (pr.life <= 0) continue;
    if (p) {
      const d = dist(p.x, p.y, pr.x, pr.y);
      if (d < p.radius + pr.r) {
        pr.life = 0;
        if (now >= G.invulnUntil) {
          if (absorbHit()) { G.invulnUntil = now + 800; }
          else {
            G.stars--; G.combo = 0;
            updateStars();
            S.starLoss();
            flash(COL.bossRing, 0.35, 260);
            shake(20, 350);
            G.invulnUntil = now + 1400;
            spawnParticles(p.x, p.y, COL.bossRing, 20, 1.2);
            setStatus('Bolt strikes', '', 'warn', 1200);
            if (G.stars <= 0) endRun(false);
          }
        }
      }
    }
    if (pr.x < G.bounds.l || pr.x > G.bounds.r || pr.y < G.bounds.t || pr.y > G.bounds.b) pr.life = 0;
  }
  G.projectiles = G.projectiles.filter(pr => pr.life > 0);
}

function updateStorm(dt) {
  if (G.stormSpeed === 0) return;
  G.stormY -= G.stormSpeed * G.up.storm * dt;
}

function updateTension(dt) {
  const p = G.player;
  if (!p || G.stormSpeed === 0) { G.tension = 0; return; }
  const gap = (p.y + p.radius) - G.stormY;
  const t = clamp(1 - gap / 160, 0, 1);
  G.tension = t;
  if (t > 0) {
    G.heartTimer -= dt;
    if (G.heartTimer <= 0) {
      S.heartbeat(0.05 + 0.08 * t);
      G.heartTimer = 1.0 - 0.6 * t;
    }
  } else { G.heartTimer = 0; }
}

function checkRoomClear() {
  if (!G.gates.length) return;
  if (!G.gates.every(g => g.done)) return;
  if (G.boss && !G.boss.dead) return;
  const p = G.player;
  if (p.y < G.bounds.t + 40) {
    G.roomsCleared++; G.roomIdx++;
    G.score += 500;
    G.lastWrong = null;
    updateLastWrongPanel();
    spawnFloatText(p.x - 60, p.y - 40, 'ROOM +500', COL.gold, 1.2, 22);
    if (!G.endless && G.roomIdx >= G.rooms.length) {
      if (G.daily) endRun(true);
      else offerChoice();
    } else {
      offerUpgrade(() => {
        const betweenLines = STORY.between[(G.roomIdx - 1) % STORY.between.length];
        showDialogue(betweenLines, () => enterRoom(G.roomIdx));
      });
    }
  }
}
