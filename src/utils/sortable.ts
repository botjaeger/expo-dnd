/**
 * Sortable utilities for position tracking and manipulation
 */

/**
 * Convert a list of items to a position map
 * @param list - Array of items
 * @param keyExtractor - Function to extract unique key from item
 * @returns Position map { [id]: positionIndex }
 */
export function listToPositions<T>(
  list: T[],
  keyExtractor: (item: T) => string
): { [id: string]: number } {
  'worklet';
  const positions: { [id: string]: number } = {};
  for (let i = 0; i < list.length; i++) {
    positions[keyExtractor(list[i])] = i;
  }
  return positions;
}

/**
 * Move an item from one position to another, shifting items in between
 * @param positions - Current position map
 * @param from - Source position index
 * @param to - Target position index
 * @returns New position map with updated positions
 */
export function objectMove(
  positions: { [id: string]: number },
  from: number,
  to: number
): { [id: string]: number } {
  'worklet';
  const newPositions = Object.assign({}, positions);
  const movedUp = to < from;

  for (const id in positions) {
    const currentPos = positions[id];

    // This is the item being moved
    if (currentPos === from) {
      newPositions[id] = to;
      continue;
    }

    // Shift items in between
    if (movedUp && currentPos >= to && currentPos < from) {
      // Item moved up: shift items down (increase index)
      newPositions[id] = currentPos + 1;
    } else if (!movedUp && currentPos <= to && currentPos > from) {
      // Item moved down: shift items up (decrease index)
      newPositions[id] = currentPos - 1;
    }
  }

  return newPositions;
}

/**
 * Clamp a value between min and max bounds
 */
export function clamp(value: number, min: number, max: number): number {
  'worklet';
  return Math.max(min, Math.min(max, value));
}

/**
 * Calculate new position index from pixel position
 * @param pixelPosition - Current pixel position (Y for vertical, X for horizontal)
 * @param itemSize - Size of each item
 * @param itemCount - Total number of items
 * @returns Clamped position index
 */
export function getPositionIndex(
  pixelPosition: number,
  itemSize: number,
  itemCount: number
): number {
  'worklet';
  return clamp(Math.floor(pixelPosition / itemSize), 0, itemCount - 1);
}

/**
 * Convert position map back to ordered array of IDs
 * @param positions - Position map
 * @returns Array of IDs in order
 */
export function positionsToOrderedIds(
  positions: { [id: string]: number }
): string[] {
  'worklet';
  const entries = Object.entries(positions);
  entries.sort((a, b) => a[1] - b[1]);
  return entries.map(([id]) => id);
}

/**
 * Reorder data array based on position map
 * @param data - Original data array
 * @param positions - Position map
 * @param keyExtractor - Function to extract key from item
 * @returns Reordered data array
 */
export function reorderData<T>(
  data: T[],
  positions: { [id: string]: number },
  keyExtractor: (item: T) => string
): T[] {
  const itemMap = new Map<string, T>();
  data.forEach((item) => {
    itemMap.set(keyExtractor(item), item);
  });

  const orderedIds = positionsToOrderedIds(positions);
  return orderedIds.map((id) => itemMap.get(id)!);
}
