// ============================================================
//  Sync button shim. Defined at parse time so the inline
//  onclick in index.html can always find it.
// ============================================================
window.__syncClick = function (ev) {
  console.log('[sync] clicked');
  var panel = document.getElementById('authPanel');
  if (!panel) { alert('authPanel missing from index.html'); return false; }

  if (typeof Sync === 'undefined' || !Sync.CFG) {
    alert('sync.js did not load.');
    return false;
  }
  if (!Sync.CFG.url || !Sync.CFG.anonKey) {
    alert('Sync is not configured. Open js/sync.js and fill in Sync.CFG.url and Sync.CFG.anonKey.');
    return false;
  }

  panel.classList.toggle('show');
  if (panel.classList.contains('show')) {
    try {
      renderAuthState({ session: Sync.getSession && Sync.getSession(), busy: Sync.isBusy && Sync.isBusy() });
    } catch (e) {
      console.error('[sync] renderAuthState threw:', e);
    }
  }
  return false;
};

function showScreen(el) {
  [homeScreen, manualScreen, briefScreen, endScreen, upgradeScreen, chooseScreen,
   dialogueScreen, reviewScreen, loadingScreen, studyScreen, guideScreen]
    .filter(Boolean)
    .forEach(function (s) { s.classList.remove('show'); });
  if (el) el.classList.add('show');

  if (el === homeScreen && typeof startAmbient === 'function') startAmbient();
  else if (typeof stopAmbient === 'function') stopAmbient();
}

function showLoading(title, sub, ms, done) {
  var el = $('loadingScreen');
  if (!el) { if (done) done(); return; }
  $('loadingTitle').textContent = title || '';
  $('loadingSub').textContent = sub || '';
  el.classList.add('show');
  setTimeout(function () {
    el.classList.remove('show');
    if (done) done();
  }, ms || 1400);
}

// ============================================================
//  Home counts (Step 4)
// ============================================================
function lessonCounts(lesson) {
  if (!lesson) return { due: 0, fresh: 0 };
  var pool = lesson.cards || lesson;
  var keys = pool.map(function (it) { return SRS.cardKey(it, G.mode); });
  var parts = SRS.partition(keys);
  return { due: parts.due.length, fresh: parts.fresh.length };
}

function unitCounts(lessons) {
  var due = 0, fresh = 0;
  for (var i = 0; i < lessons.length; i++) {
    var c = lessonCounts(lessons[i].lesson);
    due += c.due; fresh += c.fresh;
  }
  return { due: due, fresh: fresh };
}

function countsLabel(c) {
  var bits = [];
  if (c.due)   bits.push(c.due + ' due');
  if (c.fresh) bits.push(c.fresh + ' new');
  return bits.join(' - ');
}

