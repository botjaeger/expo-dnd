import React, { useCallback, useRef, useEffect, useMemo, createContext, useContext, useState } from 'react';
import { View, StyleSheet, LayoutChangeEvent } from 'react-native';
import type { ViewStyle, StyleProp } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  useAnimatedRef,
  useDerivedValue,
  withTiming,
  runOnJS,
  runOnUI,
  scrollTo,
  SharedValue,
} from 'react-native-reanimated';
import { DndProvider } from './DndProvider';
import { Draggable } from './Draggable';
import { Droppable } from './Droppable';
import { useDndContext } from '../context/useDndContext';
import { useAutoScroll } from '../hooks/useAutoScroll';
import { AUTO_SCROLL_THRESHOLD, TIMING_CONFIG } from './sortable-shared/constants';
import type { DragStartEvent, DragMoveEvent, DragOverEvent, DragEndEvent } from '../context/types';
import { clamp } from '../utils/sortable';
import {
  resolveItemSizes,
  buildPrefixSum,
  getInsertionIndexAtPosition,
} from '../utils/heights';
import { resolveDragEffect } from '../animations/dragEffects';
import type { DragEffectConfig } from '../animations/dragEffects';

// ============ Types ============

export interface DraggableListItemInfo<T> {
  item: T;
  index: number;
  isDragging: boolean;
}

export interface DropEvent<T> {
  /** The dragged item */
  item: T;
  /** Source list ID */
  fromListId: string;
  /** Source index within the list */
  fromIndex: number;
  /** Target list ID */
  toListId: string;
  /** Target index.
   *  Same-list reorder: final index after the move.
   *  Cross-list drop: insertion index within the target list. */
  toIndex: number;
}

export interface DraggableListProps<T> {
  /** Unique identifier for this list/zone */
  id: string;
  /** Array of items to render */
  data: T[];
  /** Render function for each item */
  renderItem: (info: DraggableListItemInfo<T>) => React.ReactNode;
  /** Extract unique key from item */
  keyExtractor: (item: T) => string;
  /** Size of each item (height for vertical, width for horizontal).
   *  Pass a number for uniform sizes, or a function (index) => size for variable sizes. */
  itemSize: number | ((index: number) => number);
  /** Direction of the list */
  direction?: 'horizontal' | 'vertical';
  /** Style for the container */
  style?: StyleProp<ViewStyle>;
  /** Fixed container size to enable scroll mode with auto-scroll.
   *  When set, the list wraps content in a ScrollView of this height (or width for horizontal). */
  containerSize?: number;
  /** Distance from edge that triggers auto-scroll (default: 80) */
  autoScrollThreshold?: number;
  /** When true, only a child DragHandle inside renderItem can start dragging */
  handle?: boolean;
  /** Style applied to the droppable container when a draggable is hovering over it */
  activeContainerStyle?: StyleProp<ViewStyle>;
  /** Style applied to the source item placeholder while it is being dragged.
   *  Defaults to { opacity: 0 } (invisible). Set e.g. { opacity: 0.3 } to show a ghost. */
  activeDragStyle?: ViewStyle;
  /** Render a custom insertion indicator at the target drop index.
   *  Receives the target index. Return null to hide. */
  renderInsertIndicator?: (index: number) => React.ReactNode;
  /** Animation effect applied to the drag overlay for items in this list.
   *  Overrides the DndProvider-level dragEffect set on DraggableListGroup. */
  dragEffect?: import('../animations/dragEffects').DragEffect | import('../animations/dragEffects').DragEffectConfig;
  /** Long press duration in ms before drag activates (default: 200) */
  longPressDuration?: number;
  /** Called when an item is tapped (not dragged). Suppressed after a drag completes. */
  onItemPress?: (item: T, index: number) => void;
}

export interface DraggableListGroupProps<T> {
  children: React.ReactNode;
  /** Called when an item is dropped */
  onDrop: (event: DropEvent<T>) => void;
  /** Animation effect applied to the drag overlay when picked up */
  dragEffect?: import('../animations/dragEffects').DragEffect | import('../animations/dragEffects').DragEffectConfig;
  /** Long press duration in ms before drag activates (default: 200) */
  longPressDuration?: number;
}

interface DraggableListItemRendererProps<T> {
  item: T;
  index: number;
  isDragging: boolean;
  renderer: (info: DraggableListItemInfo<T>) => React.ReactNode;
}

