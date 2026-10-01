# Isotopia
Live: https://is0topia.netlify.app/

A Pokémon-style pixel game for learning the periodic table. Play as a dog
exploring a small town, meet friendly element creatures called **Elementals**,
and answer multiple-choice chemistry questions (protons, electrons, ions,
valence, isotopes, and more) to catch them and fill your **Isotopedex**.

**No accounts, no setup** — the whole game runs from a built-in question bank with
no backend required, so students can jump straight in at
**[is0topia.netlify.app](https://is0topia.netlify.app/)**. An optional
[Firebase](https://firebase.google.com/) backend adds a shared question bank, a
teacher admin portal, and per-student progress sync.

Built on [Phaser 3](https://phaser.io/) with grid-based movement via
[grid-engine](https://github.com/Annoraaq/grid-engine).

Isotopia is free and ad-free for students. If it's useful to you, you can
[support it](https://is0topia.netlify.app/support.html).

## Play

- **Tap / click** where you want to walk (arrow keys also work on desktop).
- **Walk up to an Elemental** to start a battle-style quiz — no button needed.
- **Tap a choice / press 1–4** to answer. A correct answer catches the Elemental
  (or lands a hit, if the teacher set a multi-question capture).
- Step on a glowing **▲ / ▼** pad to enter or leave a building, or take the
  trail north into the **woods**, home to wild Elementals and a hidden surprise.
- Tap the **DEX** button (top-right) to open your **Isotopedex** collection, and
  use the **Rad Finder** (Tools row) to home in on Elementals you haven't caught.
- Explore the woods to find a hidden **treasure chest** — walk up to it to claim
  the **Magic Key**.
- South out of the city, cross into the **Desert** (level 3) — a sun-bleached
  basin of oasis pools, cacti, boulders and rock buttes. It's the **Lesson Three**
  finale: hunt down the hidden flame-test metals, then (with the Atlantis crystal)
  light the beacons to raise a buried pyramid.
- North through the Desert lies the **Jungle** (level 2) — a dense rainforest of
  canopy trees, dirt clearings and rock-ringed ponds where **teal slimes** drift by
  the water, there to explore.
- Find the hidden city and its **Evolution Lab**, where you fuse your caught
  Elementals into real molecules by solving their chemistry — matching VSEPR bond
  angles, expanding an octet (SF₄/SF₆), and weighing electronegativity to lock in
  ionic bonds (NaF, MgO, and more).
- Deep beneath the city **Museum**, the Magic Key opens a hidden tunnel to a secret
  **Atlantis sanctum** — the Periodic Table of Crystals. Step onto the **Giza Core** to
  play **Crystalline Resonance**: the ancient crystals are mislabeled, so re-attune each
  one to its true element to restore the Core to full resonance.
- Carry the sanctum's **crystal** back to the **Desert**, where a vast **pyramid** sleeps
  beneath the sand. Roaming the dunes are the classic flame-test metals — **Potassium, Copper,
  Barium, Lithium, Strontium, Calcium** — to catch. The crystal wakes five cold **flame-test
  beacons** at the buried apex; light each by burning a **caught Elemental** whose flame colour
  matches (Sodium = yellow, Copper/Barium/Boron = green, Potassium = lilac, Lithium/Strontium =
  red, Calcium = orange; Sulfur's blue and Magnesium's white are decoys). Match all five and the
  pyramid **rises from the sand** — a lesson in atomic emission: excited electrons fall back to
  lower shells and cast off light of one fixed colour.

## Run it locally (for development)

```bash
npm install
npm run watch      # dev server + live reload at http://localhost:10001
npm run build      # production build into dist/  (serve the dist/ folder)
```

No configuration is required — it runs on the local question seed.

## Art, assets & deploying

**Netlify deploys from the `main` branch** of this repo (`netlify.toml`: build
command `npm run build`, publish dir `dist/`). The build copies `src/assets/*`
into `dist/assets/` — so **`src/assets/` is the single source of truth for art**,
and `dist/` is generated (never edit it; it's git-ignored and rebuilt every time).

To update artwork, replace the file **in `src/assets/…` with the exact same
filename**, commit, and push to `main`:

| Art | Where to put it |
|---|---|
| Building interiors (church, fashion, museum floors, …) | `src/assets/rooms/<name>-interior.png` (city rooms are `1408×768`) |
| Building exteriors / city props | `src/assets/city/` |
| Elemental creatures | `src/assets/elementals/` (the 6 flame-test metals — potassium/copper/barium/lithium/strontium/calcium — are **placeholder** art for now; see `ART-NEEDED.md`) |
| Town buildings, woods, tiles, characters | `src/assets/{buildings,woods,tiles,Characters}/` |

Editing copies elsewhere (`sprites/`, `www/`, `android/`, `ios/`) does **nothing** —
`www/android/ios` are stale artifacts of the abandoned native-app port, and
`sprites/` is just a staging area the build doesn't read. Because filenames are
stable, a browser (or an "Add to Home Screen" install) may cache an old image
under the same name — hard-refresh / clear site data after a redeploy to see it.

Interior **collision** (walls + exit portals) is authored separately by painting
mask canvases — see `tools/gen_interior_collision.py` (paint sources live outside
the repo in `/home/nah/interior-collision` + `/home/nah/museum-collision`). That
tool emits `src/assets/tilemap/*.json` + `src/data/interiorNav.ts` and does **not**
touch room art; after re-running it, run `node tools/embed-maps.mjs && npm run build`.

## How it's organized

| Path | What |
|---|---|
| `src/game.ts` | Bootstrap: startup, sign-in, scene list |
| `src/Scenes/` | Phaser scenes (town = `TestScene`, `WoodsScene`, `DesertScene`, `JungleScene`, building interiors) + engine components |
| `src/ui/DevWarp.ts` | Dev/staff in-game zone warp (jump to any scene; hidden from students — needs `?dev` or a staff sign-in) |
| `tools/gen_desert.py` | Procedurally builds the Desert map from `desert_tileset.png`; re-run then `node tools/embed-maps.mjs && npm run build` |
| `tools/gen_pyramid.py` | Composes the Desert pyramid sprite (`src/assets/desert/pyramid*.png`) from the desert tiles — a stepped ziggurat with procedural step shading, plus a buried pre-rise state; re-run then `npm run build` |
| `tools/gen_placeholder_elementals.py` | Regenerates the **placeholder** flame-creature art for the 6 flame-test Elementals (`src/assets/elementals/{potassium,copper,barium,lithium,strontium,calcium}.png`); overwrite those PNGs with real art to replace them |
| `tools/slice_jungle.py` + `tools/gen_jungle.py` | Compose the Jungle ground sheet + slice props from the Lost Valleys pack, then build `jungle_map.json`; re-run then `node tools/embed-maps.mjs && npm run build` |
| `src/data/elements.ts` | The element creatures (symbol, name, atomic number, silly display name) |
| `src/data/questions.ts` | Local seed question bank (used offline / as fallback) |
| `src/data/questionSource.ts` | Chooses local seed vs. live Firebase question bank |
| `src/data/progress.ts` | Seen/Caught + answer stats (localStorage, synced to Firebase when signed in) |
| `src/data/classConfig.ts` | Per-class settings + the release schedule |
| `src/ui/QuizOverlay.ts` | The GBA-style battle quiz |
| `src/ui/EvolveOverlay.ts` + `src/data/evolution.ts` | The Evolution Lab — fuse Elementals into compounds (VSEPR Fusion / Hyper-Chamber / ΔEN Tug-of-War chambers) |
| `src/ui/Isotopedex.ts` | The creature-collection screen (Elementals + secret "Magic Key" / "Giza Core" cards) |
| `src/ui/ResonanceOverlay.ts` + `src/data/resonance.ts` | The Atlantis sanctum's Crystalline Resonance puzzle (re-attune the mislabeled crystals) |
| `src/ui/BeaconOverlay.ts` + `src/data/flameTest.ts` | The Desert's flame-test beacon puzzle (burn caught Elementals to match each beacon's flame colour; solving it raises the pyramid) |
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

### Optional: support link

Set `SUPPORT_URL` (an `https://` link to Ko-fi, GitHub Sponsors, a Stripe Payment
Link, etc.) in the build environment to switch on the "Support Isotopia" links: a
quiet line on the help card, a link in the teacher portal, and the button on
`/support.html`. Leave it unset and all of them stay hidden.

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
- **Desert (level 3) tileset:** [GrayCatGames](https://graycatgames.itch.io/desert-tileset)
  PixelWorlds Desert (free for personal & commercial use).
- **Jungle (level 2) tileset & creatures:** [ilmenite](https://ilmenite.itch.io/lost-valleys-jungle)
  "Lost Valleys" — used under a purchased distribution license (see `sprites/jungle/LICENSE.txt`).
- **All other art** (Luna Town interiors, the building & bridge artwork, the dog)
  was created by the project author.
- Code is released under the MIT License — see [`LICENSE`](LICENSE).