function refreshHome() {
  lessonGrid.innerHTML = '';
  var names = Object.keys(G.routes);

  var D = loadDaily();
  var dn = dayNum();
  var streak = (D.lastDay === dn || D.lastDay === dn - 1) ? (D.streak || 0) : 0;
  var todayBest = D.todayDay === dn ? (D.todayBest || 0) : 0;
  var dailyName = names.length ? names[dn % names.length] : '-';
  $('dailyLine').textContent = names.length
    ? 'Today: ' + dailyName + ' - best ' + todayBest + ' - streak ' + streak + ' days'
    : '';

  if (!names.length) {
    lessonGrid.innerHTML = '<div style="color:#6a5a3d;font-family:monospace;">No routes found in lessons/.</div>';
    return;
  }

  var books = new Map();
  for (var ni = 0; ni < names.length; ni++) {
    var name = names[ni];
    var lesson = G.routes[name];
    var book = lesson.book || 1;
    var unit = lesson.unit || 0;
    if (!books.has(book)) books.set(book, new Map());
    var units = books.get(book);
    if (!units.has(unit)) units.set(unit, []);
    units.get(unit).push({ name: name, lesson: lesson });
  }

  var bookNums = Array.from(books.keys()).sort(function (a, b) { return a - b; });
  var multiBook = bookNums.length > 1;

  for (var bi = 0; bi < bookNums.length; bi++) {
    var bookNum = bookNums[bi];
    var bookUnits = books.get(bookNum);
    var unitNums = Array.from(bookUnits.keys()).sort(function (a, b) { return a - b; });

    var bookContainer;
    if (multiBook) {
      bookContainer = document.createElement('details');
      bookContainer.className = 'book-section';
      bookContainer.open = loadBookOpen(bookNum);

      var bookSummary = document.createElement('summary');
      bookSummary.className = 'book-header';
      var lessonCount = 0;
      for (var ui0 = 0; ui0 < unitNums.length; ui0++) lessonCount += bookUnits.get(unitNums[ui0]).length;
      bookSummary.innerHTML =
        '<span class="book-num">Book ' + bookNum + '</span>' +
        '<span class="book-count">' + lessonCount + ' dialogue' + (lessonCount === 1 ? '' : 's') + '</span>';
      bookContainer.appendChild(bookSummary);

      var bookBody = document.createElement('div');
      bookBody.className = 'book-body';
      bookContainer.appendChild(bookBody);
      (function (bn, el) {
        el.addEventListener('toggle', function () { saveBookOpen(bn, el.open); });
      })(bookNum, bookContainer);
      lessonGrid.appendChild(bookContainer);
      bookContainer = bookBody;
    } else {
      bookContainer = lessonGrid;
    }

    for (var ui = 0; ui < unitNums.length; ui++) {
      var unitNum = unitNums[ui];
      var lessons = bookUnits.get(unitNum).slice().sort(function (a, b) {
        return a.name.localeCompare(b.name);
      });

      var topicCounts = {};
      for (var li = 0; li < lessons.length; li++) {
        if (lessons[li].lesson.topic) {
          topicCounts[lessons[li].lesson.topic] = (topicCounts[lessons[li].lesson.topic] || 0) + 1;
        }
      }
      var topTopic = Object.entries(topicCounts).sort(function (a, b) { return b[1] - a[1]; })[0];
      var unitLabel = unitNum > 0 ? 'Unit ' + unitNum : 'Other';
      var unitTopic = topTopic ? topTopic[0] : '';

      var uCounts = unitCounts(lessons);
      var uCountsTxt = countsLabel(uCounts);

      var section = document.createElement('details');
      section.className = 'unit-section';
      section.open = loadUnitOpen(bookNum, unitNum, false);

      var summary = document.createElement('summary');
      summary.className = 'unit-header';
      summary.innerHTML =
        '<span class="unit-num">' + unitLabel + '</span>' +
        (unitTopic ? '<span class="unit-topic">' + unitTopic + '</span>' : '') +
        (uCountsTxt ? '<span class="unit-due">' + uCountsTxt + '</span>' : '') +
        '<span class="unit-count">' + lessons.length + ' dialogue' + (lessons.length === 1 ? '' : 's') + '</span>';
      section.appendChild(summary);
      (function (bn, un, el) {
        el.addEventListener('toggle', function () { saveUnitOpen(bn, un, el.open); });
      })(bookNum, unitNum, section);

      var grid = document.createElement('div');
      grid.className = 'lesson-grid';

      for (var lj = 0; lj < lessons.length; lj++) {
        var lname = lessons[lj].name;
        var llesson = lessons[lj].lesson;
        var stat = G.stats[lname];
        var card = document.createElement('div');
        card.className = 'lesson-card';
        var pool = llesson.cards || llesson;
        var c = lessonCounts(llesson);

        var bits = [pool.length + ' cards'];
        if (stat && stat.bestRooms != null) bits.push(stat.bestRooms + ' rooms');
        if (stat && stat.bestScore) bits.push(stat.bestScore + ' pts');
        var meta = bits.join(' - ');
        var badges = countsLabel(c);

        var nameEl = document.createElement('div');
        nameEl.className = 'name';
        nameEl.textContent = lname;
        card.appendChild(nameEl);

        var metaEl = document.createElement('div');
        metaEl.className = 'meta';
        metaEl.textContent = meta;
        card.appendChild(metaEl);

        if (badges) {
          var badgeEl = document.createElement('div');
          badgeEl.className = 'badges';
          badgeEl.textContent = badges;
          card.appendChild(badgeEl);
        }

        (function (n) { card.onclick = function () { openBriefing(n, false); }; })(lname);
        grid.appendChild(card);
      }

      section.appendChild(grid);
      bookContainer.appendChild(section);
    }
  }
}

