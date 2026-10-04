const LESSONS_DIR = 'lessons/';

async function loadLessons() {
  const out = {};
  const errNote = $('errNote');
  let manifestOk = false;

  try {
    const res = await fetch(LESSONS_DIR + 'manifest.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('manifest HTTP ' + res.status);
    const data = await res.json();
    const entries = Array.isArray(data) ? data : (data.lessons || data.routes || []);
    manifestOk = true;

    for (const entry of entries) {
      const file = typeof entry === 'string' ? entry : entry.file;
      if (!file) continue;
      const name = (typeof entry === 'object' && entry.name)
        ? entry.name
        : file.replace(/\.(json|txt)$/i, '');
      try {
        const r = await fetch(LESSONS_DIR + encodeURI(file), { cache: 'no-store' });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const text = await r.text();
        const cleaned = parseLessonFile(text, file);
        if (cleaned.length >= 5) out[name] = cleaned;
        else console.warn('SAFAR: skipping', file, '— need 5+ phrases, got', cleaned.length);
      } catch (e) {
        console.warn('SAFAR: could not load lesson file', file, e);
      }
    }
  } catch (e) {
    console.warn('SAFAR: could not read lessons/manifest.json', e);
  }

  if (!Object.keys(out).length) {
    if (manifestOk) {
      errNote.style.display = 'block';
      errNote.textContent = 'No valid lessons found in lessons/. Need at least 5 phrases per file.';
    } else {
      errNote.style.display = 'block';
      errNote.textContent = 'Could not read lessons/manifest.json — serve over http:// and make sure the lessons/ folder exists.';
    }
    return defaults();
  }
  return out;
}

function parseLessonFile(text, filename) {
  const trimmed = text.trim();
  if (!trimmed) return [];

  // JSON — supports { ar, en, au, hint, variant }
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const ld = JSON.parse(trimmed);
      const phrases = Array.isArray(ld) ? ld : (ld.phrases || ld.items || []);
      return phrases
        .map(p => ({
          ar: p.ar || '',
          en: p.en || '',
          au: p.au || p.audio || '',
          hint: p.hint || '',
          variant: p.variant || '',
        }))
        .filter(p => p.ar && p.en);
    } catch (_) {}
  }

  // Pipe-delimited — ar | en | au | hint | variant
  return trimmed
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'))
    .map(line => {
      const parts = line.split('|').map(p => p.trim());
      return {
        ar: parts[0] || '',
        en: parts[1] || '',
        au: parts[2] || '',
        hint: parts[3] || '',
        variant: parts[4] || '',
      };
    })
    .filter(p => p.ar && p.en);
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
