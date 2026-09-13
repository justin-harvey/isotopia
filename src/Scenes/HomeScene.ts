import { InteriorScene } from './InteriorScene';
import { SceneName } from './enums/SceneNames';

// HOME (brown storefront in town) — the player's cozy Gray, Maine house, and
// home base with an EXIT back to town. Now hosts a few Elementals: Helium
// (Helior — birthday balloons), Beryllium (Beryllia), and Sulfur (Brimora).
export default class HomeScene extends InteriorScene {
    constructor() {
        super(SceneName.Home, 'home-interior.png', ['helium', 'beryllium', 'sulfur'], 'room_home');
    }
}
