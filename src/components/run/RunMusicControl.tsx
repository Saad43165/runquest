import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Marquee } from '../MusicPlayer';
import { getMusicState } from '@/hooks/useMusicStore';
import { useTheme } from '@/utils/ThemeContext';

type RunMusicControlProps = {
  musicState: any;
  insets: any;
  isVisible: boolean;
};

export default function RunMusicControl({ musicState, insets, isVisible }: RunMusicControlProps) {
  const { T } = useTheme();
  
  if (!isVisible) return null;

  return (
    <View style={[styles.container, { bottom: insets.bottom + 90 }]}>
      <View style={[styles.inner, { 
        borderColor: musicState.isPlaying ? T.green + '60' : 'rgba(255,255,255,0.15)',
      }]}>
        {/* Music icon */}
        <View style={[styles.iconBox, { backgroundColor: T.green + '20' }]}>
          <Ionicons name={musicState.isPlaying ? 'musical-notes' : 'musical-note'} size={14} color={T.green} />
        </View>

        {/* Track name — scrolling marquee */}
        <Marquee
          text={musicState.trackName || 'No music loaded'}
          style={[styles.trackText, { color: musicState.trackName ? '#DDD' : 'rgba(255,255,255,0.45)' }]}
          containerStyle={{ flex: 1 }}
        />

        {/* Waveform when playing */}
        {musicState.isPlaying && (
          <View style={styles.waveform}>
            {[0.5, 1.0, 0.6, 0.8, 0.4].map((h, i) => (
              <View key={i} style={[styles.waveBar, { height: 12 * h, backgroundColor: T.green }]} />
            ))}
          </View>
        )}

        {/* Add music button */}
        <TouchableOpacity
          onPress={() => getMusicState().onPickMusic?.()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.addBtn}
        >
          <Ionicons name="add" size={16} color="#FFF" />
        </TouchableOpacity>

        {/* Prev */}
        <TouchableOpacity onPress={() => getMusicState().onPrev?.()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="play-skip-back" size={18} color="#FFF" />
        </TouchableOpacity>

        {/* Play/Pause */}
        <TouchableOpacity
          onPress={() => { getMusicState().onToggle?.(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
          style={[styles.playBtn, { backgroundColor: T.green }]}
        >
          <Ionicons name={musicState.isPlaying ? 'pause' : 'play'} size={17} color="#000" />
        </TouchableOpacity>

        {/* Next */}
        <TouchableOpacity onPress={() => getMusicState().onNext?.()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="play-skip-forward" size={18} color="#FFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', left: 16, right: 16, zIndex: 500 },
  inner: { backgroundColor: 'rgba(10,10,10,0.94)', borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBox: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  trackText: { fontSize: 11, fontWeight: '600' },
  waveform: { flexDirection: 'row', gap: 2, alignItems: 'flex-end', height: 12 },
  waveBar: { width: 2, borderRadius: 1 },
  addBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  playBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
