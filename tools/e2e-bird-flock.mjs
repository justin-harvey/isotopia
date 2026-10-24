// Headless check of the companion-bird flock: start as a gull, press S six times (plus a
// 7th to prove the cap), confirm the flock caps at 6 and mills on the ground, then take
// flight (F) and confirm the birds go airborne above all map art (depth >= FLY_DEPTH).
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
const page = await browser.newPage();
const errors = [];
// The "mine-mine-mine" gull gag is an OPTIONAL asset; until it's added the loader 404s, which
// is expected, not a regression — so don't count it as a console error.
const expected = (t) => /mine-mine-mine/i.test(t);
page.on('console', m => {
    if (m.type() !== 'error') return;
    const url = (m.location && m.location().url) || '';   // for "Failed to load resource" the URL lives here
    if (expected(m.text()) || expected(url)) return;
    errors.push(m.text() + (url ? ` <${url}>` : ''));
});
page.on('pageerror', e => { if (!expected(String(e))) errors.push(String(e)); });

// Pre-seed the gull avatar so the player spawns as a flyer.
await page.addInitScript(() => { try { localStorage.setItem('isotopia:character', 'gull'); } catch {} });
await page.goto(`http://localhost:${port}/index.html?e2e`);

// Wait for an active GameScene with a player sprite.
await page.waitForFunction(() => {
    const iso = window.__isotopia; if (!iso) return false;
    return iso.game.scene.scenes.some(s => s.sys.isActive() && s.playerSprite && s.gridEngine?.hasCharacter?.(s.playerName));
}, { timeout: 20000 });

const activeIdx = await page.evaluate(() => {
    const ss = window.__isotopia.game.scene.scenes;
    return ss.findIndex(s => s.sys.isActive() && s.playerSprite && s.gridEngine?.hasCharacter?.(s.playerName));
});

const readFlock = () => page.evaluate((i) => {
    const s = window.__isotopia.game.scene.scenes[i];
    const flock = s.flock;
    const birds = flock ? flock.birds : [];
    return {
        wearing: s.playerCharacter?.id,
        flying: s.flying,
        count: flock ? flock.count : -1,
        playerDepth: s.playerSprite.depth,
        birdDepths: birds.map(b => Math.round(b.sprite.depth)),
        birdVisible: birds.map(b => b.sprite.visible),
        // distance of each bird from the player, in px
        dists: birds.map(b => Math.round(Math.hypot(b.sprite.x - s.playerSprite.x, b.sprite.y - s.playerSprite.y))),
    };
}, activeIdx);

// Dismiss the first-run intro card (it holds inDialogue=true, which gates S) and focus the canvas.
await page.click('.intro-go').catch(() => {});
await page.waitForTimeout(300);
// Focus the canvas by clicking a CORNER — tapping the centre would hit the player and
// trigger tap-to-fly, launching us airborne before the grounded phase of the test.
await page.click('canvas', { position: { x: 8, y: 8 } }).catch(() => {});

const pressS = async (n) => { for (let i = 0; i < n; i++) { await page.keyboard.press('s'); await page.waitForTimeout(120); } };

console.log('scene index:', activeIdx);
console.log('initial    :', JSON.stringify(await readFlock()));

// "Call friends" button: visible while wearing the gull, and a tap spawns a bird (routes
// through GlobalInfo 'callFriends'). Also confirm the gull gag audio actually loaded.
const btnVisibleGull = await page.isVisible('.iso-call-friends');
await page.click('.iso-call-friends');
await page.waitForTimeout(400);
const afterBtn = await readFlock();
console.log('after btn  :', JSON.stringify(afterBtn), 'btnVisible=', btnVisibleGull);
const audioLoaded = await page.evaluate((i) =>
    window.__isotopia.game.scene.scenes[i].cache.audio.exists('mineMineMine'), activeIdx);

// Spawn 7 presses — should cap at 6.
await pressS(7);
await page.waitForTimeout(600);
const grounded = await readFlock();
console.log('after 7xS  :', JSON.stringify(grounded));

// Let them mill a moment, snapshot ground distances, then take flight.
await page.waitForTimeout(1500);
const milled = await readFlock();
await page.evaluate((i) => {
    const s = window.__isotopia.game.scene.scenes[i];
    if (!s.flying) s.toggleFlight();
}, activeIdx);
await page.waitForTimeout(1800);   // let the V settle
const airborne = await readFlock();
console.log('milled     :', JSON.stringify(milled));
console.log('airborne   :', JSON.stringify(airborne));

// ---- assertions ----
const fail = [];
if (grounded.wearing !== 'gull') fail.push('player is not the gull');
if (!btnVisibleGull) fail.push('Call friends button hidden while wearing the gull');
if (afterBtn.count !== 1) fail.push(`Call friends tap did not spawn a bird (count ${afterBtn.count})`);
if (!audioLoaded) fail.push('gull gag audio (mineMineMine) failed to load');
if (grounded.count !== 6) fail.push(`flock cap wrong: ${grounded.count} (want 6)`);
if (airborne.count !== 6) fail.push(`lost birds on takeoff: ${airborne.count}`);
if (!airborne.flying) fail.push('flight did not engage');
if (!airborne.birdDepths.every(d => d >= 1000)) fail.push(`airborne birds not above map art: ${airborne.birdDepths}`);
if (airborne.playerDepth < 1000) fail.push(`player not lifted above map art while flying: ${airborne.playerDepth}`);
if (grounded.playerDepth >= 1000) fail.push(`grounded player should use grid-engine depth, got ${grounded.playerDepth}`);
if (!grounded.birdDepths.every(d => d === 10)) fail.push(`grounded birds not on char plane: ${grounded.birdDepths}`);
if (!grounded.birdVisible.every(Boolean)) fail.push('some birds invisible');
if (errors.length) fail.push(`console errors: ${errors.slice(0, 3).join(' | ')}`);

console.log(fail.length ? '\nFAIL:\n - ' + fail.join('\n - ') : '\nPASS — all flock assertions held');
await browser.close();
server.close();
process.exit(fail.length ? 1 : 0);
