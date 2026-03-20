import React, { useState, useCallback, useMemo } from 'react';
import { View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedRef,
  measure,
  runOnUI,
} from 'react-native-reanimated';
import { PortalContext } from './PortalContext';

export function PortalProvider({ children }: { children: React.ReactNode }) {
  const [overlays, setOverlays] = useState<Record<string, React.ReactNode>>({});
  const outletPageX = useSharedValue(0);
  const outletPageY = useSharedValue(0);
  const outletRef = useAnimatedRef<Animated.View>();

  const measureOutlet = useCallback(() => {
    runOnUI(() => {
      'worklet';
      try {
        const m = measure(outletRef);
        if (m) {
          outletPageX.value = m.pageX;
          outletPageY.value = m.pageY;
        }
      } catch { /* not mounted yet */ }
    })();
  }, [outletRef, outletPageX, outletPageY]);

  const setOverlay = useCallback((key: string, content: React.ReactNode | null) => {
    setOverlays(prev => {
      if (content === null) {
        if (!(key in prev)) return prev;
        const { [key]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [key]: content };
    });
  }, []);

  const contextValue = useMemo(() => ({
    setOverlay,
    outletPageX,
    outletPageY,
  }), [setOverlay, outletPageX, outletPageY]);

  return (
    <PortalContext.Provider value={contextValue}>
      <View style={{ flex: 1 }} collapsable={false}>
        {children}
        <Animated.View
          ref={outletRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            pointerEvents: 'none',
            zIndex: 99999,
          }}
          collapsable={false}
          onLayout={measureOutlet}
          pointerEvents="none"
        >
          {Object.entries(overlays).map(([key, content]) => (
            <React.Fragment key={key}>{content}</React.Fragment>
          ))}
        </Animated.View>
      </View>
    </PortalContext.Provider>
  );
}
