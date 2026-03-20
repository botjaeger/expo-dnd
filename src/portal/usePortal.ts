import { useContext } from 'react';
import { PortalContext } from './PortalContext';
import type { PortalContextValue } from './PortalContext';

export function usePortal(): PortalContextValue | null {
  return useContext(PortalContext);
}
