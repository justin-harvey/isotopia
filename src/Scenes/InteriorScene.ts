import 'phaser';
import { CollisionStrategy } from 'grid-engine';

import GameScene from './GameScene';
import { LayerType } from './enums/LayerType';
import { Door } from './components/Door';
import { Portal } from './components/Portal';
import { SceneName } from './enums/SceneNames';
import { showLeaveButton, hideLeaveButton } from '../ui/LeaveButton';
import { drawDoorCue } from './components/DoorCue';
import { MAPS } from '../data/maps';
import { INTERIOR_NAV, InteriorFloorNav } from '../data/interiorNav';

// A building interior you reach from the town. The room art is a single Luna
// Town background image; a shared 16x16 collision grid (interior_room.json)
// keeps the dog on the visible white floor. Every interior has an EXIT door
// back to the town, so "there is an exit for each room".
//
// Grid layout (see tools/gen_interior.py): walkable cols 3-11, rows 10-13.
export abstract class InteriorScene extends GameScene {
    private static readonly START = { x: 7, y: 10 };
    private static readonly EXIT = { x: 7, y: 13 };
    private static readonly SPAWN_TILES = [
        { x: 4, y: 11 },
        { x: 10, y: 11 },
        { x: 5, y: 12 },
        { x: 9, y: 12 },
    ];

    private readonly elementIds: string[];
    private readonly backgroundKey: string;
    private readonly backgroundPath: string;
    private readonly nav?: InteriorFloorNav;   // set for painted rooms (portal exit)

    constructor(sceneName: SceneName, backgroundFile: string, elementIds: string[], collisionMap?: string) {
        const nav = collisionMap ? INTERIOR_NAV[collisionMap] : undefined;
        const start = nav?.start ?? InteriorScene.START;
        super(sceneName, start.x, start.y, [LayerType.Floor, LayerType.Walls]);
        this.elementIds = elementIds;
        this.nav = nav;
        this.backgroundKey = `${sceneName}_bg`;
        this.backgroundPath = `assets/rooms/${backgroundFile}`;

        this.imageNames = {
            Perli: `${sceneName}_perli`,
            Veterinary: `${sceneName}_veterinary`,
            Map: `${sceneName}_room`,
        };

        // Painted rooms use their own traced collision grid; the rest share the
        // default interior_room open floor.
        const mapKey = collisionMap ?? 'interior_room';
        this.tilemapJSONPath = `assets/tilemap/${mapKey}.json`;
        this.imageMapDefaultPath = 'assets/tiles/';
        this.mapData = MAPS[mapKey];
        this.imageMapNames = {
            blank16: { name: 'blank16' },
        };

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
        this.loadObjectImages();
        this.load.image(this.backgroundKey, this.backgroundPath);
    }

    loadObjectImages(): void {
        this.load.spritesheet(this.imageNames.Veterinary,
            'assets/Characters/NPCs_1.png',
            { frameWidth: 32, frameHeight: 64 });
        this.loadElementalArt(this.elementIds);
    }

    create(): void {
        super.create();

        // The room art, stretched to cover the whole collision grid and sat
        // behind every sprite.
        this.add.image(0, 0, this.backgroundKey)
            .setOrigin(0, 0)
            .setDisplaySize(this.map.widthInPixels, this.map.heightInPixels)
            .setDepth(-100);

        // The interior is a small square room; on the 4:3 canvas the default
        // town zoom would leave blank margins beside it. Zoom so the room fills
        // the canvas width instead.
        this.cameras.main.setZoom(this.scale.gameSize.width / this.map.widthInPixels);

        // Exit back to the town. Painted rooms use a green exit portal (walk onto
        // it to leave); unpainted rooms keep the fixed centre EXIT door.
        const exitTiles = (this.nav?.portals ?? [])
            .filter(p => p.type === 'ascend').map(p => ({ x: p.x, y: p.y }));
        if (exitTiles.length) {
            new Portal(this, exitTiles, SceneName.Test,
                { color: 0x39d353, symbol: '▲', label: 'EXIT' });
        } else {
            // The room's walkable floor is above the exit, so the entrance pad is
            // the tile to the north — step onto it to leave. A glowing "EXIT ▼" mat
            // marks the otherwise-invisible pad.
            new Door({
                scene: this, xPosition: InteriorScene.EXIT.x, yPosition: InteriorScene.EXIT.y,
                nextScene: SceneName.Test, entryOffset: { dx: 0, dy: -1 },
            });
            drawDoorCue(this, InteriorScene.EXIT.x, InteriorScene.EXIT.y - 1, 'EXIT', '▼');
        }

        // A one-tap DOM "Leave" button, shown only while inside a building.
        const leave = (): void => this.switch(SceneName.Test);
        showLeaveButton(leave);
        this.events.on('wake', () => showLeaveButton(leave));
        this.events.on('sleep', () => hideLeaveButton());
        this.events.on('shutdown', () => hideLeaveButton());
    }

    createNpcs(): void {
        const tiles = this.nav ? this.walkableSpawnTiles() : InteriorScene.SPAWN_TILES;
        this.elementIds.forEach((id, i) => {
            const tile = tiles[i];
            if (!tile) return;
            this.spawnElemental(id, tile.x, tile.y);
        });
    }

    // For painted rooms: walkable, non-portal, non-start tiles spaced >=3 apart so
    // Elementals don't crowd or land in scenery / on the exit.
    private walkableSpawnTiles(): { x: number; y: number }[] {
        const portals = new Set((this.nav?.portals ?? []).map(p => `${p.x},${p.y}`));
        const start = this.nav!.start;
        const chosen: { x: number; y: number }[] = [];
        for (let y = 0; y < this.map.height; y++) {
            for (let x = 0; x < this.map.width; x++) {
                if (this.map.getTileAt(x, y, false, LayerType.Walls)) continue;   // wall
                if (portals.has(`${x},${y}`) || (x === start.x && y === start.y)) continue;
                if (chosen.every(c => Math.max(Math.abs(c.x - x), Math.abs(c.y - y)) >= 3)) {
                    chosen.push({ x, y });
                }
            }
        }
        return chosen;
    }

    update(): void {
        super.update();
    }
}
