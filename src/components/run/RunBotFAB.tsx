import React from 'react';
import { View, Text, StyleSheet, Animated, Modal, TouchableOpacity, PanResponder } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/utils/ThemeContext';

type RunBotFABProps = {
  visible: boolean;
  onPress: () => void;
  botPosition: Animated.ValueXY;
  botPanResponder: any;
  pulseAnim: Animated.Value;
  insets: any;
};

export default function RunBotFAB({ 
  visible, onPress, botPosition, botPanResponder, pulseAnim, insets 
}: RunBotFABProps) {
  if (!visible) return null;

  return (
    <Animated.View
      style={[styles.botFab, { 
        bottom: insets.bottom + 100, 
        right: 16, 
        transform: botPosition.getTranslateTransform() 
      }]}
      {...botPanResponder.panHandlers}
    >
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.88}
        style={styles.botFabBtn}
      >
        <Animated.View style={[styles.botFabHalo, { transform: [{ scale: pulseAnim }] }]} />
        <LinearGradient
          colors={['#1A1A2E', '#16213E']}
          style={styles.botFabInner}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        >
          <View style={styles.botFabIconRow}>
            <Text style={{ fontSize: 16 }}>🤖</Text>
            <View style={styles.botFabOnlineDot} />
          </View>
          <View>
            <Text style={styles.botFabTitle}>RunBot</Text>
            <Text style={styles.botFabSub}>Tap to ask</Text>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  botFab: { position: 'absolute', zIndex: 200, elevation: 200 },
  botFabHalo: { position: 'absolute', width: 80, height: 50, borderRadius: 25, backgroundColor: '#00FF8715', top: -5, left: -5 },
  botFabBtn: { borderRadius: 22, overflow: 'hidden' },
  botFabInner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 22, borderWidth: 1, borderColor: '#00FF8740' },
  botFabIconRow: { position: 'relative' },
  botFabOnlineDot: { position: 'absolute', width: 7, height: 7, borderRadius: 4, backgroundColor: '#00FF87', top: -1, right: -2, borderWidth: 1, borderColor: '#16213E' },
  botFabTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '900', letterSpacing: 0.2 },
  botFabSub: { color: '#00FF87', fontSize: 9, fontWeight: '700', letterSpacing: 0.3 },
});
