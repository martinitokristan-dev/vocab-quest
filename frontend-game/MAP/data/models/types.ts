/** Voxel model format (DESIGN 7.1): ASCII layers, one char per voxel. */
export interface Material {
  readonly base: string; // front colour
  readonly top?: string; // top colour (defaults to base)
  readonly noise: number; // 0..1, scales the +/-5% seeded brightness noise
  readonly emissive?: boolean; // skips lighting
}

export interface VoxelModel {
  readonly name: string;
  /** [width (x), depth (y, toward viewer), height (z)] in voxels. */
  readonly size: readonly [number, number, number];
  /** layers[z][y] is a row string, one char per x. ' ' and '.' are empty. */
  readonly layers: readonly (readonly string[])[];
  /** char -> material id (key of the materials table passed to the rasteriser). */
  readonly legend: Readonly<Record<string, string>>;
  /** Voxel size factor (default 1 = 18x10x14 world units). Landmarks use 0.5 to match the reference's fine cubes. */
  readonly unit?: number;
  /** Sprite-space anchor in voxel-grid units (ground contact point), [ax, ay] pixels at scale 1. */
  readonly anchor: readonly [number, number];
}
