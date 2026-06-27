import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/utils/ThemeContext';

type RunBotHelpModalProps = {
  visible: boolean;
  onClose: () => void;
  onAskAnything: () => void;
  isLight: boolean;
  insets: any;
};

export default function RunBotHelpModal({ 
  visible, onClose, onAskAnything, isLight, insets 
}: RunBotHelpModalProps) {
  const { T } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={[styles.sheet, { backgroundColor: isLight ? '#F8F8FA' : '#0E0E10', paddingBottom: insets.bottom + 24 }]}>
          <LinearGradient colors={['#00C6FF', '#0A84FF']} style={styles.topAccent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />

          <View style={styles.content}>
            <View style={[styles.handle, { backgroundColor: isLight ? '#DDD' : '#2A2A2C' }]} />

            <View style={styles.header}>
              <LinearGradient colors={['#1A1A2E', '#0A84FF22']} style={styles.botIconWrap}>
                <Text style={{ fontSize: 22 }}>🤖</Text>
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: isLight ? '#000' : '#FFF' }]}>RunBot Tips</Text>
                <Text style={[styles.subtitle, { color: T.text }]}>Quick guide to RunQuest features</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: isLight ? '#F0F0F5' : 'rgba(255,255,255,0.08)' }]}>
                <Ionicons name="close" size={16} color={T.text} />
              </TouchableOpacity>
            </View>

            {[
              { icon: 'map-outline',           label: 'Claim Territory',   tip: 'Run a closed GPS loop — end within 30m of start',   color: '#00C6FF' },
              { icon: 'flash-outline',          label: 'Invade Enemies',    tip: 'Overlap 50%+ of enemy land with your loop',          color: '#FF453A' },
              { icon: 'locate-outline',         label: 'GPS Accuracy',      tip: 'Wait for ±20m or less before starting a run',        color: '#32D74B' },
              { icon: 'earth-outline',          label: 'Map Styles',        tip: 'Default → Dark → Satellite → 3D via map button',     color: '#FFD60A' },
              { icon: 'musical-notes-outline',  label: 'Music Player',      tip: 'Tap + in the music bar to load songs from device',   color: '#BF5FFF' },
              { icon: 'search-outline',         label: 'Map Search',        tip: 'Search icon flies the map to any location',          color: '#FF9F0A' },
              { icon: 'partly-sunny-outline',   label: 'Weather',           tip: 'Tap the weather pill for a 6-hour forecast',         color: '#5E5CE6' },
              { icon: 'trophy-outline',         label: 'Achievements',      tip: 'Badges unlock automatically — Bronze to Mythic',     color: '#FFD60A' },
              { icon: 'bug-outline',            label: 'Report a Bug',      tip: 'Tap the red bug icon in the dashboard anytime',      color: '#FF453A' },
            ].map((item, i) => (
              <View key={i} style={[styles.tipRow, { 
                backgroundColor: isLight ? '#FFF' : 'rgba(255,255,255,0.04)',
                borderColor: isLight ? '#EBEBED' : 'rgba(255,255,255,0.07)',
                borderLeftColor: item.color,
              }]}>
                <View style={[styles.tipIconWrap, { backgroundColor: item.color + '18' }]}>
                  <Ionicons name={item.icon as any} size={17} color={item.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.tipLabel, { color: isLight ? '#000' : '#FFF' }]}>{item.label}</Text>
                  <Text style={[styles.tipText, { color: T.text }]}>{item.tip}</Text>
                </View>
                <View style={[styles.tipDot, { backgroundColor: item.color }]} />
              </View>
            ))}

            <TouchableOpacity onPress={onAskAnything} activeOpacity={0.85} style={styles.askBtn}>
              <LinearGradient colors={['#00C6FF', '#0A84FF']} style={styles.askBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Ionicons name="chatbubble-ellipses" size={17} color="#000" />
                <Text style={styles.askBtnText}>Ask RunBot Anything</Text>
                <Ionicons name="arrow-forward" size={15} color="#000" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 32, borderTopRightRadius: 32, overflow: 'hidden' },
  topAccent: { height: 3 },
  content: { paddingHorizontal: 20, paddingTop: 16 },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 18 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  botIconWrap: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(0,198,255,0.4)' },
  title: { fontSize: 19, fontWeight: '900', letterSpacing: -0.3 },
  subtitle: { fontSize: 12, marginTop: 1 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 12, marginBottom: 6, borderRadius: 14, borderWidth: 1, borderLeftWidth: 3 },
  tipIconWrap: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tipLabel: { fontSize: 13, fontWeight: '800', marginBottom: 1 },
  tipText: { fontSize: 11, lineHeight: 15 },
  tipDot: { width: 6, height: 6, borderRadius: 3, opacity: 0.7 },
  askBtn: { borderRadius: 16, overflow: 'hidden', marginTop: 10 },
  askBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 15 },
  askBtnText: { color: '#000', fontWeight: '900', fontSize: 15 },
});
