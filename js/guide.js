// ============================================================
//  Study guide — the Arguelles answer to "when am I done?"
//  Opened from the study screen or the briefing screen.
// ============================================================

let guideReturnScreen = null;

function openGuide(from) {
  const el = $('guideScreen');
  if (!el) return;
  // Remember where we came from so Back returns there.
  if (from) guideReturnScreen = from;
  else if (studyScreen && studyScreen.classList.contains('show')) guideReturnScreen = 'study';
  else if (briefScreen && briefScreen.classList.contains('show')) guideReturnScreen = 'brief';
  else guideReturnScreen = 'brief';

  // If opening from study, pause the audio so it doesn't talk over the guide.
  if (guideReturnScreen === 'study') {
    if (typeof stopAllAudio === 'function') stopAllAudio();
  }

  el.classList.add('show');
}

function closeGuide() {
  const el = $('guideScreen');
  if (!el) return;
  el.classList.remove('show');

  // If we came from study, resume the current phase's audio.
  if (guideReturnScreen === 'study' && typeof StudyState !== 'undefined' && StudyState.active) {
    if (typeof renderStudyStep === 'function') {
      // Re-render to resume audio on the current phase — but skip
      // rebuilding the content, just replay the audio.
      const phase = STUDY_PHASES[StudyState.phase];
      if (phase && phase.audio && StudyState.dialogueAudio && typeof playDialogueAudio === 'function') {
        playDialogueAudio(StudyState.dialogueAudio);
      }
    }
  }

  guideReturnScreen = null;
}
