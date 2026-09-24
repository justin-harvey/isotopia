import { GridEngine } from "grid-engine";

import TestScene from "./Scenes/TestScene";
import HomeScene from "./Scenes/HomeScene";
import HardwareScene from "./Scenes/HardwareScene";
import HannafordScene from "./Scenes/HannafordScene";
import AutoScene from "./Scenes/AutoScene";
import LibraryScene from "./Scenes/LibraryScene";
import WoodsScene from "./Scenes/WoodsScene";
import CityScene from "./Scenes/CityScene";
import {
    CityPowerTowerScene, CityFinanceScene, CityLargeTowerScene, CityChurchScene,
    CityFashionScene, CityRadioTowerScene, CityPowerStationScene, CityRadioTower2Scene,
    CityMuseumScene, CityMuseumB1Scene, CityMuseumB2Scene, CityMuseumB3Scene, CityMuseumB4Scene,
    CloudCityScene,
} from "./Scenes/CityInteriors";
import { ensureSignedIn } from "./data/auth";
import { initStudentAuth } from "./data/studentAuth";
import { loadQuestionBank } from "./data/questionSource";
import { loadAndCacheSettings } from "./data/classConfig";
import { initIsotopedex } from "./ui/Isotopedex";
import { initIntro } from "./ui/Intro";
import { mountRadFinder } from "./ui/RadFinder";

// Mount the persistent Isotopedex corner button (independent of Phaser scenes),
// the first-run "how to play" card + "?" help button, and the Rad Finder HUD
// (hidden until the student equips it from the dex).
initIsotopedex();
initIntro();
mountRadFinder();

// Watch for optional student sign-in (guests stay anonymous). When a student
// signs in, their progress syncs to students/{uid}.
initStudentAuth();

// If Firebase is configured: sign the student in anonymously, then pull the live
// question bank + class settings (which elements are released). We start Phaser
// only AFTER this so the first scene already knows the release schedule; on any
// error we fall back to the local seed + "everything released" defaults.
(async () => {
    try {
        const uid = await ensureSignedIn();
        await Promise.all([loadQuestionBank(), loadAndCacheSettings()]);
        console.log(uid
            ? `Isotopia: signed in (${uid.slice(0, 6)}…), questions + settings loaded from Firebase.`
            : "Isotopia: Firebase not configured — using local questions.");
    } catch (err) {
        console.warn("Isotopia: using local questions (Firebase unavailable):", err);
    } finally {
        installFormKeyboardGuard(new Phaser.Game(config));
    }
})();

// While a DOM form field is focused (the sign-in / sign-up email + password
// boxes, etc.), stop Phaser from capturing the keyboard. Otherwise letters like
// "A"/"S"/"D" fire the dog's bark/sniff actions and are swallowed before they
// reach the input, so students can't type their credentials. Re-enable on blur.
function installFormKeyboardGuard(game: Phaser.Game): void {
    const isField = (el: EventTarget | null): boolean => {
        const n = el as HTMLElement | null;
        if (!n || !n.tagName) return false;
        return n.tagName === 'INPUT' || n.tagName === 'TEXTAREA'
            || n.tagName === 'SELECT' || n.isContentEditable;
    };
    const setKeyboards = (on: boolean): void => {
        game.scene.getScenes(false).forEach(s => {
            const kb = s.input?.keyboard;
            if (kb) kb.enabled = on;
        });
    };
    document.addEventListener('focusin', e => { if (isField(e.target)) setKeyboards(false); });
    document.addEventListener('focusout', e => { if (isField(e.target)) setKeyboards(true); });
}

const config = {
    type: Phaser.AUTO,
    backgroundColor: '#ffffff',
    // Crisp upscaling of the pixel art now that FIT stretches the canvas to fill
    // an iPad screen (default linear filtering would blur it).
    pixelArt: true,
    scene: [
        TestScene, HomeScene, HardwareScene, HannafordScene, AutoScene, LibraryScene, WoodsScene, CityScene,
        CityPowerTowerScene, CityFinanceScene, CityLargeTowerScene, CityChurchScene,
        CityFashionScene, CityRadioTowerScene, CityPowerStationScene, CityRadioTower2Scene,
        CityMuseumScene, CityMuseumB1Scene, CityMuseumB2Scene, CityMuseumB3Scene, CityMuseumB4Scene,
        CloudCityScene,
    ],
    plugins: {
        scene: [
            {
                key: "gridEngine",
                plugin: GridEngine,
                mapping: "gridEngine",
            },
        ],
    },
    scale: {
        parent: 'phaser-game',
        // FIT scales the 600×600 game up to fill the device screen while keeping
        // its aspect ratio — on an iPad the fixed box would otherwise sit tiny
        // in the middle. CENTER_BOTH keeps it centred within any letterboxing.
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        // 4:3 to match the iPad screen (landscape), so FIT barely letterboxes
        // instead of leaving big bars beside a square. Interiors bump their
        // camera zoom to fill the wider view (see InteriorScene).
        width: 800,
        height: 600
    },
    physics: {
        default: 'arcade',
        arcade: {
            debug: false
        }
    },
};
// The game is created inside the async bootstrap above (after settings load).
