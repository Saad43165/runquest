import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Animated, Dimensions, Modal,
  TouchableOpacity, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/utils/ThemeContext';

const { width, height } = Dimensions.get('window');

// ─── Pace zone helper ─────────────────────────────────────────────────────────
function getPaceZone(paceMinPerKm: number): { label: string; color: string; desc: string } {
  if (paceMinPerKm === 0 || paceMinPerKm > 12)
    return { label: 'REST',     color: '#8E8E93', desc: 'Recovery pace'        };
  if (paceMinPerKm > 8)
    return { label: 'ZONE 1',   color: '#34C759', desc: 'Easy · Fat burn'      };
  if (paceMinPerKm > 6)
    return { label: 'ZONE 2',   color: '#30D158', desc: 'Aerobic base'         };
  if (paceMinPerKm > 5)
    return { label: 'ZONE 3',   color: '#FFD60A', desc: 'Tempo · Threshold'    };
  if (paceMinPerKm > 4)
    return { label: 'ZONE 4',   color: '#FF9F0A', desc: 'High intensity'       };
  return   { label: 'ZONE 5',   color: '#FF453A', desc: 'Max effort'           };
}

// ─── Animated counter ─────────────────────────────────────────────────────────
function CountUp({ to, decimals = 0, suffix = '', style }: { to: number; decimals?: number; suffix?: string; style?: any }) {
  const anim = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState('0');

  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, { toValue: to, duration: 1200, useNativeDriver: false }).start();
    const id = anim.addListener(({ value }) => {
      setDisplay(value.toFixed(decimals) + suffix);
    });
    return () => anim.removeListener(id);
  }, [to]);

  return <Text style={style}>{display}</Text>;
}

