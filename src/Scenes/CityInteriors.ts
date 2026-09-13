import 'phaser';
import { CollisionStrategy } from 'grid-engine';

import GameScene from './GameScene';
import { LayerType } from './enums/LayerType';
import { Door } from './components/Door';
import { Portal, MUSEUM_ARRIVAL } from './components/Portal';
import { SceneName } from './enums/SceneNames';
import { showLeaveButton, hideLeaveButton } from '../ui/LeaveButton';
import { drawDoorCue } from './components/DoorCue';
import { MAPS } from '../data/maps';
import { INTERIOR_NAV, InteriorFloorNav } from '../data/interiorNav';

// The interiors of the City buildings (reached by stepping onto a building's
// door in CityScene). Unlike the square Luna-Town rooms, the city interior art
// is wide 1408x768, so these use their own landscape 22x12 collision grid
// (city_interior.json / tools/gen_city_interior.py) — a plain open room with a
// one-tile wall border. Every room has a bottom-centre door back out; the
// museum additionally has a top-centre "deeper" door that chains down through
// four basement levels.

interface CityRoomConfig {
    background: string;   // image file under assets/rooms/
    up: SceneName;        // ascend target: leave the building, or climb one level up
    upLabel: string;      // 'EXIT' (ground floors) or 'UP' (basements)
    down?: SceneName;     // descend target: one level deeper (museum only)
    elementIds?: string[]; // Elementals to place in this room (default: none)
    // Museum floors pass a per-floor collision map key (museum_ground / museum_b1..b4).
    // When set, the room uses that painted collision grid and navigates via painted
    // portals (see museumNav.ts) instead of the fixed centre doors.
    collisionMap?: string;
}

// Shared landscape-room behaviour. Concrete scenes below only supply their art
// and which scenes their doors lead to.
abstract class CityInteriorScene extends GameScene {
    private static readonly START = { x: 11, y: 6 };
    private static readonly EXIT = { x: 11, y: 11 };   // bottom wall — the way out
    private static readonly DEEPER = { x: 11, y: 0 };  // top wall — deeper (museum)

    // Tiles an Elemental can stand on. The interior is a wide-open 20x10 room
    // (walkable cols 1-20, rows 1-10 — see city_interior.json). We lay creatures
    // on a spaced grid that skips: the door step-pad rows (y=1 top, y=10 bottom),
    // the player's start row (y=6), and the central column corridor (x=10-12)
    // the dog walks between the two doors. Tiles sit >=2 apart so adjacent
    // monsters' proximity quizzes don't overlap. Yields 36 slots per floor →
    // 180 across the 5 museum floors, ample for the full periodic-table roster.
    private static readonly SPAWN_TILES: { x: number; y: number }[] =
        ([2, 4, 7, 9] as const).flatMap(y =>
            [1, 3, 5, 7, 9, 13, 15, 17, 19].map(x => ({ x, y })));

    private readonly cfg: CityRoomConfig;
    private readonly bgKey: string;
    private readonly elementIds: string[];
    private readonly nav?: InteriorFloorNav;   // set for painted rooms (portal nav)
    private readonly sceneKey: SceneName;

    constructor(sceneName: SceneName, cfg: CityRoomConfig) {
        const nav = cfg.collisionMap ? INTERIOR_NAV[cfg.collisionMap] : undefined;
        const start = nav?.start ?? CityInteriorScene.START;
        super(sceneName, start.x, start.y, [LayerType.Floor, LayerType.Walls]);
        this.cfg = cfg;
        this.nav = nav;
        this.sceneKey = sceneName;
        this.bgKey = `${sceneName}_bg`;
        this.elementIds = cfg.elementIds ?? [];

        this.imageNames = {
            Perli: `${sceneName}_perli`,
            Veterinary: `${sceneName}_veterinary`,
            Map: `${sceneName}_room`,
        };

        // Museum floors use their own painted collision grid; other city buildings
        // share the plain open room.
        const mapKey = cfg.collisionMap ?? 'city_interior';
        this.tilemapJSONPath = `assets/tilemap/${mapKey}.json`;
        this.mapData = MAPS[mapKey];
        this.imageMapDefaultPath = 'assets/tiles/';
        this.imageMapNames = { blank16: { name: 'blank16' } };

        this.gridEngineSettings = {
            startPosition: { ...start },
            scale: 5,
            characterCollisionStrategy: CollisionStrategy.BLOCK_ONE_TILE_AHEAD,
            layerOverlay: false,
        };
    }

    preload(): void {
        super.preload();
        super.loadAvatarSpritesheet();
        super.loadMapImages();
        this.load.image(this.bgKey, `assets/rooms/${this.cfg.background}`);
    }

    // With no Elementals assigned the room is just a background image + the dog.
    // When a room does host Elementals, load their art plus the shared NPC
    // spritesheet that spawnElemental falls back to for creatures lacking art.
    loadObjectImages(): void {
        if (this.elementIds.length === 0) return;
        this.load.spritesheet(this.imageNames.Veterinary,
            'assets/Characters/NPCs_1.png',
            { frameWidth: 32, frameHeight: 64 });
        this.loadElementalArt(this.elementIds);
    }