// ---------- collapse state persistence ----------
const UI_STATE_KEY = 'safar_ui_v1';
function loadUIState() {
  try { return JSON.parse(localStorage.getItem(UI_STATE_KEY) || '{}'); } catch (_) { return {}; }
}
function saveUIState(s) {
  try { localStorage.setItem(UI_STATE_KEY, JSON.stringify(s)); } catch (_) {}
}
function loadBookOpen(book) {
  var s = loadUIState();
  return s.books && typeof s.books[book] === 'boolean' ? s.books[book] : false;
}
function saveBookOpen(book, open) {
  var s = loadUIState();
  s.books = s.books || {};
  s.books[book] = open;
  saveUIState(s);
}
function loadUnitOpen(book, unit, def) {
  var s = loadUIState();
  var key = book + ':' + unit;
  return s.units && typeof s.units[key] === 'boolean' ? s.units[key] : def;
}
function saveUnitOpen(book, unit, open) {
  var s = loadUIState();
  s.units = s.units || {};
  s.units[book + ':' + unit] = open;
  saveUIState(s);
}

function openBriefing(name, daily) {
  daily = !!daily;
  G.daily = daily;
  G.currentName = name;
  G.currentLesson = G.routes[name] || [];
  G.currentCards = G.currentLesson.cards || G.currentLesson;
  briefTitle.textContent = daily ? 'DAILY ROUTE' : name;
  var stat = G.stats[name];
  var c = lessonCounts(G.currentLesson);

  var sub = (daily ? name + ' - ' : '') + G.currentCards.length + ' cards';
  if (!daily && stat && stat.bestScore) sub += ' - best ' + stat.bestScore + ' pts';
  if (c.due)   sub += ' - ' + c.due + ' due';
  if (c.fresh) sub += ' - ' + c.fresh + ' new';
  briefSub.textContent = sub;

  $('briefInfo').textContent = daily
    ? 'Same gate order for everyone today. 5 rooms. One shot at your best score.'
    : '5 rooms. Read fast, fight hard. The boss waits in the dark - and beyond it, the endless road.';

  modeRow.querySelectorAll('button').forEach(function (b) {
    b.classList.toggle('active', b.dataset.mode === G.mode);
  });
  voiceRow.querySelectorAll('button').forEach(function (b) {
    b.classList.toggle('active', (b.dataset.voice === '1') === G.voice);
  });
  difficultyRow.querySelectorAll('button').forEach(function (b) {
    b.classList.toggle('active', b.dataset.diff === G.difficulty);
  });
  var readingRow = $('readingRow');
  if (readingRow) {
    readingRow.querySelectorAll('button').forEach(function (b) {
      b.classList.toggle('active', b.dataset.reading === G.reading);
    });
  }
  preloadLessonAudio(G.currentLesson);
  showScreen(briefScreen);
}

function startRun() {
  initAudio();
  if (ac && ac.state === 'suspended') ac.resume();
  showScreen(null);
  G.rooms = buildRun();
  G.roomIdx = 0; G.roomsCleared = 0; G.stars = 3;
  G.correct = 0; G.wrong = 0; G.kills = 0; G.bossDefeated = false;
  G.score = 0; G.combo = 0; G.bestCombo = 0;
  G.shield = false; G.endless = false;
  G.lastWrong = null;
  updateLastWrongPanel();
  G.seenThisRun = new Set();
  G.advancing = false;
  G.maxStamina = 100;
  G.up = { speed: 1, regen: 1, range: 1, burstCd: 1, storm: 1 };
  G.paused = false; G.pausedMs = 0;
  G.keys = {};
  G.touchSprint = false;
  var _sb = $('sprintBtn');
  if (_sb) _sb.classList.remove('active');
  G.startTime = nowMs();
  G.startWall = Date.now();
  G.running = true;
  G.gradedThisRun = new Set();
  G.tgt = null;
  preloadLessonAudio(G.currentLesson);
  showLoading(G.currentName, 'Deploying', 1200, function () { enterRoom(0); });
}

