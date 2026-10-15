// FEAT-004 world walk: screenshots of the whole world plus a baked-memory / seam scan while scrolling it.
//   npm run map:demo   (in another shell)   then   node MAP/tools/world-shots.mjs [baseUrl]
// Writes MAP/reference/compare/step11-13-*.png and prints a JSON summary (bakedSegments, bakedMB, empty pixels).
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.resolve(here, '..', 'reference', 'compare');
const base = process.argv[2] ?? 'http://localhost:5199';
mkdirSync(dir, { recursive: true });

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(`${base}/?k=1&l=20&quality=medium`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__map !== undefined, null, { timeout: 30000 });

const settle = async () => {
  await page.waitForTimeout(300);
  await page
    .waitForFunction(() => !window.__map.isBaking(), null, { timeout: 120000, polling: 100 })
    .catch(() => {});
  await page.waitForTimeout(400);
};

const shots = [
  ['step11-k1-l20', (m) => m.jumpToNode(1, 20)],
  ['step11-k1-l45-gate', (m) => m.setCamera({ cx: 887, cy: 12860, zoom: 0.77 })],
  ['step11-k1-s7-sky', (m) => m.setCamera({ cx: 887, cy: 12600, zoom: 0.77 })],
  ['step12-k2-l1', (m) => m.jumpToNode(2, 1)],
  ['step12-k1-k2-boundary', (m) => m.setCamera({ cx: 887, cy: 12418, zoom: 0.77 })],
  ['step12-k2-l45-gate', (m) => m.setCamera({ cx: 1000, cy: 6650, zoom: 0.77 })],
  ['step13-k3-l1', (m) => m.jumpToNode(3, 1)],
  ['step13-k2-k3-boundary', (m) => m.setCamera({ cx: 1000, cy: 6209, zoom: 0.77 })],
  ['step13-k3-l45-finale', (m) => m.jumpToNode(3, 45)],
];
for (const [name, fn] of shots) {
  await page.evaluate(`(${fn.toString()})(window.__map)`);
  await settle();
  await page.screenshot({ path: path.join(dir, `${name}.png`) });
}

// Walk the whole world top to bottom and back: empty pixels (a seam shows the black canvas) and baked memory.
const walk = await page.evaluate(async () => {
  const m = window.__map;
  const canvas = document.querySelector('canvas.vq-world');
  const g = canvas.getContext('2d', { alpha: false });
  const cam0 = m.getCamera();
  const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  let blackFrames = 0;
  let checked = 0;
  let maxSeg = 0;
  let maxMB = 0;
  const ys = [];
  for (let y = 400; y < 18627 - 400; y += 140) ys.push(y);
  for (const y of ys.concat(ys.slice().reverse())) {
    m.setCamera({ ...cam0, cy: y });
    await frame();
    const data = g.getImageData(0, 0, canvas.width, canvas.height).data;
    let black = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 0) black++;
    checked++;
    if (black > 0) blackFrames++;
    const s = m.getStats();
    maxSeg = Math.max(maxSeg, s.bakedSegments);
    maxMB = Math.max(maxMB, s.bakedMB);
  }
  return { checked, blackFrames, maxSeg, maxMB };
});
await settle();
const stats = await page.evaluate(() => window.__map.getStats());
await browser.close();
console.log(JSON.stringify({ walk, stats, errors }, null, 2));
