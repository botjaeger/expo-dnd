/**
 * Utilities for dynamic height support in sortable components.
 * All functions marked with 'worklet' run on the UI thread via Reanimated.
 */

/**
 * Resolve item sizes from either a uniform number or a per-index function.
 * Runs on JS thread only (used in useMemo).
 */
export function resolveItemSizes(
  itemSize: number | ((index: number) => number),
  itemCount: number
): number[] {
  const heights: number[] = new Array(itemCount);
  if (typeof itemSize === 'number') {
    for (let i = 0; i < itemCount; i++) {
      heights[i] = itemSize;
    }
  } else {
    for (let i = 0; i < itemCount; i++) {
      heights[i] = itemSize(i);
    }
  }
  return heights;
}

/**
 * Build a prefix sum array from heights.
 * prefixSum[i] = sum of heights[0..i-1] (plus gaps between items)
 * prefixSum[0] = 0
 * prefixSum[n] = total content size
 */
export function buildPrefixSum(heights: number[], gap: number = 0): number[] {
  'worklet';
  const n = heights.length;
  const prefix = new Array(n + 1);
  prefix[0] = 0;
  for (let i = 0; i < n; i++) {
    prefix[i + 1] = prefix[i] + heights[i] + (i < n - 1 ? gap : 0);
  }
  return prefix;
}

/**
 * Find the slot index at a given pixel position using binary search on a prefix sum.
 * Returns clamped index in [0, itemCount - 1].
 */
export function getIndexAtPosition(
  prefixSum: number[],
  pixelPos: number,
  itemCount: number
): number {
  'worklet';
  if (itemCount <= 0) return 0;
  if (pixelPos <= 0) return 0;
  if (pixelPos >= prefixSum[itemCount]) return itemCount - 1;

  let lo = 0;
  let hi = itemCount - 1;
  while (lo < hi) {
    const mid = lo + Math.floor((hi - lo + 1) / 2);
    if (prefixSum[mid] <= pixelPos) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return lo;
}

/**
 * Find the slot index whose item center is nearest to the given pixel position.
 * Uses actual item centers (excluding gap) for symmetric swap behavior.
 * Returns clamped index in [0, itemCount - 1].
 *
 * @param gap - Gap between items. When > 0, each slot in the prefix sum includes
 *   the gap after the item (except the last). The item center is computed excluding
 *   the gap so that swap thresholds sit at the midpoint between adjacent item centers.
 */
export function getIndexAtMidpoint(
  prefixSum: number[],
  pixelPos: number,
  itemCount: number,
  gap: number = 0
): number {
  'worklet';
  if (itemCount <= 0) return 0;
  if (itemCount === 1) return 0;

  // Item center at slot i, excluding the trailing gap from item size
  const center = (i: number): number => {
    const slotWidth = prefixSum[i + 1] - prefixSum[i];
    const itemWidth = i < itemCount - 1 ? slotWidth - gap : slotWidth;
    return prefixSum[i] + itemWidth / 2;
  };

  if (pixelPos <= center(0)) return 0;
  if (pixelPos >= center(itemCount - 1)) return itemCount - 1;

  // Binary search: find last index whose center <= pixelPos
  let lo = 0;
  let hi = itemCount - 1;
  while (lo < hi) {
    const mid = lo + Math.floor((hi - lo + 1) / 2);
    if (center(mid) <= pixelPos) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }

  // lo is the last slot with center <= pixelPos.
  // Check if lo+1's center is actually closer (swap at midpoint between centers).
  if (lo < itemCount - 1) {
    const distLo = pixelPos - center(lo);
    const distNext = center(lo + 1) - pixelPos;
    if (distNext < distLo) return lo + 1;
  }
  return lo;
}

/**
 * Find the insertion index whose slot boundary is nearest to the given pixel position.
 * Returns a value in [0, itemCount], so callers can insert after the last item.
 *
 * The threshold between inserting before or after an item is the item's center.
 */
export function getInsertionIndexAtPosition(
  prefixSum: number[],
  pixelPos: number,
  itemCount: number,
  gap: number = 0
): number {
  'worklet';
  if (itemCount <= 0) return 0;

  const center = (i: number): number => {
    const slotWidth = prefixSum[i + 1] - prefixSum[i];
    const itemWidth = i < itemCount - 1 ? slotWidth - gap : slotWidth;
    return prefixSum[i] + itemWidth / 2;
  };

  if (pixelPos <= center(0)) return 0;
  if (pixelPos >= center(itemCount - 1)) return itemCount;

  let lo = 0;
  let hi = itemCount - 1;
  while (lo < hi) {
    const mid = lo + Math.floor((hi - lo + 1) / 2);
    if (center(mid) <= pixelPos) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }

  return lo + 1;
}

/**
 * Get the pixel offset for an item at a given slot index.
 */
export function getOffsetForIndex(prefixSum: number[], index: number): number {
  'worklet';
  return prefixSum[index] ?? 0;
}

/**
 * Get total content size from a prefix sum.
 */
export function getTotalSize(prefixSum: number[]): number {
  'worklet';
  return prefixSum[prefixSum.length - 1] ?? 0;
}

/**
 * Compute the current prefix sum reflecting the visual order after reordering.
 *
 * @param positions - Maps item ID to current slot index
 * @param heights - Heights indexed by original data index
 * @param keys - Item IDs in original data order
 * @param itemCount - Total number of items
 * @param gap - Gap between items (default 0)
 */
export function computeCurrentPrefixSum(
  positions: { [id: string]: number },
  heights: number[],
  keys: string[],
  itemCount: number,
  gap: number = 0
): number[] {
  'worklet';
  const ordered: number[] = new Array(itemCount);
  for (let i = 0; i < keys.length; i++) {
    const pos = positions[keys[i]];
    if (pos !== undefined && pos >= 0 && pos < itemCount) {
      ordered[pos] = heights[i];
    }
  }
  const prefix = new Array(itemCount + 1);
  prefix[0] = 0;
  for (let j = 0; j < itemCount; j++) {
    prefix[j + 1] = prefix[j] + (ordered[j] ?? 0) + (j < itemCount - 1 ? gap : 0);
  }
  return prefix;
}