function endRun(victory) {
  if (!G.running) return;
  G.running = false;
  pauseOff();
  G.keys = {};
  upgradeScreen.classList.remove('show');
  chooseScreen.classList.remove('show');

  var elapsed = Math.max(0, Math.round((nowMs() - G.startTime - G.pausedMs) / 1000));
  var mins = Math.floor(elapsed / 60);
  var secs = String(elapsed % 60).padStart(2, '0');
  var title = victory ? 'JOURNEY COMPLETE' : 'STORM TOOK YOU';
  var sub = victory
    ? G.rooms.length + ' rooms crossed'
    : 'Fell in room ' + (G.roomIdx + 1) + (G.endless ? '' : ' of ' + G.rooms.length);
  if (G.daily) sub = 'DAILY - ' + sub;

  var prev = G.stats[G.currentName] || {};
  var isHigh = G.score > 0 && G.score > (prev.bestScore || 0);
  if (isHigh) sub += ' - NEW HIGH SCORE';

  $('endTitle').textContent = title;
  $('endTitle').className = 'end-title' + (victory ? '' : ' warn');
  $('endSub').textContent = G.currentName + ' - ' + sub;
  $('endScore').textContent = G.score;
  $('endCombo').textContent = 'x' + G.bestCombo;
  $('endCorrect').textContent = G.correct;
  $('endWrong').textContent = G.wrong;
  $('endKills').textContent = G.kills;
  $('endBoss').textContent = G.bossDefeated ? 'Defeated' : '-';
  $('endTime').textContent = mins + ':' + secs;
  $('endRooms').textContent = G.endless
    ? String(G.roomsCleared)
    : G.roomsCleared + '/' + G.rooms.length;

  G.stats[G.currentName] = {
    bestRooms: Math.max(prev.bestRooms || 0, G.roomsCleared),
    bestScore: Math.max(prev.bestScore || 0, G.score),
    plays: (prev.plays || 0) + 1,
    lastPlayed: Date.now(),
  };
  saveStats(G.stats);

  if (G.daily) {
    var D = loadDaily();
    var dn = dayNum();
    if (D.todayDay !== dn) { D.todayDay = dn; D.todayBest = 0; }
    D.todayBest = Math.max(D.todayBest || 0, G.score);
    if (D.lastDay !== dn) {
      D.streak = (D.lastDay === dn - 1) ? (D.streak || 0) + 1 : 1;
      D.lastDay = dn;
    }
    saveDaily(D);
  }

  if (victory) S.victory(); else S.death();

  if (typeof renderRunSummary === 'function') renderRunSummary();
  if (typeof Sync !== 'undefined' && Sync.CFG && Sync.CFG.url) Sync.triggerSoon(500);

  showScreen(endScreen);
}

// ============================================================
//  UI bindings
// ============================================================
$('openManualBtn').onclick = function () { showScreen(manualScreen); startDemo(); };
$('closeManualBtn').onclick = function () { refreshHome(); showScreen(homeScreen); };
$('dailyBtn').onclick = function () {
  var names = Object.keys(G.routes);
  if (!names.length) return;
  openBriefing(names[dayNum() % names.length], true);
};
$('backHomeBtn').onclick = function () { refreshHome(); showScreen(homeScreen); };
$('startBtn').onclick = function () { startRun(); };
$('endBackBtn').onclick = function () { refreshHome(); showScreen(homeScreen); };
$('againBtn').onclick = function () { startRun(); };
$('claimBtn').onclick = function () {
  chooseScreen.classList.remove('show');
  pauseOff();
  endRun(true);
};
$('pressOnBtn').onclick = function () {
  chooseScreen.classList.remove('show');
  pauseOff();
  G.endless = true;
  showLoading('Endless', 'Deeper into the dust', 1200, function () { enterRoom(G.roomIdx); });
};

