const STORY = {
  intro: [
    { who: 'Narrator', text: 'You wake at the edge of the dunes. A road of dust stretches east.' },
    { who: 'Rafiq',    text: 'Salam, traveller. The gates here speak. Speak back, and they open.' },
    { who: 'Rafiq',    text: 'Do not let the storm catch you. It takes those who forget the words.' },
  ],
  between: [
    [
      { who: 'Rafiq', text: 'The first gate yields. Good.' },
      { who: 'Rafiq', text: 'The old well ahead — rest if you can. Words come easier when you breathe.' },
    ],
    [
      { who: 'Rafiq',    text: 'The ruins remember a thousand caravans.' },
      { who: 'Narrator', text: 'Shadows shift between the stones. They are hungry.' },
    ],
    [
      { who: 'Rafiq', text: 'Long passage now. The words you missed — you will see them again.' },
      { who: 'Rafiq', text: 'The road tests memory, not strength.' },
    ],
    [
      { who: 'Narrator', text: 'The air thickens. A throne of shadow waits ahead.' },
      { who: 'Rafiq',    text: 'It speaks the oldest words. Answer well, or be unmade.' },
    ],
  ],
  victory: [
    { who: 'Rafiq',    text: 'The throne has fallen. The dust settles.' },
    { who: 'Narrator', text: 'You have earned the road beyond. سفر — the journey continues.' },
  ],
  endless: [
    { who: 'Narrator', text: 'The path beyond the throne opens. New shadows wait.' },
  ],
};

let dlgQueue = [];
let dlgDone = null;

function showDialogue(lines, done) {
  if (!G.story || !lines || !lines.length) { if (done) done(); return; }
  dlgQueue = lines.slice();
  dlgDone = done || null;
  dialogueScreen.classList.add('show');
  pauseOn();
  advanceDialogue();
}

function advanceDialogue() {
  if (!dlgQueue.length) {
    dialogueScreen.classList.remove('show');
    const cb = dlgDone;
    dlgDone = null;
    pauseOff();
    if (cb) cb();
    return;
  }
  const line = dlgQueue.shift();
  $('dlgSpeaker').textContent = line.who;
  $('dlgText').textContent = line.text;
}

$('dlgNext').addEventListener('click', advanceDialogue);
$('dlgSkip').addEventListener('click', () => { dlgQueue = []; advanceDialogue(); });

function updateLastWrongPanel() {
  if (!objSub) return;
  if (!G.lastWrong) { objSub.style.display = 'none'; return; }
  objSub.style.display = 'flex';
  const it = G.lastWrong.item;
  const text = (G.mode === 'en-ar') ? `${it.ar}  =  ${it.en}` : `${it.en}  =  ${it.ar}`;
  objSubText.textContent = 'You chose: ' + text;
}
