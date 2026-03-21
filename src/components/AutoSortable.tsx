import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, LayoutChangeEvent } from 'react-native';
import type { ViewStyle, StyleProp } from 'react-native';
import { SortableList } from './SortableList';
import { SortableItemRenderer } from './sortable-shared';

// ============ Types ============

export interface AutoSortableProps<T> {
  /** Unique identifier for this sortable zone */
  id?: string;
  /** Array of items to render */
  data: T[];
  /** Render function for each item */
  renderItem: (info: { item: T; index: number; isDragging: boolean }) => React.ReactNode;
  /** Called when items are reordered */
  onReorder: (data: T[], event: { fromIndex: number; toIndex: number; item: T }) => void;
  /** Extract unique key from item */
  keyExtractor: (item: T) => string;
  /** Container size - if provided, enables scroll mode with auto-scroll */
  containerSize?: number;
  /** Horizontal or vertical orientation (default: 'horizontal') */
  direction?: 'horizontal' | 'vertical';
  /** Distance from edge to trigger auto-scroll (default: 80). Only used in scroll mode. */
  autoScrollThreshold?: number;
  /** Custom style for the container */
  style?: any;
  /** Called when drag starts */
  onDragStart?: (id: string, index: number) => void;
  /** Called during drag with position updates */
  onDragMove?: (id: string, overIndex: number, position: number) => void;
  /** Called when drag ends (before onReorder) */
  onDragEnd?: (id: string, fromIndex: number, toIndex: number) => void;
  /** When true, only a DragHandle inside renderItem triggers dragging */
  handle?: boolean;
  /** Style applied to the source item placeholder while it is being dragged.
   *  Defaults to { opacity: 0 } (invisible). Set e.g. { opacity: 0.3 } to show a ghost. */
  activeDragStyle?: import('react-native').ViewStyle;
  /** Render a custom insertion indicator at the current drag position.
   *  Receives the target index. Return null to hide. */
  renderInsertIndicator?: (index: number) => React.ReactNode;
  /** Animation effect applied to the drag overlay when picked up */
  dragEffect?: import('../animations/dragEffects').DragEffect | import('../animations/dragEffects').DragEffectConfig;
  /** Called when an external Draggable is dropped onto this list.
   *  Only fires when SortableList is inside a DndProvider. */
  onExternalDrop?: (event: { activeId: string; data?: unknown; insertIndex: number }) => void;
}

// ============ AutoSortable ============

/**
 * A wrapper around Sortable that automatically measures item heights.
 * No `itemSize` prop needed — items are rendered once for measurement,
 * then the measured sizes are passed to Sortable.
 */
export function AutoSortable<T>({
  data,
  renderItem,
  onReorder,
  keyExtractor,
  direction = 'horizontal',
  style,
  ...rest
}: AutoSortableProps<T>) {
  const isHorizontal = direction === 'horizontal';

  // Cache measured sizes by item key
  const [measured, setMeasured] = useState<Record<string, number>>({});
  const pendingRef = useRef<Record<string, number>>({});
  const batchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const allMeasured = data.length > 0 && data.every((item) => keyExtractor(item) in measured);

  useEffect(() => {
    return () => {
      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current);
      }
    };
  }, []);

  // Width-based and height-based measurements are not interchangeable.
  useEffect(() => {
    pendingRef.current = {};
    if (batchTimerRef.current) {
      clearTimeout(batchTimerRef.current);
      batchTimerRef.current = null;
    }
    setMeasured({});
  }, [isHorizontal]);

  // Remove measurements for items that no longer exist.
  useEffect(() => {
    setMeasured((prev) => {
      const next: Record<string, number> = {};
      let changed = false;

      for (const item of data) {
        const key = keyExtractor(item);
        if (key in prev) {
          next[key] = prev[key];
        }
      }

      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(next);
      if (prevKeys.length !== nextKeys.length) {
        changed = true;
      } else {
        for (const key of prevKeys) {
          if (!(key in next)) {
            changed = true;
            break;
          }
        }
      }

      return changed ? next : prev;
    });
  }, [data, keyExtractor]);

  const handleItemLayout = useCallback(
    (key: string, event: LayoutChangeEvent) => {
      const size = isHorizontal
        ? event.nativeEvent.layout.width
        : event.nativeEvent.layout.height;

      // Batch updates to avoid per-item re-renders
      pendingRef.current[key] = size;

      if (batchTimerRef.current) clearTimeout(batchTimerRef.current);
      batchTimerRef.current = setTimeout(() => {
        const batch = { ...pendingRef.current };
        pendingRef.current = {};
        setMeasured((prev) => {
          // Skip update if nothing changed
          let changed = false;
          for (const k in batch) {
            if (prev[k] !== batch[k]) {
              changed = true;
              break;
            }
          }
          if (!changed) return prev;
          return { ...prev, ...batch };
        });
      }, 0);
    },
    [isHorizontal]
  );

  // Measurement phase: render items in a normal flex layout
  if (!allMeasured) {
    const containerStyle: StyleProp<ViewStyle> = [
      { overflow: 'hidden' as const },
      isHorizontal
        ? { flexDirection: 'row' as const }
        : { flexDirection: 'column' as const },
      style,
    ];

    return (
      <View style={containerStyle}>
        {data.map((item, index) => {
          const key = keyExtractor(item);
          return (
            <View key={key} onLayout={(e) => handleItemLayout(key, e)}>
              <SortableItemRenderer
                item={item}
                index={index}
                isDragging={false}
                renderer={renderItem}
              />
            </View>
          );
        })}
      </View>
    );
  }

  // All measured: delegate to SortableList with computed sizes
  const itemSizeFn = (index: number): number => {
    return measured[keyExtractor(data[index])] ?? 0;
  };

  return (
    <SortableList
      data={data}
      renderItem={renderItem}
      onReorder={onReorder}
      keyExtractor={keyExtractor}
      itemSize={itemSizeFn}
      direction={direction}
      style={style}
      {...rest}
    />
  );
}