// ---------- Study guide bindings ----------
var guideExitBtn = $('guideExit');
if (guideExitBtn) guideExitBtn.onclick = closeGuide;

var guideBackBtn = $('guideBackBtn');
if (guideBackBtn) guideBackBtn.onclick = closeGuide;

var studyHelpBtn = $('studyHelp');
if (studyHelpBtn) studyHelpBtn.onclick = function (e) { e.stopPropagation(); openGuide('study'); };

var briefGuideLink = $('briefGuideLink');
if (briefGuideLink) briefGuideLink.onclick = function (e) { e.stopPropagation(); openGuide('brief'); };

var studyBtn = $('studyBtn');
if (studyBtn) {
  studyBtn.onclick = function () {
    if (typeof startStudy !== 'function') return;
    var audio = (G.currentLesson && G.currentLesson.dialogueAudio) || '';
    startStudy(G.currentLesson, audio, function () {});
  };
}

// Review mode entry (Step 7)
var reviewBtn = $('reviewBtn');
if (reviewBtn) reviewBtn.onclick = function () { startReview(); };

modeRow.addEventListener('click', function (e) {
  var btn = e.target.closest('button');
  if (!btn) return;
  modeRow.querySelectorAll('button').forEach(function (b) { b.classList.remove('active'); });
  btn.classList.add('active');
  G.mode = btn.dataset.mode;
});

voiceRow.addEventListener('click', function (e) {
  var btn = e.target.closest('button');
  if (!btn) return;
  voiceRow.querySelectorAll('button').forEach(function (b) { b.classList.remove('active'); });
  btn.classList.add('active');
  G.voice = btn.dataset.voice === '1';
  if (G.voice) preloadLessonAudio(G.currentLesson);
});

difficultyRow.addEventListener('click', function (e) {
  var btn = e.target.closest('button');
  if (!btn) return;
  difficultyRow.querySelectorAll('button').forEach(function (b) { b.classList.remove('active'); });
  btn.classList.add('active');
  G.difficulty = btn.dataset.diff;
});

var readingRowEl = $('readingRow');
if (readingRowEl) {
  readingRowEl.addEventListener('click', function (e) {
    var btn = e.target.closest('button');
    if (!btn) return;
    readingRowEl.querySelectorAll('button').forEach(function (b) { b.classList.remove('active'); });
    btn.classList.add('active');
    G.reading = btn.dataset.reading;
  });
}

objReplay.addEventListener('click', function (e) {
  e.stopPropagation();
  if (G.targetGate) { noteReplay(); speakAr(G.targetGate.item); }
});
objSubReplay.addEventListener('click', function (e) {
  e.stopPropagation();
  if (G.lastWrong) speakAr(G.lastWrong.item);
});
document.querySelector('.objective-line').addEventListener('click', function (e) {
  e.stopPropagation();
  if (G.targetGate) { noteReplay(); speakAr(G.targetGate.item); }
});

