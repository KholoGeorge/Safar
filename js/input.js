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
let touchJoyActive = false;

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
    if (G.roomType === 'explore') return;
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

  function start(e) {
    if (joyId !== null) return;
    const node = nearDiscoveryNode(e.clientX, e.clientY);
    if (node) { openDiscovery(node); return; }

    cx = e.clientX; cy = e.clientY;
    base.style.left = cx + 'px';
    base.style.top  = cy + 'px';
    base.classList.add('active');
    joyId = e.pointerId;
    touchJoyActive = true;
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
    if (mag < JOY_DEAD) { G.joy = null; return; }
    const m = Math.min(1, (mag - JOY_DEAD) / (1 - JOY_DEAD));
    G.joy = { x: nx / mag * m, y: ny / mag * m, m, source: 'touch' };
  }

  function end(e) {
    if (e.pointerId !== joyId) return;
    joyId = null;
    touchJoyActive = false;
    G.joy = null;
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

  const sprintBtn = $('sprintBtn');
  if (sprintBtn) {
    sprintBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      G.touchSprint = !G.touchSprint;
      G.keys.sprint = G.touchSprint;
      sprintBtn.classList.toggle('active', G.touchSprint);
      navigator.vibrate?.(8);
    }, { passive: false });
  }
})();

// ============================================================
//  PAD NAVIGATION — controller-only menu navigation.
//
//  Active whenever a .screen.show element is visible. Uses the
//  left stick and D-pad to move a focus ring between focusable
//  elements. A = confirm / advance, B = back / dismiss.
//
//  When no element is focused (index = -1) and A is pressed,
//  the screen's default action fires (advance dialogue, next
//  study step, dismiss room review, etc.).
// ============================================================
const PadNav = {
  screen: null,
  items: [],
  index: -1,
  stickDir: null,
  stickNextAt: 0,
  stickRepeatMs: 180,
  moveEchoMs: 60,
  dead: 0.5,
  lastMoveAt: 0,
};