function DraggableListItemRendererInner<T>({
  item,
  index,
  isDragging,
  renderer,
}: DraggableListItemRendererProps<T>) {
  return <>{renderer({ item, index, isDragging })}</>;
}

const DraggableListItemRenderer = React.memo(
  DraggableListItemRendererInner
) as typeof DraggableListItemRendererInner;

// ============ Context ============

interface ItemData<T> {
  item: T;
  listId: string;
  index: number;
}

interface ListInfo {
  itemCount: number;
  itemIds: string[];
  itemSize: number | ((index: number) => number);
  direction: 'horizontal' | 'vertical';
  heights: number[];
  prefixSum: number[];
}

interface AfterDropScrollRequest {
  fromListId: string;
  fromIndex: number;
  toListId: string;
  toIndex: number;
}

interface DraggableListContextValue<T = any> {
  // Active drag state
  sourceItemId: SharedValue<string | null>;
  sourceListId: SharedValue<string | null>;
  sourceIndex: SharedValue<number>;

  // Target state
  targetListId: SharedValue<string | null>;
  targetIndex: SharedValue<number>;

  // Height of the currently dragged item
  draggedItemHeight: SharedValue<number>;

  // Current drag translation (for calculating insertion point)
  dragTranslation: SharedValue<{ x: number; y: number }>;
  pointerPosition: SharedValue<{ x: number; y: number }>;

  // List registration
  registerList: (
    id: string,
    itemIds: string[],
    itemSize: number | ((index: number) => number),
    direction: 'horizontal' | 'vertical'
  ) => void;
  unregisterList: (id: string) => void;
  getListInfo: (id: string) => ListInfo | undefined;

  // Layout tracking
  listLayouts: React.MutableRefObject<Map<string, { x: number; y: number; width: number; height: number }>>;
  updateListLayout: (id: string, layout: { x: number; y: number; width: number; height: number }) => void;

  // Scroll offset tracking (per-list)
  listScrollOffsets: React.MutableRefObject<Map<string, SharedValue<number>>>;
  registerListScrollOffset: (id: string, offset: SharedValue<number>) => void;
  unregisterListScrollOffset: (id: string) => void;

  // After-drop scroll callbacks (per-list)
  registerAfterDropScroll: (id: string, cb: (request: AfterDropScrollRequest) => void) => void;
  unregisterAfterDropScroll: (id: string) => void;

  // Recalculate target index (e.g., when auto-scroll changes scroll offset)
  recalculateTarget: () => void;
}

const DraggableListContext = createContext<DraggableListContextValue | null>(null);

const INTERNAL_LIST_DROPPABLE_PREFIX = '__draggable_list__:';
const INTERNAL_LIST_ITEM_PREFIX = '__draggable_list_item__:';

function getInternalListDroppableId(listId: string): string {
  return `${INTERNAL_LIST_DROPPABLE_PREFIX}${listId}`;
}

function getInternalListItemId(listId: string, itemId: string): string {
  return `${INTERNAL_LIST_ITEM_PREFIX}${listId}:${itemId}`;
}

function parseInternalListItemId(id: string): { listId: string; itemId: string } | null {
  if (!id.startsWith(INTERNAL_LIST_ITEM_PREFIX)) {
    return null;
  }

  const raw = id.slice(INTERNAL_LIST_ITEM_PREFIX.length);
  const sep = raw.indexOf(':');
  if (sep < 0) {
    return null;
  }

  return {
    listId: raw.slice(0, sep),
    itemId: raw.slice(sep + 1),
  };
}

function getPublicListId(over: NonNullable<DragOverEvent['over']> | NonNullable<DragEndEvent['over']>): string {
  if (
    over.data &&
    typeof over.data === 'object' &&
    'listId' in over.data &&
    typeof (over.data as { listId?: unknown }).listId === 'string'
  ) {
    return (over.data as { listId: string }).listId;
  }

  if (over.id.startsWith(INTERNAL_LIST_DROPPABLE_PREFIX)) {
    return over.id.slice(INTERNAL_LIST_DROPPABLE_PREFIX.length);
  }

  return over.id;
}

function useDraggableListContext<T>() {
  const context = useContext(DraggableListContext);
  if (!context) {
    throw new Error('DraggableList must be used within a DraggableListGroup');
  }
  return context as DraggableListContextValue<T>;
}

// ============ DraggableListGroup ============

