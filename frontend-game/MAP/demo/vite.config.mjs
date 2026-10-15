import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { defineConfig } from 'vite';

const here = path.dirname(fileURLToPath(import.meta.url));
const fgRoot = path.resolve(here, '..', '..');

// Standalone demo for the voxel map (npm run map:demo). Serves MAP/demo, shares the game's public assets.
export default defineConfig({
  root: here,
  publicDir: path.resolve(fgRoot, 'public'),
  server: {
    port: 5199,
    strictPort: true,
    fs: { allow: [fgRoot] },
  },
});
