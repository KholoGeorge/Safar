// ============================================================
//  render3d.js — Three.js renderer, "Lone Wanderer" art direction.
//
//  Reads the same G state as the 2D renderer. Coordinates convert:
//    2D x  ->  3D x
//    2D y  ->  3D z
//    2D up ->  3D -z  (north)
//  Never mutates G.
// ============================================================

const R3D = {
  renderer: null,
  scene: null,
  camera: null,
  sun: null,
  ambient: null,
  hemi: null,
  playerLight: null,
  PPU: 30,
  roomKey: '',
  ready: false,

  playerMesh: null,
  shieldMesh: null,
  lanternLight: null,
  warnRing: null,

  bossMesh: null,
  bossEyes: null,
  bossAura: null,

  stormMesh: null,
  stormParticles: null,
  stormEdge: null,

  floorMesh: null,
  skyBg: null,
  walls: [],
  ambientDust: null,
  exitArch: null,
  rafiqMesh: null,
  driftSand: null,

  gates: new Map(),
  obstacles: new Map(),
  orbs: new Map(),
  projectiles: new Map(),
  particles: new Map(),
  rings: new Map(),
  discoveries: new Map(),
  footprints: new Map(),
  shadows: new Map(),

  labelCache: new Map(),
  sandTex: null,

  camH: 9,
  camD: 8,
  lookFwd: 4,
};

const GATE_GLOW_RANGE = 220;

// ============================================================
//  Init
// ============================================================
function init3D() {
  if (R3D.ready) return false;
  if (!window.THREE) { console.error('render3d: THREE not loaded'); return false; }

  const oldCanvas = document.getElementById('game');
  if (!oldCanvas) return false;

  const canvas = document.createElement('canvas');
  canvas.id = 'game';
  canvas.className = oldCanvas.className;
  canvas.style.cssText = oldCanvas.style.cssText;
  oldCanvas.parentNode.replaceChild(canvas, oldCanvas);

  R3D.renderer = new THREE.WebGLRenderer({ canvas, antialias: !IS_SLOW, alpha: false });
  R3D.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, IS_SLOW ? 1 : 2));
  R3D.renderer.setClearColor(0x1a120a, 1);

  R3D.scene = new THREE.Scene();
  R3D.scene.fog = new THREE.Fog(0x3a2818, 30, 80);
  R3D.scene.background = mkSkyTexture();

  R3D.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 400);

  R3D.ambient = new THREE.AmbientLight(0x6a5040, 0.95);
  R3D.scene.add(R3D.ambient);

  R3D.hemi = new THREE.HemisphereLight(0x5a4030, 0x1a0f05, 0.7);
  R3D.scene.add(R3D.hemi);

  R3D.sun = new THREE.DirectionalLight(0xd8d0b0, 0.55);
  R3D.sun.position.set(-8, 20, -12);
  R3D.scene.add(R3D.sun);

  R3D.playerLight = new THREE.PointLight(0xffd080, 5.5, 26, 2);
  R3D.playerLight.position.set(0, 1.6, 0);
  R3D.scene.add(R3D.playerLight);

  R3D.ready = true;
  resize3D();
  window.addEventListener('resize', resize3D);
  window.addEventListener('orientationchange', () => setTimeout(resize3D, 120));
  return true;
}

function resize3D() {
  if (!R3D.ready) return;
  const w = window.innerWidth, h = window.innerHeight;
  R3D.renderer.setSize(w, h, false);
  R3D.camera.aspect = w / h;
  R3D.camera.updateProjectionMatrix();
  updateCamera();
}

function updateCamera() {
  if (!R3D.ready) return;
  const aspect = window.innerWidth / window.innerHeight;
  let fov, camH, camD, lookFwd;
  if (aspect >= 1.4) {
    fov = 55; camH = 9;  camD = 8;  lookFwd = 4;
  } else if (aspect >= 1.0) {
    fov = 58; camH = 10; camD = 9;  lookFwd = 4;
  } else if (aspect >= 0.75) {
    fov = 58; camH = 11; camD = 9;  lookFwd = 5;
  } else if (aspect >= 0.55) {
    fov = 55; camH = 10; camD = 8;  lookFwd = 5;
  } else {
    fov = 55; camH = 9;  camD = 7;  lookFwd = 5;
  }
  R3D.camera.fov = fov;
  R3D.camH = camH;
  R3D.camD = camD;
  R3D.lookFwd = lookFwd;
  R3D.camera.updateProjectionMatrix();
}

// ============================================================
//  Coordinate helpers
// ============================================================
function r3x(px) { return (px - R3D.ox) / R3D.PPU; }
function r3z(py) { return (py - R3D.oy) / R3D.PPU; }
function r3s(px) { return px / R3D.PPU; }

function col(hex) { return new THREE.Color(hex); }

function disposeGroup(group) {
  if (!group) return;
  group.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
      else o.material.dispose();
    }
  });
  if (group.parent) group.parent.remove(group);
}

// ============================================================
//  Procedural textures
// ============================================================
function mkSkyTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 512;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, '#050301');
  g.addColorStop(0.55, '#140a04');
  g.addColorStop(1, '#2a1a0a');
  x.fillStyle = g;
  x.fillRect(0, 0, 1024, 512);

  for (let i = 0; i < 300; i++) {
    const a = Math.random() * 0.7 + 0.1;
    x.fillStyle = `rgba(255,240,200,${a})`;
    x.fillRect(Math.random() * 1024, Math.random() * 300, 1.5, 1.5);
  }
  x.beginPath();
  x.arc(820, 100, 34, 0, Math.PI * 2);
  x.fillStyle = '#f5e0b0';
  x.shadowColor = '#f5e0b0';
  x.shadowBlur = 60;
  x.fill();
  x.shadowBlur = 0;
  const hg = x.createRadialGradient(820, 100, 20, 820, 100, 130);
  hg.addColorStop(0, 'rgba(245,224,176,0.35)');
  hg.addColorStop(1, 'rgba(245,224,176,0)');
  x.fillStyle = hg;
  x.beginPath();
  x.arc(820, 100, 130, 0, Math.PI * 2);
  x.fill();

  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function mkSandTexture() {
  if (R3D.sandTex) return R3D.sandTex;
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const x = c.getContext('2d');
  x.fillStyle = '#5a4a28';
  x.fillRect(0, 0, 512, 512);

  const img = x.getImageData(0, 0, 512, 512);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 32;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i+1] = Math.max(0, Math.min(255, d[i+1] + n));
    d[i+2] = Math.max(0, Math.min(255, d[i+2] + n));
  }
  x.putImageData(img, 0, 0);

  x.strokeStyle = 'rgba(160,130,90,0.30)';
  x.lineWidth = 1.2;
  for (let y = 0; y < 512; y += 6) {
    x.beginPath();
    x.moveTo(0, y);
    x.bezierCurveTo(128, y + Math.sin(y * 0.08) * 4,
                    384, y + Math.cos(y * 0.06) * 4,
                    512, y);
    x.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 5);
  tex.colorSpace = THREE.SRGBColorSpace;
  R3D.sandTex = tex;
  return tex;
}

