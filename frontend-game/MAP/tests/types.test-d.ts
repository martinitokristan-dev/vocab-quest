import type { Game2DMapRenderer } from '../../src/game2d';
import type { MapRenderer } from '../src/api/types';

// Compile-time proof that the existing renderer satisfies the shared interface.
export const _renderer = null as unknown as Game2DMapRenderer satisfies MapRenderer;