const PAD_FOCUS_SEL = [
  'button',
  'a[href]',
  'input',
  'select',
  'textarea',
  'summary',
  '.lesson-card',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function padVisibleScreen() {
  const screens = document.querySelectorAll('.screen.show');
  if (!screens.length) return null;
  return screens[screens.length - 1];
}

function padFocusableIn(root) {
  if (!root) return [];
  const all = root.querySelectorAll(PAD_FOCUS_SEL);
  const out = [];
  for (let i = 0; i < all.length; i++) {
    const el = all[i];
    if (el.disabled) continue;
    if (el.offsetParent === null) continue;
    if (el.getAttribute('aria-hidden') === 'true') continue;
    out.push(el);
  }
  return out;
}

function padDefaultAction() {
  if (typeof dialogueScreen !== 'undefined' && dialogueScreen && dialogueScreen.classList.contains('show'))
    return advanceDialogue;
  if (typeof reviewScreen !== 'undefined' && reviewScreen && reviewScreen.classList.contains('show'))
    return function () {
      reviewScreen.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      reviewScreen.dispatchEvent(new PointerEvent('pointerup',   { bubbles: true }));
    };
  if (typeof studyScreen !== 'undefined' && studyScreen && studyScreen.classList.contains('show'))
    return nextStudyStep;
  if (typeof discoveryScreen !== 'undefined' && discoveryScreen && discoveryScreen.classList.contains('show'))
    return closeDiscovery;
  const pauseEl = document.getElementById('pauseScreen');
  if (pauseEl && pauseEl.classList.contains('show')) return resumeFromPause;
  return null;
}

function padClearFocus() {
  const prev = document.querySelector('.pad-focus');
  if (prev) prev.classList.remove('pad-focus');
}

function padApplyFocus() {
  padClearFocus();
  if (PadNav.index < 0 || PadNav.index >= PadNav.items.length) return;
  const el = PadNav.items[PadNav.index];
  if (!el) return;
  el.classList.add('pad-focus');
  try { el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (_) {}
}

function padRefresh() {
  const scr = padVisibleScreen();
  if (!scr) {
    if (PadNav.screen) {
      PadNav.screen = null;
      PadNav.items = [];
      PadNav.index = -1;
      padClearFocus();
    }
    return;
  }

  // Always re-scan. Cheap enough — the focusable set on a screen
  // is small, and this picks up newly-revealed elements inside
  // <details> the moment they become visible.
  const focusedEl = PadNav.index >= 0 ? PadNav.items[PadNav.index] : null;
  const items = padFocusableIn(scr);
  PadNav.screen = scr;
  PadNav.items = items;

  if (PadNav.index < 0) return;   // unfocused — leave as is

  let idx = focusedEl ? items.indexOf(focusedEl) : -1;
  if (idx === -1) idx = Math.min(PadNav.index, items.length - 1);
  if (idx < 0) idx = items.length ? 0 : -1;

  if (idx !== PadNav.index) {
    PadNav.index = idx;
    padApplyFocus();
  }
}

function padMove(dir) {
  padRefresh();
  if (!PadNav.items.length) return;

  // First press on a default-action screen selects the closest item
  // in the pressed direction, using the screen centre as the origin.
  let ox, oy;
  if (PadNav.index < 0) {
    const scr = PadNav.screen;
    const r = scr.getBoundingClientRect();
    ox = r.left + r.width / 2;
    oy = r.top + r.height / 2;
  } else {
    const cur = PadNav.items[PadNav.index];
    const r = cur.getBoundingClientRect();
    ox = r.left + r.width / 2;
    oy = r.top + r.height / 2;
  }

  let best = -1;
  let bestScore = Infinity;
  for (let i = 0; i < PadNav.items.length; i++) {
    if (i === PadNav.index) continue;
    const r = PadNav.items[i].getBoundingClientRect();
    const ex = r.left + r.width / 2;
    const ey = r.top + r.height / 2;
    const dx = ex - ox;
    const dy = ey - oy;

    let along, perp;
    if (dir === 'up')         { if (dy > -6) continue; along = -dy; perp = Math.abs(dx); }
    else if (dir === 'down')  { if (dy <  6) continue; along =  dy; perp = Math.abs(dx); }
    else if (dir === 'left')  { if (dx > -6) continue; along = -dx; perp = Math.abs(dy); }
    else if (dir === 'right') { if (dx <  6) continue; along =  dx; perp = Math.abs(dy); }
    else continue;

    const score = along + perp * 1.8;
    if (score < bestScore) { bestScore = score; best = i; }
  }

  if (best === -1) {
    if (dir === 'up' || dir === 'left') best = (PadNav.index <= 0 ? PadNav.items.length : PadNav.index) - 1;
    else best = (PadNav.index + 1) % PadNav.items.length;
  }
  PadNav.index = best;
  padApplyFocus();
}

function padActivate() {
  padRefresh();
  const def = padDefaultAction();
  const focused = PadNav.index >= 0 ? PadNav.items[PadNav.index] : null;

  // Special corner buttons win over the default action so the user can
  // still reach Replay / Exit / Skip on the study & dialogue screens.
  const SPECIALS = ['studyReplay', 'studyExit', 'studySkip', 'studyHelp',
                    'guideExit', 'guideBackBtn', 'authClose'];
  const isSpecial = focused && SPECIALS.indexOf(focused.id) !== -1;

  if (!isSpecial && def) { def(); return; }
  if (focused) {
    try { focused.focus(); } catch (_) {}
    focused.click();
    return;
  }
  if (def) { def(); return; }
}

function padBack() {
  if (typeof dialogueScreen !== 'undefined' && dialogueScreen && dialogueScreen.classList.contains('show')) {
    dlgQueue = []; advanceDialogue(); return;
  }
  if (typeof reviewScreen !== 'undefined' && reviewScreen && reviewScreen.classList.contains('show')) {
    reviewScreen.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    reviewScreen.dispatchEvent(new PointerEvent('pointerup',   { bubbles: true }));
    return;
  }
  if (typeof discoveryScreen !== 'undefined' && discoveryScreen && discoveryScreen.classList.contains('show')) {
    closeDiscovery(); return;
  }
  const pauseEl = document.getElementById('pauseScreen');
  if (pauseEl && pauseEl.classList.contains('show')) { resumeFromPause(); return; }
  if (typeof studyScreen !== 'undefined' && studyScreen && studyScreen.classList.contains('show')) {
    endStudy(); return;
  }
  if (typeof manualScreen !== 'undefined' && manualScreen && manualScreen.classList.contains('show')) {
    document.getElementById('closeManualBtn').click(); return;
  }
  const guideEl = document.getElementById('guideScreen');
  if (guideEl && guideEl.classList.contains('show')) { closeGuide(); return; }
  const authEl = document.getElementById('authPanel');
  if (authEl && authEl.classList.contains('show')) {
    document.getElementById('authClose').click(); return;
  }
  if (typeof briefScreen !== 'undefined' && briefScreen && briefScreen.classList.contains('show')) {
    document.getElementById('backHomeBtn').click(); return;
  }
  if (typeof endScreen !== 'undefined' && endScreen && endScreen.classList.contains('show')) {
    document.getElementById('endBackBtn').click(); return;
  }
  // Home / choose / upgrade: nothing to back out of.
}

// ============================================================
//  GAMEPAD — PC / Bluetooth controllers (standard mapping)
// ============================================================
const GamepadInput = {
  index: null,
  name: '',
  connected: false,
  prevButtons: [],
  dpadKeys: { up: false, down: false, left: false, right: false },
  dead: 0.22,
  sprint: 0.72,
};

window.addEventListener('gamepadconnected', (e) => {
  GamepadInput.index = e.gamepad.index;
  GamepadInput.name = e.gamepad.id;
  GamepadInput.connected = true;
  GamepadInput.prevButtons = [];
  initAudio();
  if (ac && ac.state === 'suspended') ac.resume();
  setStatus('Controller linked', e.gamepad.id.slice(0, 46), 'ok', 2400);
  console.log('[gamepad] connected:', e.gamepad.id);
  // Prime pad navigation immediately.
  PadNav.screen = null;
  padRefresh();
});

window.addEventListener('gamepaddisconnected', (e) => {
  if (GamepadInput.index !== e.gamepad.index) return;
  GamepadInput.index = null;
  GamepadInput.name = '';
  GamepadInput.connected = false;
  GamepadInput.prevButtons = [];
  GamepadInput.dpadKeys = { up: false, down: false, left: false, right: false };
  if (G.joy && G.joy.source === 'gamepad') G.joy = null;
  padClearFocus();
  PadNav.screen = null;
  PadNav.items = [];
  PadNav.index = -1;
  setStatus('Controller lost', '', 'warn', 2000);
});

function activeGamepad() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  if (GamepadInput.index !== null) {
    const gp = pads[GamepadInput.index];
    if (gp && gp.connected) return gp;
    GamepadInput.index = null;
    GamepadInput.connected = false;
  }
  for (let i = 0; i < pads.length; i++) {
    const gp = pads[i];
    if (gp && gp.connected) {
      GamepadInput.index = i;
      GamepadInput.name = gp.id;
      GamepadInput.connected = true;
      return gp;
    }
  }
  return null;
}

function padPressed(gp, i) {
  const b = gp.buttons[i];
  return !!(b && (b.pressed || b.value > 0.5));
}
function padJustPressed(gp, i) {
  return padPressed(gp, i) && !GamepadInput.prevButtons[i];
}

// Left-stick -> four-way repeat with a short warm-up.
function padReadStickMove(gp) {
  const now = performance.now();
  const lx = gp.axes[0] || 0;
  const ly = gp.axes[1] || 0;
  let dir = null;
  if (Math.abs(lx) > PadNav.dead || Math.abs(ly) > PadNav.dead) {
    if (Math.abs(lx) > Math.abs(ly)) dir = lx > 0 ? 'right' : 'left';
    else                             dir = ly > 0 ? 'down'  : 'up';
  }
  if (!dir) {
    PadNav.stickDir = null;
    PadNav.stickNextAt = 0;
    return;
  }
  if (dir !== PadNav.stickDir) {
    PadNav.stickDir = dir;
    PadNav.stickNextAt = now + 260;   // initial delay before repeating
    if (now - PadNav.lastMoveAt >= PadNav.moveEchoMs) {
      PadNav.lastMoveAt = now;
      padMove(dir);
    }
    return;
  }
  if (now >= PadNav.stickNextAt) {
    PadNav.stickNextAt = now + PadNav.stickRepeatMs;
    padMove(dir);
  }
}

function pollGamepad() {
  const gp = activeGamepad();
  if (!gp) return;

  const lx = gp.axes[0] || 0;
  const ly = gp.axes[1] || 0;
  const lmag = Math.hypot(lx, ly);

  // Any visible screen means "we are in a menu".
  const inMenu = !!padVisibleScreen();

  if (inMenu) {
    // Menu mode: stick & d-pad navigate, A confirms, B backs out.
    padRefresh();
    padReadStickMove(gp);

    const dUp    = padJustPressed(gp, 12);
    const dDown  = padJustPressed(gp, 13);
    const dLeft  = padJustPressed(gp, 14);
    const dRight = padJustPressed(gp, 15);
    const now = performance.now();
    function tryMove(dir) {
      if (now - PadNav.lastMoveAt < PadNav.moveEchoMs) return;
      PadNav.lastMoveAt = now;
      padMove(dir);
    }
    if (dUp)    tryMove('up');
    if (dDown)  tryMove('down');
    if (dLeft)  tryMove('left');
    if (dRight) tryMove('right');

    const justA     = padJustPressed(gp, 0);
    const justB     = padJustPressed(gp, 1);
    const justStart = padJustPressed(gp, 9);
    if (justA || justStart) { initAudio(); if (ac && ac.state === 'suspended') ac.resume(); padActivate(); }
    if (justB) padBack();

    // Keep prevButtons snapshot up to date and bail out early so gameplay
    // analog input doesn't leak into the menu.
    for (let i = 0; i < gp.buttons.length; i++) {
      GamepadInput.prevButtons[i] = padPressed(gp, i);
    }
    return;
  }

  // ---- Gameplay / no screen up ----
  // Clear any lingering focus ring when we drop into the game.
  if (PadNav.screen) { PadNav.screen = null; PadNav.items = []; PadNav.index = -1; padClearFocus(); }

  if (!touchJoyActive) {
    if (lmag > GamepadInput.dead) {
      const m = Math.min(1, (lmag - GamepadInput.dead) / (1 - GamepadInput.dead));
      G.joy = { x: lx / lmag * m, y: ly / lmag * m, m, source: 'gamepad' };
      G.keys.sprint = lmag > GamepadInput.sprint;
    } else if (G.joy && G.joy.source === 'gamepad') {
      G.joy = null;
      G.keys.sprint = false;
    }
  }

  const rx = gp.axes[2] || 0;
  const ry = gp.axes[3] || 0;
  if (Math.hypot(rx, ry) > GamepadInput.dead && G.player) {
    G.player.angle = Math.atan2(ry, rx);
  }

  const dUp    = padPressed(gp, 12);
  const dDown  = padPressed(gp, 13);
  const dLeft  = padPressed(gp, 14);
  const dRight = padPressed(gp, 15);
  const dpadNow = dUp || dDown || dLeft || dRight;
  const dpadWas = GamepadInput.dpadKeys.up || GamepadInput.dpadKeys.down ||
                  GamepadInput.dpadKeys.left || GamepadInput.dpadKeys.right;

  if (dpadNow) {
    G.keys.up = dUp; G.keys.down = dDown;
    G.keys.left = dLeft; G.keys.right = dRight;
    GamepadInput.dpadKeys = { up: dUp, down: dDown, left: dLeft, right: dRight };
  } else if (dpadWas) {
    if (GamepadInput.dpadKeys.up)    G.keys.up = false;
    if (GamepadInput.dpadKeys.down)  G.keys.down = false;
    if (GamepadInput.dpadKeys.left)  G.keys.left = false;
    if (GamepadInput.dpadKeys.right) G.keys.right = false;
    GamepadInput.dpadKeys = { up: false, down: false, left: false, right: false };
  }

  const justA     = padJustPressed(gp, 0);
  const justB     = padJustPressed(gp, 1);
  const justX     = padJustPressed(gp, 2);
  const justY     = padJustPressed(gp, 3);
  const justStart = padJustPressed(gp, 9);
  const holdLB    = padPressed(gp, 4);
  const holdRB    = padPressed(gp, 5);
  if (holdLB || holdRB) G.keys.sprint = true;

  if (G.running) {
    if (justStart) togglePause();

    if (!G.paused) {
      if (justA) {
        if (G.roomType === 'explore' && G.discoveryNear) openDiscovery(G.discoveryNear);
        else if (G.roomType !== 'explore') { aimAssist(); tryStaff(); }
      }
      if (justB) tryDash();
      if (justX) {
        if (G.roomType === 'explore' && G.discoveryNear) openDiscovery(G.discoveryNear);
        else if (G.roomType !== 'explore') tryBurst();
      }
      if (justY) {
        if (G.roomType === 'explore' && G.discoveryNear) openDiscovery(G.discoveryNear);
      }
    }
  }

  for (let i = 0; i < gp.buttons.length; i++) {
    GamepadInput.prevButtons[i] = padPressed(gp, i);
  }
}
