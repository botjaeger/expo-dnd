import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, LayoutChangeEvent } from 'react-native';
import type { ViewStyle, StyleProp } from 'react-native';
import { DraggableList, type DraggableListProps, type DraggableListItemInfo } from './DraggableList';

// ============ Types ============

export type AutoDraggableListProps<T> = Omit<DraggableListProps<T>, 'itemSize'> & {
  /** Size of each item. If omitted, items are auto-measured after render. */
  itemSize?: number | ((index: number) => number);
};

// ============ Item Renderer (memoized) ============

interface ItemRendererProps<T> {
  item: T;
  index: number;
  isDragging: boolean;
  renderer: (info: DraggableListItemInfo<T>) => React.ReactNode;
}

function ItemRendererInner<T>({ item, index, isDragging, renderer }: ItemRendererProps<T>) {
  return <>{renderer({ item, index, isDragging })}</>;
}

const ItemRenderer = React.memo(ItemRendererInner) as typeof ItemRendererInner;

// ============ AutoDraggableList ============

/**
 * A wrapper around DraggableList that automatically measures item sizes.
 * No `itemSize` prop needed — items are rendered once for measurement,
 * then the measured sizes are passed to DraggableList.
 *
 * If `itemSize` is provided, measurement is skipped and the value is
 * passed through directly (same behavior as DraggableList).
 */
export function AutoDraggableList<T>({
  data,
  renderItem,
  keyExtractor,
  itemSize,
  direction = 'vertical',
  style,
  ...rest
}: AutoDraggableListProps<T>) {
  const isHorizontal = direction === 'horizontal';

  // If itemSize is provided, skip measurement and delegate directly
  if (itemSize !== undefined) {
    return (
      <DraggableList
        data={data}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        itemSize={itemSize}
        direction={direction}
        style={style}
        {...rest}
      />
    );
  }

  // Auto-measurement mode
  return (
    <AutoMeasuredDraggableList
      data={data}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      direction={direction}
      isHorizontal={isHorizontal}
      style={style}
      {...rest}
    />
  );
}

// ============ AutoMeasuredDraggableList ============

function AutoMeasuredDraggableList<T>({
  data,
  renderItem,
  keyExtractor,
  direction,
  isHorizontal,
  style,
  ...rest
}: Omit<DraggableListProps<T>, 'itemSize'> & { isHorizontal: boolean }) {
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

  // Reset measurements when direction changes
  useEffect(() => {
    pendingRef.current = {};
    if (batchTimerRef.current) {
      clearTimeout(batchTimerRef.current);
      batchTimerRef.current = null;
    }
    setMeasured({});
  }, [isHorizontal]);

  // Remove measurements for items that no longer exist
  useEffect(() => {
    setMeasured((prev) => {
      const next: Record<string, number> = {};
      for (const item of data) {
        const key = keyExtractor(item);
        if (key in prev) {
          next[key] = prev[key];
        }
      }
      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(next);
      if (prevKeys.length !== nextKeys.length || prevKeys.some((k) => !(k in next))) {
        return next;
      }
      return prev;
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
              <ItemRenderer
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

  // All measured: delegate to DraggableList with computed sizes
  const itemSizeFn = (index: number): number => {
    return measured[keyExtractor(data[index])] ?? 0;
  };

  return (
    <DraggableList
      data={data}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      itemSize={itemSizeFn}
      direction={direction}
      style={style}
      {...rest}
    />
  );
}
