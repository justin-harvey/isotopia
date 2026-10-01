# Art Needed

Tracks artwork the game is waiting on. Items at the top are **high priority** because
gameplay is already shipped around them and currently uses placeholders.

## 🔴 HIGH PRIORITY — Flame-test Elementals (6)

Added as real, catchable Elementals on 2026-10-01 for the desert "Lesson Three" flame-test
beacon puzzle (`DESERT-LESSON3-PLAN.md`). **They have no character art yet** — they currently
render as **tinted placeholder sprites** (tinted to their flame colour). They are catchable and
fully wired into the puzzle; only the art is missing.

| Element | id | Monster name | Flame colour (tint) | Needed file |
|---|---|---|---|---|
| Potassium | `potassium` | Kaliflare | lilac (`#b060e0`) | `src/assets/elementals/potassium.png` |
| Copper | `copper` | Cupragleam | green (`#3fae57`) | `src/assets/elementals/copper.png` |
| Barium | `barium` | Bariglow | pale green (`#7fd651`) | `src/assets/elementals/barium.png` |
| Lithium | `lithium` | Lithflare | crimson (`#e23b4e`) | `src/assets/elementals/lithium.png` |
| Strontium | `strontium` | Stronflare | scarlet (`#ff4d2e`) | `src/assets/elementals/strontium.png` |
| Calcium | `calcium` | Calciglow | orange (`#ff7a1a`) | `src/assets/elementals/calcium.png` |

**Specs (match the existing Elementals):** single-frame pixel-art PNG, transparent background
(use `sprites/remove_bg.py` — border flood-fill + speck removal, needs `pip install
--break-system-packages numpy`), roughly the size/scale of the other creatures in
`src/assets/elementals/`. The flame colour is a good design cue for each creature's palette.

**To wire art in once it exists (no other code change needed):**
1. Drop `<id>.png` into `src/assets/elementals/`.
2. Add the `id` to the `ART_IDS` set in `src/data/elementalArt.ts`.
3. `npm run build` — `spawnElemental` picks up the real art automatically and drops the tint.

**Deploy note:** these spawn by default (`classConfig` ships `releaseAllNow: true`). In a class
with a release *schedule* (`releaseAllNow: false`), the teacher must release potassium / copper /
barium / lithium / strontium / calcium or they won't appear (and the beacon puzzle can't be solved).

---

## Where they appear
All six are placed as wild Elementals in the **Desert** (`DesertScene.createNpcs`), spread across
open sand so students catch them on the way to the pyramid, then burn them at the beacons.
