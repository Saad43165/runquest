import React, { useEffect, useRef } from 'react';
import { TouchableOpacity, StyleSheet, View, Animated } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useTheme } from '@/utils/ThemeContext';

const TAB_WIDTH = 72;
const CONTAINER_PADDING = 8;

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface TabItem {
  route: string;
  icon: IoniconName;
  iconOutline: IoniconName;
  iconSize: number;
}

const TAB_ITEMS: TabItem[] = [
  { route: 'Run',         icon: 'fitness',  iconOutline: 'fitness-outline',  iconSize: 26 },
  { route: 'Territories', icon: 'map',      iconOutline: 'map-outline',      iconSize: 22 },
  { route: 'Settings',    icon: 'settings', iconOutline: 'settings-outline', iconSize: 22 },
  { route: 'Profile',     icon: 'person',   iconOutline: 'person-outline',   iconSize: 22 },
];

export function FloatingPillTabBar({ state, navigation, descriptors }: BottomTabBarProps) {
  const { T, themeName } = useTheme();
  const insets = useSafeAreaInsets();

  // Hide tab bar when any tab's focused route is a sub-screen (not the root)
  const activeRoute = state.routes[state.index];
  const activeDescriptor = descriptors[activeRoute.key];
  const tabBarStyle = activeDescriptor?.options?.tabBarStyle as any;
  const isHidden = tabBarStyle?.display === 'none';

  // Check if Profile stack is deeper than root (navigated to sub-screen)
  const profileRoute = state.routes.find(r => r.name === 'Profile');
  const profileState = profileRoute?.state;
  const profileDepth = profileState ? (profileState.index ?? 0) : 0;
  const shouldHide = isHidden || profileDepth > 0;

  // Mount slide-up animation
  const mountAnim = useRef(new Animated.Value(100)).current;
  const mountOpacity = useRef(new Animated.Value(0)).current;

  // Sliding indicator position
  const indicatorX = useRef(new Animated.Value(CONTAINER_PADDING + state.index * TAB_WIDTH)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(mountAnim, { toValue: 0, useNativeDriver: true, tension: 60, friction: 10 }),
      Animated.timing(mountOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, []);

  // Sync indicator on external tab change
  useEffect(() => {
    Animated.spring(indicatorX, {
      toValue: CONTAINER_PADDING + state.index * TAB_WIDTH,
      useNativeDriver: true,
      tension: 180,
      friction: 20,
    }).start();
  }, [state.index]);

  const barWidth = TAB_WIDTH * 4 + CONTAINER_PADDING * 2;
  const blurTint = themeName === 'light' ? 'extraLight' : 'dark';

  if (shouldHide) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          bottom: insets.bottom + 16,
          width: barWidth,
          borderColor: T.border,
          transform: [{ translateY: mountAnim }],
          opacity: mountOpacity,
          backgroundColor: themeName === 'light' ? 'rgba(255,255,255,0.92)' : 'rgba(18,18,18,0.92)',
        },
      ]}
    >
      {/* Blur background */}
      <BlurView tint={blurTint} intensity={85} style={StyleSheet.absoluteFill} />

      {/* Sliding active indicator */}
      <Animated.View
        style={[
          styles.indicator,
          { backgroundColor: T.green + '28', transform: [{ translateX: indicatorX }] },
        ]}
      />

      {/* Tab buttons */}
      <View style={styles.tabRow}>
        {TAB_ITEMS.map((item, index) => {
          const isActive = state.index === index;
          const iconName = isActive ? item.icon : item.iconOutline;
          const iconColor = isActive ? T.green : T.text;

          return (
            <TouchableOpacity
              key={item.route}
              style={styles.tabButton}
              activeOpacity={0.7}
              onPress={() => {
                Animated.spring(indicatorX, {
                  toValue: CONTAINER_PADDING + index * TAB_WIDTH,
                  useNativeDriver: true,
                  tension: 180,
                  friction: 20,
                }).start();

                const event = navigation.emit({
                  type: 'tabPress',
                  target: state.routes[index]?.key,
                  canPreventDefault: true,
                });

                if (!isActive && !event.defaultPrevented) {
                  navigation.navigate(state.routes[index]?.name ?? item.route);
                }
              }}
            >
              <Ionicons name={iconName} size={item.iconSize} color={iconColor} />
            </TouchableOpacity>
          );
        })}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    alignSelf: 'center',
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 16,
  },
  tabRow: {
    flexDirection: 'row',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButton: {
    width: TAB_WIDTH,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicator: {
    position: 'absolute',
    top: 8,
    left: 0,
    width: TAB_WIDTH,
    height: 48,
    borderRadius: 24,
  },
});
