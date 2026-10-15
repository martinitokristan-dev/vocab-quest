// FEAT-006 full browser verification (AC8-AC22 subset). Run against a running demo:
//   npm run map:demo   (in another shell)   then   node MAP/tools/verify.mjs [baseUrl]
// Drives installed Edge through Playwright (no browser download). Saves screenshots to
// MAP/reference/compare/verify-*.png, writes MAP/tools/verify-report.json and exits 1 on any failure.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const shots = path.resolve(here, '..', 'reference', 'compare');
const base = process.argv[2] ?? 'http://localhost:5199';
const KINGDOM_TOP = { 1: 12418, 2: 6209, 3: 0 };
mkdirSync(shots, { recursive: true });

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const report = { checks: {}, errors: [] };
const pngRequests = [];

async function open(query, opts = {}) {
  const ctx = await browser.newContext({
    viewport: opts.viewport ?? { width: 1774, height: 887 },
    deviceScaleFactor: 1,
    reducedMotion: opts.reduced ? 'reduce' : 'no-preference',
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => report.errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && !/404/.test(m.text()) && report.errors.push(m.text()));
  page.on('request', (r) => /vocab-(quest-)?map\.png/.test(r.url()) && pngRequests.push(r.url()));
  const cdp = await ctx.newCDPSession(page);
  await page.goto(`${base}/?${query}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__map !== undefined, null, { timeout: 30000 });
  await settle(page);
  return { ctx, page, cdp };
}

async function settle(page) {
  await page.waitForFunction(() => window.__map.getStats().bakedSegments >= 2 && !window.__map.isBaking(), null, {
    timeout: 120000,
    polling: 200,
  });
  await page.waitForTimeout(700);
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(shots, `verify-${name}.png`) });
}

async function atNode(page, k, l) {
  await page.evaluate(([kk, ll]) => window.__map.jumpToNode(kk, ll), [k, l]);
  await page.waitForTimeout(1200);
  await settle(page);
}

async function atGate(page, k) {
  await page.evaluate((top) => {
    const c = window.__map.getCamera();
    window.__map.setCamera({ ...c, cx: 887, cy: top + 260 });
  }, KINGDOM_TOP[k]);
  await page.waitForTimeout(1200);
  await settle(page);
}

// Screenshots at the required states (also feeds the no-PNG network log, AC9).
{
  const s = await open('k=1&l=1&quality=medium');
  await shot(s.page, 'k1-l1');
  for (const [name, k, l, gate] of [
    ['k1-l20', 1, 20],
    ['k1-l45', 1, 45],
    ['k1-gate', 1, 45, true],
    ['k2-l1', 2, 1],
    ['k2-l45', 2, 45],
    ['k2-gate', 2, 45, true],
    ['k3-l1', 3, 1],
    ['k3-l45', 3, 45],
  ]) {
    await atNode(s.page, k, l);
    if (gate) await atGate(s.page, k);
    await shot(s.page, name);
  }
  // Scroll the whole world: baked-segment count and memory (AC21).
  const bake = await s.page.evaluate(async () => {
    const m = window.__map;
    const c0 = m.getCamera();
    let maxSeg = 0;
    let maxMB = 0;
    for (let y = 400; y < 18627 - 400; y += 300) {
      m.setCamera({ ...c0, cy: y });
      await new Promise((r) => setTimeout(r, 120));
      const st = m.getStats();
      maxSeg = Math.max(maxSeg, st.bakedSegments);
      maxMB = Math.max(maxMB, st.bakedMB);
    }
    return { maxSeg, maxMB };
  });
  report.checks.bake = { ...bake, pass: bake.maxMB < 150 };
  await s.ctx.close();
}

// 4x CPU throttle fps (AC20), medium and low.
for (const q of ['medium', 'low']) {
  // DESIGN 9.2 gate viewport: 1366x768.
  const s = await open(`k=1&l=20&quality=${q}`, { viewport: { width: 1366, height: 768 } });
  await s.cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  // Median of 5 four-second samples (machine load is noisy); min/max are reported too.
  const runs = [];
  for (let i = 0; i < 5; i++) {
    runs.push(
      await s.page.evaluate(
        () =>
          new Promise((resolve) => {
            let n = 0;
            const t0 = performance.now();
            const f = (t) => {
              n++;
              if (t - t0 >= 4000) resolve((n * 1000) / (t - t0));
              else requestAnimationFrame(f);
            };
            requestAnimationFrame(f);
          }),
      ),
    );
  }
  const sorted = [...runs].sort((a, b) => a - b);
  const r = sorted[2];
  report.checks[`fps4x_${q}`] = {
    fps: Number(r.toFixed(1)),
    min: Number(sorted[0].toFixed(1)),
    max: Number(sorted[4].toFixed(1)),
    runs: runs.map((x) => Number(x.toFixed(1))),
    pass: r >= (q === 'medium' ? 55 : 30),
  };
  await s.ctx.close();
}

// Reduced motion (AC22): two world frames 1.5 s apart are identical.
{
  const s = await open('k=1&l=20&reduced=1', { reduced: true });
  const same = await s.page.evaluate(async () => {
    const c = document.querySelector('canvas.vq-world');
    const g = c.getContext('2d');
    const a = g.getImageData(0, 0, c.width, c.height).data;
    await new Promise((r) => setTimeout(r, 1500));
    const b = g.getImageData(0, 0, c.width, c.height).data;
    let changed = 0;
    for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) changed++;
    return changed;
  });
  report.checks.reducedMotion = { changedPixels: same, pass: same === 0 };
  await s.ctx.close();
}

report.checks.noPngRequests = { requests: pngRequests, pass: pngRequests.length === 0 };
report.checks.pageErrors = { errors: report.errors, pass: report.errors.length === 0 };
await browser.close();

report.pass = Object.values(report.checks).every((c) => c.pass);
writeFileSync(path.resolve(here, 'verify-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(report.pass ? 0 : 1);
