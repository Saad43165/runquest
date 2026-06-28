import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, Dimensions, Modal, Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "@/utils/ThemeContext";
import { getHistory, RunRecord } from "../services/history";
import { getSettings } from "../config/settings";
import { OrbBackground } from "../components/OrbBackground";

const { width } = Dimensions.get("window");
const CARD_W = (width - 52) / 2;

const DEFAULT_WEIGHT_KG = 70;
const RUNNING_MET = 9.8;

function calcCalories(distanceMeters: number, durationSec: number): number {
  const hours = durationSec / 3600;
  return Math.round(RUNNING_MET * DEFAULT_WEIGHT_KG * hours);
}

function calcPaceStr(distanceMeters: number, durationSec: number): string {
  if (distanceMeters < 10) return "--";
  const minPerKm = (durationSec / 60) / (distanceMeters / 1000);
  const min = Math.floor(minPerKm);
  const sec = Math.round((minPerKm - min) * 60);
  return `${min}:${sec < 10 ? "0" : ""}${sec}`;
}

function calcPaceNum(distanceMeters: number, durationSec: number): number {
  if (distanceMeters < 10) return 0;
  return (durationSec / 60) / (distanceMeters / 1000);
}

function getZone(pace: number): { zone: string; color: string; desc: string; num: number } {
  if (pace === 0 || pace > 12) return { zone: "Rest", color: "#8E8E93", desc: "Recovery", num: 0 };
  if (pace > 8)  return { zone: "Zone 1", color: "#34C759", desc: "Easy / Fat burn", num: 1 };
  if (pace > 6)  return { zone: "Zone 2", color: "#30D158", desc: "Aerobic base", num: 2 };
  if (pace > 5)  return { zone: "Zone 3", color: "#FFD60A", desc: "Tempo", num: 3 };
  if (pace > 4)  return { zone: "Zone 4", color: "#FF9F0A", desc: "High intensity", num: 4 };
  return { zone: "Zone 5", color: "#FF453A", desc: "Max effort", num: 5 };
}

// ─── Compute longest streak (consecutive days with a run) ────────────────────
function computeLongestStreak(history: RunRecord[]): number {
  if (history.length === 0) return 0;
  const days = new Set(
    history.map(r => {
      const d = new Date(r.createdAt);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    })
  );
  const sorted = Array.from(days).sort();
  let best = 1, cur = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]);
    const curr = new Date(sorted[i]);
    const diff = (curr.getTime() - prev.getTime()) / 86400000;
    if (diff === 1) { cur++; best = Math.max(best, cur); }
    else cur = 1;
  }
  return best;
}

