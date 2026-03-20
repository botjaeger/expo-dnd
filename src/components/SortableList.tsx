import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
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
  type SharedValue,
} from 'react-native-reanimated';
import { objectMove, clamp } from '../utils/sortable';
import { resolveDragEffect } from '../animations/dragEffects';
import { getIndexAtMidpoint } from '../utils/heights';
import { DraggableItemContext } from './Draggable';
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
import { usePortal } from '../portal/usePortal';

interface SortableListProps<T> {
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
  dragEffect?: import('../animations/dragEffects').DragEffect | import('../animations/dragEffects').DragEffectConfig;
}

// ============ Scroll Mode SortableItem (with auto-scroll) ============

interface ScrollSortableItemProps<T> {
  item: T;
  itemId: string;
  originalIndex: number;
  itemCount: number;
  itemHeight: number;
  totalSize: number;
  gap: number;
  containerSize: number;
  autoScrollThreshold: number;
  direction: 'horizontal' | 'vertical';
  handle?: boolean;
  activeDragStyle?: import('react-native').ViewStyle;
  positions: SharedValue<{ [id: string]: number }>;
  originalPrefixSum: SharedValue<number[]>;
  currentPrefixSum: SharedValue<number[]>;
  activeId: SharedValue<string | null>;
  isDragging: SharedValue<boolean>;
  scrollOffset: SharedValue<number>;
  containerStart: SharedValue<number>;
  touchPosition: SharedValue<number>;
  /** Dragged item content position for auto-scroll gating */
  dragContentPosition: SharedValue<number>;
  dragItemSize: SharedValue<number>;
  /** Lifted shared values for overlay */
  liftedGestureTranslation: SharedValue<number>;
  liftedStartPixelPosition: SharedValue<number>;
  liftedStartScrollOffset: SharedValue<number>;
  liftedAnimatedScale: SharedValue<number>;
  liftedIsActive: SharedValue<boolean>;
  onActivate: (item: T, index: number) => void;
  onDeactivate: () => void;
  renderItem: (info: { item: T; index: number; isDragging: boolean }) => React.ReactNode;
  onDragStart: (id: string, index: number) => void;
  onDragMove: (id: string, overIndex: number, position: number) => void;
  onDragEnd: (id: string, fromIndex: number, toIndex: number) => void;
}

