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
  runOnJS,
  type SharedValue,
} from 'react-native-reanimated';
import { objectMove, clamp } from '../utils/sortable';
import { resolveDragEffect, type DragEffectConfig } from '../animations/dragEffects';
import { getIndexAtMidpoint, getInsertionIndexAtPosition } from '../utils/heights';
import { DraggableItemContext } from './Draggable';
import { useContext } from 'react';
import { DndContext } from '../context/DndContext';
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
  /** Called when an external Draggable is dropped onto this list.
   *  Only fires when SortableList is inside a DndProvider. */
  onExternalDrop?: (event: { activeId: string; data?: unknown; insertIndex: number }) => void;
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
  // DndContext bridge — auto-populated when SortableList is inside a DndProvider
  dndActiveId?: SharedValue<string | null>;
  dndIsDragging?: SharedValue<boolean>;
  dndAbsoluteX?: SharedValue<number>;
  dndAbsoluteY?: SharedValue<number>;
  dndOverId?: SharedValue<string | null>;
  dndRunCollision?: (activeId: string, absoluteX: number, absoluteY: number) => void;
  dndMeasureDroppables?: () => void;
  /** Index where an external item would be inserted (-1 = no external hover) */
  externalInsertIndex: SharedValue<number>;
  /** Height of the external item being dragged (for shift offset) */
  externalItemHeight: SharedValue<number>;
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
  dndActiveId,
  dndIsDragging,
  dndAbsoluteX,
  dndAbsoluteY,
  dndOverId,
  dndRunCollision,
  dndMeasureDroppables,
  externalInsertIndex,
  externalItemHeight,
}: SortableItemProps<T>) {
  const isActive = useSharedValue(false);
  const isPressing = useSharedValue(false);
  const startPositionIndex = useSharedValue(0);
  const startPixelPos = useSharedValue(0);
  const startScrollOffset = useSharedValue(0);
  const gestureTranslation = useSharedValue(0);
  const crossAxisTranslation = useSharedValue(0);
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
    .activateAfterLongPress(LONG_PRESS_DURATION)
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
      crossAxisTranslation.value = 0;
      animatedPosition.value = pixelPos;
      dragEndFired.value = false;

      // Write to DndContext bridge so external droppables see this drag
      if (dndActiveId) dndActiveId.value = itemId;
      if (dndIsDragging) dndIsDragging.value = true;
      // Re-measure all droppable rects (may be stale after scroll)
      if (dndMeasureDroppables) runOnJS(dndMeasureDroppables)();

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
      crossAxisTranslation.value = isHorizontal ? event.translationY : event.translationX;

      // Calculate content position
      let rawContentPos = startPixelPos.value + translation;
      if (isScrollMode) {
        rawContentPos += scrollOffset.value - startScrollOffset.value;
        dragContentPosition.value = clamp(rawContentPos, 0, totalSize - itemHeight);
      }

      // Skip swap detection when item has left the container bounds (cross-list drag).
      // Prevents source list positions from being corrupted while the item hovers
      // over a different container.
      if (rawContentPos >= 0 && rawContentPos <= totalSize) {
        const itemCenter = rawContentPos + itemHeight / 2;
        const newIndex = getIndexAtMidpoint(currentPrefixSum.value, itemCenter, itemCount, gap);
        const currentIndex = positions.value[itemId];

        if (newIndex !== currentIndex) {
          positions.value = objectMove(positions.value, currentIndex, newIndex);
          runOnJS(onDragMove)(itemId, newIndex, clamp(rawContentPos, 0, totalSize - itemHeight));
        }
      }

      // Update touch position for auto-scroll
      if (isScrollMode) {
        touchPosition.value = isHorizontal ? event.absoluteX : event.absoluteY;
      }

      // Update DndContext bridge pointer position + run collision
      if (dndAbsoluteX) dndAbsoluteX.value = event.absoluteX;
      if (dndAbsoluteY) dndAbsoluteY.value = event.absoluteY;
      if (dndRunCollision) {
        runOnJS(dndRunCollision)(itemId, event.absoluteX, event.absoluteY);
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

      // Reset DndContext bridge
      if (dndActiveId) dndActiveId.value = null;
      if (dndIsDragging) dndIsDragging.value = false;
      if (dndAbsoluteX) dndAbsoluteX.value = 0;
      if (dndAbsoluteY) dndAbsoluteY.value = 0;
      if (dndOverId) dndOverId.value = null;

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

        // Reset DndContext bridge
        if (dndActiveId) dndActiveId.value = null;
        if (dndIsDragging) dndIsDragging.value = false;
        if (dndAbsoluteX) dndAbsoluteX.value = 0;
        if (dndAbsoluteY) dndAbsoluteY.value = 0;
        if (dndOverId) dndOverId.value = null;

        animatedPosition.value = withTiming(targetPos, TIMING_CONFIG);
      } else if (!success) {
        isPressing.value = false;
      }
    });

  const animatedStyle = useAnimatedStyle(() => {
    const active = isActive.value;
    const pressing = isPressing.value;

    let mainAxisPos: number;
    let crossAxisPos = 0;
    if (active) {
      let raw = startPixelPos.value + gestureTranslation.value;
      if (isScrollMode) {
        raw += scrollOffset.value - startScrollOffset.value;
      }
      // Don't clamp when active — allow item to leave container bounds for cross-list drag
      mainAxisPos = raw;
      // Allow cross-axis movement for cross-list dragging
      crossAxisPos = crossAxisTranslation.value;
    } else {
      mainAxisPos = animatedPosition.value;
      // Shift down when an external item hovers above this item's position
      const extIdx = externalInsertIndex.value;
      if (extIdx >= 0) {
        const myPos = positions.value[itemId] ?? originalIndex;
        if (myPos >= extIdx) {
          mainAxisPos += externalItemHeight.value;
        }
      }
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
      [isHorizontal ? 'top' : 'left']: crossAxisPos,
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

  return <GestureDetector gesture={panGesture}>{content}</GestureDetector>;
}

const SortableItem = React.memo(SortableItemInner) as typeof SortableItemInner;

// ============ SortableInsertionIndicator ============

interface SortableInsertionIndicatorProps {
  positions: SharedValue<{ [id: string]: number }>;
  activeId: SharedValue<string | null>;
  isDragging: SharedValue<boolean>;
  currentPrefixSum: SharedValue<number[]>;
  originalPrefixSum: SharedValue<number[]>;
  direction: 'horizontal' | 'vertical';
  itemCount: number;
  gap: number;
  renderIndicator: (index: number) => React.ReactNode;
  /** DndContext overId — used to hide/show indicator for cross-list */
  dndOverId?: SharedValue<string | null>;
  dndActiveId?: SharedValue<string | null>;
  dndAbsoluteX?: SharedValue<number>;
  dndAbsoluteY?: SharedValue<number>;
  dndIsDragging?: SharedValue<boolean>;
  /** This container's droppable ID and rect in DndContext */
  containerDroppableId?: string;
  containerRect?: SharedValue<{ x: number; y: number; width: number; height: number } | null>;
}

function SortableInsertionIndicator({
  positions,
  activeId,
  isDragging,
  currentPrefixSum,
  originalPrefixSum,
  direction,
  itemCount,
  gap,
  renderIndicator,
  dndOverId,
  dndActiveId,
  dndAbsoluteX,
  dndAbsoluteY,
  dndIsDragging,
  containerDroppableId,
  containerRect,
}: SortableInsertionIndicatorProps) {
  const isHorizontal = direction === 'horizontal';
  const [state, setState] = useState<{ idx: number; position: number } | null>(null);

  useAnimatedReaction(
    () => {
      // Case 1: Internal drag (item from this list)
      const id = activeId.value;
      if (id && isDragging.value) {
        // If item is over a different container, hide
        if (dndOverId && containerDroppableId) {
          const currentOver = dndOverId.value;
          if (currentOver && currentOver !== containerDroppableId) return null;
        }
        const idx = positions.value[id];
        if (idx === undefined) return null;
        const ps = currentPrefixSum.value;
        const lastItemIdx = Math.max(0, ps.length - 1);
        const posIdx = Math.min(idx + 1, lastItemIdx);
        return { idx, position: ps[posIdx] ?? 0 };
      }

      // Case 2: External drag hovering over this container
      if (dndOverId && dndActiveId && dndIsDragging && dndAbsoluteX && dndAbsoluteY && containerRect && containerDroppableId) {
        const isOverUs = dndOverId.value === containerDroppableId;
        const externalId = dndActiveId.value;
        const isExternal = externalId ? (positions.value[externalId] === undefined) : false;

        if (isOverUs && isExternal && dndIsDragging.value) {
          const rect = containerRect.value;
          if (!rect) return null;
          const pointerRelative = isHorizontal
            ? (dndAbsoluteX.value + (typeof window !== 'undefined' ? window.scrollX : 0)) - rect.x
            : (dndAbsoluteY.value + (typeof window !== 'undefined' ? window.scrollY : 0)) - rect.y;
          const insertIdx = getInsertionIndexAtPosition(originalPrefixSum.value, pointerRelative, itemCount, gap);
          const ps = originalPrefixSum.value;
          const posIdx = Math.min(insertIdx, Math.max(0, ps.length - 2));
          return { idx: insertIdx, position: ps[posIdx] ?? 0 };
        }
      }

      return null;
    },
    (cur, prev) => {
      if (cur?.idx !== prev?.idx || cur?.position !== prev?.position) {
        runOnJS(setState)(cur);
      }
    },
    [itemCount, gap]
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
  onExternalDrop,
}: SortableListProps<T>) {
  const dragEffectConfig = dragEffectProp ? resolveDragEffect(dragEffectProp) : undefined;
  const scrollViewRef = useAnimatedRef<Animated.ScrollView>();
  const isHoriz = direction === 'horizontal';

  // Extract gap from user's style
  const flatStyle = StyleSheet.flatten(style) as any;
  const gap = (isHoriz ? flatStyle?.columnGap : flatStyle?.rowGap) ?? flatStyle?.gap ?? 0;

  // Optional bridge to DndContext — SortableList works without a DndProvider
  const dndCtx = useContext(DndContext);

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

  // Register this container as a Droppable so external Draggables can target this list.
  // Only active when inside a DndProvider (dndCtx non-null).
  const containerDroppableId = `__sortable__${id}`;
  const containerDroppableRect = useSharedValue<{ x: number; y: number; width: number; height: number } | null>(null);

  useEffect(() => {
    if (!dndCtx) return;
    dndCtx.registerDroppable({
      id: containerDroppableId,
      data: { __sortableId: id },
      disabled: false,
      node: containerRef as any,
      rect: containerDroppableRect,
    });
    return () => { dndCtx.unregisterDroppable(containerDroppableId); };
  }, [dndCtx, containerDroppableId, id, containerRef, containerDroppableRect]);

  // Wrap handleContainerLayout to also update the droppable rect in DndContext.
  const handleContainerLayoutWithRect = useCallback((event: any) => {
    handleContainerLayout(event);
    if (dndCtx && containerRef.current) {
      // On web, use getBoundingClientRect + scroll offset for page-relative coordinates.
      // On native, measureInWindow gives screen-relative coordinates.
      const node = containerRef.current as any;
      if (typeof node.getBoundingClientRect === 'function') {
        const domRect = node.getBoundingClientRect();
        containerDroppableRect.value = {
          x: domRect.left + window.scrollX,
          y: domRect.top + window.scrollY,
          width: domRect.width,
          height: domRect.height,
        };
      } else if (node.measureInWindow) {
        node.measureInWindow((x: number, y: number, w: number, h: number) => {
          containerDroppableRect.value = { x, y, width: w, height: h };
        });
      }
    }
  }, [handleContainerLayout, dndCtx, containerRef, containerDroppableRect]);

  // Track external hover insertion index — items shift to make space
  const externalInsertIndex = useSharedValue(-1);
  const externalItemHeight = useSharedValue(50); // default height estimate for external items

  useAnimatedReaction(
    () => {
      if (!dndCtx) return -1;
      const isOverUs = dndCtx.overId.value === containerDroppableId;
      const externalId = dndCtx.activeId.value;
      const isExternal = externalId ? (positions.value[externalId] === undefined) : false;
      if (!isOverUs || !isExternal || !dndCtx.isDragging.value) return -1;

      // Compute insertion index from pointer
      const rect = containerDroppableRect.value;
      if (!rect) return -1;
      const absMain = isHorizontal ? dndCtx.absoluteX.value : dndCtx.absoluteY.value;
      const scrollOffset = typeof window !== 'undefined'
        ? (isHorizontal ? window.scrollX : window.scrollY) : 0;
      const relativePos = (absMain + scrollOffset) - (isHorizontal ? rect.x : rect.y);
      return getInsertionIndexAtPosition(originalPrefixSumSV.value, relativePos, data.length, gap);
    },
    (idx) => {
      externalInsertIndex.value = idx;
    },
    [data.length, gap]
  );

  // Detect external Draggable drops onto this SortableList.
  // Watches DndContext: when isDragging transitions true→false and overId was our container,
  // compute insertion index and fire onExternalDrop.
  const handleExternalDropJS = useCallback((activeItemId: string, absX: number, absY: number) => {
    if (!onExternalDrop || !dndCtx) return;

    // Look up the active item's data from the draggable registry
    const draggable = dndCtx.draggables.get(activeItemId);
    const itemData = draggable?.data;

    // Compute insertion index from pointer position relative to container
    const rect = containerDroppableRect.value;
    if (!rect) { onExternalDrop({ activeId: activeItemId, data: itemData, insertIndex: data.length }); return; }

    const relativePos = isHorizontal
      ? (absX - rect.x)
      : (absY - rect.y);

    const insertIndex = getInsertionIndexAtPosition(
      originalPrefixSumSV.value,
      relativePos,
      data.length,
      gap
    );

    onExternalDrop({ activeId: activeItemId, data: itemData, insertIndex });
  }, [onExternalDrop, dndCtx, containerDroppableRect, isHorizontal, originalPrefixSumSV, data.length, gap]);

  // Track the last overId/activeId before drag ends (they reset on drop).
  // These reactions are always called (hooks rules) but no-op without DndContext.
  const lastOverId = useSharedValue<string | null>(null);
  const lastActiveId = useSharedValue<string | null>(null);
  const lastAbsX = useSharedValue(0);
  const lastAbsY = useSharedValue(0);
  const hasExternalDrop = !!dndCtx && !!onExternalDrop;

  useAnimatedReaction(
    () => {
      if (!hasExternalDrop || !dndCtx) return null;
      return {
        over: dndCtx.overId.value,
        active: dndCtx.activeId.value,
        absX: dndCtx.absoluteX.value,
        absY: dndCtx.absoluteY.value,
      };
    },
    (state) => {
      if (!state) return;
      if (state.over) lastOverId.value = state.over;
      if (state.active) lastActiveId.value = state.active;
      lastAbsX.value = state.absX;
      lastAbsY.value = state.absY;
    }
  );

  useAnimatedReaction(
    () => (dndCtx ? dndCtx.isDragging.value : false),
    (dragging, prevDragging) => {
      if (prevDragging && !dragging) {
        // Always reset the external insert index when a cross-list drag ends
        externalInsertIndex.value = -1;

        if (!hasExternalDrop) return;
        const wasOverUs = lastOverId.value === containerDroppableId;
        const wasOurItem = lastActiveId.value ? (positions.value[lastActiveId.value] !== undefined) : false;

        if (wasOverUs && !wasOurItem && lastActiveId.value) {
          runOnJS(handleExternalDropJS)(lastActiveId.value, lastAbsX.value, lastAbsY.value);
        }

        lastOverId.value = null;
        lastActiveId.value = null;
      }
    }
  );

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
      dndActiveId={dndCtx?.activeId}
      dndIsDragging={dndCtx?.isDragging}
      dndAbsoluteX={dndCtx?.absoluteX}
      dndAbsoluteY={dndCtx?.absoluteY}
      dndOverId={dndCtx?.overId}
      dndRunCollision={dndCtx?.runCollisionDetection}
      dndMeasureDroppables={dndCtx?.measureDroppables}
      externalInsertIndex={externalInsertIndex}
      externalItemHeight={externalItemHeight}
    />
  ));

  const indicator = renderInsertIndicator ? (
    <SortableInsertionIndicator
      positions={positions}
      activeId={activeId}
      isDragging={isDragging}
      currentPrefixSum={currentPrefixSumSV}
      originalPrefixSum={originalPrefixSumSV}
      direction={direction}
      itemCount={data.length}
      gap={gap}
      renderIndicator={renderInsertIndicator}
      dndOverId={dndCtx?.overId}
      dndActiveId={dndCtx?.activeId}
      dndAbsoluteX={dndCtx?.absoluteX}
      dndAbsoluteY={dndCtx?.absoluteY}
      dndIsDragging={dndCtx?.isDragging}
      containerDroppableId={containerDroppableId}
      containerRect={containerDroppableRect}
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
          onLayout={handleContainerLayoutWithRect}
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
        onLayout={handleContainerLayoutWithRect}
      >
        {items}
        {indicator}
      </View>
    </View>
  );
}
