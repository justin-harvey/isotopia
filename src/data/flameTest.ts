// Desert Lesson Three — the Flame-Test Beacons (see ui/BeaconOverlay + DesertScene).
//
// The chemistry: heat an element and its electrons jump to a higher energy level,
// then fall back — each drop releases a photon of one fixed ENERGY, and therefore
// one fixed COLOUR. Every element has its own signature flame colour. This is the
// visible sequel to the Atlantis sanctum's electron-shell forge: there the student
// arranged electrons in shells; here they see what those electrons EMIT.
//
// The puzzle (outside, in the desert): carry the sanctum crystal to wake the three
// cold beacons, then light each one by burning an Elemental YOU HAVE CAUGHT whose
// flame colour matches. Match all three and the buried pyramid rises from the sand.
//
// Design constraint: the "fuel" is a caught Elemental (data/elements.ts + the
// Isotopedex), so every element named here must be a real catchable Elemental. Of
// the classic flame-test elements only Sodium is in the roster, so the beacons use
// roster elements with genuine, teachable flame/combustion colours:
//   Sodium → yellow, Boron → green, Sulfur → blue   (Magnesium → white = distractor)

export interface FlameColor {
    id: string;      // grouping key (lets two elements share a colour, if ever needed)
    name: string;    // human label, e.g. 'blue'
    hex: string;     // approximate on-screen flame colour
}

export const FLAME_COLORS: Record<string, FlameColor> = {
    yellow: { id: 'yellow', name: 'golden yellow',    hex: '#ffd21e' },
    green:  { id: 'green',  name: 'green',            hex: '#3fae57' },
    blue:   { id: 'blue',   name: 'blue',             hex: '#4aa3ff' },
    white:  { id: 'white',  name: 'brilliant white',  hex: '#f5f7ff' },
};

export interface FlameFuel {
    elementId: string;   // id in data/elements.ts (must be catchable)
    symbol: string;      // periodic symbol (for the chip)
    name: string;        // element name
    color: FlameColor;   // its signature flame colour
    note: string;        // one-line teaching shown when burned
}

// Every element with a real, teachable flame/combustion colour that is ALSO a
// catchable Elemental. The three beacons draw their answers from here; any extra
// (Magnesium) is an honest distractor.
export const FLAME_FUELS: FlameFuel[] = [
    { elementId: 'sodium',    symbol: 'Na', name: 'Sodium',    color: FLAME_COLORS.yellow,
      note: 'Sodium burns an intense golden yellow — the colour of a sodium street lamp.' },
    { elementId: 'boron',     symbol: 'B',  name: 'Boron',     color: FLAME_COLORS.green,
      note: 'Boron burns a vivid green — the classic boric-acid flame.' },
    { elementId: 'sulfur',    symbol: 'S',  name: 'Sulfur',    color: FLAME_COLORS.blue,
      note: 'Sulfur burns with an eerie blue flame.' },
    { elementId: 'magnesium', symbol: 'Mg', name: 'Magnesium', color: FLAME_COLORS.white,
      note: 'Magnesium burns with a blinding brilliant-white light — not a beacon colour here.' },
];

export const FUEL_BY_ELEMENT: Record<string, FlameFuel> =
    FLAME_FUELS.reduce((acc, f) => { acc[f.elementId] = f; return acc; }, {} as Record<string, FlameFuel>);

export interface Beacon {
    id: string;        // identity/persistence key
    color: FlameColor; // the flame colour this pillar demands
    hint: string;      // a clue to the colour (the player deduces the element)
}

// The three beacon braziers. Order is left→right in the overlay; they can be lit in
// any order. Their colours resolve to Sodium / Boron / Sulfur among the roster.
export const BEACONS: Beacon[] = [
    { id: 'beacon-yellow', color: FLAME_COLORS.yellow,
      hint: 'A golden glare, like the desert sun or a sodium street lamp.' },
    { id: 'beacon-green',  color: FLAME_COLORS.green,
      hint: 'The green of an oasis after rain.' },
    { id: 'beacon-blue',   color: FLAME_COLORS.blue,
      hint: 'A cold, eerie blue — the flame of brimstone.' },
];

/** Caught-or-not aside, which fuel(s) would satisfy a beacon (shared colours → >1). */
export function fuelsFor(beacon: Beacon): FlameFuel[] {
    return FLAME_FUELS.filter(f => f.color.id === beacon.color.id);
}
