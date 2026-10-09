// ============================================================
//  journal.js — a place to see what you've learned.
//  Reads SRS state. Renders prose, not charts.
// ============================================================

function openJournal() {
  const el = $('journalScreen');
  if (!el) return;
  renderJournal();
  el.classList.add('show');
}

function closeJournal() {
  const el = $('journalScreen');
  if (!el) return;
  el.classList.remove('show');
  refreshHome();
}

function renderJournal() {
  const body = $('journalBody');
  if (!body) return;
  body.innerHTML = '';

  const names = Object.keys(G.routes);
  if (!names.length) {
    body.appendChild(_el('div', { class: 'journal-empty' }, 'No lessons loaded.'));
    return;
  }

  const now = Date.now();
  let totalCards = 0, totalStrong = 0, totalDue = 0, totalNew = 0;

  for (const name of names) {
    const lesson = G.routes[name];
    const pool = lesson.cards || lesson;
    if (!pool || !pool.length) continue;

    const keys = pool.map(it => SRS.cardKey(it, G.mode));
    const parts = SRS.partition(keys, now);

    const cards = pool.length;
    const strong = pool.filter(it => {
      const c = SRS.get(SRS.cardKey(it, G.mode));
      return c && c.s >= 7;
    }).length;
    const dueCount = parts.due.length;
    const newCount = parts.fresh.length;

    totalCards += cards;
    totalStrong += strong;
    totalDue += dueCount;
    totalNew += newCount;

    // Slowest card: highest excessMs across all log entries for this lesson.
    const lessonKeySet = new Set(keys);
    const slowest = {};
    for (const e of SRS.entries()) {
      if (!lessonKeySet.has(e.cardKey)) continue;
      const ex = (e.telemetry && e.telemetry.excessMs) || 0;
      if (ex > (slowest.excess || 0)) {
        slowest.excess = ex;
        slowest.key = e.cardKey;
      }
    }

    const stat = G.stats[name] || {};
    const plays = stat.plays || 0;

    const block = document.createElement('div');
    block.className = 'journal-entry';

    const h = document.createElement('div');
    h.className = 'journal-lesson';
    h.textContent = name;
    block.appendChild(h);

    const l1 = document.createElement('div');
    l1.className = 'journal-line';
    l1.textContent = plays === 0
      ? 'Not yet visited.'
      : 'You have sat with this ' + plays + ' time' + (plays === 1 ? '' : 's') + '.';
    block.appendChild(l1);

    const l2 = document.createElement('div');
    l2.className = 'journal-line';
    l2.textContent = strong + ' of ' + cards + ' cards feel solid.';
    block.appendChild(l2);

    const l3 = document.createElement('div');
    l3.className = 'journal-line';
    const bits = [];
    if (dueCount)  bits.push(dueCount + ' come back');
    if (newCount)  bits.push(newCount + ' unread');
    l3.textContent = bits.length ? bits.join(', ') + '.' : 'All quiet.';
    block.appendChild(l3);

    if (slowest.key) {
      const item = findItemByKey(slowest.key);
      if (item) {
        const l4 = document.createElement('div');
        l4.className = 'journal-line journal-slow';
        l4.textContent = 'Slowest to read: ' + (G.mode === 'en-ar' ? item.en : item.ar);
        block.appendChild(l4);
      }
    }

    body.appendChild(block);
  }

  // Opening summary
  const opening = document.createElement('div');
  opening.className = 'journal-opening';
  opening.textContent =
    totalStrong + ' of ' + totalCards + ' cards are strong. ' +
    (totalDue ? totalDue + ' are due now. ' : '') +
    (totalNew ? totalNew + ' have never been read.' : '');
  body.insertBefore(opening, body.firstChild);
}

function _el(tag, attrs, text) {
  const el = document.createElement(tag);
  if (attrs) for (const k in attrs) el.setAttribute(k, attrs[k]);
  if (text != null) el.textContent = text;
  return el;
}
