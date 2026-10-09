const LESSONS_DIR = 'lessons/';

async function loadManifest() {
  const errNote = $('errNote');
  try {
    const res = await fetch(LESSONS_DIR + 'manifest.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('manifest HTTP ' + res.status);
    const data = await res.json();
    return Array.isArray(data) ? data : (data.lessons || []);
  } catch (e) {
    console.warn('SAFAR: could not read lessons/manifest.json', e);
    errNote.style.display = 'block';
    errNote.textContent = 'Could not read lessons/manifest.json — serve over http:// and make sure the lessons/ folder exists.';
    return [];
  }
}

// Fallback id for lesson files that haven't been given explicit cardIds yet.
// Explicit ids are strongly preferred (they survive text edits); this only
// keeps old files playable.
function fallbackCardId(entry, file, ar) {
  const base = entry.lessonId || file.replace(/\.json$/i, '');
  return base.replace(/\s+/g, '').toLowerCase() + '.' + stripHarakat(ar).replace(/\s+/g, '_');
}

async function loadOneLesson(file) {
  const r = await fetch(LESSONS_DIR + encodeURI(file), { cache: 'no-store' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const entry = await r.json();

  let fallbackCount = 0;
  const phrases = (entry.phrases || [])
    .map(p => {
      const isCard = p.card !== false;            // default: true
      let cardId = p.cardId || '';
      if (isCard && !cardId) { cardId = fallbackCardId(entry, file, p.ar || ''); fallbackCount++; }
      return {
        id: p.id || '',
        cardId,
        card: isCard,
        ar: p.ar || '',
        en: p.en || '',
        au: p.au || p.audio || '',
        variant: p.gender || p.variant || '',
        hint: p.hint || '',
        common: !!p.common,
        notes: p.notes || '',
      };
    })
    .filter(p => p.ar && p.en);

  if (fallbackCount) console.warn(`SAFAR: ${file} has ${fallbackCount} phrase(s) without cardId; using derived ids.`);

  // Game pool: one entry per cardId (first occurrence wins), no card:false lines.
  // Study mode keeps using the full `phrases` array.
  const cards = [];
  const byId = new Map();
  for (const p of phrases) {
    if (!p.card) continue;
    const prev = byId.get(p.cardId);
    if (prev) {
      if (prev.en !== p.en) console.warn(`SAFAR: ${file}: cardId "${p.cardId}" has differing English ("${prev.en}" vs "${p.en}")`);
      continue;
    }
    byId.set(p.cardId, p);
    cards.push(p);
  }

  if (cards.length < 5) throw new Error('need 5+ cards, got ' + cards.length);

  phrases.cards = cards;
  phrases.dialogueAudio = entry.dialogueAudio || '';
  phrases.displayName =
    entry.lessonId && entry.title
      ? entry.lessonId + ' · ' + entry.title
      : (entry.name || file.replace(/\.json$/i, ''));
  phrases.lessonId = entry.lessonId || '';
  phrases.unit = entry.unit || 0;
  phrases.topic = entry.topic || '';
  phrases.book = entry.book || 1;

  return phrases;
}

async function loadLessons() {
  const manifest = await loadManifest();
  const out = {};
  const results = await Promise.allSettled(
    manifest.map(entry => {
      const file = typeof entry === 'string' ? entry : entry.file;
      return loadOneLesson(file).then(p => ({ file, phrases: p }));
    })
  );
  for (const r of results) {
    if (r.status === 'fulfilled') {
      out[r.value.phrases.displayName] = r.value.phrases;
    } else {
      console.warn('SAFAR: skipped a lesson file:', r.reason && r.reason.message);
    }
  }
  if (!Object.keys(out).length) {
    $('errNote').style.display = 'block';
    $('errNote').textContent = 'No valid lessons loaded. Check lessons/ files.';
    return defaults();
  }
  return out;
}

function dayNum() {
  const d = new Date();
  return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000);
}
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