    create(): void {
        // Resolve a pending portal arrival BEFORE the scene is built, so the player
        // is created directly on the arrival portal. (Teleporting with setPosition
        // mid-create was fragile and could abort create → white screen.)
        if (this.nav) this.resolveArrivalStart();

        super.create();

        // Room art stretched over the whole grid, behind every sprite. The grid
        // matches the art's 11:6 aspect, so nothing is squished.
        this.add.image(0, 0, this.bgKey)
            .setOrigin(0, 0)
            .setDisplaySize(this.map.widthInPixels, this.map.heightInPixels)
            .setDepth(-100);

        // Fill the canvas width with the room (same trick as the town interiors).
        this.cameras.main.setZoom(this.scale.gameSize.width / this.map.widthInPixels);

        if (this.nav) {
            this.createPortals();
            // Re-entering an already-built (sleeping) floor doesn't re-run create,
            // so reposition on wake instead.
            this.events.on('wake', () => this.applyArrivalOnWake());
        } else {
            this.createDoors();
        }

        // A one-tap DOM "Leave" button always escapes straight back to the city,
        // however deep in the basement you are.
        const leave = (): void => this.switch(SceneName.City);
        showLeaveButton(leave);
        this.events.on('wake', () => showLeaveButton(leave));
        this.events.on('sleep', () => hideLeaveButton());
        this.events.on('shutdown', () => hideLeaveButton());
    }

    // Fixed centre doors for the plain open-room buildings (non-museum).
    private createDoors(): void {
        new Door({
            scene: this, xPosition: CityInteriorScene.EXIT.x, yPosition: CityInteriorScene.EXIT.y,
            nextScene: this.cfg.up, entryOffset: { dx: 0, dy: -1 },
        });
        drawDoorCue(this, CityInteriorScene.EXIT.x, CityInteriorScene.EXIT.y - 1, this.cfg.upLabel, '▼');
        if (this.cfg.down) {
            new Door({
                scene: this, xPosition: CityInteriorScene.DEEPER.x, yPosition: CityInteriorScene.DEEPER.y,
                nextScene: this.cfg.down, entryOffset: { dx: 0, dy: 1 },
            });
            drawDoorCue(this, CityInteriorScene.DEEPER.x, CityInteriorScene.DEEPER.y + 1, 'DEEPER', '▲');
        }
    }

    // Museum floors: place a teleport tile for each painted portal group. ascend
    // (green) -> the floor above (cfg.up), descend (blue) -> the floor below
    // (cfg.down), custom (purple) -> Cloud City. Arriving via one lands the player
    // on the opposite portal of the destination floor (see MUSEUM_ARRIVAL).
    private createPortals(): void {
        const nav = this.nav!;
        const tilesOf = (t: 'ascend' | 'descend' | 'custom'): { x: number; y: number }[] =>
            nav.portals.filter(p => p.type === t).map(p => ({ x: p.x, y: p.y }));

        const ascend = tilesOf('ascend');
        if (ascend.length) {
            new Portal(this, ascend, this.cfg.up,
                { color: 0x39d353, symbol: '▲', label: this.cfg.upLabel }, 'descend');
        } else {
            // No painted exit portal — keep the fixed centre exit door as a safety net.
            new Door({
                scene: this, xPosition: CityInteriorScene.EXIT.x, yPosition: CityInteriorScene.EXIT.y,
                nextScene: this.cfg.up, entryOffset: { dx: 0, dy: -1 },
            });
            drawDoorCue(this, CityInteriorScene.EXIT.x, CityInteriorScene.EXIT.y - 1, this.cfg.upLabel, '▼');
        }
        const descend = tilesOf('descend');
        if (descend.length && this.cfg.down) {
            new Portal(this, descend, this.cfg.down,
                { color: 0x4098ff, symbol: '▼', label: 'DOWN' }, 'ascend');
        }
        const custom = tilesOf('custom');
        if (custom.length) {
            new Portal(this, custom, SceneName.CloudCity,
                { color: 0xc94fff, symbol: '✦', label: 'CLOUD' });
        }
    }

    // Pending portal arrival tile for this floor, or undefined. Consumes the
    // MUSEUM_ARRIVAL handoff set by the portal that sent us here.
    private takeArrivalTile(): { x: number; y: number } | undefined {
        if (!this.nav) return undefined;
        const want = MUSEUM_ARRIVAL[this.sceneKey];
        if (!want) return undefined;
        delete MUSEUM_ARRIVAL[this.sceneKey];
        const p = this.nav.portals.find(pt => pt.type === want);
        return p ? { x: p.x, y: p.y } : undefined;
    }

    // First visit: bias the player's spawn onto the arrival portal before the
    // scene (and grid-engine) are built, so no mid-create teleport is needed.
    private resolveArrivalStart(): void {
        const tile = this.takeArrivalTile();
        if (tile) this.gridEngineSettings.startPosition = tile;
    }

