import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/utils/ThemeContext';
import { getHistory } from '../../services/history';

type LastRunBarProps = {
  isMetric: boolean;
  isLight: boolean;
};

export default function LastRunBar({ isMetric, isLight }: LastRunBarProps) {
  const { T } = useTheme();
  const [last, setLast] = useState<{ dist: string; dur: string; pace: string } | null>(null);

  useEffect(() => {
    getHistory().then(h => {
      if (h.length === 0) return;
      const r = h[0];
      const mult = isMetric ? 1000 : 1609.34;
      const unit = isMetric ? 'km' : 'mi';
      const dist = `${(r.distanceMeters / mult).toFixed(2)} ${unit}`;
      const m = Math.floor(r.durationSec / 60);
      const s = r.durationSec % 60;
      const dur = `${m}:${s < 10 ? '0' : ''}${s}`;
      const pMin = r.durationSec > 0 && r.distanceMeters > 100
        ? (r.durationSec / 60) / (r.distanceMeters / 1000) : 0;
      const pace = pMin > 0 && pMin < 30
        ? `${Math.floor(pMin)}:${String(Math.round((pMin % 1) * 60)).padStart(2, '0')}/km` : '--';
      setLast({ dist, dur, pace });
    }).catch(() => {});
  }, [isMetric]);

  if (!last) {
    return (
      <View style={styles.container}>
        <Ionicons name="footsteps-outline" size={14} color={T.text} />
        <Text style={[styles.emptyText, { color: T.text }]}>No runs yet — tap START RUN!</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: T.text }]}>LAST RUN</Text>
      <View style={[styles.vLine, { backgroundColor: isLight ? '#DDD' : 'rgba(255,255,255,0.12)' }]} />
      <Ionicons name="walk-outline" size={11} color={T.green} />
      <Text style={[styles.value, { color: isLight ? '#000' : '#FFF' }]}>{last.dist}</Text>
      <View style={[styles.vLine, { backgroundColor: isLight ? '#DDD' : 'rgba(255,255,255,0.12)' }]} />
      <Ionicons name="time-outline" size={11} color="#00C6FF" />
      <Text style={[styles.value, { color: isLight ? '#000' : '#FFF' }]}>{last.dur}</Text>
      {last.pace !== '--' && (
        <>
          <View style={[styles.vLine, { backgroundColor: isLight ? '#DDD' : 'rgba(255,255,255,0.12)' }]} />
          <Ionicons name="speedometer-outline" size={11} color={T.accent2} />
          <Text style={[styles.value, { color: isLight ? '#000' : '#FFF' }]}>{last.pace}</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, paddingVertical: 6 },
  emptyText: { fontSize: 11, fontWeight: '500' },
  label: { fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  vLine: { width: 1, height: 12 },
  value: { fontSize: 12, fontWeight: '800' },
});
