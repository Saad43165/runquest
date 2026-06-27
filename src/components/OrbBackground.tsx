import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';
import { useTheme } from '@/utils/ThemeContext';

const { width, height } = Dimensions.get('window');

/**
 * Animated orb background — drop inside any screen as the first child.
 * Uses StyleSheet.absoluteFill so it doesn't affect layout.
 */
export function OrbBackground() {
  const { T } = useTheme();

  const anim1 = useRef(new Animated.Value(0)).current;
  const anim2 = useRef(new Animated.Value(0)).current;
  const anim3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Slower loops = less CPU, still looks good
    const loop = (anim: Animated.Value, duration: number, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration, useNativeDriver: true }),
        ])
      ).start();

    loop(anim1, 6000, 0);
    loop(anim2, 8000, 2000);
    loop(anim3, 7000, 4000);
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Top-right — green */}
      <Animated.View
        style={[
          styles.orb,
          {
            width: width * 0.75,
            height: width * 0.75,
            borderRadius: width * 0.375,
            backgroundColor: T.green + '14',
            top: -width * 0.25,
            right: -width * 0.2,
            opacity: anim1.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }),
            transform: [{ scale: anim1.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }],
          },
        ]}
      />
      {/* Bottom-left — accent */}
      <Animated.View
        style={[
          styles.orb,
          {
            width: width * 0.65,
            height: width * 0.65,
            borderRadius: width * 0.325,
            backgroundColor: T.accent2 + '10',
            bottom: height * 0.1,
            left: -width * 0.2,
            opacity: anim2.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0.9] }),
            transform: [{ scale: anim2.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] }) }],
          },
        ]}
      />
      {/* Center — subtle gold */}
      <Animated.View
        style={[
          styles.orb,
          {
            width: width * 0.5,
            height: width * 0.5,
            borderRadius: width * 0.25,
            backgroundColor: (T.gold || '#FFD60A') + '08',
            top: height * 0.35,
            left: width * 0.25,
            opacity: anim3.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] }),
            transform: [{ scale: anim3.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.05] }) }],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  orb: {
    position: 'absolute',
  },
});
