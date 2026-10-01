import 'phaser';
import { CollisionStrategy } from 'grid-engine';

import GameScene from './GameScene';
import GlobalInfo from '../GlobalInfo';
import { LayerType } from './enums/LayerType';
import { Door } from './components/Door';
import { drawDoorCue } from './components/DoorCue';
import { SceneName } from './enums/SceneNames';
import { MAPS } from '../data/maps';
import { showNpcDialog } from '../ui/NpcDialog';
import { hasItem, GIZA_CRYSTAL, isPyramidRisen, markPyramidRisen } from '../data/progress';

// The Desert (level 2) — a wide sun-bleached basin reached south from the city.
// Built from GrayCatGames' PixelWorlds Desert tileset by tools/gen_desert.py:
// a sand expanse dotted with oasis pools, cracked-dirt pits and rock buttes, with
// palms, cacti, boulders and shrubs scattered as sprites (the scenery object
// layer, same pattern as the woods). A south exit pad leads back to the city.
//
// LESSON THREE set-piece (see DESERT-LESSON3-PLAN.md): a massive hidden pyramid
// sleeps under the sand. Carry the Atlantis sanctum crystal (GIZA_CRYSTAL) here and
// step on the buried marker to RAISE it in a cutscene (camera pan + shaking + a slow
// emerge-from-the-ground with dirt shedding off and fading). Once risen it stays
// risen (progress.isPyramidRisen). The pyramid sprite is tile-composed by
// tools/gen_pyramid.py (pyramid.png / pyramid-buried.png). Interior chambers +
// collision footprint are the next increment (currently the door is a sealed stub).
export default class DesertScene extends GameScene {
    private static readonly EXIT = { x: 40, y: 49 };
    private static readonly START = { x: 40, y: 47 };

    // Pyramid placement (tile coords). base-centre = column cx, resting on row by.
    private static readonly PYRAMID = { cx: 40, by: 22 };
    private static readonly MARKER = { x: 40, y: 24 };   // step here (with the crystal) to raise it
    private static readonly DOOR = { x: 40, y: 22 };     // sealed entrance (once risen)

    private rising = false;
    private hintedCrystal = false;

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
            // The lesson-three monument (tile-composed, two states — tools/gen_pyramid.py).
            desert_pyramid: 'pyramid', desert_pyramid_buried: 'pyramid-buried',
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
        new Door({
            scene: this, xPosition: DesertScene.EXIT.x, yPosition: DesertScene.EXIT.y,
            nextScene: SceneName.City, entryOffset: { dx: 0, dy: -1 },
        });
        drawDoorCue(this, DesertScene.EXIT.x, DesertScene.EXIT.y - 1, 'CITY', '▼');

        // North trail onward to the Jungle (level 3): a "JUNGLE ▲" pad at the top edge.
        new Door({
            scene: this, xPosition: 40, yPosition: 0,
            nextScene: SceneName.Jungle, entryOffset: { dx: 0, dy: 1 },
        });
        drawDoorCue(this, 40, 1, 'JUNGLE', '▲');

        // --- Lesson-three pyramid -------------------------------------------------
        this.ensureDirtTexture();
        if (isPyramidRisen()) {
            this.addPyramidSprite('desert_pyramid');               // already up
            drawDoorCue(this, DesertScene.DOOR.x, DesertScene.DOOR.y, 'TOMB', '▲');
        } else {
            this.buriedSprite = this.addPyramidSprite('desert_pyramid_buried');
            drawDoorCue(this, DesertScene.MARKER.x, DesertScene.MARKER.y, 'RELIC', '✦');
        }

