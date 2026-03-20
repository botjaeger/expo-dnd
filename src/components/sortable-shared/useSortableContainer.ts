import { useCallback, useRef, useEffect, useMemo } from 'react';
import { View, LayoutChangeEvent } from 'react-native';
import {
  useSharedValue,
  useAnimatedReaction,
  type SharedValue,
} from 'react-native-reanimated';
import {
  listToPositions,
  reorderData,
} from '../../utils/sortable';
import {
  resolveItemSizes,
  buildPrefixSum,
  computeCurrentPrefixSum,
} from '../../utils/heights';
import { useAutoScroll } from '../../hooks/useAutoScroll';

interface UseSortableContainerOptions<T> {
  id: string;
  data: T[];
  keyExtractor: (item: T) => string;
  itemSize: number | ((index: number) => number);
  containerSize?: number;
  direction: 'horizontal' | 'vertical';
  /** Gap between items in pixels (extracted from style) */
  gap?: number;
  autoScrollThreshold: number;
  onReorder: (data: T[], event: { fromIndex: number; toIndex: number; item: T }) => void;
  onDragStart?: (id: string, index: number) => void;
  onDragMove?: (id: string, overIndex: number, position: number) => void;
  onDragEnd?: (id: string, fromIndex: number, toIndex: number) => void;
  /** Ref to the scrollable element — pass the animated ref for ScrollView or FlatList */
  scrollRef: { current: any };
  /** Called after onReorder completes, for component-specific post-processing */
  afterReorder?: (itemId: string, fromIndex: number, toIndex: number) => void;
}

