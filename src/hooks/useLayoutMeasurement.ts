import { useCallback, useRef } from 'react';
import type { View, LayoutChangeEvent } from 'react-native';
import {
  useSharedValue,
  useAnimatedRef,
  measure,
  runOnUI,
} from 'react-native-reanimated';
import type { LayoutRect } from '../context/types';
import { isWeb } from '../utils/platform';

/**
 * Hook for measuring element layout positions
 */
export function useLayoutMeasurement() {
  const animatedRef = useAnimatedRef<View>();
  const rect = useSharedValue<LayoutRect | null>(null);
  const webLayoutRef = useRef<LayoutRect | null>(null);

  /**
   * Measure the element position (runs on UI thread)
   */
  const measureLayout = useCallback(() => {
    'worklet';
    try {
      const measured = measure(animatedRef);
      if (measured) {
        rect.value = {
          x: measured.pageX,
          y: measured.pageY,
          width: measured.width,
          height: measured.height,
        };
      }
    } catch {
      // Measurement failed
    }
  }, [animatedRef, rect]);

  /**
   * Trigger measurement from JS thread
   */
  const triggerMeasure = useCallback(() => {
    runOnUI(measureLayout)();
  }, [measureLayout]);

  /**
   * Handle layout changes (useful for web where measure can be unreliable)
   */
  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;

      if (isWeb) {
        // On web, use getBoundingClientRect for accurate page coordinates
        const node = animatedRef.current as unknown as HTMLElement | null;
        if (node && typeof node.getBoundingClientRect === 'function') {
          const domRect = node.getBoundingClientRect();
          rect.value = {
            x: domRect.left + window.scrollX,
            y: domRect.top + window.scrollY,
            width: domRect.width,
            height: domRect.height,
          };
          webLayoutRef.current = rect.value;
        }
      } else {
        // On native, trigger measurement
        triggerMeasure();
      }
    },
    [animatedRef, rect, triggerMeasure]
  );

  return {
    ref: animatedRef,
    rect,
    measureLayout,
    triggerMeasure,
    handleLayout,
  };
}