export function DraggableListGroup<T>({ children, onDrop, dragEffect }: DraggableListGroupProps<T>) {
  // Active drag state
  const sourceItemId = useSharedValue<string | null>(null);
  const sourceListId = useSharedValue<string | null>(null);
  const sourceIndex = useSharedValue<number>(-1);

  // Target state
  const targetListId = useSharedValue<string | null>(null);
  const targetIndex = useSharedValue<number>(-1);

  // Height of dragged item
  const draggedItemHeight = useSharedValue<number>(0);

  // Drag translation
  const dragTranslation = useSharedValue({ x: 0, y: 0 });
  const pointerPosition = useSharedValue({ x: 0, y: 0 });

  // List registry
  const listsRef = useRef<Map<string, ListInfo>>(new Map());
  const listLayoutsRef = useRef<Map<string, { x: number; y: number; width: number; height: number }>>(new Map());
  const listScrollOffsetsRef = useRef<Map<string, SharedValue<number>>>(new Map());

  // Active item data for JS callback
  const activeDataRef = useRef<ItemData<T> | null>(null);

  const registerList = useCallback((
    id: string,
    itemIds: string[],
    itemSize: number | ((index: number) => number),
    direction: 'horizontal' | 'vertical'
  ) => {
    for (const [otherId, info] of listsRef.current.entries()) {
      if (otherId !== id && info.direction !== direction) {
        throw new Error('DraggableListGroup only supports lists with the same direction.');
      }
    }

    const itemCount = itemIds.length;
    const heights = resolveItemSizes(itemSize, itemCount);
    const prefixSum = buildPrefixSum(heights);
    listsRef.current.set(id, { itemCount, itemIds, itemSize, direction, heights, prefixSum });
  }, []);

  const unregisterList = useCallback((id: string) => {
    listsRef.current.delete(id);
    listLayoutsRef.current.delete(id);
  }, []);

  const getListInfo = useCallback((id: string) => {
    return listsRef.current.get(id);
  }, []);

  const updateListLayout = useCallback((id: string, layout: { x: number; y: number; width: number; height: number }) => {
    listLayoutsRef.current.set(id, layout);
  }, []);

  const registerListScrollOffset = useCallback((id: string, offset: SharedValue<number>) => {
    listScrollOffsetsRef.current.set(id, offset);
  }, []);

  const unregisterListScrollOffset = useCallback((id: string) => {
    listScrollOffsetsRef.current.delete(id);
  }, []);

  // After-drop scroll registry
  const afterDropScrollRef = useRef<Map<string, (request: AfterDropScrollRequest) => void>>(new Map());

  const registerAfterDropScroll = useCallback((id: string, cb: (request: AfterDropScrollRequest) => void) => {
    afterDropScrollRef.current.set(id, cb);
  }, []);

  const unregisterAfterDropScroll = useCallback((id: string) => {
    afterDropScrollRef.current.delete(id);
  }, []);

  // Calculate target index based on the live pointer position.
  const calculateTargetIndex = useCallback((targetList: string, activeData: ItemData<T>): number => {
    const targetInfo = listsRef.current.get(targetList);
    const targetLayout = listLayoutsRef.current.get(targetList);
    if (!targetInfo || !targetLayout) return 0;

    const isHorizontal = targetInfo.direction === 'horizontal';
    const targetScrollOffset = listScrollOffsetsRef.current.get(targetList)?.value ?? 0;
    const pointerAxis = isHorizontal ? pointerPosition.value.x : pointerPosition.value.y;
    const targetStart = isHorizontal ? targetLayout.x : targetLayout.y;
    const relativePos = (pointerAxis - targetStart) + targetScrollOffset;

    const insertionIndex = getInsertionIndexAtPosition(
      targetInfo.prefixSum,
      relativePos,
      targetInfo.itemCount
    );

    if (targetList === activeData.listId && insertionIndex > activeData.index) {
      return clamp(insertionIndex - 1, 0, targetInfo.itemCount);
    }

    return clamp(insertionIndex, 0, targetInfo.itemCount);
  }, []);

  // Recalculate target index using current scroll offsets (called during auto-scroll)
  const recalculateTarget = useCallback(() => {
    const data = activeDataRef.current;
    const currentTargetList = targetListId.value;
    if (data && currentTargetList) {
      const index = calculateTargetIndex(currentTargetList, data);
      targetIndex.value = index;
    }
  }, [targetListId, targetIndex, calculateTargetIndex]);

  // DndProvider callbacks
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data as ItemData<T> | undefined;
    if (data) {
      const parsed = parseInternalListItemId(event.active.id);
      const listId = parsed?.listId ?? data.listId;
      const sourceInfo = listsRef.current.get(listId);
      const resolvedIndex = parsed && sourceInfo
        ? sourceInfo.itemIds.indexOf(parsed.itemId)
        : data.index;
      const currentIndex = resolvedIndex >= 0 ? resolvedIndex : data.index;

      activeDataRef.current = {
        ...data,
        listId,
        index: currentIndex,
      };
      sourceItemId.value = event.active.id;
      sourceListId.value = listId;
      sourceIndex.value = currentIndex;

      // Store dragged item's height
      if (sourceInfo) {
        draggedItemHeight.value = sourceInfo.heights[currentIndex] ?? 0;
      }

    }
  }, [sourceListId, sourceIndex, draggedItemHeight]);

  const handleDragMove = useCallback((event: DragMoveEvent) => {
    dragTranslation.value = event.translation;
    pointerPosition.value = { x: event.absoluteX, y: event.absoluteY };

    // Recalculate target index as we drag (critical for within-list sorting)
    const data = activeDataRef.current;
    const currentTargetList = targetListId.value;
    if (data && currentTargetList) {
      const index = calculateTargetIndex(currentTargetList, data);
      targetIndex.value = index;
    }
  }, [dragTranslation, pointerPosition, targetListId, targetIndex, calculateTargetIndex]);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const data = activeDataRef.current;

    if (event.over && data) {
      // The over.id is the Droppable id, which is the list id
      const listId = getPublicListId(event.over);
      targetListId.value = listId;

      // Calculate insertion index
      const index = calculateTargetIndex(listId, data);
      targetIndex.value = index;
    } else if (data && targetListId.value === data.listId) {
      // Preserve same-list reorder preview when the pointer temporarily leaves
      // the droppable bounds during edge auto-scroll. The droppable highlight
      // still turns off because DndContext.overId is null; this only keeps the
      // insertion preview clamped to the source list.
      const index = calculateTargetIndex(data.listId, data);
      targetListId.value = data.listId;
      targetIndex.value = index;
    } else {
      targetListId.value = null;
      targetIndex.value = -1;
    }
  }, [targetListId, targetIndex, dragTranslation, calculateTargetIndex]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const data = activeDataRef.current;

    if (data && event.over) {
      const toListId = getPublicListId(event.over);
      const toIndex = targetIndex.value >= 0 ? targetIndex.value : 0;

      onDrop({
        item: data.item,
        fromListId: data.listId,
        fromIndex: data.index,
        toListId,
        toIndex,
      });

      // Scroll target list to show dropped item
      const scrollCb = afterDropScrollRef.current.get(toListId);
      if (scrollCb) {
        scrollCb({
          fromListId: data.listId,
          fromIndex: data.index,
          toListId,
          toIndex,
        });
      }
    }

    // Reset state
    sourceItemId.value = null;
    sourceListId.value = null;
    sourceIndex.value = -1;
    targetListId.value = null;
    targetIndex.value = -1;
    draggedItemHeight.value = 0;
    dragTranslation.value = { x: 0, y: 0 };
    pointerPosition.value = { x: 0, y: 0 };
    activeDataRef.current = null;
  }, [onDrop, sourceListId, sourceIndex, targetListId, targetIndex, draggedItemHeight, dragTranslation, pointerPosition]);

  const contextValue = useMemo(() => ({
    sourceItemId,
    sourceListId,
    sourceIndex,
    targetListId,
    targetIndex,
    draggedItemHeight,
    dragTranslation,
    pointerPosition,
    registerList,
    unregisterList,
    getListInfo,
    listLayouts: listLayoutsRef,
    updateListLayout,
    listScrollOffsets: listScrollOffsetsRef,
    registerListScrollOffset,
    unregisterListScrollOffset,
    registerAfterDropScroll,
    unregisterAfterDropScroll,
    recalculateTarget,
  }), [sourceItemId, sourceListId, sourceIndex, targetListId, targetIndex, draggedItemHeight, dragTranslation, pointerPosition, registerList, unregisterList, getListInfo, updateListLayout, registerListScrollOffset, unregisterListScrollOffset, registerAfterDropScroll, unregisterAfterDropScroll, recalculateTarget]);

  return (
    <DraggableListContext.Provider value={contextValue}>
      <DndProvider
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        dragEffect={dragEffect}
      >
        {children}
      </DndProvider>
    </DraggableListContext.Provider>
  );
}

