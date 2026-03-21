import { useEffect, useCallback, useRef } from 'react';
import type { View } from 'react-native';
import {
  useAnimatedStyle,
  useSharedValue,
  runOnJS,
  measure,
  type AnimatedRef,
  type AnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import type { ViewStyle } from 'react-native';
import { useDndContext } from '../context/useDndContext';
import { useLayoutMeasurement } from './useLayoutMeasurement';
import { rectIntersection } from '../collision/rectIntersection';
import type { CollisionRect } from '../collision/types';
import type { LayoutRect } from '../context/types';
import { Gesture, type GestureType, type ComposedGesture } from 'react-native-gesture-handler';
import { isWeb } from '../utils/platform';

export interface UseDraggableProps {
  id: string;
  data?: unknown;
  disabled?: boolean;
  /** Style applied to the source element while dragging.
   *  Defaults to { opacity: 0.4 }. */
  activeDragStyle?: ViewStyle;
  /** Long press duration in ms before drag activates (default: 200) */
  longPressDuration?: number;
  /** Called when the item is tapped (not dragged). Suppressed after a drag completes. */
  onPress?: () => void;
}

export interface UseDraggableReturn {
  /** Ref to attach to the draggable view */
  ref: AnimatedRef<View>;
  /** Gesture handler to attach via GestureDetector */
  gesture: GestureType | ComposedGesture;
  /** Whether this item is currently being dragged */
  isDragging: SharedValue<boolean>;
  /** Animated style to apply for drag translation and visual feedback */
  animatedStyle: AnimatedStyle<ViewStyle>;
  /** Handler for onLayout event */
  onLayout: ReturnType<typeof useLayoutMeasurement>['handleLayout'];
}

/**
 * Hook that makes an element draggable
 */
export function useDraggable(props: UseDraggableProps): UseDraggableReturn {
  const { id, data, disabled = false, activeDragStyle, longPressDuration, onPress } = props;
  const context = useDndContext();
  const { ref, rect, handleLayout, triggerMeasure } = useLayoutMeasurement();
  const prevOverIdRef = useRef<string | null>(null);

  // Each draggable has its own translation values
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const isDragging = useSharedValue(false);

  // Grab offset: where within the element the user touched (for pointer-based collision)
  const grabOffsetX = useRef(0);
  const grabOffsetY = useRef(0);

  const refreshWebDroppableRects = useCallback(() => {
    if (!isWeb) return;

    context.droppables.forEach((droppable) => {
      const node = (droppable.node as any).current as HTMLElement | null;
      if (node && typeof node.getBoundingClientRect === 'function') {
        const domRect = node.getBoundingClientRect();
        droppable.rect.value = {
          x: domRect.left + window.scrollX,
          y: domRect.top + window.scrollY,
          width: domRect.width,
          height: domRect.height,
        };
      }
    });
  }, [context]);

  // Register with context
  useEffect(() => {
    context.registerDraggable({
      id,
      data,
      disabled,
      node: ref,
    });

    return () => {
      context.unregisterDraggable(id);
    };
  }, [id, data, disabled, context, ref]);

  // Callbacks for drag events
  const handleDragStart = useCallback((absoluteX: number, absoluteY: number) => {
    // Measure synchronously on web to get fresh coordinates (not stale layout-time values).
    // triggerMeasure() is async (runOnUI) so rect.value would be stale if the page scrolled.
    if (isWeb) {
      const node = (ref as any).current as HTMLElement | null;
      if (node && typeof node.getBoundingClientRect === 'function') {
        const domRect = node.getBoundingClientRect();
        rect.value = {
          x: domRect.left + window.scrollX,
          y: domRect.top + window.scrollY,
          width: domRect.width,
          height: domRect.height,
        };
        // Grab offset relative to the draggable element (both viewport-relative)
        grabOffsetX.current = absoluteX - domRect.left;
        grabOffsetY.current = absoluteY - domRect.top;
        // Ensure overlay dimensions are set on web (worklet measure() may fail)
        context.overlayItemWidth.value = domRect.width;
        context.overlayItemHeight.value = domRect.height;
        context.overlayGrabOffsetX.value = absoluteX - domRect.left;
        context.overlayGrabOffsetY.value = absoluteY - domRect.top;
      }
    } else {
      triggerMeasure();
      // On native, rect.value exists from onLayout measurement
      const currentRect = rect.value;
      if (currentRect) {
        grabOffsetX.current = absoluteX - currentRect.x;
        grabOffsetY.current = absoluteY - currentRect.y;
      }
    }

    // Measure all droppables
    if (isWeb) {
      refreshWebDroppableRects();
    } else {
      context.measureDroppables();
    }

    // Measure container offset synchronously so the overlay positions correctly
    // on the very first frame. On web, use getBoundingClientRect (sync).
    // On native, derive from absolute pointer position and item rect.
    let containerOff = { x: 0, y: 0 };
    if (isWeb) {
      const containerNode = (context.containerRef as any).current as HTMLElement | null;
      if (containerNode && typeof containerNode.getBoundingClientRect === 'function') {
        const cRect = containerNode.getBoundingClientRect();
        containerOff = { x: cRect.left + window.scrollX, y: cRect.top + window.scrollY };
      }
      // Set overlay container offset on web (worklet measure() may fail).
      // Always use fresh getBoundingClientRect — portalOutletPageX/Y are stale
      // when the provider lives inside a ScrollView that has been scrolled.
      context.overlayContainerOffsetX.value = containerOff.x;
      context.overlayContainerOffsetY.value = containerOff.y;
    }

    // Set active state
    const currentRect = rect.value;
    if (currentRect) {
      context.setActiveId(id);
      context.setActiveState({
        id,
        data,
        initialRect: currentRect,
        containerOffset: containerOff,
        grabOffset: { x: grabOffsetX.current, y: grabOffsetY.current },
      });

      // Fire callback
      context.onDragStart?.({ active: { id, data } });
    }
  }, [id, data, context, rect, ref, triggerMeasure, refreshWebDroppableRects]);

  const handleDragUpdate = useCallback(
    (event: { translation: { x: number; y: number }; absoluteX: number; absoluteY: number }) => {
      const { translation, absoluteX, absoluteY } = event;

      if (isWeb) {
        refreshWebDroppableRects();
      }

      context.onDragMove?.({
        active: { id, data },
        translation,
        absoluteX,
        absoluteY,
      });

      // Use a small rect around the cursor/pointer for collision detection.
      // On web, gesture absoluteX/Y are viewport-relative but droppable rects
      // are page-relative (include window scroll offset), so we must add
      // scroll offset to the pointer position to match.
      const POINTER_SIZE = 4;
      const pointerX = absoluteX + (isWeb ? window.scrollX : 0);
      const pointerY = absoluteY + (isWeb ? window.scrollY : 0);
      const currentRect: LayoutRect = {
        x: pointerX - POINTER_SIZE / 2,
        y: pointerY - POINTER_SIZE / 2,
        width: POINTER_SIZE,
        height: POINTER_SIZE,
      };

      // Collect droppable rects
      const droppableRects: CollisionRect[] = [];
      context.droppables.forEach((droppable, droppableId) => {
        if (droppable.rect.value && !droppable.disabled) {
          droppableRects.push({
            id: droppableId,
            rect: droppable.rect.value,
            data: droppable.data,
          });
        }
      });

      // Run collision detection
      const collision = rectIntersection(
        { id, rect: currentRect },
        droppableRects
      );

      const newOverId = collision?.id ?? null;

      // Update over state if changed
      if (newOverId !== prevOverIdRef.current) {
        context.overId.value = newOverId;
        prevOverIdRef.current = newOverId;
      }

      // Always fire onDragOver with current collision state so that
      // consumers (e.g. DraggableListGroup) can update target indices
      // on every frame — critical during auto-scroll where the pointer
      // is stationary but the scroll offset keeps changing.
      context.onDragOver?.({
        active: { id, data },
        over: collision
          ? { id: collision.id, data: collision.data }
          : null,
      });
    },
    [id, data, context, refreshWebDroppableRects]
  );

  const handleDragEnd = useCallback(() => {
    const overIdValue = context.overId.value;
    let overData: unknown = undefined;

    if (overIdValue) {
      const overDroppable = context.droppables.get(overIdValue);
      overData = overDroppable?.data;
    }

    // Fire callback
    context.onDragEnd?.({
      active: { id, data },
      over: overIdValue ? { id: overIdValue, data: overData } : null,
    });

    // Reset state
    context.setActiveId(null);
    context.setActiveState(null);
    context.overId.value = null;
    prevOverIdRef.current = null;
  }, [id, data, context]);

  // Set up pan gesture - each draggable has its own gesture
  const panGesture = Gesture.Pan()
    .enabled(!disabled)
    .activateAfterLongPress(longPressDuration ?? 200)
    .mouseButton(1) // LEFT mouse button for web
    .onStart((event) => {
      'worklet';
      isDragging.value = true;
      context.isDragging.value = true;
      // Set absolute position immediately so auto-scroll has data on frame 1
      context.absoluteX.value = event.absoluteX;
      context.absoluteY.value = event.absoluteY;

      // Measure container on the UI thread for accurate overlay positioning.
      // Always use a fresh measure() — portalOutletPageX/Y are stale when the
      // provider lives inside a ScrollView that has been scrolled since mount.
      try {
        const cm = measure(context.containerRef);
        if (cm) {
          context.overlayContainerOffsetX.value = cm.pageX;
          context.overlayContainerOffsetY.value = cm.pageY;
        }
      } catch { /* view not mounted */ }

      try {
        const im = measure(ref);
        if (im) {
          context.overlayGrabOffsetX.value = event.absoluteX - im.pageX;
          context.overlayGrabOffsetY.value = event.absoluteY - im.pageY;
          context.overlayItemWidth.value = im.width;
          context.overlayItemHeight.value = im.height;
        }
      } catch { /* view not mounted */ }

      runOnJS(handleDragStart)(event.absoluteX, event.absoluteY);
    })
    .onUpdate((event) => {
      'worklet';
      translateX.value = event.translationX;
      translateY.value = event.translationY;
      context.translateX.value = event.translationX;
      context.translateY.value = event.translationY;
      context.absoluteX.value = event.absoluteX;
      context.absoluteY.value = event.absoluteY;
      runOnJS(handleDragUpdate)({
        translation: { x: event.translationX, y: event.translationY },
        absoluteX: event.absoluteX,
        absoluteY: event.absoluteY,
      });
    })
    .onEnd(() => {
      'worklet';
      isDragging.value = false;
      context.isDragging.value = false;
      translateX.value = 0;
      translateY.value = 0;
      context.translateX.value = 0;
      context.translateY.value = 0;
      context.absoluteX.value = 0;
      context.absoluteY.value = 0;
      runOnJS(handleDragEnd)();
    })
    .onFinalize((_event, success) => {
      'worklet';
      if (!success) {
        isDragging.value = false;
        context.isDragging.value = false;
        translateX.value = 0;
        translateY.value = 0;
        context.translateX.value = 0;
        context.translateY.value = 0;
        context.absoluteX.value = 0;
        context.absoluteY.value = 0;
      }
    });

  const tapGesture = onPress
    ? Gesture.Tap()
        .enabled(!disabled)
        .onEnd(() => {
          'worklet';
          runOnJS(onPress)();
        })
    : null;

  const gesture = tapGesture
    ? Gesture.Exclusive(panGesture, tapGesture)
    : panGesture;

  // Animated style for THIS draggable only.
  // When dragging, the original becomes a ghost (no transform, reduced opacity).
  // The DragOverlayLayer in DndContext renders the visual clone at the correct
  // screen position, completely outside the normal DOM stacking order.
  const dragOpacity = activeDragStyle?.opacity ?? 0.4;
  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: isDragging.value ? dragOpacity : 1,
    };
  }, [isDragging, dragOpacity]);

  return {
    ref,
    gesture,
    isDragging,
    animatedStyle,
    onLayout: handleLayout,
  };
}
