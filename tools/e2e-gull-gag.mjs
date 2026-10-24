import pw from '/home/nah/interactive-book-club/node_modules/playwright-core/index.js';
const { chromium } = pw;
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const ROOT = '/home/nah/Claudia/isotopia/dist';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.css': 'text/css', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.webmanifest': 'application/manifest+json' };
const server = createServer(async (req, res) => {
    try { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
        const buf = await readFile(join(ROOT, p)); res.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' }); res.end(buf);
    } catch { res.writeHead(404); res.end('nf'); }
});
await new Promise(r => server.listen(0, r));
const port = server.address().port;
const browser = await chromium.launch({ executablePath: '/home/nah/.cache/ms-playwright/chromium_headless_shell-1181/chrome-linux/headless_shell' });
const page = await browser.newPage();
await page.addInitScript(() => { try { localStorage.setItem('isotopia:character', 'gull'); } catch {} });
await page.goto(`http://localhost:${port}/index.html?e2e`);
await page.waitForFunction(() => {
    const iso = window.__isotopia; if (!iso) return false;
    return iso.game.scene.scenes.some(s => s.sys.isActive() && s.playerSprite && s.gridEngine?.hasCharacter?.(s.playerName));
}, { timeout: 20000 });
const i = await page.evaluate(() => window.__isotopia.game.scene.scenes.findIndex(s => s.sys.isActive() && s.playerSprite && s.gridEngine?.hasCharacter?.(s.playerName)));

// Instrument: wrap the gag sound's play() to count calls.
await page.evaluate((i) => {
    const s = window.__isotopia.game.scene.scenes[i];
    window.__playCalls = 0;
    const snd = s.mineMineMine;
    if (snd) { const orig = snd.play.bind(snd); snd.play = (...a) => { window.__playCalls++; return orig(...a); }; }
}, i);

await page.click('.intro-go').catch(() => {});
await page.waitForTimeout(200);

const before = await page.evaluate((i) => {
    const s = window.__isotopia.game.scene.scenes[i];
    const sm = s.sound;
    return {
        mineDefined: !!s.mineMineMine,
        soundClass: sm.constructor?.name,
        locked: sm.locked,
        ctxState: sm.context?.state ?? 'n/a',
        maxBirds: s.flock ? 'flock-ok' : 'no-flock',
    };
}, i);

const readCalls = () => page.evaluate(() => window.__playCalls);
// Every 6th press should squawk, repeatably. Press 5 → silent; 6th → 1 play; 11 → still 1; 12th → 2.
const taps = async (n) => { for (let k = 0; k < n; k++) { await page.click('.iso-call-friends'); await page.waitForTimeout(120); } };
await taps(5);  const at5 = await readCalls();
await taps(1);  const at6 = await readCalls();
await taps(5);  const at11 = await readCalls();
await taps(1);  const at12 = await readCalls();

console.log('before:', JSON.stringify(before));
console.log(`plays: @5=${at5} @6=${at6} @11=${at11} @12=${at12}`);
const ok = at5 === 0 && at6 === 1 && at11 === 1 && at12 === 2;
console.log(ok ? 'PASS — gull gag fires on every 6th press' : 'FAIL — unexpected play cadence');
await browser.close();
server.close();
process.exit(ok ? 0 : 1);
