const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'sprint', ShiftRight: 'sprint',
};
const isTyping = (e) => {
  const t = e.target;
  return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA');
};

window.addEventListener('keydown', (e) => {
  if (isTyping(e)) return;
  if (e.code === 'Escape' && G.running) {
    e.preventDefault();
    togglePause();
    return;
  }
  const action = KEYMAP[e.code];
  const gameKey = action || e.code === 'Space' || e.code === 'KeyJ' || e.code === 'KeyK';
  if (G.running && gameKey) e.preventDefault();
  if (action) G.keys[action] = true;
  if (!G.running || G.paused || e.repeat) return;
  if (e.code === 'Space') tryDash();
  if (e.code === 'KeyJ') tryStaff();
  if (e.code === 'KeyK') {
    if (G.roomType === 'explore' && G.discoveryNear) openDiscovery(G.discoveryNear);
    else tryBurst();
  }
});
window.addEventListener('keyup', (e) => {
  const action = KEYMAP[e.code];
  if (action) G.keys[action] = false;
});
window.addEventListener('blur', () => { G.keys = {}; });
document.addEventListener('visibilitychange', () => { if (document.hidden) G.keys = {}; });

window.addEventListener('mousedown', (e) => {
  if (!G.running || G.paused) return;
  if (IS_TOUCH) return;
  if (e.button === 0) tryStaff();
  if (e.button === 2) tryBurst();
});
window.addEventListener('contextmenu', (e) => { if (G.running) e.preventDefault(); });

// ============================================================
//  TOUCH CONTROLS
// ============================================================
(function setupTouch() {
  if (!IS_TOUCH) return;
  document.body.classList.add('touch');

  const joyZone = $('joyZone');
  const actionTop = $('actionTop');
  const actionBottom = $('actionBottom');
  const base = $('joyBase');
  const knob = $('joyKnob');
  const ghostBtn = $('ghostBtn');

  let joyId = null;
  let cx = 0, cy = 0;

  function nearDiscoveryNode(x, y) {
    if (!G.running || G.paused) return null;
    if (G.roomType !== 'explore' || !G.discoveryNear || G.discoveryOpen) return null;
    const n = G.discoveryNear;
    return dist(x, y, n.x, n.y) < DISCOVERY_TAP_RADIUS ? n : null;
  }

  function showGhost(text, x, y) {
  ghostBtn.textContent = text;
  ghostBtn.style.left = x + 'px';
  ghostBtn.style.top  = y + 'px';
  ghostBtn.animate(
    [
      { opacity: 0.95, transform: 'scale(0.85)' },
      { opacity: 0,    transform: 'scale(1.15)' },
    ],
    { duration: 450, easing: 'ease-out' }
  );
}

  function fireAction(name, e) {
    if (!G.running || G.paused) return;
    const node = nearDiscoveryNode(e.clientX, e.clientY);
    if (node) { openDiscovery(node); return; }
    if (G.roomType === 'explore') return;   // no combat in quiet rooms
    showGhost(name === 'staff' ? 'STAFF' : 'BLAST', e.clientX, e.clientY);
    if (name === 'staff') { aimAssist(); tryStaff(); }
    else                  { tryBurst(); }
  }

  actionTop.addEventListener('pointerdown', (e) => {
  e.preventDefault(); e.stopPropagation();
  fireAction('blast', e);
}, { passive: false });

actionBottom.addEventListener('pointerdown', (e) => {
  e.preventDefault(); e.stopPropagation();
  fireAction('staff', e);
}, { passive: false });

  // ---------- Floating joystick ----------
  function start(e) {
    if (joyId !== null) return;
    const node = nearDiscoveryNode(e.clientX, e.clientY);
    if (node) { openDiscovery(node); return; }

    cx = e.clientX; cy = e.clientY;
    base.style.left = cx + 'px';
    base.style.top  = cy + 'px';
    base.classList.add('active');
    joyId = e.pointerId;
    try { joyZone.setPointerCapture(e.pointerId); } catch (_) {}
    move(e);
  }

  function move(e) {
    if (e.pointerId !== joyId) return;
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const d = Math.hypot(dx, dy) || 1;
    const clamped = Math.min(d, JOY_MAX_R);
    const kx = dx / d * clamped;
    const ky = dy / d * clamped;
    knob.style.transform = `translate(${kx}px, ${ky}px)`;

    const nx = kx / JOY_MAX_R;
    const ny = ky / JOY_MAX_R;
    const mag = Math.hypot(nx, ny);
    if (mag < JOY_DEAD) { G.joy = null; G.keys.sprint = false; return; }
    const m = Math.min(1, (mag - JOY_DEAD) / (1 - JOY_DEAD));
    G.joy = { x: nx / mag * m, y: ny / mag * m, m };
    G.keys.sprint = mag > JOY_SPRINT;
  }

  function end(e) {
    if (e.pointerId !== joyId) return;
    joyId = null;
    G.joy = null;
    G.keys.sprint = false;
    knob.style.transform = 'translate(0, 0)';
    base.classList.remove('active');
  }

  joyZone.addEventListener('pointerdown', start);
  joyZone.addEventListener('pointermove', move);
  joyZone.addEventListener('pointerup', end);
  joyZone.addEventListener('pointercancel', end);

  document.body.addEventListener('pointerdown', () => {
    initAudio();
    if (ac && ac.state === 'suspended') ac.resume();
  }, { once: true });
})();
