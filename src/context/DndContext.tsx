import React, { createContext, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  useAnimatedRef,
  withSpring,
  runOnJS,
  measure,
  runOnUI,
  type AnimatedRef,
} from 'react-native-reanimated';
import type {
  DndContextValue,
  DraggableDescriptor,
  DroppableDescriptor,
  ActiveDragState,
} from './types';
import type { PortalContextValue } from '../portal/PortalContext';
import { usePortal } from '../portal/usePortal';
import type { DragEffect, DragEffectConfig } from '../animations/dragEffects';
import { resolveDragEffect } from '../animations/dragEffects';

export const DndContext = createContext<DndContextValue | null>(null);

// ============ DragOverlayLayer ============

interface DragOverlayLayerProps {
  activeId: DndContextValue['activeId'];
  absoluteX: DndContextValue['absoluteX'];
  absoluteY: DndContextValue['absoluteY'];
  overlayContainerOffsetX: DndContextValue['overlayContainerOffsetX'];
  overlayContainerOffsetY: DndContextValue['overlayContainerOffsetY'];
  overlayGrabOffsetX: DndContextValue['overlayGrabOffsetX'];
  overlayGrabOffsetY: DndContextValue['overlayGrabOffsetY'];
  overlayItemWidth: DndContextValue['overlayItemWidth'];
  overlayItemHeight: DndContextValue['overlayItemHeight'];
  dragRenderers: React.MutableRefObject<Map<string, () => React.ReactNode>>;
  dragEffectRegistry: React.MutableRefObject<Map<string, DragEffectConfig>>;
  portal: PortalContextValue | null;
  dragEffect?: DragEffectConfig;
}

