import 'phaser';
import { CollisionStrategy } from 'grid-engine';

import GameScene from './GameScene';
import { LayerType } from './enums/LayerType';
import { Door } from './components/Door';
import { drawDoorCue } from './components/DoorCue';
import { SceneName } from './enums/SceneNames';
import { MAPS } from '../data/maps';

// The Desert (level 2) — a wide sun-bleached basin reached south from the city.
// Built from GrayCatGames' PixelWorlds Desert tileset by tools/gen_desert.py:
// a sand expanse dotted with oasis pools, cracked-dirt pits and rock buttes, with
// palms, cacti, boulders and shrubs scattered as sprites (the scenery object
// layer, same pattern as the woods). No wild Elementals yet — it's here to
// explore (populate later). A south exit pad leads back to the city.
export default class DesertScene extends GameScene {
    private static readonly EXIT = { x: 40, y: 49 };
    private static readonly START = { x: 40, y: 47 };

    constructor() {
        super(SceneName.Desert, DesertScene.START.x, DesertScene.START.y,
            [LayerType.Floor, LayerType.Walls, LayerType.Overhead]);

        this.imageNames = {
            Perli: `${SceneName.Desert}_perli`,
            Veterinary: `${SceneName.Desert}_veterinary`,
            Map: 'desert_map',
        };

        this.tilemapJSONPath = 'assets/tilemap/desert_map.json';
        this.imageMapDefaultPath = 'assets/tiles/';
        this.mapData = MAPS.desert_map;
        // Two tilesets: the desert art + blank16 (invisible collision under props
        // and over the oasis water). Names must match the tilemap's tilesets.
        this.imageMapNames = {
            desert_tileset: { name: 'desert_tileset' },
            blank16: { name: 'blank16' },
        };

        this.gridEngineSettings = {
            startPosition: { ...DesertScene.START },
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

    // Depths mirror the woods: tall plants (palm/cactus) render ABOVE the player
    // so you walk behind/under them; ground props sit just below the player.
    private static readonly CHAR_DEPTH = 10;
    private static readonly OVERHEAD_DEPTH = DesertScene.CHAR_DEPTH + 10;
    private static readonly GROUND_DEPTH = DesertScene.CHAR_DEPTH - 4;
    private static readonly SCENERY: Record<string,
        { keys: string[]; tilesW: number; depth: number }> = {
        palm:    { keys: ['desert_palm'],                              tilesW: 3,   depth: DesertScene.OVERHEAD_DEPTH },
        cactus:  { keys: ['desert_cactus_tall', 'desert_cactus_short'], tilesW: 1,  depth: DesertScene.OVERHEAD_DEPTH },
        boulder: { keys: ['desert_boulder_1', 'desert_boulder_2'],     tilesW: 2,   depth: DesertScene.GROUND_DEPTH },
        shrub:   { keys: ['desert_shrub_1', 'desert_shrub_2'],         tilesW: 2,   depth: DesertScene.GROUND_DEPTH - 1 },
    };

    loadObjectImages(): void {
        const files: Record<string, string> = {
            desert_palm: 'palm',
            desert_cactus_tall: 'cactus-tall', desert_cactus_short: 'cactus-short',
            desert_boulder_1: 'boulder-1', desert_boulder_2: 'boulder-2',
            desert_shrub_1: 'shrub-1', desert_shrub_2: 'shrub-2',
        };
        Object.entries(files).forEach(([key, file]) =>
            this.load.image(key, `assets/desert/${file}.png`));
    }

    // Drop the scenery sprites named in the tilemap's `scenery` object layer. Base
    // anchored at the object point (bottom-centre); width set in tiles so art keeps
    // its natural size; depth decides over/under the player. (variant is 0-based,
    // matching gen_desert.py.)
    placeScenery(): void {
        const layer = this.map.getObjectLayer('scenery');
        if (!layer) return;
        layer.objects.forEach((obj, idx) => {
            const spec = DesertScene.SCENERY[obj.name ?? ''];
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
            ?.setDepth(DesertScene.OVERHEAD_DEPTH);
        this.placeScenery();

        // South exit back to the city: a glowing "CITY ▼" pad at the bottom edge.
        // Approach from the north and step onto the pad to leave.
        new Door({
            scene: this, xPosition: DesertScene.EXIT.x, yPosition: DesertScene.EXIT.y,
            nextScene: SceneName.City, entryOffset: { dx: 0, dy: -1 },
        });
        drawDoorCue(this, DesertScene.EXIT.x, DesertScene.EXIT.y - 1, 'CITY', '▼');
    }

    // No wild Elementals in the desert yet — explore-only for now.
    createNpcs(): void { /* populate with desert Elementals later */ }

    update(): void {
        super.update();
    }
}
