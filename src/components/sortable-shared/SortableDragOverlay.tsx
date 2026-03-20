import React from 'react';
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { clamp } from '../../utils/sortable';
import { SortableItemRenderer } from './SortableItemRenderer';

interface SortableDragOverlayProps<T> {
  item: T | null;
  originalIndex: number;
  itemHeight: number;
  totalSize: number;
  direction: 'horizontal' | 'vertical';
  /** For fixed mode: overlay is positioned via left/top from container top-left */
  mode: 'fixed' | 'scroll';
  /** For scroll mode: scroll offset */
  scrollOffset?: SharedValue<number>;
  /** For scroll mode: start scroll offset at drag start */
  startScrollOffset?: SharedValue<number>;
  /** Pixel position where the item started (content coordinates) */
  startPixelPosition: SharedValue<number>;
  /** Gesture translation on the main axis */
  gestureTranslation: SharedValue<number>;
  /** Scale */
  animatedScale: SharedValue<number>;
  /** Whether the overlay should be visible */
  isActive: SharedValue<boolean>;
  renderItem: (info: { item: T; index: number; isDragging: boolean }) => React.ReactNode;
  /** Portal mode: X offset to convert container-relative → portal-relative */
  portalOffsetX?: SharedValue<number>;
  /** Portal mode: Y offset to convert container-relative → portal-relative */
  portalOffsetY?: SharedValue<number>;
  /** Explicit cross-axis size (SharedValue, used in portal mode instead of '100%') */
  crossAxisSize?: SharedValue<number>;
}

export function SortableDragOverlay<T>({
  item,
  originalIndex,
  itemHeight,
  totalSize,
  direction,
  mode,
  scrollOffset,
  startScrollOffset,
  startPixelPosition,
  gestureTranslation,
  animatedScale,
  isActive,
  renderItem,
  portalOffsetX,
  portalOffsetY,
  crossAxisSize,
}: SortableDragOverlayProps<T>) {
  const isHorizontal = direction === 'horizontal';

  const animatedStyle = useAnimatedStyle(() => {
    if (!isActive.value || item === null) {
      return {
        opacity: 0,
        position: 'absolute' as const,
        left: 0,
        top: 0,
        zIndex: -1,
      };
    }

    const scale = animatedScale.value;
    const oX = portalOffsetX ? portalOffsetX.value : 0;
    const oY = portalOffsetY ? portalOffsetY.value : 0;

    let mainAxisPos: number;

    if (mode === 'scroll') {
      // Scroll mode: convert content position to viewport position
      const scrollChange = (scrollOffset?.value ?? 0) - (startScrollOffset?.value ?? 0);
      const contentPos = clamp(
        startPixelPosition.value + gestureTranslation.value + scrollChange,
        0,
        totalSize - itemHeight
      );
      mainAxisPos = contentPos - (scrollOffset?.value ?? 0);
    } else {
      // Fixed mode: position is just the clamped pixel position
      mainAxisPos = clamp(
        startPixelPosition.value + gestureTranslation.value,
        0,
        totalSize - itemHeight
      );
    }

    // Cross-axis size: use measured container size when available (portal mode),
    // otherwise the animated style doesn't set it and the static sizeStyle's '100%' applies
    const crossDim = crossAxisSize ? crossAxisSize.value : 0;
    const crossAxisProps = crossDim > 0
      ? (isHorizontal ? { height: crossDim } : { width: crossDim })
      : {};

    return {
      opacity: 1,
      position: 'absolute' as const,
      left: (isHorizontal ? mainAxisPos : 0) + oX,
      top: (isHorizontal ? 0 : mainAxisPos) + oY,
      zIndex: 99999,
      transform: [{ scale }],
      shadowColor: '#000',
      shadowOpacity: 0.35,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 12 },
      elevation: 24,
      ...crossAxisProps,
    };
  });

  const sizeStyle = isHorizontal
    ? { width: itemHeight, height: '100%' as const }
    : { height: itemHeight, width: '100%' as const };

  return (
    <Animated.View style={[sizeStyle, animatedStyle] as any} pointerEvents="none">
      {item !== null && (
        <SortableItemRenderer
          item={item}
          index={originalIndex}
          isDragging={true}
          renderer={renderItem}
        />
      )}
    </Animated.View>
  );
}
