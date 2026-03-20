import type { WithSpringConfig } from 'react-native-reanimated';

export interface DragEffectConfig {
  scale: number;
  spring: WithSpringConfig;
}

export type DragEffect = 'pickup' | 'scaleUp' | 'scaleDown' | 'bounce';

export const dragEffects: Record<DragEffect, DragEffectConfig> = {
  pickup: {
    scale: 1.03,
    spring: { damping: 20, stiffness: 300, mass: 0.5 },
  },
  scaleUp: {
    scale: 1.08,
    spring: { damping: 15, stiffness: 200, mass: 0.8 },
  },
  scaleDown: {
    scale: 0.95,
    spring: { damping: 20, stiffness: 300, mass: 0.5 },
  },
  bounce: {
    scale: 1.05,
    spring: { damping: 8, stiffness: 200, mass: 0.6 },
  },
};

/** Resolve a string preset or custom config */
export function resolveDragEffect(effect: DragEffect | DragEffectConfig): DragEffectConfig {
  return typeof effect === 'string' ? dragEffects[effect] : effect;
}
