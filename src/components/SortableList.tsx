import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  useAnimatedRef,
  useDerivedValue,
  withTiming,
  runOnJS,
  type SharedValue,
} from 'react-native-reanimated';
import { objectMove, clamp } from '../utils/sortable';
import { resolveDragEffect, type DragEffectConfig } from '../animations/dragEffects';
import { getIndexAtMidpoint } from '../utils/heights';
import { DraggableItemContext } from './Draggable';
import {
  TIMING_CONFIG,
  LONG_PRESS_DURATION,
  ACTIVE_SCALE,
  AUTO_SCROLL_THRESHOLD,
  useSortableContainer,
  sortableStyles,
  SortableItemRenderer,
} from './sortable-shared';

// ============ Types ============

interface SortableListProps<T> {
  id?: string;
  data: T[];
  renderItem: (info: { item: T; index: number; isDragging: boolean }) => React.ReactNode;
  onReorder: (data: T[], event: { fromIndex: number; toIndex: number; item: T }) => void;
  keyExtractor: (item: T) => string;
  itemSize: number | ((index: number) => number);
  containerSize?: number;
  direction?: 'horizontal' | 'vertical';
  autoScrollThreshold?: number;
  style?: any;
  onDragStart?: (id: string, index: number) => void;
  onDragMove?: (id: string, overIndex: number, position: number) => void;
  onDragEnd?: (id: string, fromIndex: number, toIndex: number) => void;
  handle?: boolean;
  activeDragStyle?: import('react-native').ViewStyle;
  renderInsertIndicator?: (index: number) => React.ReactNode;
  dragEffect?: import('../animations/dragEffects').DragEffect | import('../animations/dragEffects').DragEffectConfig;
  /** Long press duration in ms before drag activates (default: 200) */
  longPressDuration?: number;
  /** Called when an item is tapped (not dragged). Suppressed after a drag completes. */
  onItemPress?: (item: T, index: number) => void;
}

// ============ SortableItem (unified for fixed + scroll) ============

interface SortableItemProps<T> {
  item: T;
  itemId: string;
  originalIndex: number;
  itemCount: number;
  itemHeight: number;
  totalSize: number;
  gap: number;
  direction: 'horizontal' | 'vertical';
  handle?: boolean;
  dragEffectConfig?: DragEffectConfig;
  /** JS-computed pixel position for this item (avoids stale shared value reads) */
  initialPixelPosition: number;
  positions: SharedValue<{ [id: string]: number }>;
  activeId: SharedValue<string | null>;
  isDragging: SharedValue<boolean>;
  originalPrefixSum: SharedValue<number[]>;
  currentPrefixSum: SharedValue<number[]>;
  scrollOffset: SharedValue<number>;
  touchPosition: SharedValue<number>;
  dragContentPosition: SharedValue<number>;
  dragItemSize: SharedValue<number>;
  isScrollMode: boolean;
  renderItem: (info: { item: T; index: number; isDragging: boolean }) => React.ReactNode;
  onDragStart: (id: string, index: number) => void;
  onDragMove: (id: string, overIndex: number, position: number) => void;
  onDragEnd: (id: string, fromIndex: number, toIndex: number) => void;
  longPressDuration?: number;
  onItemPress?: (item: T, index: number) => void;
}