function labelTexture(text, isArabic) {
  const key = text + '|' + (isArabic ? 'ar' : 'en');
  let hit = R3D.labelCache.get(key);
  if (hit) return hit;

  const c = document.createElement('canvas');
  const x = c.getContext('2d');
  const font = isArabic
    ? '700 60px "Noto Naskh Arabic", "Geeza Pro", "Traditional Arabic", serif'
    : '600 60px "Inter", system-ui, sans-serif';
  x.font = font;
  const w = Math.ceil(x.measureText(text).width + 80);
  const h = 110;
  c.width = w; c.height = h;

  x.font = font;
  x.direction = isArabic ? 'rtl' : 'ltr';
  x.textAlign = 'center';
  x.textBaseline = 'middle';

  // Brighter tablet background so the text is easier to read at distance.
  x.fillStyle = '#4a3f28';
  x.fillRect(0, 0, w, h);
  x.strokeStyle = '#f0c85a';
  x.lineWidth = 6;
  x.strokeRect(4, 4, w - 8, h - 8);
  x.strokeStyle = '#8a7a5a';
  x.lineWidth = 2;
  x.strokeRect(11, 11, w - 22, h - 22);

  x.fillStyle = '#fff5d0';
  x.shadowColor = '#d4af37';
  x.shadowBlur = 12;
  x.fillText(text, w / 2, h / 2 + 2);

  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  R3D.labelCache.set(key, tex);
  return tex;
}

const SHADOW_GEO = new THREE.CircleGeometry(1, 16);
const SHADOW_MAT = new THREE.MeshBasicMaterial({
  color: 0x000000, transparent: true, opacity: 0.55, depthWrite: false,
});

function mkShadow(parent, radius) {
  const m = new THREE.Mesh(SHADOW_GEO, SHADOW_MAT);
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.02;
  m.scale.setScalar(radius);
  parent.add(m);
  return m;
}

// ============================================================
//  Room build
// ============================================================
function buildRoom3D() {
  disposeGroup(R3D.floorMesh); R3D.floorMesh = null;
  R3D.walls.forEach(w => disposeGroup(w)); R3D.walls = [];
  R3D.gates.forEach(g => disposeGroup(g)); R3D.gates.clear();
  R3D.obstacles.forEach(g => disposeGroup(g)); R3D.obstacles.clear();
  disposeGroup(R3D.stormMesh); R3D.stormMesh = null;
  if (R3D.stormParticles) { disposeGroup(R3D.stormParticles); R3D.stormParticles = null; }
  disposeGroup(R3D.stormEdge); R3D.stormEdge = null;
  if (R3D.ambientDust) { disposeGroup(R3D.ambientDust); R3D.ambientDust = null; }
  if (R3D.exitArch) { disposeGroup(R3D.exitArch); R3D.exitArch = null; }
  if (R3D.rafiqMesh) { disposeGroup(R3D.rafiqMesh); R3D.rafiqMesh = null; }
  if (R3D.driftSand) { disposeGroup(R3D.driftSand); R3D.driftSand = null; }

  const b = G.bounds;
  R3D.ox = (b.l + b.r) / 2;
  R3D.oy = (b.t + b.b) / 2;
  const W = r3s(b.r - b.l);
  const D = r3s(b.b - b.t);

  const floorW = W + 16;
  const floorD = D + 16;
  const floorMat = new THREE.MeshStandardMaterial({
    map: mkSandTexture(),
    color: 0xffffff,
    roughness: 0.95,
    metalness: 0,
  });
  R3D.floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(floorW, floorD), floorMat);
  R3D.floorMesh.rotation.x = -Math.PI / 2;
  R3D.floorMesh.position.y = -0.01;
  R3D.scene.add(R3D.floorMesh);

  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x6a5a3a, roughness: 0.9 });
  const tallStoneMat = new THREE.MeshStandardMaterial({ color: 0x5a4a30, roughness: 0.9 });

  const wallH = 3.2;
  const mkWall = (w, d, x, z, h, mat) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat || stoneMat);
    m.position.set(x, h / 2, z);
    R3D.scene.add(m);
    R3D.walls.push(m);
  };
  mkWall(W + 2, 0.6, 0, -D / 2, wallH + 1.0, tallStoneMat);
  mkWall(W + 2, 0.6, 0,  D / 2, 0.8, tallStoneMat);
  function brokenSide(sign) {
    let z = -D / 2;
    while (z < D / 2) {
      const segLen = rand(2.5, 5);
      const gap = rand(0.8, 2.2);
      const h = rand(1.4, wallH);
      mkWall(0.5, Math.min(segLen, D / 2 - z), sign * (W / 2), z + Math.min(segLen, D / 2 - z) / 2, h);
      z += segLen + gap;
    }
  }
  brokenSide(-1);
  brokenSide(1);

  for (let i = 0; i < 4; i++) {
    const p = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.35, rand(0.8, 2.2), 6),
      stoneMat
    );
    const rx = rand(-W / 2 + 1, W / 2 - 1);
    const rz = rand(-D / 2 + 1, D / 2 - 1);
    p.position.set(rx, 0.5, rz);
    p.rotation.z = rand(-0.15, 0.15);
    p.rotation.x = rand(-0.15, 0.15);
    R3D.scene.add(p);
    R3D.walls.push(p);
  }

  const dustCount = IS_SLOW ? 120 : 300;
  const dustGeo = new THREE.BufferGeometry();
  const positions = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    positions[i * 3] = rand(-floorW / 2, floorW / 2);
    positions[i * 3 + 1] = rand(0.2, 4);
    positions[i * 3 + 2] = rand(-floorD / 2, floorD / 2);
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const dustMat = new THREE.PointsMaterial({
    color: 0xd4b878, size: 0.07, transparent: true, opacity: 0.5,
    depthWrite: false, blending: THREE.AdditiveBlending,
  });
  R3D.ambientDust = new THREE.Points(dustGeo, dustMat);
  R3D.scene.add(R3D.ambientDust);

  if (G.weather === 'dust' || G.weather === 'storm') {
    buildStorm(W, D);
  }
  if (G.roomType !== 'reflection') {
    buildExitArch(W, D);
  }

    if (G.roomType === 'reflection' && G.currentLesson && G.currentLesson.length) {
    buildReflectionStones(W, D);
  }

  if (G.weather === 'drift') {
    buildDriftSand(W, D);
  }
}