// ============================================================
//  Room review
// ============================================================
function showRoomReview(done) {
  var seen = G.roomPhrases || [];
  var wrong = seen.filter(function (p) { return !p.correct; });
  var right = seen.filter(function (p) { return p.correct; });

  var shown = [];
  var seenAr = new Set();
  var i;
  for (i = 0; i < wrong.length; i++) {
    if (shown.length >= 3) break;
    if (seenAr.has(wrong[i].item.ar)) continue;
    seenAr.add(wrong[i].item.ar);
    shown.push(wrong[i]);
  }
  for (i = 0; i < right.length; i++) {
    if (shown.length >= 4) break;
    if (seenAr.has(right[i].item.ar)) continue;
    seenAr.add(right[i].item.ar);
    shown.push(right[i]);
  }

  if (!shown.length) { done(); return; }

  var prevRoom = G.rooms[G.roomIdx - 1];
  var nextRoom = G.rooms[G.roomIdx];
  var prevRoomName = (prevRoom && prevRoom.name) || 'The road';
  var nextRoomName = nextRoom
    ? nextRoom.name
    : (G.endless ? 'The endless road' : 'The road home');

  var list = $('reviewList');
  list.innerHTML = '';
  var ctxItems = (G.roomPhrases || []).map(function (x) { return x.item; });

  for (i = 0; i < shown.length; i++) {
    var p = shown[i];
    var row = document.createElement('div');
    row.className = 'review-row ' + (p.correct ? 'ok' : 'bad');

    var ar = G.mode === 'en-ar' ? renderAr(p.item, ctxItems, G.reading) : p.item.en;
    var en = G.mode === 'en-ar' ? p.item.en : renderAr(p.item, ctxItems, G.reading);
    var dir = G.mode === 'en-ar' ? 'rtl' : 'ltr';
    var hint = p.item.hint ? ' - ' + p.item.hint : '';

    var mark = document.createElement('div');
    mark.className = 'review-mark';
    mark.textContent = p.correct ? '\u2713' : '\u2717';

    var body = document.createElement('div');
    body.className = 'review-body';

    var arEl = document.createElement('div');
    arEl.className = 'review-ar';
    arEl.setAttribute('dir', dir);
    arEl.textContent = ar;

    var enEl = document.createElement('div');
    enEl.className = 'review-en';
    enEl.textContent = en + hint;

    body.appendChild(arEl);
    body.appendChild(enEl);
    row.appendChild(mark);
    row.appendChild(body);

    (function (item) {
      row.onclick = function () {
        initAudio();
        if (ac && ac.state === 'suspended') ac.resume();
        speakAr(item);
      };
    })(p.item);

    list.appendChild(row);
  }

  $('reviewFrom').textContent = prevRoomName;
  $('reviewTo').textContent = nextRoomName;

  reviewScreen.classList.add('show');
  pauseOn();

  var rows = list.querySelectorAll('.review-row');
  var idx = 0;
  function reveal() {
    if (idx >= rows.length) return;
    rows[idx].classList.add('shown');
    idx++;
    setTimeout(reveal, 550);
  }
  setTimeout(reveal, 300);

  var totalTime = 500 + shown.length * 550 + 2200;
  var revealDone = 300 + shown.length * 550 + 600;

  var armed = false;
  var downOnReview = false;
  var handled = false;

  function onDown() { downOnReview = true; }
  function onUp() {
    if (handled) return;
    if (!armed) { downOnReview = false; return; }
    if (!downOnReview) return;
    downOnReview = false;
    handled = true;
    cleanup();
    reviewScreen.classList.remove('show');
    pauseOff();
    done();
  }
  function cleanup() {
    clearTimeout(timer);
    reviewScreen.removeEventListener('pointerdown', onDown);
    reviewScreen.removeEventListener('pointerup', onUp);
  }
  var timer = setTimeout(function () {
    if (handled) return;
    handled = true;
    cleanup();
    reviewScreen.classList.remove('show');
    pauseOff();
    done();
  }, totalTime);

  setTimeout(function () { armed = true; }, revealDone);
  reviewScreen.addEventListener('pointerdown', onDown);
  reviewScreen.addEventListener('pointerup', onUp);
}

// ============================================================
//  Pause
// ============================================================
function enterPause() {
  if (G.userPaused) return;
  G.userPaused = true;
  pauseScreen.classList.add('show');
  pauseOn();
  G.keys = {};
}
function resumeFromPause() {
  if (!G.userPaused) return;
  G.userPaused = false;
  pauseScreen.classList.remove('show');
  pauseOff();
}
function togglePause() {
  if (!G.running) return;
  if (chooseScreen.classList.contains('show')) return;
  if (G.userPaused) resumeFromPause();
  else enterPause();
}
document.getElementById('pauseBtn').addEventListener('click', togglePause);
document.getElementById('pauseResume').addEventListener('click', resumeFromPause);
document.getElementById('pauseQuit').addEventListener('click', function () {
  resumeFromPause();
  endRun(false);
});

