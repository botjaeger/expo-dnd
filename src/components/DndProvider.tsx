import React from 'react';
import { DndContextProvider } from '../context/DndContext';
import { PortalProvider } from '../portal';
import { usePortal } from '../portal/usePortal';
import type { DndProviderProps } from '../context/types';

/**
 * Provider component that enables drag and drop functionality.
 * Automatically includes a PortalProvider for drag overlays.
 * If a PortalProvider already exists above this component in the tree,
 * it reuses that one instead of creating a new portal scope.
 *
 * @example
 * ```tsx
 * <DndProvider
 *   onDragStart={(e) => console.log('Started dragging:', e.active.id)}
 *   onDragEnd={(e) => {
 *     if (e.over) {
 *       console.log(`Dropped ${e.active.id} on ${e.over.id}`);
 *     }
 *   }}
 * >
 *   <Draggable id="item-1">...</Draggable>
 *   <Droppable id="zone-1">...</Droppable>
 * </DndProvider>
 * ```
 */
export function DndProvider({
  children,
  onDragStart,
  onDragMove,
  onDragOver,
  onDragEnd,
  dragEffect,
  style,
}: DndProviderProps) {
  const existingPortal = usePortal();

  const inner = (
    <DndContextProvider
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      dragEffect={dragEffect}
      style={style}
    >
      {children}
    </DndContextProvider>
  );

  // If a PortalProvider already exists above us, reuse it.
  // Otherwise, wrap with one so overlays work out of the box.
  if (existingPortal) return inner;
  return <PortalProvider>{inner}</PortalProvider>;
}
