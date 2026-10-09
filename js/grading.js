// ============================================================
//  grading.js — turns gameplay signals into SRS grades.
//  Called from pickTarget / gateCorrect / gateWrong / replay clicks.
//  All timing uses G.playMs (unpaused game time), never wall time.
// ============================================================

const GRADE_CFG = {
  // "Excess" = reading time minus expected walking time to the gate.
  // Thresholds grow with the number of gates still open (more to scan).
  fastBaseMs: 1200, fastPerExtraMs: 300,
  slowBaseMs: 3500, slowPerExtraMs: 700,
  touchSlackMs: 800,        // thumbs are slower and less precise
  tensionHard: 0.5,         // peak G.tension above this => Hard
  debug: false,             // GRADE_CFG.debug = true in the console to log grades
};

// Called from pickTarget(). `candidates` = gates still open (including target).
function beginTarget(gate, candidates) {
  const p = G.player;
  let travelMs = 0;
  if (p) {
    // Distance to the nearest edge of the gate's hitbox, at walking pace.
    const dx = Math.max(0, Math.abs(p.x - gate.x) - gate.w / 2);
    const dy = Math.max(0, Math.abs(p.y - gate.y) - gate.h / 2);
    travelMs = Math.hypot(dx, dy) / (PLAYER_WALK * G.up.speed) * 1000;
  }
  const now = nowMs();
  G.tgt = {
    gate,
    key: SRS.cardKey(gate.item, G.mode),
    candidates,
    playMs0: G.playMs,
    travelMs,
    replayed: false,
    disrupted: now < G.stunUntil || now < G.invulnUntil,
    peakTension: 0,
    graded: false,
  };
}

// Per-frame, from loop.js (combat/boss rooms only).
// Stun/invuln are set by every kind of hit (orb, boss, bolt, shield absorb),
// so watching them avoids touching every damage site in enemies.js.
function trackTarget() {
  const t = G.tgt;
  if (!t || t.graded) return;
  const now = nowMs();
  if (now < G.stunUntil || now < G.invulnUntil) t.disrupted = true;
  if (G.tension > t.peakTension) t.peakTension = G.tension;
}

// Only counts when audio is on; with audio off the button does nothing.
function noteReplay() {
  if (G.voice && G.tgt && !G.tgt.graded) G.tgt.replayed = true;
}

function rateTarget(t) {
  const R = SRS.RATING;
  const elapsed = G.playMs - t.playMs0;
  const excess = elapsed - t.travelMs;
  const extra = Math.max(0, t.candidates - 1);
  const slack = IS_TOUCH ? GRADE_CFG.touchSlackMs : 0;
  const fast = GRADE_CFG.fastBaseMs + GRADE_CFG.fastPerExtraMs * extra + slack;
  const slow = GRADE_CFG.slowBaseMs + GRADE_CFG.slowPerExtraMs * extra + slack;

  let rating = R.GOOD, why = 'normal';
  if (t.replayed)                                   { rating = R.HARD; why = 'replay'; }
  else if (t.peakTension > GRADE_CFG.tensionHard)   { rating = R.HARD; why = 'storm'; }
  else if (t.disrupted)                             { why = 'disrupted'; }   // no speed judgement
  else if (excess >= slow)                          { rating = R.HARD; why = 'slow'; }
  else if (excess <= fast)                          { rating = R.EASY; why = 'fast'; }
  return { rating, why, elapsed, excess };
}

function commitGrade(t, rating, why, timing, extra) {
  t.graded = true;                                  // first outcome per target wins
  const key = t.key;
  if (G.gradedThisRun.has(key)) return;             // practice encounter

  const now = Date.now();                           // SRS uses epoch time
  const card = SRS.get(key);
  const early = !!card && !SRS.isDue(card, now);
  // Successes on not-due cards carry little information and inflate intervals.
  // A failure is informative even when early, so Again is always graded.
  // (To mirror Anki strictly, drop the `rating !== AGAIN` exception.)
  if (early && rating !== SRS.RATING.AGAIN) return;

  G.gradedThisRun.add(key);                         // only graded outcomes count
  const telemetry = Object.assign({
    why,
    readMs: Math.round(timing.elapsed),
    travelMs: Math.round(t.travelMs),
    excessMs: Math.round(timing.excess),
    cands: t.candidates,
    replayed: t.replayed,
    disrupted: t.disrupted,
    peakTension: Math.round(t.peakTension * 100) / 100,
    early,
    mode: G.mode, reading: G.reading, diff: G.difficulty,
    touch: IS_TOUCH, room: G.roomIdx, daily: G.daily, endless: G.endless,
  }, extra);

  const res = SRS.grade(key, rating, { source: 'game', now, telemetry });
  if (GRADE_CFG.debug) {
    console.log(`[grade] ${key} -> ${rating} (${why})`, telemetry, res.card);
  }
}

function gradeTargetCorrect(g) {
  const t = G.tgt;
  if (!t || t.graded || t.gate !== g) return;
  const r = rateTarget(t);
  commitGrade(t, r.rating, r.why, r);
}

// `g` is the wrong gate the player walked into. Only the target is graded,
// but we record which card it was confused with (useful later for finding
// confusable pairs).
function gradeTargetWrong(g) {
  const t = G.tgt;
  if (!t || t.graded || t.gate !== G.targetGate) return;
  const r = rateTarget(t);
  commitGrade(t, SRS.RATING.AGAIN, 'wrong_gate', r, { confusedWith: g.item.cardId || null });
}