// ============================================================
//  Auth panel rendering (Step 6)
//  Built with DOM APIs, not innerHTML, so quote characters
//  in strings can never break parsing.
// ============================================================
function _el(tag, attrs, text) {
  var el = document.createElement(tag);
  if (attrs) {
    for (var k in attrs) {
      if (Object.prototype.hasOwnProperty.call(attrs, k)) el.setAttribute(k, attrs[k]);
    }
  }
  if (text != null) el.textContent = text;
  return el;
}

// Track the last rendered auth "identity" so we only rebuild the panel
// when the signed-in user actually changes — not on every busy flip from
// Sync.notify(). Otherwise the "Sync now → Syncing… → Synced" label
// update gets wiped the moment notify() fires at the start of syncNow().
var _lastAuthKey = '__init__';

function renderAuthState(state) {
  var session = (state && state.session) || null;
  var busy = !!(state && state.busy);

  // Cheap update every time — the status dot.
  var dot = $('syncDot');
  if (dot) {
    dot.className = 'sync-dot' + (session ? ' on' : '') + (busy ? ' busy' : '');
  }

  // Only rebuild the panel when the signed-in identity changes.
  var key = session && session.user ? session.user.id : 'out';
  if (key === _lastAuthKey) return;
  _lastAuthKey = key;

  var label = $('syncLabel');
  var body = $('authBody');

  if (label) {
    var em = session && session.user && session.user.email ? session.user.email : '';
    label.textContent = session ? (em || 'signed in') : 'Sign in';
  }
  if (!body) return;
  body.textContent = '';

  if (session) {
    var status = _el('div', { class: 'auth-status' });
    status.appendChild(document.createTextNode('Signed in as '));
    var emEl = _el('b', null, (session.user && session.user.email) || '');
    status.appendChild(emEl);
    body.appendChild(status);

    var row = _el('div', { class: 'btn-row' });
    var syncBtn = _el('button', { class: 'btn gold', id: 'authSyncBtn' }, 'Sync now');
    syncBtn.onclick = function () {
      syncBtn.textContent = 'Syncing...';
      Sync.syncNow().then(function (r) {
        syncBtn.textContent = (r && r.ok) ? 'Synced' : ((r && r.skipped) ? 'Sync' : 'Retry');
        setTimeout(function () {
          if (syncBtn && syncBtn.parentNode) syncBtn.textContent = 'Sync now';
        }, 1200);
      });
    };
    var outBtn = _el('button', { class: 'btn ghost', id: 'authOutBtn' }, 'Sign out');
    outBtn.onclick = function () { Sync.signOut(); };
    row.appendChild(syncBtn);
    row.appendChild(outBtn);
    body.appendChild(row);
    return;
  }

  // ---- Signed out ----
  body.appendChild(_el('div', { class: 'auth-status' }, 'Sign in or create an account.'));

  var emailInput = _el('input', {
    id: 'authEmail', type: 'email', inputmode: 'email',
    autocomplete: 'email', placeholder: 'you@example.com', class: 'auth-input',
  });
  body.appendChild(emailInput);

  var pwWrap = _el('div', { class: 'auth-pw-wrap' });
  var pwInput = _el('input', {
    id: 'authPassword', type: 'password',
    autocomplete: 'current-password', placeholder: 'Password (8+ chars)', class: 'auth-input',
  });
  var pwToggle = _el('button', {
    type: 'button', class: 'auth-pw-toggle', 'aria-label': 'Show password',
    tabindex: '-1',
  }, '\u{1F441}');

  pwToggle.onclick = function () {
    var showing = pwInput.type === 'text';
    pwInput.type = showing ? 'password' : 'text';
    pwToggle.textContent = showing ? '\u{1F441}' : '\u{1F576}';
    pwToggle.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
    pwInput.focus();
  };

  pwWrap.appendChild(pwInput);
  pwWrap.appendChild(pwToggle);
  body.appendChild(pwWrap);

  var row2 = _el('div', { class: 'btn-row' });
  var signInBtn = _el('button', { class: 'btn gold', id: 'authSignInBtn' }, 'Sign in');
  var signUpBtn = _el('button', { class: 'btn ghost', id: 'authSignUpBtn' }, 'Create account');
  row2.appendChild(signInBtn);
  row2.appendChild(signUpBtn);
  body.appendChild(row2);

  var errEl = _el('div', { class: 'auth-error', id: 'authError' });
  errEl.style.display = 'none';
  body.appendChild(errEl);

  function showErr(msg) {
    errEl.textContent = msg;
    errEl.style.display = 'block';
  }
  function readCreds() {
    var email = (emailInput.value || '').trim();
    var pw = pwInput.value || '';
    if (!email) { showErr('Email required.'); return null; }
    if (pw.length < 6) { showErr('Password must be at least 6 characters.'); return null; }
    return { email: email, pw: pw };
  }

  signInBtn.onclick = function () {
    errEl.style.display = 'none';
    var c = readCreds();
    if (!c) return;
    signInBtn.textContent = 'Signing in...';
    Sync.signIn(c.email, c.pw).catch(function (e) {
      showErr(e.message || String(e));
      signInBtn.textContent = 'Sign in';
    });
  };

  signUpBtn.onclick = function () {
    errEl.style.display = 'none';
    var c = readCreds();
    if (!c) return;

    signUpBtn.textContent = 'Creating...';
    signUpBtn.disabled = true;
    signInBtn.disabled = true;

    var done = false;
    var watchdog = setTimeout(function () {
      if (done) return;
      done = true;
      signUpBtn.textContent = 'Create account';
      signUpBtn.disabled = false;
      signInBtn.disabled = false;
      showErr('Timed out. Check Supabase logs.');
    }, 15000);

    Sync.signUp(c.email, c.pw).then(function (data) {
      if (done) return;
      done = true;
      clearTimeout(watchdog);
      signUpBtn.textContent = 'Create account';
      signUpBtn.disabled = false;
      signInBtn.disabled = false;
      if (!data || !data.session) {
        showErr('Account created, but no session was returned. Turn OFF "Confirm email" in Supabase, then press Sign in.');
      }
    }).catch(function (e) {
      if (done) return;
      done = true;
      clearTimeout(watchdog);
      signUpBtn.textContent = 'Create account';
      signUpBtn.disabled = false;
      signInBtn.disabled = false;
      showErr(e.message || String(e));
    });
  };
}

