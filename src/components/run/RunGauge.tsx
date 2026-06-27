import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/utils/ThemeContext';

type RunGaugeProps = {
  label: string;
  value: string;
  unit: string;
  icon: string;
  color: string;
};

export default function RunGauge({ label, value, unit, icon, color }: RunGaugeProps) {
  const { T, themeName } = useTheme();
  const isLight = themeName === 'light';
  
  return (
    <View style={styles.gauge}>
      <View style={[styles.gaugeIconBox, { 
        backgroundColor: isLight ? color + '15' : color + '20', 
        borderColor: isLight ? color + '30' : 'transparent', 
        borderWidth: isLight ? 1 : 0 
      }]}>
        <Ionicons name={icon as any} size={14} color={color} />
      </View>
      <View>
        <Text style={[styles.gaugeLabel, { color: T.text }]}>{label}</Text>
        <View style={styles.gaugeValueRow}>
          <Text style={[styles.gaugeValue, { color: isLight ? '#000' : T.white }]}>{value}</Text>
          <Text style={[styles.gaugeUnit, { color: T.text }]}>{unit}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  gauge: { flex: 1, alignItems: 'center', gap: 6, flexDirection: 'row' },
  gaugeIconBox: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  gaugeLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  gaugeValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  gaugeValue: { fontSize: 22, fontWeight: '900' },
  gaugeUnit: { fontSize: 10, fontWeight: '700' },
});