function DragOverlayLayer({
  activeId,
  absoluteX,
  absoluteY,
  overlayContainerOffsetX,
  overlayContainerOffsetY,
  overlayGrabOffsetX,
  overlayGrabOffsetY,
  overlayItemWidth,
  overlayItemHeight,
  dragRenderers,
  dragEffectRegistry,
  portal,
  dragEffect,
}: DragOverlayLayerProps) {
  const [activeIdState, setActiveIdState] = useState<string | null>(null);
  const overlayScale = useSharedValue(1);

  useAnimatedReaction(
    () => activeId.value,
    (current, previous) => {
      if (current !== previous) {
        runOnJS(setActiveIdState)(current);
      }
    }
  );

  // Run scale animation on the JS thread so we can read the mutable registry ref.
  // Triggers when activeIdState changes (drag start → new id, drag end → null).
  useEffect(() => {
    if (activeIdState) {
      const itemEffect = dragEffectRegistry.current.get(activeIdState) ?? dragEffect;
      if (itemEffect) {
        overlayScale.value = 1;
        overlayScale.value = withSpring(itemEffect.scale, itemEffect.spring);
      }
    } else {
      overlayScale.value = 1;
    }
    // dragEffect and dragEffectRegistry are stable refs / primitive — intentionally
    // excluded from deps to avoid re-running when unrelated items register effects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIdState]);

  // Position the overlay so the grab point stays under the pointer.
  // All positioning values are measured on the UI thread in the gesture
  // worklet's onStart, ensuring accurate coordinates even inside ScrollViews.
  // useAnimatedStyle must be called unconditionally (hooks rules).
  const overlayStyle = useAnimatedStyle(() => {
    if (!activeId.value) {
      return { opacity: 0, position: 'absolute' as const, top: 0, left: 0 };
    }

    return {
      position: 'absolute' as const,
      left: absoluteX.value - overlayContainerOffsetX.value - overlayGrabOffsetX.value,
      top: absoluteY.value - overlayContainerOffsetY.value - overlayGrabOffsetY.value,
      width: overlayItemWidth.value,
      height: overlayItemHeight.value,
      opacity: 1,
      zIndex: 99999,
      transform: [{ scale: overlayScale.value }],
    };
  });

  const renderer = activeIdState ? dragRenderers.current.get(activeIdState) : null;

  // Send overlay content to portal when active state changes.
  // Only triggers on drag start/end, not on every animation frame.
  useEffect(() => {
    if (!portal) return;

    if (!activeIdState || !renderer) {
      portal.setOverlay('dnd', null);
      return;
    }

    portal.setOverlay('dnd',
      <Animated.View style={overlayStyle} pointerEvents="none">
        {renderer()}
      </Animated.View>
    );

    return () => portal.setOverlay('dnd', null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portal, activeIdState]);

  // Portal mode: don't render inline — the portal outlet handles rendering
  if (portal) return null;

  // Fallback: render inline when no portal is available
  if (!activeIdState || !renderer) return null;

  return (
    <View
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 99999 }}
      collapsable={false}
    >
      <Animated.View style={overlayStyle} pointerEvents="none">
        {renderer()}
      </Animated.View>
    </View>
  );
}

// ============ DndContextProvider ============

interface DndContextProviderProps {
  children: React.ReactNode;
  onDragStart?: DndContextValue['onDragStart'];
  onDragMove?: DndContextValue['onDragMove'];
  onDragOver?: DndContextValue['onDragOver'];
  onDragEnd?: DndContextValue['onDragEnd'];
  dragEffect?: DragEffect | DragEffectConfig;
}

export function DndContextProvider({
  children,
  onDragStart,
  onDragMove,
  onDragOver,
  onDragEnd,
  dragEffect: dragEffectProp,
}: DndContextProviderProps) {
  const dragEffect = dragEffectProp ? resolveDragEffect(dragEffectProp) : undefined;

  // Portal integration: read portal context if a PortalProvider wraps this component
  const portal = usePortal();
  const instanceId = useId();

  // Fallback shared values used when no portal is present.
  // Must be created unconditionally (hooks rules).
  const fallbackOutletX = useSharedValue(0);
  const fallbackOutletY = useSharedValue(0);

  // Ref for the wrapper View to measure its page offset
  const containerRef = useAnimatedRef<View>();

  // Registries using refs (mutable, don't cause re-renders)
  const draggables = useRef(new Map<string, DraggableDescriptor>()).current;
  const droppables = useRef(new Map<string, DroppableDescriptor>()).current;

  // Drag renderer registry for the overlay
  const dragRenderers = useRef(new Map<string, () => React.ReactNode>());

  // Per-item drag effect registry
  const dragEffectRegistry = useRef(new Map<string, DragEffectConfig>());

  // Active drag state (shared values for UI thread)
  const activeId = useSharedValue<string | null>(null);
  const activeState = useSharedValue<ActiveDragState | null>(null);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  // Absolute pointer position (set on UI thread by gesture worklet)
  const absoluteX = useSharedValue(0);
  const absoluteY = useSharedValue(0);

  // Global drag active (set immediately on UI thread by gesture worklet)
  const isDragging = useSharedValue(false);

  // Overlay positioning (set on UI thread by gesture worklet for accuracy)
  const overlayContainerOffsetX = useSharedValue(0);
  const overlayContainerOffsetY = useSharedValue(0);
  const overlayGrabOffsetX = useSharedValue(0);
  const overlayGrabOffsetY = useSharedValue(0);
  const overlayItemWidth = useSharedValue(0);
  const overlayItemHeight = useSharedValue(0);

  // Collision state
  const overId = useSharedValue<string | null>(null);
  const prevOverId = useRef<string | null>(null);

  // Registration methods
  const registerDraggable = useCallback((descriptor: DraggableDescriptor) => {
    draggables.set(descriptor.id, descriptor);
  }, [draggables]);

  const unregisterDraggable = useCallback((id: string) => {
    draggables.delete(id);
  }, [draggables]);

  const registerDroppable = useCallback((descriptor: DroppableDescriptor) => {
    droppables.set(descriptor.id, descriptor);
  }, [droppables]);

  const unregisterDroppable = useCallback((id: string) => {
    droppables.delete(id);
  }, [droppables]);

  // Drag renderer registration
  const registerDragRenderer = useCallback((id: string, renderer: () => React.ReactNode) => {
    dragRenderers.current.set(id, renderer);
  }, []);

  const unregisterDragRenderer = useCallback((id: string) => {
    dragRenderers.current.delete(id);
  }, []);

  // Per-item drag effect registration
  const registerDragEffect = useCallback((id: string, effect: DragEffectConfig) => {
    dragEffectRegistry.current.set(id, effect);
  }, []);

  const unregisterDragEffect = useCallback((id: string) => {
    dragEffectRegistry.current.delete(id);
  }, []);

  // Set active state and call callback
  const setActiveId = useCallback((id: string | null) => {
    activeId.value = id;
  }, [activeId]);

  const setActiveState = useCallback((state: ActiveDragState | null) => {
    activeState.value = state;
  }, [activeState]);

  // Measure all droppables
  const measureDroppables = useCallback(() => {
    droppables.forEach((droppable) => {
      if (droppable.node.current) {
        runOnUI(() => {
          'worklet';
          try {
            const measured = measure(droppable.node);
            if (measured) {
              droppable.rect.value = {
                x: measured.pageX,
                y: measured.pageY,
                width: measured.width,
                height: measured.height,
              };
            }
          } catch {
            // Measurement failed, ignore
          }
        })();
      }
    });
  }, [droppables]);

  const contextValue = useMemo<DndContextValue>(
    () => ({
      // Registry
      draggables,
      droppables,

      // Registration
      registerDraggable,
      unregisterDraggable,
      registerDroppable,
      unregisterDroppable,

      // Drag overlay renderer registration
      registerDragRenderer,
      unregisterDragRenderer,

      // Per-item drag effect registry
      registerDragEffect,
      unregisterDragEffect,
      dragEffectRegistry,

      // Container ref
      containerRef,

      // Portal state
      portalAvailable: portal !== null,
      portalOutletPageX: portal?.outletPageX ?? fallbackOutletX,
      portalOutletPageY: portal?.outletPageY ?? fallbackOutletY,

      // Active state
      activeId,
      activeState,
      translateX,
      translateY,
      absoluteX,
      absoluteY,
      isDragging,

      // Overlay positioning
      overlayContainerOffsetX,
      overlayContainerOffsetY,
      overlayGrabOffsetX,
      overlayGrabOffsetY,
      overlayItemWidth,
      overlayItemHeight,

      // Collision
      overId,

      // Methods
      setActiveId,
      setActiveState,
      measureDroppables,

      // Callbacks
      onDragStart,
      onDragMove,
      onDragOver,
      onDragEnd,
    }),
    [
      draggables,
      droppables,
      containerRef,
      portal,
      fallbackOutletX,
      fallbackOutletY,
      registerDraggable,
      unregisterDraggable,
      registerDroppable,
      unregisterDroppable,
      registerDragRenderer,
      unregisterDragRenderer,
      registerDragEffect,
      unregisterDragEffect,
      dragEffectRegistry,
      activeId,
      activeState,
      translateX,
      translateY,
      absoluteX,
      absoluteY,
      isDragging,
      overlayContainerOffsetX,
      overlayContainerOffsetY,
      overlayGrabOffsetX,
      overlayGrabOffsetY,
      overlayItemWidth,
      overlayItemHeight,
      overId,
      setActiveId,
      setActiveState,
      measureDroppables,
      onDragStart,
      onDragMove,
      onDragOver,
      onDragEnd,
    ]
  );

  // When a portal is available, mount DragOverlayLayer inside the portal so it
  // renders above all other content in the app (e.g. modals, sheets).
  // The shared values and refs are stable references so this effect runs once.
  useEffect(() => {
    if (!portal) return;

    const slotKey = `dnd-layer-${instanceId}`;
    portal.setOverlay(slotKey,
      <DragOverlayLayer
        activeId={activeId}
        absoluteX={absoluteX}
        absoluteY={absoluteY}
        overlayContainerOffsetX={overlayContainerOffsetX}
        overlayContainerOffsetY={overlayContainerOffsetY}
        overlayGrabOffsetX={overlayGrabOffsetX}
        overlayGrabOffsetY={overlayGrabOffsetY}
        overlayItemWidth={overlayItemWidth}
        overlayItemHeight={overlayItemHeight}
        dragRenderers={dragRenderers}
        dragEffectRegistry={dragEffectRegistry}
        portal={null}
        dragEffect={dragEffect}
      />
    );

    return () => portal.setOverlay(slotKey, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portal]);

  return (
    <DndContext.Provider value={contextValue}>
      <Animated.View ref={containerRef as any} style={{ flex: 1, position: 'relative', overflow: 'visible' }} collapsable={false}>
        {children}
        {/* Only render the overlay inline when no portal is wrapping this provider */}
        {!portal && (
          <DragOverlayLayer
            activeId={activeId}
            absoluteX={absoluteX}
            absoluteY={absoluteY}
            overlayContainerOffsetX={overlayContainerOffsetX}
            overlayContainerOffsetY={overlayContainerOffsetY}
            overlayGrabOffsetX={overlayGrabOffsetX}
            overlayGrabOffsetY={overlayGrabOffsetY}
            overlayItemWidth={overlayItemWidth}
            overlayItemHeight={overlayItemHeight}
            dragRenderers={dragRenderers}
            dragEffectRegistry={dragEffectRegistry}
            portal={null}
            dragEffect={dragEffect}
          />
        )}
      </Animated.View>
    </DndContext.Provider>
  );
}