// ============================================================
//  Reflection stones — a few faint inscriptions on the ruins.
//  Each one is a phrase from the lesson. Only readable up close.
//  No wall of text. Just quiet stones you can walk past or read.
// ============================================================
function buildReflectionStones(W, D) {
  const phrases = G.currentLesson || [];
  if (!phrases.length) return;

  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x4a3f2a, roughness: 0.95 });

  // Four stones, spread around the room, not blocking the path.
  const places = [
    { x: -W * 0.35, z: -D * 0.10, ry: Math.PI * 0.85 },
    { x:  W * 0.35, z:  D * 0.10, ry: -Math.PI * 0.85 },
    { x: -W * 0.10, z:  D * 0.30, ry: Math.PI },
    { x:  W * 0.10, z: -D * 0.30, ry: 0 },
  ];

  const chosen = shuffle(phrases.slice(), Math.random).slice(0, places.length);

  for (let i = 0; i < chosen.length; i++) {
    const item = chosen[i];
    const p = places[i];

    const group = new THREE.Group();
    group.position.set(p.x, 0, p.z);
    group.rotation.y = p.ry;

    // The stone itself — a flat slab, waist-high
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 1.6, 0.25),
      stoneMat
    );
    slab.position.y = 0.8;
    group.add(slab);

    // Faint inscription — Arabic on top, English underneath, small and dim
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d');
    c.width = 512;
    c.height = 320;
    ctx.clearRect(0, 0, c.width, c.height);

    ctx.font = '600 52px "Noto Naskh Arabic", "Geeza Pro", serif';
    ctx.direction = 'rtl';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(245, 210, 74, 0.55)';
    ctx.shadowColor = 'rgba(212, 175, 55, 0.7)';
    ctx.shadowBlur = 14;
    ctx.fillText(item.ar || '', c.width / 2, 130);

    ctx.font = '500 26px "Inter", system-ui, sans-serif';
    ctx.direction = 'ltr';
    ctx.shadowBlur = 6;
    ctx.fillStyle = 'rgba(200, 184, 138, 0.55)';
    ctx.fillText(item.en || '', c.width / 2, 220);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;

    const inscription = new THREE.Mesh(
      new THREE.PlaneGeometry(1.0, 0.625),
      new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
      })
    );
    inscription.position.set(0, 0.85, 0.14);
    group.add(inscription);

    R3D.scene.add(group);
    R3D.walls.push(group);
  }
}

function buildStorm(W, D) {
  const stormGroup = new THREE.Group();

  const stormMat = new THREE.MeshBasicMaterial({
    color: 0x3a2a14, transparent: true, opacity: 0.95,
  });
  const wall = new THREE.Mesh(new THREE.BoxGeometry(W + 4, 8, 2.5), stormMat);
  wall.position.y = 4;
  stormGroup.add(wall);

  const count = IS_SLOW ? 80 : 200;
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const velocities = [];
  for (let i = 0; i < count; i++) {
    positions[i * 3] = rand(-W / 2, W / 2);
    positions[i * 3 + 1] = rand(0.3, 5.5);
    positions[i * 3 + 2] = rand(-1.5, 0);
    velocities.push({ vy: rand(0.5, 1.5) });
  }
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xd4b878, size: 0.14, transparent: true, opacity: 0.7,
    depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(geo, mat);
  stormGroup.add(pts);

  stormGroup.userData.particles = pts;
  stormGroup.userData.velocities = velocities;
  stormGroup.userData.wall = wall;

  const edge = new THREE.Mesh(
    new THREE.BoxGeometry(W + 4, 0.1, 0.1),
    new THREE.MeshBasicMaterial({ color: 0xd4af37 })
  );
  edge.position.y = 0.15;
  stormGroup.add(edge);

  R3D.stormMesh = stormGroup;
  R3D.scene.add(stormGroup);
}

function buildExitArch(W, D) {
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x7a6a48, roughness: 0.85 });
  const archGroup = new THREE.Group();
  const archW = 2.6, archH = 3.4;
  const z = -D / 2 + 0.4;

  const pillars = [];
  const mkPillar = (x) => {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, archH, 8), stoneMat.clone());
    p.position.set(x, archH / 2, z);
    archGroup.add(p);
    pillars.push(p);
  };
  mkPillar(-archW / 2);
  mkPillar( archW / 2);

  const arcGeo = new THREE.TorusGeometry(archW / 2, 0.18, 6, 12, Math.PI);
  const arc = new THREE.Mesh(arcGeo, stoneMat);
  arc.rotation.z = Math.PI;
  arc.position.set(0, archH, z);
  archGroup.add(arc);

  const veil = new THREE.Mesh(
    new THREE.PlaneGeometry(archW - 0.2, archH * 0.9),
    new THREE.MeshBasicMaterial({
      color: 0xd4af37, transparent: true, opacity: 0.15,
      depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    })
  );
  veil.position.set(0, archH * 0.5, z - 0.1);
  archGroup.userData.veil = veil;
  archGroup.add(veil);

  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9, 1.1, 8, 12, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xf5d24a, transparent: true, opacity: 0,
      depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    })
  );
  beam.position.set(0, archH + 3, z);
  archGroup.userData.beam = beam;
  archGroup.add(beam);

  archGroup.userData.pillars = pillars;

  R3D.scene.add(archGroup);
  R3D.exitArch = archGroup;
}


