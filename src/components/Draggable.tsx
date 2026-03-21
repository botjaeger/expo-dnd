import React, { createContext, useContext, useEffect, useRef } from 'react';
import { GestureDetector, type GestureType } from 'react-native-gesture-handler';
import type { ComposedGesture } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import type { ViewStyle, StyleProp } from 'react-native';
import { useDraggable, type UseDraggableProps } from '../hooks/useDraggable';
import { useDndContext } from '../context/useDndContext';
import { resolveDragEffect } from '../animations/dragEffects';
import type { DragEffect, DragEffectConfig } from '../animations/dragEffects';

// ── DragHandle context (colocated to avoid dual-instance issues in monorepos) ──

interface DraggableItemContextValue {
  gesture: ComposedGesture | GestureType;
}

export const DraggableItemContext =
  createContext<DraggableItemContextValue | null>(null);

// ── Draggable ──

export interface DraggableProps extends UseDraggableProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** When true, dragging is only triggered by a DragHandle child instead of the entire element */
  handle?: boolean;
  /** @internal Skip default drag opacity — used by DraggableList which manages its own */
  _skipDragStyle?: boolean;
  // activeDragStyle, longPressDuration, and onPress are inherited from UseDraggableProps
  /** Animation effect applied to this item's drag overlay. Overrides the DndProvider-level dragEffect. */
  dragEffect?: DragEffect | DragEffectConfig;
}

/**
 * Component that makes its children draggable.
 *
 * @example
 * ```tsx
 * <Draggable id="item-1" data={{ label: 'Apple' }}>
 *   <View style={styles.item}>
 *     <Text>Drag me</Text>
 *   </View>
 * </Draggable>
 * ```
 */
export function Draggable({
  children,
  style,
  id,
  data,
  disabled,
  handle,
  _skipDragStyle,
  activeDragStyle,
  longPressDuration,
  onPress,
  dragEffect,
}: DraggableProps) {
  const context = useDndContext();
  const { ref, gesture, animatedStyle, onLayout } = useDraggable({
    id,
    data,
    disabled,
    activeDragStyle,
    longPressDuration,
    onPress,
  });

  // Keep a stable ref to the latest children/style so the renderer closure
  // always renders the current content without needing to re-register.
  const childrenRef = useRef(children);
  childrenRef.current = children;

  useEffect(() => {
    context.registerDragRenderer(id, () => childrenRef.current);

    return () => {
      context.unregisterDragRenderer(id);
    };
  }, [id, context]);

  // Register per-item drag effect so DragOverlayLayer can look it up by id.
  useEffect(() => {
    if (dragEffect) {
      const resolved = resolveDragEffect(dragEffect);
      context.registerDragEffect(id, resolved);
    }
    return () => {
      context.unregisterDragEffect(id);
    };
  }, [id, dragEffect, context]);

  const content = (
    <Animated.View
      ref={ref as any}
      style={[style, _skipDragStyle ? undefined : animatedStyle] as any}
      onLayout={onLayout}
    >
      {children}
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

// ── DragHandle ──

export interface DragHandleProps {
  children: React.ReactElement;
}

/**
 * Designates a child element as the drag trigger within a Draggable.
 * Must be used inside a `<Draggable handle>`.
 *
 * @example
 * ```tsx
 * <Draggable id="item-1" handle>
 *   <View style={styles.row}>
 *     <DragHandle>
 *       <View style={styles.grip}>
 *         <Text>⠿</Text>
 *       </View>
 *     </DragHandle>
 *     <Text>Item content</Text>
 *   </View>
 * </Draggable>
 * ```
 */
export function DragHandle({ children }: DragHandleProps) {
  const ctx = useContext(DraggableItemContext);

  // When rendered inside the DragOverlayLayer (visual clone), there is no
  // Provider — just render the children passively since the overlay is
  // pointer-events: none anyway.
  if (!ctx) return children;

  return <GestureDetector gesture={ctx.gesture}>{children}</GestureDetector>;
}