// ─── Personal Records Card ────────────────────────────────────────────────────
function PersonalRecordsCard({ history, isMetric }: { history: RunRecord[]; isMetric: boolean }) {
  const { T } = useTheme();
  const distMult = isMetric ? 1000 : 1609.34;
  const unitLabel = isMetric ? "km" : "mi";

  const fastestPaceNum = history.reduce((best, r) => {
    const p = calcPaceNum(r.distanceMeters, r.durationSec);
    return (p > 0 && (best === 0 || p < best)) ? p : best;
  }, 0);
  const fastestPace = fastestPaceNum > 0 ? calcPaceStr(1000, fastestPaceNum * 60) : "--";

  const longestDist = history.reduce((max, r) => r.distanceMeters > max ? r.distanceMeters : max, 0);

  const mostTerritories = history.reduce((max, r) => {
    // areaSqMeters is a proxy — we don't store territory count per run, so use area
    return r.areaSqMeters > max ? r.areaSqMeters : max;
  }, 0);

  const streak = computeLongestStreak(history);

  const records = [
    { icon: "flash", color: "#BF5FFF", label: "Fastest Pace", value: fastestPace, unit: "min/km" },
    { icon: "map", color: T.green, label: "Longest Run", value: (longestDist / distMult).toFixed(2), unit: unitLabel },
    { icon: "trophy", color: T.gold, label: "Best Territory", value: mostTerritories >= 1000 ? `${(mostTerritories / 1000).toFixed(1)}k` : String(Math.round(mostTerritories)), unit: "m²" },
    { icon: "flame", color: "#FF453A", label: "Best Streak", value: String(streak), unit: "days" },
  ];

  return (
    <View style={{ marginBottom: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <View style={{ width: 3, height: 16, borderRadius: 2, backgroundColor: T.gold }} />
        <Text style={{ color: T.text, fontSize: 10, fontWeight: "800", letterSpacing: 1.5 }}>PERSONAL RECORDS</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
        {records.map((r, i) => (
          <View key={i} style={[styles.prCard, { backgroundColor: T.card, borderColor: r.color + "30", borderTopColor: r.color }]}>
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: r.color + "20", alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
              <Ionicons name={r.icon as any} size={18} color={r.color} />
            </View>
            <Text style={{ color: T.white, fontSize: 20, fontWeight: "900", letterSpacing: -0.5 }}>{r.value}</Text>
            <Text style={{ color: r.color, fontSize: 9, fontWeight: "800", marginTop: 1 }}>{r.unit}</Text>
            <Text style={{ color: T.text, fontSize: 10, fontWeight: "700", marginTop: 3 }}>{r.label}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// ─── Elevation Profile ────────────────────────────────────────────────────────
function ElevationProfile({ altitudePoints }: { altitudePoints: number[] }) {
  const { T } = useTheme();
  if (altitudePoints.length < 2) return null;

  const min = Math.min(...altitudePoints);
  const max = Math.max(...altitudePoints);
  const range = max - min || 1;
  const BAR_H = 48;
  const step = Math.max(1, Math.floor(altitudePoints.length / 40));
  const sampled = altitudePoints.filter((_, i) => i % step === 0);

  return (
    <View style={{ marginTop: 8 }}>
      <Text style={{ color: T.text, fontSize: 9, fontWeight: "800", letterSpacing: 1, marginBottom: 6 }}>ELEVATION</Text>
      <View style={{ flexDirection: "row", alignItems: "flex-end", height: BAR_H, gap: 1 }}>
        {sampled.map((alt, i) => {
          const h = Math.max(2, ((alt - min) / range) * BAR_H);
          return (
            <View
              key={i}
              style={{ flex: 1, height: h, borderRadius: 2, backgroundColor: T.accent2 + "80" }}
            />
          );
        })}
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
        <Text style={{ color: T.text, fontSize: 9 }}>{Math.round(min)}m</Text>
        <Text style={{ color: T.text, fontSize: 9 }}>{Math.round(max)}m</Text>
      </View>
    </View>
  );
}

// ─── Route Replay Modal ───────────────────────────────────────────────────────
function RouteReplayModal({ run, visible, onClose }: { run: RunRecord | null; visible: boolean; onClose: () => void }) {
  const { T } = useTheme();
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressAnim = useRef(new Animated.Value(0)).current;

  const points = run?.points ?? [];
  const total = points.length;

  useEffect(() => {
    if (!visible) {
      setPlaying(false);
      setProgress(0);
      progressAnim.setValue(0);
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
  }, [visible]);

  const togglePlay = () => {
    if (playing) {
      setPlaying(false);
      if (intervalRef.current) clearInterval(intervalRef.current);
    } else {
      if (progress >= total - 1) setProgress(0);
      setPlaying(true);
      intervalRef.current = setInterval(() => {
        setProgress(p => {
          const next = p + 1;
          if (next >= total) {
            clearInterval(intervalRef.current!);
            setPlaying(false);
            return total - 1;
          }
          return next;
        });
      }, 40);
    }
  };

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: total > 0 ? progress / (total - 1) : 0,
      duration: 40,
      useNativeDriver: false,
    }).start();
  }, [progress, total]);

  if (!run) return null;

  const PADDING = 24;
  const MAP_W = Dimensions.get("window").width - 48;
  const MAP_H = 300;
  const INNER_W = MAP_W - PADDING * 2;
  const INNER_H = MAP_H - PADDING * 2;

  // Compute bounding box
  const lats = points.map(p => p.latitude);
  const lngs = points.map(p => p.longitude);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const latRange = maxLat - minLat || 0.001;
  const lngRange = maxLng - minLng || 0.001;

  // Keep aspect ratio, center in box
  const scaleX = INNER_W / lngRange;
  const scaleY = INNER_H / latRange;
  const scale = Math.min(scaleX, scaleY) * 0.85;
  const offsetX = PADDING + (INNER_W - lngRange * scale) / 2;
  const offsetY = PADDING + (INNER_H - latRange * scale) / 2;

  const toXY = (p: { latitude: number; longitude: number }) => ({
    x: offsetX + (p.longitude - minLng) * scale,
    y: MAP_H - offsetY - (p.latitude - minLat) * scale,
  });

  const currentPoint = points[progress] ? toXY(points[progress]) : null;
  const startPoint = points[0] ? toXY(points[0]) : null;

  // Build path segments up to current progress
  const drawnPoints = points.slice(0, progress + 1);

  const distMult = 1000;
  const distKm = (run.distanceMeters / distMult).toFixed(2);
  const mins = Math.round(run.durationSec / 60);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.88)", justifyContent: "center", alignItems: "center", padding: 16 }}>
        <View style={{ backgroundColor: "#0E0E10", borderRadius: 28, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", width: "100%", overflow: "hidden" }}>

          {/* Gradient top accent */}
          <LinearGradient colors={[T.green, '#00C6FF']} style={{ height: 3 }} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />

          {/* Header */}
          <View style={{ flexDirection: "row", alignItems: "center", padding: 16, gap: 12 }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: T.green + '20', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="map-outline" size={20} color={T.green} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#FFF", fontSize: 16, fontWeight: "900" }}>Route Replay</Text>
              <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, marginTop: 2 }}>
                {new Date(run.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                {" · "}{distKm} km · {mins} min
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="close" size={16} color="#FFF" />
            </TouchableOpacity>
          </View>

          {/* Map canvas */}
          <View style={{ marginHorizontal: 16, marginBottom: 12, height: MAP_H, backgroundColor: "#0D1B2A", borderRadius: 20, overflow: "hidden", borderWidth: 1, borderColor: T.green + '30' }}>
            {/* Grid lines */}
            {[0.25, 0.5, 0.75].map(f => (
              <View key={`h${f}`} style={{ position: 'absolute', left: 0, right: 0, top: MAP_H * f, height: 1, backgroundColor: 'rgba(255,255,255,0.04)' }} />
            ))}
            {[0.25, 0.5, 0.75].map(f => (
              <View key={`v${f}`} style={{ position: 'absolute', top: 0, bottom: 0, left: MAP_W * f, width: 1, backgroundColor: 'rgba(255,255,255,0.04)' }} />
            ))}

            {/* Completed path — draw segments */}
            {drawnPoints.map((p, i) => {
              if (i === 0) return null;
              const from = toXY(drawnPoints[i - 1]);
              const to = toXY(p);
              const dx = to.x - from.x;
              const dy = to.y - from.y;
              const len = Math.sqrt(dx * dx + dy * dy);
              if (len < 0.3) return null;
              const angle = Math.atan2(dy, dx) * (180 / Math.PI);
              const midX = (from.x + to.x) / 2;
              const midY = (from.y + to.y) / 2;
              return (
                <View
                  key={i}
                  style={{
                    position: "absolute",
                    left: midX - len / 2,
                    top: midY - 1.5,
                    width: len,
                    height: 3,
                    backgroundColor: T.green,
                    borderRadius: 2,
                    transform: [{ rotate: `${angle}deg` }],
                  }}
                />
              );
            })}

            {/* Start marker */}
            {startPoint && (
              <View style={{
                position: "absolute",
                left: startPoint.x - 7, top: startPoint.y - 7,
                width: 14, height: 14, borderRadius: 7,
                backgroundColor: '#00C6FF',
                borderWidth: 2, borderColor: '#FFF',
              }} />
            )}

            {/* Current position dot with pulse ring */}
            {currentPoint && (
              <>
                <View style={{
                  position: "absolute",
                  left: currentPoint.x - 10, top: currentPoint.y - 10,
                  width: 20, height: 20, borderRadius: 10,
                  backgroundColor: T.green + '30',
                  borderWidth: 1, borderColor: T.green + '60',
                }} />
                <View style={{
                  position: "absolute",
                  left: currentPoint.x - 6, top: currentPoint.y - 6,
                  width: 12, height: 12, borderRadius: 6,
                  backgroundColor: T.green,
                  borderWidth: 2, borderColor: "#FFF",
                }} />
              </>
            )}

            {/* Progress label overlay */}
            <View style={{ position: 'absolute', top: 10, right: 12, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ color: T.green, fontSize: 11, fontWeight: '800' }}>
                {Math.round((progress / Math.max(total - 1, 1)) * 100)}%
              </Text>
            </View>
          </View>

          {/* Progress bar */}
          <View style={{ marginHorizontal: 16, marginBottom: 12, height: 5, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 3, overflow: "hidden" }}>
            <Animated.View style={{
              height: "100%",
              backgroundColor: T.green,
              borderRadius: 3,
              width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
            }} />
          </View>

          {/* Controls */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: 16, paddingBottom: 20, gap: 16 }}>
            <TouchableOpacity
              onPress={() => { setProgress(0); setPlaying(false); if (intervalRef.current) clearInterval(intervalRef.current); }}
              style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" }}
            >
              <Ionicons name="refresh" size={18} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={togglePlay}
              style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: T.green, alignItems: "center", justifyContent: "center" }}
            >
              <Ionicons name={playing ? "pause" : "play"} size={26} color="#000" />
            </TouchableOpacity>
            <View style={{ minWidth: 60, alignItems: 'center' }}>
              <Text style={{ color: "#FFF", fontSize: 13, fontWeight: '800' }}>
                {progress + 1}<Text style={{ color: 'rgba(255,255,255,0.4)', fontWeight: '500' }}>/{total}</Text>
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: '700', marginTop: 2 }}>POINTS</Text>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// Stat card
function StatCard({ icon, label, value, unit, color, index }: {
  icon: string; label: string; value: string; unit: string; color: string; index: number;
}) {
  const { T } = useTheme();
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: 1, delay: index * 60, useNativeDriver: true, tension: 65, friction: 9 }).start();
  }, []);
  return (
    <Animated.View style={{ flex: 1, opacity: anim, transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }, { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }}>
      <View style={[styles.statCard, { flex: 1, backgroundColor: T.card, borderColor: color + "30", borderTopColor: color, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 4 }]}>
        <LinearGradient colors={['rgba(255,255,255,0.03)', 'transparent']} style={StyleSheet.absoluteFill} />
        <View style={[styles.statIconWrap, { backgroundColor: color + "20" }]}>
          <Ionicons name={icon as any} size={18} color={color} />
        </View>
        <Text style={{ color: T.white, fontSize: 22, fontWeight: "900", marginTop: 8, letterSpacing: -0.5 }}>{value}</Text>
        <Text style={{ color: color, fontSize: 10, fontWeight: "800" }}>{unit}</Text>
        <Text style={{ color: T.text, fontSize: 10, fontWeight: "700", marginTop: 2 }}>{label}</Text>
      </View>
    </Animated.View>
  );
}

