// ============================================================
//  Shadowing study mode — whole-dialogue playback
//  Five phases, matching the Assimil workflow:
//    1. blind    — play full audio, screen blank
//    2. english  — play full audio, English visible
//    3. arabic   — play full audio, Arabic visible
//    4. study    — no audio, full text + notes, scroll freely
//    5. confirm  — play full audio, screen blank
//  Tap advances. Replay restarts the current phase's audio.
// ============================================================

const STUDY_PHASES = [
  { id: 'blind',   label: '1 · Listen',  audio: true,  view: 'pulse' },
  { id: 'meaning', label: '2 · English', audio: true,  view: 'english' },
  { id: 'script',  label: '3 · Arabic',  audio: true,  view: 'arabic' },
  { id: 'study',   label: '4 · Study',   audio: false, view: 'full' },
  { id: 'confirm', label: '5 · Confirm', audio: true,  view: 'pulse' },
];

const StudyState = {
  phrases: [],
  dialogueAudio: '',
  phase: 0,
  active: false,
  done: null,
};

function startStudy(phrases, dialogueAudio, onDone) {
  // Support old signature: startStudy(phrases, onDone)
  if (typeof dialogueAudio === 'function') {
    onDone = dialogueAudio;
    dialogueAudio = '';
  }
  if (!phrases || !phrases.length) { if (onDone) onDone(); return; }

  initAudio();
  if (ac && ac.state === 'suspended') ac.resume();

  StudyState.phrases = phrases.slice();
  StudyState.dialogueAudio = dialogueAudio || phrases.dialogueAudio || '';
  StudyState.phase = 0;
  StudyState.active = true;
  StudyState.done = onDone || null;

  $('studyScreen').classList.add('show');
  renderStudyStep();
}

function renderStudyStep() {
  if (!StudyState.active) return;
  const phase = STUDY_PHASES[StudyState.phase];
  const content = $('studyContent');

  $('studyScreen').dataset.phase = phase.id;
  content.innerHTML = '';
  content.scrollTop = 0;

  // ---- Build content based on view ----
  if (phase.view === 'pulse') {
    const pulse = document.createElement('div');
    pulse.className = 'study-pulse';
    content.appendChild(pulse);
  }

  if (phase.view === 'english') {
    const list = document.createElement('div');
    list.className = 'study-lines';
    for (const p of StudyState.phrases) {
      const row = document.createElement('div');
      row.className = 'study-line-en';
      row.textContent = p.en + (p.hint ? `  ·  ${p.hint}` : '');
      list.appendChild(row);
    }
    content.appendChild(list);
  }

  if (phase.view === 'arabic') {
    const list = document.createElement('div');
    list.className = 'study-lines';
    for (const p of StudyState.phrases) {
      const row = document.createElement('div');
      row.className = 'study-line-ar';
      row.setAttribute('dir', 'rtl');
      row.textContent = p.ar;
      list.appendChild(row);
    }
    content.appendChild(list);
  }

  if (phase.view === 'full') {
    const list = document.createElement('div');
    list.className = 'study-lines study-lines-full';
    for (const p of StudyState.phrases) {
      const block = document.createElement('div');
      block.className = 'study-block';

      const ar = document.createElement('div');
      ar.className = 'study-block-ar';
      ar.setAttribute('dir', 'rtl');
      ar.textContent = p.ar;
      block.appendChild(ar);

      const en = document.createElement('div');
      en.className = 'study-block-en';
      en.textContent = p.en + (p.hint ? `  ·  ${p.hint}` : '');
      block.appendChild(en);

      if (p.notes) {
        const notes = document.createElement('div');
        notes.className = 'study-block-notes';
        notes.textContent = p.notes;
        block.appendChild(notes);
      }

      list.appendChild(block);
    }
    content.appendChild(list);
  }

  // ---- Phase label + progress ----
  $('studyPhaseHint').textContent = phase.label;
  $('studyProgress').textContent = `${StudyState.phase + 1} / ${STUDY_PHASES.length}`;

  // ---- Audio ----
  if (phase.audio && StudyState.dialogueAudio) {
    playDialogueAudio(StudyState.dialogueAudio);
  } else {
    stopAllAudio();
  }
}

function nextStudyStep() {
  if (!StudyState.active) return;
  StudyState.phase++;
  if (StudyState.phase >= STUDY_PHASES.length) { endStudy(); return; }
  renderStudyStep();
}

function replayStudyAudio() {
  const phase = STUDY_PHASES[StudyState.phase];
  if (phase.audio && StudyState.dialogueAudio) {
    playDialogueAudio(StudyState.dialogueAudio);
  }
}

function endStudy() {
  if (!StudyState.active) return;
  StudyState.active = false;
  stopAllAudio();
  $('studyScreen').classList.remove('show');
  const cb = StudyState.done;
  StudyState.done = null;
  if (cb) cb();
}

// ---- Bindings ----
$('studyScreen').addEventListener('pointerup', (e) => {
  if (e.target.closest('#studyReplay')) return;
  if (e.target.closest('#studyExit')) return;
  if (e.target.closest('#studySkip')) return;
  if (e.target.closest('#studyHelp')) return;
  // On the full-text phase, don't advance when the user scrolls.
  // Only advance on explicit tap of the bottom bar area or a small tap.
  if (StudyState.active && STUDY_PHASES[StudyState.phase].view === 'full') {
    // Still advance — user can tap anywhere to move on
  }
  nextStudyStep();
});

$('studyReplay').addEventListener('pointerup', (e) => {
  e.stopPropagation();
  replayStudyAudio();
});

$('studyExit').addEventListener('pointerup', (e) => {
  e.stopPropagation();
  endStudy();
});

$('studySkip').addEventListener('pointerup', (e) => {
  e.stopPropagation();
  endStudy();
});