// ============ DraggableListItem ============

interface DraggableListItemProps<T> {
  item: T;
  itemId: string;
  index: number;
  itemCount: number;
  itemHeight: number;
  prefixSum: number[];
  totalSize: number;
  direction: 'horizontal' | 'vertical';
  listId: string;
  handle?: boolean;
  activeDragStyle?: ViewStyle;
  dragEffect?: import('../animations/dragEffects').DragEffectConfig;
  renderItem: (info: DraggableListItemInfo<T>) => React.ReactNode;
  longPressDuration?: number;
  onItemPress?: (item: T, index: number) => void;
}

function DraggableListItemInner<T>({
  item,
  itemId,
  index,
  itemCount,
  itemHeight,
  prefixSum,
  totalSize,
  direction,
  listId,
  handle,
  activeDragStyle,
  dragEffect,
  renderItem,
  longPressDuration,
  onItemPress,
}: DraggableListItemProps<T>) {
  const context = useDraggableListContext<T>();
  const isHorizontal = direction === 'horizontal';
  const [isDragging, setIsDragging] = useState(false);
  const internalItemId = useMemo(() => getInternalListItemId(listId, itemId), [listId, itemId]);
  const animatedOffset = useSharedValue(prefixSum[index] ?? 0);

  // Track when this item is being dragged via context
  useAnimatedReaction(
    () => context.sourceItemId.value === internalItemId,
    (isSource, prev) => {
      if (isSource !== prev) {
        runOnJS(setIsDragging)(isSource);
      }
    },
    [internalItemId]
  );

  useEffect(() => {
    animatedOffset.value = prefixSum[index] ?? 0;
  }, [animatedOffset, index, prefixSum]);

  useAnimatedReaction(
    () => {
      const srcListId = context.sourceListId.value;
      const srcIndex = context.sourceIndex.value;
      const srcItemId = context.sourceItemId.value;
      const tgtListId = context.targetListId.value;
      const tgtIndex = context.targetIndex.value;
      const dragSize = context.draggedItemHeight.value;

      const isSourceItem = srcItemId === internalItemId;
      const isSourceList = srcListId === listId;
      const isTargetList = tgtListId === listId;

      let nextOffset = prefixSum[index] ?? 0;

      if (tgtIndex >= 0) {
        if (isSourceList && isTargetList) {
          if (!isSourceItem && tgtIndex > srcIndex && index > srcIndex && index <= tgtIndex) {
            nextOffset = Math.max(0, (prefixSum[index] ?? 0) - dragSize);
          } else if (!isSourceItem && tgtIndex < srcIndex && index >= tgtIndex && index < srcIndex) {
            nextOffset = (prefixSum[index] ?? 0) + dragSize;
          }
        } else if (isSourceList) {
          if (!isSourceItem && index > srcIndex) {
            nextOffset = Math.max(0, (prefixSum[index] ?? 0) - dragSize);
          }
        } else if (isTargetList && index >= tgtIndex) {
          nextOffset = (prefixSum[index] ?? 0) + dragSize;
        }
      }

      return {
        isSourceItem,
        nextOffset,
      };
    },
    (state, prevState) => {
      if (
        prevState === null ||
        state.nextOffset !== prevState.nextOffset ||
        state.isSourceItem !== prevState.isSourceItem
      ) {
        animatedOffset.value = state.isSourceItem
          ? state.nextOffset
          : withTiming(state.nextOffset, TIMING_CONFIG);
      }
    },
    [internalItemId, listId, index, itemCount, prefixSum, totalSize]
  );

  const dragStyle = activeDragStyle ?? { opacity: 0 };

  const positionedStyle = useAnimatedStyle(() => {
    const isSourceItem = context.sourceItemId.value === internalItemId;

    return {
      position: 'absolute' as const,
      [isHorizontal ? 'left' : 'top']: animatedOffset.value,
      [isHorizontal ? 'top' : 'left']: 0,
      opacity: isSourceItem ? (dragStyle.opacity ?? 0) : 1,
      zIndex: isSourceItem ? 0 : 1,
    };
  }, [context.sourceItemId]);

  const sizeStyle = isHorizontal
    ? { width: itemHeight, height: '100%' as const }
    : { height: itemHeight, width: '100%' as const };

  const handlePress = useCallback(() => {
    onItemPress?.(item, index);
  }, [onItemPress, item, index]);

  return (
    <Animated.View style={[sizeStyle, positionedStyle] as any}>
      <Draggable
        id={internalItemId}
        data={{ item, listId, index }}
        handle={handle}
        _skipDragStyle
        dragEffect={dragEffect}
        longPressDuration={longPressDuration}
        onPress={onItemPress ? handlePress : undefined}
      >
        <View style={sizeStyle}>
          <DraggableListItemRenderer
            item={item}
            index={index}
            isDragging={isDragging}
            renderer={renderItem}
          />
        </View>
      </Draggable>
    </Animated.View>
  );
}

