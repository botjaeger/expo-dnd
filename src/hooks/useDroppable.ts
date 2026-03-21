import { useEffect } from 'react';
import type { View } from 'react-native';
import {
  useAnimatedStyle,
  useAnimatedReaction,
  useDerivedValue,
  useSharedValue,
  type AnimatedRef,
  type AnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { withSpringRM } from '../utils/motion';
import type { ViewStyle } from 'react-native';
import { useDndContext } from '../context/useDndContext';
import { useLayoutMeasurement } from './useLayoutMeasurement';
import { resolveDragEffect } from '../animations/dragEffects';
import type { DragEffect, DragEffectConfig } from '../animations/dragEffects';

export interface UseDroppableProps {
  id: string;
  data?: unknown;
  disabled?: boolean;
  /** Animation effect applied to the droppable zone when a draggable hovers over it */
  activeEffect?: DragEffect | DragEffectConfig;
}

export interface UseDroppableReturn {
  /** Ref to attach to the droppable view */
  ref: AnimatedRef<View>;
  /** Whether a draggable is currently over this droppable */
  isOver: SharedValue<boolean>;
  /** Animated style with visual feedback for hover state */
  activeStyle: AnimatedStyle<ViewStyle>;
  /** Handler for onLayout event */
  onLayout: ReturnType<typeof useLayoutMeasurement>['handleLayout'];
}

/**
 * Hook that makes an element a drop target
 */
export function useDroppable(props: UseDroppableProps): UseDroppableReturn {
  const { id, data, disabled = false, activeEffect } = props;
  const context = useDndContext();
  const { ref, rect, handleLayout, triggerMeasure } = useLayoutMeasurement();

  // Resolve the optional scale effect once (stable across renders for the same input)
  const resolvedEffect = activeEffect ? resolveDragEffect(activeEffect) : undefined;

  // Register with context
  useEffect(() => {
    context.registerDroppable({
      id,
      data,
      disabled,
      node: ref,
      rect,
    });

    // Initial measurement
    triggerMeasure();

    return () => {
      context.unregisterDroppable(id);
    };
  }, [id, data, disabled, context, ref, rect, triggerMeasure]);

  // Derived value: is something dragging over this droppable?
  const isOver = useDerivedValue(() => {
    return context.overId.value === id;
  }, [context.overId, id]);

  // Scale shared value for the optional activeEffect
  const dropScale = useSharedValue(1);

  useAnimatedReaction(
    () => isOver.value,
    (hovering, prev) => {
      if (hovering !== prev && resolvedEffect) {
        dropScale.value = hovering
          ? withSpringRM(resolvedEffect.scale, resolvedEffect.spring)
          : withSpringRM(1, resolvedEffect.spring);
      }
    }
  );

  // Animated style for visual feedback
  const activeStyle = useAnimatedStyle(() => {
    const hovering = isOver.value;

    return {
      borderWidth: hovering ? 2 : 0,
      borderColor: hovering ? '#4CAF50' : 'transparent',
      backgroundColor: hovering ? 'rgba(76, 175, 80, 0.1)' : 'transparent',
      transform: [{ scale: dropScale.value }],
    };
  }, [isOver, dropScale]);

  return {
    ref,
    isOver,
    activeStyle,
    onLayout: handleLayout,
  };
}
