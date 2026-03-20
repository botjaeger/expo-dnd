import type { LayoutRect } from '../context/types';

/**
 * Collision detection input for a droppable
 */
export interface CollisionRect {
  id: string;
  rect: LayoutRect;
  data?: unknown;
}

/**
 * Result of collision detection
 */
export interface CollisionResult {
  id: string;
  data?: unknown;
  /** Intersection ratio (0-1) for intersection-based algorithms */
  ratio?: number;
  /** Distance in pixels for distance-based algorithms */
  distance?: number;
}

/**
 * Collision detection algorithm function signature
 */
export type CollisionDetectionAlgorithm = (
  draggable: { id: string; rect: LayoutRect },
  droppables: CollisionRect[]
) => CollisionResult | null;
