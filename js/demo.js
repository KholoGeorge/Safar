let demoRunning = false;
function startDemo() {
  const dc = document.getElementById('demoCanvas');
  if (!dc || demoRunning) return;
  demoRunning = true;
  const dctx = dc.getContext('2d');
  const demo = {
    player: { x: 60, y: 240, vx: 0, vy: 0, angle: 0 },
    gates: [
      { x: 760, y: 110, w: 60, h: 80, label: 'كَيْفَ حَالُكَ' },
      { x: 760, y: 240, w: 60, h: 80, label: 'أَنَا بِخَيْرٍ' },
      { x: 760, y: 370, w: 60, h: 80, label: 'مَا اسْمُكَ' },
    ],
    target: 'I am fine',
    path: [{ x: 60, y: 240 }, { x: 320, y: 240 }, { x: 320, y: 320 }, { x: 520, y: 320 }, { x: 520, y: 240 }, { x: 730, y: 240 }],
    pathIdx: 0, t: 0, flashGreenUntil: 0,
    orbs: [{ x: 380, y: 380, r: 14, t: 0 }],
  };
  function stepDemo() {
    if (!manualScreen.classList.contains('show')) { demoRunning = false; return; }
    const dt = 0.016; demo.t += dt;
    const p = demo.player;
    const target = demo.path[demo.pathIdx];
    const dx = target.x - p.x, dy = target.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < 3) {
      demo.pathIdx = (demo.pathIdx + 1) % demo.path.length;
      if (demo.pathIdx === 0) { p.x = 60; p.y = 240; }
    } else {
      p.x += dx / d * 170 * dt;
      p.y += dy / d * 170 * dt;
      p.angle = Math.atan2(dy, dx);
    }
    if (demo.pathIdx === 5 && p.x > 700) demo.flashGreenUntil = demo.t + 0.5;

    const W = dc.width, H = dc.height;
    dctx.clearRect(0, 0, W, H);
    dctx.fillStyle = '#18150e';
    dctx.fillRect(20, 20, W - 40, H - 40);
    dctx.fillStyle = 'rgba(138, 122, 90, 0.08)';
    for (let x = 60; x < W - 30; x += 40)
      for (let y = 60; y < H - 30; y += 40) dctx.fillRect(x, y, 1, 1);
    dctx.strokeStyle = '#3a3020'; dctx.lineWidth = 1;
    dctx.strokeRect(20.5, 20.5, W - 41, H - 41);

    dctx.fillStyle = '#6a5a3d';
    dctx.font = '10px "JetBrains Mono", monospace';
    dctx.textAlign = 'center';
    dctx.fillText('FIND', W / 2, 42);
    dctx.fillStyle = '#e8dfc8';
    dctx.font = '600 20px "Inter", system-ui, sans-serif';
    dctx.fillText(demo.target, W / 2, 66);

    demo.orbs[0].t += dt;
    const orb = demo.orbs[0];
    const obx = orb.x + Math.sin(orb.t * 1.5) * 30;
    dctx.fillStyle = 'rgba(0,0,0,0.55)';
    dctx.beginPath();
    dctx.ellipse(obx + 2, orb.y + orb.r * 0.6, orb.r * 0.9, orb.r * 0.4, 0, 0, Math.PI * 2);
    dctx.fill();
    dctx.fillStyle = '#1a0810';
    dctx.beginPath(); dctx.arc(obx, orb.y, orb.r, 0, Math.PI * 2); dctx.fill();
    dctx.strokeStyle = '#5a2a3a'; dctx.lineWidth = 2;
    dctx.beginPath(); dctx.arc(obx, orb.y, orb.r - 2, 0, Math.PI * 2); dctx.stroke();
    dctx.fillStyle = '#d46a4a';
    dctx.beginPath(); dctx.arc(obx - 3, orb.y - 1, 2, 0, Math.PI * 2); dctx.fill();
    dctx.beginPath(); dctx.arc(obx + 3, orb.y - 1, 2, 0, Math.PI * 2); dctx.fill();

    for (const g of demo.gates) {
      const x = g.x - g.w / 2, y = g.y - g.h / 2;
      dctx.fillStyle = '#1f1a10'; dctx.fillRect(x, y, g.w, g.h);
      dctx.strokeStyle = '#6a5a3d'; dctx.lineWidth = 2;
      dctx.strokeRect(x + 0.5, y + 0.5, g.w - 1, g.h - 1);
      dctx.beginPath();
      dctx.moveTo(x, y + 16);
      dctx.quadraticCurveTo(x + g.w / 2, y - 10, x + g.w, y + 16);
      dctx.stroke();
      dctx.save();
      dctx.direction = 'rtl';
      dctx.fillStyle = '#c9b88a';
      dctx.font = '600 15px "Inter", system-ui, sans-serif';
      dctx.textAlign = 'center';
      dctx.fillText(g.label, g.x, y - 8);
      dctx.restore();
    }

    dctx.fillStyle = '#d4af37';
    dctx.beginPath(); dctx.arc(p.x, p.y, 12, 0, Math.PI * 2); dctx.fill();
    dctx.fillStyle = '#0e0c08';
    dctx.beginPath();
    dctx.arc(p.x + Math.cos(p.angle) * 5, p.y + Math.sin(p.angle) * 5, 3, 0, Math.PI * 2);
    dctx.fill();

    const fadeIn = Math.min(1, demo.t * 0.6);
    dctx.save();
    dctx.globalAlpha = 0.12 * fadeIn;
    dctx.strokeStyle = '#d4af37';
    dctx.setLineDash([4, 6]);
    dctx.beginPath();
    dctx.moveTo(demo.path[0].x, demo.path[0].y);
    for (let i = 1; i < demo.path.length; i++) dctx.lineTo(demo.path[i].x, demo.path[i].y);
    dctx.stroke();
    dctx.restore();

    if (demo.t < demo.flashGreenUntil) {
      const a = (demo.flashGreenUntil - demo.t) / 0.5;
      dctx.fillStyle = `rgba(34, 197, 94, ${0.35 * a})`;
      const g = demo.gates[1];
      dctx.fillRect(g.x - g.w / 2, g.y - g.h / 2, g.w, g.h);
    }

    dctx.fillStyle = '#6a5a3d';
    dctx.font = '10px "JetBrains Mono", monospace';
    dctx.textAlign = 'left';
    dctx.fillText('WALK →', 40, H - 30);
    dctx.fillStyle = '#d4af37';
    dctx.fillText('CORRECT', 110, H - 30);

    requestAnimationFrame(stepDemo);
  }
  requestAnimationFrame(stepDemo);
}