// ============================================================
//  Drift sand — horizontal particles for 'drift' weather.
// ============================================================
function buildDriftSand(W, D) {
  const count = IS_SLOW ? 60 : 140;
  const geo = new THREE.BufferGeometry();
  const arr = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    arr[i * 3] = rand(-W / 2, W / 2);
    arr[i * 3 + 1] = rand(0.1, 2.5);
    arr[i * 3 + 2] = rand(-D / 2, D / 2);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xd4b878, size: 0.09, transparent: true, opacity: 0.55,
    depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(geo, mat);
  R3D.driftSand = pts;
  R3D.scene.add(pts);
}

function syncDriftSand(dt) {
  if (!R3D.driftSand) return;
  const arr = R3D.driftSand.geometry.attributes.position.array;
  const W = r3s(G.bounds.r - G.bounds.l);
  for (let i = 0; i < arr.length; i += 3) {
    arr[i] += dt * 6;
    if (arr[i] > W / 2) arr[i] = -W / 2;
  }
  R3D.driftSand.geometry.attributes.position.needsUpdate = true;
}

// ============================================================
//  Per-frame
// ============================================================
function render3D(now) {
  if (!R3D.ready && !init3D()) return;
  if (!G.bounds || G.bounds.r === 0) return;

  const roomKey = G.bounds.l + ':' + G.bounds.r + ':' + G.roomIdx + ':' + G.roomType + ':' + G.weather;
  if (roomKey !== R3D.roomKey) {
    R3D.roomKey = roomKey;
    buildRoom3D();
  }

  const p = G.player;
  if (p) {
    const px = r3x(p.x);
    const pz = r3z(p.y);
    const shakeMag = (now < G.shakeUntil) ? G.shakeMag * Math.max(0, (G.shakeUntil - now) / 400) : 0;
    const sx = shakeMag ? rand(-shakeMag, shakeMag) / 80 : 0;
    const sy = shakeMag ? rand(-shakeMag, shakeMag) / 80 : 0;

    R3D.camera.position.set(px + sx, R3D.camH + sy, pz + R3D.camD + sy);
    R3D.camera.lookAt(px, 1, pz - R3D.lookFwd);

    if (R3D.playerLight) R3D.playerLight.position.set(px, 1.6, pz);
  } else {
    R3D.camera.position.set(0, R3D.camH, R3D.camD);
    R3D.camera.lookAt(0, 1, -R3D.lookFwd);
  }

  syncPlayer();
  syncStorm(now);
  syncObstacles();
  syncGates(now);
  syncDiscoveries(now);
  syncOrbs();
  syncBoss(now);
  syncProjectiles();
  syncParticles();
  syncRings();
  syncFootprints();
  syncAmbientDust(now);
  syncExitArch(now);
  syncRafiq();
  if (G.weather === 'drift') syncDriftSand(0.016);

  if (now < G.flashUntil) {
    const t = (G.flashUntil - now) / 300;
    const a = G.flashAlpha * Math.max(0, t);
    R3D.renderer.setClearColor(new THREE.Color(G.flashColor), a);
  } else {
    R3D.renderer.setClearColor(0x1a120a, 1);
  }

  R3D.renderer.render(R3D.scene, R3D.camera);
}

