function drawFloor() {
  const { l, t, r, b } = G.bounds;
  ctx.fillStyle = COL.floor;
  ctx.fillRect(l, t, r - l, b - t);
  ctx.fillStyle = COL.sand;
  for (let i = 0; i < 6; i++) {
    const px = l + ((i * 137) % (r - l));
    const py = t + ((i * 271) % (b - t));
    ctx.globalAlpha = 0.35;
    ctx.fillRect(px, py, 80 + ((i * 53) % 120), 60 + ((i * 91) % 100));
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(138, 122, 90, 0.08)';
  const step = 44;
  for (let x = l + step; x < r; x += step)
    for (let y = t + step; y < b; y += step) ctx.fillRect(x, y, 1, 1);
  ctx.strokeStyle = COL.border;
  ctx.lineWidth = 1;
  ctx.strokeRect(l + 0.5, t + 0.5, r - l - 1, b - t - 1);
}

function drawFootprints() {
  for (const f of G.footprints) {
    const a = Math.max(0, f.life / f.max) * 0.35;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(f.x, f.y);
    ctx.rotate(f.angle);
    ctx.fillStyle = '#0a0806';
    ctx.fillRect(-4, -2, 8, 4);
    ctx.restore();
  }
}

function drawObstacles() {
  for (const o of G.obstacles) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(o.x + 2, o.y + 4, o.r, o.r * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COL.rock;
    ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = COL.rockHi; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(o.x, o.y, o.r - 3, Math.PI * 0.75, Math.PI * 1.35); ctx.stroke();
    if (o.variant === 0) {
      ctx.fillStyle = COL.floor;
      ctx.beginPath(); ctx.arc(o.x - o.r * 0.3, o.y - o.r * 0.2, o.r * 0.18, 0, Math.PI * 2); ctx.fill();
    } else if (o.variant === 1) {
      ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(o.x, o.y, o.r * 0.55, Math.PI * 1.1, Math.PI * 1.6); ctx.stroke();
    } else {
      ctx.fillStyle = COL.rockHi;
      ctx.fillRect(o.x - 3, o.y - o.r * 0.4, 6, 6);
    }
  }
}

function drawPickups() {
  const t = performance.now() / 1000;
  for (const pk of G.pickups) {
    if (pk.collected) continue;
    const bob = Math.sin(t * 2.2 + pk.bob) * 3;
    ctx.save();
    ctx.globalAlpha = 0.18 + 0.08 * Math.sin(t * 3 + pk.bob);
    ctx.fillStyle = COL.gold;
    ctx.beginPath(); ctx.arc(pk.x, pk.y + bob, 24, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.fillStyle = COL.gold;
    ctx.beginPath(); ctx.arc(pk.x, pk.y + bob, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COL.void;
    ctx.beginPath(); ctx.arc(pk.x, pk.y + bob, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COL.text;
    ctx.beginPath(); ctx.arc(pk.x, pk.y + bob, 2.5, 0, Math.PI * 2); ctx.fill();
  }
}

function drawStorm() {
  const { l, t, r, b } = G.bounds;
  const sy = G.stormY;
  if (sy > b) return;
  ctx.fillStyle = COL.storm;
  ctx.fillRect(l, Math.max(t, sy), r - l, b - Math.max(t, sy));
  if (sy > t && sy < b) {
    ctx.strokeStyle = COL.stormEdge; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(l, sy + 0.5); ctx.lineTo(r, sy + 0.5); ctx.stroke();
    const grd = ctx.createLinearGradient(0, sy, 0, sy - 90);
    grd.addColorStop(0, 'rgba(26, 20, 8, 0.85)');
    grd.addColorStop(1, 'rgba(26, 20, 8, 0)');
    ctx.fillStyle = grd;
    ctx.fillRect(l, sy - 90, r - l, 90);
  }
}

function drawGates() {
  const p = G.player;
  const t = performance.now();
  for (const g of G.gates) {
    let wobbleOff = 0;
    if (g.wobble > 0) {
      wobbleOff = Math.sin(t * 0.08) * g.wobble * 4;
      g.wobble = Math.max(0, g.wobble - 0.03);
    }
    const x = g.x - g.w / 2 + (g.isLeft ? -wobbleOff : wobbleOff);
    const y = g.y - g.h / 2;

    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x + 2, y + 3, g.w, g.h);

    ctx.fillStyle = g.done ? COL.floorDark : COL.sand;
    ctx.fillRect(x, y, g.w, g.h);

    ctx.strokeStyle = g.done ? COL.border : COL.borderBr;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 0.5, y + 0.5, g.w - 1, g.h - 1);

    ctx.beginPath();
    if (g.isLeft) {
      ctx.moveTo(x + 14, y);
      ctx.quadraticCurveTo(x + 4, g.y, x + 14, y + g.h);
    } else {
      ctx.moveTo(x + g.w - 14, y);
      ctx.quadraticCurveTo(x + g.w - 4, g.y, x + g.w - 14, y + g.h);
    }
    ctx.stroke();

    ctx.fillStyle = g.done ? COL.border : COL.khaki;
    const hx = g.isLeft ? x + g.w - 10 : x + 10;
    ctx.beginPath(); ctx.arc(hx, g.y, 3, 0, Math.PI * 2); ctx.fill();

    if (g.done) {
      ctx.fillStyle = COL.gold;
      ctx.fillRect(x + 4, g.y - 1, g.w - 8, 2);
    }
    if (t < g.correctFlashUntil) {
      ctx.save();
      ctx.globalAlpha = (g.correctFlashUntil - t) / 600 * 0.6;
      ctx.fillStyle = COL.gold;
      ctx.fillRect(x, y, g.w, g.h);
      ctx.restore();
    }
    if (g.wrongFlashUntil && t < g.wrongFlashUntil) {
      ctx.save();
      ctx.globalAlpha = (g.wrongFlashUntil - t) / 900 * 0.75;
      ctx.fillStyle = COL.danger;
      ctx.fillRect(x, y, g.w, g.h);
      ctx.restore();
    }

    const labelAlpha = g.done ? 0.28 : 1;
    ctx.save();
    ctx.globalAlpha = labelAlpha;
    ctx.textAlign = g.isLeft ? 'left' : 'right';
    ctx.textBaseline = 'bottom';
    const label = (G.mode === 'en-ar') ? g.item.ar : g.item.en;
    if (G.mode === 'en-ar') {
      ctx.direction = 'rtl';
      ctx.font = '700 17px "Inter", system-ui, sans-serif';
    } else {
      ctx.direction = 'ltr';
      ctx.font = '600 15px "Inter", system-ui, sans-serif';
    }
    const tx = g.isLeft ? x + 2 : x + g.w - 2;
    const ty = y - 8;
    const w = ctx.measureText(label).width + 14;
    const bgX = g.isLeft ? tx - 4 : tx - w + 4;
    ctx.fillStyle = 'rgba(14,12,8,0.85)';
    ctx.fillRect(bgX, ty - 19, w, 22);
    ctx.fillStyle = COL.khakiBr;
    ctx.fillText(label, tx, ty);
    ctx.restore();
  }

  if (G.gates.every(g => g.done) && (!G.boss || G.boss.dead)) {
    const { l, r, t } = G.bounds;
    const pulse = 0.55 + Math.sin(performance.now() / 400) * 0.35;
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = COL.gold;
    const cx = (l + r) / 2;
    const ty = t + 6;
    ctx.beginPath();
    ctx.moveTo(cx - 22, ty + 22);
    ctx.lineTo(cx,      ty + 4);
    ctx.lineTo(cx + 22, ty + 22);
    ctx.lineTo(cx + 10, ty + 22);
    ctx.lineTo(cx + 10, ty + 38);
    ctx.lineTo(cx - 10, ty + 38);
    ctx.lineTo(cx - 10, ty + 22);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function drawOrbs() {
  const now = nowMs();
  const t = performance.now() / 1000;
  for (const o of G.orbs) {
    if (o.dead) continue;
    const bob = Math.sin(t * 2.5 + o.bob) * 2;
    if (o.spawnFlash > 0) {
      ctx.save();
      ctx.globalAlpha = 0.6 * o.spawnFlash;
      ctx.strokeStyle = o.ring; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(o.x, o.y + bob, o.r + 12 * (1 - o.spawnFlash), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    const hitFlash = o.hitFlashUntil > now;
    const baseColor = hitFlash ? '#ffffff' : o.color;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.ellipse(o.x + 2, o.y + o.r * 0.6, o.r * 0.9, o.r * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = baseColor;
    ctx.beginPath(); ctx.arc(o.x, o.y + bob, o.r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = hitFlash ? '#ffffff' : o.ring;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(o.x, o.y + bob, o.r - 2, 0, Math.PI * 2); ctx.stroke();

    const p = G.player;
    if (p) {
      const dx = p.x - o.x, dy = p.y - o.y;
      const d = Math.hypot(dx, dy) || 1;
      const nx = dx / d, ny = dy / d;
      const perpX = -ny, perpY = nx;
      let eyePositions;
      if (o.eyes === 1) eyePositions = [{ o: 0, s: 1 }];
      else if (o.eyes === 2) eyePositions = [{ o: -4, s: 1 }, { o: 4, s: 1 }];
      else eyePositions = [{ o: -6, s: 1 }, { o: 0, s: 1.2 }, { o: 6, s: 1 }];
      for (const ep of eyePositions) {
        const ex = o.x + nx * (o.r * 0.35) + perpX * ep.o;
        const ey = o.y + bob + ny * (o.r * 0.35) + perpY * ep.o;
        ctx.fillStyle = hitFlash ? '#ffffff' : o.eye;
        ctx.beginPath(); ctx.arc(ex, ey, 2.2 * ep.s, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (o.type === 'charger' && o.chargeState === 'windup') {
      const pulse = 0.5 + Math.sin(performance.now() / 60) * 0.5;
      ctx.save();
      ctx.globalAlpha = 0.6 * pulse;
      ctx.strokeStyle = o.eye; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(o.x, o.y + bob, o.r + 6, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    if (o.carry && o.wordItem) {
      const arabic = G.mode === 'en-ar';
      const txt = arabic ? o.wordItem.ar : o.wordItem.en;
      ctx.save();
      ctx.direction = arabic ? 'rtl' : 'ltr';
      ctx.font = arabic ? '700 15px "Inter", system-ui, sans-serif' : '600 12px "Inter", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const w = ctx.measureText(txt).width + 14;
      const ly = o.y + bob - o.r - 18;
      ctx.fillStyle = 'rgba(14,12,8,0.88)';
      ctx.fillRect(o.x - w / 2, ly - 10, w, 20);
      ctx.strokeStyle = o.ring; ctx.lineWidth = 1;
      ctx.strokeRect(o.x - w / 2 + 0.5, ly - 10 + 0.5, w - 1, 19);
      ctx.fillStyle = COL.khakiBr;
      ctx.fillText(txt, o.x, ly);
      ctx.restore();
    }
  }
}

function drawBoss() {
  const b = G.boss;
  if (!b || b.dead) return;
  const now = nowMs();
  const bob = Math.sin(b.bob) * 3;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.beginPath();
  ctx.ellipse(b.x + 3, b.y + b.r * 0.6, b.r * 0.95, b.r * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.globalAlpha = 0.3 + 0.15 * Math.sin(now / 400);
  ctx.fillStyle = COL.bossRing;
  ctx.beginPath(); ctx.arc(b.x, b.y + bob, b.r + 18, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  const hitFlash = b.hitFlashUntil > now;
  ctx.fillStyle = hitFlash ? '#ffffff' : COL.boss;
  ctx.beginPath(); ctx.arc(b.x, b.y + bob, b.r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = hitFlash ? '#ffffff' : COL.bossRing;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(b.x, b.y + bob, b.r - 4, 0, Math.PI * 2); ctx.stroke();

  const p = G.player;
  if (p) {
    const dx = p.x - b.x, dy = p.y - b.y;
    const d = Math.hypot(dx, dy) || 1;
    const nx = dx / d, ny = dy / d;
    const perpX = -ny, perpY = nx;
    const eyePositions = [{ r: 12, a: 0.4 }, { r: 12, a: -0.4 }, { r: 22, a: 0 }, { r: 8, a: 0.9 }, { r: 8, a: -0.9 }];
    for (const ep of eyePositions) {
      const ex = b.x + nx * ep.r * Math.cos(ep.a) - perpX * ep.r * Math.sin(ep.a);
      const ey = b.y + bob + ny * ep.r * Math.cos(ep.a) - perpY * ep.r * Math.sin(ep.a);
      ctx.fillStyle = hitFlash ? '#ffffff' : COL.bossEye;
      ctx.beginPath(); ctx.arc(ex, ey, 3, 0, Math.PI * 2); ctx.fill();
    }
  }

  const hp = Math.max(0, b.hp);
  for (let i = 0; i < b.maxHp; i++) {
    const angle = -Math.PI / 2 + (i / b.maxHp) * Math.PI * 2;
    const rr = b.r + 14;
    const ex = b.x + Math.cos(angle) * rr;
    const ey = b.y + bob + Math.sin(angle) * rr;
    ctx.fillStyle = i < hp ? COL.bossEye : 'rgba(212,175,55,0.15)';
    ctx.beginPath(); ctx.arc(ex, ey, 2.5, 0, Math.PI * 2); ctx.fill();
  }
}

function drawProjectiles() {
  for (const pr of G.projectiles) {
    const a = Math.min(1, pr.life / 0.5);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.shadowColor = COL.bossEye; ctx.shadowBlur = 20;
    ctx.fillStyle = COL.projectile;
    ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COL.bossEye;
    ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.r * 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

function drawParticles() {
  ctx.save();
  for (const p of G.particles) {
    const a = Math.max(0, p.life / p.max);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawRings() {
  ctx.save();
  for (const r of G.rings) {
    const t = 1 - r.life / r.max;
    ctx.globalAlpha = 1 - t;
    ctx.strokeStyle = r.color;
    ctx.shadowColor = r.color; ctx.shadowBlur = 20;
    ctx.lineWidth = 3 * (1 - t) + 1;
    ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

function drawFloatingText() {
  ctx.save();
  ctx.textAlign = 'center';
  for (const f of G.floatingText) {
    const a = Math.max(0, f.life / f.max);
    ctx.globalAlpha = Math.min(1, a * 1.5);
    ctx.font = `bold ${f.size || 26}px "JetBrains Mono", "Inter", system-ui, monospace`;
    const w = ctx.measureText(f.text).width;
    const x = clamp(f.x, w / 2 + 10, window.innerWidth - w / 2 - 10);
    ctx.fillStyle = f.color;
    ctx.shadowColor = f.color; ctx.shadowBlur = 16;
    ctx.fillText(f.text, x, f.y);
  }
  ctx.restore();
}

function drawPlayer() {
  const p = G.player;
  if (!p) return;
  const now = nowMs();
  const stunned = now < G.stunUntil;
  const invuln = now < G.invulnUntil;
  if (invuln && Math.floor(now / 80) % 2 === 0) return;

  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.ellipse(p.x + 2, p.y + 7, p.radius, p.radius * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = stunned ? COL.danger : COL.void;
  ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fill();

  ctx.strokeStyle = stunned ? COL.orbEye : COL.khaki;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(p.x, p.y, p.radius - 1, 0, Math.PI * 2); ctx.stroke();

  ctx.fillStyle = COL.gold;
  ctx.beginPath(); ctx.arc(p.x, p.y - 3, p.radius * 0.55, 0, Math.PI * 2); ctx.fill();

  const fx = Math.cos(p.angle) * (p.radius + 8);
  const fy = Math.sin(p.angle) * (p.radius + 8);
  ctx.strokeStyle = COL.gold; ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(p.x + Math.cos(p.angle) * 4, p.y + Math.sin(p.angle) * 4);
  ctx.lineTo(p.x + fx, p.y + fy);
  ctx.stroke();

  if (G.shield) {
    ctx.save();
    ctx.globalAlpha = 0.55 + 0.25 * Math.sin(now / 150);
    ctx.strokeStyle = COL.shield; ctx.lineWidth = 2.5;
    ctx.shadowColor = COL.shield; ctx.shadowBlur = 18;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.radius + 9, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  if (p.staffUntil && now < p.staffUntil) {
    const t = (p.staffUntil - now) / STAFF_ACTIVE;
    const rr = STAFF_RANGE * G.up.range * 0.85;
    ctx.save();
    ctx.globalAlpha = t * 0.8;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.strokeStyle = COL.gold;
    ctx.shadowColor = COL.gold; ctx.shadowBlur = 30;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, rr, -STAFF_ARC / 2, STAFF_ARC / 2);
    ctx.stroke();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, rr, -STAFF_ARC / 2, STAFF_ARC / 2);
    ctx.stroke();
    ctx.restore();
  }

  if (G.dashing && now < G.dashUntil) {
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.strokeStyle = COL.khakiBr; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.x - Math.cos(p.angle) * 30, p.y - Math.sin(p.angle) * 30);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.restore();
  }
}

function drawDust() {
  ctx.save();
  for (const d of G.dust) {
    ctx.globalAlpha = d.alpha;
    ctx.fillStyle = COL.khakiBr;
    ctx.fillRect(d.x, d.y, d.size, d.size);
  }
  ctx.restore();
}

function drawVignette() {
  const w = window.innerWidth, h = window.innerHeight;
  const cx = w / 2, cy = h / 2;
  const grd = ctx.createRadialGradient(cx, cy, Math.min(w, h) * 0.35, cx, cy, Math.max(w, h) * 0.75);
  grd.addColorStop(0, 'rgba(0,0,0,0)');
  grd.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, w, h);

  if (G.tension > 0) {
    const pulse = 0.6 + 0.4 * Math.sin(performance.now() / (260 - 160 * G.tension));
    const a = 0.5 * G.tension * pulse;
    const rg = ctx.createRadialGradient(cx, cy, Math.min(w, h) * 0.25, cx, cy, Math.max(w, h) * 0.7);
    rg.addColorStop(0, 'rgba(138,26,26,0)');
    rg.addColorStop(1, `rgba(138,26,26,${a})`);
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, w, h);
  }
}
