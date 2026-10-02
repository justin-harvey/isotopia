// Which Elementals have real character art (in src/assets/elementals/<id>.png).
// Elements not listed here still work — they render as a tinted placeholder NPC.
// Keep the filenames in sync with the copies under src/assets/elementals/.
const ART_IDS = new Set<string>([
    'hydrogen', 'carbon', 'oxygen', 'sodium',
    'iron', 'neon', 'uranium', 'magnesium', 'nitrogen',
    // 2026-09 art drop
    'helium', 'beryllium', 'boron', 'fluorine', 'aluminum', 'sulfur', 'scandium',
    // Flame-test Elementals — currently PLACEHOLDER art (little flame creatures in each
    // element's flame colour, tools/gen_placeholder_elementals.py). Real art still wanted
    // (see ART-NEEDED.md); replacing <id>.png swaps it in with no code change.
    'potassium', 'copper', 'barium', 'lithium', 'strontium', 'calcium',
    // 3p-block fill-ins (jungle Lesson Two) — real Gemini art, orange bg stripped.
    'silicon', 'phosphorus', 'chlorine', 'argon',
]);

/** Texture cache key for an Elemental's art, or undefined if it has no art. */
export function elementalArtKey(id: string): string | undefined {
    return ART_IDS.has(id) ? `elemental_${id}` : undefined;
}

/** Load path (relative to the scene HTML) for an Elemental's art PNG. */
export function elementalArtPath(id: string): string {
    return `assets/elementals/${id}.png`;
}