export function useSortableContainer<T>({
  id,
  data,
  keyExtractor,
  itemSize,
  containerSize,
  direction,
  gap = 0,
  autoScrollThreshold,
  onReorder,
  onDragStart: onDragStartProp,
  onDragMove: onDragMoveProp,
  onDragEnd: onDragEndProp,
  scrollRef,
  afterReorder,
}: UseSortableContainerOptions<T>) {
  const containerRef = useRef<View>(null);
  const dataRef = useRef(data);
  dataRef.current = data;

  const isScrollMode = containerSize !== undefined;
  const isHorizontal = direction === 'horizontal';

  // Dynamic height support: resolve heights and prefix sums
  const itemKeys = useMemo(() => data.map(keyExtractor), [data, keyExtractor]);
  const heights = useMemo(() => resolveItemSizes(itemSize, data.length), [itemSize, data.length]);
  const originalPrefixSum = useMemo(() => buildPrefixSum(heights, gap), [heights, gap]);
  const totalSize = originalPrefixSum[data.length] ?? 0;

  // Shared values for UI thread access
  const heightsSV = useSharedValue(heights);
  const originalPrefixSumSV = useSharedValue(originalPrefixSum);
  const currentPrefixSumSV = useSharedValue([...originalPrefixSum]);
  const itemKeysSV = useSharedValue(itemKeys);

  // Update shared values when data or sizes change
  useEffect(() => {
    heightsSV.value = heights;
    originalPrefixSumSV.value = originalPrefixSum;
    currentPrefixSumSV.value = [...originalPrefixSum];
    itemKeysSV.value = itemKeys;
  }, [heights, originalPrefixSum, itemKeys]);

  // Position tracking
  const positions = useSharedValue<{ [id: string]: number }>(
    listToPositions(data, keyExtractor)
  );

  // Update positions when data changes externally
  useEffect(() => {
    positions.value = listToPositions(data, keyExtractor);
  }, [data, keyExtractor]);

  // Keep currentPrefixSum in sync with positions
  useAnimatedReaction(
    () => positions.value,
    (pos) => {
      currentPrefixSumSV.value = computeCurrentPrefixSum(
        pos, heightsSV.value, itemKeysSV.value, heightsSV.value.length, gap
      );
    },
    [gap]
  );

  // Shared values for drag state
  const activeId = useSharedValue<string | null>(null);
  const isDragging = useSharedValue(false);
  const containerStart = useSharedValue(0);
  const containerStartCross = useSharedValue(0);
  const containerCrossAxisSize = useSharedValue(0);

  // Touch position written by sortable items' gesture handlers
  const touchPosition = useSharedValue(0);

  // Dragged item position in content coordinates (for gating auto-scroll)
  const dragContentPosition = useSharedValue(0);
  const dragItemSize = useSharedValue(0);

  // Content size for scroll mode
  const maxScroll = isScrollMode ? Math.max(0, totalSize - containerSize) : 0;

  // Shared auto-scroll (same hook used by DraggableList)
  const {
    scrollOffset,
    autoScrollDirection,
    scrollHandler,
  } = useAutoScroll({
    scrollRef,
    containerStart,
    containerSize,
    totalSize,
    direction,
    autoScrollThreshold,
    touchPosition,
    isDragActive: isDragging,
    dragContentPosition,
    dragItemSize,
  });

  const handleContainerLayout = useCallback((event: LayoutChangeEvent) => {
    containerRef.current?.measureInWindow((x, y, width, height) => {
      containerStart.value = isHorizontal ? x : y;
      containerStartCross.value = isHorizontal ? y : x;
      containerCrossAxisSize.value = isHorizontal ? height : width;
    });
  }, [isHorizontal, containerStart, containerStartCross, containerCrossAxisSize]);

  const handleDragStart = useCallback((itemId: string, index: number) => {
    onDragStartProp?.(itemId, index);
    // Re-measure container position deferred so the measureInWindow callback's
    // shared-value writes don't land during gesture activation on Fabric/iOS.
    // Writing to shared values from the JS thread triggers a synchronous UI-thread
    // commit (JSI), which interrupts the gesture recognizer and causes it to
    // cancel with success=false on New Architecture.
    setTimeout(() => {
      containerRef.current?.measureInWindow((x, y, width, height) => {
        containerStart.value = isHorizontal ? x : y;
        containerStartCross.value = isHorizontal ? y : x;
        containerCrossAxisSize.value = isHorizontal ? height : width;
      });
    }, 0);
  }, [isHorizontal, containerStart, containerStartCross, containerCrossAxisSize, onDragStartProp]);

  const handleDragMove = useCallback((itemId: string, overIndex: number, position: number) => {
    onDragMoveProp?.(itemId, overIndex, position);
  }, [onDragMoveProp]);

  const handleDragEnd = useCallback((itemId: string, fromIndex: number, toIndex: number) => {
    onDragEndProp?.(itemId, fromIndex, toIndex);

    // Reorder data and call onReorder
    const currentData = dataRef.current;
    const newData = reorderData(currentData, positions.value, keyExtractor);
    const movedItem = currentData[fromIndex] ?? currentData.find((item) => keyExtractor(item) === itemId);

    if (movedItem) {
      onReorder(newData, {
        fromIndex,
        toIndex,
        item: movedItem,
      });
      afterReorder?.(itemId, fromIndex, toIndex);
    }
  }, [positions, keyExtractor, onReorder, onDragEndProp, afterReorder]);

  return {
    // Computed values
    isScrollMode,
    isHorizontal,
    heights,
    originalPrefixSum,
    totalSize,
    maxScroll,

    // Shared values
    heightsSV,
    originalPrefixSumSV,
    currentPrefixSumSV,
    itemKeysSV,
    positions,
    activeId,
    isDragging,
    containerStart,
    containerStartCross,
    containerCrossAxisSize,
    scrollOffset,
    autoScrollDirection,
    touchPosition,
    dragContentPosition,
    dragItemSize,

    // Handlers
    scrollHandler,
    handleContainerLayout,
    handleDragStart,
    handleDragMove,
    handleDragEnd,

    // Refs
    containerRef,
    dataRef,
  };
}
