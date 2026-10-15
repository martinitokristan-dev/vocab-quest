import { describe, it } from 'vitest';
import { writeGenerated } from '../tools/generate-nodes';

// Only writes when run through `npm run map:nodes` (MAP_REGEN=1); otherwise skipped.
describe('regenerate nodes', () => {
  it.skipIf(!process.env.MAP_REGEN)('writes data/nodes.ts and data/gates.ts', () => {
    writeGenerated();
  });
});