function ScrollSortableItemInner<T>({
  item,
  itemId,
  originalIndex,
  itemCount,
  itemHeight,
  totalSize,
  gap,
  containerSize,
  autoScrollThreshold,
  direction,
  handle,
  activeDragStyle,
  positions,
  originalPrefixSum,
  currentPrefixSum,
  activeId,
  isDragging,
  scrollOffset,
  containerStart,
  touchPosition,
  dragContentPosition,
  dragItemSize,
  liftedGestureTranslation,
  liftedStartPixelPosition,
  liftedStartScrollOffset,
  liftedAnimatedScale,
  liftedIsActive,
  onActivate,
  onDeactivate,
  renderItem,
  onDragStart,
  onDragMove,
  onDragEnd,
}: ScrollSortableItemProps<T>) {
  const isActive = useSharedValue(false);
  const isPressing = useSharedValue(false);
  const startPosition = useSharedValue(0);
  const startScrollOffset_ = useSharedValue(0);
  const startPixelPosition = useSharedValue(0);
  const animatedPosition = useSharedValue(0);
  const gestureTranslation = useSharedValue(0);
  const dragEndFired = useSharedValue(false);
  const isHorizontal = direction === 'horizontal';

  const currentPosition = useDerivedValue(() => {
    return positions.value[itemId] ?? originalIndex;
  });

  useEffect(() => {
    animatedPosition.value = originalPrefixSum.value[originalIndex] ?? 0;
  }, [originalIndex]);

  useAnimatedReaction(
    () => currentPosition.value,
    (pos, prevPos) => {
      if (prevPos !== null && pos !== prevPos && !isActive.value) {
        const targetPosition = currentPrefixSum.value[pos] ?? 0;
        animatedPosition.value = withTiming(targetPosition, TIMING_CONFIG);
      }
    }
  );

  // Check for position swaps during auto-scroll and update dragContentPosition
  useAnimatedReaction(
    () => scrollOffset.value,
    (scroll, prevScroll) => {
      if (!isActive.value || prevScroll === null) return;

      const scrollChange = scroll - startScrollOffset_.value;
      const rawContentPos = startPixelPosition.value + gestureTranslation.value + scrollChange;
      const contentPos = clamp(rawContentPos, 0, totalSize - itemHeight);

      // Keep auto-scroll gating in sync as scroll changes
      dragContentPosition.value = contentPos;

      // Use unclamped position so tall items can reach edge slots
      const itemCenter = rawContentPos + itemHeight / 2;
      const newIndex = getIndexAtMidpoint(currentPrefixSum.value, itemCenter, itemCount, gap);
      const currentIndex = positions.value[itemId];

      if (newIndex !== currentIndex) {
        positions.value = objectMove(positions.value, currentIndex, newIndex);
      }
    },
    [itemCount, totalSize, itemHeight]
  );

  const longPressGesture = Gesture.LongPress()
    .minDuration(LONG_PRESS_DURATION)
    .onBegin(() => {
      'worklet';
      isPressing.value = true;
      liftedAnimatedScale.value = withTiming(ACTIVE_SCALE, { duration: 100 });
    })
    .onFinalize(() => {
      'worklet';
      if (!isActive.value) {
        isPressing.value = false;
        liftedAnimatedScale.value = withTiming(1, { duration: 100 });
      }
    });

  const panGesture = Gesture.Pan()
    .activateAfterLongPress(LONG_PRESS_DURATION)
    .onStart((event) => {
      'worklet';
      const currentPos = positions.value[itemId];
      isActive.value = true;
      isPressing.value = false;
      activeId.value = itemId;
      isDragging.value = true;
      startPosition.value = currentPos;
      dragEndFired.value = false;
      startScrollOffset_.value = scrollOffset.value;

      const pixelPos = currentPrefixSum.value[currentPos] ?? 0;
      startPixelPosition.value = pixelPos;

      liftedAnimatedScale.value = withTiming(ACTIVE_SCALE, SCALE_CONFIG);
      liftedStartPixelPosition.value = pixelPos;
      liftedStartScrollOffset.value = scrollOffset.value;
      liftedIsActive.value = true;

      animatedPosition.value = pixelPos;
      gestureTranslation.value = 0;
      liftedGestureTranslation.value = 0;

      // Initialize drag content position for auto-scroll gating
      dragContentPosition.value = pixelPos;
      dragItemSize.value = itemHeight;

      runOnJS(onActivate)(item, originalIndex);
      runOnJS(onDragStart)(itemId, currentPos);
    })
    .onUpdate((event) => {
      'worklet';
      if (!isActive.value) return;

      const translation = isHorizontal ? event.translationX : event.translationY;
      gestureTranslation.value = translation;
      liftedGestureTranslation.value = translation;

      const scrollChange = scrollOffset.value - startScrollOffset_.value;
      const rawContentPos = startPixelPosition.value + translation + scrollChange;
      const contentPos = clamp(rawContentPos, 0, totalSize - itemHeight);

      // Update dragged item content position for auto-scroll gating
      dragContentPosition.value = contentPos;

      // Use unclamped position for swap detection so tall items can reach edge slots
      const itemCenter = rawContentPos + itemHeight / 2;
      const newIndex = getIndexAtMidpoint(currentPrefixSum.value, itemCenter, itemCount, gap);
      const currentIndex = positions.value[itemId];

      if (newIndex !== currentIndex) {
        positions.value = objectMove(positions.value, currentIndex, newIndex);
        runOnJS(onDragMove)(itemId, newIndex, contentPos);
      }

      // Update touch position for auto-scroll detection (handled by useAutoScroll hook)
      touchPosition.value = isHorizontal ? event.absoluteX : event.absoluteY;
    })
    .onEnd(() => {
      'worklet';
      const finalIndex = positions.value[itemId];
      const fromIndex = startPosition.value;
      const finalPosition = currentPrefixSum.value[finalIndex] ?? 0;

      isDragging.value = false;
      isPressing.value = false;
      isActive.value = false;
      activeId.value = null;

      liftedAnimatedScale.value = withTiming(1, SCALE_CONFIG);

      const scrollChange = scrollOffset.value - startScrollOffset_.value;
      const currentContentPos = clamp(
        startPixelPosition.value + gestureTranslation.value + scrollChange,
        0,
        totalSize - itemHeight
      );

      // Keep overlay visible during snap-back; hide in animation callback
      animatedPosition.value = currentContentPos;
      animatedPosition.value = withTiming(finalPosition, TIMING_CONFIG, () => {
        'worklet';
        liftedIsActive.value = false;
        runOnJS(onDeactivate)();
        if (fromIndex !== finalIndex && !dragEndFired.value) {
          dragEndFired.value = true;
          runOnJS(onDragEnd)(itemId, fromIndex, finalIndex);
        }
      });
    })
    .onFinalize((_event, success) => {
      'worklet';
      if (!success && isActive.value) {
        const currentPos = positions.value[itemId];
        const targetPosition = currentPrefixSum.value[currentPos] ?? 0;

        isDragging.value = false;
        isPressing.value = false;
        isActive.value = false;
        activeId.value = null;

        liftedAnimatedScale.value = withTiming(1, SCALE_CONFIG);

        const scrollChange = scrollOffset.value - startScrollOffset_.value;
        const currentContentPos = clamp(
          startPixelPosition.value + gestureTranslation.value + scrollChange,
          0,
          totalSize - itemHeight
        );

        animatedPosition.value = currentContentPos;
        animatedPosition.value = withTiming(targetPosition, TIMING_CONFIG, () => {
          'worklet';
          liftedIsActive.value = false;
          runOnJS(onDeactivate)();
        });
      }
    });

  const gesture = Gesture.Simultaneous(longPressGesture, panGesture);

  const animatedStyle = useAnimatedStyle(() => {
    // Active item is hidden — the overlay renders it
    if (isActive.value) {
      const scrollChange = scrollOffset.value - startScrollOffset_.value;
      const rawContentPos = startPixelPosition.value + gestureTranslation.value + scrollChange;
      const contentPosition = clamp(rawContentPos, 0, totalSize - itemHeight);

      return {
        position: 'absolute' as const,
        [isHorizontal ? 'left' : 'top']: contentPosition,
        [isHorizontal ? 'top' : 'left']: 0,
        opacity: activeDragStyle?.opacity ?? 0,
        zIndex: 0,
      };
    }

    if (isPressing.value) {
      return {
        position: 'absolute' as const,
        [isHorizontal ? 'left' : 'top']: animatedPosition.value,
        [isHorizontal ? 'top' : 'left']: 0,
        opacity: 1,
        zIndex: 99999,
        transform: [{ scale: liftedAnimatedScale.value }],
        shadowColor: '#000',
        shadowOpacity: 0.35,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 12 },
        elevation: 24,
      };
    }

    return {
      position: 'absolute' as const,
      [isHorizontal ? 'left' : 'top']: animatedPosition.value,
      [isHorizontal ? 'top' : 'left']: 0,
      opacity: 1,
      zIndex: 0,
      transform: [{ scale: 1 }],
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    };
  });

  const sizeStyle = isHorizontal
    ? { width: itemHeight, height: '100%' as const }
    : { height: itemHeight, width: '100%' as const };

  const currentIndex = originalIndex;

  const content = (
    <Animated.View style={[sizeStyle, animatedStyle] as any}>
      <SortableItemRenderer
        item={item}
        index={currentIndex}
        isDragging={false}
        renderer={renderItem}
      />
    </Animated.View>
  );

  if (handle) {
    return (
      <DraggableItemContext.Provider value={{ gesture }}>
        {content}
      </DraggableItemContext.Provider>
    );
  }

  return <GestureDetector gesture={gesture}>{content}</GestureDetector>;
}

