import React, { useEffect, useRef } from 'react';
import { TouchableOpacity, StyleSheet, View, Animated, Text } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useTheme } from '@/utils/ThemeContext';
import { getRunStore, subscribeRunStore } from '../store/useRunStore';

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
  const [runState, setRunState] = React.useState(getRunStore());

  React.useEffect(() => {
    return subscribeRunStore(() => setRunState({ ...getRunStore() }));
  }, []);

  const activeRoute = state.routes[state.index];
  const isRunTabActive = activeRoute.name === 'Run';
  const showRunBanner = runState.isActive && !isRunTabActive;

  // Hide tab bar when any tab's focused route is a sub-screen (not the root)
  const activeDescriptor = descriptors[activeRoute.key];
  const tabBarStyle = activeDescriptor?.options?.tabBarStyle as any;
  const isHidden = tabBarStyle?.display === 'none';

  // Only hide navbar when Profile tab is ACTIVE and navigated into a sub-screen
  const isProfileTabActive = activeRoute.name === 'Profile';
  const profileRoute = state.routes.find(r => r.name === 'Profile');
  const profileState = profileRoute?.state;
  const activeProfileScreenName = profileState?.routes?.[profileState.index ?? 0]?.name;
  const isDeepProfile = activeProfileScreenName && activeProfileScreenName !== 'ProfileMain';
  const shouldHide = isHidden || (isProfileTabActive && isDeepProfile);

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

  // Defined before early return so it's available in the run banner
  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec < 10 ? '0' : ''}${sec}`;
  };

  if (shouldHide) {
    // Even when tab bar is hidden (sub-screens), still show run banner if active
    if (!showRunBanner) return null;
    return (
      <View style={{ position: 'absolute', bottom: insets.bottom + 16, left: 0, right: 0, alignItems: 'center' }}>
        <TouchableOpacity
          onPress={() => navigation.navigate('Run' as never)}
          activeOpacity={0.85}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: runState.isPaused ? '#FF9F0A' : 'rgba(10,12,16,0.95)', borderRadius: 20, borderWidth: 1, borderColor: runState.isPaused ? 'rgba(0,0,0,0.12)' : T.green + '50', paddingHorizontal: 14, paddingVertical: 7 }}
        >
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: runState.isPaused ? '#000' : T.green }} />
          <Text style={{ color: runState.isPaused ? '#000' : T.green, fontSize: 11, fontWeight: '900' }}>{runState.isPaused ? 'PAUSED' : 'LIVE RUN'}</Text>
          <Text style={{ color: runState.isPaused ? 'rgba(0,0,0,0.75)' : '#FFF', fontSize: 12, fontWeight: '700' }}>{formatTime(runState.elapsed)}</Text>
          <Text style={{ color: runState.isPaused ? 'rgba(0,0,0,0.55)' : T.text, fontSize: 11 }}>· {runState.distVal} {runState.unit}</Text>
          <Ionicons name="chevron-forward" size={12} color={runState.isPaused ? 'rgba(0,0,0,0.5)' : T.text} style={{ marginLeft: 2 }} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{
      position: 'absolute',
      bottom: insets.bottom + 16,
      left: 0,
      right: 0,
      alignItems: 'center',
      gap: 6,
    }}>

      {/* Run banner — sits above the pill, only when running on another tab */}
      {showRunBanner && (
        <TouchableOpacity
          onPress={() => navigation.navigate('Run' as never)}
          activeOpacity={0.85}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 7,
            backgroundColor: runState.isPaused ? '#FF9F0A' : 'rgba(10,12,16,0.95)',
            borderRadius: 20,
            borderWidth: 1,
            borderColor: runState.isPaused ? 'rgba(0,0,0,0.12)' : T.green + '50',
            paddingHorizontal: 14,
            paddingVertical: 7,
          }}
        >
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: runState.isPaused ? '#000' : T.green }} />
          <Text style={{ color: runState.isPaused ? '#000' : T.green, fontSize: 11, fontWeight: '900', letterSpacing: 0.3 }}>
            {runState.isPaused ? 'PAUSED' : 'LIVE RUN'}
          </Text>
          <Text style={{ color: runState.isPaused ? 'rgba(0,0,0,0.75)' : '#FFF', fontSize: 12, fontWeight: '700' }}>
            {formatTime(runState.elapsed)}
          </Text>
          <Text style={{ color: runState.isPaused ? 'rgba(0,0,0,0.55)' : T.text, fontSize: 11 }}>
            · {runState.distVal} {runState.unit}
          </Text>
          <Ionicons name="chevron-forward" size={12} color={runState.isPaused ? 'rgba(0,0,0,0.5)' : T.text} style={{ marginLeft: 2 }} />
        </TouchableOpacity>
      )}

      {/* Main tab pill */}
      <Animated.View
        style={[
          styles.container,
          {
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
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