// ─── Single stat tile ─────────────────────────────────────────────────────────
function StatTile({ icon, color, label, value, unit, anim }: {
  icon: string; color: string; label: string; value: string; unit: string; anim: Animated.Value;
}) {
  return (
    <Animated.View style={{
      flex: 1,
      opacity: anim,
      transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
    }}>
      <View style={[styles.statTile, { borderTopColor: color }]}>
        <View style={[styles.statIconWrap, { backgroundColor: color + '20' }]}>
          <Ionicons name={icon as any} size={16} color={color} />
        </View>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={[styles.statUnit, { color }]}>{unit}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
    </Animated.View>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────
type Props = {
  visible: boolean;
  onClose: () => void;
  onDiscard?: () => void;
  data: {
    id?: string | null;
    distance: string;
    time: string;
    unit: string;
    pace: number;
    calories: number;
    elapsed: number;
    goalLabel?: string | null;
    goalMet?: boolean;
    goalValueKm?: number | null;
    goalValueSec?: number | null;
  } | null;
  isLight: boolean;
  closedLoop: boolean;
  onClaim: () => void;
  loopAreaSqM?: number;
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function RunSummaryModal({ visible, onClose, onDiscard, data, isLight, closedLoop, onClaim, loopAreaSqM }: Props) {
  const insets = useSafeAreaInsets();
  const { T } = useTheme();

  // Animations
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetY        = useRef(new Animated.Value(height)).current;
  const heroScale     = useRef(new Animated.Value(0.6)).current;
  const heroOpacity   = useRef(new Animated.Value(0)).current;
  const zoneBadgeAnim = useRef(new Animated.Value(0)).current;
  const xpBarAnim     = useRef(new Animated.Value(0)).current;
  const glowPulse     = useRef(new Animated.Value(0)).current;
  const [tileAnims]   = useState(() => Array.from({ length: 4 }, () => new Animated.Value(0)));
  const [ctaAnim]     = useState(new Animated.Value(0));

  useEffect(() => {
    if (!visible) return;

    // Reset
    [backdropOpacity, sheetY, heroScale, heroOpacity, zoneBadgeAnim, xpBarAnim, ctaAnim]
      .forEach(a => a.setValue(a === sheetY ? height : a === heroScale ? 0.6 : 0));
    tileAnims.forEach(a => a.setValue(0));

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Sequence: backdrop → sheet slides up → hero pops → tiles stagger → zone badge → XP bar → CTA
    Animated.sequence([
      Animated.timing(backdropOpacity, { toValue: 1, duration: 240, useNativeDriver: true }),
      Animated.spring(sheetY, { toValue: 0, useNativeDriver: true, tension: 60, friction: 12 }),
      Animated.parallel([
        Animated.spring(heroScale,   { toValue: 1, useNativeDriver: true, tension: 80, friction: 8 }),
        Animated.timing(heroOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]),
      Animated.stagger(80, tileAnims.map(a =>
        Animated.spring(a, { toValue: 1, useNativeDriver: true, tension: 100, friction: 10 })
      )),
      Animated.spring(zoneBadgeAnim, { toValue: 1, useNativeDriver: true, tension: 90, friction: 9 }),
      Animated.timing(xpBarAnim, { toValue: 1, duration: 800, useNativeDriver: false }),
      Animated.spring(ctaAnim, { toValue: 1, useNativeDriver: true, tension: 70, friction: 9 }),
    ]).start();

    // Glow pulse loop
    Animated.loop(Animated.sequence([
      Animated.timing(glowPulse, { toValue: 1, duration: 1800, useNativeDriver: true }),
      Animated.timing(glowPulse, { toValue: 0, duration: 1800, useNativeDriver: true }),
    ])).start();
  }, [visible]);

  if (!data) return null;

  const distKm     = parseFloat(data.distance);
  const paceStr    = data.pace > 0
    ? `${Math.floor(data.pace)}:${String(Math.round((data.pace % 1) * 60)).padStart(2, '0')}`
    : '--';
  const zone       = getPaceZone(data.pace);
  const xpEarned   = Math.round(distKm * 10) + (closedLoop ? 50 : 0) + Math.round(data.elapsed / 60);
  const xpPct      = Math.min(xpEarned / 200, 1); // fill bar relative to 200xp max
  const areaSqM    = loopAreaSqM ?? 0;
  const canClaim   = closedLoop && areaSqM >= 100;

  const STAT_TILES = [
    { icon: 'time-outline',        color: '#0A84FF', label: 'DURATION',  value: data.time,          unit: 'min'  },
    { icon: 'speedometer-outline', color: '#FF9F0A', label: 'AVG PACE',  value: paceStr,            unit: '/km'  },
    { icon: 'flame-outline',       color: '#FF453A', label: 'CALORIES',  value: String(data.calories || '--'), unit: 'kcal' },
    { icon: 'flash-outline',       color: '#FFD60A', label: 'XP EARNED', value: `+${xpEarned}`,     unit: 'xp'   },
  ];

  const goalProgress = data.goalLabel
    ? data.goalValueKm
      ? Math.min(distKm / data.goalValueKm, 1)
      : data.goalValueSec
        ? Math.min(data.elapsed / data.goalValueSec, 1)
        : null
    : null;

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      {/* Backdrop */}
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.88)', opacity: backdropOpacity }]} />

      {/* Sheet */}
      <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetY }] }]}>
        {/* Gradient header strip */}
        <LinearGradient
          colors={closedLoop ? ['#00C6A0', '#0A84FF'] : ['#FF9F0A', '#FF6040']}
          style={styles.topStripe}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        />

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          bounces={true}
        >
          {/* Drag handle */}
          <View style={styles.handle} />

          {/* ── HERO SECTION ── */}
          <Animated.View style={[styles.heroSection, {
            opacity: heroOpacity,
            transform: [{ scale: heroScale }],
          }]}>
            {/* Nested Glow ring & Hero Icon for perfect alignment */}
            <Animated.View style={[styles.glowRing, {
              borderColor: closedLoop ? '#00C6A0' : '#FF9F0A',
              opacity: glowPulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.6] }),
              transform: [{ scale: glowPulse.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.08] }) }],
            }]}>
              <View style={[styles.heroIcon, {
                backgroundColor: (closedLoop ? '#00C6A0' : '#FF9F0A') + '18',
                borderColor:     (closedLoop ? '#00C6A0' : '#FF9F0A') + '50',
              }]}>
                <Ionicons name={closedLoop ? 'trophy' : 'fitness'} size={28} color={closedLoop ? '#00C6A0' : '#FF9F0A'} />
              </View>
            </Animated.View>
          </Animated.View>

          {/* Title */}
          <Animated.View style={{ opacity: heroOpacity, alignItems: 'center', marginBottom: 6 }}>
            <Text style={styles.heroTitle}>
              {closedLoop ? 'Loop Closed!' : 'Run Complete'}
            </Text>
            <Text style={styles.heroSub}>
              {closedLoop ? 'Territory ready to claim' : 'Great effort, warrior!'}
            </Text>
          </Animated.View>

          {/* ── BIG DISTANCE NUMBER ── */}
          <Animated.View style={[styles.distanceBlock, { opacity: heroOpacity }]}>
            <CountUp to={distKm} decimals={2} style={styles.distanceNum} />
            <Text style={styles.distanceUnit}>{data.unit}</Text>
          </Animated.View>

          {/* ── PACE ZONE BADGE ── */}
          <Animated.View style={{
            alignItems: 'center',
            marginBottom: 24,
            opacity: zoneBadgeAnim,
            transform: [{ scale: zoneBadgeAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }],
          }}>
            <View style={[styles.zoneBadge, { backgroundColor: zone.color + '20', borderColor: zone.color + '60' }]}>
              <View style={[styles.zoneDot, { backgroundColor: zone.color }]} />
              <Text style={[styles.zoneLabel, { color: zone.color }]}>{zone.label}</Text>
              <Text style={styles.zoneDesc}>{zone.desc}</Text>
            </View>
          </Animated.View>

          {/* ── STAT TILES 2x2 ── */}
          <View style={styles.tilesRow}>
            {STAT_TILES.slice(0, 2).map((s, i) => (
              <StatTile key={s.label} {...s} anim={tileAnims[i]} />
            ))}
          </View>
          <View style={[styles.tilesRow, { marginBottom: 20 }]}>
            {STAT_TILES.slice(2, 4).map((s, i) => (
              <StatTile key={s.label} {...s} anim={tileAnims[i + 2]} />
            ))}
          </View>

          {/* ── XP BAR ── */}
          <View style={styles.xpCard}>
            <View style={styles.xpRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="flash" size={14} color="#FFD60A" />
                <Text style={styles.xpTitle}>XP Earned This Run</Text>
              </View>
              <Text style={styles.xpValue}>+{xpEarned} XP</Text>
            </View>
            <View style={styles.xpBarBg}>
              <Animated.View style={[styles.xpBarFill, {
                width: xpBarAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', `${Math.round(xpPct * 100)}%`] }),
              }]} />
            </View>
          </View>

          {/* ── GOAL RESULT ── */}
          {data.goalLabel && goalProgress !== null && (
            <View style={[styles.goalCard, {
              borderColor: data.goalMet ? '#32D74B40' : '#0A84FF40',
              backgroundColor: data.goalMet ? '#32D74B0C' : '#0A84FF0C',
            }]}>
              <Ionicons
                name={data.goalMet ? 'checkmark-circle' : 'flag-outline'}
                size={18}
                color={data.goalMet ? '#32D74B' : '#0A84FF'}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ color: data.goalMet ? '#32D74B' : '#0A84FF', fontWeight: '800', fontSize: 13 }}>
                  {data.goalMet ? `Goal Achieved — ${data.goalLabel} ✓` : `Goal: ${data.goalLabel} — ${Math.round(goalProgress * 100)}%`}
                </Text>
                <View style={[styles.xpBarBg, { marginTop: 6 }]}>
                  <View style={[styles.xpBarFill, {
                    width: `${Math.round(goalProgress * 100)}%`,
                    backgroundColor: data.goalMet ? '#32D74B' : '#0A84FF',
                  }]} />
                </View>
              </View>
            </View>
          )}

          {/* ── LOOP STATUS CHIP / NOTIFICATION ── */}
          {closedLoop ? (
            <View style={{ marginBottom: 12 }}>
              {canClaim ? (
                <View style={styles.areaChip}>
                  <Ionicons name="map" size={13} color="#00C6A0" />
                  <Text style={styles.areaText}>
                    {areaSqM >= 1000
                      ? `${(areaSqM / 1000).toFixed(2)} km² territory`
                      : `${Math.round(areaSqM)} m² territory`}
                    {' '}ready to claim
                  </Text>
                </View>
              ) : (
                <View style={styles.smallLoopBox}>
                  <Ionicons name="warning" size={16} color="#FF453A" />
                  <Text style={styles.smallLoopText}>
                    Loop too small ({Math.round(areaSqM)}m²) — need 100m² minimum to claim.
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.noLoopBox}>
              <Ionicons name="information-circle-outline" size={16} color="#8E8E93" />
              <Text style={styles.noLoopText}>
                Return within 30m of your start to close the loop and claim a territory next time.
              </Text>
            </View>
          )}
        </ScrollView>

        {/* ── FIXED ACTIONS FOOTER PANEL (Never hidden beneath) ── */}
        <Animated.View style={{
          opacity: ctaAnim,
          transform: [{ translateY: ctaAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
          paddingHorizontal: 22,
          paddingTop: 12,
          paddingBottom: insets.bottom + 16,
          backgroundColor: '#0C0C0F',
          borderTopWidth: 1,
          borderColor: 'rgba(255,255,255,0.06)',
          gap: 10,
        }}>
          {canClaim && (
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={() => { onClose(); setTimeout(onClaim, 100); }}
              style={styles.claimBtn}
            >
              <LinearGradient
                colors={['#00C6A0', '#0A84FF']}
                style={styles.claimBtnInner}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              >
                <Ionicons name="flag" size={20} color="#FFF" />
                <Text style={styles.claimBtnText}>CLAIM TERRITORY</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          <View style={{ flexDirection: 'row', gap: 10 }}>
            {onDiscard && (
              <TouchableOpacity
                onPress={onDiscard}
                activeOpacity={0.8}
                style={styles.discardBtn}
              >
                <Ionicons name="trash-outline" size={16} color="#FF453A" />
                <Text style={styles.discardBtnText}>Discard</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={onClose}
              activeOpacity={0.85}
              style={[styles.doneBtn, { flex: onDiscard ? 1.4 : 1 }]}
            >
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: '#0C0C0F',
    borderTopLeftRadius: 38,
    borderTopRightRadius: 38,
    overflow: 'hidden',
    maxHeight: height * 0.95,
  },
  topStripe: { height: 4 },
  scroll: { paddingHorizontal: 22, paddingTop: 16 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#2C2C30', alignSelf: 'center', marginBottom: 24 },

  // Hero
  heroSection: { alignItems: 'center', justifyContent: 'center', marginBottom: 10, position: 'relative', height: 90 },
  glowRing: {
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  heroIcon: {
    width: 62, height: 62, borderRadius: 31,
    borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  heroTitle: { color: '#FFF', fontSize: 24, fontWeight: '900', letterSpacing: -0.6, textAlign: 'center' },
  heroSub: { color: '#8E8E93', fontSize: 12, marginTop: 3, textAlign: 'center' },

  // Distance hero
  distanceBlock: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 4, marginBottom: 12 },
  distanceNum: { color: '#FFF', fontSize: 56, fontWeight: '900', letterSpacing: -3, lineHeight: 60 },
  distanceUnit: { color: '#8E8E93', fontSize: 18, fontWeight: '700', marginBottom: 8 },

  // Zone badge
  zoneBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1,
  },
  zoneDot: { width: 8, height: 8, borderRadius: 4 },
  zoneLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  zoneDesc: { color: '#8E8E93', fontSize: 11, fontWeight: '600' },

  // Stat tiles
  tilesRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  statTile: {
    flex: 1,
    backgroundColor: '#141417',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderTopWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    gap: 4,
  },
  statIconWrap: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  statValue: { color: '#FFF', fontSize: 20, fontWeight: '900', letterSpacing: -0.3 },
  statUnit: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  statLabel: { color: '#555', fontSize: 8, fontWeight: '700', letterSpacing: 1 },

  // XP
  xpCard: {
    backgroundColor: '#141417',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: 12,
    gap: 10,
  },
  xpRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  xpTitle: { color: '#FFF', fontWeight: '800', fontSize: 13 },
  xpValue: { color: '#FFD60A', fontWeight: '900', fontSize: 15 },
  xpBarBg: { height: 8, backgroundColor: '#222', borderRadius: 4, overflow: 'hidden' },
  xpBarFill: { height: '100%', backgroundColor: '#FFD60A', borderRadius: 4 },

  // Goal
  goalCard: {
    borderRadius: 18, borderWidth: 1, padding: 14,
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    marginBottom: 12,
  },

  // Loop area chip
  areaChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#00C6A010', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1, borderColor: '#00C6A030',
    alignSelf: 'center', marginBottom: 12,
  },
  areaText: { color: '#00C6A0', fontSize: 12, fontWeight: '800' },

  // Claim
  claimBtn: { borderRadius: 22, overflow: 'hidden' },
  claimBtnInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 16,
  },
  claimBtnText: { color: '#FFF', fontWeight: '900', fontSize: 17, letterSpacing: 0.3 },

  // Info boxes
  smallLoopBox: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: '#FF453A0C', borderRadius: 16, borderWidth: 1,
    borderColor: '#FF453A30', padding: 14, marginBottom: 10,
  },
  smallLoopText: { color: '#FF453A', fontSize: 12, flex: 1, lineHeight: 18, fontWeight: '600' },
  noLoopBox: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: '#1C1C1E', borderRadius: 16, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)', padding: 14, marginBottom: 10,
  },
  noLoopText: { color: '#8E8E93', fontSize: 12, flex: 1, lineHeight: 18 },

  // Done & Discard
  doneBtn: {
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnText: { color: 'rgba(255,255,255,0.75)', fontWeight: '700', fontSize: 15 },
  discardBtn: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#FF453A55',
    backgroundColor: '#FF453A15',
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  discardBtnText: { color: '#FF453A', fontWeight: '700', fontSize: 15 },
});
