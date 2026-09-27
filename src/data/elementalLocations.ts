// Where each Elemental can be found — used by the Rad Finder's "never get stuck"
// location hints in the Isotopedex. Mirrors the spawn placements in the scenes:
// TestScene (MONSTER_SPAWNS), WoodsScene (WILD), the town interiors (the
// elementIds passed to InteriorScene), and CityScene (CITY_ELEMENTALS — outdoors
// on the city streets, not inside the buildings). Keep in sync if an Elemental
// moves. The city is only reachable by the secret path, so its hints say how.

const CITY = 'City (walk to the very top of the North Woods)';

export const ELEMENTAL_LOCATION: Record<string, string> = {
    hydrogen:  'Town — by the lake',
    neon:      'Town — the plaza',
    oxygen:    'North Woods',
    nitrogen:  'North Woods — tall grass',
    carbon:    'North Woods',
    iron:      'Hardware store',
    sodium:    'Hannaford (grocery)',
    magnesium: 'Auto shop',
    uranium:   'Library',
    helium:    'Home',
    // Directions relative to where you arrive (bottom middle of the city map).
    aluminum:  `${CITY} — far west side, halfway up`,
    scandium:  `${CITY} — far west side, lower down`,
    fluorine:  `${CITY} — just east of the middle`,
    beryllium: `${CITY} — near where you arrive, to the west`,
    sulfur:    `${CITY} — near where you arrive, to the east`,
    boron:     `${CITY} — far east, near the bottom`,
};

export function elementalLocation(id: string): string {
    return ELEMENTAL_LOCATION[id] || 'Somewhere in town';
}