const ScrollSortableItem = React.memo(ScrollSortableItemInner) as typeof ScrollSortableItemInner;

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
      // Show indicator at bottom edge of the active item's current slot (inner)
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

// ============ Sortable Component ============

export function SortableList<T>({
  id = 'default',
  data,
  renderItem,
  onReorder,
  keyExtractor,
  itemSize,
  containerSize,
  direction = 'horizontal',
  autoScrollThreshold = AUTO_SCROLL_THRESHOLD,
  style,
  handle,
  activeDragStyle,
  renderInsertIndicator,
  dragEffect: dragEffectProp,
  onDragStart: onDragStartProp,
  onDragMove: onDragMoveProp,
  onDragEnd: onDragEndProp,
}: SortableListProps<T>) {
  const dragEffect = dragEffectProp ? resolveDragEffect(dragEffectProp) : undefined;
  const scrollViewRef = useAnimatedRef<Animated.ScrollView>();
  const isHoriz = direction === 'horizontal';

  // Extract gap from user's style so position calculations account for it automatically
  const flatStyle = StyleSheet.flatten(style) as any;
  const gap = (isHoriz ? flatStyle?.columnGap : flatStyle?.rowGap) ?? flatStyle?.gap ?? 0;

  const portal = usePortal();
  const zeroSV = useSharedValue(0);
  const outletPageX = portal?.outletPageX ?? zeroSV;
  const outletPageY = portal?.outletPageY ?? zeroSV;

  const {
    isScrollMode,
    isHorizontal,
    heights,
    totalSize,
    originalPrefixSumSV,
    currentPrefixSumSV,
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

  // Lifted shared values for the drag overlay
  const liftedGestureTranslation = useSharedValue(0);
  const liftedStartPixelPosition = useSharedValue(0);
  const liftedStartScrollOffset = useSharedValue(0);
  const liftedAnimatedScale = useSharedValue(1);
  const liftedIsActive = useSharedValue(false);

  // Apply drag effect to overlay scale when drag becomes active
  useAnimatedReaction(
    () => liftedIsActive.value,
    (active, prev) => {
      if (active && !prev && dragEffect) {
        liftedAnimatedScale.value = withSpring(dragEffect.scale, dragEffect.spring);
      }
    }
  );

  // Active item state for overlay rendering (JS thread)
  const [activeItem, setActiveItemState] = useState<T | null>(null);
  const [activeOriginalIndex, setActiveOriginalIndex] = useState(-1);

  const onActivate = useCallback((item: T, index: number) => {
    setActiveItemState(item);
    setActiveOriginalIndex(index);
  }, []);

  const onDeactivate = useCallback(() => {
    setActiveItemState(null);
    setActiveOriginalIndex(-1);
  }, []);

  // Portal offsets: convert container-relative overlay position to portal-relative
  const portalOffsetX = useDerivedValue(() => {
    const containerPageX = isHorizontal ? containerStart.value : containerStartCross.value;
    return containerPageX - outletPageX.value;
  });
  const portalOffsetY = useDerivedValue(() => {
    const containerPageY = isHorizontal ? containerStartCross.value : containerStart.value;
    return containerPageY - outletPageY.value;
  });

  // Send overlay through portal when available
  useEffect(() => {
    if (!portal) return;
    if (activeItem === null) {
      portal.setOverlay(`sortable-${id}`, null);
      return;
    }
    portal.setOverlay(`sortable-${id}`,
      <SortableDragOverlay
        item={activeItem}
        originalIndex={activeOriginalIndex}
        itemHeight={heights[activeOriginalIndex] ?? 0}
        totalSize={totalSize}
        direction={direction}
        mode={isScrollMode ? 'scroll' : 'fixed'}
        scrollOffset={isScrollMode ? scrollOffset : undefined}
        startScrollOffset={isScrollMode ? liftedStartScrollOffset : undefined}
        startPixelPosition={liftedStartPixelPosition}
        gestureTranslation={liftedGestureTranslation}
        animatedScale={liftedAnimatedScale}
        isActive={liftedIsActive}
        renderItem={renderItem}
        portalOffsetX={portalOffsetX}
        portalOffsetY={portalOffsetY}
        crossAxisSize={containerCrossAxisSize}
      />
    );
    return () => portal.setOverlay(`sortable-${id}`, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portal, activeItem, activeOriginalIndex]);

  // Scroll mode rendering
  if (isScrollMode) {
    const scrollContainerStyle = isHorizontal
      ? { width: containerSize, height: '100%' as const }
      : { height: containerSize, width: '100%' as const };

    const contentContainerStyle = isHorizontal
      ? { width: totalSize, height: '100%' as const }
      : { height: totalSize, width: '100%' as const };

    return (
      <View style={{ overflow: 'visible' as const }}>
        <View
          ref={containerRef}
          style={[sortableStyles.container, scrollContainerStyle, style]}
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
            <View style={[sortableStyles.content, contentContainerStyle, { position: 'relative' as const }]}>
              {data.map((item, index) => (
                <ScrollSortableItem
                  key={keyExtractor(item)}
                  item={item}
                  itemId={keyExtractor(item)}
                  originalIndex={index}
                  itemCount={data.length}
                  itemHeight={heights[index]}
                  totalSize={totalSize}
                  gap={gap}
                  containerSize={containerSize!}
                  autoScrollThreshold={autoScrollThreshold}
                  direction={direction}
                  handle={handle}
                  activeDragStyle={activeDragStyle}
                  positions={positions}
                  originalPrefixSum={originalPrefixSumSV}
                  currentPrefixSum={currentPrefixSumSV}
                  activeId={activeId}
                  isDragging={isDragging}
                  scrollOffset={scrollOffset}
                  containerStart={containerStart}
                  touchPosition={touchPosition}
                  dragContentPosition={dragContentPosition}
                  dragItemSize={dragItemSize}
                  liftedGestureTranslation={liftedGestureTranslation}
                  liftedStartPixelPosition={liftedStartPixelPosition}
                  liftedStartScrollOffset={liftedStartScrollOffset}
                  liftedAnimatedScale={liftedAnimatedScale}
                  liftedIsActive={liftedIsActive}
                  onActivate={onActivate}
                  onDeactivate={onDeactivate}
                  renderItem={renderItem}
                  onDragStart={handleDragStart}
                  onDragMove={handleDragMove}
                  onDragEnd={handleDragEnd}
                />
              ))}
              {renderInsertIndicator && (
                <SortableInsertionIndicator
                  positions={positions}
                  activeId={activeId}
                  isDragging={isDragging}
                  currentPrefixSum={currentPrefixSumSV}
                  direction={direction}
                  renderIndicator={renderInsertIndicator}
                />
              )}
            </View>
          </Animated.ScrollView>
        </View>

        {/* Drag overlay — rendered outside overflow:hidden container (inline fallback) */}
        {!portal && (
          <SortableDragOverlay
            item={activeItem}
            originalIndex={activeOriginalIndex}
            itemHeight={heights[activeOriginalIndex] ?? 0}
            totalSize={totalSize}
            direction={direction}
            mode="scroll"
            scrollOffset={scrollOffset}
            startScrollOffset={liftedStartScrollOffset}
            startPixelPosition={liftedStartPixelPosition}
            gestureTranslation={liftedGestureTranslation}
            animatedScale={liftedAnimatedScale}
            isActive={liftedIsActive}
            renderItem={renderItem}
          />
        )}
      </View>
    );
  }

  // Fixed mode rendering (no scroll)
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
            liftedGestureTranslation={liftedGestureTranslation}
            liftedStartPixelPosition={liftedStartPixelPosition}
            liftedAnimatedScale={liftedAnimatedScale}
            liftedIsActive={liftedIsActive}
            onActivate={onActivate}
            onDeactivate={onDeactivate}
            renderItem={renderItem}
            onDragStart={handleDragStart}
            onDragMove={handleDragMove}
            onDragEnd={handleDragEnd}
          />
        ))}
        {renderInsertIndicator && (
          <SortableInsertionIndicator
            positions={positions}
            activeId={activeId}
            isDragging={isDragging}
            currentPrefixSum={currentPrefixSumSV}
            direction={direction}
            renderIndicator={renderInsertIndicator}
          />
        )}
      </View>

      {/* Drag overlay — rendered outside overflow:hidden container (inline fallback) */}
      {!portal && (
        <SortableDragOverlay
          item={activeItem}
          originalIndex={activeOriginalIndex}
          itemHeight={heights[activeOriginalIndex] ?? 0}
          totalSize={totalSize}
          direction={direction}
          mode="fixed"
          startPixelPosition={liftedStartPixelPosition}
          gestureTranslation={liftedGestureTranslation}
          animatedScale={liftedAnimatedScale}
          isActive={liftedIsActive}
          renderItem={renderItem}
        />
      )}
    </View>
  );
}
