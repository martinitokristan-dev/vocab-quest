import { Grid } from './build';
import { FINE } from './props';
import type { VoxelModel } from './types';

/** 5x8 letter bitmaps (rows top to bottom), extruded 2 deep, for the I (heart) EPCES sign. */
const BITMAPS: Record<string, readonly string[]> = {
  I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  E: ['#####', '##...', '##...', '####.', '##...', '##...', '##...', '#####'],
  P: ['####.', '##.##', '##.##', '##.##', '####.', '##...', '##...', '##...'],
  C: ['.####', '##..#', '##...', '##...', '##...', '##...', '##..#', '.####'],
  S: ['.####', '##..#', '##...', '.###.', '...##', '....#', '#...#', '####.'],
  HEART: ['.##.##.', '#######', '#######', '#######', '.#####.', '..###..', '...#...', '.......'],
};

function letter(name: string, key: string, mat: string): VoxelModel {
  const rows = BITMAPS[key];
  const w = rows[0].length;
  const g = new Grid(w, 2, rows.length);
  for (let r = 0; r < rows.length; r++) {
    for (let x = 0; x < w; x++) {
      if (rows[r][x] !== '#') continue;
      g.box(x, 0, rows.length - 1 - r, x + 1, 2, rows.length - r, 'X');
    }
  }
  return g.toModel(name, { X: mat }, FINE);
}

export const LETTER_I = letter('letter_i', 'I', 'letterBlue');
export const LETTER_HEART = letter('letter_heart', 'HEART', 'letterRed');
export const LETTER_E1 = letter('letter_e1', 'E', 'letterYellow');
export const LETTER_P = letter('letter_p', 'P', 'letterGreen');
export const LETTER_C = letter('letter_c', 'C', 'letterOrange');
export const LETTER_E2 = letter('letter_e2', 'E', 'letterBlue');
export const LETTER_S = letter('letter_s', 'S', 'letterPink');