// ============================================================
//  Syncs
// ============================================================
function syncPlayer() {
  const p = G.player;
  if (!p) {
    if (R3D.playerMesh) { disposeGroup(R3D.playerMesh); R3D.playerMesh = null; R3D.shieldMesh = null; R3D.warnRing = null; }
    return;
  }
  const r = r3s(p.radius);

  if (!R3D.playerMesh) {
    const g = new THREE.Group();

    const robe = new THREE.Mesh(
      new THREE.ConeGeometry(r * 1.3, r * 2.6, 10),
      new THREE.MeshStandardMaterial({ color: 0x1a1208, roughness: 0.95 })
    );
    robe.position.y = r * 1.3;
    g.add(robe);

    const hood = new THREE.Mesh(
      new THREE.SphereGeometry(r * 0.75, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0x1a1208, roughness: 0.95 })
    );
    hood.position.y = r * 2.9;
    g.add(hood);

    const face = new THREE.Mesh(
      new THREE.SphereGeometry(r * 0.35, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xf5d24a })
    );
    face.position.set(r * 0.35, r * 2.8, r * 0.55);
    g.add(face);

    const armGroup = new THREE.Group();
    const arm = new THREE.Mesh(
      new THREE.CylinderGeometry(r * 0.15, r * 0.15, r * 1.4, 6),
      new THREE.MeshStandardMaterial({ color: 0x1a1208 })
    );
    arm.rotation.z = -Math.PI / 3;
    arm.position.set(r * 0.9, r * 2.0, 0);
    armGroup.add(arm);

    const lanternBody = new THREE.Mesh(
      new THREE.CylinderGeometry(r * 0.35, r * 0.42, r * 0.7, 6),
      new THREE.MeshStandardMaterial({ color: 0x8a6a3d, emissive: 0xf5c060, emissiveIntensity: 1.4 })
    );
    lanternBody.position.set(r * 1.8, r * 1.4, r * 0.3);
    armGroup.add(lanternBody);

    const lanternTop = new THREE.Mesh(
      new THREE.ConeGeometry(r * 0.4, r * 0.4, 6),
      new THREE.MeshStandardMaterial({ color: 0x3a2a10 })
    );
    lanternTop.position.set(r * 1.8, r * 1.95, r * 0.3);
    armGroup.add(lanternTop);

    g.add(armGroup);

    const beacon = new THREE.Mesh(
      new THREE.ConeGeometry(r * 0.3, r * 1.2, 6),
      new THREE.MeshBasicMaterial({ color: 0xd4af37 })
    );
    beacon.rotation.x = Math.PI / 2;
    beacon.position.set(0, r * 1.3, r * 1.2);
    g.add(beacon);

    mkShadow(g, r * 1.6);

    const warnRing = new THREE.Mesh(
      new THREE.RingGeometry(r * 1.7, r * 2.0, 32),
      new THREE.MeshBasicMaterial({
        color: 0xb03a3a, transparent: true, opacity: 0,
        side: THREE.DoubleSide, depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    warnRing.rotation.x = -Math.PI / 2;
    warnRing.position.y = 0.04;
    g.add(warnRing);
    R3D.warnRing = warnRing;

    R3D.playerMesh = g;
    R3D.scene.add(g);
  }

  const stunned = nowMs() < G.stunUntil;
  R3D.playerMesh.position.set(r3x(p.x), 0, r3z(p.y));
  R3D.playerMesh.rotation.y = -p.angle;

  const robeMesh = R3D.playerMesh.children[0];
  robeMesh.material.color.setHex(stunned ? 0x8a2020 : 0x1a1208);

  if (R3D.playerLight) {
    R3D.playerLight.intensity = 5.0 + Math.sin(performance.now() / 90) * 0.5 + Math.random() * 0.3;
  }

  if (G.shield && !R3D.shieldMesh) {
    const s = new THREE.Mesh(
      new THREE.SphereGeometry(r * 2.4, 16, 12),
      new THREE.MeshBasicMaterial({
        color: 0x7ab8c9, wireframe: true, transparent: true, opacity: 0.7,
      })
    );
    s.position.y = r * 1.8;
    R3D.playerMesh.add(s);
    R3D.shieldMesh = s;
  } else if (!G.shield && R3D.shieldMesh) {
    R3D.playerMesh.remove(R3D.shieldMesh);
    R3D.shieldMesh.geometry.dispose();
    R3D.shieldMesh.material.dispose();
    R3D.shieldMesh = null;
  }
  if (R3D.shieldMesh) R3D.shieldMesh.material.opacity = 0.6 + 0.2 * Math.sin(performance.now() / 150);

  if (R3D.warnRing) {
    let nearest = Infinity;
    for (let i = 0; i < G.orbs.length; i++) {
      const o = G.orbs[i];
      if (o.dead) continue;
      const d = Math.hypot(o.x - p.x, o.y - p.y);
      if (d < nearest) nearest = d;
    }
    const warnStart = 190;
    const warnFull  = 70;
    let k = 0;
    if (nearest < warnStart) {
      k = 1 - (nearest - warnFull) / (warnStart - warnFull);
      k = Math.max(0, Math.min(1, k));
    }
    const pulse = 0.7 + 0.3 * Math.sin(performance.now() / 120);
    R3D.warnRing.material.opacity = k * 0.55 * pulse;
  }
}

function syncStorm(now) {
  if (!R3D.stormMesh) return;
  if (G.weather === 'clear' || G.weather === 'drift') return;
  const z = r3z(G.stormY);
  R3D.stormMesh.position.set(0, 0, z);

  const camZ = R3D.camera.position.z;
  const dz = camZ - z;
  const wallFade = dz < 14 ? Math.max(0, (dz - 4) / 10) : 1;

  const wall = R3D.stormMesh.userData.wall;
  if (wall) {
    wall.material.opacity = 0.95 * wallFade;
    wall.visible = wallFade > 0.01;
    wall.position.y = 4;
  }

  const plume = R3D.stormMesh.userData.particles;
  if (plume) plume.material.opacity = 0.7 * wallFade;

  const pts = R3D.stormMesh.userData.particles;
  const vels = R3D.stormMesh.userData.velocities;
  if (pts && vels) {
    const arr = pts.geometry.attributes.position.array;
    const dt = 0.016;
    for (let i = 0; i < vels.length; i++) {
      arr[i * 3 + 1] += vels[i].vy * dt;
      if (arr[i * 3 + 1] > 6) arr[i * 3 + 1] = 0.3;
    }
    pts.geometry.attributes.position.needsUpdate = true;
  }
}

function syncObstacles() {
  const live = new Set();
  for (let i = 0; i < G.obstacles.length; i++) {
    const o = G.obstacles[i];
    const id = 'obs_' + i;
    live.add(id);
    let m = R3D.obstacles.get(id);
    if (!m) {
      m = new THREE.Mesh(
        new THREE.CylinderGeometry(r3s(o.r), r3s(o.r) * 1.1, r3s(o.r) * 2.2, 10),
        new THREE.MeshStandardMaterial({ color: 0x4a3f2a, roughness: 0.95 })
      );
      R3D.scene.add(m);
      mkShadow(m, r3s(o.r) * 1.4);
      R3D.obstacles.set(id, m);
    }
    m.position.set(r3x(o.x), r3s(o.r) * 1.1, r3z(o.y));
  }
  R3D.obstacles.forEach((m, id) => {
    if (!live.has(id)) { disposeGroup(m); R3D.obstacles.delete(id); }
  });
}

function syncGates(now) {
  const live = new Set();
  for (let i = 0; i < G.gates.length; i++) {
    const g = G.gates[i];
    const id = 'gate_' + i;
    live.add(id);
    let entry = R3D.gates.get(id);

    const label = (G.mode === 'en-ar')
      ? renderAr(g.item, G.gates.map(x => x.item), G.reading)
      : g.item.en;
    const isArabic = G.mode === 'en-ar';
    const texKey = label + '|' + (isArabic ? 'ar' : 'en') + '|' + (g.done ? 'done' : 'live');

    if (!entry) {
      entry = buildGate(g, label, isArabic);
      R3D.scene.add(entry);
      R3D.gates.set(id, entry);
    }

    if (entry.userData.texKey !== texKey) {
      const tex = labelTexture(label, isArabic);
      entry.userData.tablet.material.map = tex;
      entry.userData.tablet.material.needsUpdate = true;
      const aspect = tex.image.width / tex.image.height;
      const h = 0.9;
      const w = Math.min(2.8, h * aspect);
      entry.userData.tablet.scale.set(
        w / entry.userData.tablet.geometry.parameters.width,
        h / entry.userData.tablet.geometry.parameters.height,
        1
      );
      entry.userData.texKey = texKey;
    }

    entry.position.set(r3x(g.x), 0, r3z(g.y));
    entry.rotation.y = g.isLeft ? 0 : Math.PI;

    // Billboard the tablet toward the camera so it's always readable,
    // regardless of which side of the corridor the gate is on.
    const camPos = R3D.camera.position;
    const dxc = camPos.x - entry.position.x;
    const dzc = camPos.z - entry.position.z;
    entry.userData.tablet.rotation.y = Math.atan2(dxc, dzc) - entry.rotation.y;

    let gateOn = false;
    const p = G.player;
    if (p) {
      const d = Math.hypot(p.x - g.x, p.y - g.y);
      gateOn = d < GATE_GLOW_RANGE;
    }
    if (g.done) gateOn = false;

    const veil = entry.userData.veil;
    const targetOp = gateOn ? 0.55 : 0.08;
    veil.material.opacity += (targetOp - veil.material.opacity) * 0.15;

    const pillarEmissive = gateOn ? 0x8a6a2d : 0x000000;
    entry.userData.pillars.forEach(pm => pm.material.emissive.setHex(pillarEmissive));
    entry.userData.pillars.forEach(pm => {
      pm.material.emissiveIntensity = gateOn ? 0.7 + 0.3 * Math.sin(now / 260 + i) : 0;
    });

    const t = performance.now();
    if (t < g.correctFlashUntil) {
      const a = (g.correctFlashUntil - t) / 600;
      veil.material.color.setHex(0xffe680);
      veil.material.opacity = Math.max(veil.material.opacity, a * 0.85);
    } else if (g.wrongFlashUntil && t < g.wrongFlashUntil) {
      const a = (g.wrongFlashUntil - t) / 900;
      veil.material.color.setHex(0xb03a3a);
      veil.material.opacity = Math.max(veil.material.opacity, a * 0.85);
    } else {
      veil.material.color.setHex(g.done ? 0x5a4a2a : 0xd4af37);
    }

    entry.userData.tablet.material.opacity = g.done ? 0.4 : (gateOn ? 1 : 0.85);
  }

  R3D.gates.forEach((m, id) => {
    if (!live.has(id)) { disposeGroup(m); R3D.gates.delete(id); }
  });
}

function buildGate(g, label, isArabic) {
  const group = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x6a5a3a, roughness: 0.9 });
  const archW = 2.0;
  const archH = 3.0;

  const pillars = [];
  function mkPillar(z) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, archH, 8), stoneMat.clone());
    p.position.set(0, archH / 2, z);
    group.add(p);
    pillars.push(p);
  }
  mkPillar(-archW / 2);
  mkPillar( archW / 2);

  const arc = new THREE.Mesh(new THREE.TorusGeometry(archW / 2, 0.16, 6, 12, Math.PI), stoneMat);
  arc.rotation.y = Math.PI / 2;
  arc.rotation.z = Math.PI;
  arc.position.set(0, archH, 0);
  group.add(arc);

  const veil = new THREE.Mesh(
    new THREE.PlaneGeometry(archW - 0.1, archH * 0.9),
    new THREE.MeshBasicMaterial({
      color: 0xd4af37, transparent: true, opacity: 0.08,
      depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    })
  );
  veil.rotation.y = Math.PI / 2;
  veil.position.set(0.02, archH * 0.5, 0);
  group.add(veil);

  const tex = labelTexture(label, isArabic);
  const aspect = tex.image.width / tex.image.height;
  const th = 0.9;
  const tw = Math.min(2.8, th * aspect);
  const tablet = new THREE.Mesh(
    new THREE.PlaneGeometry(tw, th),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 1, side: THREE.DoubleSide })
  );
  // No initial rotation — syncGates billboards it every frame.
  tablet.position.set(0, archH + 0.6, 0);
  group.add(tablet);

  mkShadow(group, archW * 0.6);

  group.userData.pillars = pillars;
  group.userData.veil = veil;
  group.userData.tablet = tablet;
  group.userData.texKey = '';
  return group;
}

