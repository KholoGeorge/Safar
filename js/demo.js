let demoRunning = false;

function startDemo() {
  const dc = document.getElementById('demoCanvas');
  if (!dc || demoRunning) return;
  demoRunning = true;
  const dctx = dc.getContext('2d');

  const W = dc.width, H = dc.height;
  const pad = 20;
  const l = pad + 20;
  const r = W - pad - 20;
  const t = pad + 20;
  const b = H - pad - 20;
  const cx = (l + r) / 2;

  const gates = [
    { side: 'right', y: t + 100, w: 58, h: 42, label: 'كَيْفَ حَالُكَ', correct: false },
    { side: 'left',  y: t + 200, w: 58, h: 42, label: 'أَنَا بِخَيْرٍ', correct: true  },
    { side: 'right', y: t + 300, w: 58, h: 42, label: 'مَا اسْمُكَ',  correct: false },
  ];
  for (const g of gates) {
    g.x = (g.side === 'right') ? r - 32 : l + 32;
  }

  const rightGateX = gates[0].x - 60;
  const leftGateX  = gates[1].x + 60;

  const path = [
    { x: cx,         y: b - 30,        hold: 500 },
    { x: rightGateX, y: gates[0].y,    hold: 400 },
    { x: cx,         y: t + 130,       hold: 200 },
    { x: leftGateX,  y: gates[1].y,    hold: 800 },
    { x: cx,         y: t + 60,        hold: 300 },
    { x: cx,         y: t + 20,        hold: 400 },
  ];

  const player = { x: cx, y: b - 30, angle: -Math.PI / 2 };
  let pathIdx = 0;
  let holdUntil = performance.now() + 600;
  let stormY = b + 40;
  let flashUntil = 0;
  let t0 = performance.now();

  function draw() {
    if (!manualScreen.classList.contains('show')) {
      demoRunning = false;
      return;
    }
    const now = performance.now();
    const dt = Math.min(0.04, (now - t0) / 1000);
    t0 = now;

    // --- Update ---
    if (now < holdUntil) {
      // holding at waypoint
    } else {
      const wp = path[pathIdx];
      const dx = wp.x - player.x, dy = wp.y - player.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < 2.5) {
        pathIdx++;
        if (pathIdx >= path.length) {
          pathIdx = 0;
          player.x = cx;
          player.y = b - 30;
          stormY = b + 40;
          holdUntil = now + 600;
        } else {
          holdUntil = now + (path[pathIdx].hold || 300);
          if (pathIdx === 4) flashUntil = now + 900;
        }
      } else {
        const speed = 130;
        player.x += dx / d * speed * dt;
        player.y += dy / d * speed * dt;
        player.angle = Math.atan2(dy, dx);
      }
    }

    stormY -= 14 * dt;

    // --- Draw ---
    dctx.clearRect(0, 0, W, H);

    dctx.fillStyle = '#18150e';
    dctx.fillRect(l, t, r - l, b - t);

    dctx.fillStyle = 'rgba(138, 122, 90, 0.10)';
    for (let x = l + 20; x < r; x += 26)
      for (let y = t + 20; y < b; y += 26) dctx.fillRect(x, y, 1, 1);

    dctx.strokeStyle = '#3a3020';
    dctx.lineWidth = 1;
    dctx.strokeRect(l + 0.5, t + 0.5, r - l - 1, b - t - 1);

    // Storm
    if (stormY < b) {
      dctx.fillStyle = '#1a1408';
      dctx.fillRect(l, stormY, r - l, b - stormY);
      dctx.strokeStyle = '#8a6a3d';
      dctx.lineWidth = 2;
      dctx.beginPath();
      dctx.moveTo(l, stormY + 0.5);
      dctx.lineTo(r, stormY + 0.5);
      dctx.stroke();
      const grd = dctx.createLinearGradient(0, stormY, 0, stormY - 40);
      grd.addColorStop(0, 'rgba(26, 20, 8, 0.7)');
      grd.addColorStop(1, 'rgba(26, 20, 8, 0)');
      dctx.fillStyle = grd;
      dctx.fillRect(l, stormY - 40, r - l, 40);
    }

    // Gates
    for (const g of gates) {
      const x = g.x - g.w / 2;
      const y = g.y - g.h / 2;
      const isFlashing = g.correct && flashUntil > now;

      dctx.fillStyle = 'rgba(0,0,0,0.45)';
      dctx.fillRect(x + 2, y + 3, g.w, g.h);

      dctx.fillStyle = isFlashing ? '#d4af37' : '#1f1a10';
      dctx.fillRect(x, y, g.w, g.h);

      dctx.strokeStyle = isFlashing ? '#d4af37' : '#6a5a3d';
      dctx.lineWidth = 2;
      dctx.strokeRect(x + 0.5, y + 0.5, g.w - 1, g.h - 1);

      dctx.save();
      dctx.direction = 'rtl';
      dctx.font = '600 12px "Inter", system-ui, sans-serif';
      dctx.textAlign = 'center';
      dctx.textBaseline = 'bottom';
      const labelW = dctx.measureText(g.label).width + 10;
      dctx.fillStyle = 'rgba(14,12,8,0.85)';
      dctx.fillRect(g.x - labelW / 2, y - 18, labelW, 16);
      dctx.fillStyle = isFlashing ? '#d4af37' : '#c9b88a';
      dctx.fillText(g.label, g.x, y - 4);
      dctx.restore();
    }

    // Exit arrow
    const pulse = 0.5 + 0.5 * Math.sin(now / 400);
    dctx.save();
    dctx.globalAlpha = pulse * 0.85;
    dctx.fillStyle = '#d4af37';
    dctx.beginPath();
    dctx.moveTo(cx - 14, t + 6);
    dctx.lineTo(cx + 14, t + 6);
    dctx.lineTo(cx, t + 22);
    dctx.closePath();
    dctx.fill();
    dctx.restore();

    // Objective
    dctx.save();
    dctx.textAlign = 'center';
    dctx.fillStyle = '#6a5a3d';
    dctx.font = '9px "JetBrains Mono", monospace';
    dctx.fillText('FIND', cx, t - 8);
    dctx.fillStyle = '#e8dfc8';
    dctx.font = '600 14px "Inter", system-ui, sans-serif';
    dctx.fillText('I am fine', cx, t + 44);
    dctx.restore();

    // Player
    dctx.fillStyle = 'rgba(0,0,0,0.5)';
    dctx.beginPath();
    dctx.ellipse(player.x + 2, player.y + 6, 10, 5, 0, 0, Math.PI * 2);
    dctx.fill();

    dctx.fillStyle = '#0e0c08';
    dctx.beginPath();
    dctx.arc(player.x, player.y, 10, 0, Math.PI * 2);
    dctx.fill();

    dctx.strokeStyle = '#8a7a5a';
    dctx.lineWidth = 2;
    dctx.beginPath();
    dctx.arc(player.x, player.y, 9, 0, Math.PI * 2);
    dctx.stroke();

    dctx.fillStyle = '#d4af37';
    dctx.beginPath();
    dctx.arc(player.x, player.y - 2, 4.5, 0, Math.PI * 2);
    dctx.fill();

    dctx.strokeStyle = '#d4af37';
    dctx.lineWidth = 2;
    dctx.beginPath();
    dctx.moveTo(player.x, player.y);
    dctx.lineTo(
      player.x + Math.cos(player.angle) * 16,
      player.y + Math.sin(player.angle) * 16
    );
    dctx.stroke();

    dctx.save();
    dctx.textAlign = 'center';
    dctx.fillStyle = '#6a5a3d';
    dctx.font = '9px "JetBrains Mono", monospace';
    dctx.fillText('GATES ALTERNATE · STORM RISES', cx, b + 14);
    dctx.restore();

    requestAnimationFrame(draw);
  }

  requestAnimationFrame(draw);   // <-- this was missing
}
