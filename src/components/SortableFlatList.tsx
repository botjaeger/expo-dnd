import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { View, FlatList, ListRenderItemInfo, StyleSheet } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  useAnimatedRef,
  useDerivedValue,
  withTiming,
  withSpring,
  runOnJS,
  runOnUI,
  scrollTo,
  SharedValue,
} from 'react-native-reanimated';
import { objectMove, clamp } from '../utils/sortable';
import { resolveDragEffect } from '../animations/dragEffects';
import type { DragEffect, DragEffectConfig } from '../animations/dragEffects';
import { getIndexAtPosition, getIndexAtMidpoint } from '../utils/heights';
import {
  TIMING_CONFIG,
  SCALE_CONFIG,
  LONG_PRESS_DURATION,
  ACTIVE_SCALE,
  AUTO_SCROLL_THRESHOLD,
  FixedSortableItem,
  useSortableContainer,
  sortableStyles,
  SortableDragOverlay,
  SortableItemRenderer,
} from './sortable-shared';
import { DraggableItemContext } from './Draggable';
import { usePortal } from '../portal/usePortal';

interface SortableFlatListProps<T> {
  /** Unique identifier for this sortable zone */
  id?: string;
  /** Array of items to render */
  data: T[];
  /** Render function for each item */
  renderItem: (info: { item: T; index: number; isDragging: boolean }) => React.ReactNode;
  /** Called when items are reordered */
  onReorder: (data: T[], event: { fromIndex: number; toIndex: number; item: T }) => void;
  /** Extract unique key from item */
  keyExtractor: (item: T) => string;
  /** Size of each item (height for vertical, width for horizontal).
   *  Pass a number for uniform sizes, or a function (index) => size for variable sizes. */
  itemSize: number | ((index: number) => number);
  /** Container size - if provided, enables scroll mode with auto-scroll */
  containerSize?: number;
  /** Horizontal or vertical orientation (default: 'horizontal') */
  direction?: 'horizontal' | 'vertical';
  /** Distance from edge to trigger auto-scroll (default: 80). Only used in scroll mode. */
  autoScrollThreshold?: number;
  /** Custom style for the container */
  style?: any;
  /** Called when drag starts */
  onDragStart?: (id: string, index: number) => void;
  /** Called during drag with position updates */
  onDragMove?: (id: string, overIndex: number, position: number) => void;
  /** Called when drag ends (before onReorder) */
  onDragEnd?: (id: string, fromIndex: number, toIndex: number) => void;
  /** When true, only a DragHandle inside renderItem triggers dragging */
  handle?: boolean;
  /** Style applied to the source item placeholder while it is being dragged.
   *  Defaults to { opacity: 0 } (invisible). Set e.g. { opacity: 0.3 } to show a ghost. */
  activeDragStyle?: import('react-native').ViewStyle;
  /** Render a custom insertion indicator at the current drag position.
   *  Receives the target index. Return null to hide. */
  renderInsertIndicator?: (index: number) => React.ReactNode;
  /** Animation effect applied to the drag overlay when picked up */
  dragEffect?: DragEffect | DragEffectConfig;
}

type SortableRenderItem<T> = SortableFlatListProps<T>['renderItem'];

// ============ FlatList Cell Item (receives position animations) ============

interface FlatListCellItemProps<T> {
  item: T;
  itemId: string;
  originalIndex: number;
  itemHeight: number;
  direction: 'horizontal' | 'vertical';
  activeDragStyle?: import('react-native').ViewStyle;
  positions: SharedValue<{ [id: string]: number }>;
  originalPrefixSum: SharedValue<number[]>;
  currentPrefixSum: SharedValue<number[]>;
  activeId: SharedValue<string | null>;
  isDragging: SharedValue<boolean>;
  pressingId: SharedValue<string | null>;
  animatedScale: SharedValue<number>;
  handleGestureConfig?: FlatListHandleGestureConfig<T>;
  renderItem: SortableRenderItem<T>;
}

interface FlatListHandleGestureConfig<T> {
  itemCount: number;
  totalSize: number;
  gap: number;
  isActiveGesture: SharedValue<boolean>;
  scrollOffset: SharedValue<number>;
  containerStart: SharedValue<number>;
  touchPosition: SharedValue<number>;
  dragContentPosition: SharedValue<number>;
  dragItemSize: SharedValue<number>;
  gestureTranslation: SharedValue<number>;
  startPosition: SharedValue<number>;
  startPixelPosition: SharedValue<number>;
  startScrollOffset: SharedValue<number>;
  onActivate: (item: T, index: number) => void;
  onDeactivate: () => void;
  onDragStart: (id: string, index: number) => void;
  onDragMove: (id: string, overIndex: number, position: number) => void;
  onDragEnd: (id: string, fromIndex: number, toIndex: number) => void;
  scrollGesture?: ReturnType<typeof Gesture.Native>;
}

