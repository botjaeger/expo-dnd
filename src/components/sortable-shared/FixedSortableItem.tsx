import React, { useEffect } from 'react';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  useDerivedValue,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { clamp } from '../../utils/sortable';
import { objectMove } from '../../utils/sortable';
import { getIndexAtMidpoint } from '../../utils/heights';
import { DraggableItemContext } from '../Draggable';
import { TIMING_CONFIG, SCALE_CONFIG, LONG_PRESS_DURATION, ACTIVE_SCALE } from './constants';
import { SortableItemRenderer } from './SortableItemRenderer';
import type { FixedSortableItemProps } from './types';

function FixedSortableItemInner<T>({
  item,
  itemId,
  originalIndex,
  itemCount,
  itemHeight,
  totalSize,
  gap,
  direction,
  handle,
  zoneId,
  positions,
  originalPrefixSum,
  currentPrefixSum,
  activeId,
  isDragging,
  containerStart,
  liftedGestureTranslation,
  liftedStartPixelPosition,
  liftedAnimatedScale,
  liftedIsActive,
  activeDragStyle,
  onActivate,
  onDeactivate,
  renderItem,
  onDragStart,
  onDragMove,
  onDragEnd,
}: FixedSortableItemProps<T>) {
  const isActive = useSharedValue(false);
  const isPressing = useSharedValue(false);
  const startPosition = useSharedValue(0);
  const animatedOffset = useSharedValue(0);
  const initialItemOffset = useSharedValue(0);
  const gestureTranslation = useSharedValue(0);
  const dragEndFired = useSharedValue(false);
  const isHorizontal = direction === 'horizontal';

  // Use derived value to properly track position changes
  const currentPosition = useDerivedValue(() => {
    return positions.value[itemId] ?? originalIndex;
  });

  // Reset animatedOffset when originalIndex changes (data reordered externally)
  useEffect(() => {
    animatedOffset.value = 0;
  }, [originalIndex]);

  // Animate offset smoothly when position changes (for shifted items)
  useAnimatedReaction(
    () => currentPosition.value,
    (pos, prevPos) => {
      if (prevPos !== null && pos !== prevPos && !isActive.value) {
        // Item was shifted by another drag - animate to new position
        const targetOffset = currentPrefixSum.value[pos] - originalPrefixSum.value[originalIndex];
        animatedOffset.value = withTiming(targetOffset, TIMING_CONFIG);
      }
    },
    [originalIndex]
  );

  // Long press gesture for visual feedback during press (before drag activates)
  const longPressGesture = Gesture.LongPress()
    .minDuration(LONG_PRESS_DURATION)
    .onBegin(() => {
      'worklet';
      isPressing.value = true;
      liftedAnimatedScale.value = withTiming(ACTIVE_SCALE, { duration: 100 });
    })
    .onFinalize(() => {
      'worklet';
      // Only reset if drag didn't activate
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

      // Keep scale at ACTIVE_SCALE (already set by long press)
      liftedAnimatedScale.value = withTiming(ACTIVE_SCALE, SCALE_CONFIG);
      liftedIsActive.value = true;

      // Save initial offset for calculating movement
      const currentOffset = currentPrefixSum.value[currentPos] - originalPrefixSum.value[originalIndex];
      initialItemOffset.value = currentOffset;
      animatedOffset.value = currentOffset;

      // Write the start pixel position to the lifted shared value for the overlay
      const startPixel = originalPrefixSum.value[originalIndex] + currentOffset;
      liftedStartPixelPosition.value = startPixel;

      // Reset gesture translation
      gestureTranslation.value = 0;
      liftedGestureTranslation.value = 0;

      runOnJS(onActivate)(item, originalIndex);
      runOnJS(onDragStart)(itemId, currentPos);
    })
    .onUpdate((event) => {
      'worklet';
      if (!isActive.value) return;

      // Store gesture translation for visual positioning
      const translation = isHorizontal ? event.translationX : event.translationY;
      gestureTranslation.value = translation;
      liftedGestureTranslation.value = translation;

      // Calculate item's position in container (for swap detection)
      const rawItemOffset = initialItemOffset.value + translation;
      const myOriginalOffset = originalPrefixSum.value[originalIndex];
      const itemLeftEdge = myOriginalOffset + rawItemOffset;

      // Use unclamped position for swap detection so tall items can reach edge slots
      const itemCenter = itemLeftEdge + itemHeight / 2;
      const newIndex = getIndexAtMidpoint(currentPrefixSum.value, itemCenter, itemCount, gap);
      const currentIndex = positions.value[itemId];

      if (newIndex !== currentIndex) {
        positions.value = objectMove(positions.value, currentIndex, newIndex);
        const clampedLeftEdge = clamp(itemLeftEdge, 0, totalSize - itemHeight);
        runOnJS(onDragMove)(itemId, newIndex, clampedLeftEdge);
      }
    })
    .onEnd(() => {
      'worklet';
      const finalIndex = positions.value[itemId];
      const fromIndex = startPosition.value;
      const finalOffset = currentPrefixSum.value[finalIndex] - originalPrefixSum.value[originalIndex];

      isDragging.value = false;
      isPressing.value = false;
      isActive.value = false;
      activeId.value = null;

      // Animate scale back to normal
      liftedAnimatedScale.value = withTiming(1, SCALE_CONFIG);

      // Calculate current visual offset (clamped)
      const rawOffset = initialItemOffset.value + gestureTranslation.value;
      const myOriginalOffset = originalPrefixSum.value[originalIndex];
      const itemLeftEdge = myOriginalOffset + rawOffset;
      const clampedLeftEdge = clamp(itemLeftEdge, 0, totalSize - itemHeight);
      const currentOffset = clampedLeftEdge - myOriginalOffset;

      // Sync lifted values for overlay snap-back
      liftedStartPixelPosition.value = myOriginalOffset + currentOffset;
      liftedGestureTranslation.value = 0;

      // Animate from current position to final position, then hide overlay and notify
      animatedOffset.value = currentOffset;
      animatedOffset.value = withTiming(finalOffset, TIMING_CONFIG, () => {
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
        const targetOffset = currentPrefixSum.value[currentPos] - originalPrefixSum.value[originalIndex];

        isDragging.value = false;
        isPressing.value = false;
        isActive.value = false;
        activeId.value = null;

        // Animate scale back to normal
        liftedAnimatedScale.value = withTiming(1, SCALE_CONFIG);

        // Calculate current visual offset (clamped)
        const rawOffset = initialItemOffset.value + gestureTranslation.value;
        const myOriginalOffset = originalPrefixSum.value[originalIndex];
        const itemLeftEdge = myOriginalOffset + rawOffset;
        const clampedLeftEdge = clamp(itemLeftEdge, 0, totalSize - itemHeight);
        const currentOffset = clampedLeftEdge - myOriginalOffset;

        liftedStartPixelPosition.value = myOriginalOffset + currentOffset;
        liftedGestureTranslation.value = 0;

        // Animate from current position to target, then hide overlay
        animatedOffset.value = currentOffset;
        animatedOffset.value = withTiming(targetOffset, TIMING_CONFIG, () => {
          'worklet';
          liftedIsActive.value = false;
          runOnJS(onDeactivate)();
        });
      }
    });

  // Compose long press and pan gestures to run simultaneously
  const gesture = Gesture.Simultaneous(longPressGesture, panGesture);

  const animatedStyle = useAnimatedStyle(() => {
    const active = isActive.value;
    const pressing = isPressing.value;
    const offset = animatedOffset.value;

    // This item is being dragged — hide it (overlay renders the visual clone)
    if (active) {
      return {
        transform: isHorizontal
          ? [{ translateX: offset }]
          : [{ translateY: offset }],
        opacity: activeDragStyle?.opacity ?? 0,
        zIndex: 0,
      };
    }

    // Item is being pressed (before drag activates) — scale down with shadow
    if (pressing) {
      const scale = liftedAnimatedScale.value;
      return {
        transform: isHorizontal
          ? [{ translateX: offset }, { scale: scale }]
          : [{ translateY: offset }, { scale: scale }],
        opacity: 1,
        zIndex: 99999,
        shadowColor: '#000',
        shadowOpacity: 0.35,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 12 },
        elevation: 24,
      };
    }

    // Idle state — other items use animatedOffset (animated via useAnimatedReaction)
    return {
      transform: isHorizontal
        ? [{ translateX: offset }, { scale: 1 }]
        : [{ translateY: offset }, { scale: 1 }],
      opacity: 1,
      zIndex: 0,
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    };
  });

  const sizeStyle = isHorizontal
    ? { width: itemHeight }
    : { height: itemHeight };

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
      <DraggableItemContext.Provider value={{ gesture }}>
        {content}
      </DraggableItemContext.Provider>
    );
  }

  return <GestureDetector gesture={gesture}>{content}</GestureDetector>;
}

export const FixedSortableItem = React.memo(FixedSortableItemInner) as typeof FixedSortableItemInner;