function syncDiscoveries(now) {
  const live = new Set();
  for (let i = 0; i < G.discoveries.length; i++) {
    const d = G.discoveries[i];
    if (d.found) continue;
    const id = 'disc_' + i;
    live.add(id);
    let entry = R3D.discoveries.get(id);
    if (!entry) {
      entry = new THREE.Group();
      const pedestal = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.5, 0.9, 8),
        new THREE.MeshStandardMaterial({ color: 0x4a3f2a, roughness: 0.9 })
      );
      pedestal.position.y = 0.45;
      entry.add(pedestal);

      const orb = new THREE.Mesh(
        new THREE.SphereGeometry(0.3, 16, 12),
        new THREE.MeshBasicMaterial({ color: 0xf5d24a })
      );
      orb.position.y = 1.4;
      entry.add(orb);
      entry.userData.orb = orb;

      const halo = new THREE.Mesh(
        new THREE.SphereGeometry(0.55, 12, 10),
        new THREE.MeshBasicMaterial({
          color: 0xd4af37, transparent: true, opacity: 0.3,
          blending: THREE.AdditiveBlending, depthWrite: false,
        })
      );
      halo.position.y = 1.4;
      entry.add(halo);
      entry.userData.halo = halo;

      mkShadow(entry, 0.55);

      R3D.scene.add(entry);
      R3D.discoveries.set(id, entry);
    }
    const bob = Math.sin(now / 500 + d.bob) * 0.15;
    entry.position.set(r3x(d.x), 0, r3z(d.y));
    entry.userData.orb.position.y = 1.4 + bob;
    entry.userData.halo.position.y = 1.4 + bob;
    entry.userData.halo.scale.setScalar(1 + Math.sin(now / 400 + d.bob) * 0.15);
  }
  R3D.discoveries.forEach((m, id) => {
    if (!live.has(id)) { disposeGroup(m); R3D.discoveries.delete(id); }
  });
}

