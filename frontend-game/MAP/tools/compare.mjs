// K1 S1 fidelity gate (DESIGN 14.0). Run against a running demo:
//   npm run map:demo   (other shell)   then   node MAP/tools/compare.mjs [baseUrl]
// Renders ?compare=1 at 1774x887 / DPR 1, then checks (1) landmark boxes and node centres against
// tools/reference-boxes.json, (2) the 48x48 CIELAB block metric against the reference PNG, (3) the scored
// checklist in tools/check-checklist.md. Saves k1s1-render / k1s1-side-by-side / k1s1-heat PNGs in
// MAP/reference/compare/ for visual judgement. Never modifies the reference.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const base = process.argv[2] ?? 'http://localhost:5199';
// Block-metric gate. DESIGN 14.0 asks for 75% under dE76 14 and mean < 12; the product owner relaxed it to a
// floor of 60% under dE76 18 and mean < 16 (see FEAT-003 findings).
const DE_GOOD = 18;
const PCT_GOOD = 60;
const MEAN_MAX = 16;
// Product decision (round 3): the scored visual checklist is the main gate, the block metric is informational.
const CHECKLIST_MIN = 45;
const outDir = path.resolve('MAP/reference/compare');
mkdirSync(outDir, { recursive: true });
const refPath = path.resolve('MAP/reference/vocab-quest-map.png');
const spec = JSON.parse(readFileSync(path.resolve('MAP/tools/reference-boxes.json'), 'utf8'));

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1774, height: 887 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(`${base}/?compare=1&quality=medium`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__map !== undefined, null, { timeout: 30000 });
await page.waitForFunction(() => window.__map.getStats().bakedSegments >= 1 && !window.__map.isBaking(), null, { timeout: 120000, polling: 200 });
await page.waitForTimeout(1200);
const shot = await page.screenshot({ clip: { x: 0, y: 0, width: 1774, height: 887 } });
const data = await page.evaluate(() => window.__map.getCompareData());
writeFileSync(path.join(outDir, 'k1s1-render.png'), shot);

// 1. boxes
const byId = new Map(data.boxes.map((b) => [b.id, b]));
const tol = spec.tolerance;
let boxFail = 0;
const boxLines = [];
for (const lm of spec.landmarks) {
  const parts = lm.ids.map((i) => byId.get(i)).filter(Boolean);
  if (parts.length !== lm.ids.length) {
    boxFail++;
    boxLines.push(`${lm.name}: MISSING ${lm.ids.filter((i) => !byId.has(i)).join(',')}`);
    continue;
  }
  const r = [Math.min(...parts.map((p) => p.x0)), Math.min(...parts.map((p) => p.y0)), Math.max(...parts.map((p) => p.x1)), Math.max(...parts.map((p) => p.y1))];
  const d = r.map((v, i) => v - lm.ref[i]);
  const worst = Math.max(...d.map(Math.abs));
  const ok = worst <= tol;
  if (!ok) boxFail++;
  boxLines.push(`${ok ? 'ok  ' : 'FAIL'} ${lm.name.padEnd(15)} worst ${worst.toFixed(1).padStart(5)}  d=[${d.map((v) => v.toFixed(0)).join(',')}]`);
}
let nodeFail = 0;
for (let i = 0; i < spec.nodes.length; i++) {
  const n = data.nodes.find((q) => q.level === i + 1);
  const d = n ? Math.hypot(n.x - spec.nodes[i][0], n.y - spec.nodes[i][1]) : 999;
  if (d > spec.nodeTolerance) {
    nodeFail++;
    boxLines.push(`FAIL node ${i + 1} off by ${d.toFixed(1)}`);
  }
}

