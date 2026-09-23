import { LayerType } from './enums/LayerType';
import { Tilemaps } from 'phaser'
import { createMap } from './components/TileMap'
import { NpcsAndObjects, createCharacterSprite } from './components/NpcAndObjects'
import GlobalInfo from '../GlobalInfo'
import { GridEngine, Position, Direction, CollisionStrategy } from 'grid-engine'
import { basicMovement, clickToMove } from './components/Characters'
import { Npc } from './components/Npc'
import { getElement, ELEMENTS } from '../data/elements'
import { statusOf } from '../data/progress'
import { elementalArtKey, elementalArtPath } from '../data/elementalArt'
import { elementReleased } from '../data/classConfig'
import { startBattle } from '../ui/QuizOverlay'
import { showNpcDialog } from '../ui/NpcDialog'
import { isRadFinderEquipped, setRadReading } from '../ui/RadFinder'

// Real Elemental art is a big single image; this scale reads it down to roughly
// character size on the grid (the placeholder NPC spritesheet uses ~0.7).
const ELEMENTAL_ART_SCALE = 0.05

// 8-way arrow from a tile delta (dx east-positive, dy south-positive in grid
// coords). Used by the Rad Finder to point toward the nearest Elemental.
function compass(dx: number, dy: number): string {
    if (dx === 0 && dy === 0) return '⚛'
    const ns = dy < 0 ? 'N' : dy > 0 ? 'S' : ''
    const ew = dx < 0 ? 'W' : dx > 0 ? 'E' : ''
    const arrows: Record<string, string> = {
        N: '↑', S: '↓', E: '→', W: '←', NE: '↗', NW: '↖', SE: '↘', SW: '↙',
    }
    return arrows[ns + ew] || '⚛'
}

export default abstract class GameScene extends Phaser.Scene {

    // Grid Engine info
    gridEngine!: GridEngine;
    gridEngineSettings: {
        startPosition: {
            x: number;
            y: number;
        };
        scale: number;
        characterCollisionStrategy: CollisionStrategy;
        layerOverlay: boolean;
    };

    // direction keys
    cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

    // action keys to use main player habilities
    keyA: Phaser.Input.Keyboard.Key;
    keyS: Phaser.Input.Keyboard.Key;
    keyD: Phaser.Input.Keyboard.Key;
    keyR: Phaser.Input.Keyboard.Key;

    // menu keys
    backKey!: Phaser.Input.Keyboard.Key;

    // main player
    playerSprite!: Phaser.Physics.Arcade.Sprite;
    playerName!: string;
    avatarScale: number = 0.15;

    // action sounds
    bark: Phaser.Sound.BaseSound;
    sniff: Phaser.Sound.BaseSound;

    sceneName!: string;
    map!: Tilemaps.Tilemap;
    npcsAndObjectsArray: NpcsAndObjects[] = [];
    characterMoved: boolean = false;

    // Rad Finder: fixed-position Elementals spawned in this scene (release-gated),
    // and the last player tile we computed a reading for (so update() only
    // recomputes on a tile change, not every frame).
    elementalTargets: { elementId: string; x: number; y: number }[] = [];
    private rfLastMs = 0;

    // to load images
    imageNames!: {
        Map: string, //map is mandatory for the scene
        [index: string]: string
    };
    imageMapDefaultPath: string;
    tilemapJSONPath!: string;
    // Embedded Tiled map data (set by scenes from src/data/maps.ts). When set, the
    // map loads from here instead of an XHR fetch, so the game runs offline from a
    // plain file:// (double-click) with no web server.
    mapData?: object;
    layerNames: LayerType[];
    imageMapNames!: {
        [index: string]: {
            name: string;
            path?: string;
        };
    };