const DraggableListItem = React.memo(DraggableListItemInner) as typeof DraggableListItemInner;

// ============ InsertionIndicator ============

interface InsertionIndicatorProps {
  listId: string;
  prefixSum: number[];
  direction: 'horizontal' | 'vertical';
  renderIndicator: (index: number) => React.ReactNode;
}

function InsertionIndicator({ listId, prefixSum, direction, renderIndicator }: InsertionIndicatorProps) {
  const context = useDraggableListContext();
  const isHorizontal = direction === 'horizontal';
  const [state, setState] = useState<{ idx: number; sameList: boolean } | null>(null);

  useAnimatedReaction(
    () => {
      const isTarget = context.targetListId.value === listId;
      const isDragging = context.sourceItemId.value !== null;
      if (!isTarget || !isDragging) return { idx: -1, sameList: false };
      return {
        idx: context.targetIndex.value,
        sameList: context.sourceListId.value === listId,
      };
    },
    (cur, prev) => {
      if (cur.idx !== prev?.idx || cur.sameList !== prev?.sameList) {
        runOnJS(setState)(cur.idx >= 0 ? cur : null);
      }
    },
    [listId]
  );

  if (state === null) return null;

  // prefixSum has n+1 entries for n items:
  //   prefixSum[0] = 0 (top of first item)
  //   prefixSum[i] = top of item i
  //   prefixSum[n] = total height (bottom of last item)
  //
  // Same-list reorder: targetIndex is 0..n-1 (final position). The source
  // ghost still occupies its slot, so the indicator goes at idx+1.
  //
  // Cross-list drop: targetIndex is 0..n (insertion point). The indicator
  // goes directly at idx — 0 = above first item, n = after last item.
  const maxIdx = prefixSum.length - 1;
  const posIdx = state.sameList
    ? Math.min(state.idx + 1, maxIdx)
    : Math.min(state.idx, maxIdx);
  const position = prefixSum[posIdx] ?? 0;

  return (
    <Animated.View
      style={{
        position: 'absolute',
        [isHorizontal ? 'left' : 'top']: position,
        [isHorizontal ? 'top' : 'left']: 0,
        [isHorizontal ? 'height' : 'width']: '100%',
        zIndex: 10,
      }}
      pointerEvents="none"
    >
      {renderIndicator(state.idx)}
    </Animated.View>
  );
}

