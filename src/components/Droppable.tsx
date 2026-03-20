import React, { useState } from 'react';
import Animated, { useAnimatedReaction, runOnJS } from 'react-native-reanimated';
import type { ViewStyle, StyleProp } from 'react-native';
import { useDroppable, type UseDroppableProps } from '../hooks/useDroppable';
import type { DragEffect, DragEffectConfig } from '../animations/dragEffects';

export interface DroppableRenderProps {
  /** Whether a draggable is currently hovering over this droppable */
  isOver: boolean;
}

export interface DroppableProps extends UseDroppableProps {
  /** Render prop that receives isOver state, or regular children */
  children: React.ReactNode | ((props: DroppableRenderProps) => React.ReactNode);
  style?: StyleProp<ViewStyle>;
  /** Style applied when a draggable is hovering over */
  activeStyle?: StyleProp<ViewStyle>;
  /** Animation effect (scale) applied to the droppable zone when a draggable hovers over it */
  activeEffect?: DragEffect | DragEffectConfig;
}

/**
 * Component that creates a drop zone.
 *
 * @example
 * ```tsx
 * // With render prop for dynamic content
 * <Droppable id="basket">
 *   {({ isOver }) => (
 *     <View style={[styles.zone, isOver && styles.zoneActive]}>
 *       <Text>{isOver ? 'Release to drop!' : 'Drop here'}</Text>
 *     </View>
 *   )}
 * </Droppable>
 *
 * // With regular children
 * <Droppable id="basket" activeStyle={{ borderColor: 'green' }}>
 *   <View style={styles.zone}>
 *     <Text>Drop here</Text>
 *   </View>
 * </Droppable>
 * ```
 */
export function Droppable({
  children,
  style,
  activeStyle: customActiveStyle,
  activeEffect,
  id,
  data,
  disabled,
}: DroppableProps) {
  const { ref, isOver, activeStyle, onLayout } = useDroppable({
    id,
    data,
    disabled,
    activeEffect,
  });

  // For render prop pattern, sync shared value to React state
  const [isOverState, setIsOverState] = useState(false);
  const isRenderProp = typeof children === 'function';

  // Keep JS state in sync so customActiveStyle can be applied conditionally.
  useAnimatedReaction(
    () => isOver.value,
    (current, previous) => {
      if (current !== previous) {
        runOnJS(setIsOverState)(current);
      }
    },
    []
  );

  // If children is a function, use render prop pattern with React state
  const content = isRenderProp
    ? children({ isOver: isOverState })
    : children;

  return (
    <Animated.View
      ref={ref as any}
      style={[style, activeStyle, isOverState ? customActiveStyle : undefined] as any}
      onLayout={onLayout}
    >
      {content}
    </Animated.View>
  );
}
