/**
 * ToastService.tsx
 * Global in-app toast system for RunQuest.
 * Non-blocking, auto-dismissing, premium dark glass design.
 * Usage anywhere: ToastService.show({ title, message, type })
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, Animated, StyleSheet, Dimensions, TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

// ─── Types ────────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'conquest' | 'achievement';

export type ToastOptions = {
  title: string;
  message?: string;
  type?: ToastType;
  duration?: number; // ms, default 3500
  icon?: string;     // Ionicons name override
};

type ToastItem = ToastOptions & {
  id: number;
};

// ─── Config per type ─────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<ToastType, { color: string; icon: string; bg: string }> = {
  success:     { color: '#32D74B', icon: 'checkmark-circle',     bg: 'rgba(50,215,75,0.12)'    },
  error:       { color: '#FF453A', icon: 'close-circle',         bg: 'rgba(255,69,58,0.12)'    },
  warning:     { color: '#FF9F0A', icon: 'warning',              bg: 'rgba(255,159,10,0.12)'   },
  info:        { color: '#0A84FF', icon: 'information-circle',   bg: 'rgba(10,132,255,0.12)'   },
  conquest:    { color: '#FFD60A', icon: 'trophy',               bg: 'rgba(255,214,10,0.12)'   },
  achievement: { color: '#BF5FFF', icon: 'medal',                bg: 'rgba(191,95,255,0.12)'   },
};

// ─── Event bus ───────────────────────────────────────────────────────────────

type Listener = (toast: ToastItem) => void;
const listeners: Set<Listener> = new Set();
let idCounter = 0;

function emit(toast: ToastItem) {
  listeners.forEach(l => l(toast));
}

export const ToastService = {
  show(options: ToastOptions) {
    emit({ ...options, id: ++idCounter, type: options.type ?? 'info' });
  },
};

// ─── Single toast card ────────────────────────────────────────────────────────

function ToastCard({
  item,
  onDone,
}: {
  item: ToastItem;
  onDone: (id: number) => void;
}) {
  const config = TYPE_CONFIG[item.type ?? 'info'];
  const icon = item.icon ?? config.icon;
  const duration = item.duration ?? 3500;

  const translateY = useRef(new Animated.Value(-90)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    Animated.parallel([
      Animated.timing(translateY, { toValue: -90, duration: 260, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(() => onDone(item.id));
  }, [item.id, onDone, translateY, opacity]);

  useEffect(() => {
    // Slide in
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 110, friction: 11 }),
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();

    // Progress bar drains over `duration`
    Animated.timing(progress, {
      toValue: 0,
      duration,
      useNativeDriver: false,
    }).start();

    timerRef.current = setTimeout(dismiss, duration);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  return (
    <Animated.View style={[styles.card, { opacity, transform: [{ translateY }] }]}>
      <TouchableOpacity activeOpacity={0.92} onPress={dismiss} style={styles.cardInner}>
        {/* Left accent bar */}
        <View style={[styles.accentBar, { backgroundColor: config.color }]} />

        {/* Icon */}
        <View style={[styles.iconWrap, { backgroundColor: config.bg }]}>
          <Ionicons name={icon as any} size={20} color={config.color} />
        </View>

        {/* Text */}
        <View style={styles.textBlock}>
          <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
          {item.message ? (
            <Text style={styles.message} numberOfLines={2}>{item.message}</Text>
          ) : null}
        </View>

        {/* Dismiss */}
        <Ionicons name="close" size={15} color="rgba(255,255,255,0.25)" style={{ marginLeft: 4 }} />
      </TouchableOpacity>

      {/* Progress drain bar */}
      <Animated.View style={[
        styles.progressBar,
        { backgroundColor: config.color, width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
      ]} />
    </Animated.View>
  );
}

// ─── Toast container — mount once at app root ─────────────────────────────────

export function ToastContainer() {
  const insets = useSafeAreaInsets();
  const [queue, setQueue] = useState<ToastItem[]>([]);

  useEffect(() => {
    const listener: Listener = (toast) => {
      setQueue(prev => {
        // Cap at 3 visible toasts — oldest drops off
        const next = [...prev, toast];
        return next.slice(-3);
      });
    };
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);

  const remove = useCallback((id: number) => {
    setQueue(prev => prev.filter(t => t.id !== id));
  }, []);

  if (queue.length === 0) return null;

  return (
    <View
      style={[styles.container, { top: insets.top + 8 }]}
      pointerEvents="box-none"
    >
      {queue.map(item => (
        <ToastCard key={item.id} item={item} onDone={remove} />
      ))}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 14,
    right: 14,
    zIndex: 99999,
    elevation: 99999,
    gap: 8,
  },
  card: {
    backgroundColor: 'rgba(14,14,18,0.97)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 14,
  },
  cardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 10,
  },
  accentBar: {
    width: 3,
    height: '100%',
    borderRadius: 2,
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    flexShrink: 0,
  },
  textBlock: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: -0.1,
  },
  message: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    lineHeight: 16,
  },
  progressBar: {
    height: 2,
    borderRadius: 1,
  },
});
