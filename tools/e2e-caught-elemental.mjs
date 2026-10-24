// Regression guard: a CAUGHT Elemental must never be encountered again. TestScene spawns one
// Elemental ('oxygen'). We load twice — once clean (it should be on the map) and once with
// oxygen pre-marked caught in localStorage (it should be absent: no NPC, no Rad-Finder target).
import pw from '/home/nah/interactive-book-club/node_modules/playwright-core/index.js';
const { chromium } = pw;
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const ROOT = '/home/nah/Claudia/isotopia/dist';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.css': 'text/css', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.webmanifest': 'application/manifest+json' };
const server = createServer(async (req, res) => {
    try {
        let p = decodeURIComponent(req.url.split('?')[0]);
        if (p === '/') p = '/index.html';
        const buf = await readFile(join(ROOT, p));
        res.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' });
        res.end(buf);
    } catch { res.writeHead(404); res.end('nf'); }
});
await new Promise(r => server.listen(0, r));
const port = server.address().port;
const browser = await chromium.launch({ executablePath: '/home/nah/.cache/ms-playwright/chromium_headless_shell-1181/chrome-linux/headless_shell' });

async function loadAndCount(caughtOxygen) {
    const page = await browser.newPage();
    if (caughtOxygen) {
        await page.addInitScript(() => {
            localStorage.setItem('elemonsters.progress.v1', JSON.stringify({ seen: { oxygen: true }, caught: { oxygen: true }, stats: {} }));
        });
    }
    await page.goto(`http://localhost:${port}/index.html?e2e`);
    await page.waitForFunction(() => {
        const iso = window.__isotopia; if (!iso) return false;
        return iso.game.scene.scenes.some(s => s.sys.isActive() && s.playerSprite && s.gridEngine?.hasCharacter?.(s.playerName));
    }, { timeout: 20000 });
    // Let create() finish spawning, then let a few frames run so the mid-session sweep could act.
    await page.waitForTimeout(800);
    const out = await page.evaluate(() => {
        const s = window.__isotopia.game.scene.scenes.find(s => s.sys.isActive() && s.playerSprite && s.gridEngine?.hasCharacter?.(s.playerName));
        return {
            elementalNpcs: (s.elementalNpcs || []).map(e => e.elementId),
            targets: (s.elementalTargets || []).map(t => t.elementId),
        };
    });
    await page.close();
    return out;
}

const clean = await loadAndCount(false);
const caught = await loadAndCount(true);
console.log('clean  :', JSON.stringify(clean));
console.log('caught :', JSON.stringify(caught));

const fail = [];
if (!clean.elementalNpcs.includes('oxygen')) fail.push('clean load should spawn oxygen on the map');
if (!clean.targets.includes('oxygen')) fail.push('clean load should register oxygen as a Rad-Finder target');
if (caught.elementalNpcs.includes('oxygen')) fail.push('caught oxygen was still spawned as an NPC');
if (caught.targets.includes('oxygen')) fail.push('caught oxygen was still a Rad-Finder target');

console.log(fail.length ? '\nFAIL:\n - ' + fail.join('\n - ') : '\nPASS — caught Elementals are not re-spawned/encountered');
await browser.close();
server.close();
process.exit(fail.length ? 1 : 0);