// 2. block metric in a blank page (data URLs avoid canvas tainting)
const refB64 = readFileSync(refPath).toString('base64');
const mpage = await ctx.newPage();
await mpage.goto('about:blank');
const metric = await mpage.evaluate(
  async ({ ref, render, deGood, rects }) => {
    const load = (src) =>
      new Promise((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = rej;
        i.src = src;
      });
    const [a, b] = await Promise.all([load(`data:image/png;base64,${ref}`), load(`data:image/png;base64,${render}`)]);
    const W = 1774;
    const H = 887;
    const px = (img) => {
      const c = document.createElement('canvas');
      c.width = W;
      c.height = H;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0, W, H);
      return g.getImageData(0, 0, W, H).data;
    };
    const da = px(a);
    const db = px(b);
    const lin = (v) => {
      v /= 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    const lab = (r, g, bl) => {
      const R = lin(r);
      const G = lin(g);
      const B = lin(bl);
      const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
      const Y = R * 0.2126 + G * 0.7152 + B * 0.0722;
      const Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
      const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
      return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
    };
    const BS = 48;
    const cols = Math.ceil(W / BS);
    const rows = Math.ceil(H / BS);
    const cats = { sky: { n: 0, good: 0, sum: 0 }, landmark: { n: 0, good: 0, sum: 0 }, terrain: { n: 0, good: 0, sum: 0 } };
    const rgb = [0, 0, 0, 0, 0, 0];
    const zones = [[0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0]];
    let counted = 0;
    let good = 0;
    let sum = 0;
    const grid = [];
    for (let by = 0; by < rows; by++) {
      const row = [];
      for (let bx = 0; bx < cols; bx++) {
        const x0 = bx * BS;
        const y0 = by * BS;
        const x1 = Math.min(W, x0 + BS);
        const y1 = Math.min(H, y0 + BS);
        const m = [0, 0, 0, 0, 0, 0];
        let n = 0;
        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            const i = (y * W + x) * 4;
            m[0] += da[i]; m[1] += da[i + 1]; m[2] += da[i + 2];
            m[3] += db[i]; m[4] += db[i + 1]; m[5] += db[i + 2];
            n++;
          }
        }
        const la = lab(m[0] / n, m[1] / n, m[2] / n);
        const lb = lab(m[3] / n, m[4] / n, m[5] / n);
        const de = Math.hypot(la[0] - lb[0], la[1] - lb[1], la[2] - lb[2]);
        const excluded = y0 < 130; // top band: ground replaces sky (D4)
        const mx = x0 + (x1 - x0) / 2;
        const my = y0 + (y1 - y0) / 2;
        const cat = y0 < 192 ? 'sky' : rects.some((r) => mx >= r[0] && mx <= r[2] && my >= r[1] && my <= r[3]) ? 'landmark' : 'terrain';
        row.push({ de, excluded });
        if (!excluded) {
          cats[cat].n++;
          cats[cat].sum += de;
          if (de < deGood) cats[cat].good++;
          for (let q = 0; q < 6; q++) rgb[q] += m[q] / n;
          const zi = y0 < 400 ? 0 : y0 < 650 ? 1 : 2;
          for (let q = 0; q < 6; q++) zones[zi][q] += m[q] / n;
          zones[zi][6]++;
          counted++;
          sum += de;
          if (de < deGood) good++;
        }
      }
      grid.push(row);
    }
    // side-by-side (reference left, render right, half size) and heat map
    const sbs = document.createElement('canvas');
    sbs.width = W;
    sbs.height = Math.round(H / 2) + 4;
    const sg = sbs.getContext('2d');
    sg.fillStyle = '#fff';
    sg.fillRect(0, 0, sbs.width, sbs.height);
    sg.drawImage(a, 0, 0, W / 2 - 2, H / 2);
    sg.drawImage(b, W / 2 + 2, 0, W / 2 - 2, H / 2);
    const heat = document.createElement('canvas');
    heat.width = W;
    heat.height = H;
    const hg = heat.getContext('2d');
    hg.drawImage(b, 0, 0);
    for (let by = 0; by < rows; by++) {
      for (let bx = 0; bx < cols; bx++) {
        const c = grid[by][bx];
        if (c.excluded) continue;
        hg.fillStyle = c.de < deGood ? 'rgba(0,200,0,0.18)' : `rgba(255,0,0,${Math.min(0.7, 0.25 + c.de / 80)})`;
        hg.fillRect(bx * BS, by * BS, BS, BS);
        hg.fillStyle = '#fff';
        hg.font = '12px sans-serif';
        hg.fillText(String(Math.round(c.de)), bx * BS + 4, by * BS + 14);
      }
    }
    return {
      blocks: counted,
      good,
      pct: (100 * good) / counted,
      mean: sum / counted,
      cats,
      rgb: rgb.map((v) => Math.round(v / counted)),
      zones: zones.map((z) => z.slice(0, 6).map((v) => Math.round(v / z[6]))),
      sbs: sbs.toDataURL('image/png').split(',')[1],
      heat: heat.toDataURL('image/png').split(',')[1],
    };
  },
  { ref: refB64, render: shot.toString('base64'), deGood: DE_GOOD, rects: spec.landmarks.filter((l) => !/waterfall|Flag|flag|lamp|bridge/.test(l.name)).map((l) => l.ref) },
);
writeFileSync(path.join(outDir, 'k1s1-side-by-side.png'), Buffer.from(metric.sbs, 'base64'));
writeFileSync(path.join(outDir, 'k1s1-heat.png'), Buffer.from(metric.heat, 'base64'));
await browser.close();

