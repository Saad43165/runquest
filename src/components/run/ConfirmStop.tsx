import React, { useState, useRef, useCallback, useEffect } from 'react';
import { TouchableOpacity, Animated, Text, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

type ConfirmStopProps = {
  onConfirm: () => void;
  disabled?: boolean;
  compact?: boolean;
};

export default function ConfirmStop({
  onConfirm,
  disabled,
  compact = false,
}: ConfirmStopProps) {
  const [armed, setArmed] = useState(false);
  const armTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const arm = useCallback(() => {
    if (disabled) return;
    if (armed) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setArmed(false);
      if (armTimerRef.current) clearTimeout(armTimerRef.current);
      onConfirm();
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setArmed(true);
    Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.08, duration: 300, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
    ])).start();
    armTimerRef.current = setTimeout(() => {
      setArmed(false);
      pulseAnim.setValue(1);
    }, 3000);
  }, [armed, disabled, onConfirm]);

  useEffect(() => () => { if (armTimerRef.current) clearTimeout(armTimerRef.current); }, []);

  if (compact) {
    return (
      <Animated.View style={{ transform: [{ scale: armed ? pulseAnim : 1 }] }}>
        <TouchableOpacity
          onPress={arm}
          disabled={disabled}
          activeOpacity={0.8}
          style={{
            backgroundColor: armed ? '#FF3B30' : '#FF3B3099',
            borderRadius: 14,
            paddingHorizontal: armed ? 10 : 12,
            paddingVertical: 11,
            marginLeft: 6,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            flexShrink: 0,
            borderWidth: armed ? 2 : 0,
            borderColor: '#FF3B30',
          }}
        >
          {disabled
            ? <ActivityIndicator color="#FFF" size="small" />
            : armed
              ? <><Ionicons name="warning" size={13} color="#FFF" /><Text style={{ color: '#FFF', fontWeight: '900', fontSize: 10 }}>CONFIRM?</Text></>
              : <><Ionicons name="stop" size={15} color="#FFF" /><Text style={{ color: '#FFF', fontWeight: '900', fontSize: 11 }}>STOP</Text></>
          }
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={{ transform: [{ scale: armed ? pulseAnim : 1 }] }}>
      <TouchableOpacity
        onPress={arm}
        disabled={disabled}
        activeOpacity={0.8}
        style={{
          width: 54, height: 54, borderRadius: 18,
          backgroundColor: armed ? '#FF3B30' : 'rgba(255,59,48,0.15)',
          borderWidth: armed ? 2 : 1.5,
          borderColor: armed ? '#FF3B30' : '#FF3B3060',
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        {disabled
          ? <ActivityIndicator color="#FF3B30" />
          : armed
            ? <Ionicons name="warning" size={22} color="#FFF" />
            : <Ionicons name="stop-circle" size={26} color="#FF3B30" />
        }
      </TouchableOpacity>
    </Animated.View>
  );
}
