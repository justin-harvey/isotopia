// A silly companion-bird flock. While the player is wearing a flying avatar (the gull or
// pigeon — any CharacterDef with a `fly` frame map), pressing S spawns another bird, up to
// SIX. On the ground they mill about in a loose group around you; the moment you take flight
// (F / tap-yourself) they snap into a trailing V formation and soar along with you.
//
// These birds are purely cosmetic: plain Phaser sprites moved by hand each frame, NOT
// grid-engine characters. That keeps them off the collision grid (they never block the
// player or trip proximity triggers) and lets us place them with sub-tile precision for the
// formation + give them their own depth so a bird in flight renders in FRONT of every map
// object (tree canopies, buildings, overheads — all sit at OVERHEAD_DEPTH ≈ 20).

import 'phaser';
import type GameScene from '../GameScene';
import { createCharacterSprite } from './NpcAndObjects';
import type { CharacterDef, WalkMap } from '../../data/characters';

export const MAX_BIRDS = 6;
// Airborne birds draw well above everything on the canvas (map overheads top out ~20); the
// DOM HUD is a separate layer, so this only stacks them above world art. The player gets the
// same depth while flying so the whole flock soars over the canopy together.
export const FLY_DEPTH = 1000;
const GROUND_DEPTH = 10;   // same plane as the player/NPCs when walking

interface Bird {
    sprite: Phaser.GameObjects.Sprite;
    wanderX: number;        // current ground-wander offset from the player (px)
    wanderY: number;
    nextWander: number;     // time.now (ms) at which to pick a new wander offset
    phase: number;          // per-bird bob phase so they don't bob in lockstep
    dir: string;            // last facing used, so idle birds keep a sensible pose
}

interface FlockState {
    flying: boolean;
    def: CharacterDef;      // the player's current bird avatar (fly map guaranteed)
    px: number;             // player sprite world position
    py: number;
    facing: string;         // player facing direction ('up'|'down'|'left'|'right')
}

export class BirdFlock {
    private scene: GameScene;
    private birds: Bird[] = [];

    constructor(scene: GameScene) { this.scene = scene; }

    get count(): number { return this.birds.length; }

    // Add one more companion bird (up to MAX_BIRDS), matching the player's current bird
    // avatar. No-op if the player isn't wearing a flyer or the flock is already full.
    // Returns true if a bird was actually spawned.
    spawn(def: CharacterDef, px: number, py: number): boolean {
        if (!def.fly || !def.textureKey || this.birds.length >= MAX_BIRDS) return false;
        const angle = Math.random() * Math.PI * 2;
        const r = 16 + Math.random() * 12;
        const sprite = createCharacterSprite(this.scene, px + Math.cos(angle) * r, py + Math.sin(angle) * r, def.textureKey, def.scale);
        sprite.setDepth(GROUND_DEPTH);
        this.birds.push({
            sprite,
            wanderX: Math.cos(angle) * r,
            wanderY: Math.sin(angle) * r,
            nextWander: 0,
            phase: Math.random() * Math.PI * 2,
            dir: 'down',
        });
        return true;
    }

