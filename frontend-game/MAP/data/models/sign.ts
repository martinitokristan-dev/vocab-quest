import { Grid } from './build';
import { FINE } from './props';
import type { VoxelModel } from './types';

/** Dark wood planter that carries the EPCES letters; the WELCOME plaque and its text are canvas decals. */
export const SIGN_PLANTER: VoxelModel = (() => {
  const g = new Grid(40, 15, 5);
  g.box(0, 0, 0, 40, 15, 4, 'P');
  g.box(1, 1, 4, 39, 6, 5, 'S');
  for (let x = 0; x < 40; x++) if (x % 5 === 0) g.set(x, 14, 1, 'p');
  return g.toModel('sign_planter', { P: 'planter', S: 'soil', p: 'woodDark' }, FINE);
})();
