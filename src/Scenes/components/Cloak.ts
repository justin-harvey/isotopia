import GameScene from '../GameScene';

// Elementals are *cloaked*: they hang at the edge of visibility and glitch like a
// bad signal, so spotting one by eye is hard on purpose. The Rad Finder (the DEX
// "Track" arrow) is how you're meant to home in — the cloak turns the hunt into
// chasing a ghost in the static. As the dog closes within a tile or two the
// creature phases a little further into view: the "gotcha" as the finder goes hot.
// (The proximity trigger fires within one tile regardless, so a fully-cloaked one
// is still always catchable — you can walk onto it even if you never see it.)
//
// Everything here only touches alpha / tint / flipX — properties grid-engine never
// writes — so it can't fight the movement system. Stationary Elementals keep their
// tile; we just haunt the pixels. Discontinuous per-tick jumps (not a smooth tween)
// are what make it read as a glitch. Respects prefers-reduced-motion.

interface CloakOpts {
    // Tile the Elemental sits on, so we can phase it in as the player closes in.
    tileX: number;
    tileY: number;
    // Placeholder Elementals carry a solid element tint; real-art ones don't. We
    // restore to this between glitch frames instead of blindly clearing the tint.
    baseTint?: number;
}

const CLOAK = {
    baseAlpha: 0.16,      // resting "…is something there?" visibility
    glitchAlpha: 0.44,    // a glitch frame stutters brighter for an instant
    vanishAlpha: 0.03,    // …then sometimes drops out almost entirely
    nearAlpha: 0.5,       // within nearTiles it phases further in (finder is hot)
    nearTiles: 2,
    tickMs: 90,           // glitch cadence (discontinuous = glitchy, unlike a tween)
    glitchChance: 0.22,   // portion of ticks that flare into a glitch frame
    vanishChance: 0.12,   // portion of ticks that drop out
    flipChance: 0.35,     // mirror-tear on a glitch frame
    chroma: [0x8fefff, 0xff8fe4], // chromatic-aberration flicker (cyan / magenta)
    reducedAlpha: 0.3,    // reduce-motion: one steady faint alpha, no flicker
};

// Make an Elemental's sprite hard to spot: faint + glitchy, phasing in up close.
export function cloakElemental(
    scene: GameScene,
    sprite: Phaser.GameObjects.Sprite,
    opts: CloakOpts,
): void {
    const restoreTint = (): void => {
        if (opts.baseTint === undefined) sprite.clearTint();
        else sprite.setTint(opts.baseTint);
    };

    // Reduce-motion: no flicker loop (matches the battle-wipe / HUD-pulse policy).
    // Hold one faint alpha — a touch more visible, since without motion to catch
    // the eye it would otherwise be unfair to find.
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (reduce) {
        sprite.setAlpha(CLOAK.reducedAlpha);
        return;
    }

    sprite.setAlpha(CLOAK.baseAlpha);

    scene.time.addEvent({
        delay: CLOAK.tickMs,
        loop: true,
        callback: () => {
            if (!sprite.active) return;

            // Phase in when the dog is close — the Rad Finder's payoff moment.
            let near = false;
            if (scene.gridEngine.hasCharacter(scene.playerName)) {
                const p = scene.gridEngine.getPosition(scene.playerName);
                const d = Math.max(Math.abs(p.x - opts.tileX), Math.abs(p.y - opts.tileY));
                near = d <= CLOAK.nearTiles;
            }

            const r = Math.random();
            if (r < CLOAK.vanishChance) {
                // Dropout: gone but for a ghost.
                sprite.setAlpha(CLOAK.vanishAlpha);
                sprite.setFlipX(false);
                restoreTint();
            } else if (r < CLOAK.vanishChance + CLOAK.glitchChance) {
                // Glitch frame: brief brighter stutter + chroma shift + maybe a tear.
                sprite.setAlpha(near ? CLOAK.nearAlpha + 0.15 : CLOAK.glitchAlpha);
                sprite.setTint(CLOAK.chroma[Math.random() < 0.5 ? 0 : 1]);
                sprite.setFlipX(Math.random() < CLOAK.flipChance);
            } else {
                // Resting: hardly there, with a little alpha jitter so it never
                // sits perfectly still (a dead-still faint sprite reads as a bug).
                const jitter = (Math.random() - 0.5) * 0.06;
                sprite.setAlpha((near ? CLOAK.nearAlpha : CLOAK.baseAlpha) + jitter);
                sprite.setFlipX(false);
                restoreTint();
            }
        },
    });
}
