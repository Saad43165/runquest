import React, { useEffect, useRef } from "react";
import { TouchableOpacity, StyleSheet, View, Animated, Text, Dimensions } from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useTheme } from "@/utils/ThemeContext";
import { getRunStore, subscribeRunStore } from "../store/useRunStore";

const { width } = Dimensions.get("window");
const TAB_W = (width - 32) / 4;

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

const TAB_ITEMS: { route: string; icon: IoniconName; iconOutline: IoniconName; label: string }[] = [
  { route: "Run",         icon: "fitness",  iconOutline: "fitness-outline",  label: "Run" },
  { route: "Territories", icon: "map",      iconOutline: "map-outline",      label: "Kingdom" },
  { route: "Settings",    icon: "settings", iconOutline: "settings-outline", label: "Settings" },
  { route: "Profile",     icon: "person",   iconOutline: "person-outline",   label: "Profile" },
];

function TabItem({ item, isActive, onPress }: { item: typeof TAB_ITEMS[0]; isActive: boolean; onPress: () => void }) {
  const { T } = useTheme();
  const glowAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(isActive ? 1.08 : 1)).current;
  const dotOpacity = useRef(new Animated.Value(isActive ? 1 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: isActive ? 1.08 : 1, useNativeDriver: true, tension: 200, friction: 12 }),
      Animated.timing(dotOpacity, { toValue: isActive ? 1 : 0, duration: 200, useNativeDriver: true }),
    ]).start();

    if (isActive) {
      glowAnim.setValue(1);
      glowAnim.stopAnimation();
    } else {
      glowAnim.stopAnimation();
      glowAnim.setValue(0);
    }
  }, [isActive]);

  return (
    <TouchableOpacity style={styles.tab} activeOpacity={0.7} onPress={onPress}>
      <Animated.View style={{ alignItems: "center", transform: [{ scale: scaleAnim }] }}>
        <View style={[styles.iconBox, isActive && { backgroundColor: T.green + "1A" }]}>
          <Ionicons name={isActive ? item.icon : item.iconOutline} size={22} color={isActive ? T.green : T.text} />
        </View>
        <Text style={{ color: isActive ? T.green : T.text, fontSize: 9, fontWeight: isActive ? "900" : "500", marginTop: 2 }}>
          {item.label}
        </Text>
        {/* Neon dot — no glow, just a clean indicator */}
        <Animated.View style={[styles.neonDot, {
          backgroundColor: T.green,
          opacity: dotOpacity,
        }]} />
      </Animated.View>
    </TouchableOpacity>
  );
}