function SortableItemInner<T>({
  item,
  itemId,
  originalIndex,
  itemCount,
  itemHeight,
  totalSize,
  gap,
  direction,
  handle,
  dragEffectConfig,
  initialPixelPosition,
  positions,
  activeId,
  isDragging,
  originalPrefixSum,
  currentPrefixSum,
  scrollOffset,
  touchPosition,
  dragContentPosition,
  dragItemSize,
  isScrollMode,
  renderItem,
  onDragStart,
  onDragMove,
  onDragEnd,
  longPressDuration,
  onItemPress,
}: SortableItemProps<T>) {
  const isActive = useSharedValue(false);
  const isPressing = useSharedValue(false);
  const startPositionIndex = useSharedValue(0);
  const startPixelPos = useSharedValue(0);
  const startScrollOffset = useSharedValue(0);
  const gestureTranslation = useSharedValue(0);
  const animatedPosition = useSharedValue(initialPixelPosition);
  const dragEndFired = useSharedValue(false);
  const isHorizontal = direction === 'horizontal';

  const currentPosition = useDerivedValue(() => {
    return positions.value[itemId] ?? originalIndex;
  });

  // Reset position when data changes externally (e.g. after reorder).
  // Uses JS-computed pixel position (not shared value) to avoid stale reads —
  // parent useEffect that updates shared values runs AFTER children useEffects.
  useEffect(() => {
    animatedPosition.value = initialPixelPosition;
  }, [initialPixelPosition]);

  // Animate to new position when swapped by another item's drag.
  // Watch the computed pixel position (not just the index) so that variable-height
  // changes are detected even when the position index stays the same.
  useAnimatedReaction(
    () => {
      const pos = positions.value[itemId] ?? originalIndex;
      return currentPrefixSum.value[pos] ?? 0;
    },
    (targetPos, prevTargetPos) => {
      if (!isActive.value && prevTargetPos !== null && targetPos !== prevTargetPos) {
        animatedPosition.value = withTiming(targetPos, TIMING_CONFIG);
      }
    }
  );

  // Scroll mode: check for swaps during auto-scroll (finger stationary, scroll moving)
  useAnimatedReaction(
    () => scrollOffset.value,
    (scroll, prevScroll) => {
      if (!isActive.value || prevScroll === null || !isScrollMode) return;

      const scrollChange = scroll - startScrollOffset.value;
      const rawContentPos = startPixelPos.value + gestureTranslation.value + scrollChange;
      const contentPos = clamp(rawContentPos, 0, totalSize - itemHeight);

      // Keep auto-scroll gating in sync
      dragContentPosition.value = contentPos;

      // Swap detection using unclamped center
      const itemCenter = rawContentPos + itemHeight / 2;
      const newIndex = getIndexAtMidpoint(currentPrefixSum.value, itemCenter, itemCount, gap);
      const currentIndex = positions.value[itemId];

      if (newIndex !== currentIndex) {
        positions.value = objectMove(positions.value, currentIndex, newIndex);
      }
    },
    [itemCount, totalSize, itemHeight, isScrollMode]
  );

  const panGesture = Gesture.Pan()
    .activateAfterLongPress(longPressDuration ?? LONG_PRESS_DURATION)
    .onBegin(() => {
      'worklet';
      isPressing.value = true;
    })
    .onStart(() => {
      'worklet';
      const currentPos = positions.value[itemId];
      const pixelPos = currentPrefixSum.value[currentPos] ?? 0;

      isActive.value = true;
      isPressing.value = false;
      activeId.value = itemId;
      isDragging.value = true;
      startPositionIndex.value = currentPos;
      startPixelPos.value = pixelPos;
      startScrollOffset.value = scrollOffset.value;
      gestureTranslation.value = 0;
      animatedPosition.value = pixelPos;
      dragEndFired.value = false;

      if (isScrollMode) {
        dragContentPosition.value = pixelPos;
        dragItemSize.value = itemHeight;
      }

      runOnJS(onDragStart)(itemId, currentPos);
    })
    .onUpdate((event) => {
      'worklet';
      if (!isActive.value) return;

      const translation = isHorizontal ? event.translationX : event.translationY;
      gestureTranslation.value = translation;

      // Calculate content position
      let rawContentPos = startPixelPos.value + translation;
      if (isScrollMode) {
        rawContentPos += scrollOffset.value - startScrollOffset.value;
        dragContentPosition.value = clamp(rawContentPos, 0, totalSize - itemHeight);
      }

      // Swap detection using unclamped center
      const itemCenter = rawContentPos + itemHeight / 2;
      const newIndex = getIndexAtMidpoint(currentPrefixSum.value, itemCenter, itemCount, gap);
      const currentIndex = positions.value[itemId];

      if (newIndex !== currentIndex) {
        positions.value = objectMove(positions.value, currentIndex, newIndex);
        runOnJS(onDragMove)(itemId, newIndex, clamp(rawContentPos, 0, totalSize - itemHeight));
      }

      // Update touch position for auto-scroll
      if (isScrollMode) {
        touchPosition.value = isHorizontal ? event.absoluteX : event.absoluteY;
      }
    })
    .onEnd(() => {
      'worklet';
      const finalIndex = positions.value[itemId];
      const fromIndex = startPositionIndex.value;
      const finalPos = currentPrefixSum.value[finalIndex] ?? 0;

      // Calculate current visual position (for seamless snap-back)
      let currentContentPos = startPixelPos.value + gestureTranslation.value;
      if (isScrollMode) {
        currentContentPos += scrollOffset.value - startScrollOffset.value;
      }
      currentContentPos = clamp(currentContentPos, 0, totalSize - itemHeight);

      // Set animated position to current visual position BEFORE deactivating
      animatedPosition.value = currentContentPos;

      // Deactivate
      isActive.value = false;
      isPressing.value = false;
      activeId.value = null;
      isDragging.value = false;

      // Animate to final position, then fire callback
      animatedPosition.value = withTiming(finalPos, TIMING_CONFIG, () => {
        'worklet';
        if (fromIndex !== finalIndex && !dragEndFired.value) {
          dragEndFired.value = true;
          runOnJS(onDragEnd)(itemId, fromIndex, finalIndex);
        }
      });
    })
    .onFinalize((_event, success) => {
      'worklet';
      if (!success && isActive.value) {
        // Gesture cancelled while active — animate back
        const currentPos = positions.value[itemId];
        const targetPos = currentPrefixSum.value[currentPos] ?? 0;

        let currentContentPos = startPixelPos.value + gestureTranslation.value;
        if (isScrollMode) {
          currentContentPos += scrollOffset.value - startScrollOffset.value;
        }
        currentContentPos = clamp(currentContentPos, 0, totalSize - itemHeight);

        animatedPosition.value = currentContentPos;
        isActive.value = false;
        isPressing.value = false;
        activeId.value = null;
        isDragging.value = false;

        animatedPosition.value = withTiming(targetPos, TIMING_CONFIG);
      } else if (!success) {
        isPressing.value = false;
      }
    });

  const tapGesture = onItemPress
    ? Gesture.Tap().onEnd(() => {
        'worklet';
        runOnJS(onItemPress)(item, originalIndex);
      })
    : null;

  const gesture = tapGesture
    ? Gesture.Exclusive(panGesture, tapGesture)
    : panGesture;

  const animatedStyle = useAnimatedStyle(() => {
    const active = isActive.value;
    const pressing = isPressing.value;

    let mainAxisPos: number;
    if (active) {
      let raw = startPixelPos.value + gestureTranslation.value;
      if (isScrollMode) {
        raw += scrollOffset.value - startScrollOffset.value;
      }
      mainAxisPos = clamp(raw, 0, totalSize - itemHeight);
    } else {
      mainAxisPos = animatedPosition.value;
    }

    const dragScale = dragEffectConfig?.scale ?? 1.03;
    const scale = active
      ? dragScale
      : pressing
        ? ACTIVE_SCALE
        : 1;

    return {
      position: 'absolute' as const,
      [isHorizontal ? 'left' : 'top']: mainAxisPos,
      [isHorizontal ? 'top' : 'left']: 0,
      zIndex: active ? 9999 : pressing ? 9998 : 0,
      transform: [{ scale }],
      shadowColor: '#000',
      shadowOpacity: active ? 0.35 : pressing ? 0.15 : 0,
      shadowRadius: active ? 20 : pressing ? 8 : 0,
      shadowOffset: { width: 0, height: active ? 12 : pressing ? 4 : 0 },
      elevation: active ? 24 : pressing ? 6 : 0,
    };
  });

  const sizeStyle = isHorizontal
    ? { width: itemHeight, height: '100%' as const }
    : { height: itemHeight, width: '100%' as const };

  const content = (
    <Animated.View style={[sizeStyle, animatedStyle] as any}>
      <SortableItemRenderer
        item={item}
        index={originalIndex}
        isDragging={false}
        renderer={renderItem}
      />
    </Animated.View>
  );

  if (handle) {
    return (
      <DraggableItemContext.Provider value={{ gesture: panGesture }}>
        {content}
      </DraggableItemContext.Provider>
    );
  }

  return <GestureDetector gesture={gesture}>{content}</GestureDetector>;
}

