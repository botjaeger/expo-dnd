import { useContext } from 'react';
import { DndContext } from './DndContext';
import type { DndContextValue } from './types';

/**
 * Hook to access the DnD context.
 * Must be used within a DndProvider.
 */
export function useDndContext(): DndContextValue {
  const context = useContext(DndContext);

  if (!context) {
    throw new Error('useDndContext must be used within a DndProvider');
  }

  return context;
}
