// Regenerates MAP/data/nodes.ts and gates.ts (cross-platform replacement for `MAP_REGEN=1 vitest ...`).
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const bin = path.join(root, 'node_modules', 'vitest', 'vitest.mjs');
const r = spawnSync(
  process.execPath,
  [bin, 'run', '--config', 'MAP/vitest.config.mjs', 'MAP/tests/generate-nodes.regen.test.ts'],
  { cwd: root, stdio: 'inherit', env: { ...process.env, MAP_REGEN: '1' } },
);
process.exit(r.status ?? 1);
