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
│   ├── study.js            Five-phase shadowing session
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
│   ├── manifest.json       List of lesson files
│   └── ABY-1-1a.json       One dialogue per file
│
└── audio/                  Your audio (optional)
