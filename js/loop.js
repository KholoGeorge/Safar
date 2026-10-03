function frame(now) {
  const rawDt = Math.min(0.05, (now - G.lastTime) / 1000) || 0;
  G.lastTime = now;
  if (G.dashing && now >= G.dashUntil) G.dashing = false;
  const inHitstop = now < G.hitstopUntil;
  const dt = inHitstop ? 0 : rawDt;

  ctx.save();
  if (now < G.shakeUntil) {
    const t = (G.shakeUntil - now) / 400;
    const m = G.shakeMag * Math.max(0, t);
    ctx.translate(rand(-m, m), rand(-m, m));
  }

  ctx.fillStyle = COL.void;
  ctx.fillRect(-40, -40, window.innerWidth + 80, window.innerHeight + 80);

  if (G.running && !G.paused) {
    updatePlayer(dt);
    if (G.running) {
      if (G.roomType !== 'explore') {
        updateOrbs(dt);
        updateBoss(dt);
        updateProjectiles(dt);
        updateStorm(dt);
        updateTension(dt);
      }
      checkRoomClear();
    }
  }

  const sdt = G.paused ? 0 : rawDt;
  for (const f of G.footprints) f.life -= sdt;
  G.footprints = G.footprints.filter(f => f.life > 0);
  for (const p of G.particles) {
    p.life -= sdt;
    p.x += p.vx * sdt; p.y += p.vy * sdt;
    p.vy += 400 * sdt; p.vx *= 0.97;
  }
  G.particles = G.particles.filter(p => p.life > 0);
  for (const r of G.rings) {
    r.life -= sdt;
    const t = 1 - r.life / r.max;
    r.r = 8 + (r.maxR - 8) * t;
  }
  G.rings = G.rings.filter(r => r.life > 0);
  for (const f of G.floatingText) {
    f.life -= sdt;
    f.y += f.vy * sdt;
    f.vy *= 0.94;
  }
  G.floatingText = G.floatingText.filter(f => f.life > 0);
  for (const d of G.dust) {
    d.x += d.vx * sdt; d.y += d.vy * sdt;
    if (d.x > G.bounds.r) d.x = G.bounds.l;
    if (d.x < G.bounds.l) d.x = G.bounds.r;
    if (d.y > G.bounds.b) d.y = G.bounds.t;
    if (d.y < G.bounds.t) d.y = G.bounds.b;
  }

  drawFloor();
  drawFootprints();
  drawStorm();
  drawObstacles();
  drawPickups();
  drawGates();
  drawDiscoveries();
  drawOrbs();
  drawBoss();
  drawProjectiles();
  drawRings();
  drawParticles();
  drawPlayer();
  drawFloatingText();
  drawDust();
  drawVignette();

  if (now < G.flashUntil) {
    const t = (G.flashUntil - now) / 300;
    ctx.fillStyle = G.flashColor;
    ctx.globalAlpha = G.flashAlpha * Math.max(0, t);
    ctx.fillRect(-40, -40, window.innerWidth + 80, window.innerHeight + 80);
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  if (G.player && G.stormSpeed > 0) {
    const gap = (G.player.y + G.player.radius) - G.stormY;
    const pct = clamp(gap / 400, 0, 1) * 100;
    stormFill.style.width = pct + '%';
    stormFill.className = 'storm-fill' + (pct < 20 ? ' danger' : pct < 45 ? ' warn' : '');
  } else if (stormFill) {
    stormFill.style.width = '100%';
    stormFill.className = 'storm-fill';
  }

  const pct = G.stamina / G.maxStamina * 100;
  staminaFill.style.width = pct + '%';
  staminaFill.className = 'stamina-fill' + (G.stamina < 20 ? ' low' : (G.dashing || now < G.dashCooldownUntil ? '' : ' boost'));
  const dashReadyNow = now >= G.dashCooldownUntil && G.stamina >= DASH_COST;
  dashReady.textContent = dashReadyNow ? 'DASH ⬤' : 'DASH ○';
  dashReady.style.color = dashReadyNow ? '#d4af37' : '#3a3020';
  staffAbility.classList.toggle('ready', now >= G.staffCooldownUntil);
  burstAbility.classList.toggle('ready', now >= G.burstCooldownUntil && G.stamina >= BURST_COST);
  shieldAbility.classList.toggle('ready', G.shield);
  scoreEl.textContent = `SCORE ${G.score}` + (G.combo >= 3 ? ` · x${comboMult()}` : '');

    const pauseBtn = document.getElementById('pauseBtn');
  if (pauseBtn) {
    const shouldShow = G.running && !G.userPaused
      && !dialogueScreen.classList.contains('show')
      && !upgradeScreen.classList.contains('show')
      && !chooseScreen.classList.contains('show');
    pauseBtn.style.display = shouldShow ? 'flex' : 'none';
  }

  statusEl.innerHTML = G.statusText + (G.statusSub ? `<div class="sub">${G.statusSub}</div>` : '');
  statusEl.className = 'status ' + G.statusClass;
  if (G.statusUntil && now > G.statusUntil) {
    G.statusUntil = 0; G.statusClass = '';
    if (G.running) {
      G.statusText = 'Continue north';
      G.statusSub = 'WASD move · SHIFT sprint · SPACE dash · J staff · K burst';
    } else {
      G.statusText = 'Awaiting orders';
      G.statusSub = 'WASD move · SHIFT sprint · SPACE dash · J staff · K burst';
    }
  }

  requestAnimationFrame(frame);
}

const discoveryScreen = document.getElementById('discoveryScreen');

function openDiscovery(node) {
  if (!node || node.found) return;
  G.discoveryOpen = node;
  const phrase = node.phrase;
  document.getElementById('discScene').textContent = node.scene;
  document.getElementById('discAr').textContent = phrase.ar;
  document.getElementById('discEn').textContent = phrase.en;
  discoveryScreen.classList.add('show');
  pauseOn();
  speakAr(phrase);
}

function closeDiscovery() {
  if (!G.discoveryOpen) return;
  G.discoveryOpen.found = true;
  G.discoveryOpen = null;
  discoveryScreen.classList.remove('show');
  pauseOff();
}

discoveryScreen.addEventListener('click', (e) => {
  if (e.target.closest('#discAudio')) return;
  closeDiscovery();
});
document.getElementById('discAudio').addEventListener('click', (e) => {
  e.stopPropagation();
  if (G.discoveryOpen) speakAr(G.discoveryOpen.phrase);
});
