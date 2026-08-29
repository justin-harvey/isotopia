# Isotopia — Session Handoff

A running summary of what this is and where it stands, so work can resume after a
context reset. Last updated 2026-08-05.

## What this is
**Isotopia** — a Pokémon-style pixel game for learning the periodic table. You
play a dog exploring a small town, walk up to friendly element creatures called
**Elementals**, and answer multiple-choice atomic-structure questions to catch
them and fill your **Isotopedex**. It's **offline-first**: the whole game runs
from a built-in question seed with no setup. An optional Firebase backend adds a
shared question bank, a teacher portal, and per-student progress sync. Real
classroom target: an **AP Chemistry** class at **SAD 15 (Gray–New Gloucester,
Maine)** — the town is themed on Gray, Maine.

## Coordinates
| Thing | Value |
|---|---|
| Local path | `/home/nah/Claudia/elemonsters` (folder name predates the rename to Isotopia) |
| GitHub | https://github.com/justin-harvey/isotopia (branch `main`, public) |
| Live game | https://is0topia.netlify.app/ (note the **zero**). Teacher portal: `/teacher.html` |
| Firebase project | `isotopia-2809c` (Realtime Database) |
| Deploy | Netlify auto-builds from `main` (`npm run build` → publish `dist/`). **Requires the 8 `FIREBASE_*` env vars set in Netlify** (see `.env.example`) or online features silently go offline |
| Foundation | fork of [danielart/phaser-rpg-template](https://github.com/danielart/phaser-rpg-template) (MIT), Phaser 3 + grid-engine |
| Deploys | Justin pastes a GitHub PAT inline per push (use inline, don't persist) |

## Run locally
```bash
cd /home/nah/Claudia/elemonsters
npm install
npm run watch    # dev server + live reload → http://localhost:10001
npm run build    # production build → dist/ (also builds dist/teacher.html)
npm run package  # build + zip -> isotopia-offline.zip (download-and-play bundle)
```
Runs fully offline with no config. Set `FIREBASE_*` env vars before building to
enable the online features.

## Controls / gameplay
- **Tap / click** to walk (arrow keys too on desktop).
- **Walk within one tile of an Elemental** to auto-start its quiz (proximity — no
  key, for iPads). Encounters open a **GBA-style battle** (enemy on a platform,
  the dog's real back sprite opposite, pixel textbox). Correct answer catches it;
  if `questionsToCatch` > 1 the enemy has a draining **HP bar**. A screen-wipe
  plays before every battle.
- **Step on a glowing ▲/▼ pad** to enter/leave a building; follow the **trail
  north** into the woods, where wild Elementals appear in the **tall grass**.
- **DEX** button (top-right) → the **Isotopedex** collection.
- **Secret path:** walk **north up column 20 of the woods to the very top** → a
  cutscene reveals the distant city → tap **"enter the city"** to walk it.

## The Elementals (9 active)
Original, copyright-safe display names (no "-mon"), set in `data/elements.ts`
(`monster` field). Element `id`s and art filenames are unchanged.

| Element | Name | Where | Element | Name | Where |
|---|---|---|---|---|---|
| Hydrogen | Hydrohop | town lake | Magnesium | Magflash | Auto interior |
| Carbon | Carbocrunch | woods (wild) | Iron | Ironclank | Hardware interior |
| Nitrogen | Nitronoodle | woods (wild) | Neon | Neonglow | town plaza |
| Oxygen | Oxypuff | woods (wild) | Uranium | Glowbun | Library interior |
| Sodium | Sodazoom | Hannaford interior | | | |

Helium & Chlorine retired (removed from `elements.ts`; seed questions remain,
harmless). 9 have real pixel art in `src/assets/elementals/`; declared in
`data/elementalArt.ts`.

## Architecture / key files
| Path | Purpose |
|---|---|
| `src/game.ts` | Bootstrap: mounts DEX/intro, inits student auth, loads questions + class settings, then starts Phaser. Scene list incl. CityScene |
| `src/Scenes/TestScene.ts` | Town (building-art overlays over invisible collision, lake, doors, north trail) |
| `src/Scenes/WoodsScene.ts` | Woods; wild grass encounters, Neonu companion, the secret city-reveal trigger (col 20, top) |
| `src/Scenes/CityScene.ts` | **Walkable city** — buildings, streets, plaza props, pedestrians, talking NPCs |
| `src/Scenes/InteriorScene.ts` + Home/Hardware/Hannaford/Auto/Library | Building interiors (image backgrounds + shared collision grid) |
| `src/Scenes/GameScene.ts` | Base scene: `spawnElemental` (release-gated), `enableGrassEncounters`, `spawnPedestrian`, `spawnTalkingNpc`, `spawnCompanionNpc`, camera, embedded-map loading |
| `src/ui/QuizOverlay.ts` | GBA battle quiz (round-based, HP bar, `startBattle` wipe) |
| `src/ui/Isotopedex.ts` | Collection screen + student sign-in bar + hidden teacher-portal entrance (hold the title) |
| `src/ui/CityReveal.ts` | The secret-path cutscene (bridge pan-out under sunset, dog on the bridge; tap → enter city) |
| `src/ui/Intro.ts` / `NpcDialog.ts` / `icons.ts` | Help card, NPC dialog box, inline SVG icons (replaced emoji) |
| `src/data/elements.ts` / `questions.ts` / `questionSource.ts` | Elements, local seed bank, local-vs-RTDB question source |
| `src/data/progress.ts` | Seen/Caught + stats; localStorage cache, mirrors to `students/{uid}` when signed in |
| `src/data/classConfig.ts` | Class settings + 40-day release schedule; `elementReleased()` cache the game reads |
| `src/data/firebase.ts` | Firebase config from `FIREBASE_*` env (blank ⇒ offline) + lazy init |
| `src/data/auth.ts` / `studentAuth.ts` / `adminAuth.ts` | Guest anon sign-in / optional student Google (redirect) / teacher Google (popup) + claim gate |
| `src/data/maps.ts` | **Embedded tilemaps** (test/woods/interior/city) so the game runs from `file://` (no XHR). Regenerate via `tools/embed-maps.mjs` after editing any map |
| `src/teacher.ts` + `teacher.html` + `teacher.css` | Teacher admin portal (separate rollup bundle) |
| `tools/gen_town.py` / `gen_woods.py` / `gen_city.py` / `gen_interior.py` | Regenerate each tilemap; `embed-maps.mjs` re-embeds them into `maps.ts` |
| `firebase/` | `database.rules.json`, `set-teacher.mjs`, `ADD-A-TEACHER.md`, `ACCOUNTS-SCOPE.md`, `NEXT-STEPS.md`, `serviceAccount.json` (gitignored) |

## Accounts, auth, teacher portal
- **Guests** play anonymously (local progress). **Students** may optionally sign
  in with Google (`@sad15.org`, **redirect** flow for iPad Safari) to save
  progress to `students/{uid}` and appear on the dashboard.
- **Teachers** use `/teacher.html`: Google sign-in + a `teacher` custom claim
  (RTDB rules gate writes on `auth.token.teacher`). In-game, **press-and-hold the
  Isotopedex title ~1s** to open the portal. Current teachers: `jharvood@gmail.com`,
  `aharvey@sad15.org` (Justin's mom, the teacher). Add/remove: `firebase/ADD-A-TEACHER.md`
  (`node firebase/set-teacher.mjs <UID> [off]`; needs `firebase-admin@11` on Node 18).
- Portal tabs: **Questions** (CRUD + import seed), **Schedule** (40-day per-element
  unlock days), **Settings** (`questionsToCatch`), **Students** (dashboard). Has
  busy states + save toasts.

## Data model + release schedule
```
questions/{id}                { elementId, angle, prompt, choices[4], correctIndex }
classes/ap-chem/settings      { questionsToCatch, unitStartDate, releaseAllNow, release:{elementId:day} }
classes/ap-chem/members/{uid} true
students/{uid}                { classId, name, email, seen, caught, stats:{elementId:{attempts,correct}} }
```
Single class hard-coded `CLASS_ID='ap-chem'`. **Release logic** (`isElementReleased`):
releaseAllNow ⇒ all visible; else an element shows only if it has an unlock day
that has arrived — **no day = hidden**. The game reads settings **once at
startup** (cached), so schedule changes need a **game reload**.

## The city (reached via the woods secret path)
- Cutscene: `WoodsScene` movementStopped at (col 20, y≤1) → `playCityReveal(onEnter)`
  → tap → `this.switch(SceneName.City)`.
- `CityScene` + `tools/gen_city.py` (**52×72 map**, embedded): light sidewalks +
  asphalt road grid (sidewalk `gid(43,2)`, asphalt `gid(34,6)`) + cobblestone
  plaza; 9 building overlays over blank16 collision footprints; **power-tower,
  large-church, power-station are 2×**; plaza + street **trees**, **lit lamps**
  (`assets/city/lamp.png`), **benches** (`bench.png`); **8 wandering pedestrians**
  (`spawnPedestrian`, scale 0.35) + **3 talking NPCs** (`spawnTalkingNpc`). WOODS
  pad returns you. Keep `CityScene.BUILDINGS` in sync with `gen_city.PLACEMENTS`.

## Gotchas
- **Netlify needs the 8 `FIREBASE_*` env vars** or the live site loses online features.
- **Reload the game** after changing schedule/settings (startup-cached).
- **Editing any tilemap** (gen_*.py) requires re-running `tools/embed-maps.mjs`.
- **file://-safe:** all Phaser loader paths are relative `assets/...` (not `../`);
  maps embedded; font self-hosted. Keep it that way (0 `../assets` in dist/game.js).
- **iPad student sign-in (`signInWithRedirect`) is UNVERIFIED on hardware** — main risk.
- Teacher-claim script needs `firebase-admin@11` (latest is ESM-only, breaks Node 18);
  run from an isolated dir (e.g. `/tmp/isotopia-admin`).
- localStorage progress key stays `elemonsters.progress.v1` (don't change the value).

## Licensing (for the open-source release)
LimeZu "Modern Exteriors/Interiors" tilesets + character sheet are used with
**LimeZu's express permission** (free educational game). All other art (Luna
Town interiors, building/bridge artwork, the dog) authored by Justin. Code is
MIT. README credits reflect this.

## Open items / next
- **Verify on a real iPad:** student sign-in, city walking/animation + NPC dialog,
  and the new smaller pedestrian scale + doubled-building layout.
- **Fountain** for the plaza centre (couldn't isolate its tiles in the 16k-tile
  sheet — its centre spot is left open). More city props/NPCs/shops.
- Populate the city with gameplay (Elementals/quizzes/Gym).
- Seed the real 40-day release schedule; per-element mastery in the dashboard.
- Deferred portal UX: unsaved-changes warning; refresh the `questionsToCatch` help
  (the HP battle is live now).

## Recent history (newest first)
City tweaks (half-size people, doubled landmarks, more lamps/trees) · city
populated (streets, plaza, pedestrians, talkers) · walkable CityScene · secret
path + city-reveal cutscene · offline-playable (embedded maps, relative paths,
self-hosted font) · copyright-safe creature rename · teacher portal + Firebase
live (accounts/dashboard) · GBA battle feel · mobile-first movement + Isotopedex.