function FlatListCellItemInner<T>({
  item,
  itemId,
  originalIndex,
  itemHeight,
  direction,
  activeDragStyle,
  positions,
  originalPrefixSum,
  currentPrefixSum,
  activeId,
  isDragging,
  pressingId,
  animatedScale,
  handleGestureConfig,
  renderItem,
}: FlatListCellItemProps<T>) {
  const animatedOffset = useSharedValue(0);
  const isHorizontal = direction === 'horizontal';

  const currentPosition = useDerivedValue(() => {
    return positions.value[itemId] ?? originalIndex;
  });

  React.useEffect(() => {
    animatedOffset.value = 0;
  }, [originalIndex]);

  useAnimatedReaction(
    () => currentPosition.value,
    (pos, prevPos) => {
      if (prevPos !== null && pos !== prevPos) {
        const targetOffset = currentPrefixSum.value[pos] - originalPrefixSum.value[originalIndex];
        animatedOffset.value = withTiming(targetOffset, TIMING_CONFIG);
      }
    },
    [originalIndex]
  );

  const isThisItemActive = useDerivedValue(() => {
    return activeId.value === itemId;
  });

  const isThisItemPressing = useDerivedValue(() => {
    return pressingId.value === itemId;
  });

  const handleEnabled = !!handleGestureConfig;
  const handleItemCount = handleGestureConfig?.itemCount ?? 0;
  const handleTotalSize = handleGestureConfig?.totalSize ?? 0;
  const handleGap = handleGestureConfig?.gap ?? 0;
  const handleIsActiveGesture = handleGestureConfig?.isActiveGesture;
  const handleScrollOffset = handleGestureConfig?.scrollOffset;
  const handleContainerStart = handleGestureConfig?.containerStart;
  const handleTouchPosition = handleGestureConfig?.touchPosition;
  const handleDragContentPosition = handleGestureConfig?.dragContentPosition;
  const handleDragItemSize = handleGestureConfig?.dragItemSize;
  const handleGestureTranslation = handleGestureConfig?.gestureTranslation;
  const handleStartPosition = handleGestureConfig?.startPosition;
  const handleStartPixelPosition = handleGestureConfig?.startPixelPosition;
  const handleStartScrollOffset = handleGestureConfig?.startScrollOffset;
  const handleOnActivate = handleGestureConfig?.onActivate;
  const handleOnDeactivate = handleGestureConfig?.onDeactivate;
  const handleOnDragStart = handleGestureConfig?.onDragStart;
  const handleOnDragMove = handleGestureConfig?.onDragMove;
  const handleOnDragEnd = handleGestureConfig?.onDragEnd;
  const handleScrollGesture = handleGestureConfig?.scrollGesture;

  const animatedStyle = useAnimatedStyle(() => {
    if (isThisItemActive.value) {
      return {
        opacity: activeDragStyle?.opacity ?? 0,
        transform: isHorizontal
          ? [{ translateX: animatedOffset.value }, { scale: 1 }]
          : [{ translateY: animatedOffset.value }, { scale: 1 }],
      };
    }

    if (isThisItemPressing.value) {
      return {
        opacity: 1,
        transform: isHorizontal
          ? [{ translateX: animatedOffset.value }, { scale: animatedScale.value }]
          : [{ translateY: animatedOffset.value }, { scale: animatedScale.value }],
        zIndex: 99999,
        elevation: 24,
      };
    }

    return {
      opacity: 1,
      transform: isHorizontal
        ? [{ translateX: animatedOffset.value }, { scale: 1 }]
        : [{ translateY: animatedOffset.value }, { scale: 1 }],
      zIndex: 0,
      elevation: 0,
    };
  });

  // Keep index swaps in sync during auto-scroll when drag pointer is stationary.
  useAnimatedReaction(
    () => (handleScrollOffset ? handleScrollOffset.value : 0),
    (scroll, prevScroll) => {
      if (
        !handleEnabled ||
        !handleScrollOffset ||
        !handleIsActiveGesture ||
        !handleStartScrollOffset ||
        !handleStartPixelPosition ||
        !handleGestureTranslation ||
        !handleDragContentPosition ||
        prevScroll === null
      ) {
        return;
      }

      if (!handleIsActiveGesture.value || activeId.value !== itemId) return;

      const scrollChange = scroll - handleStartScrollOffset.value;
      const contentPos = clamp(
        handleStartPixelPosition.value + handleGestureTranslation.value + scrollChange,
        0,
        handleTotalSize - itemHeight
      );

      handleDragContentPosition.value = contentPos;

      const itemCenter = contentPos + itemHeight / 2;
      const newIndex = getIndexAtMidpoint(currentPrefixSum.value, itemCenter, handleItemCount, handleGap);
      const currentIndex = positions.value[itemId];

      if (newIndex !== currentIndex) {
        positions.value = objectMove(positions.value, currentIndex, newIndex);
      }
    },
    [handleEnabled, handleItemCount, handleTotalSize, handleGap, itemHeight, itemId]
  );

  const sizeStyle = isHorizontal
    ? { width: itemHeight, height: '100%' as const }
    : { height: itemHeight, width: '100%' as const };

  let dragHandleGesture: ReturnType<typeof Gesture.Simultaneous> | null = null;
  if (
    handleEnabled &&
    handleIsActiveGesture &&
    handleScrollOffset &&
    handleContainerStart &&
    handleTouchPosition &&
    handleDragContentPosition &&
    handleDragItemSize &&
    handleGestureTranslation &&
    handleStartPosition &&
    handleStartPixelPosition &&
    handleStartScrollOffset &&
    handleOnActivate &&
    handleOnDeactivate &&
    handleOnDragStart &&
    handleOnDragMove &&
    handleOnDragEnd
  ) {
    let longPressGesture = Gesture.LongPress()
      .minDuration(LONG_PRESS_DURATION)
      .onBegin(() => {
        'worklet';
        pressingId.value = itemId;
        animatedScale.value = withTiming(ACTIVE_SCALE, { duration: 100 });
      })
      .onFinalize(() => {
        'worklet';
        if (!handleIsActiveGesture.value) {
          pressingId.value = null;
          animatedScale.value = withTiming(1, { duration: 100 });
        }
      });

    if (handleScrollGesture) {
      longPressGesture = longPressGesture.simultaneousWithExternalGesture(handleScrollGesture);
    }

    const panGesture = Gesture.Pan()
      .activateAfterLongPress(LONG_PRESS_DURATION)
      .onStart((event) => {
        'worklet';
        const currentPos = positions.value[itemId] ?? originalIndex;
        const pixelPos = currentPrefixSum.value[currentPos] ?? 0;

        pressingId.value = null;

        handleIsActiveGesture.value = true;
        activeId.value = itemId;
        isDragging.value = true;
        handleStartPosition.value = currentPos;
        handleStartPixelPosition.value = pixelPos;
        handleStartScrollOffset.value = handleScrollOffset.value;
        handleGestureTranslation.value = 0;

        // Initialize drag content position for auto-scroll gating
        handleDragContentPosition.value = pixelPos;
        handleDragItemSize.value = itemHeight;

        animatedScale.value = withTiming(ACTIVE_SCALE, SCALE_CONFIG);

        runOnJS(handleOnActivate)(item, originalIndex);
        runOnJS(handleOnDragStart)(itemId, currentPos);
      })
      .onUpdate((event) => {
        'worklet';
        if (!handleIsActiveGesture.value || activeId.value !== itemId) return;

        const translation = isHorizontal ? event.translationX : event.translationY;
        handleGestureTranslation.value = translation;

        const scrollChange = handleScrollOffset.value - handleStartScrollOffset.value;
        const contentPos = clamp(
          handleStartPixelPosition.value + translation + scrollChange,
          0,
          handleTotalSize - itemHeight
        );

        // Update dragged item content position for auto-scroll gating
        handleDragContentPosition.value = contentPos;

        const itemCenter = contentPos + itemHeight / 2;
        const newIndex = getIndexAtMidpoint(currentPrefixSum.value, itemCenter, handleItemCount, handleGap);
        const currentIndex = positions.value[itemId];

        if (newIndex !== currentIndex) {
          positions.value = objectMove(positions.value, currentIndex, newIndex);
          runOnJS(handleOnDragMove)(itemId, newIndex, contentPos);
        }

        // Update touch position for auto-scroll detection (handled by useAutoScroll hook)
        handleTouchPosition.value = isHorizontal ? event.absoluteX : event.absoluteY;
      })
      .onEnd(() => {
        'worklet';
        if (!handleIsActiveGesture.value || activeId.value !== itemId) return;

        const finalIndex = positions.value[itemId];
        const fromIndex = handleStartPosition.value;

        isDragging.value = false;
        animatedScale.value = withTiming(1, SCALE_CONFIG);

        handleIsActiveGesture.value = false;
        activeId.value = null;

        runOnJS(handleOnDeactivate)();

        if (fromIndex !== finalIndex) {
          runOnJS(handleOnDragEnd)(itemId, fromIndex, finalIndex);
        }
      })
      .onFinalize((_event, success) => {
        'worklet';
        if (!success && handleIsActiveGesture.value && activeId.value === itemId) {
          isDragging.value = false;
          animatedScale.value = withTiming(1, SCALE_CONFIG);

          handleIsActiveGesture.value = false;
          activeId.value = null;

          runOnJS(handleOnDeactivate)();
        }
      });

    dragHandleGesture = Gesture.Simultaneous(longPressGesture, panGesture);
  }

  const content = (
    <Animated.View style={[sizeStyle, animatedStyle]}>
      <SortableItemRenderer
        item={item}
        index={originalIndex}
        isDragging={false}
        renderer={renderItem}
      />
    </Animated.View>
  );

  if (dragHandleGesture) {
    return (
      <DraggableItemContext.Provider value={{ gesture: dragHandleGesture }}>
        {content}
      </DraggableItemContext.Provider>
    );
  }

  return content;
}

