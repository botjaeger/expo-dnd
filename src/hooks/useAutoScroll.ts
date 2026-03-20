import {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedReaction,
  withTiming,
  scrollTo,
  type SharedValue,
} from 'react-native-reanimated';
import { AUTO_SCROLL_DURATION } from '../components/sortable-shared/constants';

interface UseAutoScrollOptions {
  /** Animated ref to the ScrollView (or FlatList) */
  scrollRef: { current: any };
  /** Screen-space start position of the container (x for horizontal, y for vertical) */
  containerStart: SharedValue<number>;
  /** Fixed visible size of the scroll container. Undefined = not in scroll mode. */
  containerSize: number | undefined;
  /** Total content size (sum of all item sizes) */
  totalSize: number;
  /** Scroll direction */
  direction: 'horizontal' | 'vertical';
  /** Distance from edge that triggers auto-scroll */
  autoScrollThreshold: number;
  /** Absolute touch position on the relevant axis (UI-thread shared value) */
  touchPosition: SharedValue<number>;
  /** True when auto-scroll should be evaluated (drag active + list is involved) */
  isDragActive: SharedValue<boolean>;
  /** Content-coordinate leading edge of the dragged item (optional).
   *  When provided, auto-scroll only triggers after the item crosses the viewport boundary. */
  dragContentPosition?: SharedValue<number>;
  /** Size of the dragged item on the scroll axis (optional, required with dragContentPosition). */
  dragItemSize?: SharedValue<number>;
  /** Optional externally-managed scroll offset. If provided, the hook uses this
   *  instead of creating its own. The scroll handler still updates it. */
  externalScrollOffset?: SharedValue<number>;
}

interface UseAutoScrollReturn {
  scrollOffset: SharedValue<number>;
  autoScrollDirection: SharedValue<'none' | 'up' | 'down' | 'left' | 'right'>;
  scrollHandler: ReturnType<typeof useAnimatedScrollHandler>;
}

/**
 * Shared auto-scroll hook used by SortableList, SortableFlatList, and DraggableList.
 *
 * Handles:
 * 1. Edge detection — sets autoScrollDirection when touch is near container edges
 * 2. Scroll animation — drives a withTiming animation toward the edge
 * 3. Scroll sync — calls scrollTo on the ScrollView to follow the animation
 */
export function useAutoScroll({
  scrollRef,
  containerStart,
  containerSize,
  totalSize,
  direction,
  autoScrollThreshold,
  touchPosition,
  isDragActive,
  dragContentPosition,
  dragItemSize,
  externalScrollOffset,
}: UseAutoScrollOptions): UseAutoScrollReturn {
  const isScrollMode = containerSize !== undefined;
  const isHorizontal = direction === 'horizontal';
  const maxScroll = isScrollMode ? Math.max(0, totalSize - containerSize) : 0;

  const internalScrollOffset = useSharedValue(0);
  const scrollOffset = externalScrollOffset ?? internalScrollOffset;
  const autoScrollDirection = useSharedValue<'none' | 'up' | 'down' | 'left' | 'right'>('none');
  const targetScrollOffset = useSharedValue(0);

  // Track scroll position
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollOffset.value = isHorizontal
        ? event.contentOffset.x
        : event.contentOffset.y;
    },
  });

  // Layer 1: Edge detection — watch touch position, set autoScrollDirection
  // When dragContentPosition is provided, auto-scroll only triggers after
  // the dragged item has crossed the visible viewport boundary.
  useAnimatedReaction(
    () => touchPosition.value,
    (absPos) => {
      if (!isScrollMode || !isDragActive.value) return;

      const touchRelative = absPos - containerStart.value;
      const distanceFromStart = touchRelative;
      const distanceFromEnd = containerSize - touchRelative;

      // Gate: if item position tracking is available, require the item to have
      // crossed the viewport boundary before engaging auto-scroll.
      const hasBoundaryInfo = dragContentPosition !== undefined && dragItemSize !== undefined;

      const nearStart = distanceFromStart < autoScrollThreshold && scrollOffset.value > 0;
      const nearEnd = distanceFromEnd < autoScrollThreshold && scrollOffset.value < maxScroll;

      if (hasBoundaryInfo) {
        const itemLeadingEdge = dragContentPosition!.value;
        const itemTrailingEdge = itemLeadingEdge + dragItemSize!.value;
        const viewportStart = scrollOffset.value;
        const viewportEnd = scrollOffset.value + containerSize;

        const itemCrossedStart = itemLeadingEdge < viewportStart;
        const itemCrossedEnd = itemTrailingEdge > viewportEnd;

        if (nearStart && itemCrossedStart) {
          autoScrollDirection.value = isHorizontal ? 'left' : 'up';
        } else if (nearEnd && itemCrossedEnd) {
          autoScrollDirection.value = isHorizontal ? 'right' : 'down';
        } else if (autoScrollDirection.value !== 'none') {
          autoScrollDirection.value = 'none';
        }
      } else {
        // Fallback: original edge-only detection (e.g. DraggableList)
        if (nearStart) {
          autoScrollDirection.value = isHorizontal ? 'left' : 'up';
        } else if (nearEnd) {
          autoScrollDirection.value = isHorizontal ? 'right' : 'down';
        } else if (autoScrollDirection.value !== 'none') {
          autoScrollDirection.value = 'none';
        }
      }
    },
    [isScrollMode, isHorizontal, containerSize, autoScrollThreshold, maxScroll]
  );

  // Reset auto-scroll when drag ends
  useAnimatedReaction(
    () => isDragActive.value,
    (active, prevActive) => {
      if (!isScrollMode) return;
      if (prevActive && !active && autoScrollDirection.value !== 'none') {
        autoScrollDirection.value = 'none';
      }
    },
    [isScrollMode]
  );

  // Layer 2: Direction → scroll animation
  useAnimatedReaction(
    () => autoScrollDirection.value,
    (dir, previousDirection) => {
      if (!isScrollMode || dir === previousDirection) return;

      if (dir === 'up' || dir === 'left') {
        targetScrollOffset.value = scrollOffset.value;
        targetScrollOffset.value = withTiming(0, { duration: AUTO_SCROLL_DURATION });
      } else if (dir === 'down' || dir === 'right') {
        targetScrollOffset.value = scrollOffset.value;
        targetScrollOffset.value = withTiming(maxScroll, { duration: AUTO_SCROLL_DURATION });
      } else {
        // Stop at current position
        targetScrollOffset.value = scrollOffset.value;
      }
    },
    [maxScroll, isScrollMode]
  );

  // Layer 3: Animated offset → actual ScrollView position
  useAnimatedReaction(
    () => targetScrollOffset.value,
    (target, previousTarget) => {
      if (!isScrollMode || target === previousTarget) return;
      if (isDragActive.value) {
        scrollOffset.value = target;
        scrollTo(scrollRef as any, isHorizontal ? target : 0, isHorizontal ? 0 : target, false);
      }
    },
    [isHorizontal, isScrollMode]
  );

  return {
    scrollOffset,
    autoScrollDirection,
    scrollHandler,
  };
}
