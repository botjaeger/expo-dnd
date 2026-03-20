import type { CollisionDetectionAlgorithm, CollisionRect, CollisionResult } from './types';
import type { LayoutRect } from '../context/types';
import { getIntersectionArea } from '../utils/geometry';

// Minimum intersection ratio to consider a droppable as a candidate
const MIN_INTERSECTION_RATIO = 0.1;

/**
 * Check if a point is inside a rectangle
 */
function pointInRect(x: number, y: number, rect: LayoutRect): boolean {
  'worklet';
  return (
    x >= rect.x &&
    x <= rect.x + rect.width &&
    y >= rect.y &&
    y <= rect.y + rect.height
  );
}

/**
 * Rectangle intersection collision detection algorithm.
 *
 * Strategy:
 * 1. First, check if draggable's center is inside any droppable
 * 2. Among droppables containing the center, prefer the smallest (most specific)
 * 3. If center is not inside any droppable, fall back to intersection-based detection
 *
 * This supports both:
 * - Reordering within a container (dropping on peer items)
 * - Cross-container transfers (dropping into a different zone)
 */
export const rectIntersection: CollisionDetectionAlgorithm = (
  draggable,
  droppables
): CollisionResult | null => {
  'worklet';

  const draggableArea = draggable.rect.width * draggable.rect.height;
  if (draggableArea === 0) return null;

  // Calculate draggable center
  const centerX = draggable.rect.x + draggable.rect.width / 2;
  const centerY = draggable.rect.y + draggable.rect.height / 2;

  // Collect candidates: droppables with intersection
  const candidates: Array<{
    droppable: CollisionRect;
    intersection: number;
    ratio: number;
    droppableArea: number;
    containsCenter: boolean;
  }> = [];

  for (const droppable of droppables) {
    // Skip if dragging over itself (same id)
    if (droppable.id === draggable.id) continue;

    const intersection = getIntersectionArea(draggable.rect, droppable.rect);
    const ratio = intersection / draggableArea;

    // Only consider droppables with meaningful intersection
    if (ratio >= MIN_INTERSECTION_RATIO) {
      const droppableArea = droppable.rect.width * droppable.rect.height;
      const containsCenter = pointInRect(centerX, centerY, droppable.rect);

      candidates.push({
        droppable,
        intersection,
        ratio,
        droppableArea,
        containsCenter,
      });
    }
  }

  if (candidates.length === 0) return null;

  // Separate candidates by whether they contain the center
  const containingCenter = candidates.filter((c) => c.containsCenter);

  // If any droppables contain the center, prefer the smallest among them
  // This handles both nested droppables and cross-container drops
  if (containingCenter.length > 0) {
    containingCenter.sort((a, b) => a.droppableArea - b.droppableArea);
    const best = containingCenter[0];
    return {
      id: best.droppable.id,
      data: best.droppable.data,
      ratio: best.ratio,
    };
  }

  // Fallback: no droppable contains center, use smallest intersecting droppable
  candidates.sort((a, b) => a.droppableArea - b.droppableArea);
  const best = candidates[0];
  return {
    id: best.droppable.id,
    data: best.droppable.data,
    ratio: best.ratio,
  };
};
