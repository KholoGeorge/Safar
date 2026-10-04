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

  const zone = $('joyZone');
  const base = $('joyBase');
  const knob = $('joyKnob');

  let joyId = null;
  let cx = 0, cy = 0;

  function nearDiscoveryNode(x, y) {
    if (!G.running || G.paused) return null;
    if (G.roomType !== 'explore' || !G.discoveryNear || G.discoveryOpen) return null;
    const n = G.discoveryNear;
    return dist(x, y, n.x, n.y) < DISCOVERY_TAP_RADIUS ? n : null;
  }

  function start(e) {
    if (joyId !== null) return;

    // A tap on a glowing node opens it, and does NOT start the stick.
    const node = nearDiscoveryNode(e.clientX, e.clientY);
    if (node) { openDiscovery(node); return; }

    // Float the stick to wherever the thumb landed.
    cx = e.clientX;
    cy = e.clientY;
    base.style.left = cx + 'px';
    base.style.top  = cy + 'px';
    base.classList.add('active');

    joyId = e.pointerId;
    try { zone.setPointerCapture(e.pointerId); } catch (_) {}
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

    if (mag < JOY_DEAD) {
      G.joy = null;
      G.keys.sprint = false;
      return;
    }
    // Remap so output starts at 0 right after the deadzone, and reaches 1
    // at the rim. This is what makes small corrections near obstacles work.
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

  zone.addEventListener('pointerdown', start);
  zone.addEventListener('pointermove', move);
  zone.addEventListener('pointerup', end);
  zone.addEventListener('pointercancel', end);

  // Action buttons — stopPropagation so a press never falls through to the field.
  document.querySelectorAll('.action-btn').forEach(btn => {
    btn.addEventListener('pointerdown', e => {
      e.preventDefault();
      e.stopPropagation();
      if (!G.running || G.paused) return;
      const a = btn.dataset.action;
      if (a === 'dash')  tryDash();
      if (a === 'burst') tryBurst();
    });
  });

  // Taps on the right half of the field can also open a discovery node.
  canvas.addEventListener('pointerdown', (e) => {
    if (!G.running || G.paused) return;
    const node = nearDiscoveryNode(e.clientX, e.clientY);
    if (node) openDiscovery(node);
  });

  // Unlock audio on the first gesture.
  document.body.addEventListener('pointerdown', () => {
    initAudio();
    if (ac && ac.state === 'suspended') ac.resume();
  }, { once: true });
})();
