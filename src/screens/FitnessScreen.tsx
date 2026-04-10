import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/utils/ThemeContext';
import { getHistory, RunRecord } from '../services/history';
import { getSettings } from '../config/settings';

const { width } = Dimensions.get('window');

// ─── Calorie calculation ──────────────────────────────────────────────────────
// MET-based formula: Calories = MET × weight(kg) × duration(hours)
// Running MET ≈ 9.8 for moderate pace
const DEFAULT_WEIGHT_KG = 70;
const RUNNING_MET = 9.8;

function calcCalories(distanceMeters: number, durationSec: number, weightKg = DEFAULT_WEIGHT_KG): number {
  const hours = durationSec / 3600;
  return Math.round(RUNNING_MET * weightKg * hours);
}

function calcPace(distanceMeters: number, durationSec: number): string {
  if (distanceMeters < 10) return '--';
  const minPerKm = (durationSec / 60) / (distanceMeters / 1000);
  const min = Math.floor(minPerKm);
  const sec = Math.round((minPerKm - min) * 60);
  return `${min}:${sec < 10 ? '0' : ''}${sec}`;
}

function getHeartRateZone(pace: number): { zone: string; color: string; desc: string } {
  if (pace === 0 || pace > 12) return { zone: 'Rest', color: '#8E8E93', desc: 'Recovery zone' };
  if (pace > 8) return { zone: 'Zone 1', color: '#34C759', desc: 'Easy / Fat burn' };
  if (pace > 6) return { zone: 'Zone 2', color: '#30D158', desc: 'Aerobic base' };
  if (pace > 5) return { zone: 'Zone 3', color: '#FFD60A', desc: 'Tempo / Threshold' };
  if (pace > 4) return { zone: 'Zone 4', color: '#FF9F0A', desc: 'High intensity' };
  return { zone: 'Zone 5', color: '#FF453A', desc: 'Max effort' };
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function FitnessCard({ icon, label, value, unit, color, index }: {
  icon: string; label: string; value: string; unit: string; color: string; index: number;
}) {
  const { T, themeName } = useTheme();
  const isLight = themeName === 'light';
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: 1, delay: index * 80, useNativeDriver: true, tension: 60, friction: 9 }).start();
  }, []);
  return (
    <Animated.View style={[{ opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }, { width: (width - 60) / 2 }]}>
      <View style={[styles.fitnessCard, { backgroundColor: isLight ? '#FFF' : T.card, borderColor: isLight ? '#EEE' : T.border }]}>
        <View style={[styles.fitnessIconBox, { backgroundColor: color + '18' }]}>
          <Ionicons name={icon as any} size={22} color={color} />
        </View>
        <Text style={[styles.fitnessValue, { color: isLight ? '#000' : T.white }]}>{value}</Text>
        <Text style={[styles.fitnessUnit, { color: color }]}>{unit}</Text>
        <Text style={[styles.fitnessLabel, { color: T.text }]}>{label}</Text>
      </View>
    </Animated.View>
  );
}

// ─── Run Row ──────────────────────────────────────────────────────────────────

