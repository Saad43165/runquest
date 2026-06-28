import React, { useEffect, useRef } from 'react';
import { Modal, View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/utils/ThemeContext';

interface Props {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  icon?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  visible, title, message,
  confirmText = 'Confirm', cancelText = 'Cancel',
  destructive = false, icon = 'help-circle-outline',
  onConfirm, onCancel,
}: Props) {
  const { T, themeName } = useTheme();
  const isLight = themeName === 'light';
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 10 }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
    } else {
      scaleAnim.setValue(0.85);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  const iconColor = destructive ? T.red : T.green;
  const bg = isLight ? '#FFFFFF' : '#111111';
  const textColor = isLight ? '#000' : '#FFF';

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onCancel}>
      <Animated.View style={[styles.overlay, { opacity: opacityAnim }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onCancel} />
        <Animated.View style={[
          styles.card,
          { backgroundColor: bg, borderColor: isLight ? '#EEE' : 'rgba(255,255,255,0.1)' },
          { transform: [{ scale: scaleAnim }], opacity: opacityAnim },
        ]}>
          {/* Icon */}
          <View style={[styles.iconCircle, { backgroundColor: iconColor + '18', borderColor: iconColor + '30' }]}>
            <Ionicons name={icon as any} size={32} color={iconColor} />
          </View>

          {/* Text */}
          <Text style={[styles.title, { color: textColor }]}>{title}</Text>
          <Text style={[styles.message, { color: T.text }]}>{message}</Text>

          {/* Buttons */}
          <View style={styles.btnRow}>
            {cancelText ? (
              <TouchableOpacity
                onPress={onCancel}
                activeOpacity={0.8}
                style={[styles.cancelBtn, { backgroundColor: isLight ? '#F2F2F7' : T.card, borderColor: T.border }]}
              >
                <Text style={[styles.cancelText, { color: isLight ? '#000' : T.white }]}>{cancelText}</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              onPress={onConfirm}
              activeOpacity={0.85}
              style={[styles.confirmBtn, { overflow: 'hidden' }]}
            >
              <LinearGradient
                colors={destructive ? ['#FF453A', '#FF3B30'] : [T.green, '#00C6A0']}
                style={styles.confirmGrad}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              >
                <Text style={styles.confirmText}>{confirmText}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  card: {
    width: '100%',
    borderRadius: 28,
    borderWidth: 1,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 16,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  message: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
    opacity: 0.8,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '700',
  },
  confirmBtn: {
    flex: 1,
    height: 52,
    borderRadius: 16,
  },
  confirmGrad: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  confirmText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '900',
  },
});
