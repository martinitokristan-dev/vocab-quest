// FEAT-005 browser checks (AC11-AC22 subset). Run against a running demo:
//   npm run map:demo   (in another shell)   then   node MAP/tools/check-effects.mjs [baseUrl]
// Drives installed Edge through Playwright (no browser download). Prints one JSON result block and saves
// screenshots to MAP/reference/compare/feat5-*.png.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const shots = path.resolve(here, '..', 'reference', 'compare');
const base = process.argv[2] ?? 'http://localhost:5199';
const FS = '/@fs/C:/Users/marti/vocab-game/frontend-game';
mkdirSync(shots, { recursive: true });

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const out = {};
const errors = [];

async function open(query, opts = {}) {
  const ctx = await browser.newContext({
    viewport: opts.viewport ?? { width: 1774, height: 887 },
    deviceScaleFactor: opts.dpr ?? 1,
    reducedMotion: opts.reduced ? 'reduce' : 'no-preference',
    hasTouch: opts.touch ?? false,
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && !/404/.test(m.text()) && errors.push(m.text()));
  await page.goto(`${base}/?${query}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__map !== undefined, null, { timeout: 30000 });
  await settle(page);
  return { ctx, page };
}

async function settle(page) {
  await page.waitForFunction(() => window.__map.getStats().bakedSegments >= 2 && !window.__map.isBaking(), null, {
    timeout: 120000,
    polling: 200,
  });
  await page.waitForTimeout(600);
}

const snapFn = (name) => {
  const c = document.querySelector('canvas.vq-world');
  const g = c.getContext('2d');
  window.__snaps ??= {};
  const cam = window.__map.getCamera();
  window.__snaps[name] = { data: g.getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height, cam, dpr: c.width / c.clientWidth };
};

/** Changed pixel fraction between two snapshots inside world rect [x, y, w, h]. */
const diffFn = ([a, b, rect, thr]) => {
  const A = window.__snaps[a];
  const B = window.__snaps[b];
  const k = A.cam.zoom * A.dpr;
  const left = A.cam.cx - A.w / (2 * k);
  const top = A.cam.cy - A.h / (2 * k);
  let x0 = Math.max(0, Math.round((rect[0] - left) * k));
  let y0 = Math.max(0, Math.round((rect[1] - top) * k));
  let x1 = Math.min(A.w, Math.round((rect[0] + rect[2] - left) * k));
  let y1 = Math.min(A.h, Math.round((rect[1] + rect[3] - top) * k));
  let changed = 0;
  let total = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * A.w + x) * 4;
      const d = Math.abs(A.data[i] - B.data[i]) + Math.abs(A.data[i + 1] - B.data[i + 1]) + Math.abs(A.data[i + 2] - B.data[i + 2]);
      total++;
      if (d > (thr ?? 24)) changed++;
    }
  }
  return { changed, total, frac: total ? changed / total : 0 };
};

async function snap(page, name) {
  await page.evaluate(snapFn, name);
}
async function diff(page, a, b, rect, thr) {
  return page.evaluate(diffFn, [a, b, rect, thr]);
}

/** Camera centre expected when the current level is centred (follow offset 12 percent, clamped to the world). */
const expectedTargetFn = () => {
  const m = window.__map;
  const s = m.getDebugState();
  const c = s.camera;
  const a = m.getAvatar();
  const hw = s.viewport.w / (2 * c.zoom);
  const hh = s.viewport.h / (2 * c.zoom);
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  return { cx: hw * 2 >= 1774 ? 887 : clamp(a.x, hw, 1774 - hw), cy: clamp(a.y - (0.12 * s.viewport.h) / c.zoom, hh, 18627 - hh) };
};

// ------------------------------------------------------------------ AC13 / AC22: animation vs reduced motion
async function worldRegions(page) {
  return page.evaluate(
    async ([fs]) => {
      const seg = await import(`${fs}/MAP/src/gen/segmentScene.ts`);
      const water = await import(`${fs}/MAP/src/render/layers/water.ts`);
      const objs = seg.buildSegmentScene(20).objects;
      const rects = water.computeWaterRects(20).filter((r) => r[2] >= 90 && r[3] >= 40).slice(0, 6);
      const falls = objs.filter((o) => o.m === 'waterfall').map((o) => [o.x - 18, o.y - 77, 36, 63]);
      const flags = objs.filter((o) => o.t === 5).map((o) => ({ kind: o.m, rect: [o.x - o.w / 2, o.y - o.h - 4, o.w, o.h + 8] }));
      const trees = objs.filter((o) => typeof o.m === 'string' && /^(oak|bush)/.test(o.m)).map((o) => [o.x - 24, o.y - 100, 48, 70]);
      return { rects, falls, flags, trees };
    },
    [FS],
  );
}

{
  const { ctx, page } = await open('k=1&l=1&quality=high');
  await page.evaluate(() => window.__map.setCamera({ cx: 887, cy: 17740 + 450, zoom: 1 }));
  await page.waitForTimeout(1200);
  const regions = await worldRegions(page);
  await snap(page, 'a0');
  await page.waitForTimeout(3000);
  await snap(page, 'a3');
  const res = { water: [], falls: [], flags: [], trees: [] };
  for (const r of regions.rects) res.water.push((await diff(page, 'a0', 'a3', r)).frac);
  for (const r of regions.falls) res.falls.push((await diff(page, 'a0', 'a3', r)).frac);
  for (const f of regions.flags) res.flags.push({ kind: f.kind, frac: (await diff(page, 'a0', 'a3', f.rect)).frac });
  let canopyHits = 0;
  for (const r of regions.trees) if ((await diff(page, 'a0', 'a3', r)).changed > 0) canopyHits++;
  res.canopyRegionsChanged = `${canopyHits}/${regions.trees.length}`;
  await page.screenshot({ path: path.join(shots, 'feat5-k1s1-animated.png') });
  out.animated = {
    waterMaxFrac: Math.max(0, ...res.water),
    waterCount: res.water.length,
    fallsMaxFrac: Math.max(0, ...res.falls),
    fallsCount: res.falls.length,
    flags: res.flags,
    canopy: res.canopyRegionsChanged,
  };
  // clouds: sky gate zone of K1 (S7)
  await page.evaluate(() => window.__map.setCamera({ cx: 887, cy: 12418 + 120, zoom: 1 }));
  await page.waitForTimeout(1500);
  await settle(page);
  await snap(page, 'c0');
  await page.waitForTimeout(3000);
  await snap(page, 'c3');
  const sky = await diff(page, 'c0', 'c3', [0, 12418 - 200, 1774, 520]);
  out.animated.cloudZoneChangedPixels = sky.changed;
  await page.screenshot({ path: path.join(shots, 'feat5-sky-gate-zone.png') });
  await ctx.close();
}

{
  const { ctx, page } = await open('k=1&l=1&quality=high', { reduced: true });
  await page.evaluate(() => window.__map.setCamera({ cx: 887, cy: 17740 + 450, zoom: 1 }));
  await page.waitForTimeout(1500);
  await settle(page);
  const regions = await worldRegions(page);
  await snap(page, 'r0');
  await page.waitForTimeout(3000);
  await snap(page, 'r3');
  const whole = await diff(page, 'r0', 'r3', [0, 17740, 1774, 887], 0);
  const parts = [];
  for (const r of regions.rects) parts.push((await diff(page, 'r0', 'r3', r, 0)).changed);
  for (const r of regions.falls) parts.push((await diff(page, 'r0', 'r3', r, 0)).changed);
  for (const f of regions.flags) parts.push((await diff(page, 'r0', 'r3', f.rect, 0)).changed);
  out.reduced = { reducedFlag: await page.evaluate(() => window.__map.getDebugState().reduced), wholeFrameChangedPixels: whole.changed, regionChanged: parts.reduce((a, b) => a + b, 0) };
  // sky zone too
  await page.evaluate(() => window.__map.setCamera({ cx: 887, cy: 12418 + 120, zoom: 1 }));
  await page.waitForTimeout(1500);
  await settle(page);
  await snap(page, 'rs0');
  await page.waitForTimeout(3000);
  await snap(page, 'rs3');
  out.reduced.skyZoneChangedPixels = (await diff(page, 'rs0', 'rs3', [0, 12418 - 200, 1774, 520], 0)).changed;
  await ctx.close();
}

// ------------------------------------------------------------------ AC14: node states, hover, tooltip
{
  const { ctx, page } = await open('k=1&l=12&quality=high');
  await page.evaluate(() => window.__map.jumpToNode(1, 12, 1.2));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(shots, 'feat5-node-states.png') });
  const pos = await page.evaluate(() => {
    const m = window.__map;
    const c = m.getCamera();
    const vw = innerWidth;
    const vh = innerHeight;
    const toScreen = (x, y) => ({ x: (x - (c.cx - vw / (2 * c.zoom))) * c.zoom, y: (y - (c.cy - vh / (2 * c.zoom))) * c.zoom });
    const cur = m.getNodePosition(1, 12);
    const done = m.getNodePosition(1, 11);
    const locked = m.getNodePosition(1, 14);
    return { cur: toScreen(cur.x, cur.y), done: toScreen(done.x, done.y), locked: toScreen(locked.x, locked.y) };
  });
  // pulse: current node ring changes between two frames
  await snap(page, 'p0');
  await page.waitForTimeout(350);
  await snap(page, 'p1');
  const c = await page.evaluate(() => window.__map.getCamera());
  const cur = await page.evaluate(() => window.__map.getNodePosition(1, 12));
  const pulse = await diff(page, 'p0', 'p1', [cur.x - 40, cur.y - 70, 80, 110], 10);
  // hover
  await page.mouse.move(pos.done.x, pos.done.y);
  await page.waitForTimeout(300);
  const tip = await page.evaluate(() => window.__map.getDebugState().tooltip);
  const hoverShot = await page.screenshot({ path: path.join(shots, 'feat5-hover.png') });
  void hoverShot;
  // count sky-blue (#7dd3fc) pixels near the hovered node
  const sky = await page.evaluate((p) => {
    const cv = document.querySelector('canvas.vq-world');
    const g = cv.getContext('2d');
    const r = 40;
    const x0 = Math.max(0, Math.round(p.x - r));
    const y0 = Math.max(0, Math.round(p.y - r));
    const d = g.getImageData(x0, y0, 2 * r, 2 * r).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - 125) < 36 && Math.abs(d[i + 1] - 211) < 36 && Math.abs(d[i + 2] - 252) < 36) n++;
    return n;
  }, pos.done);
  await page.mouse.move(pos.locked.x, pos.locked.y);
  await page.waitForTimeout(200);
  const lockedTip = await page.evaluate(() => window.__map.getDebugState().tooltip);
  out.nodes = { currentPulseChangedPixels: pulse.changed, hoverTooltip: tip, hoverSkyBluePixels: sky, lockedTooltip: lockedTip, camZoom: c.zoom };
  await ctx.close();
}

// ------------------------------------------------------------------ AC15 / AC16: complete level walk + camera
async function trackWalk(page, startFn, maxMs) {
  return page.evaluate(
    ([startSrc, max]) =>
      new Promise((resolve) => {
        const m = window.__map;
        const frames = [];
        let prev = m.getCamera();
        const t0 = performance.now();
        // eslint-disable-next-line no-new-func
        new Function(startSrc)();
        let arrivedAt = -1;
        function f(t) {
          const s = m.getDebugState();
          const c = s.camera;
          const vhWorld = s.viewport.h / c.zoom;
          frames.push({
            t: t - t0,
            dcy: Math.abs(c.cy - prev.cy) / vhWorld,
            dcx: Math.abs(c.cx - prev.cx) / vhWorld,
            warp: s.warpAlpha,
            locked: s.locked,
            walking: s.walking,
            bannerVisible: s.bannerVisible,
            gateOpen: s.gateOpen,
            ax: s.avatar.x,
            ay: s.avatar.y,
            aalpha: s.avatar.alpha,
            cx: c.cx,
            cy: c.cy,
            zoom: c.zoom,
          });
          prev = c;
          if (!s.locked && !s.walking && arrivedAt < 0 && t - t0 > 200) arrivedAt = t - t0;
          if (t - t0 > max || (arrivedAt > 0 && t - t0 > arrivedAt + 1800)) resolve({ frames, arrivedAt });
          else requestAnimationFrame(f);
        }
        requestAnimationFrame(f);
      }),
    [startFn, maxMs],
  );
}

{
  const { ctx, page } = await open('k=1&l=5&quality=high');
  const start = await page.evaluate(() => window.__map.getAvatar());
  const r = await trackWalk(page, 'window.__demo.complete();', 12000);
  const maxStep = Math.max(...r.frames.filter((f) => f.warp < 0.05).map((f) => Math.max(f.dcy, f.dcx)));
  const end = await page.evaluate(() => ({ av: window.__map.getAvatar(), n6: window.__map.getNodePosition(1, 6), cam: window.__map.getCamera() }));
  // centering time: first time after arrival that the camera is within 6 units of the follow target
  const target = await page.evaluate(expectedTargetFn);
  const near = r.frames.find((f) => f.t >= r.arrivedAt && Math.hypot(f.cx - target.cx, f.cy - target.cy) < 6);
  out.walk = {
    startAvatar: start,
    endAvatar: end.av,
    node6: end.n6,
    walkMs: Math.round(r.arrivedAt),
    maxFrameCameraMoveVh: Number(maxStep.toFixed(4)),
    centeredAfterArrivalMs: near ? Math.round(near.t - r.arrivedAt) : null,
    centeredWithinMsOfWalkStart: near ? Math.round(near.t) : null,
    stateAfter: await page.evaluate(() => ({ k: window.__demo.state.k, l: window.__demo.state.l })),
  };
  await page.screenshot({ path: path.join(shots, 'feat5-after-walk.png') });
  await ctx.close();
}

// ------------------------------------------------------------------ AC17: drag / wheel / pinch / keyboard
{
  const { ctx, page } = await open('k=1&l=20&quality=medium', { touch: true });
  const bounds = () =>
    page.evaluate(() => {
      const s = window.__map.getDebugState();
      const c = s.camera;
      const vw = s.viewport.w;
      const vh = s.viewport.h;
      const hw = vw / (2 * c.zoom);
      const hh = vh / (2 * c.zoom);
      const minZoom = Math.max(vw / 1774, 0.46);
      return { c, inside: c.cx >= hw - 0.01 && c.cx <= 1774 - hw + 0.01 && c.cy >= hh - 0.01 && c.cy <= 18627 - hh + 0.01, zoomOk: c.zoom >= minZoom - 1e-6 && c.zoom <= 3.2 + 1e-6, minZoom };
    });
  const checks = [];
  const record = async (name) => {
    const b = await bounds();
    checks.push({ name, inside: b.inside, zoomOk: b.zoomOk, zoom: Number(b.c.zoom.toFixed(3)) });
  };
  const cx = 700;
  const cy = 450;
  // drag far down (towards the world bottom) and far up repeatedly
  await page.mouse.move(cx, cy);
  for (let i = 0; i < 12; i++) {
    await page.mouse.down();
    await page.mouse.move(cx, cy + 380, { steps: 4 });
    await page.mouse.up();
  }
  await record('drag-down-to-edge');
  for (let i = 0; i < 80; i++) {
    await page.mouse.down();
    await page.mouse.move(cx, cy - 380, { steps: 2 });
    await page.mouse.up();
    if (i % 20 === 19) await page.waitForTimeout(50);
  }
  await page.waitForTimeout(600);
  await record('drag-up-to-edge');
  await page.mouse.move(cx, cy);
  for (let i = 0; i < 12; i++) await page.mouse.wheel(0, -600);
  await record('wheel-pan');
  await page.keyboard.down('Control');
  for (let i = 0; i < 30; i++) await page.mouse.wheel(0, -400);
  await page.keyboard.up('Control');
  await page.waitForTimeout(100);
  await record('wheel-zoom-in-max');
  await page.keyboard.down('Control');
  for (let i = 0; i < 60; i++) await page.mouse.wheel(0, 500);
  await page.keyboard.up('Control');
  await page.waitForTimeout(100);
  await record('wheel-zoom-out-min');
  // pinch with two touch points (CDP)
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, i) => ({ x: p[0], y: p[1], id: i + 1 })) });
  const z0 = (await bounds()).c.zoom;
  await touch('touchStart', [[800, 450], [900, 450]]);
  for (let s = 1; s <= 12; s++) await touch('touchMove', [[800 - s * 20, 450], [900 + s * 20, 450]]);
  await touch('touchEnd', []);
  await page.waitForTimeout(100);
  const z1 = (await bounds()).c.zoom;
  await record('pinch-out');
  // keyboard
  await page.evaluate(() => document.querySelector('canvas.vq-world').focus());
  const k0 = (await bounds()).c;
  for (const key of ['ArrowUp', 'ArrowUp', 'ArrowRight', 'PageUp', 'Equal', 'Equal', 'Minus', 'ArrowDown', 'PageDown']) await page.keyboard.press(key);
  await record('keyboard');
  const k1 = (await bounds()).c;
  for (let i = 0; i < 80; i++) await page.keyboard.press('PageUp');
  await record('keyboard-pageup-to-edge');
  for (let i = 0; i < 30; i++) await page.keyboard.press('Equal');
  await record('keyboard-zoom-in-max');
  out.input = { checks, pinchZoomBefore: Number(z0.toFixed(3)), pinchZoomAfter: Number(z1.toFixed(3)), keyboardMoved: Math.hypot(k1.cx - k0.cx, k1.cy - k0.cy) > 1 || k1.zoom !== k0.zoom };
  await ctx.close();
}

// ------------------------------------------------------------------ AC18: recenter within 1 s (button and keyboard)
{
  const { ctx, page } = await open('k=1&l=20&quality=medium');
  const timeTo = async (action) => {
    const t = await page.evaluate(
      ([src, expSrc]) =>
        new Promise((resolve) => {
          const m = window.__map;
          // eslint-disable-next-line no-new-func
          const expectedSrc = new Function(`return (${expSrc})();`);
          // eslint-disable-next-line no-new-func
          new Function(src)();
          const t0 = performance.now();
          function f(now) {
            const s = m.getDebugState();
            const target = expectedSrc();
            const d = Math.hypot(s.camera.cx - target.cx, s.camera.cy - target.cy);
            if (d < 4 && s.warpAlpha < 0.01 && Math.abs(s.camera.zoom - Math.max(Math.max(s.viewport.w / 1774, 0.46), s.viewport.w / 1774)) < 0.01) resolve(now - t0);
            else if (now - t0 > 4000) resolve(-1);
            else requestAnimationFrame(f);
          }
          requestAnimationFrame(f);
        }),
      [action, expectedTargetFn.toString()],
    );
    return Math.round(t);
  };
  // far: top of world
  await page.evaluate(() => window.__map.setCamera({ cx: 887, cy: 600, zoom: 1.7 }));
  await page.waitForTimeout(300);
  const emphasis = await page.evaluate(() => window.__map.getDebugState().emphasis);
  const far = await timeTo("document.querySelector('.vq-recenter').click();");
  // near: one screen away
  await page.evaluate(() => window.__map.setCamera({ ...window.__map.getCamera(), cy: window.__map.getCamera().cy - 700 }));
  await page.waitForTimeout(200);
  const near = await timeTo("document.querySelector('.vq-recenter').click();");
  // keyboard
  await page.evaluate(() => {
    window.__map.setCamera({ cx: 300, cy: 9000, zoom: 1.2 });
    document.querySelector('canvas.vq-world').focus();
  });
  await page.waitForTimeout(200);
  const kb = await timeTo("document.querySelector('canvas.vq-world').dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }));");
  out.recenter = { emphasisWhenFar: emphasis, farMs: far, nearMs: near, keyboardHomeMs: kb };
  await ctx.close();
}

// ------------------------------------------------------------------ AC19: level 45 transitions 1 -> 2 -> 3 and events once
{
  const { ctx, page } = await open('k=1&l=45&quality=high');
  const runGate = async (label) => {
    const r = await trackWalk(page, 'window.__demo.complete();', 20000);
    const f = r.frames;
    const lockedFrames = f.filter((x) => x.locked || x.walking);
    const bannerFrames = f.filter((x) => x.bannerVisible);
    const bannerMs = bannerFrames.length ? bannerFrames[bannerFrames.length - 1].t - bannerFrames[0].t : 0;
    const maxStep = Math.max(...f.filter((x) => x.warp < 0.05).map((x) => Math.max(x.dcy, x.dcx)));
    const end = await page.evaluate(() => ({ av: window.__map.getAvatar(), cam: window.__map.getCamera(), locked: window.__map.isInputLocked(), st: { k: window.__demo.state.k, l: window.__demo.state.l, phase: window.__demo.state.phase } }));
    return {
      label,
      lockedFramesFirstMs: lockedFrames.length ? Math.round(lockedFrames[0].t) : null,
      lockedUntilMs: lockedFrames.length ? Math.round(lockedFrames[lockedFrames.length - 1].t) : null,
      gateOpenSeen: f.some((x) => x.gateOpen),
      bannerMs: Math.round(bannerMs),
      avatarFadedMin: Math.min(...f.map((x) => x.aalpha)),
      maxFrameCameraMoveVh: Number(maxStep.toFixed(4)),
      endAvatar: end.av,
      endCamera: end.cam,
      lockedAtEnd: end.locked,
      state: end.st,
    };
  };
  const g1 = await runGate('K1 L45');
  await page.screenshot({ path: path.join(shots, 'feat5-after-gate-k1.png') });
  // click the K2 entrance (awaiting_kingdom_click), counting events
  await page.evaluate(() => {
    window.__ev = { kingdom: 0, level: 0, locked: 0 };
    window.__map.on('kingdomClick', () => window.__ev.kingdom++);
    window.__map.on('levelClick', () => window.__ev.level++);
    window.__map.on('lockedKingdomClick', () => window.__ev.locked++);
  });
  const entrancePos = await page.evaluate(() => {
    const c = window.__map.getCamera();
    const e = { x: 440 + 160, y: 12148 + 100 };
    return { x: (e.x - (c.cx - innerWidth / (2 * c.zoom))) * c.zoom, y: (e.y - (c.cy - innerHeight / (2 * c.zoom))) * c.zoom };
  });
  await page.mouse.click(entrancePos.x, entrancePos.y);
  await page.waitForTimeout(3800);
  const entered = await page.evaluate(() => ({ ev: window.__ev, entered: window.__demo.state.entered, locked: window.__map.isInputLocked() }));
  await page.evaluate(() => window.__demo.jump(2, 45));
  await page.waitForTimeout(1500);
  const g2 = await runGate('K2 L45');
  await page.screenshot({ path: path.join(shots, 'feat5-after-gate-k2.png') });
  await page.evaluate(() => window.__demo.jump(3, 45));
  await page.waitForTimeout(1500);
  const fin = await trackWalk(page, 'window.__demo.complete();', 8000);
  const lf = fin.frames.filter((x) => x.locked || x.walking);
  const finale = { lockedMs: lf.length ? Math.round(lf[lf.length - 1].t - lf[0].t) : 0, unlockedAtEnd: await page.evaluate(() => !window.__map.isInputLocked()) };
  await page.screenshot({ path: path.join(shots, 'feat5-k3-finale.png') });
  // repeat 1 -> 2 once more (AC19 repetition)
  await page.evaluate(() => {
    window.__demo.reset();
    window.__demo.jump(1, 45);
  });
  await page.waitForTimeout(1800);
  const g1b = await runGate('K1 L45 again');
  out.gate = { g1, entered, g2, finale, g1b };
  await ctx.close();
}

// ------------------------------------------------------------------ AC19b: events fire exactly once per click
{
  const { ctx, page } = await open('k=1&l=12&quality=medium');
  await page.evaluate(() => window.__map.jumpToNode(1, 12, 1.2));
  await page.waitForTimeout(600);
  const counts = await page.evaluate(() => {
    window.__ev = { level: [], wrong: 0 };
    window.__map.on('levelClick', (k, l) => window.__ev.level.push(`${k}/${l}`));
    const c = window.__map.getCamera();
    const toScreen = (n) => ({ x: (n.x - (c.cx - innerWidth / (2 * c.zoom))) * c.zoom, y: (n.y - (c.cy - innerHeight / (2 * c.zoom))) * c.zoom });
    return { done: toScreen(window.__map.getNodePosition(1, 11)), cur: toScreen(window.__map.getNodePosition(1, 12)), locked: toScreen(window.__map.getNodePosition(1, 14)) };
  });
  await page.mouse.click(counts.done.x, counts.done.y);
  await page.mouse.click(counts.cur.x, counts.cur.y);
  await page.mouse.click(counts.locked.x, counts.locked.y);
  // a drag that ends on a node must not click
  await page.mouse.move(counts.done.x - 60, counts.done.y);
  await page.mouse.down();
  await page.mouse.move(counts.done.x, counts.done.y, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  out.events = await page.evaluate(() => window.__ev.level);
  // keyboard activation of a proxy
  const proxy = await page.evaluate(() => document.querySelectorAll('.vq-node-proxy:not([hidden])').length);
  await page.locator('.vq-node-proxy[data-level="12"]').focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);
  out.events2 = await page.evaluate(() => window.__ev.level);
  const labels = await page.evaluate(() => [...document.querySelectorAll('.vq-node-proxy:not([hidden])')].slice(0, 3).map((b) => b.getAttribute('aria-label')));
  const order = await page.evaluate(() => [...document.querySelectorAll('.vq-node-proxy:not([hidden])')].map((b) => Number(b.dataset.level)));
  const disabled = await page.evaluate(() => document.querySelectorAll('.vq-node-proxy[aria-disabled="true"]').length);
  out.a11y = { proxies: proxy, labels, tabOrderLevels: order, disabledCount: disabled, canvasRole: await page.evaluate(() => document.querySelector('canvas.vq-world').getAttribute('role')) };
  await ctx.close();
}

// ------------------------------------------------------------------ AC12 resize, AC11 DPR 2
{
  const { ctx, page } = await open('k=1&l=20&quality=medium', { viewport: { width: 1920, height: 1080 } });
  const visible = () =>
    page.evaluate(() => {
      const m = window.__map;
      const s = m.getDebugState();
      const c = s.camera;
      const av = m.getAvatar();
      const sx = (av.x - (c.cx - s.viewport.w / (2 * c.zoom))) * c.zoom;
      const sy = (av.y - (c.cy - s.viewport.h / (2 * c.zoom))) * c.zoom;
      const cv = document.querySelector('canvas.vq-world');
      return { vp: s.viewport, zoom: c.zoom, nodeVisible: sx >= 0 && sx <= s.viewport.w && sy >= 0 && sy <= s.viewport.h, canvasCss: [cv.clientWidth, cv.clientHeight], backing: [cv.width, cv.height], sx, sy };
    });
  const big = await visible();
  await page.screenshot({ path: path.join(shots, 'feat5-1920x1080.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(800);
  const small = await visible();
  await page.screenshot({ path: path.join(shots, 'feat5-390x844.png') });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.waitForTimeout(800);
  const back = await visible();
  out.resize = { big, small, back };
  await ctx.close();
}
{
  const { ctx, page } = await open('k=1&l=12&quality=high', { dpr: 2, viewport: { width: 900, height: 600 } });
  await page.evaluate(() => window.__map.jumpToNode(1, 12, 1.5));
  await page.waitForTimeout(1200);
  const info = await page.evaluate(() => {
    const cv = document.querySelector('canvas.vq-world');
    return { dpr: window.devicePixelRatio, css: [cv.clientWidth, cv.clientHeight], backing: [cv.width, cv.height] };
  });
  await page.screenshot({ path: path.join(shots, 'feat5-dpr2.png') });
  out.dpr2 = info;
  await ctx.close();
}

await browser.close();
out.pageErrors = errors;
console.log(JSON.stringify(out, null, 1));