    constructor(
        name: string,
        xPos?: number,
        yPos?: number,
        layerNames?: LayerType[]) {
        super(name);
        this.sceneName = name
        this.playerName = `${name}_perli`
        this.imageMapDefaultPath = 'tilesets/'
        this.layerNames = layerNames || Object.values(LayerType)
        this.gridEngineSettings = {
            startPosition: {
                x: xPos ?? 1,
                y: yPos ?? 1
            },
            scale: 1,
            characterCollisionStrategy: CollisionStrategy.BLOCK_ONE_TILE_AHEAD,
            layerOverlay: false
        }
    }

    // load here images and sounds common in all scenes
    preload(): void {
        this.load.image('emptyDoorGraphic', 'assets/images/emptyDoorGraphic.png')
        this.load.audio('bark', 'assets/music/bark.wav');
        this.load.audio('sniff', 'assets/music/sniffing.wav');
    }

    create(): void {
        // asign logic to keys
        this.cursors = this.input.keyboard.createCursorKeys()
        this.backKey = this.input.keyboard.addKey('ESC')
        this.keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
        this.keyS = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
        this.keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
        this.keyR = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);

        // add sounds
        this.bark = this.sound.add('bark', { loop: false });
        this.sniff = this.sound.add('sniff', { loop: false });

        //add special animations for actions from main player
        createSpecialAnimations(this)

        // create map, npcs, objects and start grid engine
        this.createMap();
        this.initiateGridEngine();
        this.createCamera(this.map.widthInPixels, this.map.heightInPixels);
        // Scenes are reused across switch/restart, so clear last run's targets
        // before createNpcs() (which calls spawnElemental) repopulates them.
        this.elementalTargets = [];
        this.rfLastMs = 0;
        this.createNpcs();
        basicMovement(this);
        clickToMove(this);
        NpcsAndObjects.interaction(this)

        // stop animations like bark or sniff when player starts to move
        this.gridEngine.movementStarted().subscribe(() => {
            this.playerSprite.anims.stop();
        });

