// ============================================================
//  srs.js — FSRS-5 scheduler + append-only review log
// ============================================================

const SRS = (() => {
  const DAY = 86400000;
  const AGAIN = 1, HARD = 2, GOOD = 3, EASY = 4;

  const CFG = {
    w: [0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046,
        1.54575, 0.1192, 1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315,
        2.9898, 0.51655, 0.6621],
    retention: 0.9,
    maxIntervalDays: 365,
    rolloverHour: 4,

    // Recognition-only guard rails (Step 3). Review mode bypasses these
    // because it measures free recall, not multiple-choice recognition.
    easyMinStability: 7,
    earlyGameReps: 2,
    earlyStabilityCap: 2,
  };

  const DECAY = -0.5;
  const FACTOR = 19 / 81;
  const clampN = (v, a, b) => Math.min(b, Math.max(a, v));
  const W = () => CFG.w;

  const retrievability = (days, s) => Math.pow(1 + FACTOR * days / s, DECAY);
  const intervalDays = (s) => Math.min(
    CFG.maxIntervalDays,
    s / FACTOR * (Math.pow(CFG.retention, 1 / DECAY) - 1)
  );

  const initS = (g) => Math.max(0.1, W()[g - 1]);
  const initD = (g) => clampN(W()[4] - Math.exp(W()[5] * (g - 1)) + 1, 1, 10);

  function nextD(d, g) {
    const w = W();
    const lin = d + (-w[6] * (g - 3)) * (10 - d) / 9;
    return clampN(w[7] * initD(4) + (1 - w[7]) * lin, 1, 10);
  }
  function recallS(d, s, r, g) {
    const w = W();
    const hard = g === HARD ? w[15] : 1;
    const easy = g === EASY ? w[16] : 1;
    return s * (1 + Math.exp(w[8]) * (11 - d) * Math.pow(s, -w[9]) *
                (Math.exp(w[10] * (1 - r)) - 1) * hard * easy);
  }
  function forgetS(d, s, r) {
    const w = W();
    const n = w[11] * Math.pow(d, -w[12]) * (Math.pow(s + 1, w[13]) - 1) *
              Math.exp(w[14] * (1 - r));
    return Math.min(n, s);
  }
  function shortS(s, g) {
    const w = W();
    let n = s * Math.exp(w[17] * (g - 3 + w[18]));
    if (g >= GOOD) n = Math.max(n, s);
    return n;
  }

  function step(card, g, nowMs, source) {
    let s, d, state, lapses = 0, reps = 0, gr = 0;

    if (!card) {
      s = initS(g);
      d = initD(g);
      state = (g >= GOOD) ? 'review' : 'learning';
    } else {
      const days = Math.max(0, (nowMs - card.last) / DAY);
      const r = retrievability(days, card.s);
      d = nextD(card.d, g);
      if (days < 1)          s = shortS(card.s, g);
      else if (g === AGAIN)  s = forgetS(card.d, card.s, r);
      else                   s = recallS(card.d, card.s, r, g);

      lapses = card.lapses; reps = card.reps; gr = card.gr || 0;
      state = card.state;
      if (g === AGAIN) {
        if (card.state === 'review') { lapses++; state = 'relearning'; }
      } else if (g >= GOOD) {
        state = 'review';
      }
    }

    s = clampN(s, 0.1, CFG.maxIntervalDays);
    // Recognition-evidence cap only applies to game reviews.
    if (source === 'game' && gr < CFG.earlyGameReps) s = Math.min(s, CFG.earlyStabilityCap);

    return {
      s, d, state, lapses,
      reps: reps + 1,
      gr: gr + (source === 'game' ? 1 : 0),
      last: nowMs,
      due: nowMs + intervalDays(s) * DAY,
    };
  }

  function capRating(card, rating, source) {
    // Free recall (source === 'review') is trusted with Easy directly.
    if (source === 'game' && rating === EASY) {
      const ok = card && card.state === 'review' && card.s >= CFG.easyMinStability;
      return ok ? EASY : GOOD;
    }
    return rating;
  }

  function endOfStudyDay(nowMs) {
    const d = new Date(nowMs);
    d.setHours(CFG.rolloverHour, 0, 0, 0);
    if (d.getTime() <= nowMs) d.setDate(d.getDate() + 1);
    return d.getTime();
  }
  function isDue(card, nowMs) {
    if (!card) return false;
    const longInterval = (card.due - card.last) >= DAY;
    return card.due <= (longInterval ? endOfStudyDay(nowMs) : nowMs);
  }

  let db = null, log = [], cards = new Map(), deviceId = '', ready = false;

  function uuid() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 3 | 8)).toString(16);
    });
  }
  function getDeviceId() {
    try {
      let id = localStorage.getItem('safar_device_id');
      if (!id) { id = uuid(); localStorage.setItem('safar_device_id', id); }
      return id;
    } catch (_) { return 'dev-' + uuid(); }
  }

  const idbReq = (req) => new Promise((res, rej) => {
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
  function openDB() {
    return new Promise((res, rej) => {
      if (typeof indexedDB === 'undefined') return rej(new Error('IndexedDB unavailable'));
      const req = indexedDB.open('safar', 1);
      req.onupgradeneeded = () => {
        const d = req.result;
        const rv = d.createObjectStore('reviews', { keyPath: 'id' });
        rv.createIndex('reviewedAt', 'reviewedAt');
        rv.createIndex('synced', 'synced');
        d.createObjectStore('meta', { keyPath: 'key' });
      };
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  }
  const idbAll = (store) => idbReq(db.transaction(store).objectStore(store).getAll());
  const idbPut = (store, val) =>
    db ? idbReq(db.transaction(store, 'readwrite').objectStore(store).put(val)) : Promise.resolve();

  async function init() {
    if (ready) return;
    deviceId = getDeviceId();
    try {
      db = await openDB();
      log = await idbAll('reviews');
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    } catch (e) {
      console.warn('SRS: IndexedDB unavailable, reviews will not persist this session.', e);
      db = null; log = [];
    }
    rebuild();
    ready = true;
  }

  function rebuild() {
    cards = new Map();
    const sorted = log.slice().sort((a, b) =>
      (a.reviewedAt - b.reviewedAt) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    for (const e of sorted) {
      cards.set(e.cardKey, step(cards.get(e.cardKey) || null, e.rating, e.reviewedAt, e.source));
    }
  }

  const cardKey = (item, mode) => `${item.cardId || item.ar}|${mode}`;

  function grade(key, rating, opts = {}) {
    const now = opts.now || Date.now();
    const source = opts.source || 'game';
    const prev = cards.get(key) || null;
    const final = capRating(prev, rating, source);

    const telemetry = Object.assign({}, opts.telemetry);
    if (final !== rating) telemetry.rawRating = rating;

    const entry = {
      id: uuid(), cardKey: key, rating: final, reviewedAt: now,
      source, deviceId, telemetry, synced: 0,
    };
    log.push(entry);

    if (prev && now < prev.last) rebuild();
    else cards.set(key, step(prev, final, now, source));

    idbPut('reviews', entry).catch(e => console.warn('SRS: failed to persist review', e));
    return { entry, card: cards.get(key) };
  }

  function partition(keys, now = Date.now()) {
    const due = [], fresh = [], ahead = [];
    for (const k of keys) {
      const c = cards.get(k);
      if (!c) fresh.push(k);
      else if (isDue(c, now)) due.push({ k, over: now - c.due });
      else ahead.push({ k, due: c.due });
    }
    due.sort((a, b) => b.over - a.over);
    ahead.sort((a, b) => a.due - b.due);
    return { due: due.map(x => x.k), fresh, ahead: ahead.map(x => x.k) };
  }

  // ---- Sync helpers (Step 6) ----
  // Union another device's log into ours. Idempotent: dedupes by UUID.
  async function importEntries(entries) {
    if (!Array.isArray(entries) || !entries.length) return 0;
    const seen = new Set(log.map(e => e.id));
    const fresh = [];
    for (const e of entries) {
      if (!e || !e.id || seen.has(e.id)) continue;
      if (!e.cardKey || !e.rating || !e.reviewedAt) continue;
      seen.add(e.id);
      fresh.push({
        id: e.id,
        cardKey: e.cardKey,
        rating: e.rating,
        reviewedAt: e.reviewedAt,
        source: e.source || 'game',
        deviceId: e.deviceId || '',
        telemetry: e.telemetry || {},
        synced: 1,
      });
    }
    if (!fresh.length) return 0;
    for (const e of fresh) {
      log.push(e);
      idbPut('reviews', e).catch(() => {});
    }
    rebuild();
    return fresh.length;
  }

  async function markSynced(ids) {
    const set = new Set(ids);
    for (const e of log) {
      if (set.has(e.id) && !e.synced) {
        e.synced = 1;
        idbPut('reviews', e).catch(() => {});
      }
    }
  }

  return {
    init, rebuild, grade, partition, cardKey, isDue, endOfStudyDay,
    importEntries, markSynced,
    get: (k) => cards.get(k) || null,
    retrievability: (k, now = Date.now()) => {
      const c = cards.get(k);
      return c ? retrievability(Math.max(0, (now - c.last) / DAY), c.s) : null;
    },
    entries: () => log,
    deviceId: () => deviceId,
    RATING: { AGAIN, HARD, GOOD, EASY },
    CFG,
    _step: step,
  };
})();

if (typeof module !== 'undefined') module.exports = SRS;
