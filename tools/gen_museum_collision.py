#!/usr/bin/env python3
"""Generate per-floor collision tilemaps for the museum from painted masks.

Each museum floor is a 1408x768 room image stretched over a 22x12 grid (64px per
cell), same as every city interior. Historically all five floors shared one
open-room grid (city_interior.json), so the dog walked over the walls and pit
gaps painted into each floor's art. This tool traces real collision from a
hand-painted mask so only floors and bridges are walkable.

Workflow:
  1. Painter opens /home/nah/museum-collision/<name>_PAINT-ME.png (art + baked
     22x12 grid) and fills every NON-walkable cell (walls, pits, exhibits) with a
     solid opaque colour, saving over the same file.
  2. This script diffs the painted file against the pristine canvas kept in
     _canvas_original/, marks a cell blocked when >=BLOCK_FRAC of its pixels
     changed, and writes one tilemap per floor into src/assets/tilemap/.
  3. Run tools/embed-maps.mjs to embed them, then build.

If a floor has no painted file yet, it falls back to the open room (border wall
only) so the project keeps building. Re-run any time; it's idempotent.
"""
import json, os
from PIL import Image
import numpy as np

W, H = 22, 12
WALK_GID, WALL_GID = 1, 2           # blank16: gid1 walkable, gid2 colliding
BLOCK_FRAC = 0.35                   # cell is blocked if >=35% of pixels painted
DIFF_THRESH = 40                    # per-pixel channel diff to count as "painted"

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')
PAINT_DIR = '/home/nah/museum-collision'
CANVAS_DIR = os.path.join(PAINT_DIR, '_canvas_original')
TILEMAP_DIR = os.path.join(ROOT, 'src', 'assets', 'tilemap')
OVERLAY_DIR = '/tmp/museum_grid'
os.makedirs(OVERLAY_DIR, exist_ok=True)

# floor art name  ->  tilemap key the scene will load
FLOORS = {
    'museum-interior': 'museum_ground',
    'museum-level-1':  'museum_b1',
    'museum-level-2':  'museum_b2',
    'museum-level-3':  'museum_b3',
    'museum-level-4':  'museum_b4',
}

def build_mask(name):
    """Classify each cell from the painted overlay.

    Returns (walk, portals) where walk is a 12x22 bool grid and portals is a list
    of (col, row) cells the painter marked purple. Returns (None, None) if the
    floor hasn't been painted yet. Colour convention:
      * RED   (opaque)  -> blocked (wall / pit / exhibit)
      * PURPLE          -> a portal tile: WALKABLE, recorded for later wiring
      * unpainted       -> walkable floor / bridge
    """
    painted = os.path.join(PAINT_DIR, f'{name}_PAINT-ME.png')
    if not os.path.exists(painted):
        return None, None
    p = np.asarray(Image.open(painted).convert('RGB').resize((1408, 768))).astype(int)
    R, G, B = p[:, :, 0], p[:, :, 1], p[:, :, 2]
    masks = {
        'block':   (R > 150) & (G < 90) & (B < 90),   # red   -> wall / pit
        'ascend':  (G > 150) & (R < 90) & (B < 90),   # green -> up one floor
        'descend': (B > 150) & (R < 90) & (G < 90),   # blue  -> down one floor
        'custom':  (R > 110) & (B > 110) & (G < 100),  # purple -> destination TBD
    }
    walk = np.ones((H, W), bool)
    portals = []  # list of (type, col, row); portal tiles stay walkable
    for r in range(H):
        for col in range(W):
            sl = (slice(r*64, (r+1)*64), slice(col*64, (col+1)*64))
            border = col in (0, W-1) or r in (0, H-1)
            fracs = {k: m[sl].mean() for k, m in masks.items()}
            kind = max(fracs, key=fracs.get)
            if fracs[kind] < BLOCK_FRAC:
                kind = None                         # unpainted -> plain floor
            walk[r, col] = (not border) and (kind != 'block')
            if kind in ('ascend', 'descend', 'custom') and not border:
                portals.append((kind, col, r))
    return walk, portals


