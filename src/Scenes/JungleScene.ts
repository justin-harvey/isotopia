import 'phaser';
import { CollisionStrategy } from 'grid-engine';

import GameScene from './GameScene';
import { LayerType } from './enums/LayerType';
import { Door } from './components/Door';
import { drawDoorCue } from './components/DoorCue';
import { SceneName } from './enums/SceneNames';
import { MAPS } from '../data/maps';

// The Jungle (level 2) — a dense rainforest. In the level progression you reach
// it FROM the City and leave onward to the Desert (City → Jungle → Desert).
// Built from the Lost Valleys jungle pack by tools/gen_jungle.py: a deep-green
// grass expanse walled in by trees, carved with earthy dirt clearings, dotted
// with rock-ringed water ponds, and blanketed in ferns, rocks and moss (all the
// scenery object layer, same pattern as the woods/desert). No wild Elementals
// yet — it's here to explore (populate later; lesson two = electron configuration,
// see JUNGLE-LESSON2-PLAN.md). You arrive at the SOUTH entrance (START, by the
// "CITY" pad) and walk NORTH to the "DESERT" pad that leads onward to the finale.
export default class JungleScene extends GameScene {
    private static readonly EXIT = { x: 40, y: 49 };    // south pad → back to the City
    private static readonly ONWARD = { x: 40, y: 0 };   // north pad → onward to the Desert
    private static readonly START = { x: 40, y: 47 };

