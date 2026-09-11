import 'phaser';
import { CollisionStrategy } from 'grid-engine';

import GameScene from './GameScene';
import { LayerType } from './enums/LayerType';
import { Door } from './components/Door';
import { SceneName } from './enums/SceneNames';
import { showLeaveButton, hideLeaveButton } from '../ui/LeaveButton';
import { drawDoorCue } from './components/DoorCue';
import { MAPS } from '../data/maps';

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

    constructor(sceneName: SceneName, backgroundFile: string, elementIds: string[]) {
        super(sceneName, InteriorScene.START.x, InteriorScene.START.y, [LayerType.Floor, LayerType.Walls]);
        this.elementIds = elementIds;
        this.backgroundKey = `${sceneName}_bg`;
        this.backgroundPath = `assets/rooms/${backgroundFile}`;

        this.imageNames = {
            Perli: `${sceneName}_perli`,
            Veterinary: `${sceneName}_veterinary`,
            Map: `${sceneName}_room`,
        };

        this.tilemapJSONPath = 'assets/tilemap/interior_room.json';
        this.imageMapDefaultPath = 'assets/tiles/';
        this.mapData = MAPS.interior_room;
        this.imageMapNames = {
            blank16: { name: 'blank16' },
        };

        this.gridEngineSettings = {
            startPosition: { ...InteriorScene.START },
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

        // EXIT back to town. The room's walkable floor is above the exit, so the
        // entrance pad is the tile to the north — step onto it to leave.
        new Door({
            scene: this, xPosition: InteriorScene.EXIT.x, yPosition: InteriorScene.EXIT.y,
            nextScene: SceneName.Test, entryOffset: { dx: 0, dy: -1 },
        });

        // Two ways out, both obvious (the invisible step-on pad alone confused
        // new players): (1) a glowing in-world "EXIT ▼" mat over the pad (the exit
        // door sits below it), and (2) a one-tap DOM "Leave" button, shown only
        // while inside a building.
        drawDoorCue(this, InteriorScene.EXIT.x, InteriorScene.EXIT.y - 1, 'EXIT', '▼');
        const leave = (): void => this.switch(SceneName.Test);
        showLeaveButton(leave);
        this.events.on('wake', () => showLeaveButton(leave));
        this.events.on('sleep', () => hideLeaveButton());
        this.events.on('shutdown', () => hideLeaveButton());
    }

    createNpcs(): void {
        this.elementIds.forEach((id, i) => {
            const tile = InteriorScene.SPAWN_TILES[i];
            if (!tile) return;
            this.spawnElemental(id, tile.x, tile.y);
        });
    }

    update(): void {
        super.update();
    }
}