def largest_region(walk, portals):
    """Return the set of tiles in the walkable region holding the most portals
    (falls back to the biggest region), and a good non-portal START tile in it."""
    from collections import deque
    portal_cells = {(c, r) for (_, c, r) in portals}
    seen = {}
    regions = []

    def wk(x, y):
        return bool(walk[y, x])
    rid = 0
    for y in range(H):
        for x in range(W):
            if wk(x, y) and (x, y) not in seen:
                rid += 1
                q = deque([(x, y)]); seen[(x, y)] = rid; cells = [(x, y)]
                while q:
                    cx, cy = q.popleft()
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        nx, ny = cx+dx, cy+dy
                        if 0 <= nx < W and 0 <= ny < H and wk(nx, ny) and (nx, ny) not in seen:
                            seen[(nx, ny)] = rid; cells.append((nx, ny)); q.append((nx, ny))
                regions.append(cells)
    if not regions:
        return set(), {"x": 11, "y": 6}
    best = max(regions, key=lambda cs: (sum(1 for c in cs if c in portal_cells), len(cs)))
    region = set(best)
    # START: non-portal tile in region nearest the room centre.
    candidates = [c for c in region if c not in portal_cells]
    if not candidates:
        candidates = list(region)
    sx, sy = min(candidates, key=lambda c: (c[0]-11)**2 + (c[1]-6)**2)
    return region, {"x": sx, "y": sy}


def open_room_mask():
    walk = np.zeros((H, W), bool)
    for r in range(H):
        for col in range(W):
            walk[r, col] = not (col in (0, W-1) or r in (0, H-1))
    return walk


def connectivity_report(name, walk, region, portals, start):
    """Report how many portals + spawn slots sit in the start's walkable region."""
    spawn_rows, spawn_cols = [2, 4, 7, 9], [1, 3, 5, 7, 9, 13, 15, 17, 19]
    slots = [(c, r) for r in spawn_rows for c in spawn_cols]
    reachable_slots = sum(1 for c in slots if c in region)
    portal_cells = [(c, r) for (_, c, r) in portals]
    reachable_portals = sum(1 for c in portal_cells if c in region)
    print(f"  {name}: walkable={int(walk.sum()):>3}  region(from start)={len(region)}  "
          f"start={start}  portals reachable={reachable_portals}/{len(portal_cells)}  "
          f"spawn slots reachable={reachable_slots}/{len(slots)}")
    if portal_cells and reachable_portals < len(portal_cells):
        print(f"    !! WARNING: {len(portal_cells)-reachable_portals} portal tile(s) on "
              f"{name} are stranded off the start region — walk a painted-clear path to them.")