function syncOrbs() {
  const live = new Set();
  const p = G.player;
  for (let i = 0; i < G.orbs.length; i++) {
    const o = G.orbs[i];
    if (o.dead) continue;
    const id = 'orb_' + o.id;
    live.add(id);
    let entry = R3D.orbs.get(id);
    const r = r3s(o.r);

    if (!entry) {
      const g = new THREE.Group();
      const cloak = new THREE.Mesh(
        new THREE.ConeGeometry(r * 0.9, r * 2.2, 8),
        new THREE.MeshStandardMaterial({
          color: col(o.color), emissive: col(o.ring), emissiveIntensity: 0.35, roughness: 0.7,
        })
      );
      cloak.rotation.x = Math.PI;
      cloak.position.y = r * 2.2;
      g.add(cloak);
      g.userData.cloak = cloak;

      const head = new THREE.Mesh(
        new THREE.SphereGeometry(r * 0.55, 12, 10),
        new THREE.MeshStandardMaterial({ color: col(o.color), roughness: 0.6 })
      );
      head.position.y = r * 3.4;
      g.add(head);
      g.userData.head = head;

      const eyes = [];
      const eyeMat = new THREE.MeshBasicMaterial({ color: col(o.eye) });
      const eyeGeo = new THREE.SphereGeometry(r * 0.18, 8, 6);
      const count = o.eyes;
      for (let e = 0; e < count; e++) {
        const offset = (e - (count - 1) / 2) * r * 0.5;
        const eye = new THREE.Mesh(eyeGeo, eyeMat);
        eye.position.set(offset, r * 3.5, r * 0.5);
        g.add(eye);
        eyes.push(eye);
      }
      g.userData.eyes = eyes;

      const glow = new THREE.Mesh(
        new THREE.CircleGeometry(r * 1.1, 16),
        new THREE.MeshBasicMaterial({
          color: col(o.eye), transparent: true, opacity: 0.4,
          depthWrite: false, blending: THREE.AdditiveBlending,
        })
      );
      glow.rotation.x = -Math.PI / 2;
      glow.position.y = 0.05;
      g.add(glow);
      g.userData.glow = glow;

      mkShadow(g, r * 1.2);

      R3D.scene.add(g);
      R3D.orbs.set(id, g);
      entry = g;
    }

    const bob = Math.sin(performance.now() / 500 + o.bob) * 0.15;
    entry.position.set(r3x(o.x), bob, r3z(o.y));

    if (p) {
      const ang = Math.atan2(p.y - o.y, p.x - o.x);
      entry.rotation.y = -ang;
    }

    const hit = o.hitFlashUntil > nowMs();
    const cloakCol = hit ? new THREE.Color(0xffffff) : col(o.color);
    entry.userData.cloak.material.color.copy(cloakCol);
    entry.userData.head.material.color.copy(cloakCol);
  }
  R3D.orbs.forEach((m, id) => {
    if (!live.has(id)) { disposeGroup(m); R3D.orbs.delete(id); }
  });
}

function syncBoss(now) {
  const b = G.boss;
  if (!b || b.dead) {
    if (R3D.bossMesh) { disposeGroup(R3D.bossMesh); R3D.bossMesh = null; R3D.bossEyes = null; }
    return;
  }
  const r = r3s(b.r);
  if (!R3D.bossMesh) {
    const g = new THREE.Group();

    const body = new THREE.Mesh(
      new THREE.SphereGeometry(r, 24, 18),
      new THREE.MeshStandardMaterial({
        color: 0x5a1010, emissive: 0x5a0808, emissiveIntensity: 0.6, roughness: 0.8,
      })
    );
    body.position.y = r * 1.2;
    g.add(body);
    g.userData.body = body;

    const tendrils = [];
    for (let i = 0; i < 8; i++) {
      const t = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.15, r * 2.2, 6),
        new THREE.MeshStandardMaterial({ color: 0x2a0808, roughness: 0.9 })
      );
      const a = (i / 8) * Math.PI * 2;
      t.position.set(Math.cos(a) * r * 0.9, r * 1.6, Math.sin(a) * r * 0.9);
      t.rotation.z = rand(-0.2, 0.2);
      t.rotation.x = rand(-0.2, 0.2);
      g.add(t);
      tendrils.push(t);
    }

    const eyes = [];
    for (let i = 0; i < 5; i++) {
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(r * 0.09, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xffb84a })
      );
      eyes.push(eye);
      g.add(eye);
    }
    g.userData.eyes = eyes;
    R3D.bossEyes = eyes;

    const aura = new THREE.Mesh(
      new THREE.SphereGeometry(r * 1.6, 16, 12),
      new THREE.MeshBasicMaterial({
        color: 0x8a2020, transparent: true, opacity: 0.15,
        depthWrite: false, blending: THREE.AdditiveBlending,
      })
    );
    aura.position.y = r * 1.2;
    g.add(aura);
    g.userData.aura = aura;

    mkShadow(g, r * 1.3);

    R3D.bossMesh = g;
    R3D.scene.add(g);
  }

  R3D.bossMesh.position.set(r3x(b.x), 0, r3z(b.y));
  const bob = Math.sin(b.bob) * 0.15;
  R3D.bossMesh.userData.body.position.y = r * 1.2 + bob;
  R3D.bossMesh.userData.aura.position.y = r * 1.2 + bob;

  const p = G.player;
  if (p) {
    const ang = Math.atan2(p.y - b.y, p.x - b.x);
    R3D.bossMesh.rotation.y = -ang;
  }

  if (p && R3D.bossEyes) {
    const dx = p.x - b.x, dy = p.y - b.y;
    const d = Math.hypot(dx, dy) || 1;
    const nx = dx / d, ny = dy / d;
    R3D.bossEyes.forEach((eye, idx) => {
      const a = (idx - 2) * 0.35;
      const perpX = -ny, perpZ = nx;
      const rx = nx * r * 0.85 + perpX * Math.sin(a) * r * 0.6;
      const rz = ny * r * 0.85 + perpZ * Math.sin(a) * r * 0.6;
      eye.position.set(rx, r * 1.2 + bob + Math.cos(a) * r * 0.4, rz);
    });
  }

  const hit = b.hitFlashUntil > nowMs();
  R3D.bossMesh.userData.body.material.color.setHex(hit ? 0xffffff : 0x5a1010);
  R3D.bossMesh.userData.aura.material.opacity = 0.18 + 0.10 * Math.sin(now / 300);
}