    // Move + animate every bird for this frame. Ground = loose wandering cluster; flight =
    // a trailing V behind the player, lifted off the ground and drawn above all map art.
    update(s: FlockState): void {
        if (this.birds.length === 0) return;
        const now = this.scene.time.now;
        // Spacing unit from the on-screen bird size, so the formation scales with the art.
        const base = Math.max(14, this.birds[0].sprite.displayHeight);
        const f = forward(s.facing);
        const back = { x: -f.x, y: -f.y };
        const perp = { x: -f.y, y: f.x };   // 90° from forward, for the two V arms

        this.birds.forEach((b, i) => {
            let tx: number, ty: number, lerp: number;
            if (s.flying) {
                // V formation: player is the apex, birds alternate onto the left/right arm,
                // each rank one step further back and out. Ranks run 1,1,2,2,3,3 for six.
                const side = (i % 2 === 0) ? -1 : 1;
                const rank = Math.floor(i / 2) + 1;
                const spacing = base * 1.15;
                tx = s.px + (back.x + perp.x * side) * spacing * rank;
                ty = s.py + (back.y + perp.y * side) * spacing * rank;
                ty -= base * 0.45;   // ride a touch above the player's feet while airborne
                lerp = 0.14;
            } else {
                // Ground: drift to a fresh random offset near the player every ~1-2.5s so the
                // group keeps milling about instead of freezing into a clump.
                if (now >= b.nextWander) {
                    const a = Math.random() * Math.PI * 2;
                    const rr = 10 + Math.random() * 28;
                    b.wanderX = Math.cos(a) * rr;
                    b.wanderY = Math.sin(a) * rr;
                    b.nextWander = now + 900 + Math.random() * 1600;
                }
                tx = s.px + b.wanderX;
                ty = s.py + b.wanderY;
                lerp = 0.045;
            }

            // Gentle vertical bob — faster + deeper in flight (wingbeats), subtle on the ground.
            ty += Math.sin(now / (s.flying ? 140 : 320) + b.phase) * base * (s.flying ? 0.18 : 0.07);

            const nx = Phaser.Math.Linear(b.sprite.x, tx, lerp);
            const ny = Phaser.Math.Linear(b.sprite.y, ty, lerp);
            const dx = nx - b.sprite.x, dy = ny - b.sprite.y;
            b.sprite.setPosition(nx, ny);
            b.sprite.setDepth(s.flying ? FLY_DEPTH + 1 + i : GROUND_DEPTH);

            // Facing: whole flock faces the way you fly; on the ground, face their drift.
            let dir: string;
            if (s.flying) dir = s.facing;
            else if (Math.hypot(dx, dy) > 0.25)
                dir = Math.abs(dx) > Math.abs(dy) ? (dx >= 0 ? 'right' : 'left') : (dy >= 0 ? 'down' : 'up');
            else dir = b.dir;
            b.dir = dir;

            this.animate(b, s.def, dir, s.flying, Math.hypot(dx, dy) > 0.25);
        });
    }

    // Remove the whole flock (player re-skinned to a non-bird, or scene shutdown).
    clear(): void {
        this.birds.forEach(b => b.sprite.destroy());
        this.birds = [];
    }

    // Play the right walk/fly cycle for a bird's facing. Birds in flight always flap; on the
    // ground they animate only while actually moving, otherwise settle on the standing frame.
    private animate(b: Bird, def: CharacterDef, dir: string, flying: boolean, moving: boolean): void {
        const group: Group = dir === 'up' ? 'up' : dir === 'down' ? 'down' : 'side';
        // The birds' single side row is drawn facing right (mirror:'right'), so flip for left.
        b.sprite.setFlipX(dir === 'left');
        if (flying || moving) {
            const key = this.ensureAnim(def, group, flying);
            if (b.sprite.anims.currentAnim?.key !== key || !b.sprite.anims.isPlaying) {
                b.sprite.anims.play(key, true);
            }
        } else {
            b.sprite.anims.stop();
            b.sprite.setFrame(rowFor(def.walk, group).standing);
        }
    }

    // Build (once) and name the looping walk/fly animation for a direction group. Keyed by
    // texture so the gull and pigeon don't share frames in the global anim store, and by
    // walk-vs-fly + group so each facing gets its own cycle. (Mirrors ensureFlapAnim's keying.)
    private ensureAnim(def: CharacterDef, group: Group, flying: boolean): string {
        const map = flying ? def.fly! : def.walk;
        const row = rowFor(map, group);
        const key = `flock_${def.textureKey}_${flying ? 'fly' : 'walk'}_${group}`;
        if (!this.scene.anims.exists(key)) {
            // Fly poses are a 4-frame flap running from the standing frame (cols 4-7 of the
            // sheet row); the walk cycle steps standing → left → standing → right.
            const frames = flying
                ? [row.standing, row.standing + 1, row.standing + 2, row.standing + 3]
                : [row.standing, row.leftFoot, row.standing, row.rightFoot];
            this.scene.anims.create({
                key,
                frames: this.scene.anims.generateFrameNumbers(def.textureKey!, { frames }),
                frameRate: flying ? 8 : 6,
                repeat: -1,
            });
        }
        return key;
    }
}

type Group = 'up' | 'down' | 'side';

// 'side' uses the right-facing row (flipped for left by faceFlip/setFlipX).
function rowFor(map: WalkMap, group: Group) {
    return group === 'up' ? map.up : group === 'down' ? map.down : map.right;
}

// Unit vector for a facing direction in screen space (south is +y, as on the grid).
function forward(facing: string): { x: number; y: number } {
    switch (facing) {
        case 'up': return { x: 0, y: -1 };
        case 'down': return { x: 0, y: 1 };
        case 'left': return { x: -1, y: 0 };
        default: return { x: 1, y: 0 };   // right
    }
}