def tilemap(walk):
    floor = [WALK_GID] * (W * H)
    walls = [0 if walk[i // W, i % W] else WALL_GID for i in range(W * H)]

    def layer(nm, data, lid):
        return {"data": data, "height": H, "width": W, "id": lid, "name": nm,
                "opacity": 1, "type": "tilelayer", "visible": True, "x": 0, "y": 0}
    return {
        "compressionlevel": -1, "infinite": False, "orientation": "orthogonal",
        "renderorder": "right-down", "tiledversion": "1.9.0", "type": "map",
        "version": "1.9", "width": W, "height": H, "tilewidth": 16, "tileheight": 16,
        "nextlayerid": 3, "nextobjectid": 1,
        "layers": [layer("floor", floor, 1), layer("walls", walls, 2)],
        "tilesets": [{
            "columns": 2, "firstgid": 1, "image": "../assets/tiles/blank16.png",
            "imagewidth": 32, "imageheight": 16, "margin": 0, "spacing": 0,
            "name": "blank16", "tilecount": 2, "tilewidth": 16, "tileheight": 16,
            "tiles": [{"id": 1, "properties": [
                {"name": "ge_collide", "type": "bool", "value": True}]}],
        }],
    }


def save_overlay(name, walk, portals=None):
    """Faint-teal=walkable, red=blocked; portals bold + lettered (A/D/C)."""
    from PIL import ImageDraw, ImageEnhance, ImageOps
    ptype = {(c, r): t for (t, c, r) in (portals or [])}
    letter = {'ascend': 'A', 'descend': 'D', 'custom': 'C'}
    pfill = {'ascend': (0, 220, 0, 150), 'descend': (0, 120, 255, 150), 'custom': (220, 0, 255, 150)}
    im = Image.open(os.path.join(ROOT, 'src/assets/rooms', f'{name}.png')).convert('RGB').resize((1408, 768))
    vis = ImageOps.autocontrast(ImageEnhance.Brightness(im).enhance(1.4)).convert('RGBA')
    ov = Image.new('RGBA', vis.size, (0, 0, 0, 0)); d = ImageDraw.Draw(ov)
    for r in range(H):
        for c in range(W):
            x0, y0 = c*64, r*64
            if (c, r) in ptype:
                t = ptype[(c, r)]
                d.rectangle([x0, y0, x0+64, y0+64], fill=pfill[t], outline=(255, 255, 255, 220), width=2)
                d.text((x0+26, y0+22), letter[t], fill=(255, 255, 255, 255))
            elif walk[r, c]:
                d.rectangle([x0, y0, x0+64, y0+64], fill=(0, 160, 160, 55), outline=(255, 255, 255, 70))
            else:
                d.rectangle([x0, y0, x0+64, y0+64], fill=(255, 0, 0, 110), outline=(255, 255, 255, 70))
    out = Image.alpha_composite(vis, ov).convert('RGB')
    p = os.path.join(OVERLAY_DIR, f'{name}_verify.png'); out.save(p); return p


def emit_nav_module(nav):
    """Write src/data/museumNav.ts: per-floor start tile + typed portal tiles."""
    lines = [
        "// AUTO-GENERATED by tools/gen_museum_collision.py from the painted",
        "// /home/nah/museum-collision/*_PAINT-ME.png masks. Do not edit by hand.",
        "// Portal `type` -> target is resolved in CityInteriorScene: ascend=cfg.up,",
        "// descend=cfg.down, custom=Cloud City.",
        "/* eslint-disable */",
        "export interface MuseumPortal { type: 'ascend' | 'descend' | 'custom'; x: number; y: number; }",
        "export interface MuseumFloorNav { start: { x: number; y: number }; portals: MuseumPortal[]; }",
        "export const MUSEUM_NAV: Record<string, MuseumFloorNav> = {",
    ]
    for key, data in nav.items():
        ps = ", ".join(
            f"{{ type: '{p['type']}', x: {p['x']}, y: {p['y']} }}" for p in data['portals'])
        lines.append(f"    {key}: {{ start: {{ x: {data['start']['x']}, y: {data['start']['y']} }}, "
                     f"portals: [{ps}] }},")
    lines.append("};")
    with open(os.path.join(ROOT, 'src', 'data', 'museumNav.ts'), 'w') as f:
        f.write("\n".join(lines) + "\n")
    print("wrote src/data/museumNav.ts")


def main():
    print("Generating museum collision tilemaps...")
    all_portals = {}
    nav = {}
    for name, key in FLOORS.items():
        walk, portals = build_mask(name)
        painted = walk is not None
        if not painted:
            walk = open_room_mask()
            portals = []
        region, start = largest_region(walk, portals)
        # Guarantee the start tile is walkable in the emitted map.
        walk[start['y'], start['x']] = True
        with open(os.path.join(TILEMAP_DIR, f'{key}.json'), 'w') as f:
            json.dump(tilemap(walk), f)
        tag = "painted" if painted else "OPEN ROOM (not painted yet)"
        print(f"- {key}.json  [{tag}]")
        connectivity_report(name, walk, region, portals, start)
        nav[key] = {"start": start,
                    "portals": [{"type": t, "x": c, "y": r} for (t, c, r) in portals]}
        if portals:
            all_portals[key] = nav[key]["portals"]
        if painted:
            print(f"    verify overlay: {save_overlay(name, walk, portals)}")
    with open(os.path.join(PAINT_DIR, 'portals.json'), 'w') as f:
        json.dump(all_portals, f, indent=2)
    emit_nav_module(nav)
    print("\nNext: node tools/embed-maps.mjs  &&  npm run build")


if __name__ == '__main__':
    main()
