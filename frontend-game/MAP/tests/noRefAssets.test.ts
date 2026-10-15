import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const MAP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(ts|css|html|mjs)$/.test(name)) out.push(p);
  }
  return out;
}

describe('no reference PNG in runtime code', () => {
  it('MAP/src and MAP/data never mention the map PNGs', () => {
    const offenders: string[] = [];
    for (const dir of [path.join(MAP, 'src'), path.join(MAP, 'data')]) {
      for (const file of walk(dir)) {
        const text = readFileSync(file, 'utf8');
        if (/vocab-map\.png|vocab-quest-map\.png/.test(text)) offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});
