import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Modal, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/utils/ThemeContext';

const { width } = Dimensions.get('window');

type RunSummaryModalProps = {
  visible: boolean;
  onClose: () => void;
  data: any;
  isLight: boolean;
  closedLoop: boolean;
  onClaim: () => void;
  loopAreaSqM?: number;
};

export default function RunSummaryModal({ 
  visible, onClose, data, isLight, closedLoop, onClaim, loopAreaSqM 
}: RunSummaryModalProps) {
  const { T } = useTheme();
  const slideAnim = useRef(new Animated.Value(800)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const headerAnim = useRef(new Animated.Value(0)).current;
  const [statAnims] = useState(() => [0, 1, 2, 3, 4, 5].map(() => new Animated.Value(0)));
  const xpBarAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      slideAnim.setValue(800);
      opacityAnim.setValue(0);
      headerAnim.setValue(0);
      xpBarAnim.setValue(0);
      statAnims.forEach(a => a.setValue(0));

      Animated.sequence([
        Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 55, friction: 11 }),
        Animated.spring(headerAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 9 }),
        Animated.stagger(55, statAnims.map(a =>
          Animated.spring(a, { toValue: 1, useNativeDriver: true, tension: 90, friction: 10 })
        )),
      ]).start(() => {
        Animated.timing(xpBarAnim, { toValue: 1, duration: 900, useNativeDriver: false }).start();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      });

      Animated.loop(Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])).start();
    }
  }, [visible, slideAnim, opacityAnim, headerAnim, xpBarAnim, statAnims, glowAnim]);

  if (!data) return null;

  const distKm = parseFloat(data.distance);
  const calories = data.calories ?? Math.round(distKm * 9.8 * 70 / 60);
  const xpEarned = Math.round(distKm * 10) + (closedLoop ? 50 : 0);
  const paceStr = data.pace > 0
    ? `${Math.floor(data.pace)}:${String(Math.round((data.pace % 1) * 60)).padStart(2, '0')}`
    : '--';

  const goalProgress = data.goalLabel && data.goalValueKm
    ? Math.min(distKm / data.goalValueKm, 1)
    : data.goalLabel && data.goalValueSec
    ? Math.min((data.elapsed ?? 0) / data.goalValueSec, 1)
    : null;

  const bg = isLight ? '#F8F8FA' : '#0C0C0E';
  const cardBg = isLight ? '#FFFFFF' : '#161618';
  const cardBorder = isLight ? '#EBEBED' : 'rgba(255,255,255,0.07)';
  const textPrimary = isLight ? '#0A0A0A' : '#FFFFFF';
  const textSecondary = isLight ? '#6B6B6B' : '#666';

  const statRows = [
    { label: 'DISTANCE', value: data.distance, unit: data.unit, icon: 'navigate-outline', color: '#00C6A0' },
    { label: 'DURATION', value: data.time, unit: 'min', icon: 'time-outline', color: '#0A84FF' },
    { label: 'AVG PACE', value: paceStr, unit: '/km', icon: 'speedometer-outline', color: '#FF9F0A' },
    { label: 'CALORIES', value: calories > 0 ? String(calories) : '--', unit: 'kcal', icon: 'flame-outline', color: '#FF453A' },
    { label: 'XP EARNED', value: `+${xpEarned}`, unit: 'xp', icon: 'flash-outline', color: '#FFD60A' },
    { label: 'LOOP', value: closedLoop ? 'YES' : 'NO', unit: '', icon: 'git-commit-outline', color: closedLoop ? '#32D74B' : '#636366' },
  ];

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.75)', opacity: opacityAnim }]} />

      <Animated.View style={[styles.sheetContainer, { transform: [{ translateY: slideAnim }] }]}>
        <View style={[styles.sheet, { backgroundColor: bg }]}>
          <LinearGradient
            colors={closedLoop ? ['#00C6A0', '#0A84FF'] : ['#FF9F0A', '#FF453A']}
            style={styles.topStripe}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          />

          <LinearGradient
            colors={closedLoop ? ['#00C6A015', 'transparent'] : ['#FF9F0A10', 'transparent']}
            style={styles.bgGradient}
          />

          <View style={styles.content}>
            <View style={[styles.handle, { backgroundColor: isLight ? '#DDD' : '#2A2A2C' }]} />

            <Animated.View style={[styles.header, {
              opacity: headerAnim,
              transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
            }]}>
              <Animated.View style={[styles.trophyContainer, {
                backgroundColor: closedLoop ? '#00C6A020' : '#FF9F0A20',
                borderColor: closedLoop ? '#00C6A040' : '#FF9F0A40',
                opacity: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }),
              }]}>
                <Ionicons name={closedLoop ? 'trophy' : 'fitness'} size={28} color={closedLoop ? '#00C6A0' : '#FF9F0A'} />
              </Animated.View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: textPrimary }]}>
                  {closedLoop ? 'Loop Closed! 🎉' : 'Run Complete'}
                </Text>
                <Text style={[styles.subtitle, { color: textSecondary }]}>
                  {closedLoop ? 'Territory ready to claim' : 'Great effort, warrior!'}
                </Text>
                {data.goalLabel && (
                  <View style={styles.goalResult}>
                    <Ionicons name={data.goalMet ? 'checkmark-circle' : 'flag-outline'} size={13} color={data.goalMet ? '#32D74B' : '#FF9F0A'} />
                    <Text style={[styles.goalResultText, { color: data.goalMet ? '#32D74B' : '#FF9F0A' }]}>
                      {data.goalMet ? `Goal reached: ${data.goalLabel} ✓` : `Goal: ${data.goalLabel} — keep going!`}
                    </Text>
                  </View>
                )}
              </View>
            </Animated.View>

            <View style={styles.statsGrid}>
              {statRows.map((s, i) => (
                <Animated.View key={s.label} style={[styles.statCell, {
                  opacity: statAnims[i],
                  transform: [{ scale: statAnims[i].interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }) }],
                }]}>
                  <View style={[styles.statCard, { backgroundColor: cardBg, borderColor: cardBorder, borderTopColor: s.color }]}>
                    <View style={[styles.statIconWrap, { backgroundColor: s.color + '20' }]}>
                      <Ionicons name={s.icon as any} size={14} color={s.color} />
                    </View>
                    <Text style={[styles.statValue, { color: textPrimary }]}>{s.value}</Text>
                    {s.unit ? <Text style={[styles.statUnit, { color: s.color }]}>{s.unit}</Text> : null}
                    <Text style={[styles.statLabel, { color: textSecondary }]}>{s.label}</Text>
                  </View>
                </Animated.View>
              ))}
            </View>

            <Animated.View style={[styles.infoRow, {
              opacity: statAnims[4],
              backgroundColor: cardBg,
              borderColor: cardBorder,
            }]}>
              <View style={styles.infoRowHeader}>
                <View style={styles.infoRowTitleWrap}>
                  <View style={[styles.infoIconWrap, { backgroundColor: '#FFD60A20' }]}>
                    <Ionicons name="flash" size={13} color="#FFD60A" />
                  </View>
                  <Text style={[styles.infoMainText, { color: textPrimary }]}>XP Progress</Text>
                </View>
                <Text style={styles.xpGainText}>+{xpEarned} XP</Text>
              </View>
              <View style={[styles.progressBarBg, { backgroundColor: isLight ? '#EBEBED' : '#222' }]}>
                <Animated.View style={[styles.progressBarFill, {
                  width: xpBarAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', `${Math.min(xpEarned / 2, 100)}%`] }),
                  backgroundColor: '#FFD60A',
                }]} />
              </View>
            </Animated.View>

            {data.goalLabel && goalProgress !== null && (
              <Animated.View style={[styles.infoRow, {
                opacity: statAnims[5],
                backgroundColor: cardBg,
                borderColor: cardBorder,
              }]}>
                <View style={styles.infoRowHeader}>
                  <View style={styles.infoRowTitleWrap}>
                    <View style={[styles.infoIconWrap, { backgroundColor: (data.goalMet ? '#32D74B' : '#00C6FF') + '20' }]}>
                      <Ionicons name={data.goalMet ? 'checkmark-circle' : 'flag'} size={13} color={data.goalMet ? '#32D74B' : '#00C6FF'} />
                    </View>
                    <Text style={[styles.infoMainText, { color: textPrimary }]}>
                      Goal: {data.goalLabel}
                    </Text>
                  </View>
                  <Text style={[styles.goalProgressText, { color: data.goalMet ? '#32D74B' : '#00C6FF' }]}>
                    {data.goalMet ? '✓ Done!' : `${Math.round(goalProgress * 100)}%`}
                  </Text>
                </View>
                <View style={[styles.progressBarBg, { backgroundColor: isLight ? '#EBEBED' : '#222' }]}>
                  <View style={[styles.progressBarFill, {
                    width: `${Math.round(goalProgress * 100)}%`,
                    backgroundColor: data.goalMet ? '#32D74B' : '#00C6FF',
                  }]} />
                </View>
              </Animated.View>
            )}

            {closedLoop ? (
              loopAreaSqM !== undefined && loopAreaSqM < 100 ? (
                <View style={styles.warningBox}>
                  <View style={styles.warningIconWrap}>
                    <Ionicons name="warning" size={20} color="#FF453A" />
                  </View>
                  <Text style={styles.warningText}>
                    Loop too small ({Math.round(loopAreaSqM)}m²). Minimum 100m² required.
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => { onClose(); setTimeout(onClaim, 100); }}
                  activeOpacity={0.88}
                  style={styles.claimBtnContainer}
                >
                  <LinearGradient
                    colors={['#00C6A0', '#0A84FF']}
                    style={styles.claimBtn}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  >
                    <Ionicons name="flag" size={20} color="#FFF" />
                    <Text style={styles.claimBtnText}>CLAIM TERRITORY</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )
            ) : (
              <View style={styles.noLoopBox}>
                <View style={styles.noLoopIconWrap}>
                  <Ionicons name="information-circle" size={20} color="#FF9F0A" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.noLoopTitle}>Loop not closed</Text>
                  <Text style={styles.noLoopDesc}>
                    End within 30m of your start point to claim a territory next time.
                  </Text>
                </View>
              </View>
            )}

            <TouchableOpacity onPress={onClose} activeOpacity={0.85}>
              <View style={[styles.doneBtn, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                <Ionicons name="checkmark-circle" size={18} color={textPrimary} />
                <Text style={[styles.doneBtnText, { color: textPrimary }]}>Done</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheetContainer: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  sheet: { borderTopLeftRadius: 36, borderTopRightRadius: 36, overflow: 'hidden' },
  topStripe: { height: 4 },
  bgGradient: { position: 'absolute', top: 4, left: 0, right: 0, height: 200 },
  content: { paddingHorizontal: 22, paddingTop: 18, paddingBottom: 40 },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 22 },
  header: { marginBottom: 22, flexDirection: 'row', alignItems: 'center', gap: 14 },
  trophyContainer: { width: 56, height: 56, borderRadius: 18, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 26, fontWeight: '900', letterSpacing: -0.8, lineHeight: 30 },
  subtitle: { fontSize: 13, marginTop: 3, fontWeight: '500' },
  goalResult: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  goalResultText: { fontSize: 12, fontWeight: '800' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  statCell: { width: '31%' },
  statCard: { borderRadius: 16, padding: 12, borderWidth: 1, borderTopWidth: 2, alignItems: 'center', gap: 4 },
  statIconWrap: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 18, fontWeight: '900', letterSpacing: -0.3 },
  statUnit: { fontSize: 9, fontWeight: '800' },
  statLabel: { fontSize: 8, fontWeight: '700', letterSpacing: 0.8 },
  infoRow: { borderRadius: 16, padding: 14, marginBottom: 16, borderWidth: 1 },
  infoRowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  infoRowTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoIconWrap: { width: 24, height: 24, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  infoMainText: { fontSize: 13, fontWeight: '800' },
  xpGainText: { color: '#FFD60A', fontSize: 15, fontWeight: '900' },
  progressBarBg: { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 4 },
  goalProgressText: { fontSize: 13, fontWeight: '900' },
  warningBox: { backgroundColor: '#FF453A12', borderRadius: 16, borderWidth: 1, borderColor: '#FF453A30', padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  warningIconWrap: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#FF453A20', alignItems: 'center', justifyContent: 'center' },
  warningText: { color: '#FF453A', fontSize: 12, flex: 1, lineHeight: 18, fontWeight: '600' },
  claimBtnContainer: { borderRadius: 20, overflow: 'hidden', marginBottom: 10 },
  claimBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 18 },
  claimBtnText: { color: '#FFF', fontWeight: '900', fontSize: 16, letterSpacing: 0.5 },
  noLoopBox: { backgroundColor: '#FF9F0A12', borderRadius: 16, borderWidth: 1, borderColor: '#FF9F0A30', padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  noLoopIconWrap: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#FF9F0A20', alignItems: 'center', justifyContent: 'center' },
  noLoopTitle: { color: '#FF9F0A', fontSize: 13, fontWeight: '800', marginBottom: 2 },
  noLoopDesc: { color: '#FF9F0A', fontSize: 11, lineHeight: 16, fontWeight: '500' },
  doneBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 20, borderWidth: 1 },
  doneBtnText: { fontWeight: '700', fontSize: 15 },
});