const FlatListCellItem = React.memo(FlatListCellItemInner) as typeof FlatListCellItemInner;

// ============ Drag Overlay (rendered outside FlatList) ============

interface DragOverlayProps<T> {
  item: T | null;
  originalIndex: number;
  itemHeight: number;
  containerSize: number;
  direction: 'horizontal' | 'vertical';
  totalSize: number;
  positions: SharedValue<{ [id: string]: number }>;
  startPixelPosition: SharedValue<number>;
  gestureTranslation: SharedValue<number>;
  scrollOffset: SharedValue<number>;
  startScrollOffset: SharedValue<number>;
  animatedScale: SharedValue<number>;
  isActive: SharedValue<boolean>;
  renderItem: SortableRenderItem<T>;
}

function DragOverlay<T>({
  item,
  originalIndex,
  itemHeight,
  containerSize,
  direction,
  totalSize,
  positions,
  startPixelPosition,
  gestureTranslation,
  scrollOffset,
  startScrollOffset,
  animatedScale,
  isActive,
  renderItem,
}: DragOverlayProps<T>) {
  const isHorizontal = direction === 'horizontal';

  const animatedStyle = useAnimatedStyle(() => {
    if (!isActive.value || item === null) {
      return {
        opacity: 0,
        position: 'absolute' as const,
        [isHorizontal ? 'left' : 'top']: 0,
        zIndex: -1,
      };
    }

    const scrollChange = scrollOffset.value - startScrollOffset.value;
    const currentContentPos = startPixelPosition.value + gestureTranslation.value + scrollChange;
    const viewportPos = clamp(currentContentPos, 0, totalSize - itemHeight) - scrollOffset.value;

    return {
      opacity: 1,
      position: 'absolute' as const,
      [isHorizontal ? 'left' : 'top']: viewportPos,
      [isHorizontal ? 'top' : 'left']: 0,
      zIndex: 99999,
      transform: [{ scale: animatedScale.value }],
      elevation: 24,
    };
  });

  const sizeStyle = isHorizontal
    ? { width: itemHeight, height: '100%' as const }
    : { height: itemHeight, width: '100%' as const };

  if (item === null) return null;

  return (
    <Animated.View style={[sizeStyle, animatedStyle] as any} pointerEvents="none">
      <SortableItemRenderer
        item={item}
        index={originalIndex}
        isDragging={true}
        renderer={renderItem}
      />
    </Animated.View>
  );
}

// ============ FlatList Insertion Indicator ============

interface FlatListInsertionIndicatorProps {
  positions: SharedValue<{ [id: string]: number }>;
  activeId: SharedValue<string | null>;
  isDragging: SharedValue<boolean>;
  currentPrefixSum: SharedValue<number[]>;
  scrollOffset: SharedValue<number>;
  direction: 'horizontal' | 'vertical';
  renderIndicator: (index: number) => React.ReactNode;
}

function FlatListInsertionIndicator({
  positions,
  activeId,
  isDragging,
  currentPrefixSum,
  scrollOffset,
  direction,
  renderIndicator,
}: FlatListInsertionIndicatorProps) {
  const isHorizontal = direction === 'horizontal';
  const [state, setState] = useState<{ idx: number; position: number } | null>(null);

  useAnimatedReaction(
    () => {
      const id = activeId.value;
      if (!id || !isDragging.value) return null;
      const idx = positions.value[id];
      if (idx === undefined) return null;
      const ps = currentPrefixSum.value;
      const lastItemIdx = Math.max(0, ps.length - 2);
      const posIdx = Math.min(idx + 1, lastItemIdx);
      // Convert content position to viewport position
      const contentPos = ps[posIdx] ?? 0;
      const viewportPos = contentPos - scrollOffset.value;
      return { idx, position: viewportPos };
    },
    (cur, prev) => {
      if (cur?.idx !== prev?.idx || cur?.position !== prev?.position) {
        runOnJS(setState)(cur);
      }
    },
    []
  );

  if (state === null) return null;

  return (
    <Animated.View
      style={{
        position: 'absolute',
        [isHorizontal ? 'left' : 'top']: state.position,
        [isHorizontal ? 'top' : 'left']: 0,
        [isHorizontal ? 'height' : 'width']: '100%',
        zIndex: 10,
      }}
      pointerEvents="none"
    >
      {renderIndicator(state.idx)}
    </Animated.View>
  );
}

// ============ Gesture Handler Wrapper ============

