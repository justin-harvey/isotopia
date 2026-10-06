// The starter Elementals. `monster` is the creature's silly display name —
// original, copyright-safe names (no "-mon" suffix) so this can be open-sourced.
// `tint` is a Phaser tint applied to the placeholder sprite so each creature
// reads as visually distinct until real sprite sheets replace it.

export interface ElementInfo {
    id: string;        // matches question.elementId
    symbol: string;    // periodic-table symbol, e.g. "Na"
    name: string;      // "Sodium"
    monster: string;   // silly display name, e.g. "Sodazoom"
    number: number;    // atomic number
    tint: number;      // Phaser tint (0xRRGGBB) for the placeholder sprite
}

export const ELEMENTS: ElementInfo[] = [
    { id: 'hydrogen', symbol: 'H',  name: 'Hydrogen', monster: 'Hydrohop',    number: 1,  tint: 0x7ec8ff },
    { id: 'carbon',   symbol: 'C',  name: 'Carbon',   monster: 'Carbocrunch', number: 6,  tint: 0x9e9e9e },
    { id: 'nitrogen', symbol: 'N',  name: 'Nitrogen', monster: 'Nitronoodle', number: 7,  tint: 0x64b5f6 },
    { id: 'oxygen',   symbol: 'O',  name: 'Oxygen',   monster: 'Oxypuff',     number: 8,  tint: 0xef5350 },
    { id: 'sodium',   symbol: 'Na', name: 'Sodium',   monster: 'Sodazoom',    number: 11, tint: 0xba68c8 },
    // Added with real character art (see src/assets/elementals + data/elementalArt.ts).
    { id: 'magnesium', symbol: 'Mg', name: 'Magnesium', monster: 'Magflash',  number: 12, tint: 0xff8a65 },
    { id: 'iron',      symbol: 'Fe', name: 'Iron',      monster: 'Ironclank', number: 26, tint: 0x8d6e63 },
    { id: 'neon',      symbol: 'Ne', name: 'Neon',      monster: 'Neonglow',  number: 10, tint: 0xff7043 },
    { id: 'uranium',   symbol: 'U',  name: 'Uranium',   monster: 'Glowbun',   number: 92, tint: 0x7cb342 },
    // 2026-09 art drop: 7 new Elementals (real pixel art in src/assets/elementals).
    { id: 'helium',    symbol: 'He', name: 'Helium',    monster: 'Helior',    number: 2,  tint: 0xcfd8dc },
    { id: 'beryllium', symbol: 'Be', name: 'Beryllium', monster: 'Beryllia',  number: 4,  tint: 0xbdbdbd },
    { id: 'boron',     symbol: 'B',  name: 'Boron',     monster: 'Borolith',  number: 5,  tint: 0x5c9ce6 },
    { id: 'fluorine',  symbol: 'F',  name: 'Fluorine',  monster: 'Fluorvex',  number: 9,  tint: 0xaed581 },
    { id: 'aluminum',  symbol: 'Al', name: 'Aluminum',  monster: 'Aluminio',  number: 13, tint: 0xb0bec5 },
    { id: 'sulfur',    symbol: 'S',  name: 'Sulfur',    monster: 'Brimora',   number: 16, tint: 0xffca28 },
    { id: 'scandium',  symbol: 'Sc', name: 'Scandium',  monster: 'Scandion',  number: 21, tint: 0x4a7c7c },
    // Flame-test Elementals (desert Lesson Three — see data/flameTest.ts). Added
    // 2026-10-01 so the beacon puzzle can use genuine flame colours. Real pixel art
    // dropped 2026-10-04 (Gemini art, orange bg stripped via tools/remove_bg.py →
    // src/assets/elementals/<id>.png); all six are registered in elementalArt ART_IDS.
    // The `tint` below is now only the flame-colour fallback if art fails to load.
    { id: 'potassium', symbol: 'K',  name: 'Potassium', monster: 'Kaliflare',  number: 19, tint: 0xb060e0 },
    { id: 'copper',    symbol: 'Cu', name: 'Copper',    monster: 'Cupragleam', number: 29, tint: 0x3fae57 },
    { id: 'barium',    symbol: 'Ba', name: 'Barium',    monster: 'Bariglow',   number: 56, tint: 0x7fd651 },
    { id: 'lithium',   symbol: 'Li', name: 'Lithium',   monster: 'Lithflare',  number: 3,  tint: 0xe23b4e },
    { id: 'strontium', symbol: 'Sr', name: 'Strontium', monster: 'Stronflare', number: 38, tint: 0xff4d2e },
    { id: 'calcium',   symbol: 'Ca', name: 'Calcium',   monster: 'Calciglow',  number: 20, tint: 0xff7a1a },
    // 3p-block fill-ins (jungle Lesson Two — electron configuration). Real art made in
    // Gemini (src/assets/elementals/<id>.png), registered in data/elementalArt ART_IDS.
    // Completes the 3p progression Al→Si→P→S→Cl→Ar; Chlorine revived from retirement.
    { id: 'silicon',    symbol: 'Si', name: 'Silicon',    monster: 'Silichip',   number: 14, tint: 0x78909c },
    { id: 'phosphorus', symbol: 'P',  name: 'Phosphorus', monster: 'Phosflare',  number: 15, tint: 0xffb74d },
    { id: 'chlorine',   symbol: 'Cl', name: 'Chlorine',   monster: 'Chlorofizz', number: 17, tint: 0xcddc39 },
    { id: 'argon',      symbol: 'Ar', name: 'Argon',      monster: 'Argosnooze', number: 18, tint: 0xb39ddb },
];

export const ELEMENTS_BY_ID: Record<string, ElementInfo> =
    ELEMENTS.reduce((acc, e) => { acc[e.id] = e; return acc; }, {} as Record<string, ElementInfo>);

export function getElement(id: string): ElementInfo | undefined {
    return ELEMENTS_BY_ID[id];
}
