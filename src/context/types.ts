import type React from 'react';
import type { SharedValue, AnimatedRef } from 'react-native-reanimated';
import type { View } from 'react-native';
import type { DragEffect, DragEffectConfig } from '../animations/dragEffects';

/**
 * Rectangle layout measurements
 */
export interface LayoutRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Draggable item descriptor stored in registry
 */
export interface DraggableDescriptor {
  id: string;
  data?: unknown;
  disabled: boolean;
  node: AnimatedRef<View>;
}

/**
 * Droppable zone descriptor stored in registry
 */
export interface DroppableDescriptor {
  id: string;
  data?: unknown;
  disabled: boolean;
  node: AnimatedRef<View>;
  rect: SharedValue<LayoutRect | null>;
}

/**
 * Active drag state tracked during a drag operation
 */
export interface ActiveDragState {
  id: string;
  data?: unknown;
  initialRect: LayoutRect;
  containerOffset: { x: number; y: number };
  grabOffset: { x: number; y: number };
}

/**
 * Drag start event payload
 */
export interface DragStartEvent {
  active: {
    id: string;
    data?: unknown;
  };
}

/**
 * Drag move event payload
 */
export interface DragMoveEvent {
  active: {
    id: string;
    data?: unknown;
  };
  translation: {
    x: number;
    y: number;
  };
  absoluteX: number;
  absoluteY: number;
}

/**
 * Drag over event payload
 */
export interface DragOverEvent {
  active: {
    id: string;
    data?: unknown;
  };
  over: {
    id: string;
    data?: unknown;
  } | null;
}

/**
 * Drag end event payload
 */
export interface DragEndEvent {
  active: {
    id: string;
    data?: unknown;
  };
  over: {
    id: string;
    data?: unknown;
  } | null;
}

/**
 * DnD context value exposed to consumers
 */
export interface DndContextValue {
  // Registry
  draggables: Map<string, DraggableDescriptor>;
  droppables: Map<string, DroppableDescriptor>;

  // Registration methods
  registerDraggable: (descriptor: DraggableDescriptor) => void;
  unregisterDraggable: (id: string) => void;
  registerDroppable: (descriptor: DroppableDescriptor) => void;
  unregisterDroppable: (id: string) => void;

  // Drag overlay renderer registration
  registerDragRenderer: (id: string, renderer: () => React.ReactNode) => void;
  unregisterDragRenderer: (id: string) => void;

  // Per-item drag effect registry
  registerDragEffect: (id: string, effect: DragEffectConfig) => void;
  unregisterDragEffect: (id: string) => void;
  dragEffectRegistry: React.MutableRefObject<Map<string, DragEffectConfig>>;

  // Active state (shared values for UI thread access)
  activeId: SharedValue<string | null>;
  activeState: SharedValue<ActiveDragState | null>;
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;

  // Absolute pointer position (set on UI thread by gesture worklet)
  absoluteX: SharedValue<number>;
  absoluteY: SharedValue<number>;

  // Global drag active flag (set immediately on UI thread by gesture worklet)
  isDragging: SharedValue<boolean>;

  // Collision state
  overId: SharedValue<string | null>;

  // Container ref (for measuring overlay offset)
  containerRef: AnimatedRef<View>;

  // Portal state (set by DndContextProvider when PortalProvider is detected)
  portalAvailable: boolean;
  portalOutletPageX: SharedValue<number>;
  portalOutletPageY: SharedValue<number>;

  // Overlay positioning shared values (set on UI thread by gesture worklet for accuracy)
  overlayContainerOffsetX: SharedValue<number>;
  overlayContainerOffsetY: SharedValue<number>;
  overlayGrabOffsetX: SharedValue<number>;
  overlayGrabOffsetY: SharedValue<number>;
  overlayItemWidth: SharedValue<number>;
  overlayItemHeight: SharedValue<number>;

  // Methods
  setActiveId: (id: string | null) => void;
  setActiveState: (state: ActiveDragState | null) => void;
  measureDroppables: () => void;

  // Callbacks
  onDragStart?: (event: DragStartEvent) => void;
  onDragMove?: (event: DragMoveEvent) => void;
  onDragOver?: (event: DragOverEvent) => void;
  onDragEnd?: (event: DragEndEvent) => void;
}

/**
 * DndProvider props
 */
export interface DndProviderProps {
  children: React.ReactNode;
  onDragStart?: (event: DragStartEvent) => void;
  onDragMove?: (event: DragMoveEvent) => void;
  onDragOver?: (event: DragOverEvent) => void;
  onDragEnd?: (event: DragEndEvent) => void;
  /** Animation effect applied to the drag overlay when picked up */
  dragEffect?: DragEffect | DragEffectConfig;
}
