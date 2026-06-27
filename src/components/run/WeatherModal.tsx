import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Modal, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/utils/ThemeContext';
import { WeatherData, HourlyForecast } from '@/services/weatherService';

type WeatherModalProps = {
  visible: boolean;
  onClose: () => void;
  weather: WeatherData | null;
  isLight: boolean;
};

export default function WeatherModal({ visible, onClose, weather, isLight }: WeatherModalProps) {
  const { T } = useTheme();
  const slideAnim = useRef(new Animated.Value(400)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 60, friction: 12 }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      slideAnim.setValue(400);
      opacityAnim.setValue(0);
    }
  }, [visible, slideAnim, opacityAnim]);

  if (!weather) return null;

  const now = new Date();

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} />
      <Animated.View style={[styles.sheetContainer, { transform: [{ translateY: slideAnim }], opacity: opacityAnim }]}>
        <View style={[styles.sheet, { backgroundColor: isLight ? '#FFF' : '#111', borderColor: isLight ? '#EEE' : 'rgba(255,255,255,0.1)' }]}>
          <View style={[styles.handle, { backgroundColor: isLight ? '#DDD' : '#333' }]} />

          <View style={styles.header}>
            <View>
              <Text style={[styles.temp, { color: isLight ? '#000' : '#FFF' }]}>{weather.temperature}°C</Text>
              <Text style={[styles.condition, { color: T.text }]}>{weather.condition}</Text>
              <Text style={[styles.date, { color: T.text }]}>
                {now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
              </Text>
              <Text style={[styles.time, { color: T.text }]}>
                {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
            <Ionicons name={weather.icon as any} size={64} color={T.accent2} />
          </View>

          <View style={styles.statsRow}>
            {[
              { icon: 'water-outline', label: 'Humidity', value: `${weather.humidity}%` },
              { icon: 'speedometer-outline', label: 'Wind', value: `${weather.windSpeed} km/h` },
              { icon: 'thermometer-outline', label: 'Feels Like', value: `${weather.feelsLike}°C` },
              { icon: 'sunny-outline', label: 'UV Index', value: String(weather.uvIndex) },
            ].map(stat => (
              <View key={stat.label} style={[styles.statItem, { backgroundColor: isLight ? '#F5F5F5' : '#1C1C1E' }]}>
                <Ionicons name={stat.icon as any} size={18} color={T.accent2} />
                <Text style={[styles.statValue, { color: isLight ? '#000' : '#FFF' }]}>{stat.value}</Text>
                <Text style={[styles.statLabel, { color: T.text }]}>{stat.label.toUpperCase()}</Text>
              </View>
            ))}
          </View>

          {weather.hourly && weather.hourly.length > 0 && (
            <>
              <Text style={[styles.forecastTitle, { color: T.text }]}>NEXT 6 HOURS</Text>
              <View style={styles.forecastRow}>
                {weather.hourly.map((h: HourlyForecast, i: number) => (
                  <View key={i} style={[styles.forecastItem, { backgroundColor: isLight ? '#F5F5F5' : '#1C1C1E' }]}>
                    <Text style={[styles.forecastTime, { color: T.text }]}>{h.time}</Text>
                    <Ionicons name={h.icon as any} size={18} color={T.accent2} />
                    <Text style={[styles.forecastTemp, { color: isLight ? '#000' : '#FFF' }]}>{h.temperature}°</Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheetContainer: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40, borderWidth: 1 },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  temp: { fontSize: 28, fontWeight: '900' },
  condition: { fontSize: 14, marginTop: 2 },
  date: { fontSize: 12, marginTop: 4 },
  time: { fontSize: 12 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  statItem: { flex: 1, borderRadius: 14, padding: 12, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 13, fontWeight: '800' },
  statLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  forecastTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: 12 },
  forecastRow: { flexDirection: 'row', gap: 8 },
  forecastItem: { flex: 1, borderRadius: 14, padding: 10, alignItems: 'center', gap: 6 },
  forecastTime: { fontSize: 10, fontWeight: '700' },
  forecastTemp: { fontSize: 13, fontWeight: '800' },
});