// ============ DraggableList ============

export function DraggableList<T>({
  id,
  data,
  renderItem,
  keyExtractor,
  itemSize,
  direction = 'vertical',
  style,
  containerSize,
  autoScrollThreshold = AUTO_SCROLL_THRESHOLD,
  handle,
  activeContainerStyle,
  activeDragStyle,
  renderInsertIndicator,
  dragEffect: dragEffectProp,
  longPressDuration,
  onItemPress,
}: DraggableListProps<T>) {
  const resolvedDragEffect: DragEffectConfig | undefined = dragEffectProp
    ? resolveDragEffect(dragEffectProp)
    : undefined;
  const groupContext = useDraggableListContext<T>();
  const dndContext = useDndContext();
  const containerRef = useRef<View>(null);

  const isHorizontal = direction === 'horizontal';
  const isScrollMode = containerSize !== undefined;

  // Resolve heights for this list
  const itemIds = useMemo(() => data.map(keyExtractor), [data, keyExtractor]);
  const heights = useMemo(() => resolveItemSizes(itemSize, data.length), [itemSize, data.length]);
  const prefixSum = useMemo(() => buildPrefixSum(heights), [heights]);
  const totalSize = prefixSum[data.length] ?? 0;
  const maxScroll = isScrollMode ? Math.max(0, totalSize - containerSize) : 0;

  // Register list with context
  useEffect(() => {
    groupContext.registerList(id, itemIds, itemSize, direction);
    return () => groupContext.unregisterList(id);
  }, [groupContext, id, itemIds, itemSize, direction]);

  // ---- Scroll mode (shared useAutoScroll hook) ----
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const containerStart = useSharedValue(0);
  const scrollOffset = useSharedValue(0);

  // Touch position: the absolute pointer position on the relevant axis (from DndContext)
  const touchPosition = isHorizontal ? dndContext.absoluteX : dndContext.absoluteY;

  // Compute dragged item's content-coordinate position for auto-scroll boundary gating.
  // Auto-scroll only triggers when the item has actually crossed the viewport boundary.
  const dragContentPosition = useDerivedValue(() => {
    if (!dndContext.isDragging.value) return 0;
    const touchRelative = touchPosition.value - containerStart.value;
    const halfItem = groupContext.draggedItemHeight.value / 2;
    return touchRelative + scrollOffset.value - halfItem;
  });

  // Use the global isDragging from DndContext — set immediately on the UI thread
  // by the gesture worklet. Unlike isDragActiveForList (derived from sourceListId
  // which is set via async JS callback), this is true on the very first gesture frame.
  // Auto-scroll edge detection only triggers when touch is near THIS list's edges,
  // so activating on all lists is safe.
  const { scrollHandler } = useAutoScroll({
    scrollRef,
    containerStart,
    containerSize,
    totalSize,
    direction,
    autoScrollThreshold,
    touchPosition,
    isDragActive: dndContext.isDragging,
    dragContentPosition,
    dragItemSize: groupContext.draggedItemHeight,
    externalScrollOffset: scrollOffset,
  });

  // Register scroll offset with group context (for calculateTargetIndex)
  useEffect(() => {
    groupContext.registerListScrollOffset(id, scrollOffset);
    return () => groupContext.unregisterListScrollOffset(id);
  }, [groupContext, id, scrollOffset]);

  // Recalculate target index when auto-scroll changes scroll offset during drag.
  // Without this, the insertion point only updates on finger movement.
  useAnimatedReaction(
    () => scrollOffset.value,
    (scroll, prevScroll) => {
      if (prevScroll !== null && scroll !== prevScroll && dndContext.isDragging.value) {
        runOnJS(groupContext.recalculateTarget)();
      }
    }
  );

  // For same-list drags, keep the preview index owned by the source list on the UI
  // thread. This avoids JS callback timing races during auto-scroll where the drag
  // overlay position and list preview can briefly disagree.
  useAnimatedReaction(
    () => ({
      isDragging: dndContext.isDragging.value,
      sourceListId: groupContext.sourceListId.value,
      sourceIndex: groupContext.sourceIndex.value,
      targetListId: groupContext.targetListId.value,
      touch: touchPosition.value,
      scroll: scrollOffset.value,
    }),
    (state) => {
      if (!state.isDragging || state.sourceListId !== id) {
        return;
      }

      if (state.targetListId !== null && state.targetListId !== id) {
        return;
      }

      if (data.length <= 0) {
        groupContext.targetListId.value = id;
        groupContext.targetIndex.value = -1;
        return;
      }

      const relativePos = (state.touch - containerStart.value) + state.scroll;
      const insertionIndex = getInsertionIndexAtPosition(prefixSum, relativePos, data.length);
      const adjustedIndex =
        insertionIndex > state.sourceIndex
          ? insertionIndex - 1
          : insertionIndex;
      const nextIndex = clamp(adjustedIndex, 0, data.length - 1);

      if (groupContext.targetListId.value !== id) {
        groupContext.targetListId.value = id;
      }
      if (groupContext.targetIndex.value !== nextIndex) {
        groupContext.targetIndex.value = nextIndex;
      }
    },
    [id, data.length, prefixSum]
  );

  // Register after-drop scroll: ensure the dropped item is visible
  useEffect(() => {
    if (!isScrollMode) return;
    const cSize = containerSize!;
    const horiz = isHorizontal;

    groupContext.registerAfterDropScroll(id, ({ toIndex }: AfterDropScrollRequest) => {
      // Delay until after React re-renders with updated data
      requestAnimationFrame(() => {
        const info = groupContext.getListInfo(id);
        if (!info || info.itemCount === 0) return;

        const finalIndex = clamp(toIndex, 0, info.itemCount - 1);

        const itemPixelStart = info.prefixSum[finalIndex] ?? 0;
        const itemPixelEnd = itemPixelStart + (info.heights[finalIndex] ?? 0);
        const mScroll = Math.max(0, (info.prefixSum[info.itemCount] ?? 0) - cSize);

        runOnUI(() => {
          'worklet';
          const viewportEnd = scrollOffset.value + cSize;
          if (itemPixelEnd > viewportEnd) {
            const target = Math.min(itemPixelEnd - cSize, mScroll);
            scrollTo(scrollRef as any, horiz ? target : 0, horiz ? 0 : target, false);
          } else if (itemPixelStart < scrollOffset.value) {
            scrollTo(scrollRef as any, horiz ? itemPixelStart : 0, horiz ? 0 : itemPixelStart, false);
          }
        })();
      });
    });

    return () => groupContext.unregisterAfterDropScroll(id);
  }, [groupContext, id, isScrollMode, containerSize, isHorizontal, scrollOffset, scrollRef]);

  // Re-measure containerStart when a drag activates for this list.
  // The initial measurement from onLayout becomes stale when the page scrolls.
  const remeasureContainer = useCallback(() => {
    containerRef.current?.measureInWindow((x, y, width, height) => {
      groupContext.updateListLayout(id, { x, y, width, height });
      containerStart.value = isHorizontal ? x : y;
    });
  }, [groupContext, id, isHorizontal, containerStart]);

  useAnimatedReaction(
    () => dndContext.isDragging.value,
    (active, prevActive) => {
      if (active && !prevActive) {
        runOnJS(remeasureContainer)();
      }
    }
  );

  // Measure layout
  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    remeasureContainer();
  }, [remeasureContainer]);

  // Memoize droppable data to prevent unnecessary re-registration
  // (which could cause a brief gap where collision detection misses the droppable)
  const droppableData = useMemo(() => ({ listId: id }), [id]);

  const contentSizeStyle = useAnimatedStyle(() => {
    const srcListId = groupContext.sourceListId.value;
    const tgtListId = groupContext.targetListId.value;
    const dragSize = groupContext.draggedItemHeight.value;

    let contentMainSize = totalSize;
    if (srcListId === id && tgtListId && tgtListId !== id) {
      contentMainSize = Math.max(0, totalSize - dragSize);
    } else if (tgtListId === id && srcListId && srcListId !== id) {
      contentMainSize = totalSize + dragSize;
    }

    return isHorizontal
      ? { width: contentMainSize, height: '100%' as const }
      : { height: contentMainSize, width: '100%' as const };
  }, [groupContext.sourceListId, groupContext.targetListId, groupContext.draggedItemHeight, id, totalSize, isHorizontal]);

  const indicator = renderInsertIndicator ? (
    <InsertionIndicator
      listId={id}
      prefixSum={prefixSum}
      direction={direction}
      renderIndicator={renderInsertIndicator}
    />
  ) : null;

  const items = data.map((item, index) => (
    <DraggableListItem
      key={keyExtractor(item)}
      item={item}
      itemId={keyExtractor(item)}
      index={index}
      itemCount={data.length}
      itemHeight={heights[index]}
      prefixSum={prefixSum}
      totalSize={totalSize}
      direction={direction}
      listId={id}
      handle={handle}
      activeDragStyle={activeDragStyle}
      dragEffect={resolvedDragEffect}
      renderItem={renderItem}
      longPressDuration={longPressDuration}
      onItemPress={onItemPress}
    />
  ));

  if (isScrollMode) {
    const sizeStyle = isHorizontal
      ? { width: containerSize }
      : { height: containerSize };

    return (
      <Droppable id={getInternalListDroppableId(id)} data={droppableData} activeStyle={activeContainerStyle}>
        <View
          ref={containerRef}
          style={[styles.scrollContainer, sizeStyle, style]}
          onLayout={handleLayout}
        >
          <Animated.ScrollView
            ref={scrollRef}
            horizontal={isHorizontal}
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
            onScroll={scrollHandler}
            scrollEventThrottle={16}
            bounces={false}
            overScrollMode="never"
            nestedScrollEnabled
          >
            <Animated.View
              style={[styles.absoluteContent, contentSizeStyle] as any}
            >
              {items}
              {indicator}
            </Animated.View>
          </Animated.ScrollView>
        </View>
      </Droppable>
    );
  }

  const containerStyle = [styles.listContainer, style];

  return (
    <Droppable id={getInternalListDroppableId(id)} data={droppableData} activeStyle={activeContainerStyle}>
      <View
        ref={containerRef}
        style={containerStyle}
        onLayout={handleLayout}
      >
        <Animated.View
          style={[styles.absoluteContent, contentSizeStyle] as any}
        >
          {items}
          {indicator}
        </Animated.View>
      </View>
    </Droppable>
  );
}

// ============ Styles ============

const styles = StyleSheet.create({
  listContainer: {
    minHeight: 56,
  },
  scrollContainer: {
    overflow: 'hidden',
  },
  absoluteContent: {
    position: 'relative',
  },
});