function wireSyncUI() {
  var btn = $('syncBtn');
  var panel = $('authPanel');
  var close = $('authClose');
  if (btn) btn.onclick = function () {
    if (!Sync.isConfigured()) {
      alert('Sync not configured. Fill in Sync.CFG in js/sync.js.');
      return;
    }
    panel.classList.toggle('show');
    renderAuthState({ session: Sync.getSession(), busy: Sync.isBusy() });
  };
  if (close) close.onclick = function () { panel.classList.remove('show'); };

  if (Sync && Sync.onState) {
    Sync.onState(function (s) { renderAuthState(s); });
  }
}

function bootSyncAndBackup() {
  try {
    if (typeof Sync !== 'undefined' && Sync.wireLifecycle) {
      Sync.wireLifecycle();
      Sync.bootstrap().then(function () {
        renderAuthState({ session: Sync.getSession(), busy: Sync.isBusy() });
        if (Sync.getSession()) Sync.syncNow();
      }).catch(function (e) {
        console.warn('Sync bootstrap failed:', e && e.message);
      });
    }
  } catch (e) { console.warn('Sync init failed:', e); }

  try { if (typeof wireBackupButtons === 'function') wireBackupButtons(); }
  catch (e) { console.warn('wireBackupButtons failed:', e); }

  try { if (typeof wireReviewUI === 'function') wireReviewUI(); }
  catch (e) { console.warn('wireReviewUI failed:', e); }

  try { wireSyncUI(); }
  catch (e) { console.warn('wireSyncUI failed:', e); }
}
