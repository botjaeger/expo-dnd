// Components
export { DndProvider } from './components/DndProvider';
export { Draggable, type DraggableProps, DragHandle, type DragHandleProps } from './components/Draggable';
export { Droppable, type DroppableProps, type DroppableRenderProps } from './components/Droppable';
export {
  AutoSortable as SortableList,
  type AutoSortableProps as SortableListProps,
} from './components/AutoSortable';
export { SortableFlatList } from './components/SortableFlatList';
export { DraggableList, DraggableListGroup, type DraggableListProps, type DraggableListGroupProps, type DraggableListItemInfo, type DropEvent } from './components/DraggableList';

// Hooks
export { useDraggable, type UseDraggableProps, type UseDraggableReturn } from './hooks/useDraggable';
export { useDroppable, type UseDroppableProps, type UseDroppableReturn } from './hooks/useDroppable';
export { useDndContext } from './context/useDndContext';

// Types
export type {
  DndProviderProps,
  DragStartEvent,
  DragMoveEvent,
  DragOverEvent,
  DragEndEvent,
  LayoutRect,
  ActiveDragState,
} from './context/types';

// Collision
export { rectIntersection } from './collision/rectIntersection';
export type { CollisionDetectionAlgorithm, CollisionResult, CollisionRect } from './collision/types';

// Animations
export { dragEffects, resolveDragEffect, type DragEffect, type DragEffectConfig } from './animations/dragEffects';

// Utils
export { isWeb, isIOS, isAndroid } from './utils/platform';
export {
  listToPositions,
  objectMove,
  getPositionIndex,
  reorderData,
  positionsToOrderedIds,
  clamp,
} from './utils/sortable';
export {
  resolveItemSizes,
  buildPrefixSum,
  getIndexAtPosition,
  getIndexAtMidpoint,
  getOffsetForIndex,
  getTotalSize,
  computeCurrentPrefixSum,
} from './utils/heights';
