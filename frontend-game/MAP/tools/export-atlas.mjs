// Writes every authored voxel sprite (with decals) to MAP/reference/compare/atlas/<key>.png (QA only).
//   npm run map:demo   (other shell)   then   node MAP/tools/export-atlas.mjs [baseUrl]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const base = process.argv[2] ?? 'http://localhost:5199';
const out = path.resolve('MAP/reference/compare/atlas');
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await (await browser.newContext({ viewport: { width: 1774, height: 887 }, deviceScaleFactor: 1 })).newPage();
page.on('pageerror', (e) => console.error('pageerror', String(e)));
await page.goto(`${base}/?atlas=1&quality=medium`, { waitUntil: 'load' });
await page.waitForSelector('#atlas canvas', { timeout: 30000 });
await page.waitForTimeout(800);
const keys = await page.$$eval('#atlas canvas', (cs) => cs.map((c) => c.id.replace('atlas-', '')));
for (const key of keys) {
  const el = await page.$(`#atlas-${key}`);
  await el.screenshot({ path: path.join(out, `${key}.png`) });
}
// contact sheet of the whole atlas
await page.screenshot({ path: path.join(out, '_sheet.png'), fullPage: false });
console.log(`atlas: ${keys.length} sprites -> ${out}`);
await browser.close();
