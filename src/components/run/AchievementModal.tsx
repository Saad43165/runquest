import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Modal, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

function ConfettiParticle({ color, delay, startX }: { color: string; delay: number; startX: number }) {
  const y = useRef(new Animated.Value(-20)).current;
  const x = useRef(new Animated.Value(startX)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 100, useNativeDriver: true }),
        Animated.timing(y, { toValue: 400, duration: 1800, useNativeDriver: true }),
        Animated.timing(x, { toValue: startX + (Math.random() - 0.5) * 120, duration: 1800, useNativeDriver: true }),
        Animated.timing(rotate, { toValue: 6, duration: 1800, useNativeDriver: true }),
      ]),
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [delay, startX, opacity, rotate, x, y]);

  const spin = rotate.interpolate({ inputRange: [0, 6], outputRange: ['0deg', '720deg'] });
  return (
    <Animated.View style={{
      position: 'absolute', top: 0, left: 0,
      width: 8, height: 8, borderRadius: 2,
      backgroundColor: color,
      opacity,
      transform: [{ translateX: x }, { translateY: y }, { rotate: spin }],
    }} />
  );
}

const CONFETTI_COLORS = ['#32D74B', '#FFD60A', '#FF453A', '#0A84FF', '#BF5FFF', '#FF9F0A', '#00C6FF'];

type AchievementUnlockModalProps = {
  popup: { title: string; description: string; icon: string; tier: string; color: string; xp: number } | null;
  queueCount: number;
  onDismiss: () => void;
};

export default function AchievementUnlockModal({ popup, queueCount, onDismiss }: AchievementUnlockModalProps) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const iconBounce = useRef(new Animated.Value(0)).current;
  const xpBar = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const [confettiKey, setConfettiKey] = useState(0);

  useEffect(() => {
    if (popup) {
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);
      iconBounce.setValue(0);
      xpBar.setValue(0);

      Animated.sequence([
        Animated.timing(opacityAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 100, friction: 7 }),
        Animated.spring(iconBounce, { toValue: 1, useNativeDriver: true, tension: 120, friction: 5 }),
      ]).start(() => {
        Animated.timing(xpBar, { toValue: 1, duration: 800, useNativeDriver: false }).start();
      });

      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
          Animated.timing(glowAnim, { toValue: 0, duration: 1200, useNativeDriver: true }),
        ])
      ).start();

      setConfettiKey(k => k + 1);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [popup, scaleAnim, opacityAnim, iconBounce, xpBar, glowAnim]);

  if (!popup) return null;

  const iconScale = iconBounce.interpolate({ inputRange: [0, 0.5, 0.8, 1], outputRange: [0, 1.3, 0.9, 1] });

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent>
      <Animated.View style={[styles.modalOverlay, { opacity: opacityAnim }]}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {Array.from({ length: 24 }).map((_, i) => (
            <ConfettiParticle key={`ach-${confettiKey}-${i}`} color={CONFETTI_COLORS[i % CONFETTI_COLORS.length]} delay={i * 50} startX={(width / 24) * i} />
          ))}
        </View>

        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onDismiss} />

        <Animated.View style={[styles.modalCard, { borderColor: popup.color, shadowColor: popup.color, transform: [{ scale: scaleAnim }] }]}>
          <Animated.View style={[styles.glowRing, { borderColor: popup.color, opacity: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.4] }) }]} />

          {queueCount > 1 && (
            <View style={[styles.queueBadge, { backgroundColor: popup.color }]}>
              <Text style={styles.queueBadgeText}>{queueCount} NEW</Text>
            </View>
          )}

          <View style={[styles.tierBadge, { backgroundColor: popup.color + '20' }]}>
            <Ionicons name="star" size={12} color={popup.color} />
            <Text style={[styles.tierBadgeText, { color: popup.color }]}>{popup.tier.toUpperCase()} ACHIEVEMENT</Text>
          </View>

          <Animated.View style={[styles.iconContainer, { backgroundColor: popup.color + '20', borderColor: popup.color, transform: [{ scale: iconScale }] }]}>
            <Ionicons name={popup.icon as any} size={52} color={popup.color} />
          </Animated.View>

          <Text style={styles.title}>{popup.title}</Text>
          <Text style={styles.description}>{popup.description}</Text>

          <View style={styles.xpSection}>
            <View style={styles.xpRow}>
              <View style={styles.xpLabelWrap}>
                <Ionicons name="flash" size={14} color="#FFD60A" />
                <Text style={styles.xpLabel}>XP Earned</Text>
              </View>
              <Text style={styles.xpValue}>+{popup.xp} XP</Text>
            </View>
            <View style={styles.xpBarBackground}>
              <Animated.View style={[styles.xpBarFill, { width: xpBar.interpolate({ inputRange: [0, 1], outputRange: ['0%', '75%'] }) }]} />
            </View>
          </View>

          <TouchableOpacity onPress={onDismiss} activeOpacity={0.85} style={styles.dismissBtn}>
            <LinearGradient colors={[popup.color, popup.color + 'CC']} style={styles.dismissBtnGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Text style={styles.dismissBtnText}>
                {queueCount > 1 ? `NEXT (${queueCount - 1} more)` : 'AWESOME!'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.88)', alignItems: 'center', justifyContent: 'center' },
  modalCard: {
    width: width - 48, backgroundColor: '#111', borderRadius: 36,
    padding: 32, alignItems: 'center',
    borderWidth: 2,
    shadowOpacity: 0.8, shadowRadius: 40, elevation: 30,
  },
  glowRing: {
    position: 'absolute', top: -12, left: -12, right: -12, bottom: -12,
    borderRadius: 48, borderWidth: 1.5,
  },
  queueBadge: { position: 'absolute', top: 16, right: 16, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  queueBadgeText: { color: '#000', fontSize: 11, fontWeight: '900' },
  tierBadge: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 5, marginBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 6 },
  tierBadgeText: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  iconContainer: {
    width: 100, height: 100, borderRadius: 50,
    borderWidth: 3,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  title: { color: '#FFF', fontSize: 26, fontWeight: '900', textAlign: 'center', letterSpacing: -0.5, marginBottom: 8 },
  description: { color: 'rgba(255,255,255,0.6)', fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  xpSection: { width: '100%', backgroundColor: '#1C1C1E', borderRadius: 12, padding: 14, marginBottom: 24, gap: 8 },
  xpRow: { flexDirection: 'row', justifyContent: 'space-between' },
  xpLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  xpLabel: { color: '#FFF', fontSize: 12, fontWeight: '800' },
  xpValue: { color: '#FFD60A', fontSize: 14, fontWeight: '900' },
  xpBarBackground: { height: 8, backgroundColor: '#333', borderRadius: 4, overflow: 'hidden' },
  xpBarFill: { height: '100%', borderRadius: 4, backgroundColor: '#FFD60A' },
  dismissBtn: { width: '100%', borderRadius: 20, overflow: 'hidden' },
  dismissBtnGradient: { paddingVertical: 18, alignItems: 'center', justifyContent: 'center' },
  dismissBtnText: { color: '#000', fontWeight: '900', fontSize: 17 },
});
