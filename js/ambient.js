// ============================================================
//  Ambient home-screen background — drifting dust, gold glow,
//  soft vignette. Runs only while the home screen is visible.
// ============================================================

const Ambient = {
  canvas: null,
  ctx: null,
  particles: [],
  running: false,
  raf: null,
  lastTime: 0,
  w: 0,
  h: 0,
  dpr: 1,
  glowGrad: null,
  vignetteGrad: null,
};

function initAmbient() {
  if (Ambient.canvas) return;
  Ambient.canvas = document.getElementById('ambientCanvas');
  if (!Ambient.canvas) return;
  Ambient.ctx = Ambient.canvas.getContext('2d');
  resizeAmbient();
  window.addEventListener('resize', resizeAmbient);
  window.addEventListener('orientationchange', () => setTimeout(resizeAmbient, 120));
}

function resizeAmbient() {
  if (!Ambient.canvas) return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  Ambient.w = w;
  Ambient.h = h;
  Ambient.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  Ambient.canvas.width = w * Ambient.dpr;
  Ambient.canvas.height = h * Ambient.dpr;
  Ambient.canvas.style.width = w + 'px';
  Ambient.canvas.style.height = h + 'px';
  Ambient.ctx.setTransform(Ambient.dpr, 0, 0, Ambient.dpr, 0, 0);

  // Rebuild gradients (they're sized to the viewport)
  const cx = w / 2;
  const cy = h * 0.32;
  const g = Ambient.ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.55);
  g.addColorStop(0,    'rgba(212, 175, 55, 0.055)');
  g.addColorStop(0.55, 'rgba(212, 175, 55, 0.015)');
  g.addColorStop(1,    'rgba(212, 175, 55, 0)');
  Ambient.glowGrad = g;

  const v = Ambient.ctx.createLinearGradient(0, h * 0.72, 0, h);
  v.addColorStop(0, 'rgba(14, 12, 8, 0)');
  v.addColorStop(1, 'rgba(14, 12, 8, 0.6)');
  Ambient.vignetteGrad = v;

  if (Ambient.particles.length < 30) seedAmbientParticles();
}

function seedAmbientParticles() {
  Ambient.particles = [];
  const count = IS_SLOW ? 28 : 60;
  for (let i = 0; i < count; i++) {
    Ambient.particles.push({
      x: Math.random() * Ambient.w,
      y: Math.random() * Ambient.h,
      vx: rand(-10, 16),
      vy: rand(-7, 5),
      size: rand(0.6, 2.0),
      alpha: rand(0.06, 0.22),
      phase: Math.random() * Math.PI * 2,
      speed: rand(0.3, 0.9),
    });
  }
}

function startAmbient() {
  if (Ambient.running) return;
  initAmbient();
  if (!Ambient.canvas) return;
  Ambient.running = true;
  Ambient.lastTime = performance.now();
  Ambient.raf = requestAnimationFrame(ambientFrame);
}

function stopAmbient() {
  if (!Ambient.running) return;
  Ambient.running = false;
  if (Ambient.raf) cancelAnimationFrame(Ambient.raf);
  Ambient.raf = null;
}

function ambientFrame(now) {
  if (!Ambient.running) return;
  const dt = Math.min(0.05, (now - Ambient.lastTime) / 1000);
  Ambient.lastTime = now;

  const { ctx, w, h } = Ambient;
  ctx.clearRect(0, 0, w, h);

  // Gold glow behind the title
  if (Ambient.glowGrad) {
    ctx.fillStyle = Ambient.glowGrad;
    ctx.fillRect(0, 0, w, h);
  }

  // Drifting dust
  ctx.fillStyle = '#c9b88a';
  for (const p of Ambient.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.phase += dt * p.speed;

    if (p.x > w + 4) p.x = -4;
    if (p.x < -4) p.x = w + 4;
    if (p.y > h + 4) p.y = -4;
    if (p.y < -4) p.y = h + 4;

    const flicker = 0.7 + 0.3 * Math.sin(p.phase);
    ctx.globalAlpha = p.alpha * flicker;
    ctx.fillRect(p.x, p.y, p.size, p.size);
  }
  ctx.globalAlpha = 1;

  // Bottom vignette — softens the last row of cards
  if (Ambient.vignetteGrad) {
    ctx.fillStyle = Ambient.vignetteGrad;
    ctx.fillRect(0, h * 0.72, w, h * 0.28);
  }

  Ambient.raf = requestAnimationFrame(ambientFrame);
}
