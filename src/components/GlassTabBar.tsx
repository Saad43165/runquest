import React, { useEffect, useRef } from "react";
import { TouchableOpacity, StyleSheet, View, Animated, Text } from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useTheme } from "@/utils/ThemeContext";
import { getRunStore, subscribeRunStore } from "../store/useRunStore";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

const TAB_ITEMS: { route: string; icon: IoniconName; iconOutline: IoniconName; label: string }[] = [
  { route: "Run",         icon: "fitness",  iconOutline: "fitness-outline",  label: "Run" },
  { route: "Territories", icon: "map",      iconOutline: "map-outline",      label: "Kingdom" },
  { route: "Settings",    icon: "settings", iconOutline: "settings-outline", label: "Settings" },
  { route: "Profile",     icon: "person",   iconOutline: "person-outline",   label: "Profile" },
];

function TabItem({ item, isActive, onPress }: { item: typeof TAB_ITEMS[0]; isActive: boolean; onPress: () => void }) {
  const { T } = useTheme();
  const accentAnim = useRef(new Animated.Value(isActive ? 1 : 0)).current;
  const bgAnim = useRef(new Animated.Value(isActive ? 1 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(accentAnim, { toValue: isActive ? 1 : 0, useNativeDriver: false, tension: 180, friction: 14 }),
      Animated.spring(bgAnim, { toValue: isActive ? 1 : 0, useNativeDriver: false, tension: 180, friction: 14 }),
    ]).start();
  }, [isActive]);

  return (
    <TouchableOpacity style={styles.tab} activeOpacity={0.75} onPress={onPress}>
      {/* Left accent bar */}
      <Animated.View style={[styles.accentBar, {
        backgroundColor: T.green,
        height: accentAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "60%"] }),
        opacity: accentAnim,
      }]} />
      {/* Background fill */}
      <Animated.View style={[StyleSheet.absoluteFill, {
        backgroundColor: T.green,
        opacity: bgAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.08] }),
      }]} />
      <View style={styles.tabContent}>
        <Ionicons name={isActive ? item.icon : item.iconOutline} size={20} color={isActive ? T.green : T.text} />
        <Text style={{ color: isActive ? T.green : T.text, fontSize: 11, fontWeight: isActive ? "800" : "500", marginTop: 2 }}>
          {item.label}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export function GlassTabBar({ state, navigation, descriptors }: BottomTabBarProps) {
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
  const profileRoute = state.routes.find(r => r.name === "Profile");
  const profileDepth = profileRoute?.state ? (profileRoute.state.index ?? 0) : 0;

  const isRunTabActive = activeRoute.name === "Run";
  const showRunBanner = runState.isActive && !isRunTabActive;
  const formatTime = (s: number) => { const m = Math.floor(s / 60); const sec = s % 60; return `${m}:${sec < 10 ? "0" : ""}${sec}`; };

  const mountAnim = useRef(new Animated.Value(80)).current;
  const mountOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(mountAnim, { toValue: 0, useNativeDriver: true, tension: 55, friction: 10 }),
      Animated.timing(mountOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, []);

    if (isHidden || (isProfileTabActive && profileDepth > 0)) {
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
  const totalHeight = 62 + insets.bottom;

  return (
    <View style={{ position: "absolute", bottom: 0, left: 0, right: 0 }}>
      {showRunBanner && (
        <View style={{ alignItems: "center", paddingBottom: 6 }}>
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
      )}
      <Animated.View style={[styles.container, {
        height: totalHeight,
        transform: [{ translateY: mountAnim }],
        opacity: mountOpacity,
        borderTopColor: T.border,
      }]}>
        <BlurView tint={blurTint} intensity={95} style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, {
          backgroundColor: themeName === "light" ? "rgba(255,255,255,0.85)" : "rgba(8,8,10,0.85)",
        }]} />
        <View style={[styles.tabRow, { paddingBottom: insets.bottom }]}>
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

const styles = StyleSheet.create({
  container: {
    borderTopWidth: StyleSheet.hairlineWidth,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -2 },
    elevation: 14,
  },
  tabRow: { flexDirection: "row", height: 62 },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" },
  accentBar: {
    position: "absolute",
    top: "20%",
    left: 0,
    width: 3,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  tabContent: { alignItems: "center", gap: 2, paddingLeft: 6 },
});