        const sub = this.gridEngine.movementStopped().subscribe((o) => {
            if (o.charId !== this.playerName) return;
            if (GlobalInfo._gameProgress.inDialogue || this.rising) return;
            const p = this.gridEngine.getPosition(this.playerName);
            if (!isPyramidRisen()) {
                if (p.x === DesertScene.MARKER.x && p.y === DesertScene.MARKER.y) this.tryRaisePyramid();
            } else if (p.x === DesertScene.DOOR.x && p.y === DesertScene.DOOR.y) {
                showNpcDialog('The Pyramid', [
                    'The great door is sealed — bound by light and flame.',
                    'Its chambers are not yet open. (Coming soon.)',
                ]);
            }
        });
        this.events.once('shutdown', () => sub.unsubscribe());
    }

    // No wild Elementals in the desert yet — explore-only for now.
    createNpcs(): void { /* populate with desert Elementals later */ }

    // ---- pyramid helpers ---------------------------------------------------------

    private buriedSprite?: Phaser.GameObjects.Image;

    private isDev(): boolean { return /[?&](dev|debug|e2e)\b/.test(location.search); }

    /** World pixel of the pyramid base (bottom-centre, resting on the sand). */
    private pyramidBase(): { bx: number; groundY: number } {
        const tw = this.map.tileWidth, th = this.map.tileHeight;
        return { bx: DesertScene.PYRAMID.cx * tw + tw / 2, groundY: (DesertScene.PYRAMID.by + 1) * th };
    }

    private addPyramidSprite(key: string): Phaser.GameObjects.Image {
        const { bx, groundY } = this.pyramidBase();
        return this.add.image(bx, groundY, key).setOrigin(0.5, 1).setDepth(DesertScene.OVERHEAD_DEPTH);
    }

    /** A tiny white speck we tint into dirt clods for the rise particles. */
    private ensureDirtTexture(): void {
        if (this.textures.exists('pyr_dirt')) return;
        const g = this.make.graphics({ x: 0, y: 0 }, false);
        g.fillStyle(0xffffff, 1); g.fillRect(0, 0, 4, 4);
        g.generateTexture('pyr_dirt', 4, 4);
        g.destroy();
    }

    private tryRaisePyramid(): void {
        if (this.rising || isPyramidRisen()) return;
        if (!hasItem(GIZA_CRYSTAL) && !this.isDev()) {
            if (!this.hintedCrystal) {
                this.hintedCrystal = true;
                showNpcDialog('', ['The sand hums faintly here… something buried answers to a crystal you do not yet carry.']);
            }
            return;
        }
        this.rising = true;
        this.playPyramidRise();
    }

    private setDialogue(active: boolean): void {
        GlobalInfo._gameProgress.inDialogue = active;
        GlobalInfo.emit('inDialogue', active);
    }

    // The cutscene: freeze the dog, pan the camera to the site, then SHAKE the
    // pyramid up out of the ground while dirt sheds off it and fades, with tumbling
    // debris and a camera rumble. prefers-reduced-motion skips the drama.
    private playPyramidRise(): void {
        const { bx, groundY } = this.pyramidBase();
        const cam = this.cameras.main;
        this.setDialogue(true);
        this.input.enabled = false;
        this.buriedSprite?.destroy();

        const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

        const finish = (): void => {
            markPyramidRisen();
            drawDoorCue(this, DesertScene.DOOR.x, DesertScene.DOOR.y, 'TOMB', '▲');
            this.showRiseTitle();
            cam.pan(this.playerSprite.x, this.playerSprite.y, 900, 'Sine.easeInOut');
            cam.zoomTo(2.5, 900);
            this.time.delayedCall(950, () => {
                cam.startFollow(this.playerSprite, true);
                cam.setZoom(2.5);
                this.input.enabled = true;
                this.rising = false;
                this.setDialogue(false);
            });
        };

        // the risen pyramid, masked at ground level and pushed fully below it
        const pyr = this.addPyramidSprite('desert_pyramid');
        const mg = this.make.graphics({ x: 0, y: 0 }, false);
        mg.fillStyle(0xffffff, 1);
        mg.fillRect(0, 0, this.map.widthInPixels, groundY);
        pyr.setMask(mg.createGeometryMask());
        const fullH = pyr.height;
        pyr.y = groundY + fullH;                 // entirely under the sand (masked out)

        if (reduce) {                            // no motion: just settle it up
            pyr.y = groundY;
            finish();
            return;
        }

        cam.stopFollow();
        cam.pan(bx, groundY - 120, 1200, 'Sine.easeInOut');
        cam.zoomTo(1.35, 1200);

        const RISE = 4800;
        this.time.delayedCall(900, () => {
            cam.shake(600, 0.006);                // a brief jolt as it breaks ground; the pyramid's
                                                  // own jitter (below) carries the "shaking" from there
                                                  // — lighter on weak GPUs than a 5s full-screen shake.
            const jitter = this.tweens.add({ targets: pyr, x: { from: bx - 3, to: bx + 3 }, duration: 55, yoyo: true, repeat: -1 });

            const mgr = this.add.particles('pyr_dirt');
            mgr.setDepth(DesertScene.OVERHEAD_DEPTH + 1);
            const emitter = mgr.createEmitter({
                x: { min: bx - 170, max: bx + 170 },
                y: { min: groundY - 8, max: groundY + 6 },
                lifespan: { min: 420, max: 950 },
                speed: { min: 30, max: 160 },
                angle: { min: 200, max: 340 },    // up-and-outward, then gravity takes over
                gravityY: 440,
                scale: { start: 1.5, end: 0.3 },
                alpha: { start: 0.95, end: 0 },   // phase out into nothing
                tint: [0x6b4a2a, 0x8a5a2e, 0x4e3620, 0xb07b3f],
                rotate: { min: 0, max: 360 },
                frequency: 55,                    // thinned so weak GPUs aren't overdrawing dust
                quantity: 1,
                maxParticles: 220,
            });

            // chunkier debris popping off the seam and tumbling away
            const debris = ['desert_boulder_2', 'desert_shrub_2'];
            this.time.addEvent({
                delay: 450, repeat: Math.floor(RISE / 450) - 1, callback: () => {
                    const d = this.add.image(bx + Phaser.Math.Between(-150, 150), groundY + Phaser.Math.Between(-8, 4),
                        Phaser.Utils.Array.GetRandom(debris))
                        .setDepth(DesertScene.OVERHEAD_DEPTH + 1).setScale(Phaser.Math.FloatBetween(0.5, 1.0));
                    this.tweens.add({
                        targets: d, y: d.y + Phaser.Math.Between(26, 80), x: d.x + Phaser.Math.Between(-45, 45),
                        angle: Phaser.Math.Between(-200, 200), alpha: 0,
                        duration: Phaser.Math.Between(700, 1200), ease: 'Quad.easeIn',
                        onComplete: () => d.destroy(),
                    });
                },
            });

            this.tweens.add({
                targets: pyr, y: groundY, duration: RISE, ease: 'Sine.easeOut',
                onComplete: () => {
                    jitter.stop(); pyr.x = bx;
                    emitter.stop();
                    this.time.delayedCall(1200, () => mgr.destroy());
                    cam.shake(320, 0.014);        // a final settling thud
                    this.time.delayedCall(420, finish);
                },
            });
        });
    }

    private showRiseTitle(): void {
        const cam = this.cameras.main;
        const t = this.add.text(cam.width / 2, cam.height * 0.16,
            'A forgotten pyramid rises from the sand…',
            { fontFamily: 'monospace', fontSize: '15px', color: '#fff3d6', stroke: '#3a2410', strokeThickness: 4, align: 'center' })
            .setOrigin(0.5).setScrollFactor(0).setDepth(9999).setAlpha(0);
        this.tweens.add({ targets: t, alpha: 1, duration: 600, yoyo: true, hold: 1900, onComplete: () => t.destroy() });
    }

    update(): void {
        super.update();
    }
}