interface GestureWrapperProps<T> {
  data: T[];
  keyExtractor: (item: T) => string;
  heights: number[];
  totalSize: number;
  gap: number;
  containerSize: number;
  autoScrollThreshold: number;
  direction: 'horizontal' | 'vertical';
  positions: SharedValue<{ [id: string]: number }>;
  currentPrefixSum: SharedValue<number[]>;
  activeId: SharedValue<string | null>;
  pressingId: SharedValue<string | null>;
  isDragging: SharedValue<boolean>;
  scrollOffset: SharedValue<number>;
  containerStart: SharedValue<number>;
  touchPosition: SharedValue<number>;
  dragContentPosition: SharedValue<number>;
  dragItemSize: SharedValue<number>;
  gestureTranslation: SharedValue<number>;
  startPosition: SharedValue<number>;
  startPixelPosition: SharedValue<number>;
  startScrollOffset: SharedValue<number>;
  animatedScale: SharedValue<number>;
  isActiveGesture: SharedValue<boolean>;
  activeItem: T | null;
  activeOriginalIndex: number;
  setActiveItem: (item: T | null, index: number) => void;
  onDragStart: (id: string, index: number) => void;
  onDragMove: (id: string, overIndex: number, position: number) => void;
  onDragEnd: (id: string, fromIndex: number, toIndex: number) => void;
  scrollGesture?: ReturnType<typeof Gesture.Native>;
  children: React.ReactNode;
}