        // iOS Safari blocks audio until a user gesture — unlock on the first tap
        // so the bark/sniff sounds actually play on an iPad. (NoAudioSoundManager
        // has no unlock(), hence the guard.)
        this.input.once('pointerdown', () => {
            const sm = this.sound as unknown as { locked?: boolean; unlock?: () => void };
            if (sm.locked && typeof sm.unlock === 'function') sm.unlock();
        });
    }

    update(): void {
        this.refreshRadFinder();

        // code to set habilities
        if (Phaser.Input.Keyboard.JustDown(this.keyA)) {
            /* uncomment this to use it as a hint to see the tile where player is placed ingame */
            // console.log(`facingPosition: (${this.gridEngine.getFacingPosition(this.playerName).x
            //     }, ${this.gridEngine.getFacingPosition(this.playerName).y})`);

            this.bark.play();
            this.gridEngine.getFacingDirection(this.playerName) === "right"
                ? this.playerSprite.anims.play("barkingRight", true)
                : this.playerSprite.anims.play("barking", true);
        };

        if (Phaser.Input.Keyboard.JustDown(this.keyS)) {
            console.log("sit");
            this.gridEngine.getFacingDirection(this.playerName) === "right"
                ? this.playerSprite.anims.play("sitRight", true)
                : this.playerSprite.anims.play("sit", true);
        };

        if (Phaser.Input.Keyboard.JustDown(this.keyD)) {
            console.log("sniff");
            this.sniff.play();
            this.gridEngine.getFacingDirection(this.playerName) === "right"
                ? this.playerSprite.anims.play("sniffRight", true)
                : this.playerSprite.anims.play("sniff", true);
        };

        // TODO: fix this to keep player running
        if (Phaser.Input.Keyboard.JustDown(this.keyR)) {
            this.gridEngine.setSpeed(this.playerName, 7);
        }

        if (Phaser.Input.Keyboard.JustUp(this.keyR)) {
            this.gridEngine.setSpeed(this.playerName, 4)
        };
    }

    // Rad Finder reading for the current room: nearest UNCAUGHT, released target to
    // the player, plus a global count so the HUD can say "look elsewhere". Only
    // recomputes when the player's tile changes (or when forced) to stay cheap.
    refreshRadFinder(): void {
        if (!isRadFinderEquipped() || !this.gridEngine) return
        const now = performance.now()
        if (now - this.rfLastMs < 250) return   // ~4 readings/sec, catches DOM cost
        this.rfLastMs = now
        const p = this.gridEngine.getPosition(this.playerName)

        const live = this.elementalTargets.filter(t => statusOf(t.elementId) !== 'caught')
        let nearest: { d: number; dx: number; dy: number } | null = null
        for (const t of live) {
            const dx = t.x - p.x, dy = t.y - p.y
            const d = Math.max(Math.abs(dx), Math.abs(dy))   // Chebyshev tiles
            if (!nearest || d < nearest.d) nearest = { d, dx, dy }
        }
        const totalUndiscovered = ELEMENTS.filter(
            e => elementReleased(e.id) && statusOf(e.id) !== 'caught').length

        setRadReading({
            targetsInRoom: live.length,
            nearestDist: nearest ? nearest.d : null,
            dir: nearest ? compass(nearest.dx, nearest.dy) : null,
            totalUndiscovered,
        })
    }

    // used in scenes to load objects images
    abstract loadObjectImages(): void

    // used by scenes to create NPCS
    abstract createNpcs(): void

    /** Not a standard method of Phaser.Scene.
     * Resets the scene completely.
     * Needed because of own implementations like the npcsAndObjectsArray.
     */
    reset(
        /** If set to true, the position and orientation of the player character will be kept. */
        keepCharacterPosition: boolean = true,
    ): void {
        const oldPosition: Position = this.gridEngine.getPosition(this.playerName)
        const oldDirection: Direction = this.gridEngine.getFacingDirection(this.playerName)

        this.npcsAndObjectsArray = []
        this.gridEngine.removeAllCharacters()
        this.scene.restart()
        /* updates scene manager to restart immediately
           (always restarts with next scene manager update)
          */
        this.scene.manager.update(0, 0)
        if (keepCharacterPosition) {
            this.gridEngine.setPosition(this.playerName, oldPosition)
            this.gridEngine.turnTowards(this.playerName, oldDirection)
        }
    }

    // load the main character
    loadAvatarSpritesheet(): void {
        this.load.spritesheet(this.imageNames.Perli,
            'assets/Characters/Perli.png',
            { frameWidth: 198, frameHeight: 188 }
        );
    }

    // Queue the real art PNGs for the given Elementals (skips ones with no art
    // and ones already cached). Call from a scene's loadObjectImages().
    loadElementalArt(elementIds: string[]): void {
        elementIds.forEach(id => {
            const key = elementalArtKey(id)
            if (key && !this.textures.exists(key)) {
                this.load.image(key, elementalArtPath(id))
            }
        })
    }

    // Spawn one Elemental at a tile: real character art if it has any, otherwise
    // the tinted placeholder NPC. Walking within one tile opens its quiz
    // automatically (no key press — see NpcsAndObjects proximity logic). No
    // floating label — the art speaks for itself (labels broke immersion).
    spawnElemental(elementId: string, x: number, y: number): void {
        const element = getElement(elementId)
        if (!element) return
        if (!elementReleased(elementId)) return   // hidden until its release day
        const artKey = elementalArtKey(elementId)

        const npc = new Npc({
            scene: this,
            xPosition: x,
            yPosition: y,
            texture: artKey ?? this.imageNames.Veterinary,
            scale: artKey ? ELEMENTAL_ART_SCALE : 0.7,
            tint: artKey ? undefined : element.tint,
            action: () => { startBattle(elementId) },
            // Real art is a single frame → no walking animation mapping.
            walkingAnimationMapping: artKey ? undefined : 0,
        })
        // Open the quiz on proximity rather than on an interact key.
        npc.proximityTrigger = true
        // Register as a Rad Finder target so the tool can home in on it.
        this.elementalTargets.push({ elementId, x, y })
    }

    // A flavor NPC with real art that just wanders the map — no quiz, no plot.
    // Used for Neonu Reeves, the disco bug who simply exists. Single-frame art,
    // so no walking-animation mapping (see Npc.addCharacter).
    spawnWanderingNpc(textureKey: string, x: number, y: number): void {
        const npc = new Npc({
            scene: this,
            xPosition: x,
            yPosition: y,
            texture: textureKey,
            scale: ELEMENTAL_ART_SCALE,
        })
        // delay(ms) between hops, wandering within `radius` tiles of the start.
        this.gridEngine.moveRandomly(npc.name, 2000, 2)
    }

    // A city pedestrian: a human character from the NPC sheet (grid-engine's
    // standard 3x4 layout — `charIndex` picks which person) who wanders the
    // nearby streets. grid-engine's random movement respects collision, so they
    // keep to the pavement and never walk through buildings.
    spawnPedestrian(charIndex: number, x: number, y: number, radius: number = 3): void {
        const npc = new Npc({
            scene: this,
            xPosition: x,
            yPosition: y,
            texture: this.imageNames.Veterinary,
            scale: 0.35,
            walkingAnimationMapping: charIndex,
        })
        this.gridEngine.moveRandomly(npc.name, 1500, radius)
    }

    // A stationary city character who says a line or two when the player walks up
    // (proximity), then re-arms once they step away. Reuses the NPC dialog box.
    spawnTalkingNpc(charIndex: number, x: number, y: number, speaker: string, lines: string[]): void {
        const npc = new Npc({
            scene: this,
            xPosition: x,
            yPosition: y,
            texture: this.imageNames.Veterinary,
            scale: 0.35,
            walkingAnimationMapping: charIndex,
            action: () => {
                npc.proximityTrigger = false
                showNpcDialog(speaker, lines, () => { npc.proximityTrigger = true })
            },
        })
        npc.proximityTrigger = true
    }

    // A companion NPC: walk up to it to trigger a one-time dialog, after which it
    // becomes a follower that trails the player around the scene. Used for Neonu
    // Reeves in the woods. Single-frame art → no walking-animation mapping.
    spawnCompanionNpc(textureKey: string, x: number, y: number, speaker: string, lines: string[]): void {
        const npc = new Npc({
            scene: this,
            xPosition: x,
            yPosition: y,
            texture: textureKey,
            scale: ELEMENTAL_ART_SCALE,
            action: () => {
                // Talk once, then befriend: disarm the proximity trigger so the
                // dialog can't re-fire while he's tagging along.
                npc.proximityTrigger = false
                showNpcDialog(speaker, lines, () => {
                    this.gridEngine.follow(npc.name, this.playerName, 1, true)
                })
            },
        })
        // Walk within one tile to start the dialog (same as an Elemental).
        npc.proximityTrigger = true
    }

    // Pokémon-style random encounters: whenever the player comes to rest on a
    // tall-grass tile there's a `chance` of a wild Elemental (drawn from `pool`)
    // ambushing them — the same battle wipe + quiz as a walk-up encounter. Grass
    // is on the `walls` layer (walkable, no collision), so we read that layer's
    // tile at the player's tile and match its GID against the grass GIDs.
    enableGrassEncounters(pool: string[], grassGids: number[], chance: number = 0.15): void {
        const grass = new Set(grassGids)
        const sub = this.gridEngine.movementStopped().subscribe((observer) => {
            if (observer.charId !== this.playerName) return
            if (GlobalInfo._gameProgress.inDialogue) return
            const p = this.gridEngine.getPosition(this.playerName)
            const tile = this.map.getTileAt(p.x, p.y, false, LayerType.Walls)
            if (!tile || !grass.has(tile.index)) return
            if (Math.random() > chance) return
            // Only wild Elementals that have been released can appear.
            const available = pool.filter(elementReleased)
            if (available.length === 0) return
            const id = available[Math.floor(Math.random() * available.length)]
            startBattle(id)
        })
        this.events.once('shutdown', () => sub.unsubscribe())
    }

    // load map resources
    loadMapImages(): void {
        // Tilemap-Bilder laden
        Object.keys(this.imageMapNames).forEach(key => {
            // Use image-specific path, if defined; otherwise use default path
            const path = (this.imageMapNames[key].path != null) ? this.imageMapNames[key].path : this.imageMapDefaultPath

            this.load.image(
                this.imageMapNames[key].name,
                `${path ?? ''}${this.imageMapNames[key].name}.png`)
        })

        // Only fetch the map over the network if a scene didn't embed it.
        if (!this.mapData) {
            this.load.tilemapTiledJSON(this.imageNames.Map, this.tilemapJSONPath)
        }
    }

    // prepare tilesets and create the map
    createMap(): void {
        // Embedded map (offline) → seed the tilemap cache so make.tilemap finds
        // it by key, exactly as load.tilemapTiledJSON would have after fetching.
        if (this.mapData && !this.cache.tilemap.exists(this.imageNames.Map)) {
            this.cache.tilemap.add(this.imageNames.Map, {
                format: Phaser.Tilemaps.Formats.TILED_JSON,
                data: this.mapData,
            })
        }
        const tilesetInfo = Object.keys(this.imageMapNames).map(key => {
            return {
                tilesetName: this.imageMapNames[key].name,
                image: (this.imageMapNames[key].name)
            }
        })

        this.map = createMap({
            scene: this, tilemapTiledJSONKey: this.imageNames.Map, tilesetInfo: tilesetInfo, layerNames: this.layerNames
        }).tilemap
    }

    // GridEngine methods should only be used after this method was called!**
    initiateGridEngine(): void {
        this.playerSprite = createCharacterSprite(this, 0, 0, this.imageNames.Perli, this.avatarScale)
        const gridEngineConfig = {
            characters: [
                {
                    id: this.playerName,
                    sprite: this.playerSprite,
                    startPosition: this.gridEngineSettings.startPosition,
                    // you can use this to set custom walking animations, or use the default
                    walkingAnimationMapping: {
                        up: {
                            leftFoot: 25,
                            standing: 24,
                            rightFoot: 26,
                        },
                        down: {
                            leftFoot: 29,
                            standing: 28,
                            rightFoot: 30,
                        },
                        left: {
                            leftFoot: 9,
                            standing: 8,
                            rightFoot: 11,
                        },
                        right: {
                            leftFoot: 13,
                            standing: 12,
                            rightFoot: 15,
                        },
                    },
                },
            ],
            layerOverlay: this.gridEngineSettings.layerOverlay,
            characterCollisionStrategy: this.gridEngineSettings.characterCollisionStrategy
        }
        this.gridEngine.create(this.map, gridEngineConfig)
    }

    // create cameras
    createCamera(boundLimitX: number, boundLimitY: number): void {
        // add camera that follows the character
        this.cameras.main.setBounds(0, 0, boundLimitX, boundLimitY);
        this.cameras.main.startFollow(this.playerSprite, true);
        this.cameras.main.setZoom(2.5)
    }

    switch(key: string | Phaser.Scene): void {
        this.scene.scene.sound.stopAll()
        this.scene.switch(key)
    }
}

// To create special animations (not necessary for walking animations)
function createPlayerAnimation(name: string, startFrame: number, endFrame: number, repeat?: number) {
    this.anims.create({
        key: name,
        frames: this.anims.generateFrameNumbers(this.playerName, {
            start: startFrame,
            end: endFrame,
        }),
        frameRate: 4,
        repeat: repeat ?? -1,
        yoyo: true,
    });
}

// to create all special animations
function createSpecialAnimations(_this: GameScene) {
    createPlayerAnimation.call(_this, "barking", 20, 21, 0);
    createPlayerAnimation.call(_this, "barkingRight", 22, 23, 0);
    createPlayerAnimation.call(_this, "sit", 17, 17, 0);
    createPlayerAnimation.call(_this, "sitRight", 16, 16, 0);
    createPlayerAnimation.call(_this, "sniff", 0, 2, 2);
    createPlayerAnimation.call(_this, "sniffRight", 4, 6, 2);
}