import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: path.resolve(here, '..'),
  test: {
    include: ['MAP/tests/**/*.test.ts'],
    environment: 'node',
    // Run files one at a time so timing assertions (walk paths) are not skewed by worker contention.
    fileParallelism: false,
  },
});