const SortableItem = React.memo(SortableItemInner) as typeof SortableItemInner;

// ============ SortableInsertionIndicator ============

interface SortableInsertionIndicatorProps {
  positions: SharedValue<{ [id: string]: number }>;
  activeId: SharedValue<string | null>;
  isDragging: SharedValue<boolean>;
  currentPrefixSum: SharedValue<number[]>;
  direction: 'horizontal' | 'vertical';
  renderIndicator: (index: number) => React.ReactNode;
}

function SortableInsertionIndicator({
  positions,
  activeId,
  isDragging,
  currentPrefixSum,
  direction,
  renderIndicator,
}: SortableInsertionIndicatorProps) {
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
      return { idx, position: ps[posIdx] ?? 0 };
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

// ============ SortableList ============

// Static styles (prevent Fabric re-commits from inline style objects)
const wrapperStyle = StyleSheet.create({
  root: { overflow: 'visible' as const },
});

const localStyles = StyleSheet.create({
  contentRelative: {
    position: 'relative',
  },
  fixedContainer: {
    position: 'relative',
    overflow: 'visible',
  },
});

export function SortableList<T>({
  id = 'default',
  data,
  renderItem,
  onReorder,
  keyExtractor,
  itemSize,
  containerSize,
  direction = 'vertical',
  autoScrollThreshold = AUTO_SCROLL_THRESHOLD,
  style,
  handle,
  activeDragStyle,
  renderInsertIndicator,
  dragEffect: dragEffectProp,
  onDragStart: onDragStartProp,
  onDragMove: onDragMoveProp,
  onDragEnd: onDragEndProp,
  longPressDuration,
  onItemPress,
}: SortableListProps<T>) {
  const dragEffectConfig = dragEffectProp ? resolveDragEffect(dragEffectProp) : undefined;
  const scrollViewRef = useAnimatedRef<Animated.ScrollView>();
  const isHoriz = direction === 'horizontal';

  // Extract gap from user's style
  const flatStyle = StyleSheet.flatten(style) as any;
  const gap = (isHoriz ? flatStyle?.columnGap : flatStyle?.rowGap) ?? flatStyle?.gap ?? 0;

  const {
    isScrollMode,
    isHorizontal,
    heights,
    totalSize,
    originalPrefixSum,
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
    scrollRef: scrollViewRef,
  });

  // Render items
  const items = data.map((item, index) => (
    <SortableItem
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
      dragEffectConfig={dragEffectConfig}
      initialPixelPosition={originalPrefixSum[index] ?? 0}
      positions={positions}
      activeId={activeId}
      isDragging={isDragging}
      originalPrefixSum={originalPrefixSumSV}
      currentPrefixSum={currentPrefixSumSV}
      scrollOffset={scrollOffset}
      touchPosition={touchPosition}
      dragContentPosition={dragContentPosition}
      dragItemSize={dragItemSize}
      isScrollMode={isScrollMode}
      renderItem={renderItem}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      longPressDuration={longPressDuration}
      onItemPress={onItemPress}
    />
  ));

  const indicator = renderInsertIndicator ? (
    <SortableInsertionIndicator
      positions={positions}
      activeId={activeId}
      isDragging={isDragging}
      currentPrefixSum={currentPrefixSumSV}
      direction={direction}
      renderIndicator={renderInsertIndicator}
    />
  ) : null;

  // Scroll mode
  if (isScrollMode) {
    const scrollContainerSize = isHorizontal
      ? { width: containerSize, height: '100%' as const }
      : { height: containerSize, width: '100%' as const };

    const contentSize = isHorizontal
      ? { width: totalSize, height: '100%' as const }
      : { height: totalSize, width: '100%' as const };

    return (
      <View style={wrapperStyle.root}>
        <View
          ref={containerRef}
          style={[sortableStyles.container, scrollContainerSize, style]}
          onLayout={handleContainerLayout}
        >
          <Animated.ScrollView
            ref={scrollViewRef}
            horizontal={isHorizontal}
            onScroll={scrollHandler}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={!isHorizontal}
            showsHorizontalScrollIndicator={isHorizontal}
            bounces={false}
            overScrollMode="never"
          >
            <View style={[localStyles.contentRelative, contentSize]}>
              {items}
              {indicator}
            </View>
          </Animated.ScrollView>
        </View>
      </View>
    );
  }

  // Fixed mode
  const fixedContainerSize = isHorizontal
    ? { width: totalSize, flexDirection: 'row' as const }
    : { height: totalSize, flexDirection: 'column' as const };

  return (
    <View style={wrapperStyle.root}>
      <View
        ref={containerRef}
        style={[localStyles.fixedContainer, fixedContainerSize, style]}
        onLayout={handleContainerLayout}
      >
        {items}
        {indicator}
      </View>
    </View>
  );
}
