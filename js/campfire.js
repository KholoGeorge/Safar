// ============================================================
//  campfire.js — the end-of-run scene. Fire + a small summary.
//  Replaces the plain endScreen feel. Nothing gameplay-related.
// ============================================================

let _fireCanvas = null;
let _fireCtx = null;
let _fireRAF = null;
let _fireParticles = [];

function startCampfire() {
  _fireCanvas = $('fireCanvas');
  if (!_fireCanvas) return;
  _fireCtx = _fireCanvas.getContext('2d');
  resizeCampfire();
  window.addEventListener('resize', resizeCampfire);
  _fireParticles = [];
  for (let i = 0; i < 80; i++) _fireParticles.push(makeFireParticle());
  if (_fireRAF) cancelAnimationFrame(_fireRAF);
  _fireRAF = requestAnimationFrame(fireFrame);
}

function stopCampfire() {
  if (_fireRAF) cancelAnimationFrame(_fireRAF);
  _fireRAF = null;
}

function resizeCampfire() {
  if (!_fireCanvas) return;
  const w = window.innerWidth, h = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  _fireCanvas.width = w * dpr;
  _fireCanvas.height = h * dpr;
  _fireCanvas.style.width = w + 'px';
  _fireCanvas.style.height = h + 'px';
  _fireCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function makeFireParticle() {
  const w = window.innerWidth;
  const baseX = w / 2 + rand(-60, 60);
  const baseY = window.innerHeight - 60;
  return {
    x: baseX + rand(-30, 30),
    y: baseY + rand(-10, 10),
    vx: rand(-12, 12),
    vy: rand(-60, -20),
    life: rand(0.6, 1.6),
    max: 1.6,
    size: rand(2, 6),
    hue: rand(20, 45),
  };
}

function fireFrame() {
  if (!_fireCanvas || !document.getElementById('endScreen').classList.contains('show')) {
    _fireRAF = null;
    return;
  }
  const w = window.innerWidth, h = window.innerHeight;
  const ctx = _fireCtx;

  // Trail
  ctx.fillStyle = 'rgba(14, 8, 4, 0.12)';
  ctx.fillRect(0, 0, w, h);

  // Glow under the fire
  const gx = w / 2, gy = h - 60;
  const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, 320);
  g.addColorStop(0, 'rgba(255, 180, 80, 0.18)');
  g.addColorStop(0.5, 'rgba(200, 100, 40, 0.06)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Draw flames
  for (const p of _fireParticles) {
    p.life -= 0.016;
    if (p.life <= 0) {
      const fresh = makeFireParticle();
      Object.assign(p, fresh);
    }
    p.x += p.vx * 0.016;
    p.y += p.vy * 0.016;
    p.vy -= 20 * 0.016;
    const a = p.life / p.max;
    ctx.fillStyle = 'hsla(' + p.hue + ', 100%, ' + (45 + 20 * a) + '%, ' + (0.8 * a) + ')';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2);
    ctx.fill();
  }

  _fireRAF = requestAnimationFrame(fireFrame);
}
