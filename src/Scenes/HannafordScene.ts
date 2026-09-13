import { InteriorScene } from './InteriorScene';
import { SceneName } from './enums/SceneNames';

// Hannaford's grocery (red storefront in town) — placeholder cafe interior art
// for now. Home to Sodium (Sodazoom — the salt aisle) and Fluorine (Fluorvex —
// fluoride toothpaste / bottled water). Chlorine has been retired.
export default class HannafordScene extends InteriorScene {
    constructor() {
        super(SceneName.Hannaford, 'cafe-interior.png', ['sodium'], 'room_cafe');
    }
}
