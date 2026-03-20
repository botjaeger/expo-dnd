import { createContext } from 'react';
import type { SharedValue } from 'react-native-reanimated';
import type React from 'react';

export interface PortalContextValue {
  /** Register or update an overlay by key, or pass null to remove it */
  setOverlay: (key: string, content: React.ReactNode | null) => void;
  /** Portal outlet's page-X position (measured on UI thread) */
  outletPageX: SharedValue<number>;
  /** Portal outlet's page-Y position (measured on UI thread) */
  outletPageY: SharedValue<number>;
}

export const PortalContext = createContext<PortalContextValue | null>(null);
