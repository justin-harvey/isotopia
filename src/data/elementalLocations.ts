// Where each Elemental can be found — used by the Rad Finder's "never get stuck"
// location hints in the Isotopedex. Mirrors the spawn placements in the scenes
// (TestScene town, WoodsScene, the building interiors). Keep in sync if an
// Elemental is moved to a different room.

export const ELEMENTAL_LOCATION: Record<string, string> = {
    hydrogen:  'Town — by the lake',
    neon:      'Town — the plaza',
    oxygen:    'North Woods',
    nitrogen:  'North Woods — tall grass',
    carbon:    'North Woods',
    iron:      'Hardware store',
    aluminum:  'Hardware store',
    sodium:    'Hannaford (grocery)',
    fluorine:  'Hannaford (grocery)',
    magnesium: 'Auto shop',
    scandium:  'Auto shop',
    uranium:   'Library',
    boron:     'Library',
    helium:    'Home',
    beryllium: 'Home',
    sulfur:    'Home',
};

export function elementalLocation(id: string): string {
    return ELEMENTAL_LOCATION[id] || 'Somewhere in town';
}