export function MinimalTabBar({ state, navigation, descriptors }: BottomTabBarProps) {
  const { T, themeName } = useTheme();
  const insets = useSafeAreaInsets();
  const [runState, setRunState] = React.useState(getRunStore());

  React.useEffect(() => {
    return subscribeRunStore(() => setRunState({ ...getRunStore() }));
  }, []);

  const activeRoute = state.routes[state.index];
  const activeDescriptor = descriptors[activeRoute.key];
  const tabBarStyle = activeDescriptor?.options?.tabBarStyle as any;
  const isHidden = tabBarStyle?.display === "none";
  const isProfileTabActive = activeRoute.name === "Profile";
  const profileRoute = state.routes.find(r => r.name === 'Profile');
  const activeProfileScreenName = profileRoute?.state?.routes?.[profileRoute.state.index ?? 0]?.name;
  const isDeepProfile = activeProfileScreenName && activeProfileScreenName !== 'ProfileMain';

  const isRunTabActive = activeRoute.name === "Run";
  const showRunBanner = runState.isActive && !isRunTabActive;
  const formatTime = (s: number) => { const m = Math.floor(s / 60); const sec = s % 60; return `${m}:${sec < 10 ? "0" : ""}${sec}`; };

  const mountAnim = useRef(new Animated.Value(80)).current;
  const mountOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(mountAnim, { toValue: 0, useNativeDriver: true, tension: 60, friction: 10 }),
      Animated.timing(mountOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, []);

    if (isHidden || (isProfileTabActive && isDeepProfile)) {
    const activeSubRoute = profileRoute?.state?.routes?.[profileRoute.state.index ?? 0]?.name ?? "";
    if (!showRunBanner || activeSubRoute === "ChatBot") return null;
    return (
      <View style={{ position: "absolute", bottom: insets.bottom + 12, left: 0, right: 0, alignItems: "center" }}>
        <TouchableOpacity
          onPress={() => navigation.navigate("Run" as never)}
          activeOpacity={0.85}
          style={{ flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: runState.isPaused ? "#FF9F0A" : "rgba(10,12,16,0.95)", borderRadius: 20, borderWidth: 1, borderColor: runState.isPaused ? "rgba(0,0,0,0.12)" : T.green + "50", paddingHorizontal: 14, paddingVertical: 7 }}
        >
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: runState.isPaused ? "#000" : T.green }} />
          <Text style={{ color: runState.isPaused ? "#000" : T.green, fontSize: 11, fontWeight: "900" }}>{runState.isPaused ? "PAUSED" : "LIVE RUN"}</Text>
          <Text style={{ color: runState.isPaused ? "rgba(0,0,0,0.75)" : "#FFF", fontSize: 12, fontWeight: "700" }}>{formatTime(runState.elapsed)}</Text>
          <Text style={{ color: runState.isPaused ? "rgba(0,0,0,0.55)" : T.text, fontSize: 11 }}>· {runState.distVal} {runState.unit}</Text>
          <Ionicons name="chevron-forward" size={12} color={runState.isPaused ? "rgba(0,0,0,0.5)" : T.text} style={{ marginLeft: 2 }} />
        </TouchableOpacity>
      </View>
    );
  }

  const blurTint = themeName === "light" ? "extraLight" : "dark";
  const bgColor = themeName === "light" ? "rgba(255,255,255,0.93)" : "rgba(10,10,12,0.93)";

  return (
    <View style={{ position: "absolute", bottom: insets.bottom + 12, left: 0, right: 0, alignItems: "center", gap: 6 }}>
      {showRunBanner && (
        <TouchableOpacity
          onPress={() => navigation.navigate("Run" as never)}
          activeOpacity={0.85}
          style={{ flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: runState.isPaused ? "#FF9F0A" : "rgba(10,12,16,0.95)", borderRadius: 20, borderWidth: 1, borderColor: runState.isPaused ? "rgba(0,0,0,0.12)" : T.green + "50", paddingHorizontal: 14, paddingVertical: 7 }}
        >
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: runState.isPaused ? "#000" : T.green }} />
          <Text style={{ color: runState.isPaused ? "#000" : T.green, fontSize: 11, fontWeight: "900" }}>{runState.isPaused ? "PAUSED" : "LIVE RUN"}</Text>
          <Text style={{ color: runState.isPaused ? "rgba(0,0,0,0.75)" : "#FFF", fontSize: 12, fontWeight: "700" }}>{formatTime(runState.elapsed)}</Text>
          <Text style={{ color: runState.isPaused ? "rgba(0,0,0,0.55)" : T.text, fontSize: 11 }}>· {runState.distVal} {runState.unit}</Text>
          <Ionicons name="chevron-forward" size={12} color={runState.isPaused ? "rgba(0,0,0,0.5)" : T.text} style={{ marginLeft: 2 }} />
        </TouchableOpacity>
      )}
      <Animated.View style={[styles.wrapper, { transform: [{ translateY: mountAnim }], opacity: mountOpacity }]}>
        {/* Background pill — no glow, clean border only */}
        <View style={[styles.bgPill, { borderColor: T.border }]}>
          <BlurView tint={blurTint} intensity={90} style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: bgColor, borderRadius: 28 }]} />
          {/* Subtle top line */}
          <View style={[styles.topLine, { backgroundColor: T.border }]} />
        </View>

        {/* Tab items rendered on top — NOT clipped */}
        <View style={styles.tabRow}>
          {TAB_ITEMS.map((item, index) => (
            <TabItem
              key={item.route}
              item={item}
              isActive={state.index === index}
              onPress={() => {
                const event = navigation.emit({ type: "tabPress", target: state.routes[index]?.key, canPreventDefault: true });
                if (state.index !== index && !event.defaultPrevented) navigation.navigate(state.routes[index]?.name ?? item.route);
              }}
            />
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

const BAR_H = 72;

const styles = StyleSheet.create({
  wrapper: {
    alignSelf: "center",
    width: width - 32,
    height: BAR_H,
  },
  bgPill: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 28,
    borderWidth: 1,
    overflow: "hidden",
    elevation: 8,
  },
  topLine: { position: "absolute", top: 0, left: 20, right: 20, height: 1.5, borderRadius: 1 },
  tabRow: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    flexDirection: "row",
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  neonDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 3,
  },
});
