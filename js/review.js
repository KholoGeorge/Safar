// ============================================================
//  review.js — explicit Review mode (phase 2).
//  Real recall: prompt → audio → reveal → Again/Hard/Good/Easy.
//  Uses SRS.grade({ source: 'review' }) so recognition and recall
//  evidence stay distinguishable.
// ============================================================

const ReviewState = {
  queue: [],
  idx: 0,
  revealed: false,
  active: false,
  done: null,
};

function startReview(opts = {}) {
  opts = opts || {};
  const sources = opts.lessonName ? [opts.lessonName] : Object.keys(G.routes);
  const allKeys = [];
  const byKey = new Map();
  for (const name of sources) {
    const lesson = G.routes[name];
    if (!lesson) continue;
    const pool = lesson.cards || lesson;
    for (const it of pool) {
      const k = SRS.cardKey(it, G.mode);
      if (!byKey.has(k)) {
        allKeys.push(k);
        byKey.set(k, { key: k, item: it, lesson: name });
      }
    }
  }

  const parts = SRS.partition(allKeys);
  // Due first (already ordered most-overdue-first by partition),
  // then up to REVIEW_NEW_LIMIT brand new cards.
  const REVIEW_NEW_LIMIT = 20;
  const queue = []
    .concat(parts.due.map(k => byKey.get(k)))
    .concat(parts.fresh.slice(0, REVIEW_NEW_LIMIT).map(k => byKey.get(k)))
    .filter(Boolean);

  if (!queue.length) {
  alert('Nothing due yet. Play a run to introduce cards, or open a lesson and press Study.');
  return;
}

  ReviewState.queue = queue;
  ReviewState.idx = 0;
  ReviewState.revealed = false;
  ReviewState.active = true;
  ReviewState.done = opts.onDone || null;

  initAudio();
  if (ac && ac.state === 'suspended') ac.resume();

  $('srsReviewScreen').classList.add('show');
  renderReviewCard();
}

function renderReviewCard() {
  const current = ReviewState.queue[ReviewState.idx];
  if (!current) { endReview(); return; }

  ReviewState.revealed = false;

  const isEnToAr = G.mode === 'en-ar';
  const prompt = isEnToAr ? current.item.en : current.item.ar;
  const reveal = isEnToAr ? current.item.ar : current.item.en;

  const pEl = $('srsReviewPrompt');
  const rEl = $('srsReviewReveal');
  const hEl = $('srsReviewHint');

  pEl.textContent = prompt;
  pEl.dir = isEnToAr ? 'ltr' : 'rtl';
  pEl.className = 'srs-review-prompt ' + (isEnToAr ? 'ltr' : 'rtl');

  rEl.textContent = reveal;
  rEl.dir = isEnToAr ? 'rtl' : 'ltr';
  rEl.className = 'srs-review-reveal ' + (isEnToAr ? 'rtl' : 'ltr');
  rEl.style.display = 'none';

  hEl.textContent = current.item.hint || current.lesson || '';
  hEl.style.display = current.item.hint ? 'block' : 'none';

  $('srsReviewShow').style.display = 'inline-block';
  $('srsReviewRatings').style.display = 'none';
  $('srsReviewProgress').textContent =
    `${ReviewState.idx + 1} / ${ReviewState.queue.length}`;

  // Prompt audio — play the prompt side's file if there is one.
  if (current.item.au) speakAr(current.item);
}

function revealReviewCard() {
  if (!ReviewState.active || ReviewState.revealed) return;
  ReviewState.revealed = true;
  $('srsReviewReveal').style.display = 'block';
  $('srsReviewShow').style.display = 'none';
  $('srsReviewRatings').style.display = 'flex';
}

function rateReviewCard(rating) {
  if (!ReviewState.active) return;
  const current = ReviewState.queue[ReviewState.idx];
  if (!current) { endReview(); return; }
  const now = Date.now();
  SRS.grade(current.key, rating, {
    source: 'review',
    now,
    telemetry: { mode: G.mode, reading: G.reading, lesson: current.lesson },
  });
  ReviewState.idx++;
  renderReviewCard();
}

function endReview() {
  if (!ReviewState.active) return;
  ReviewState.active = false;
  stopAllAudio();
  $('srsReviewScreen').classList.remove('show');
  const cb = ReviewState.done;
  ReviewState.done = null;
  if (cb) cb();
  refreshHome?.();
}

function wireReviewUI() {
  const exit = $('srsReviewExit'); if (exit) exit.onclick = endReview;
  const show = $('srsReviewShow'); if (show) show.onclick = revealReviewCard;
  const play = $('srsReviewPlay');
  if (play) play.onclick = () => {
    const current = ReviewState.queue[ReviewState.idx];
    if (current) speakAr(current.item);
  };
  const ratings = $('srsReviewRatings');
  if (ratings) {
    ratings.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-rating]');
      if (!btn) return;
      rateReviewCard(parseInt(btn.dataset.rating, 10));
    });
  }
  // Keyboard shortcuts: 1-4 = Again/Hard/Good/Easy, Space = reveal/next
  window.addEventListener('keydown', (e) => {
    if (!ReviewState.active) return;
    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      if (!ReviewState.revealed) revealReviewCard();
      return;
    }
    if (ReviewState.revealed) {
      const map = { '1': 1, '2': 2, '3': 3, '4': 4 };
      if (map[e.key]) { e.preventDefault(); rateReviewCard(map[e.key]); }
    }
  });
}

// ============================================================
//  Self-wiring fallback: attach review UI handlers as soon as
//  the DOM is ready, even if bootSyncAndBackup() never runs.
// ============================================================
(function _autoWireReview() {
  function wire() {
    var exit = document.getElementById('srsReviewExit');
    if (exit && !exit.onclick) exit.onclick = function () { endReview(); };

    var show = document.getElementById('srsReviewShow');
    if (show && !show.onclick) show.onclick = function () {
      console.log('[review] reveal clicked');
      revealReviewCard();
    };

    var play = document.getElementById('srsReviewPlay');
    if (play && !play.onclick) play.onclick = function () {
      var current = ReviewState.queue[ReviewState.idx];
      if (current) speakAr(current.item);
    };

    var ratings = document.getElementById('srsReviewRatings');
    if (ratings && !ratings._wired) {
      ratings._wired = true;
      ratings.addEventListener('click', function (e) {
        var btn = e.target.closest('button[data-rating]');
        if (!btn) return;
        rateReviewCard(parseInt(btn.dataset.rating, 10));
      });
    }
    console.log('[review] UI wired');
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }
  window.addEventListener('load', wire);
})();