    // Revisiting an already-built (sleeping) floor: reposition safely (the scene
    // is fully active here). Guarded so a bad tile can never freeze the scene.
    private applyArrivalOnWake(): void {
        const tile = this.takeArrivalTile();
        if (!tile) return;
        try {
            this.gridEngine.setPosition(this.playerName, tile);
            this.characterMoved = false;   // don't instantly re-trigger the portal
        } catch { /* non-fatal: leave the player where they were */ }
    }

    // Place each assigned Elemental on a spawn tile. Rooms with no elementIds
    // (every city building today) stay empty, exactly as before. On painted museum
    // floors, skip slots that landed on a wall/pit or on a portal tile so no
    // creature is trapped in scenery or standing on a teleport.
    createNpcs(): void {
        const portalCells = new Set((this.nav?.portals ?? []).map(p => `${p.x},${p.y}`));
        const tiles = CityInteriorScene.SPAWN_TILES.filter(t =>
            !this.map.getTileAt(t.x, t.y, false, LayerType.Walls) &&
            !portalCells.has(`${t.x},${t.y}`));
        this.elementIds.forEach((id, i) => {
            const tile = tiles[i];
            if (!tile) return;   // more Elementals than free slots — extras are skipped
            this.spawnElemental(id, tile.x, tile.y);
        });
    }

    update(): void {
        super.update();
    }
}

// ---- Standalone building interiors (bottom door → back out to the city) ----
export class CityPowerTowerScene extends CityInteriorScene {
    constructor() { super(SceneName.CityPowerTower, { background: 'power-tower-interior.png', up: SceneName.City, upLabel: 'EXIT' }); }
}
export class CityFinanceScene extends CityInteriorScene {
    constructor() { super(SceneName.CityFinance, { background: 'finance-interior.png', up: SceneName.City, upLabel: 'EXIT', collisionMap: 'room_finance' }); }
}
export class CityLargeTowerScene extends CityInteriorScene {
    constructor() { super(SceneName.CityLargeTower, { background: 'large-tower-interior.png', up: SceneName.City, upLabel: 'EXIT', collisionMap: 'room_large_tower' }); }
}
export class CityChurchScene extends CityInteriorScene {
    constructor() { super(SceneName.CityChurch, { background: 'church-interior.png', up: SceneName.City, upLabel: 'EXIT', collisionMap: 'room_church' }); }
}
export class CityFashionScene extends CityInteriorScene {
    constructor() { super(SceneName.CityFashion, { background: 'fashion-interior.png', up: SceneName.City, upLabel: 'EXIT', collisionMap: 'room_fashion' }); }
}
export class CityRadioTowerScene extends CityInteriorScene {
    constructor() { super(SceneName.CityRadioTower, { background: 'radio-tower-interior.png', up: SceneName.City, upLabel: 'EXIT' }); }
}
export class CityPowerStationScene extends CityInteriorScene {
    constructor() { super(SceneName.CityPowerStation, { background: 'power-station-interior.png', up: SceneName.City, upLabel: 'EXIT' }); }
}
export class CityRadioTower2Scene extends CityInteriorScene {
    constructor() { super(SceneName.CityRadioTower2, { background: 'radio-tower-2-interior.png', up: SceneName.City, upLabel: 'EXIT' }); }
}

// ---- Museum: ground floor + four basement levels, each deeper ----
// Each floor uses its own painted collision grid and navigates via painted
// portals (green=up, blue=down, purple=Cloud City) instead of fixed doors.
export class CityMuseumScene extends CityInteriorScene {
    constructor() { super(SceneName.CityMuseum, { background: 'museum-interior.png', up: SceneName.City, upLabel: 'EXIT', down: SceneName.CityMuseumB1, collisionMap: 'museum_ground' }); }
}
export class CityMuseumB1Scene extends CityInteriorScene {
    constructor() { super(SceneName.CityMuseumB1, { background: 'museum-level-1.png', up: SceneName.CityMuseum, upLabel: 'UP', down: SceneName.CityMuseumB2, collisionMap: 'museum_b1' }); }
}
export class CityMuseumB2Scene extends CityInteriorScene {
    constructor() { super(SceneName.CityMuseumB2, { background: 'museum-level-2.png', up: SceneName.CityMuseumB1, upLabel: 'UP', down: SceneName.CityMuseumB3, collisionMap: 'museum_b2' }); }
}
export class CityMuseumB3Scene extends CityInteriorScene {
    constructor() { super(SceneName.CityMuseumB3, { background: 'museum-level-3.png', up: SceneName.CityMuseumB2, upLabel: 'UP', down: SceneName.CityMuseumB4, collisionMap: 'museum_b3' }); }
}
export class CityMuseumB4Scene extends CityInteriorScene {
    constructor() { super(SceneName.CityMuseumB4, { background: 'museum-level-4.png', up: SceneName.CityMuseumB3, upLabel: 'UP', collisionMap: 'museum_b4' }); }
}

// Placeholder destination for the museum B3 purple/custom portal until real cloud
// art exists. Plain open room; the Leave button (and the EXIT door) return to the
// city. Swap the background for real art when it's ready.
export class CloudCityScene extends CityInteriorScene {
    constructor() { super(SceneName.CloudCity, { background: 'cloud-city.png', up: SceneName.City, upLabel: 'EXIT' }); }
}
