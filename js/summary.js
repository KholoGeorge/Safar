// ============================================================
//  summary.js — reads SRS state, writes the post-run summary.
//  Called from endRun(); also drives the room-review addendum.
// ============================================================

const SUMMARY_DAY = 86400000;

function summarizeRun() {
  const since = G.startWall || 0;
  const entries = SRS.entries().filter(e => e.reviewedAt >= since);
  const breakdown = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const e of entries) breakdown[e.rating] = (breakdown[e.rating] || 0) + 1;

  // Hardest = most recent Again entries, up to 3, deduped by cardKey.
  const seenAgain = new Set();
  const hardest = [];
  for (let i = entries.length - 1; i >= 0 && hardest.length < 3; i--) {
    const e = entries[i];
    if (e.rating !== SRS.RATING.AGAIN) continue;
    if (seenAgain.has(e.cardKey)) continue;
    seenAgain.add(e.cardKey);
    hardest.push(e);
  }

  // "When things come back" — bucket the *current* due date of every card
  // touched this run. Uses SRS.get(key).due, not the log entry.
  const now = Date.now();
  const buckets = new Map(); // daysBucket -> count
  const touchedKeys = new Set(entries.map(e => e.cardKey));
  for (const key of touchedKeys) {
    const card = SRS.get(key);
    if (!card) continue;
    const daysOut = Math.max(0, Math.round((card.due - now) / SUMMARY_DAY));
    let label;
    if (daysOut === 0)      label = 'later today';
    else if (daysOut === 1) label = 'tomorrow';
    else                    label = `in ${daysOut} days`;
    buckets.set(label, (buckets.get(label) || 0) + 1);
  }

  return {
    graded: entries.length,
    breakdown,
    hardest,
    buckets: [...buckets.entries()].sort((a, b) => a[1] - b[1]),
  };
}

function renderRunSummary() {
  const box = $('endSummary');
  if (!box) return;
  const s = summarizeRun();
  if (!s.graded) {
    box.innerHTML = '<div class="summary-h">Session</div><div class="summary-empty">No cards graded this run.</div>';
    return;
  }
  const R = SRS.RATING;
  const rname = r => ({ [R.AGAIN]: 'Again', [R.HARD]: 'Hard', [R.GOOD]: 'Good', [R.EASY]: 'Easy' }[r] || '?');

  const line = Object.keys(s.breakdown)
    .filter(r => s.breakdown[r] > 0)
    .map(r => `${s.breakdown[r]} ${rname(+r)}`)
    .join(' · ');

  const hardHtml = s.hardest.length
    ? s.hardest.map(e => {
        const item = findItemByKey(e.cardKey);
        const text = item ? (G.mode === 'en-ar' ? item.en : item.ar) : e.cardKey;
        return `<div class="summary-card">${escapeHtml(text)}</div>`;
      }).join('')
    : '<div class="summary-empty">Nothing slipped.</div>';

  const dueHtml = s.buckets.length
    ? s.buckets.map(([label, n]) => `<span class="summary-bucket">${n} ${label}</span>`).join('')
    : '<div class="summary-empty">—</div>';

  box.innerHTML = `
    <div class="summary-h">Graded</div>
    <div class="summary-row"><b>${s.graded}</b> card${s.graded === 1 ? '' : 's'}</div>
    <div class="summary-row summary-mix">${line}</div>
    <div class="summary-h">Coming back</div>
    <div class="summary-row summary-buckets">${dueHtml}</div>
    <div class="summary-h">Rough ones</div>
    <div class="summary-row">${hardHtml}</div>
  `;
}

function findItemByKey(key) {
  if (!key) return null;
  // key is "cardId|mode" or "ar|mode"; try every loaded lesson.
  for (const name of Object.keys(G.routes)) {
    const lesson = G.routes[name];
    const pool = lesson.cards || lesson;
    for (const it of pool) {
      if (SRS.cardKey(it, G.mode) === key) return it;
    }
  }
  return null;
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}