    constructor() {
        super(SceneName.Jungle, JungleScene.START.x, JungleScene.START.y,
            [LayerType.Floor, LayerType.Walls, LayerType.Overhead]);

        this.imageNames = {
            Perli: `${SceneName.Jungle}_perli`,
            Veterinary: `${SceneName.Jungle}_veterinary`,
            Map: 'jungle_map',
        };

        this.tilemapJSONPath = 'assets/tilemap/jungle_map.json';
        this.imageMapDefaultPath = 'assets/tiles/';
        this.mapData = MAPS.jungle_map;
        // Two tilesets: the composed jungle ground sheet + blank16 (invisible
        // collision under props and over the ponds). Names must match the tilemap.
        this.imageMapNames = {
            jungle_tileset: { name: 'jungle_tileset' },
            blank16: { name: 'blank16' },
        };

        this.gridEngineSettings = {
            startPosition: { ...JungleScene.START },
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
    }

    // Depths mirror the woods/desert: tree canopies render ABOVE the player so you
    // walk behind/under them; ground props (ferns, rocks, moss) sit below.
    private static readonly CHAR_DEPTH = 10;
    private static readonly OVERHEAD_DEPTH = JungleScene.CHAR_DEPTH + 10;
    private static readonly GROUND_DEPTH = JungleScene.CHAR_DEPTH - 4;
    private static readonly SCENERY: Record<string,
        { keys: string[]; tilesW: number; depth: number }> = {
        // Canopy shared with the North Woods (woods_tree_*) plus the two green
        // jungle trees as accents, so the biomes feel of a piece.
        tree: { keys: ['woods_tree_1', 'woods_tree_2', 'woods_tree_3', 'jungle_tree_1', 'jungle_tree_2'],
                tilesW: 3, depth: JungleScene.OVERHEAD_DEPTH },
        fern: { keys: ['jungle_fern_1', 'jungle_fern_2', 'jungle_fern_3',
                       'jungle_fern_4', 'jungle_fern_5', 'jungle_fern_6'],
                tilesW: 1, depth: JungleScene.GROUND_DEPTH },
        rock: { keys: ['jungle_rock_1', 'jungle_rock_2', 'jungle_rock_3', 'jungle_rock_4',
                       'jungle_rock_5', 'jungle_rock_6', 'jungle_rock_7', 'jungle_rock_8'],
                tilesW: 1, depth: JungleScene.GROUND_DEPTH },
        moss: { keys: ['jungle_moss_1', 'jungle_moss_2', 'jungle_moss_3'],
                tilesW: 7, depth: JungleScene.GROUND_DEPTH - 2 },
    };

    // Ambient fauna spritesheets (animated, placed in code — not scenery objects).
    // Just the teal slimes by the ponds. Frame grid comes from slice_jungle.py.
    private static readonly FAUNA: Record<string,
        { frameW: number; frameH: number; frames: [number, number]; rate: number }> = {
        jungle_slime: { frameW: 36, frameH: 28, frames: [0, 3], rate: 5 },
    };

    loadObjectImages(): void {
        // Key prefix picks the asset folder: woods_tree_1 -> assets/woods/tree-1.png,
        // jungle_moss_1 -> assets/jungle/moss-1.png. Lets the jungle borrow woods art.
        const seen = new Set<string>();
        Object.values(JungleScene.SCENERY).forEach(spec =>
            spec.keys.forEach(key => {
                if (seen.has(key)) return;
                seen.add(key);
                const [dir, ...rest] = key.split('_');
                this.load.image(key, `assets/${dir}/${rest.join('-')}.png`);
            }));
        Object.entries(JungleScene.FAUNA).forEach(([key, f]) =>
            this.load.spritesheet(key, `assets/jungle/${key.replace('jungle_', '')}-sheet.png`,
                { frameWidth: f.frameW, frameHeight: f.frameH }));
    }

    // Drop ambient creatures: goblins guarding the ruins, slimes + crabs haunting
    // the ponds. Each loops an idle animation and drifts gently side to side
    // (skipped under prefers-reduced-motion, matching the rest of the game).
    private spawnFauna(): void {
        const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        Object.entries(JungleScene.FAUNA).forEach(([key, f]) => {
            const anim = `${key}_idle`;
            if (!this.anims.exists(anim)) {
                this.anims.create({
                    key: anim, frameRate: f.rate, repeat: -1,
                    frames: this.anims.generateFrameNumbers(key, { start: f.frames[0], end: f.frames[1] }),
                });
            }
        });
        const tw = this.map.tileWidth;
        const critter = (key: string, tx: number, ty: number, tilesH: number, drift: number): void => {
            const spr = this.add.sprite(tx * tw + tw / 2, (ty + 1) * tw, key).setOrigin(0.5, 1);
            spr.setScale((tilesH * tw) / JungleScene.FAUNA[key].frameH);
            spr.setDepth(JungleScene.CHAR_DEPTH - 1);
            if (reduce) { spr.setFrame(JungleScene.FAUNA[key].frames[0]); return; }
            spr.play(`${key}_idle`);
            this.tweens.add({
                targets: spr, x: spr.x + drift * tw, duration: 2600, yoyo: true, repeat: -1,
                ease: 'Sine.easeInOut',
                onYoyo: () => spr.setFlipX(drift < 0), onRepeat: () => spr.setFlipX(drift > 0),
            });
        };
        // teal slimes drifting by the four ponds
        critter('jungle_slime', 22, 17, 1.3, 1.5);
        critter('jungle_slime', 31, 17, 1.3, -1.5);
        critter('jungle_slime', 49, 25, 1.3, 2);
        critter('jungle_slime', 16, 42, 1.3, -1.2);
        critter('jungle_slime', 64, 28, 1.3, 1.5);
    }

    // Drop the scenery sprites named in the tilemap's `scenery` object layer. Base
    // anchored at the object point (bottom-centre); width set in tiles so art keeps
    // its natural size; depth decides over/under the player. (variant is 0-based,
    // matching gen_jungle.py.)
    placeScenery(): void {
        const layer = this.map.getObjectLayer('scenery');
        if (!layer) return;
        layer.objects.forEach((obj, idx) => {
            const spec = JungleScene.SCENERY[obj.name ?? ''];
            if (!spec || obj.x == null || obj.y == null) return;
            const props: Record<string, unknown> = {};
            (obj.properties as { name: string; value: unknown }[] | undefined)
                ?.forEach(p => { props[p.name] = p.value; });
            const variant = (typeof props.variant === 'number' ? props.variant : idx)
                % spec.keys.length;
            const tilesW = typeof props.tw === 'number' ? props.tw : spec.tilesW;
            const img = this.add.image(obj.x, obj.y, spec.keys[variant]).setOrigin(0.5, 1);
            img.setScale((tilesW * this.map.tileWidth) / img.width);
            img.setDepth(spec.depth);
        });
    }

    create(): void {
        super.create();

        // Lift the (empty) overhead layer above the player, matching the woods, so
        // any future canopy tiles render on top; then drop the scenery sprites.
        this.map.getLayer(LayerType.Overhead)?.tilemapLayer
            ?.setDepth(JungleScene.OVERHEAD_DEPTH);
        this.placeScenery();
        this.spawnFauna();

        // South exit back to the City: a glowing "CITY ▼" pad at the bottom edge
        // (this is where you arrive from the City). Step onto the pad to return.
        new Door({
            scene: this, xPosition: JungleScene.EXIT.x, yPosition: JungleScene.EXIT.y,
            nextScene: SceneName.City, entryOffset: { dx: 0, dy: -1 },
        });
        drawDoorCue(this, JungleScene.EXIT.x, JungleScene.EXIT.y - 1, 'CITY', '▼');

        // North trail onward to the Desert (level 3 finale): a "DESERT ▲" pad at the
        // top edge. Walk the length of the jungle to reach it.
        new Door({
            scene: this, xPosition: JungleScene.ONWARD.x, yPosition: JungleScene.ONWARD.y,
            nextScene: SceneName.Desert, entryOffset: { dx: 0, dy: 1 },
        });
        drawDoorCue(this, JungleScene.ONWARD.x, JungleScene.ONWARD.y + 1, 'DESERT', '▲');
    }

    // No wild Elementals in the jungle yet — explore-only for now.
    createNpcs(): void { /* populate with jungle Elementals later */ }

    update(): void {
        super.update();
    }
}
