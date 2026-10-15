import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const MAP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FG_SRC = path.resolve(MAP, '..', 'src');
const INDEX = path.join(MAP, 'src', 'index.ts');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(ts|css|mjs)$/.test(name)) out.push(p);
  }
  return out;
}

describe('import boundary', () => {
  it('only MAP/src/index.ts imports from frontend-game/src', () => {
    const offenders: string[] = [];
    for (const dir of [path.join(MAP, 'src'), path.join(MAP, 'data')]) {
      for (const file of walk(dir)) {
        if (file === INDEX) continue;
        const text = readFileSync(file, 'utf8');
        for (const m of text.matchAll(/(?:from|import)\s*\(?\s*['"](\.[^'"]*)['"]/g)) {
          const target = path.resolve(path.dirname(file), m[1]);
          if (target === FG_SRC || target.startsWith(FG_SRC + path.sep)) offenders.push(`${file} -> ${m[1]}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
