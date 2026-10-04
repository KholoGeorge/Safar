# SAFAR · سفر
### *A Dust Journey*

> *Read the gates. Fight the shadows. Outrun the storm.*

---

## ✦ What is this?

**SAFAR** *(Arabic: journey, voyage, departure)* is a browser game that teaches you Arabic by making you read it — not by quizzing you, but by putting you in a dark corridor with a storm at your heels and shadows in your face.

The HUD shows you a phrase. The walls hold doors. Each door speaks a different Arabic line. Find the one that matches, walk into it, and the road opens.

Miss, and the dust takes a piece of you.

---

## ✦ The Loop

```
┌─────────────────────────────────────────────────┐
│                                                 │
│   FIND                                          │
│   "How are you?"                    1 / 6       │
│                                     SCORE 340   │
│                                                 │
│         ┌──────────────┐                        │
│         │  كَيْفَ حَالُكَ │ ← the right door      │
│         └──────────────┘                        │
│                                                 │
│         ┌──────────────┐                        │
│         │  أَنَا بِخَيْرٍ │ ← the wrong door      │
│         └──────────────┘                        │
│                                                 │
│         ·  ·  ·  ·  ·  ·  ·  ·  ·               │
│         ▲ shadows drift in from the dark        │
│                                                 │
│   ◆◆◆  CONDITION                                │
│   ▬▬▬▬▬▬  STAMINA                               │
│                                                 │
│   ~~~~~~~~~~~~~~~~~~~~~~  ← the storm rises     │
│                                                 │
└─────────────────────────────────────────────────┘
```

Read. Choose. Move. Survive. Repeat.

---

## ✦ What's Waiting For You

**Six rooms.** Four combat. Two quiet. One throne at the end.

**Three enemy kinds.**
- **Drifters** — they hunt. Slow, patient, inevitable.
- **Chargers** — they wind up, then lunge. Punish hesitation.
- **Splitters** — kill one, two more wake up.

**One storm.** It rises from below. It never stops. It does not care how well you're reading.

**One boss.** *The Shadow Throne.* Armoured, throws bolts, lunges. Falls back after ten seconds if you linger — so you can't just stand there and wait.

**Quiet rooms.** No enemies. No storm. Just you and glowing nodes scattered across a room that isn't trying to kill you. Walk up to one, tap it, and a phrase unfolds with a small scene around it.

---

## ✦ The Tricks

- **Missed phrases come back.** The game remembers what you got wrong and puts it in front of you more often. You learn by running into the same door twice.
- **Combo multiplier.** Chain correct gates. ×2, ×3, ×4, ×5. One wrong answer resets it to zero.
- **Speed bonus.** The faster you read, the more you score. The phrase doesn't wait.
- **Three conditions.** Three stars. Three mistakes. Then it's over.
- **Daily Route.** Same gate order for everyone, seeded by the date. One shot at the day's best score.

---

## ✦ Playing It

### Desktop

| | |
|---|---|
| `WASD` / arrows | Move |
| `Shift` | Sprint — drains stamina |
| `Space` | Dash — 34 stamina |
| `J` / left-click | Staff swing |
| `K` / right-click | Light burst — 40 stamina |
| `Esc` | Pause |
| Tap the phrase | Replay the audio |

### Touch

- **Left thumb** — the joystick appears wherever you press. Push far to sprint.
- **Right thumb, top half** — Blast (radial wave)
- **Right thumb, bottom half** — Staff (auto-aims at the nearest enemy)
- **Tap a glowing node** — inspect it

No buttons on screen. The controls live in the corners of your thumbs.

---

## ✦ Add Your Own Lessons

SAFAR reads routes from `lessons/`. Each route is a list of Arabic/English phrase pairs.

**`lessons/aby1-1.json`**
```json
[
  { "ar": "كَيْفَ حَالُكَ",   "en": "How are you?",     "au": "kayfa_haluk.mp3" },
  { "ar": "أَنَا بِخَيْرٍ",   "en": "I am fine",        "au": "ana_bikhayr.mp3" },
  { "ar": "مَا اسْمُكَ",     "en": "What is your name?", "au": "ma_ismuk.mp3" }
]
```

**Or plain text** — pipe-delimited, one phrase per line:

```
كَيْفَ حَالُكَ | How are you? | kayfa_haluk.mp3
أَنَا بِخَيْرٍ | I am fine | ana_bikhayr.mp3
```

**Register it** in `lessons/manifest.json`:

```json
[
  { "name": "ABY 1-1", "file": "aby1-1.json" },
  "survival-phrases.txt"
]
```

A file needs **at least 5 phrases** to load. Anything shorter is skipped with a console warning.

Drop matching audio into `audio/` and the game plays it when you find the right gate. No audio? It stays silent — the game doesn't require it.

---

## ✦ Running It

`fetch()` won't load lessons over `file://`. You need a local server.

```bash
# Python
python3 -m http.server 8000

# Node
npx serve .

# PHP
php -S localhost:8000
```

Then open **`http://localhost:8000/`**.

---

## ✦ Under the Hood

```
SAFAR/
├── index.html              Game shell, HUD, screens
├── styles.css              All styling
│
├── js/
│   ├── storage.js          LocalStorage: stats, misses, streaks
│   ├── config.js           Palette, tuning constants, room pattern
│   ├── state.js            The global G object
│   ├── audio.js            Web Audio SFX + phrase playback
│   ├── lessons.js          Loads + parses lessons/
│   ├── story.js            Dialogue, discovery scenes
│   ├── rooms.js            Room generation, spawning, gates
│   ├── player.js           Movement, combat, damage
│   ├── enemies.js          Orb AI, boss AI, storm, tension
│   ├── draw.js             All canvas rendering
│   ├── loop.js             The frame loop
│   ├── input.js            Keyboard, mouse, touch
│   ├── flow.js             Screen transitions, run lifecycle
│   ├── demo.js             Animated field manual demo
│   └── boot.js             Startup
│
├── lessons/                Your phrases
└── audio/                  Your audio (optional)
```

**No framework. No build step.** Pure HTML, CSS, and vanilla JavaScript on a single `<canvas>`.

---

## ✦ Tuning It

Everything that matters lives in **`js/config.js`**:

- `ROOM_PATTERN` — the fixed six-room layout, per room
- `DIFFICULTY` — multipliers for gates, storm, orbs, bosses
- `TOUCH_MODIFIERS` — how much easier it gets on a phone
- `PLAYER_WALK`, `DASH_SPEED`, `STAFF_RANGE` — feel
- `COL` — the entire palette, in one object

Change `COL` once and every drawn element follows.

---

## ✦ What It Isn't

- **Not a flashcard app.** There's no "next card" button. You move to learn.
- **Not a quiz.** No multiple choice. The world is the answer sheet.
- **Not a visual novel.** The story is four beats long, tops. Enough to make the desert feel inhabited.
- **Not finished.** It's a prototype that grew legs. There's no save-in-progress. A run lives in memory and dies with the tab.

---

## ✦ One More Thing

Between rooms, you'll see the phrases you met. Wrong ones first. Read them. That's the whole point.

The road tests memory, not strength.

---

<div align="center">

**سفر**

*The journey continues.*

</div>
