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
    // Sprint is no longer inferred from stick magnitude on touch —
    // the SPRINT toggle button controls it instead.
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

  // ---------- Sprint toggle ----------
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
});

window.addEventListener('gamepaddisconnected', (e) => {
  if (GamepadInput.index !== e.gamepad.index) return;
  GamepadInput.index = null;
  GamepadInput.name = '';
  GamepadInput.connected = false;
  GamepadInput.prevButtons = [];
  GamepadInput.dpadKeys = { up: false, down: false, left: false, right: false };
  if (G.joy && G.joy.source === 'gamepad') G.joy = null;
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

function pollGamepad() {
  const gp = activeGamepad();
  if (!gp) return;

  const lx = gp.axes[0] || 0;
  const ly = gp.axes[1] || 0;
  const lmag = Math.hypot(lx, ly);

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

  const inMenu = !G.running || G.paused || G.userPaused;

  if (inMenu && (justA || justStart)) {
    initAudio();
    if (ac && ac.state === 'suspended') ac.resume();
    gamepadMenuAction();
  } else if (G.running) {
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

function gamepadMenuAction() {
  if (dialogueScreen.classList.contains('show')) { advanceDialogue(); return true; }

  if (reviewScreen.classList.contains('show')) {
    reviewScreen.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    reviewScreen.dispatchEvent(new PointerEvent('pointerup',   { bubbles: true }));
    return true;
  }

  if (typeof discoveryScreen !== 'undefined' && discoveryScreen &&
      discoveryScreen.classList.contains('show')) { closeDiscovery(); return true; }

  if ($('pauseScreen').classList.contains('show')) { resumeFromPause(); return true; }

  if (studyScreen.classList.contains('show')) { nextStudyStep(); return true; }

  if (manualScreen.classList.contains('show')) {
    $('closeManualBtn').click(); return true;
  }

  if (endScreen.classList.contains('show')) {
    $('againBtn').click(); return true;
  }

  if (chooseScreen.classList.contains('show')) {
    $('claimBtn').click(); return true;
  }

  if (briefScreen.classList.contains('show')) {
    $('startBtn').click(); return true;
  }

  if (homeScreen.classList.contains('show')) {
    const first = lessonGrid.querySelector('.lesson-card');
    if (first) { first.click(); return true; }
  }

  return false;
}
