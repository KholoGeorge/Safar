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
  if (document.body.classList.contains('touch')) return;
  if (e.button === 0) tryStaff();
  if (e.button === 2) tryBurst();
});
window.addEventListener('contextmenu', (e) => { if (G.running) e.preventDefault(); });

(function setupTouch() {
  const isTouch = matchMedia('(hover: none) and (pointer: coarse)').matches
               || 'ontouchstart' in window;
  if (!isTouch) return;
  document.body.classList.add('touch');

  const joyBase = $('joyBase');
  const joyKnob = $('joyKnob');
  const MAX_R = 55, DEAD = 0.28, SPRINT = 0.82;
  let joyId = null, cx = 0, cy = 0;

  function start(e) {
    const r = joyBase.getBoundingClientRect();
    cx = r.left + r.width / 2;
    cy = r.top + r.height / 2;
    joyId = e.pointerId;
    try { joyBase.setPointerCapture(e.pointerId); } catch (_) {}
    move(e);
  }

  function move(e) {
    if (e.pointerId !== joyId) return;
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const d = Math.hypot(dx, dy) || 1;
    const clamped = Math.min(d, MAX_R);
    dx = dx / d * clamped;
    dy = dy / d * clamped;
    joyKnob.style.transform = `translate(${dx}px, ${dy}px)`;

    const nx = dx / MAX_R, ny = dy / MAX_R;
    const mag = Math.hypot(nx, ny);
    if (mag < DEAD) {
      G.keys.up = G.keys.down = G.keys.left = G.keys.right = false;
      G.keys.sprint = false;
    } else {
      G.keys.right = nx > 0.32;
      G.keys.left  = nx < -0.32;
      G.keys.down  = ny > 0.32;
      G.keys.up    = ny < -0.32;
      G.keys.sprint = mag > SPRINT;
    }
  }

  function end(e) {
    if (e.pointerId !== joyId) return;
    joyId = null;
    joyKnob.style.transform = 'translate(0,0)';
    G.keys.up = G.keys.down = G.keys.left = G.keys.right = false;
    G.keys.sprint = false;
  }

  joyBase.addEventListener('pointerdown', start);
  joyBase.addEventListener('pointermove', move);
  joyBase.addEventListener('pointerup', end);
  joyBase.addEventListener('pointercancel', end);

  document.querySelectorAll('.action-btn').forEach(btn => {
    btn.addEventListener('pointerdown', e => {
      e.preventDefault();
      if (!G.running || G.paused) return;
      const a = btn.dataset.action;
      if (a === 'dash') tryDash();
      if (a === 'staff') tryStaff();
      if (a === 'burst') tryBurst();
    });
  });

    // Tap in explore room opens nearest discovery
  document.body.addEventListener('pointerdown', (e) => {
    if (!G.running || G.paused) return;
    if (G.roomType !== 'explore') return;
    if (e.target.closest('#discAudio')) return;
    if (G.discoveryNear && !G.discoveryOpen) openDiscovery(G.discoveryNear);
  });

  document.body.addEventListener('pointerdown', () => {
    initAudio();
    if (ac && ac.state === 'suspended') ac.resume();
  }, { once: true });
})();
