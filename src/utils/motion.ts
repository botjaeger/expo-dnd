import {
  withTiming,
  withSpring,
  type WithTimingConfig,
  type WithSpringConfig,
  type AnimationCallback,
} from 'react-native-reanimated';

/**
 * Whether reduced motion is enabled. Set once at module level.
 * Components can override this via the reducedMotion parameter.
 */
let _reducedMotion = false;

export function setReducedMotion(enabled: boolean): void {
  _reducedMotion = enabled;
}

export function isReducedMotion(): boolean {
  return _reducedMotion;
}

/**
 * withTiming that respects reduced motion preference.
 * When reduced motion is enabled, uses duration: 0 for instant transitions.
 */
export function withTimingRM(
  toValue: number,
  config?: WithTimingConfig,
  callback?: AnimationCallback,
) {
  'worklet';
  if (_reducedMotion) {
    return withTiming(toValue, { duration: 0 }, callback);
  }
  return withTiming(toValue, config, callback);
}

/**
 * withSpring that respects reduced motion preference.
 * When reduced motion is enabled, uses withTiming(duration: 0) instead.
 */
export function withSpringRM(
  toValue: number,
  config?: WithSpringConfig,
  callback?: AnimationCallback,
) {
  'worklet';
  if (_reducedMotion) {
    return withTiming(toValue, { duration: 0 }, callback);
  }
  return withSpring(toValue, config, callback);
}