function RunRow({ run, index, isMetric }: { run: RunRecord; index: number; isMetric: boolean }) {
  const { T, themeName } = useTheme();
  const isLight = themeName === 'light';
  const anim = useRef(new Animated.Value(0)).current;
  const distMult = isMetric ? 1000 : 1609.34;
  const unitLabel = isMetric ? 'km' : 'mi';
  const calories = calcCalories(run.distanceMeters, run.durationSec);
  const pace = calcPace(run.distanceMeters, run.durationSec);
  const paceNum = run.distanceMeters > 10 ? (run.durationSec / 60) / (run.distanceMeters / 1000) : 0;
  const zone = getHeartRateZone(paceNum);

  useEffect(() => {
    Animated.spring(anim, { toValue: 1, delay: index * 60, useNativeDriver: true, tension: 60, friction: 9 }).start();
  }, []);

  return (
    <Animated.View style={[{ opacity: anim, transform: [{ translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }] }]}>
      <View style={[styles.runRow, { backgroundColor: isLight ? '#FFF' : T.card, borderColor: isLight ? '#EEE' : T.border }]}>
        <View style={[styles.runRowIcon, { backgroundColor: zone.color + '18' }]}>
          <Ionicons name="flame" size={18} color={zone.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: isLight ? '#000' : T.white, fontSize: 14, fontWeight: '800' }}>
            {new Date(run.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 3 }}>
            <Text style={{ color: T.text, fontSize: 11 }}>{(run.distanceMeters / distMult).toFixed(2)} {unitLabel}</Text>
            <Text style={{ color: T.text, fontSize: 11 }}>{Math.round(run.durationSec / 60)} min</Text>
            <Text style={{ color: T.text, fontSize: 11 }}>⚡ {pace} /km</Text>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Text style={{ color: zone.color, fontSize: 15, fontWeight: '900' }}>{calories}</Text>
          <Text style={{ color: T.text, fontSize: 10, fontWeight: '700' }}>KCAL</Text>
          <View style={{ backgroundColor: zone.color + '20', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
            <Text style={{ color: zone.color, fontSize: 9, fontWeight: '800' }}>{zone.zone}</Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function FitnessScreen() {
  const { T, themeName } = useTheme();
  const isLight = themeName === 'light';
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [history, setHistory] = useState<RunRecord[]>([]);
  const [isMetric, setIsMetric] = useState(true);
  const headerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    (async () => {
      const h = await getHistory();
      setHistory(h);
      const s = await getSettings();
      setIsMetric(s.units !== 'imperial');
      Animated.spring(headerAnim, { toValue: 1, useNativeDriver: true, tension: 50, friction: 8 }).start();
    })();
  }, []);

  const distMult = isMetric ? 1000 : 1609.34;
  const unitLabel = isMetric ? 'KM' : 'MI';

  const totalCalories = history.reduce((sum, r) => sum + calcCalories(r.distanceMeters, r.durationSec), 0);
  const totalDistance = history.reduce((sum, r) => sum + r.distanceMeters, 0);
  const totalDuration = history.reduce((sum, r) => sum + r.durationSec, 0);
  const avgPaceNum = totalDistance > 0 ? (totalDuration / 60) / (totalDistance / 1000) : 0;
  const avgPace = calcPace(totalDistance, totalDuration);
  const avgZone = getHeartRateZone(avgPaceNum);
  const longestRun = history.reduce((max, r) => r.distanceMeters > max ? r.distanceMeters : max, 0);
  const weekRuns = history.filter(r => Date.now() - r.createdAt < 7 * 86400000).length;

  // Weekly calorie chart (last 7 days)
  const weeklyData: { day: string; cal: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dayStr = d.toLocaleDateString(undefined, { weekday: 'short' });
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const dayEnd = dayStart + 86400000;
    const cal = history
      .filter(r => r.createdAt >= dayStart && r.createdAt < dayEnd)
      .reduce((s, r) => s + calcCalories(r.distanceMeters, r.durationSec), 0);
    weeklyData.push({ day: dayStr, cal });
  }
  const maxCal = Math.max(...weeklyData.map(d => d.cal), 1);

  return (
    <View style={{ flex: 1, backgroundColor: T.black }}>
      <LinearGradient colors={['#FF453A18', 'transparent']} style={StyleSheet.absoluteFill} />

      {/* Header */}
      <Animated.View style={[styles.header, { paddingTop: insets.top + 16, opacity: headerAnim, transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { backgroundColor: T.card, borderColor: T.border }]}>
          <Ionicons name="arrow-back" size={20} color={T.white} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ color: T.white, fontSize: 26, fontWeight: '900', letterSpacing: -0.5 }}>Fitness</Text>
          <Text style={{ color: T.text, fontSize: 13, marginTop: 2 }}>Your health & performance</Text>
        </View>
        <View style={[styles.zoneBadge, { backgroundColor: avgZone.color + '20', borderColor: avgZone.color + '40' }]}>
          <Text style={{ color: avgZone.color, fontSize: 11, fontWeight: '800' }}>{avgZone.zone}</Text>
          <Text style={{ color: avgZone.color, fontSize: 9, opacity: 0.8 }}>AVG</Text>
        </View>
      </Animated.View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Stats grid */}
        <View style={styles.grid}>
          <FitnessCard index={0} icon="flame" label="Total Calories" value={totalCalories.toLocaleString()} unit="kcal" color="#FF453A" />
          <FitnessCard index={1} icon="walk" label="Total Distance" value={(totalDistance / distMult).toFixed(1)} unit={unitLabel} color="#32D74B" />
          <FitnessCard index={2} icon="time" label="Total Time" value={Math.round(totalDuration / 60).toString()} unit="min" color="#0A84FF" />
          <FitnessCard index={3} icon="speedometer" label="Avg Pace" value={avgPace} unit="min/km" color="#FF9F0A" />
          <FitnessCard index={4} icon="trophy" label="Longest Run" value={(longestRun / distMult).toFixed(2)} unit={unitLabel} color="#FFD60A" />
          <FitnessCard index={5} icon="calendar" label="This Week" value={String(weekRuns)} unit="runs" color="#AF52DE" />
        </View>

        {/* Weekly calorie chart */}
        <View style={[styles.section, { backgroundColor: isLight ? '#FFF' : T.card, borderColor: isLight ? '#EEE' : T.border }]}>
          <Text style={[styles.sectionTitle, { color: T.text }]}>WEEKLY CALORIES</Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 100, marginTop: 12 }}>
            {weeklyData.map((d, i) => {
              const barH = maxCal > 0 ? Math.max((d.cal / maxCal) * 80, d.cal > 0 ? 8 : 2) : 2;
              return (
                <View key={i} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                  <Text style={{ color: T.text, fontSize: 9, fontWeight: '700' }}>{d.cal > 0 ? d.cal : ''}</Text>
                  <View style={{ width: '100%', height: barH, borderRadius: 6, backgroundColor: d.cal > 0 ? '#FF453A' : T.border }} />
                  <Text style={{ color: T.text, fontSize: 10, fontWeight: '700' }}>{d.day}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Heart rate zones legend */}
        <View style={[styles.section, { backgroundColor: isLight ? '#FFF' : T.card, borderColor: isLight ? '#EEE' : T.border }]}>
          <Text style={[styles.sectionTitle, { color: T.text }]}>HEART RATE ZONES</Text>
          {[
            { zone: 'Zone 1', color: '#34C759', desc: 'Easy / Fat burn', pace: '> 8 min/km' },
            { zone: 'Zone 2', color: '#30D158', desc: 'Aerobic base', pace: '6–8 min/km' },
            { zone: 'Zone 3', color: '#FFD60A', desc: 'Tempo / Threshold', pace: '5–6 min/km' },
            { zone: 'Zone 4', color: '#FF9F0A', desc: 'High intensity', pace: '4–5 min/km' },
            { zone: 'Zone 5', color: '#FF453A', desc: 'Max effort', pace: '< 4 min/km' },
          ].map(z => (
            <View key={z.zone} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.border }}>
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: z.color }} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: isLight ? '#000' : T.white, fontSize: 13, fontWeight: '700' }}>{z.zone} — {z.desc}</Text>
                <Text style={{ color: T.text, fontSize: 11, marginTop: 1 }}>{z.pace}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Run history with calories */}
        <View style={{ paddingHorizontal: 20 }}>
          <Text style={[styles.sectionTitle, { color: T.text, marginBottom: 12 }]}>RUN BREAKDOWN</Text>
          {history.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: isLight ? '#F5F5F5' : T.card }]}>
              <Ionicons name="flame-outline" size={36} color={T.text} />
              <Text style={{ color: T.text, marginTop: 10, fontSize: 14, textAlign: 'center' }}>No runs yet. Start running to see your fitness data!</Text>
            </View>
          ) : (
            history.slice(0, 10).map((run, i) => (
              <RunRow key={run.id} run={run} index={i} isMetric={isMetric} />
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingBottom: 20 },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  zoneBadge: { alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20, gap: 12, marginBottom: 20 },
  fitnessCard: { borderRadius: 20, padding: 16, borderWidth: 1, alignItems: 'flex-start', gap: 4 },
  fitnessIconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  fitnessValue: { fontSize: 22, fontWeight: '900' },
  fitnessUnit: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  fitnessLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  section: { marginHorizontal: 20, marginBottom: 20, borderRadius: 20, padding: 16, borderWidth: 1 },
  sectionTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  runRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, marginBottom: 10, borderWidth: 1 },
  runRowIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  emptyCard: { padding: 40, borderRadius: 20, alignItems: 'center' },
});
