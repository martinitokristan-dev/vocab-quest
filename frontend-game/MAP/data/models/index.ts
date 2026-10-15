import { Grid } from './build';
import { CAPITOL } from './capitol';
import { HALL, HALL_STEPS } from './hall';
import { LETTER_C, LETTER_E1, LETTER_E2, LETTER_HEART, LETTER_I, LETTER_P, LETTER_S } from './letters';
import {
  BRIDGE,
  BUSH_O,
  BUSH_P,
  BUSH_PLAIN,
  BUSH_W,
  BUSH_Y,
  CAR_RED,
  FENCE,
  HILL_A,
  HILL_B,
  LAMP,
  LILY,
  OAK_L,
  OAK_M,
  OAK_S,
  OAK_XL,
  ROCK_M,
  ROCK_S,
  SUV_DARK,
  TOWER,
  VAN,
  WATERFALL,
} from './props';
import { GATE_K1 } from './arch';
import { APPLE, BRIDGE_LONG, FLOWER_BED } from './k1-extra';
import { ANNEX, BANNER, BENCH, COLOSSEUM, FOUNTAIN, GATE_K2, K2_ARCH, PIER, STALL_BLUE, STALL_RED, STALL_YELLOW, STONE_BRIDGE } from './k2-town';
import { ACACIA, BOAT, MESA_A, MESA_B, PALM_A, PALM_B, REED } from './k2-nature';
import { CAPITOL_GRAND } from './k3-capitol';
import {
  BELVEDERE,
  CLIFF,
  COLONNADE,
  CYPRESS,
  K3_ARCH,
  K3_SEDAN,
  K3_SUV,
  K3_VAN,
  OBELISK,
  PEAK_A,
  PEAK_B,
  STATUE,
  STEPS,
  TERRACE,
  VINES,
} from './k3-land';
import { SCHOOL } from './school';
import { SIGN_PLANTER } from './sign';
import type { VoxelModel } from './types';

function pole(name: string, levels: number): VoxelModel {
  const g = new Grid(1, 1, levels);
  g.box(0, 0, 0, 1, 1, levels, 'P');
  return g.toModel(name, { P: 'poleGrey' }, 0.25);
}

/** All authored voxel models by key. Scene scripts refer to them by key. */
export const MODELS: Readonly<Record<string, VoxelModel>> = {
  school: SCHOOL,
  sign_planter: SIGN_PLANTER,
  letter_i: LETTER_I,
  letter_heart: LETTER_HEART,
  letter_e1: LETTER_E1,
  letter_p: LETTER_P,
  letter_c: LETTER_C,
  letter_e2: LETTER_E2,
  letter_s: LETTER_S,
  hall: HALL,
  hall_steps: HALL_STEPS,
  capitol: CAPITOL,
  tower: TOWER,
  lamp: LAMP,
  van: VAN,
  car_red: CAR_RED,
  suv_dark: SUV_DARK,
  fence: FENCE,
  bridge: BRIDGE,
  oak_s: OAK_S,
  oak_m: OAK_M,
  oak_l: OAK_L,
  oak_xl: OAK_XL,
  bush: BUSH_PLAIN,
  bush_y: BUSH_Y,
  bush_o: BUSH_O,
  bush_p: BUSH_P,
  bush_w: BUSH_W,
  hill_a: HILL_A,
  hill_b: HILL_B,
  rock_s: ROCK_S,
  rock_m: ROCK_M,
  lily: LILY,
  waterfall: WATERFALL,
  pole_ph: pole('pole_ph', 64),
  pole_w: pole('pole_w', 53),
  pole_e: pole('pole_e', 56),
  // Kingdom 1 beyond the reference segment
  gate_k1: GATE_K1,
  apple: APPLE,
  flower_bed: FLOWER_BED,
  bridge_long: BRIDGE_LONG,
  // Kingdom 2
  gate_k2: GATE_K2,
  k2_arch: K2_ARCH,
  k2_stall_red: STALL_RED,
  k2_stall_blue: STALL_BLUE,
  k2_stall_yellow: STALL_YELLOW,
  k2_fountain: FOUNTAIN,
  k2_banner: BANNER,
  k2_bench: BENCH,
  k2_stone_bridge: STONE_BRIDGE,
  k2_pier: PIER,
  k2_annex: ANNEX,
  k2_colosseum: COLOSSEUM,
  palm_a: PALM_A,
  palm_b: PALM_B,
  acacia: ACACIA,
  reed: REED,
  k2_boat: BOAT,
  mesa_a: MESA_A,
  mesa_b: MESA_B,
  // Kingdom 3
  k3_arch: K3_ARCH,
  cypress: CYPRESS,
  obelisk: OBELISK,
  k3_colonnade: COLONNADE,
  terrace_wall: TERRACE,
  k3_vines: VINES,
  k3_cliff: CLIFF,
  k3_belvedere: BELVEDERE,
  k3_statue: STATUE,
  k3_steps: STEPS,
  peak_a: PEAK_A,
  peak_b: PEAK_B,
  k3_van: K3_VAN,
  k3_suv: K3_SUV,
  k3_sedan: K3_SEDAN,
  k3_capitol_grand: CAPITOL_GRAND,
};
