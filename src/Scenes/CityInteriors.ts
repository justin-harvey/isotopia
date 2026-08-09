import 'phaser';
import { CollisionStrategy } from 'grid-engine';

import GameScene from './GameScene';
import { LayerType } from './enums/LayerType';
import { Door } from './components/Door';
import { SceneName } from './enums/SceneNames';
import { showLeaveButton, hideLeaveButton } from '../ui/LeaveButton';
import { drawDoorCue } from './components/DoorCue';
import { MAPS } from '../data/maps';

// The interiors of the City buildings (reached by stepping onto a building's
// door in CityScene). Unlike the square Luna-Town rooms, the city interior art
// is wide 1408x768, so these use their own landscape 22x12 collision grid
// (city_interior.json / tools/gen_city_interior.py) — a plain open room with a
// one-tile wall border. Every room has a bottom-centre door back out; the
// museum additionally has a top-centre "deeper" door that chains down through
// four basement levels.

interface CityRoomConfig {
    background: string;   // image file under assets/rooms/
    up: SceneName;        // bottom door: leave the building, or climb one level up
    upLabel: string;      // 'EXIT' (ground floors) or 'UP' (basements)
    down?: SceneName;     // optional top door: one level deeper (museum only)
}

// Shared landscape-room behaviour. Concrete scenes below only supply their art
// and which scenes their doors lead to.
abstract class CityInteriorScene extends GameScene {
    private static readonly START = { x: 11, y: 6 };
    private static readonly EXIT = { x: 11, y: 11 };   // bottom wall — the way out
    private static readonly DEEPER = { x: 11, y: 0 };  // top wall — deeper (museum)

    private readonly cfg: CityRoomConfig;
    private readonly bgKey: string;

    constructor(sceneName: SceneName, cfg: CityRoomConfig) {
        super(sceneName, CityInteriorScene.START.x, CityInteriorScene.START.y, [LayerType.Floor, LayerType.Walls]);
        this.cfg = cfg;
        this.bgKey = `${sceneName}_bg`;

        this.imageNames = {
            Perli: `${sceneName}_perli`,
            Veterinary: `${sceneName}_veterinary`,
            Map: `${sceneName}_room`,
        };

        this.tilemapJSONPath = 'assets/tilemap/city_interior.json';
        this.mapData = MAPS.city_interior;
        this.imageMapDefaultPath = 'assets/tiles/';
        this.imageMapNames = { blank16: { name: 'blank16' } };

        this.gridEngineSettings = {
            startPosition: { ...CityInteriorScene.START },
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

    // No extra object art — the room is a single background image + the dog.
    loadObjectImages(): void { /* intentionally empty */ }

    create(): void {
        super.create();

        // Room art stretched over the whole grid, behind every sprite. The grid
        // matches the art's 11:6 aspect, so nothing is squished.
        this.add.image(0, 0, this.bgKey)
            .setOrigin(0, 0)
            .setDisplaySize(this.map.widthInPixels, this.map.heightInPixels)
            .setDepth(-100);

        // Fill the canvas width with the room (same trick as the town interiors).
        this.cameras.main.setZoom(this.scale.gameSize.width / this.map.widthInPixels);

        // Bottom door: leave the building (ground floors) or climb one level up
        // (museum basements). Its step-on pad is the tile just north of it.
        new Door({
            scene: this, xPosition: CityInteriorScene.EXIT.x, yPosition: CityInteriorScene.EXIT.y,
            nextScene: this.cfg.up, entryOffset: { dx: 0, dy: -1 },
        });
        drawDoorCue(this, CityInteriorScene.EXIT.x, CityInteriorScene.EXIT.y - 1, this.cfg.upLabel, '▼');

        // Optional top door: one level deeper into the museum basements.
        if (this.cfg.down) {
            new Door({
                scene: this, xPosition: CityInteriorScene.DEEPER.x, yPosition: CityInteriorScene.DEEPER.y,
                nextScene: this.cfg.down, entryOffset: { dx: 0, dy: 1 },
            });
            drawDoorCue(this, CityInteriorScene.DEEPER.x, CityInteriorScene.DEEPER.y + 1, 'DEEPER', '▲');
        }

        // A one-tap DOM "Leave" button always escapes straight back to the city,
        // however deep in the basement you are.
        const leave = (): void => this.switch(SceneName.City);
        showLeaveButton(leave);
        this.events.on('wake', () => showLeaveButton(leave));
        this.events.on('sleep', () => hideLeaveButton());
        this.events.on('shutdown', () => hideLeaveButton());
    }

    // Empty rooms to explore for now — no Elementals assigned to city buildings.
    createNpcs(): void { /* intentionally empty */ }

    update(): void {
        super.update();
    }
}

// ---- Standalone building interiors (bottom door → back out to the city) ----
export class CityPowerTowerScene extends CityInteriorScene {
    constructor() { super(SceneName.CityPowerTower, { background: 'power-tower-interior.png', up: SceneName.City, upLabel: 'EXIT' }); }
}
export class CityFinanceScene extends CityInteriorScene {
    constructor() { super(SceneName.CityFinance, { background: 'finance-interior.png', up: SceneName.City, upLabel: 'EXIT' }); }
}
export class CityLargeTowerScene extends CityInteriorScene {
    constructor() { super(SceneName.CityLargeTower, { background: 'large-tower-interior.png', up: SceneName.City, upLabel: 'EXIT' }); }
}
export class CityChurchScene extends CityInteriorScene {
    constructor() { super(SceneName.CityChurch, { background: 'church-interior.png', up: SceneName.City, upLabel: 'EXIT' }); }
}
export class CityFashionScene extends CityInteriorScene {
    constructor() { super(SceneName.CityFashion, { background: 'fashion-interior.png', up: SceneName.City, upLabel: 'EXIT' }); }
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
export class CityMuseumScene extends CityInteriorScene {
    constructor() { super(SceneName.CityMuseum, { background: 'museum-interior.png', up: SceneName.City, upLabel: 'EXIT', down: SceneName.CityMuseumB1 }); }
}
export class CityMuseumB1Scene extends CityInteriorScene {
    constructor() { super(SceneName.CityMuseumB1, { background: 'museum-level-1.png', up: SceneName.CityMuseum, upLabel: 'UP', down: SceneName.CityMuseumB2 }); }
}
export class CityMuseumB2Scene extends CityInteriorScene {
    constructor() { super(SceneName.CityMuseumB2, { background: 'museum-level-2.png', up: SceneName.CityMuseumB1, upLabel: 'UP', down: SceneName.CityMuseumB3 }); }
}
export class CityMuseumB3Scene extends CityInteriorScene {
    constructor() { super(SceneName.CityMuseumB3, { background: 'museum-level-3.png', up: SceneName.CityMuseumB2, upLabel: 'UP', down: SceneName.CityMuseumB4 }); }
}
export class CityMuseumB4Scene extends CityInteriorScene {
    constructor() { super(SceneName.CityMuseumB4, { background: 'museum-level-4.png', up: SceneName.CityMuseumB3, upLabel: 'UP' }); }
}
