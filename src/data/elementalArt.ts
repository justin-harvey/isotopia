// Which Elementals have real character art (in src/assets/elementals/<id>.png).
// Elements not listed here still work — they render as a tinted placeholder NPC.
// Keep the filenames in sync with the copies under src/assets/elementals/.
const ART_IDS = new Set<string>([
    'hydrogen', 'carbon', 'oxygen', 'sodium',
    'iron', 'neon', 'uranium', 'magnesium', 'nitrogen',
    // 2026-09 art drop
    'helium', 'beryllium', 'boron', 'fluorine', 'aluminum', 'sulfur', 'scandium',
    // ⚠️ HIGH-PRIORITY ART NEEDED — the flame-test Elementals (potassium, copper,
    // barium, lithium, strontium, calcium) are deliberately NOT listed yet: they have
    // no PNG, so they render as tinted placeholders. Drop art in src/assets/elementals/
    // (<id>.png, background removed) and add each id above. See ART-NEEDED.md.
]);

/** Texture cache key for an Elemental's art, or undefined if it has no art. */
export function elementalArtKey(id: string): string | undefined {
    return ART_IDS.has(id) ? `elemental_${id}` : undefined;
}

/** Load path (relative to the scene HTML) for an Elemental's art PNG. */
export function elementalArtPath(id: string): string {
    return `assets/elementals/${id}.png`;
}
