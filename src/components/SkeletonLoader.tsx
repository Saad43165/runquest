import React, { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '@/utils/ThemeContext';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({ width = '100%', height = 16, borderRadius = 8, style }: SkeletonProps) {
  const { T } = useTheme();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View
      style={[
        { width: width as any, height, borderRadius, backgroundColor: T.muted },
        { opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.8] }) },
        style,
      ]}
    />
  );
}

export function ProfileSkeleton() {
  return (
    <View style={{ padding: 24, gap: 16 }}>
      <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
        <Skeleton width={88} height={88} borderRadius={28} />
        <View style={{ flex: 1, gap: 8 }}>
          <Skeleton width="60%" height={20} />
          <Skeleton width="40%" height={14} />
          <Skeleton width="50%" height={14} />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {[0,1,2].map(i => <Skeleton key={i} width="30%" height={80} borderRadius={20} />)}
      </View>
      <Skeleton height={100} borderRadius={24} />
    </View>
  );
}

export function TerritorySkeleton() {
  return (
    <View style={{ padding: 20, gap: 16 }}>
      {[0,1,2].map(i => (
        <View key={i} style={{ gap: 8 }}>
          <Skeleton height={120} borderRadius={24} />
        </View>
      ))}
    </View>
  );
}