// Bar chart
function BarChart({ data, color, label }: { data: { day: string; val: number }[]; color: string; label: string }) {
  const { T } = useTheme();
  const maxVal = Math.max(...data.map(d => d.val), 1);
  const barAnims = useRef(data.map(() => new Animated.Value(0))).current;
  useEffect(() => {
    Animated.stagger(50, barAnims.map((a, i) =>
      Animated.spring(a, { toValue: data[i].val / maxVal, useNativeDriver: false, tension: 60, friction: 10 })
    )).start();
  }, []);
  return (
    <View style={[styles.chartCard, { backgroundColor: T.card, borderColor: T.border, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 4 }]}>
      <LinearGradient colors={['rgba(255,255,255,0.03)', 'transparent']} style={StyleSheet.absoluteFill} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <View style={{ width: 3, height: 16, borderRadius: 2, backgroundColor: color }} />
        <Text style={{ color: T.text, fontSize: 10, fontWeight: "800", letterSpacing: 1.5 }}>{label}</Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 5, height: 80 }}>
        {data.map((d, i) => (
          <View key={i} style={{ flex: 1, alignItems: "center", gap: 4 }}>
            <View style={{ width: "100%", height: 64, justifyContent: "flex-end" }}>
              <Animated.View style={{
                width: "100%", borderRadius: 5,
                backgroundColor: d.val > 0 ? color : T.border,
                height: barAnims[i].interpolate({ inputRange: [0, 1], outputRange: [2, 64] }),
              }} />
            </View>
            <Text style={{ color: T.text, fontSize: 8, fontWeight: "700" }}>{d.day}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// Run row
function RunRow({ run, index, isMetric, onReplay }: { run: RunRecord; index: number; isMetric: boolean; onReplay: (run: RunRecord) => void }) {
  const { T } = useTheme();
  const anim = useRef(new Animated.Value(0)).current;
  const distMult = isMetric ? 1000 : 1609.34;
  const unitLabel = isMetric ? "km" : "mi";
  const calories = calcCalories(run.distanceMeters, run.durationSec);
  const pace = calcPaceStr(run.distanceMeters, run.durationSec);
  const zone = getZone(calcPaceNum(run.distanceMeters, run.durationSec));
  const distKm = (run.distanceMeters / distMult).toFixed(2);
  const mins = Math.round(run.durationSec / 60);

  useEffect(() => {
    Animated.spring(anim, { toValue: 1, delay: index * 45, useNativeDriver: true, tension: 60, friction: 9 }).start();
  }, []);

  return (
    <Animated.View style={{ opacity: anim, transform: [{ translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }}>
      <View style={[styles.runRow, { backgroundColor: T.card, borderColor: T.border }]}>
        <View style={[styles.runZoneBar, { backgroundColor: zone.color }]} />
        <View style={[styles.runIconWrap, { backgroundColor: zone.color + "20" }]}>
          <Ionicons name="fitness-outline" size={16} color={zone.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: T.white, fontSize: 13, fontWeight: "800" }}>
            {new Date(run.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", weekday: "short" })}
          </Text>
          <View style={{ flexDirection: "row", gap: 6, marginTop: 3, alignItems: "center" }}>
            <Text style={{ color: T.text, fontSize: 11 }}>{distKm} {unitLabel}</Text>
            <Text style={{ color: T.border, fontSize: 11 }}>·</Text>
            <Text style={{ color: T.text, fontSize: 11 }}>{mins} min</Text>
            <Text style={{ color: T.border, fontSize: 11 }}>·</Text>
            <Text style={{ color: T.text, fontSize: 11 }}>{pace}/km</Text>
          </View>
          {run.altitudePoints && run.altitudePoints.length > 1 && (
            <ElevationProfile altitudePoints={run.altitudePoints} />
          )}
        </View>
        <View style={{ alignItems: "flex-end", gap: 4 }}>
          <Text style={{ color: "#FF453A", fontSize: 15, fontWeight: "900" }}>{calories}</Text>
          <Text style={{ color: T.text, fontSize: 8, fontWeight: "700" }}>KCAL</Text>
          <View style={{ backgroundColor: zone.color + "22", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
            <Text style={{ color: zone.color, fontSize: 8, fontWeight: "900" }}>{zone.zone}</Text>
          </View>
          {run.points && run.points.length > 1 && (
            <TouchableOpacity
              onPress={() => onReplay(run)}
              style={{ backgroundColor: T.accent2 + "20", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: T.accent2 + "40", marginTop: 2 }}
            >
              <Text style={{ color: T.accent2, fontSize: 9, fontWeight: "900" }}>▶ REPLAY</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

export default function FitnessScreen() {
  const { T } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [history, setHistory] = useState<RunRecord[]>([]);
  const [isMetric, setIsMetric] = useState(true);
  const [tab, setTab] = useState<"overview" | "history" | "zones" | "records">("overview");
  const [replayRun, setReplayRun] = useState<RunRecord | null>(null);
  const headerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    (async () => {
      const h = await getHistory();
      setHistory(h);
      const s = await getSettings();
      setIsMetric(s.units !== "imperial");
      Animated.spring(headerAnim, { toValue: 1, useNativeDriver: true, tension: 50, friction: 8 }).start();
    })();
  }, []);

  const distMult = isMetric ? 1000 : 1609.34;
  const unitLabel = isMetric ? "KM" : "MI";
  const totalCalories = history.reduce((s, r) => s + calcCalories(r.distanceMeters, r.durationSec), 0);
  const totalDistance = history.reduce((s, r) => s + r.distanceMeters, 0);
  const totalDuration = history.reduce((s, r) => s + r.durationSec, 0);
  const avgPaceNum = totalDistance > 0 ? calcPaceNum(totalDistance, totalDuration) : 0;
  const avgPace = calcPaceStr(totalDistance, totalDuration);
  const avgZone = getZone(avgPaceNum);
  const longestRun = history.reduce((max, r) => r.distanceMeters > max ? r.distanceMeters : max, 0);
  const weekRuns = history.filter(r => Date.now() - r.createdAt < 7 * 86400000).length;
  const totalRuns = history.length;
  const bestPaceNum = history.reduce((best, r) => {
    const p = calcPaceNum(r.distanceMeters, r.durationSec);
    return (p > 0 && (best === 0 || p < best)) ? p : best;
  }, 0);
  const bestPace = bestPaceNum > 0 ? calcPaceStr(1000, bestPaceNum * 60) : "--";

  const weeklyCalData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const dayStr = d.toLocaleDateString(undefined, { weekday: "short" });
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const cal = history.filter(r => r.createdAt >= dayStart && r.createdAt < dayStart + 86400000)
      .reduce((s, r) => s + calcCalories(r.distanceMeters, r.durationSec), 0);
    return { day: dayStr, val: cal };
  });

  const weeklyDistData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const dayStr = d.toLocaleDateString(undefined, { weekday: "short" });
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const dist = history.filter(r => r.createdAt >= dayStart && r.createdAt < dayStart + 86400000)
      .reduce((s, r) => s + r.distanceMeters, 0);
    return { day: dayStr, val: Math.round(dist / distMult * 10) / 10 };
  });

  const zoneCounts = [0, 0, 0, 0, 0];
  history.forEach(r => {
    const z = getZone(calcPaceNum(r.distanceMeters, r.durationSec));
    if (z.num >= 1 && z.num <= 5) zoneCounts[z.num - 1]++;
  });
  const maxZoneCount = Math.max(...zoneCounts, 1);

  const ZONE_DEFS = [
    { zone: "Zone 1", color: "#34C759", desc: "Easy / Fat burn", pace: "> 8 min/km" },
    { zone: "Zone 2", color: "#30D158", desc: "Aerobic base", pace: "6-8 min/km" },
    { zone: "Zone 3", color: "#FFD60A", desc: "Tempo", pace: "5-6 min/km" },
    { zone: "Zone 4", color: "#FF9F0A", desc: "High intensity", pace: "4-5 min/km" },
    { zone: "Zone 5", color: "#FF453A", desc: "Max effort", pace: "< 4 min/km" },
  ];

  const TABS = [
    { id: "overview" as const, label: "Overview", icon: "stats-chart-outline" },
    { id: "records" as const, label: "Records", icon: "trophy-outline" },
    { id: "history" as const, label: "History", icon: "list-outline" },
    { id: "zones" as const, label: "Zones", icon: "pulse-outline" },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: T.black }}>
      <OrbBackground />
      <LinearGradient colors={["#FF453A14", "transparent"]} style={StyleSheet.absoluteFill} pointerEvents="none" />

      <RouteReplayModal run={replayRun} visible={replayRun !== null} onClose={() => setReplayRun(null)} />

      {/* Header */}
      <Animated.View style={[styles.header, { paddingTop: insets.top + 16, opacity: headerAnim, transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { backgroundColor: T.card, borderColor: T.border }]}>
          <Ionicons name="arrow-back" size={20} color={T.white} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ color: T.white, fontSize: 26, fontWeight: "900", letterSpacing: -0.5 }}>Fitness</Text>
          <Text style={{ color: T.text, fontSize: 12, marginTop: 2 }}>{totalRuns} runs · {(totalDistance / distMult).toFixed(1)} {unitLabel} total</Text>
        </View>
        {/* Weekly runs badge — useful at a glance */}
        <View style={[styles.zoneBadge, { backgroundColor: '#00C6FF20', borderColor: '#00C6FF40' }]}>
          <Text style={{ color: '#00C6FF', fontSize: 13, fontWeight: '900' }}>{weekRuns}</Text>
          <Text style={{ color: '#00C6FF', fontSize: 9, opacity: 0.8 }}>THIS WK</Text>
        </View>
      </Animated.View>

      {/* Tab bar */}
      <View style={[styles.tabBar, { backgroundColor: T.card, borderColor: T.border }]}>
        {TABS.map(t => (
          <TouchableOpacity key={t.id} onPress={() => setTab(t.id)} style={[styles.tabBtn, tab === t.id && { backgroundColor: T.black }]} activeOpacity={0.8}>
            <Ionicons name={t.icon as any} size={15} color={tab === t.id ? "#FF453A" : T.text} />
            <Text style={{ color: tab === t.id ? "#FF453A" : T.text, fontSize: 11, fontWeight: tab === t.id ? "800" : "600" }}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 140 }}>
        {tab === "overview" && (
          <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
            {/* Hero stat */}
            <View style={[styles.heroCard, { backgroundColor: T.card, borderColor: "#FF453A30", shadowColor: '#FF453A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 16, elevation: 8 }]}>
              <LinearGradient colors={["#FF453A25", "transparent"]} style={StyleSheet.absoluteFill} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: T.text, fontSize: 10, fontWeight: "800", letterSpacing: 1.5 }}>TOTAL CALORIES BURNED</Text>
                <Text style={{ color: T.white, fontSize: 40, fontWeight: "900", letterSpacing: -1, marginTop: 4 }}>{totalCalories.toLocaleString()}</Text>
                <Text style={{ color: "#FF453A", fontSize: 13, fontWeight: "700" }}>kcal across {totalRuns} runs</Text>
              </View>
              <View style={[styles.heroIcon, { backgroundColor: "#FF453A25" }]}>
                <Ionicons name="flame" size={32} color="#FF453A" />
              </View>
            </View>

            {/* Stats grid — explicit 2-column rows */}
            <View style={{ gap: 10, marginBottom: 14 }}>
              <View style={styles.statRow}>
                <StatCard index={0} icon="walk-outline" label="Total Distance" value={(totalDistance / distMult).toFixed(1)} unit={unitLabel} color="#32D74B" />
                <StatCard index={1} icon="time-outline" label="Total Time" value={Math.round(totalDuration / 60).toString()} unit="min" color="#0A84FF" />
              </View>
              <View style={styles.statRow}>
                <StatCard index={2} icon="speedometer-outline" label="Avg Pace" value={avgPace} unit="min/km" color="#FF9F0A" />
                <StatCard index={3} icon="trophy-outline" label="Longest Run" value={(longestRun / distMult).toFixed(2)} unit={unitLabel} color="#FFD60A" />
              </View>
              <View style={styles.statRow}>
                <StatCard index={4} icon="flash-outline" label="Best Pace" value={bestPace} unit="min/km" color="#BF5FFF" />
                <StatCard index={5} icon="calendar-outline" label="This Week" value={String(weekRuns)} unit="runs" color="#5E5CE6" />
              </View>
            </View>

            {/* Charts */}
            <View style={{ gap: 12 }}>
              <BarChart data={weeklyCalData} color="#FF453A" label="WEEKLY CALORIES" />
              <BarChart data={weeklyDistData} color="#32D74B" label={`WEEKLY DISTANCE (${unitLabel})`} />
            </View>
          </View>
        )}

        {tab === "records" && (
          <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
            {history.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: T.card, borderColor: T.border }]}>
                <Ionicons name="trophy-outline" size={44} color={T.text} />
                <Text style={{ color: T.white, fontSize: 16, fontWeight: "800", marginTop: 14 }}>No records yet</Text>
                <Text style={{ color: T.text, fontSize: 13, marginTop: 6, textAlign: "center", lineHeight: 20 }}>Complete runs to set personal records</Text>
              </View>
            ) : (
              <PersonalRecordsCard history={history} isMetric={isMetric} />
            )}
          </View>
        )}

        {tab === "history" && (
          <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
            {history.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: T.card, borderColor: T.border }]}>
                <Ionicons name="fitness-outline" size={44} color={T.text} />
                <Text style={{ color: T.white, fontSize: 16, fontWeight: "800", marginTop: 14 }}>No runs yet</Text>
                <Text style={{ color: T.text, fontSize: 13, marginTop: 6, textAlign: "center", lineHeight: 20 }}>Start running to see your fitness history here</Text>
              </View>
            ) : (
              history.slice(0, 30).map((run, i) => <RunRow key={run.id} run={run} index={i} isMetric={isMetric} onReplay={setReplayRun} />)
            )}
          </View>
        )}

        {tab === "zones" && (
          <View style={{ paddingHorizontal: 16, paddingTop: 8, gap: 12 }}>
            {/* Zone distribution */}
            <View style={[styles.chartCard, { backgroundColor: T.card, borderColor: T.border }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <View style={{ width: 3, height: 16, borderRadius: 2, backgroundColor: "#FF453A" }} />
                <Text style={{ color: T.text, fontSize: 10, fontWeight: "800", letterSpacing: 1.5 }}>ZONE DISTRIBUTION</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, height: 90 }}>
                {ZONE_DEFS.map((z, i) => {
                  const barH = zoneCounts[i] > 0 ? Math.max((zoneCounts[i] / maxZoneCount) * 72, 8) : 4;
                  return (
                    <View key={z.zone} style={{ flex: 1, alignItems: "center", gap: 4 }}>
                      {zoneCounts[i] > 0 && <Text style={{ color: T.text, fontSize: 9, fontWeight: "700" }}>{zoneCounts[i]}</Text>}
                      <View style={{ width: "100%", height: barH, borderRadius: 5, backgroundColor: zoneCounts[i] > 0 ? z.color : T.border }} />
                      <Text style={{ color: z.color, fontSize: 9, fontWeight: "900" }}>Z{i + 1}</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Zone cards */}
            {ZONE_DEFS.map((z, i) => (
              <View key={z.zone} style={[styles.zoneCard, { backgroundColor: T.card, borderColor: z.color + "30", borderLeftColor: z.color }]}>
                <LinearGradient colors={[z.color + "15", "transparent"]} style={StyleSheet.absoluteFill} />
                <View style={[styles.zoneNum, { backgroundColor: z.color + "25", borderColor: z.color + "40" }]}>
                  <Text style={{ color: z.color, fontSize: 18, fontWeight: "900" }}>{i + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: T.white, fontSize: 14, fontWeight: "800" }}>{z.zone} — {z.desc}</Text>
                  <Text style={{ color: T.text, fontSize: 11, marginTop: 2 }}>{z.pace}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ color: z.color, fontSize: 20, fontWeight: "900" }}>{zoneCounts[i]}</Text>
                  <Text style={{ color: T.text, fontSize: 9, fontWeight: "700" }}>RUNS</Text>
                </View>
              </View>
            ))}

            {/* Tips */}
            <View style={[styles.chartCard, { backgroundColor: T.card, borderColor: T.border }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <View style={{ width: 3, height: 16, borderRadius: 2, backgroundColor: "#0A84FF" }} />
                <Text style={{ color: T.text, fontSize: 10, fontWeight: "800", letterSpacing: 1.5 }}>TRAINING TIPS</Text>
              </View>
              {[
                { icon: "leaf-outline", color: "#34C759", tip: "80% of your runs should be Zone 1-2 (easy pace)" },
                { icon: "flash-outline", color: "#FFD60A", tip: "Zone 3-4 builds speed and lactate threshold" },
                { icon: "flame-outline", color: "#FF453A", tip: "Zone 5 is max effort — use sparingly for intervals" },
                { icon: "moon-outline", color: "#0A84FF", tip: "Recovery runs in Zone 1 reduce injury risk" },
              ].map((t, i) => (
                <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: i < 3 ? 12 : 0 }}>
                  <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: t.color + "20", alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name={t.icon as any} size={15} color={t.color} />
                  </View>
                  <Text style={{ color: T.text, fontSize: 13, flex: 1, lineHeight: 19 }}>{t.tip}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  zoneBadge: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, borderWidth: 1, alignItems: "center", gap: 2 },
  tabBar: { flexDirection: "row", marginHorizontal: 16, borderRadius: 16, borderWidth: 1, padding: 4, marginBottom: 8 },
  tabBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 9, borderRadius: 12 },
  heroCard: { borderRadius: 22, borderWidth: 1, padding: 20, flexDirection: "row", alignItems: "center", marginBottom: 14, overflow: "hidden" },
  heroIcon: { width: 64, height: 64, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  statRow: { flexDirection: "row", gap: 10 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 14 },
  statCard: { borderRadius: 18, borderWidth: 1, borderTopWidth: 3, padding: 14, gap: 2 },
  statIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  chartCard: { borderRadius: 20, padding: 16, borderWidth: 1 },
  runRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 16, marginBottom: 8, borderWidth: 1, overflow: "hidden" },
  runZoneBar: { position: "absolute", left: 0, top: 0, bottom: 0, width: 3, borderRadius: 2 },
  runIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", marginLeft: 6 },
  zoneCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 16, borderWidth: 1, borderLeftWidth: 4, overflow: "hidden" },
  zoneNum: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  emptyCard: { padding: 48, borderRadius: 24, alignItems: "center", borderWidth: 1, marginTop: 20 },
  prCard: { width: 110, borderRadius: 18, borderWidth: 1, borderTopWidth: 3, padding: 14, gap: 2 },
});
