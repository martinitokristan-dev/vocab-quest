// Milestone-0 performance gate (DESIGN 9.2 / AC20). Run against a running demo:
//   npm run map:demo   (in another shell)   then   node MAP/tools/perf.mjs [baseUrl]
// Drives installed Edge through Playwright (no browser download), writes MAP/tools/perf-report.md and
// screenshots of the scrolling stub world to MAP/reference/compare/.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const compareDir = path.resolve(here, '..', 'reference', 'compare');
const base = process.argv[2] ?? 'http://localhost:5199';
const GATE = { workMs: 4.5, fpsMedium: 55, fpsLow: 30 };

mkdirSync(compareDir, { recursive: true });

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const results = {};

async function open(url, throttle) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const cdp = await ctx.newCDPSession(page);
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__map !== undefined, null, { timeout: 30000 });
  await settle(page);
  if (throttle) await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  return { ctx, page, cdp, errors };
}

async function settle(page) {
  await page.waitForFunction(
    () => {
      const m = window.__map;
      return m.getStats().bakedSegments >= 3 && !m.isBaking();
    },
    null,
    { timeout: 120000, polling: 200 },
  );
  await page.waitForTimeout(500);
}

/** Average rAF fps and the map's own per-frame JS work EMA over `ms`. */
async function measure(page, ms) {
  return page.evaluate(
    (dur) =>
      new Promise((resolve) => {
        const work = [];
        let n = 0;
        let worst = 0;
        let prev = performance.now();
        const t0 = prev;
        const iv = setInterval(() => work.push(window.__map.getStats().drawMs), 100);
        function f(t) {
          n++;
          worst = Math.max(worst, t - prev);
          prev = t;
          if (t - t0 >= dur) {
            clearInterval(iv);
            const avg = work.reduce((a, b) => a + b, 0) / Math.max(1, work.length);
            resolve({ fps: (n * 1000) / (t - t0), workMs: avg, worstFrameMs: worst });
          } else requestAnimationFrame(f);
        }
        requestAnimationFrame(f);
      }),
    ms,
  );
}

const url = (q) => `${base}/?k=1&l=20&quality=${q}`;

// Unthrottled frame work, medium tier, static camera at K1 L20.
{
  const s = await open(url('medium'));
  results.unthrottledMedium = await measure(s.page, 4000);
  results.stats = await s.page.evaluate(() => window.__map.getStats());
  results.errors = s.errors;
  await s.page.screenshot({ path: path.join(compareDir, 'step8-k1-l20.png') });
  await s.ctx.close();
}

// Unthrottled while the camera is panning (informational).
{
  const s = await open(url('medium'));
  await s.page.evaluate(() => {
    const m = window.__map;
    let dir = -1;
    setInterval(() => {
      const c = m.getCamera();
      c.cy += dir * 12;
      m.setCamera(c);
    }, 16);
    setInterval(() => (dir = -dir), 2000);
  });
  results.panMedium = await measure(s.page, 4000);
  await s.ctx.close();
}

// 4x CPU throttle: medium and low.
for (const q of ['medium', 'low']) {
  const s = await open(url(q), 4);
  results[`throttled${q}`] = await measure(s.page, 4000);
  await s.ctx.close();
}

// Scroll the whole stub world, checking for empty pixels (a seam would show the black canvas background).
{
  const s = await open(url('medium'));
  const seam = await s.page.evaluate(async () => {
    const m = window.__map;
    const canvas = document.querySelector('canvas.vq-world');
    const g = canvas.getContext('2d', { alpha: false });
    const cam0 = m.getCamera();
    let blackFrames = 0;
    let checked = 0;
    const nextFrame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    for (let y = 18627 - 400; y > 400; y -= 150) {
      m.setCamera({ ...cam0, cy: y });
      await nextFrame();
      const data = g.getImageData(0, 0, canvas.width, canvas.height).data;
      let black = 0;
      for (let i = 0; i < data.length; i += 4) if (data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 0) black++;
      checked++;
      if (black > 0) blackFrames++;
    }
    return { checked, blackFrames };
  });
  results.seam = seam;
  const shots = [
    ['k1-l1', 1, 1],
    ['k1-l45', 1, 45],
    ['k2-l20', 2, 20],
    ['k3-l45', 3, 45],
  ];
  for (const [name, k, l] of shots) {
    await s.page.evaluate(([kk, ll]) => window.__map.jumpToNode(kk, ll), [k, l]);
    await s.page.waitForTimeout(1500);
    await settle(s.page).catch(() => {});
    await s.page.screenshot({ path: path.join(compareDir, `step8-${name}.png`) });
  }
  results.errors = results.errors.concat(s.errors);
  await s.ctx.close();
}

await browser.close();

const pass = {
  work: results.unthrottledMedium.workMs <= GATE.workMs,
  medium: results.throttledmedium.fps >= GATE.fpsMedium,
  low: results.throttledlow.fps >= GATE.fpsLow,
  seam: results.seam.blackFrames === 0,
};
const f = (n) => n.toFixed(2);
const report = `# Milestone-0 performance report

Generated by \`node MAP/tools/perf.mjs\` (Edge via Playwright, headless, 1366x768, DPR 1, camera at K1 L20, 3 segments visible).
Frame work is the map's own JS time per frame (update + draw calls), averaged over 4 s (sampled every 100 ms).

| Check | Measured | Gate | Result |
|---|---|---|---|
| Unthrottled frame work, medium | ${f(results.unthrottledMedium.workMs)} ms (fps ${f(results.unthrottledMedium.fps)}) | <= ${GATE.workMs} ms | ${pass.work ? 'PASS' : 'FAIL'} |
| 4x CPU throttle, medium | ${f(results.throttledmedium.fps)} fps (work ${f(results.throttledmedium.workMs)} ms, worst frame ${f(results.throttledmedium.worstFrameMs)} ms) | >= ${GATE.fpsMedium} fps | ${pass.medium ? 'PASS' : 'FAIL'} |
| 4x CPU throttle, low | ${f(results.throttledlow.fps)} fps (work ${f(results.throttledlow.workMs)} ms, worst frame ${f(results.throttledlow.worstFrameMs)} ms) | >= ${GATE.fpsLow} fps | ${pass.low ? 'PASS' : 'FAIL'} |
| Seam scan while scrolling the whole world | ${results.seam.blackFrames} of ${results.seam.checked} frames with empty pixels | 0 | ${pass.seam ? 'PASS' : 'FAIL'} |

Informational: panning unthrottled (medium): ${f(results.panMedium.workMs)} ms work, ${f(results.panMedium.fps)} fps.
Baked at K1 L20: ${results.stats.bakedSegments} segments, ${f(results.stats.bakedMB)} MB.
Page errors: ${results.errors.length ? results.errors.join('; ') : 'none'}.

Screenshots: \`MAP/reference/compare/step8-*.png\`.

Overall: ${Object.values(pass).every(Boolean) ? 'PASS' : 'FAIL'}
`;
writeFileSync(path.resolve(here, 'perf-report.md'), report);
console.log(report);
process.exit(Object.values(pass).every(Boolean) ? 0 : 1);
