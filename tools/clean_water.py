#!/usr/bin/env python3
"""De-speckle the oasis WATER cells so no body of water shows orange/tan blobs.

Texture-consistency / water-cleanup task: every water surface in the game traces
back to two cells of the desert tileset — `src/assets/tiles/desert_tileset.png`
cells (4,2) and (5,1) (the oasis "deep water" + a variant). Those cells carry a
baked-in sandy-shore speckle (~11% warm orange/tan pixels over a teal body). That
one art propagates everywhere:

  * jungle_tileset.png cells 6 & 7   (slice_jungle.py: water_fill=dcell(4,2), water_v=dcell(5,1))
  * water.png                        (slice_water.py lifts the jungle cells -> Town lake)
  * desert oasis                     (DesertScene reads desert_tileset.png directly)

So cleaning the SOURCE cells fixes all three. This masks the warm speckle and
fills it from the surrounding teal (iterative nearest-teal relaxation), writing
`desert_tileset.png` back in place. It is IDEMPOTENT: once the orange is gone the
mask selects nothing and a re-run is a no-op.

Run FIRST in the water chain, then re-slice downstream:

    python3 tools/clean_water.py
    python3 tools/slice_jungle.py      # re-borrows the cleaned cells -> jungle_tileset.png
    python3 tools/slice_water.py       # re-lifts -> water.png
    npm run build                      # bundle the cleaned assets into dist/

No map re-embed is needed — only pixels change, not tile ids/gids.
"""
import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
TILESET = os.path.join(HERE, '..', 'src', 'assets', 'tiles', 'desert_tileset.png')
TS = 16
WATER_CELLS = [(4, 2), (5, 1)]


def is_speckle(R, G, B, A):
    """Warm sandy-shore pixel over the teal water (the thing we want gone).
    Teal water has B >= G; the speckle is warm (R>G>B) and fairly bright."""
    return A > 8 and R > 130 and R > G + 25 and G > B + 20


def clean_cell(im, c, r):
    """Replace the warm speckle in one 16px cell with the mean of its nearest
    non-speckle (teal) neighbours, relaxed until every speckle pixel is filled."""
    px = im.load()
    ox, oy = c * TS, r * TS
    speckle = set()
    for y in range(TS):
        for x in range(TS):
            R, G, B, A = px[ox + x, oy + y]
            if is_speckle(R, G, B, A):
                speckle.add((x, y))
    n = len(speckle)
    # Iterative fill: each pass, any speckle pixel bordered by >=1 cleaned pixel
    # takes the average of its cleaned (teal) neighbours. Repeats until stable.
    remaining = set(speckle)
    guard = 0
    while remaining and guard < 64:
        guard += 1
        filled_this_pass = []
        for (x, y) in list(remaining):
            rs = gs = bs = as_ = k = 0
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    if dx == 0 and dy == 0:
                        continue
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < TS and 0 <= ny < TS and (nx, ny) not in remaining:
                        R, G, B, A = px[ox + nx, oy + ny]
                        if A > 8:
                            rs += R; gs += G; bs += B; as_ += A; k += 1
            if k:
                px[ox + x, oy + y] = (rs // k, gs // k, bs // k, as_ // k)
                filled_this_pass.append((x, y))
        for p in filled_this_pass:
            remaining.discard(p)
        if not filled_this_pass:
            break  # no progress (fully-enclosed region) — stop
    return n - len(remaining), n


def main():
    im = Image.open(TILESET).convert('RGBA')
    total = 0
    for (c, r) in WATER_CELLS:
        cleaned, found = clean_cell(im, c, r)
        total += cleaned
        print(f'  cell({c},{r}): de-speckled {cleaned}/{found} warm pixels')
    im.save(TILESET)
    print('wrote', os.path.relpath(TILESET), f'({total} pixels cleaned)')


if __name__ == '__main__':
    main()
