import { useEffect } from 'react';
import {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { SPRING_CONFIGS } from './springConfigs';

/**
 * Returns an animatedStyle that springs opacity and translateY from hidden to visible on mount.
 * Use with Reanimated.View: <Animated.View style={[yourStyle, animatedStyle]} />
 */
export function useEntranceAnimation() {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withSpring(1, SPRING_CONFIGS.entrance);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 30 }],
  }));

  return { animatedStyle };
}
