import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Animated, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

const TIER_LABELS: Record<string, string> = {
  bronze: '🥉 Bronze', silver: '🥈 Silver', gold: '🥇 Gold',
  diamond: '💎 Diamond', legendary: '🔥 Legendary', mythic: '👑 Mythic',
};

type AchievementPopup = {
  title: string;
  description: string;
  icon: string;
  tier: string;
  color: string;
  xp: number;
};

type Props = {
  popup: AchievementPopup | null;
  queueCount: number;
  onDismiss: () => void;
  onDismissAll: () => void;
};

export default function AchievementModal({ popup, queueCount, onDismiss, onDismissAll }: Props) {
  const slideAnim = useRef(new Animated.Value(120)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [currentPopup, setCurrentPopup] = useState<AchievementPopup | null>(null);

  // Animate in when popup changes
  useEffect(() => {
    if (popup) {
      // Reset and animate in
      slideAnim.setValue(100);
      opacityAnim.setValue(0);
      progressAnim.setValue(0);

      setCurrentPopup(popup);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 120, friction: 10 }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();

      // Auto-progress bar and dismiss after 4s
      Animated.timing(progressAnim, { toValue: 1, duration: 4000, useNativeDriver: false }).start();

      if (autoTimer.current) clearTimeout(autoTimer.current);
      autoTimer.current = setTimeout(() => {
        dismissOut(onDismiss);
      }, 4200);
    } else {
      dismissOut(() => setCurrentPopup(null));
    }

    return () => {
      if (autoTimer.current) clearTimeout(autoTimer.current);
    };
  }, [popup]);

  const dismissOut = (cb: () => void) => {
    if (autoTimer.current) clearTimeout(autoTimer.current);
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 120, duration: 220, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => cb());
  };

  if (!currentPopup) return null;

  const color = currentPopup.color;

  return (
    <Animated.View
      style={{
        position: 'absolute',
        bottom: 110,
        left: 16,
        right: 16,
        zIndex: 9999,
        elevation: 9999,
        opacity: opacityAnim,
        transform: [{ translateY: slideAnim }],
      }}
    >
      <View style={{
        backgroundColor: '#0F0F12',
        borderRadius: 22,
        borderWidth: 1.5,
        borderColor: color + '80',
        overflow: 'hidden',
        shadowColor: color,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 20,
        elevation: 20,
      }}>
        {/* Auto-progress bar at top */}
        <Animated.View style={{
          height: 3,
          backgroundColor: color,
          width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['100%', '0%'] }),
        }} />

        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 }}>
          {/* Icon */}
          <View style={{
            width: 52, height: 52, borderRadius: 16,
            backgroundColor: color + '20',
            borderWidth: 1.5, borderColor: color + '60',
            alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Ionicons name={currentPopup.icon as any} size={26} color={color} />
          </View>

          {/* Text */}
          <View style={{ flex: 1, gap: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <Text style={{ color: color, fontSize: 10, fontWeight: '900', letterSpacing: 1 }}>
                {TIER_LABELS[currentPopup.tier] ?? currentPopup.tier.toUpperCase()} UNLOCKED
              </Text>
              {queueCount > 1 && (
                <View style={{ backgroundColor: color + '30', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 }}>
                  <Text style={{ color, fontSize: 9, fontWeight: '900' }}>+{queueCount - 1} more</Text>
                </View>
              )}
            </View>
            <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '900' }} numberOfLines={1}>
              {currentPopup.title}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12 }} numberOfLines={1}>
              {currentPopup.description}
            </Text>
          </View>

          {/* XP + dismiss */}
          <View style={{ alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#FFD60A20', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 4 }}>
              <Ionicons name="flash" size={11} color="#FFD60A" />
              <Text style={{ color: '#FFD60A', fontSize: 12, fontWeight: '900' }}>+{currentPopup.xp}</Text>
            </View>
            <TouchableOpacity
              onPress={() => dismissOut(queueCount > 1 ? onDismiss : onDismissAll)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={20} color="rgba(255,255,255,0.3)" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Skip all button — only shows when multiple queued */}
        {queueCount > 1 && (
          <TouchableOpacity
            onPress={() => dismissOut(onDismissAll)}
            style={{
              paddingVertical: 10,
              borderTopWidth: 1,
              borderTopColor: 'rgba(255,255,255,0.06)',
              alignItems: 'center',
            }}
          >
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: '700' }}>
              Skip all {queueCount} achievements →
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
}