function GestureWrapper<T>({
  data,
  keyExtractor,
  heights,
  totalSize,
  containerSize,
  autoScrollThreshold,
  direction,
  positions,
  currentPrefixSum,
  activeId,
  pressingId,
  isDragging,
  scrollOffset,
  containerStart,
  touchPosition,
  gap,
  dragContentPosition,
  dragItemSize,
  gestureTranslation,
  startPosition,
  startPixelPosition,
  startScrollOffset,
  animatedScale,
  isActiveGesture,
  activeItem,
  activeOriginalIndex,
  setActiveItem,
  onDragStart,
  onDragMove,
  onDragEnd,
  scrollGesture,
  children,
}: GestureWrapperProps<T>) {
  const isHorizontal = direction === 'horizontal';
  const itemCount = data.length;

  // Check for position swaps during auto-scroll and update dragContentPosition
  useAnimatedReaction(
    () => scrollOffset.value,
    (scroll, prevScroll) => {
      if (!isActiveGesture.value || prevScroll === null || activeId.value === null) return;

      const scrollChange = scroll - startScrollOffset.value;
      const activeItemHeight = heights[activeOriginalIndex] ?? 0;
      const contentPos = clamp(
        startPixelPosition.value + gestureTranslation.value + scrollChange,
        0,
        totalSize - activeItemHeight
      );

      // Keep auto-scroll gating in sync as scroll changes
      dragContentPosition.value = contentPos;

      const itemCenter = contentPos + activeItemHeight / 2;
      const newIndex = getIndexAtMidpoint(currentPrefixSum.value, itemCenter, itemCount, gap);
      const currentIndex = positions.value[activeId.value];

      if (newIndex !== currentIndex) {
        positions.value = objectMove(positions.value, currentIndex, newIndex);
      }
    },
    [itemCount, totalSize, heights, activeOriginalIndex]
  );

  const setActiveItemJS = useCallback((itemId: string | null, pos: number) => {
    if (itemId === null) {
      setActiveItem(null, -1);
    } else {
      const index = data.findIndex((item) => keyExtractor(item) === itemId);
      if (index !== -1) {
        setActiveItem(data[index], index);
      }
    }
  }, [data, keyExtractor, setActiveItem]);

  let longPressGesture = Gesture.LongPress()
    .minDuration(LONG_PRESS_DURATION)
    .onBegin((event) => {
      'worklet';
      const touchPos = isHorizontal ? event.x : event.y;
      const contentPos = touchPos + scrollOffset.value;
      const pressedIndex = getIndexAtPosition(currentPrefixSum.value, contentPos, itemCount);

      if (pressedIndex >= 0 && pressedIndex < itemCount) {
        const itemIds = Object.entries(positions.value);
        let pressedItemId: string | null = null;
        for (const [id, pos] of itemIds) {
          if (pos === pressedIndex) {
            pressedItemId = id;
            break;
          }
        }

        if (pressedItemId) {
          pressingId.value = pressedItemId;
          animatedScale.value = withTiming(ACTIVE_SCALE, { duration: 100 });
        }
      }
    })
    .onFinalize(() => {
      'worklet';
      if (!isActiveGesture.value) {
        pressingId.value = null;
        animatedScale.value = withTiming(1, { duration: 100 });
      }
    });

  if (scrollGesture) {
    longPressGesture = longPressGesture.simultaneousWithExternalGesture(scrollGesture);
  }

  const panGesture = Gesture.Pan()
    .activateAfterLongPress(LONG_PRESS_DURATION)
    .onStart((event) => {
      'worklet';
      const touchPos = isHorizontal ? event.x : event.y;
      const contentPos = touchPos + scrollOffset.value;
      const pressedIndex = getIndexAtPosition(currentPrefixSum.value, contentPos, itemCount);

      if (pressedIndex < 0 || pressedIndex >= itemCount) return;

      const itemIds = Object.entries(positions.value);
      let pressedItemId: string | null = null;
      for (const [id, pos] of itemIds) {
        if (pos === pressedIndex) {
          pressedItemId = id;
          break;
        }
      }

      if (!pressedItemId) return;

      const currentPos = positions.value[pressedItemId];
      const pixelPos = currentPrefixSum.value[currentPos] ?? 0;

      pressingId.value = null;

      isActiveGesture.value = true;
      activeId.value = pressedItemId;
      isDragging.value = true;
      startPosition.value = currentPos;
      startPixelPosition.value = pixelPos;
      startScrollOffset.value = scrollOffset.value;
      gestureTranslation.value = 0;

      // Initialize drag content position for auto-scroll gating
      dragContentPosition.value = pixelPos;
      dragItemSize.value = (currentPrefixSum.value[currentPos + 1] ?? currentPrefixSum.value[currentPos]) - currentPrefixSum.value[currentPos];

      animatedScale.value = withTiming(ACTIVE_SCALE, SCALE_CONFIG);

      runOnJS(setActiveItemJS)(pressedItemId, currentPos);
      runOnJS(onDragStart)(pressedItemId, currentPos);
    })
    .onUpdate((event) => {
      'worklet';
      if (!isActiveGesture.value || activeId.value === null) return;

      const translation = isHorizontal ? event.translationX : event.translationY;
      gestureTranslation.value = translation;

      const scrollChange = scrollOffset.value - startScrollOffset.value;
      const activeItemHeight = heights[activeOriginalIndex] ?? 0;
      const contentPos = clamp(
        startPixelPosition.value + translation + scrollChange,
        0,
        totalSize - activeItemHeight
      );

      // Update dragged item content position for auto-scroll gating
      dragContentPosition.value = contentPos;

      const itemCenter = contentPos + activeItemHeight / 2;
      const newIndex = getIndexAtMidpoint(currentPrefixSum.value, itemCenter, itemCount, gap);
      const currentIndex = positions.value[activeId.value];

      if (newIndex !== currentIndex) {
        positions.value = objectMove(positions.value, currentIndex, newIndex);
        runOnJS(onDragMove)(activeId.value, newIndex, contentPos);
      }

      // Update touch position for auto-scroll detection (handled by useAutoScroll hook)
      touchPosition.value = isHorizontal ? event.absoluteX : event.absoluteY;
    })
    .onEnd(() => {
      'worklet';
      if (!isActiveGesture.value || activeId.value === null) return;

      const itemId = activeId.value;
      const finalIndex = positions.value[itemId];
      const fromIndex = startPosition.value;

      isDragging.value = false;
      animatedScale.value = withTiming(1, SCALE_CONFIG);

      isActiveGesture.value = false;
      activeId.value = null;

      runOnJS(setActiveItemJS)(null, -1);

      if (fromIndex !== finalIndex) {
        runOnJS(onDragEnd)(itemId, fromIndex, finalIndex);
      }
    })
    .onFinalize((_event, success) => {
      'worklet';
      if (!success && isActiveGesture.value && activeId.value !== null) {
        isDragging.value = false;
        animatedScale.value = withTiming(1, SCALE_CONFIG);

        isActiveGesture.value = false;
        activeId.value = null;

        runOnJS(setActiveItemJS)(null, -1);
      }
    });

  const gesture = Gesture.Simultaneous(longPressGesture, panGesture);

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={{ flex: 1 }}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

interface SortableFlatListContentProps<T> {
  nativeScrollGesture: ReturnType<typeof Gesture.Native>;
  flatListRef: { current: FlatList<T> | null };
  data: T[];
  keyExtractor: (item: T) => string;
  isHorizontal: boolean;
  flatListRenderItem: (info: ListRenderItemInfo<T>) => React.ReactElement;
  getItemLayout: (data: ArrayLike<T> | null | undefined, index: number) => {
    length: number;
    offset: number;
    index: number;
  };
  scrollHandler: any;
}

function SortableFlatListContent<T>({
  nativeScrollGesture,
  flatListRef,
  data,
  keyExtractor,
  isHorizontal,
  flatListRenderItem,
  getItemLayout,
  scrollHandler,
}: SortableFlatListContentProps<T>) {
  return (
    <GestureDetector gesture={nativeScrollGesture}>
      <Animated.View style={{ flex: 1 }}>
        <AnimatedFlatList
          ref={flatListRef as any}
          data={data}
          keyExtractor={keyExtractor}
          horizontal={isHorizontal}
          renderItem={flatListRenderItem}
          getItemLayout={getItemLayout}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={!isHorizontal}
          showsHorizontalScrollIndicator={isHorizontal}
          bounces={false}
          overScrollMode="never"
          nestedScrollEnabled={true}
          removeClippedSubviews={true}
          windowSize={5}
          maxToRenderPerBatch={10}
          initialNumToRender={10}
        />
      </Animated.View>
    </GestureDetector>
  );
}

interface SortableFlatListScrollModeContainerProps<T> {
  containerRef: React.RefObject<View | null>;
  style: SortableFlatListProps<T>['style'];
  isHorizontal: boolean;
  containerSize: number;
  handleContainerLayout: (event: any) => void;
  handle?: boolean;
  wrapperProps: Omit<GestureWrapperProps<T>, 'children'>;
  content: React.ReactNode;
  overlay: React.ReactNode;
}

function SortableFlatListScrollModeContainer<T>({
  containerRef,
  style,
  isHorizontal,
  containerSize,
  handleContainerLayout,
  handle,
  wrapperProps,
  content,
  overlay,
}: SortableFlatListScrollModeContainerProps<T>) {
  const scrollContainerStyle = isHorizontal
    ? { width: containerSize, height: '100%' as const }
    : { height: containerSize, width: '100%' as const };

  return (
    <View
      ref={containerRef}
      style={[sortableStyles.container, scrollContainerStyle, style]}
      onLayout={handleContainerLayout}
    >
      {handle ? (
        content
      ) : (
        <GestureWrapper {...wrapperProps}>{content}</GestureWrapper>
      )}
      {overlay}
    </View>
  );
}

interface SortableFlatListScrollModeRendererProps<T> {
  containerRef: React.RefObject<View | null>;
  style: SortableFlatListProps<T>['style'];
  isHorizontal: boolean;
  containerSize: number;
  handleContainerLayout: (event: any) => void;
  handle?: boolean;
  nativeScrollGesture: ReturnType<typeof Gesture.Native>;
  flatListRef: { current: FlatList<T> | null };
  data: T[];
  keyExtractor: (item: T) => string;
  flatListRenderItem: (info: ListRenderItemInfo<T>) => React.ReactElement;
  getItemLayout: (data: ArrayLike<T> | null | undefined, index: number) => {
    length: number;
    offset: number;
    index: number;
  };
  scrollHandler: any;
  autoScrollThreshold: number;
  direction: 'horizontal' | 'vertical';
  heights: number[];
  totalSize: number;
  gap: number;
  positions: SharedValue<{ [id: string]: number }>;
  currentPrefixSumSV: SharedValue<number[]>;
  activeId: SharedValue<string | null>;
  pressingId: SharedValue<string | null>;
  isDragging: SharedValue<boolean>;
  scrollOffset: SharedValue<number>;
  containerStart: SharedValue<number>;
  touchPosition: SharedValue<number>;
  dragContentPosition: SharedValue<number>;
  dragItemSize: SharedValue<number>;
  gestureTranslation: SharedValue<number>;
  startPosition: SharedValue<number>;
  startPixelPosition: SharedValue<number>;
  startScrollOffset: SharedValue<number>;
  animatedScale: SharedValue<number>;
  isActiveGesture: SharedValue<boolean>;
  activeItem: T | null;
  activeOriginalIndex: number;
  setActiveItem: (item: T | null, index: number) => void;
  handleDragStart: (id: string, index: number) => void;
  handleDragMove: (id: string, overIndex: number, position: number) => void;
  handleDragEnd: (id: string, fromIndex: number, toIndex: number) => void;
  portal: ReturnType<typeof usePortal>;
  renderItem: SortableRenderItem<T>;
  renderInsertIndicator?: (index: number) => React.ReactNode;
}

function SortableFlatListScrollModeRenderer<T>({
  containerRef,
  style,
  isHorizontal,
  containerSize,
  handleContainerLayout,
  handle,
  nativeScrollGesture,
  flatListRef,
  data,
  keyExtractor,
  flatListRenderItem,
  getItemLayout,
  scrollHandler,
  autoScrollThreshold,
  direction,
  heights,
  totalSize,
  gap,
  positions,
  currentPrefixSumSV,
  activeId,
  pressingId,
  isDragging,
  scrollOffset,
  containerStart,
  touchPosition,
  dragContentPosition,
  dragItemSize,
  gestureTranslation,
  startPosition,
  startPixelPosition,
  startScrollOffset,
  animatedScale,
  isActiveGesture,
  activeItem,
  activeOriginalIndex,
  setActiveItem,
  handleDragStart,
  handleDragMove,
  handleDragEnd,
  portal,
  renderItem,
  renderInsertIndicator,
}: SortableFlatListScrollModeRendererProps<T>) {
  const wrapperProps: Omit<GestureWrapperProps<T>, 'children'> = {
    data,
    keyExtractor,
    heights,
    totalSize,
    gap,
    containerSize,
    autoScrollThreshold,
    direction,
    positions,
    currentPrefixSum: currentPrefixSumSV,
    activeId,
    pressingId,
    isDragging,
    scrollOffset,
    containerStart,
    touchPosition,
    dragContentPosition,
    dragItemSize,
    gestureTranslation,
    startPosition,
    startPixelPosition,
    startScrollOffset,
    animatedScale,
    isActiveGesture,
    activeItem,
    activeOriginalIndex,
    setActiveItem,
    onDragStart: handleDragStart,
    onDragMove: handleDragMove,
    onDragEnd: handleDragEnd,
    scrollGesture: nativeScrollGesture,
  };

  const overlay = !portal ? (
    <DragOverlay
      item={activeItem}
      originalIndex={activeOriginalIndex}
      itemHeight={heights[activeOriginalIndex] ?? 0}
      containerSize={containerSize}
      direction={direction}
      totalSize={totalSize}
      positions={positions}
      startPixelPosition={startPixelPosition}
      gestureTranslation={gestureTranslation}
      scrollOffset={scrollOffset}
      startScrollOffset={startScrollOffset}
      animatedScale={animatedScale}
      isActive={isActiveGesture}
      renderItem={renderItem}
    />
  ) : null;

  const indicator = renderInsertIndicator ? (
    <FlatListInsertionIndicator
      positions={positions}
      activeId={activeId}
      isDragging={isDragging}
      currentPrefixSum={currentPrefixSumSV}
      scrollOffset={scrollOffset}
      direction={direction}
      renderIndicator={renderInsertIndicator}
    />
  ) : null;

  return (
    <SortableFlatListScrollModeContainer
      containerRef={containerRef}
      style={style}
      isHorizontal={isHorizontal}
      containerSize={containerSize}
      handleContainerLayout={handleContainerLayout}
      handle={handle}
      wrapperProps={wrapperProps}
      content={(
        <SortableFlatListContent
          nativeScrollGesture={nativeScrollGesture}
          flatListRef={flatListRef}
          data={data}
          keyExtractor={keyExtractor}
          isHorizontal={isHorizontal}
          flatListRenderItem={flatListRenderItem}
          getItemLayout={getItemLayout}
          scrollHandler={scrollHandler}
        />
      )}
      overlay={<>{indicator}{overlay}</>}
    />
  );
}

interface UseSortableFlatListRenderHelpersOptions<T> {
  data: T[];
  keyExtractor: (item: T) => string;
  heights: number[];
  originalPrefixSum: number[];
  direction: 'horizontal' | 'vertical';
  activeDragStyle?: import('react-native').ViewStyle;
  positions: SharedValue<{ [id: string]: number }>;
  originalPrefixSumSV: SharedValue<number[]>;
  currentPrefixSumSV: SharedValue<number[]>;
  activeId: SharedValue<string | null>;
  isDragging: SharedValue<boolean>;
  pressingId: SharedValue<string | null>;
  animatedScale: SharedValue<number>;
  handleGestureConfig?: FlatListHandleGestureConfig<T>;
  renderItem: SortableRenderItem<T>;
}

function useSortableFlatListRenderHelpers<T>({
  data,
  keyExtractor,
  heights,
  originalPrefixSum,
  direction,
  activeDragStyle,
  positions,
  originalPrefixSumSV,
  currentPrefixSumSV,
  activeId,
  isDragging,
  pressingId,
  animatedScale,
  handleGestureConfig,
  renderItem,
}: UseSortableFlatListRenderHelpersOptions<T>) {
  const flatListRenderItem = useCallback(({ item, index }: ListRenderItemInfo<T>) => {
    const itemId = keyExtractor(item);
    return (
      <FlatListCellItem
        item={item}
        itemId={itemId}
        originalIndex={index}
        itemHeight={heights[index]}
        direction={direction}
        activeDragStyle={activeDragStyle}
        positions={positions}
        originalPrefixSum={originalPrefixSumSV}
        currentPrefixSum={currentPrefixSumSV}
        activeId={activeId}
        isDragging={isDragging}
        pressingId={pressingId}
        animatedScale={animatedScale}
        handleGestureConfig={handleGestureConfig}
        renderItem={renderItem}
      />
    );
  }, [
    keyExtractor,
    heights,
    direction,
    activeDragStyle,
    positions,
    originalPrefixSumSV,
    currentPrefixSumSV,
    activeId,
    isDragging,
    pressingId,
    animatedScale,
    handleGestureConfig,
    renderItem,
  ]);

  const getItemLayout = useCallback((_data: ArrayLike<T> | null | undefined, index: number) => ({
    length: heights[index] ?? 0,
    offset: originalPrefixSum[index] ?? 0,
    index,
  }), [heights, originalPrefixSum]);

  return {
    flatListRenderItem,
    getItemLayout,
  };
}

interface UseSortableFlatListOverlayOptions<T> {
  id: string;
  activeItem: T | null;
  activeOriginalIndex: number;
  heights: number[];
  totalSize: number;
  direction: 'horizontal' | 'vertical';
  isScrollMode: boolean;
  containerStart: SharedValue<number>;
  containerStartCross: SharedValue<number>;
  containerCrossAxisSize: SharedValue<number>;
  scrollOffset: SharedValue<number>;
  startScrollOffset: SharedValue<number>;
  startPixelPosition: SharedValue<number>;
  gestureTranslation: SharedValue<number>;
  animatedScale: SharedValue<number>;
  isActiveGesture: SharedValue<boolean>;
  renderItem: SortableRenderItem<T>;
}

function useSortableFlatListOverlay<T>({
  id,
  activeItem,
  activeOriginalIndex,
  heights,
  totalSize,
  direction,
  isScrollMode,
  containerStart,
  containerStartCross,
  containerCrossAxisSize,
  scrollOffset,
  startScrollOffset,
  startPixelPosition,
  gestureTranslation,
  animatedScale,
  isActiveGesture,
  renderItem,
}: UseSortableFlatListOverlayOptions<T>) {
  const portal = usePortal();
  const zeroSV = useSharedValue(0);
  const outletPageX = portal?.outletPageX ?? zeroSV;
  const outletPageY = portal?.outletPageY ?? zeroSV;

  const isHorizontal = direction === 'horizontal';

  const portalOffsetX = useDerivedValue(() => {
    const containerPageX = isHorizontal ? containerStart.value : containerStartCross.value;
    return containerPageX - outletPageX.value;
  });
  const portalOffsetY = useDerivedValue(() => {
    const containerPageY = isHorizontal ? containerStartCross.value : containerStart.value;
    return containerPageY - outletPageY.value;
  });

  useEffect(() => {
    if (!portal) return;
    if (activeItem === null) {
      portal.setOverlay(`sortable-flatlist-${id}`, null);
      return;
    }
    portal.setOverlay(`sortable-flatlist-${id}`,
      <SortableDragOverlay
        item={activeItem}
        originalIndex={activeOriginalIndex}
        itemHeight={heights[activeOriginalIndex] ?? 0}
        totalSize={totalSize}
        direction={direction}
        mode={isScrollMode ? 'scroll' : 'fixed'}
        scrollOffset={isScrollMode ? scrollOffset : undefined}
        startScrollOffset={isScrollMode ? startScrollOffset : undefined}
        startPixelPosition={startPixelPosition}
        gestureTranslation={gestureTranslation}
        animatedScale={animatedScale}
        isActive={isActiveGesture}
        renderItem={renderItem}
        portalOffsetX={portalOffsetX}
        portalOffsetY={portalOffsetY}
        crossAxisSize={containerCrossAxisSize}
      />
    );
    return () => portal.setOverlay(`sortable-flatlist-${id}`, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portal, activeItem, activeOriginalIndex]);

  return portal;
}

// ============ SortableFlatList Component ============

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList) as typeof FlatList;

export function SortableFlatList<T>({
  id = 'default',
  data,
  renderItem,
  onReorder,
  keyExtractor,
  itemSize,
  containerSize,
  direction = 'horizontal',
  handle,
  activeDragStyle,
  renderInsertIndicator,
  dragEffect: dragEffectProp,
  autoScrollThreshold = AUTO_SCROLL_THRESHOLD,
  style,
  onDragStart: onDragStartProp,
  onDragMove: onDragMoveProp,
  onDragEnd: onDragEndProp,
}: SortableFlatListProps<T>) {
  const dragEffect = dragEffectProp ? resolveDragEffect(dragEffectProp) : undefined;
  const flatListRef = useAnimatedRef<FlatList<T>>();
  const isHoriz = direction === 'horizontal';

  const flatStyle = StyleSheet.flatten(style) as any;
  const gap = (isHoriz ? flatStyle?.columnGap : flatStyle?.rowGap) ?? flatStyle?.gap ?? 0;
  const gestureTranslation = useSharedValue(0);
  const startPosition = useSharedValue(0);
  const startPixelPosition = useSharedValue(0);
  const startScrollOffset = useSharedValue(0);
  const animatedScale = useSharedValue(1);
  const isActiveGesture = useSharedValue(false);
  const pressingId = useSharedValue<string | null>(null);
  const nativeScrollGesture = useMemo(() => Gesture.Native(), []);
  const zeroSV = useSharedValue(0);

  // Apply drag effect to overlay scale when drag becomes active
  useAnimatedReaction(
    () => isActiveGesture.value,
    (active, prev) => {
      if (active && !prev && dragEffect) {
        animatedScale.value = withSpring(dragEffect.scale, dragEffect.spring);
      }
    }
  );
  const [activeItem, setActiveItemState] = useState<T | null>(null);
  const [activeOriginalIndex, setActiveOriginalIndex] = useState(-1);
  const setActiveItem = useCallback((item: T | null, index: number) => {
    setActiveItemState(item);
    setActiveOriginalIndex(index);
  }, []);
  const onItemActivate = useCallback((item: T, index: number) => {
    setActiveItem(item, index);
  }, [setActiveItem]);
  const onItemDeactivate = useCallback(() => {
    setActiveItem(null, -1);
  }, [setActiveItem]);
  const isScrollMode = containerSize !== undefined;
  const {
    isHorizontal,
    heights,
    originalPrefixSum,
    totalSize,
    maxScroll,
    originalPrefixSumSV,
    currentPrefixSumSV,
    positions,
    activeId,
    isDragging,
    containerStart,
    containerStartCross,
    containerCrossAxisSize,
    scrollOffset,
    touchPosition,
    dragContentPosition,
    dragItemSize,
    scrollHandler,
    handleContainerLayout,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    containerRef,
  } = useSortableContainer({
    id,
    data,
    keyExtractor,
    itemSize,
    containerSize,
    direction,
    gap,
    autoScrollThreshold,
    onReorder,
    onDragStart: onDragStartProp,
    onDragMove: onDragMoveProp,
    onDragEnd: onDragEndProp,
    scrollRef: flatListRef,
    afterReorder: isScrollMode ? (_itemId, _fromIndex, toIndex) => {
      const itemPixelStart = originalPrefixSum[toIndex] ?? 0;
      const itemPixelEnd = itemPixelStart + (heights[toIndex] ?? 0);
      const cSize = containerSize!;
      const mScroll = maxScroll;
      const horiz = isHorizontal;

      runOnUI(() => {
        'worklet';
        const viewportEnd = scrollOffset.value + cSize;

        if (itemPixelEnd > viewportEnd) {
          const targetScroll = Math.min(itemPixelEnd - cSize, mScroll);
          scrollTo(flatListRef as any, horiz ? targetScroll : 0, horiz ? 0 : targetScroll, false);
        } else if (itemPixelStart < scrollOffset.value) {
          scrollTo(flatListRef as any, horiz ? itemPixelStart : 0, horiz ? 0 : itemPixelStart, false);
        }
      })();
    } : undefined,
  });
  const handleGestureConfig = useMemo<FlatListHandleGestureConfig<T> | undefined>(() => {
    if (!isScrollMode || !handle) return undefined;

    return {
      itemCount: data.length,
      totalSize,
      gap,
      isActiveGesture,
      scrollOffset,
      containerStart,
      touchPosition,
      dragContentPosition,
      dragItemSize,
      gestureTranslation,
      startPosition,
      startPixelPosition,
      startScrollOffset,
      onActivate: onItemActivate,
      onDeactivate: onItemDeactivate,
      onDragStart: handleDragStart,
      onDragMove: handleDragMove,
      onDragEnd: handleDragEnd,
      scrollGesture: nativeScrollGesture,
    };
  }, [
    isScrollMode,
    handle,
    data.length,
    totalSize,
    gap,
    isActiveGesture,
    scrollOffset,
    containerStart,
    touchPosition,
    dragContentPosition,
    dragItemSize,
    gestureTranslation,
    startPosition,
    startPixelPosition,
    startScrollOffset,
    onItemActivate,
    onItemDeactivate,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    nativeScrollGesture,
  ]);
  const { flatListRenderItem, getItemLayout } = useSortableFlatListRenderHelpers({
    data,
    keyExtractor,
    heights,
    originalPrefixSum,
    direction,
    activeDragStyle,
    positions,
    originalPrefixSumSV,
    currentPrefixSumSV,
    activeId,
    isDragging,
    pressingId,
    animatedScale,
    handleGestureConfig,
    renderItem,
  });
  const portal = useSortableFlatListOverlay({
    id,
    activeItem,
    activeOriginalIndex,
    heights,
    totalSize,
    direction,
    isScrollMode,
    containerStart,
    containerStartCross,
    containerCrossAxisSize,
    scrollOffset,
    startScrollOffset,
    startPixelPosition,
    gestureTranslation,
    animatedScale,
    isActiveGesture,
    renderItem,
  });
  if (isScrollMode) {
    return (
      <SortableFlatListScrollModeRenderer
        containerRef={containerRef}
        style={style}
        isHorizontal={isHorizontal}
        containerSize={containerSize!}
        handleContainerLayout={handleContainerLayout}
        handle={handle}
        nativeScrollGesture={nativeScrollGesture}
        flatListRef={flatListRef}
        data={data}
        keyExtractor={keyExtractor}
        flatListRenderItem={flatListRenderItem}
        getItemLayout={getItemLayout}
        scrollHandler={scrollHandler}
        autoScrollThreshold={autoScrollThreshold}
        direction={direction}
        heights={heights}
        totalSize={totalSize}
        gap={gap}
        positions={positions}
        currentPrefixSumSV={currentPrefixSumSV}
        activeId={activeId}
        pressingId={pressingId}
        isDragging={isDragging}
        scrollOffset={scrollOffset}
        containerStart={containerStart}
        touchPosition={touchPosition}
        dragContentPosition={dragContentPosition}
        dragItemSize={dragItemSize}
        gestureTranslation={gestureTranslation}
        startPosition={startPosition}
        startPixelPosition={startPixelPosition}
        startScrollOffset={startScrollOffset}
        animatedScale={animatedScale}
        isActiveGesture={isActiveGesture}
        activeItem={activeItem}
        activeOriginalIndex={activeOriginalIndex}
        setActiveItem={setActiveItem}
        handleDragStart={handleDragStart}
        handleDragMove={handleDragMove}
        handleDragEnd={handleDragEnd}
        portal={portal}
        renderItem={renderItem}
        renderInsertIndicator={renderInsertIndicator}
      />
    );
  }
  const containerStyle = [
    sortableStyles.container,
    isHorizontal
      ? { flexDirection: 'row' as const }
      : { flexDirection: 'column' as const },
    style,
  ];
  return (
    <View style={{ overflow: 'visible' as const }}>
      <View
        ref={containerRef}
        style={containerStyle}
        onLayout={handleContainerLayout}
      >
        {data.map((item, index) => (
          <FixedSortableItem
            key={keyExtractor(item)}
            item={item}
            itemId={keyExtractor(item)}
            originalIndex={index}
            itemCount={data.length}
            itemHeight={heights[index]}
            totalSize={totalSize}
            gap={gap}
            direction={direction}
            handle={handle}
            activeDragStyle={activeDragStyle}
            zoneId={id}
            positions={positions}
            originalPrefixSum={originalPrefixSumSV}
            currentPrefixSum={currentPrefixSumSV}
            activeId={activeId}
            isDragging={isDragging}
            containerStart={containerStart}
            liftedGestureTranslation={gestureTranslation}
            liftedStartPixelPosition={startPixelPosition}
            liftedAnimatedScale={animatedScale}
            liftedIsActive={isActiveGesture}
            onActivate={onItemActivate}
            onDeactivate={onItemDeactivate}
            renderItem={renderItem}
            onDragStart={handleDragStart}
            onDragMove={handleDragMove}
            onDragEnd={handleDragEnd}
          />
        ))}
        {renderInsertIndicator && (
          <FlatListInsertionIndicator
            positions={positions}
            activeId={activeId}
            isDragging={isDragging}
            currentPrefixSum={currentPrefixSumSV}
            scrollOffset={zeroSV}
            direction={direction}
            renderIndicator={renderInsertIndicator}
          />
        )}
      </View>

      {!portal && (
        <SortableDragOverlay
          item={activeItem}
          originalIndex={activeOriginalIndex}
          itemHeight={heights[activeOriginalIndex] ?? 0}
          totalSize={totalSize}
          direction={direction}
          mode="fixed"
          startPixelPosition={startPixelPosition}
          gestureTranslation={gestureTranslation}
          animatedScale={animatedScale}
          isActive={isActiveGesture}
          renderItem={renderItem}
        />
      )}
    </View>
  );
}
