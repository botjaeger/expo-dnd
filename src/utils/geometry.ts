import type { LayoutRect } from '../context/types';

/**
 * Calculate intersection area between two rectangles
 */
export function getIntersectionArea(a: LayoutRect, b: LayoutRect): number {
  'worklet';
  const xOverlap = Math.max(
    0,
    Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
  );
  const yOverlap = Math.max(
    0,
    Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
  );
  return xOverlap * yOverlap;
}
