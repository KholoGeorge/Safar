function frame(now) {
  const rawDt = Math.min(0.05, (now - G.lastTime) / 1000) || 0;
  G.lastTime = now;
  if (G.dashing && now >= G.dashUntil) G.dashing = false;
  const inHitstop = now < G.hitstopUntil;
  const dt = inHitstop ? 0 : rawDt;

  pollGamepad();

  ctx.save();
  if (now < G.shakeUntil) {
    const t = (G.shakeUntil - now) / 400;
    const m = G.shakeMag * Math.max(0, t);
    ctx.translate(rand(-m, m), rand(-m, m));
  }

  ctx.fillStyle = COL.void;
  ctx.fillRect(-40, -40, window.innerWidth + 80, window.innerHeight + 80);

  if (G.running && !G.paused) {
    G.playMs += rawDt * 1000;
    updatePlayer(dt);
    if (G.running) {
      if (G.roomType !== 'explore' && G.roomType !== 'reflection') {
        updateOrbs(dt);
        updateBoss(dt);
        updateProjectiles(dt);
        updateStorm(dt);
        updateTension(dt);
        trackTarget();
      }

      // Exit announcement
      if (!G.exitAnnounced && G.roomType !== 'explore' && G.roomType !== 'reflection' && G.gates.length > 0) {
        const gatesDone = G.gates.every(g => g.done);
        const bossDead = !G.boss || G.boss.dead;
        if (gatesDone && bossDead) {
          G.exitAnnounced = true;
          setStatus('The way is clear', 'Go north — walk out', 'ok', 4500);
          S.boon();
          spawnFloatText(G.player.x, G.player.y - 70, 'THE WAY IS CLEAR', COL.gold, 2.0, 26);
          flash(COL.gold, 0.18, 320);
        }
      }

      // Whispers
      if (G.voice && G.roomType !== 'boss' &&
          now >= G.whisperAt &&
          (!curAudio || curAudio.paused || curAudio.ended)) {
        const cards = G.currentCards;
        if (cards && cards.length) {
          let pick = -1;
          for (let tries = 0; tries < 4 && pick < 0; tries++) {
            const i = Math.floor(Math.random() * cards.length);
            if (i !== G.whisperLastIdx) pick = i;
          }
          if (pick < 0) pick = Math.floor(Math.random() * cards.length);
          G.whisperLastIdx = pick;
          whisperPhrase(cards[pick]);
        }
        G.whisperAt = now + rand(35000, 70000);
      }

      // Rafiq proximity — speaks once, then fades.
      if (G.rafiq && !G.rafiq.spoken && G.player) {
        const d = Math.hypot(G.player.x - G.rafiq.x, G.player.y - G.rafiq.y);
        if (d < 110) {
          G.rafiq.spoken = true;
          G.rafiq.speakAt = now;
          setStatus('Rafiq', G.rafiq.line, 'ok', 5000);
          spawnFloatText(G.rafiq.x, G.rafiq.y - 70, G.rafiq.line, COL.gold, 4.0, 18);
        }
      }
      if (G.rafiq && G.rafiq.spoken && now > G.rafiq.speakAt + 2200) {
        G.rafiq.opacity -= rawDt * 0.45;
        if (G.rafiq.opacity <= 0) G.rafiq = null;
      }

      // ----- Gate proximity chime (feature 4) -----
      if (G.roomType !== 'explore' && G.roomType !== 'reflection' && G.player) {
        if (!G.gatesNear) G.gatesNear = new Set();
        for (let i = 0; i < G.gates.length; i++) {
          const g = G.gates[i];
          if (g.done) { G.gatesNear.delete(i); continue; }
          const d = Math.hypot(G.player.x - g.x, G.player.y - g.y);
          const near = d < 220;
          if (near && !G.gatesNear.has(i)) {
            G.gatesNear.add(i);
            gateChime();
          } else if (!near && G.gatesNear.has(i)) {
            G.gatesNear.delete(i);
          }
        }
      }

      // ----- Wind ambient (feature 4) -----
      if (now > G.windUpdateAt) {
        G.windUpdateAt = now + 250;
        let target = 0.10;
        if (G.weather === 'storm') target = 0.65 + (G.tension || 0) * 0.30;
        else if (G.weather === 'dust') target = 0.35 + (G.tension || 0) * 0.20;
        setWindVolume(target);
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

  if (USE_3D && typeof render3D === 'function') {
    render3D(now);
  } else {
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
  }

  if (!USE_3D) {
    if (now < G.flashUntil) {
      const t = (G.flashUntil - now) / 300;
      ctx.fillStyle = G.flashColor;
      ctx.globalAlpha = G.flashAlpha * Math.max(0, t);
      ctx.fillRect(-40, -40, window.innerWidth + 80, window.innerHeight + 80);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
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
      && !chooseScreen.classList.contains('show');
    pauseBtn.style.display = shouldShow ? 'flex' : 'none';
  }

  const discPrompt = document.getElementById('discPrompt');
  if (discPrompt) {
    const showPrompt = G.running && !G.paused
      && G.roomType === 'explore'
      && G.discoveryNear && !G.discoveryOpen;
    if (showPrompt) {
      const wanted = IS_TOUCH ? 'Tap to inspect' : 'Press K · Tap to inspect';
      if (discPrompt.textContent !== wanted) discPrompt.textContent = wanted;
      if (!discPrompt.classList.contains('show')) discPrompt.classList.add('show');
    } else if (discPrompt.classList.contains('show')) {
      discPrompt.classList.remove('show');
    }
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