function syncProjectiles() {
  const live = new Set();
  for (let i = 0; i < G.projectiles.length; i++) {
    const pr = G.projectiles[i];
    const id = 'proj_' + i;
    live.add(id);
    let m = R3D.projectiles.get(id);
    if (!m) {
      m = new THREE.Group();
      const core = new THREE.Mesh(
        new THREE.SphereGeometry(r3s(pr.r), 12, 10),
        new THREE.MeshBasicMaterial({ color: 0xffb84a })
      );
      m.add(core);
      const glow = new THREE.Mesh(
        new THREE.SphereGeometry(r3s(pr.r) * 2, 10, 8),
        new THREE.MeshBasicMaterial({
          color: 0xff8000, transparent: true, opacity: 0.4,
          depthWrite: false, blending: THREE.AdditiveBlending,
        })
      );
      m.add(glow);
      R3D.scene.add(m);
      R3D.projectiles.set(id, m);
    }
    m.position.set(r3x(pr.x), 0.8, r3z(pr.y));
  }
  R3D.projectiles.forEach((m, id) => {
    if (!live.has(id)) { disposeGroup(m); R3D.projectiles.delete(id); }
  });
}

function syncParticles() {
  const live = new Set();
  for (let i = 0; i < G.particles.length; i++) {
    const p = G.particles[i];
    const id = 'p_' + i;
    live.add(id);
    let m = R3D.particles.get(id);
    if (!m) {
      m = new THREE.Mesh(
        new THREE.SphereGeometry(1, 6, 5),
        new THREE.MeshBasicMaterial({ color: col(p.color), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      R3D.scene.add(m);
      R3D.particles.set(id, m);
    }
    const a = Math.max(0, p.life / p.max);
    m.position.set(r3x(p.x), 0.6, r3z(p.y));
    m.scale.setScalar(r3s(p.size) * a);
    m.material.opacity = a;
    m.material.color.set(col(p.color));
  }
  R3D.particles.forEach((m, id) => {
    if (!live.has(id)) { disposeGroup(m); R3D.particles.delete(id); }
  });
}

function syncRings() {
  const live = new Set();
  for (let i = 0; i < G.rings.length; i++) {
    const r = G.rings[i];
    const id = 'ring_' + i;
    live.add(id);
    let m = R3D.rings.get(id);
    if (!m) {
      m = new THREE.Mesh(
        new THREE.TorusGeometry(1, 0.06, 6, 32),
        new THREE.MeshBasicMaterial({
          color: col(r.color), transparent: true,
          blending: THREE.AdditiveBlending, depthWrite: false,
        })
      );
      m.rotation.x = -Math.PI / 2;
      m.position.y = 0.2;
      R3D.scene.add(m);
      R3D.rings.set(id, m);
    }
    const t = 1 - r.life / r.max;
    m.position.set(r3x(r.x), 0.2, r3z(r.y));
    m.scale.setScalar(r3s(r.r));
    m.material.opacity = 1 - t;
    m.material.color.set(col(r.color));
  }
  R3D.rings.forEach((m, id) => {
    if (!live.has(id)) { disposeGroup(m); R3D.rings.delete(id); }
  });
}

function syncFootprints() { return; }

function syncAmbientDust(now) {
  if (!R3D.ambientDust) return;
  const arr = R3D.ambientDust.geometry.attributes.position.array;
  const t = now * 0.0004;
  for (let i = 0; i < arr.length; i += 3) {
    arr[i]     += Math.sin(t + i * 0.1) * 0.006;
    arr[i + 1] += Math.cos(t + i * 0.15) * 0.003;
    arr[i + 2] += Math.sin(t + i * 0.13) * 0.006;
  }
  R3D.ambientDust.geometry.attributes.position.needsUpdate = true;
}

function syncExitArch(now) {
  const a = R3D.exitArch;
  if (!a) return;
  const veil = a.userData.veil;
  const beam = a.userData.beam;
  if (!veil) return;

  const gatesDone = G.gates.length > 0 && G.gates.every(g => g.done);
  const bossDead = !G.boss || G.boss.dead;
  const open = gatesDone && bossDead;

  const basePulse = 0.15 + 0.08 * Math.sin(now / 400);
  const openPulse = 0.65 + 0.25 * Math.sin(now / 220);
  const target = open ? openPulse : basePulse;
  veil.material.opacity += (target - veil.material.opacity) * 0.10;
  veil.material.color.setHex(open ? 0xf5d24a : 0xd4af37);

  if (beam) {
    const beamTarget = open ? (0.20 + 0.08 * Math.sin(now / 260)) : 0;
    beam.material.opacity += (beamTarget - beam.material.opacity) * 0.10;
    beam.visible = beam.material.opacity > 0.01;
  }

  if (a.userData.pillars) {
    a.userData.pillars.forEach(p => {
      p.material.emissive.setHex(open ? 0x8a6a2d : 0x000000);
      p.material.emissiveIntensity = open ? 0.9 + 0.3 * Math.sin(now / 240) : 0;
    });
  }
}

function syncRafiq() {
  const r = G.rafiq;
  if (!r) {
    if (R3D.rafiqMesh) { disposeGroup(R3D.rafiqMesh); R3D.rafiqMesh = null; }
    return;
  }
  if (!R3D.rafiqMesh) {
    const g = new THREE.Group();
    const robe = new THREE.Mesh(
      new THREE.ConeGeometry(0.7, 1.8, 10),
      new THREE.MeshStandardMaterial({ color: 0x2a3a3a, roughness: 0.95, transparent: true, opacity: 1 })
    );
    robe.position.y = 0.9;
    g.add(robe);
    const hood = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0x2a3a3a, roughness: 0.95, transparent: true, opacity: 1 })
    );
    hood.position.y = 1.9;
    g.add(hood);
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0x7ab8c9, transparent: true })
    );
    glow.position.set(0.25, 1.3, 0.35);
    g.add(glow);
    g.userData.robe = robe;
    g.userData.hood = hood;
    g.userData.glow = glow;
    R3D.rafiqMesh = g;
    R3D.scene.add(g);
  }

  R3D.rafiqMesh.position.set(r3x(r.x), 0, r3z(r.y));
  R3D.rafiqMesh.rotation.y = Math.PI;

  const o = Math.max(0, r.opacity);
  R3D.rafiqMesh.userData.robe.material.opacity = o;
  R3D.rafiqMesh.userData.hood.material.opacity = o;
  R3D.rafiqMesh.userData.glow.material.opacity = o;
  R3D.rafiqMesh.traverse(c => {
    if (c.material && c.material.opacity !== undefined && c !== R3D.rafiqMesh.userData.robe && c !== R3D.rafiqMesh.userData.hood && c !== R3D.rafiqMesh.userData.glow) {
      c.material.opacity = 0.55 * o;
    }
  });
}
