import React, { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
  Dimensions, Modal,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/utils/ThemeContext';

const { width } = Dimensions.get('window');

interface MusicWarningDialogProps {
  visible: boolean;
  onStopAndTurnOff: () => void;
  onCancel: () => void;
}

export function MusicWarningDialog({ visible, onStopAndTurnOff, onCancel }: MusicWarningDialogProps) {
  const { T, themeName } = useTheme();
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const iconBounce = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 120, friction: 8 }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();

      // Bounce the music icon
      Animated.loop(
        Animated.sequence([
          Animated.timing(iconBounce, { toValue: -6, duration: 400, useNativeDriver: true }),
          Animated.timing(iconBounce, { toValue: 0, duration: 400, useNativeDriver: true }),
        ])
      ).start();
    } else {
      scaleAnim.setValue(0.85);
      opacityAnim.setValue(0);
      iconBounce.setValue(0);
    }
  }, [visible]);

  return (
    <Modal transparent visible={visible} animationType="none" statusBarTranslucent onRequestClose={onCancel}>
      <Animated.View style={[styles.overlay, { opacity: opacityAnim }]}>
        {/* Blur backdrop */}
        <BlurView
          tint={themeName === 'light' ? 'light' : 'dark'}
          intensity={40}
          style={StyleSheet.absoluteFill}
        />
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onCancel} />

        <Animated.View style={[
          styles.dialog,
          { backgroundColor: themeName === 'light' ? '#FFF' : '#1A1A1A', borderColor: T.border },
          { transform: [{ scale: scaleAnim }], opacity: opacityAnim },
        ]}>
          {/* Top accent bar */}
          <View style={[styles.accentBar, { backgroundColor: '#FF2D55' }]} />

          {/* Icon */}
          <Animated.View style={[
            styles.iconWrap,
            { backgroundColor: '#FF2D5520', borderColor: '#FF2D5540', alignSelf: 'center' },
            { transform: [{ translateY: iconBounce }] },
          ]}>
            <Ionicons name="musical-notes" size={32} color="#FF2D55" />
          </Animated.View>

          {/* Title */}
          <Text style={[styles.title, { color: themeName === 'light' ? '#000' : T.white }]}>
            Music is Playing
          </Text>

          {/* Message */}
          <Text style={[styles.message, { color: T.text }]}>
            A song is currently playing. You need to stop the music before hiding the music player.
          </Text>

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: T.border }]} />

          {/* Buttons */}
          <TouchableOpacity
            style={[styles.stopBtn, { backgroundColor: '#FF2D55' }]}
            onPress={onStopAndTurnOff}
            activeOpacity={0.85}
          >
            <Ionicons name="stop-circle" size={18} color="#FFF" />
            <Text style={styles.stopBtnText}>Stop Music & Turn Off</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.cancelBtn, { backgroundColor: T.card, borderColor: T.border }]}
            onPress={onCancel}
            activeOpacity={0.8}
          >
            <Text style={[styles.cancelBtnText, { color: T.text }]}>Keep Playing</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  dialog: {
    width: Math.min(width - 40, 360),
    borderRadius: 28,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'stretch',
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 10 },
    elevation: 20,
  },
  accentBar: {
    width: '100%',
    height: 4,
    marginBottom: 28,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.3,
    marginBottom: 10,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  message: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    paddingHorizontal: 28,
    marginBottom: 24,
    opacity: 0.8,
  },
  divider: {
    width: '100%',
    height: StyleSheet.hairlineWidth,
    marginBottom: 20,
  },
  stopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'stretch',
    marginHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 16,
    justifyContent: 'center',
    marginBottom: 10,
  },
  stopBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
  cancelBtn: {
    alignSelf: 'stretch',
    marginHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
