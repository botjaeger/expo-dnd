import type { SharedValue } from 'react-native-reanimated';
import type React from 'react';
import type { ViewStyle } from 'react-native';

export interface FixedSortableItemProps<T> {
  item: T;
  itemId: string;
  originalIndex: number;
  itemCount: number;
  itemHeight: number;
  totalSize: number;
  gap: number;
  direction: 'horizontal' | 'vertical';
  handle?: boolean;
  zoneId: string;
  activeDragStyle?: ViewStyle;
  positions: SharedValue<{ [id: string]: number }>;
  originalPrefixSum: SharedValue<number[]>;
  currentPrefixSum: SharedValue<number[]>;
  activeId: SharedValue<string | null>;
  isDragging: SharedValue<boolean>;
  containerStart: SharedValue<number>;
  /** Lifted shared value: written by the active item's gesture for the overlay */
  liftedGestureTranslation: SharedValue<number>;
  /** Lifted shared value: the start pixel position at drag start */
  liftedStartPixelPosition: SharedValue<number>;
  /** Lifted shared value: scale applied to the overlay */
  liftedAnimatedScale: SharedValue<number>;
  /** Lifted shared value: true while drag overlay should be visible */
  liftedIsActive: SharedValue<boolean>;
  /** Called when an item becomes active (drag starts) */
  onActivate: (item: T, index: number) => void;
  /** Called when the active item is released */
  onDeactivate: () => void;
  renderItem: (info: { item: T; index: number; isDragging: boolean }) => React.ReactNode;
  onDragStart: (id: string, index: number) => void;
  onDragMove: (id: string, overIndex: number, position: number) => void;
  onDragEnd: (id: string, fromIndex: number, toIndex: number) => void;
}
