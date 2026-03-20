import React from 'react';

interface SortableItemRendererProps<T> {
  item: T;
  index: number;
  isDragging: boolean;
  renderer: (info: { item: T; index: number; isDragging: boolean }) => React.ReactNode;
}

function SortableItemRendererInner<T>({
  item,
  index,
  isDragging,
  renderer,
}: SortableItemRendererProps<T>) {
  return <>{renderer({ item, index, isDragging })}</>;
}

export const SortableItemRenderer = React.memo(
  SortableItemRendererInner
) as typeof SortableItemRendererInner;