// 3. checklist
const md = readFileSync(path.resolve('MAP/tools/check-checklist.md'), 'utf8');
const scores = new Map();
for (const line of md.split(/\r?\n/)) {
  const m = /^\|\s*(\d+)\s*\|[^|]*\|\s*([0-2])\s*\|/.exec(line);
  if (m) scores.set(Number(m[1]), Number(m[2]));
}
let sum = 0;
const missing = [];
for (let i = 3; i <= 28; i++) {
  if (!scores.has(i)) missing.push(i);
  else sum += scores.get(i);
}
const landmarkBad = [];
for (let i = 14; i <= 26; i++) if (scores.get(i) !== 2) landmarkBad.push(i);

const boxPass = boxFail === 0 && nodeFail === 0;
const metricPass = metric.pct >= PCT_GOOD && metric.mean < MEAN_MAX; // informational since the product decision
const listPass = missing.length === 0 && sum >= CHECKLIST_MIN;

console.log(boxLines.join('\n'));
console.log(`BOXES      ${boxPass ? 'PASS' : 'FAIL'}  (landmark/flag fails ${boxFail}, node fails ${nodeFail})`);
const cl = Object.entries(metric.cats).map(([k, c]) => `${k} ${c.good}/${c.n} (${((100 * c.good) / Math.max(1, c.n)).toFixed(0)}%, mean ${(c.sum / Math.max(1, c.n)).toFixed(1)})`).join('; ');
console.log(`BLOCKS (informational) ${metricPass ? 'meets' : 'below'} the relaxed floor; by area: ${cl}`);
console.log(`BLOCKS     ${metricPass ? 'PASS' : 'info'}  ${metric.good}/${metric.blocks} = ${metric.pct.toFixed(1)}% under dE76 ${DE_GOOD} (need ${PCT_GOOD}%), mean dE76 ${metric.mean.toFixed(2)} (need < ${MEAN_MAX})`);
console.log(`mean RGB ref [${metric.rgb.slice(0, 3)}] render [${metric.rgb.slice(3)}]`);
console.log(`zones (y<400, <650, rest) ref|render: ${metric.zones.map((z) => `[${z.slice(0, 3)}]|[${z.slice(3)}]`).join('  ')}`);
console.log(`CHECKLIST  ${listPass ? 'PASS' : 'FAIL'}  items 3-28 sum ${sum}/52 (need >= ${CHECKLIST_MIN}; items 1-2 are scored in FEAT-004), landmark items 14-26 not at 2: [${landmarkBad.join(',')}], unscored: [${missing.join(',')}]`);
console.log(`page errors: ${errors.length ? errors.join('; ') : 'none'}`);
console.log(`screenshots: ${outDir}\\k1s1-render.png, k1s1-side-by-side.png, k1s1-heat.png`);
const all = boxPass && listPass && errors.length === 0; // main gates: boxes + visual checklist
console.log(all ? 'PASS' : 'FAIL');
process.exit(all ? 0 : 1);
