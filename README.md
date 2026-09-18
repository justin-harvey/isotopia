# Isotopia (https://is0topia.netlify.app/)

A Pokémon-style pixel game for learning the periodic table. Play as a dog
exploring a small town, meet friendly element creatures called **Elementals**,
and answer multiple-choice chemistry questions (protons, electrons, ions,
valence, isotopes, and more) to catch them and fill your **Isotopedex**.

**Runs fully offline with zero setup** — the whole game works from a built-in
question bank, so kids can just open it and play. An optional
[Firebase](https://firebase.google.com/) backend adds a shared question bank, a
teacher admin portal, and per-student progress sync.

Built on [Phaser 3](https://phaser.io/) with grid-based movement via
[grid-engine](https://github.com/Annoraaq/grid-engine).

## Play

- **Tap / click** where you want to walk (arrow keys also work on desktop).
- **Walk up to an Elemental** to start a battle-style quiz — no button needed.
- **Tap a choice / press 1–4** to answer. A correct answer catches the Elemental
  (or lands a hit, if the teacher set a multi-question capture).
- Step on a glowing **▲ / ▼** pad to enter or leave a building, or take the
  trail north into the **woods**, where wild Elementals appear in the tall grass.
- Tap the **DEX** button (top-right) to open your **Isotopedex** collection.

## Get it (play offline, no coding)

The game is fully offline — no internet, accounts, or install required.

1. Download **`isotopia-offline.zip`** from the
   [Releases](https://github.com/G00DTECH/isotopia/releases) page.
2. Unzip it.
3. Open **`index.html`** inside the unzipped folder in a web browser.

That's it — it runs entirely from your computer. (Sound may be silent when
opened this way; if your browser is strict about local files, either play
online at **https://is0topia.netlify.app/** or serve the folder with a tiny
local server, e.g. `npx serve` or `python3 -m http.server`.)

Maintainers: run `npm run package` to (re)build `isotopia-offline.zip` and
attach it to a GitHub Release.

## Run it locally (for development)

```bash
npm install
npm run watch      # dev server + live reload at http://localhost:10001
npm run build      # production build into dist/  (serve the dist/ folder)
```

No configuration is required — it runs on the local question seed.

## How it's organized

| Path | What |
|---|---|
| `src/game.ts` | Bootstrap: startup, sign-in, scene list |
| `src/Scenes/` | Phaser scenes (town = `TestScene`, `WoodsScene`, building interiors) + engine components |
| `src/data/elements.ts` | The element creatures (symbol, name, atomic number, silly display name) |
| `src/data/questions.ts` | Local seed question bank (used offline / as fallback) |
| `src/data/questionSource.ts` | Chooses local seed vs. live Firebase question bank |
| `src/data/progress.ts` | Seen/Caught + answer stats (localStorage, synced to Firebase when signed in) |
| `src/data/classConfig.ts` | Per-class settings + the release schedule |
| `src/ui/QuizOverlay.ts` | The GBA-style battle quiz |
| `src/ui/Isotopedex.ts` | The creature-collection screen |
| `src/teacher.ts` + `teacher.html` | The teacher admin portal (separate page) |
| `firebase/` | Security rules, seed data, and setup docs |

Questions follow a simple shape, so content can be authored in a spreadsheet and
imported (or edited in the teacher portal):

```json
{
  "elementId": "carbon",
  "angle": "protons",
  "prompt": "How many protons does carbon have?",
  "choices": ["4", "6", "8", "12"],
  "correctIndex": 1
}
```

## Optional: enable the online features (Firebase)

The game is offline-first; Firebase is only needed for the shared question bank,
the teacher portal, and saving student progress across devices.

1. Create a Firebase project and a **Web app**; enable **Realtime Database**,
   and **Authentication** with the **Google** and **Anonymous** providers.
2. Publish the security rules from `firebase/database.rules.json`.
3. Copy `.env.example` to `.env` and fill in your Firebase web config, or set the
   same `FIREBASE_*` variables in your host's environment (e.g. Netlify). They're
   injected into the build; leave them unset to keep the game fully offline.
4. Grant yourself teacher access — see **[`firebase/ADD-A-TEACHER.md`](firebase/ADD-A-TEACHER.md)**.

More detail in **[`firebase/NEXT-STEPS.md`](firebase/NEXT-STEPS.md)**. The Firebase
*web* config is not secret (it identifies the project; access is enforced by the
rules), but this project keeps it out of source so forks run offline by default.

### Teacher portal

Served at `/teacher.html`. A signed-in teacher (Google account with a `teacher`
custom claim) can edit the question bank, set a 40-day element **release
schedule**, tune capture difficulty, and view per-student progress. In the game,
press-and-hold the **Isotopedex title** for ~1s to open it.

## Credits & license

- **Engine:** Phaser 3 + [grid-engine](https://github.com/Annoraaq/grid-engine),
  scaffolded from [danielart/phaser-rpg-template](https://github.com/danielart/phaser-rpg-template) (MIT).
- **Tilesets & character sprites:** [LimeZu](https://limezu.itch.io/) "Modern
  Exteriors / Interiors" — used with LimeZu's express permission for this free
  educational game.
- **All other art** (Luna Town interiors, the building & bridge artwork, the dog)
  was created by the project author.
- Code is released under the MIT License — see [`LICENSE`](LICENSE).
