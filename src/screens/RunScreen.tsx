import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Alert, Animated, Dimensions, StyleSheet, Platform, ActivityIndicator, Modal, Image, ScrollView, PanResponder } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapRunView from '../components/MapRunView';
import { useRunTracker } from '../hooks/useRunTracker';
import { Territory } from '../types';
import { subscribeTerritories, claimAndConquerRemote } from '../services/territoriesRemote';
import { pathDistance } from '../utils/geometry';
import { getSettings, Settings } from '../config/settings';
import { useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/utils/ThemeContext';
import { NotificationService } from '../services/notificationService';
import { fetchLocalWeather, WeatherData } from '../services/weatherService';
import { fetchMotivationalQuote, QuoteData } from '../services/quoteService';
import { useNavigation } from '@react-navigation/native';
const { width } = Dimensions.get('window');

// ─── Sub-components ───────────────────────────────────────────────────────────

function Gauge({ label, value, unit, icon, color }: { label: string; value: string; unit: string; icon: string; color: string }) {
  const { T, themeName } = useTheme();
  const isLight = themeName === 'light';
  return (
    <View style={styles.gauge}>
      <View style={[styles.gaugeIconBox, { backgroundColor: isLight ? color + '15' : color + '20', borderColor: isLight ? color + '30' : 'transparent', borderWidth: isLight ? 1 : 0 }]}>
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

function SummaryModal({ visible, onClose, data, isLight, closedLoop, onClaim }: { visible: boolean; onClose: () => void; data: any; isLight: boolean; closedLoop: boolean; onClaim: () => void }) {
  const { T } = useTheme();
  const slideAnim = useRef(new Animated.Value(300)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 50, friction: 9 }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!data) return null;

  return (
    <Modal visible={visible} transparent animationType="none">
      <View style={styles.modalOverlay}>
        <Animated.View style={[{ transform: [{ translateY: slideAnim }], opacity: opacityAnim }, { width: '100%' }]}>
          <View style={[styles.summaryCard, { backgroundColor: isLight ? 'rgba(255,255,255,0.98)' : 'rgba(20,20,20,0.98)' }]}>
            <Ionicons name="trophy" size={60} color={T.gold || '#FFD700'} style={{ alignSelf: 'center', marginBottom: 20 }} />
            <Text style={[styles.summaryTitle, { color: isLight ? '#000' : '#FFF' }]}>RUN FINISHED!</Text>
            
            <View style={styles.summaryGrid}>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryLabel, { color: T.text }]}>DISTANCE</Text>
                <Text style={[styles.summaryValue, { color: isLight ? '#000' : '#FFF' }]}>{data.distance} {data.unit}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryLabel, { color: T.text }]}>DURATION</Text>
                <Text style={[styles.summaryValue, { color: isLight ? '#000' : '#FFF' }]}>{data.time}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryLabel, { color: T.text }]}>PACE</Text>
                <Text style={[styles.summaryValue, { color: isLight ? '#000' : '#FFF' }]}>{data.pace > 0 ? data.pace.toFixed(2) : '--'}</Text>
                <Text style={[styles.summaryLabel, { color: T.text }]}>MIN/KM</Text>
              </View>
            </View>

            {/* Loop status — shown inside summary */}
            {closedLoop ? (
              <TouchableOpacity
                onPress={() => { onClose(); setTimeout(onClaim, 100); }}
                activeOpacity={0.85}
                style={{ marginTop: 20, borderRadius: 16, backgroundColor: T.green, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}
              >
                <Ionicons name="flag" size={20} color="#000" />
                <Text style={{ color: '#000', fontWeight: '900', fontSize: 15 }}>CLAIM TERRITORY</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ marginTop: 20, borderRadius: 16, backgroundColor: T.orange + '18', borderWidth: 1, borderColor: T.orange + '40', padding: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <Ionicons name="information-circle" size={18} color={T.orange} />
                  <Text style={{ color: T.orange, fontWeight: '800', fontSize: 13 }}>No Closed Loop</Text>
                </View>
                <Text style={{ color: T.text, fontSize: 12, lineHeight: 18 }}>
                  To claim territory, run a loop where your end point is within 30m of your start point, with at least 500m total distance.
                </Text>
              </View>
            )}

            <TouchableOpacity
              onPress={onClose}
              activeOpacity={0.8}
              style={{ marginTop: 16, height: 56, borderRadius: 16, backgroundColor: isLight ? '#F2F2F7' : T.card, borderWidth: 1, borderColor: isLight ? '#DDD' : T.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              <Ionicons name="checkmark-circle" size={20} color={T.text} />
              <Text style={{ color: isLight ? '#000' : T.white, fontWeight: '800', fontSize: 15 }}>Done</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── Weather Modal ────────────────────────────────────────────────────────────

function WeatherModal({ visible, onClose, weather, isLight }: { visible: boolean; onClose: () => void; weather: WeatherData | null; isLight: boolean }) {
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
  }, [visible]);

  if (!weather) return null;

  const now = new Date();

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} activeOpacity={1} onPress={onClose} />
      <Animated.View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        transform: [{ translateY: slideAnim }],
        opacity: opacityAnim,
      }}>
        <View style={{
          backgroundColor: isLight ? '#FFF' : '#111',
          borderTopLeftRadius: 28, borderTopRightRadius: 28,
          padding: 24, paddingBottom: 40,
          borderWidth: 1, borderColor: isLight ? '#EEE' : 'rgba(255,255,255,0.1)',
        }}>
          {/* Handle */}
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: isLight ? '#DDD' : '#333', alignSelf: 'center', marginBottom: 20 }} />

          {/* Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
            <View>
              <Text style={{ color: isLight ? '#000' : '#FFF', fontSize: 28, fontWeight: '900' }}>{weather.temperature}°C</Text>
              <Text style={{ color: T.text, fontSize: 14, marginTop: 2 }}>{weather.condition}</Text>
              <Text style={{ color: T.text, fontSize: 12, marginTop: 4 }}>{now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
              <Text style={{ color: T.text, fontSize: 12 }}>{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
            </View>
            <Ionicons name={weather.icon as any} size={64} color={T.accent2} />
          </View>

          {/* Stats row */}
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
            {[
              { icon: 'water-outline', label: 'Humidity', value: `${weather.humidity}%` },
              { icon: 'speedometer-outline', label: 'Wind', value: `${weather.windSpeed} km/h` },
              { icon: 'thermometer-outline', label: 'Feels Like', value: `${weather.feelsLike}°C` },
              { icon: 'sunny-outline', label: 'UV Index', value: String(weather.uvIndex) },
            ].map(stat => (
              <View key={stat.label} style={{ flex: 1, backgroundColor: isLight ? '#F5F5F5' : '#1C1C1E', borderRadius: 14, padding: 12, alignItems: 'center', gap: 4 }}>
                <Ionicons name={stat.icon as any} size={18} color={T.accent2} />
                <Text style={{ color: isLight ? '#000' : '#FFF', fontSize: 13, fontWeight: '800' }}>{stat.value}</Text>
                <Text style={{ color: T.text, fontSize: 9, fontWeight: '700', letterSpacing: 0.5 }}>{stat.label.toUpperCase()}</Text>
              </View>
            ))}
          </View>

          {/* 6-hour forecast */}
          {weather.hourly && weather.hourly.length > 0 && (
            <>
              <Text style={{ color: T.text, fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: 12 }}>NEXT 6 HOURS</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {weather.hourly.map((h, i) => (
                  <View key={i} style={{ flex: 1, backgroundColor: isLight ? '#F5F5F5' : '#1C1C1E', borderRadius: 14, padding: 10, alignItems: 'center', gap: 6 }}>
                    <Text style={{ color: T.text, fontSize: 10, fontWeight: '700' }}>{h.time}</Text>
                    <Ionicons name={h.icon as any} size={18} color={T.accent2} />
                    <Text style={{ color: isLight ? '#000' : '#FFF', fontSize: 13, fontWeight: '800' }}>{h.temperature}°</Text>
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

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function RunScreen() {
  const { T, themeName } = useTheme();
  const isLight = themeName === 'light';
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const isFocused = useIsFocused();
  const { state, path, region, accuracyMeters, headingDeg, altitudeMeters, startRun, pauseRun, resumeRun, stopRun, reset, recenter, closedLoop, isSaving } = useRunTracker();

  const prevClosedLoop = useRef<boolean>(false);
  const [showLoopToast, setShowLoopToast] = useState(false);

  const [territories, setTerritories] = useState<Territory[]>([]);
  const [showPolygons, setShowPolygons] = useState(true);
  const [showPath, setShowPath] = useState(true);
  const [tileStyle, setTileStyle] = useState<'default' | 'dark'>(themeName === 'light' ? 'default' : 'dark');
  const [elapsed, setElapsed] = useState(0);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [locationName, setLocationName] = useState<string | null>(null);
  
  const [summary, setSummary] = useState<any | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [showWeatherModal, setShowWeatherModal] = useState(false);
  const [showBotHelp, setShowBotHelp] = useState(false);

  const dashAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const botPosition = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const botPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 5 || Math.abs(gs.dy) > 5,
      onPanResponderGrant: () => {
        botPosition.setOffset({ x: (botPosition.x as any)._value, y: (botPosition.y as any)._value });
        botPosition.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event([null, { dx: botPosition.x, dy: botPosition.y }], { useNativeDriver: false }),
      onPanResponderRelease: (_, gs) => {
        botPosition.flattenOffset();
        if (Math.abs(gs.dx) < 5 && Math.abs(gs.dy) < 5) {
          setShowBotHelp(true);
        }
      },
    })
  ).current;

  // Pulse animation for running state
  useEffect(() => {
    if (state === 'running') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.1, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [state]);

  // Dashboard entrance — only on first mount
  useEffect(() => {
    Animated.spring(dashAnim, { toValue: 1, useNativeDriver: true, tension: 40, friction: 8 }).start();
  }, []);

  // Reload settings when screen comes into focus (picks up RunBot toggle changes)
  useEffect(() => {
    if (isFocused) {
      getSettings().then(s => setSettings(s));
    }
  }, [isFocused]);

  // Timer logic
  useEffect(() => {
    let timer: any;
    if (state === 'running') {
      timer = setInterval(() => setElapsed(e => e + 1), 1000);
    }
    return () => clearInterval(timer);
  }, [state]);

  // Initial setup & logic connectivity
  useEffect(() => {
    let unsub: any;
    (async () => {
      const s = await getSettings();
      setSettings(s);
      setShowPolygons(s.defaultShowPolygons);
      setShowPath(s.defaultShowPath);
      setTileStyle(s.tileStyle);
      NotificationService.requestPermissions();
      unsub = await subscribeTerritories(list => setTerritories(list));
    })();
    return () => unsub && unsub();
  }, []);

  // Fetch weather when region is available (only once)
  useEffect(() => {
    if (region && !weather) {
      fetchLocalWeather(region.latitude, region.longitude).then(data => {
        if (data) setWeather(data);
      });
    }
    // Reverse geocode for human-readable location name
    if (region && !locationName) {
      fetch(`https://nominatim.openstreetmap.org/reverse?lat=${region.latitude}&lon=${region.longitude}&format=json`, {
        headers: { 'User-Agent': 'RunQuestApp/1.0' }
      })
        .then(r => r.json())
        .then(d => {
          const addr = d?.address;
          if (addr) {
            const name = addr.suburb || addr.neighbourhood || addr.city_district || addr.town || addr.village || addr.city || addr.county || addr.state;
            if (name) setLocationName(name);
          }
        })
        .catch(() => {});
    }
  }, [region]);

  // Fetch quote when idle
  useEffect(() => {
    if (state === 'idle' && !quote) {
      fetchMotivationalQuote().then(data => {
        if (data) setQuote(data);
      });
    }
  }, [state]);

  // Closed loop haptic + toast
  useEffect(() => {
    if (closedLoop && !prevClosedLoop.current) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowLoopToast(true);
      setTimeout(() => setShowLoopToast(false), 2500);
    }
    prevClosedLoop.current = closedLoop;
  }, [closedLoop]);

  const onClaim = async () => {
    if (!closedLoop) return;
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const res = await claimAndConquerRemote(`Territory ${new Date().toLocaleTimeString()}`, path);
      if (res) {
        NotificationService.notify('🏆 TERRITORY CLAIMED', `You secured ${Math.round(res.claimed.areaSqMeters)}m² of domain.`);
        reset();
      }
    } catch (e: any) { Alert.alert('Claim Failed', e.message); }
  };

  const isMetric = settings?.units !== 'imperial';
  const displayDist = pathDistance(path);
  const distVal = isMetric ? (displayDist / 1000).toFixed(2) : (displayDist / 1609.34).toFixed(2);
  const pace = displayDist > 0 && elapsed > 0 ? (elapsed / 60) / (displayDist / (isMetric ? 1000 : 1609.34)) : 0;
  
  const formatTime = (s: number) => {
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  };

  const handleStop = async () => {
    const dist = distVal;
    const time = formatTime(elapsed);
    const unit = isMetric ? 'KM' : 'MI';
    const paceVal = elapsed > 0 && parseFloat(distVal) > 0 ? (elapsed / 60) / parseFloat(distVal) : 0;
    await stopRun();
    setSummary({ distance: dist, time, unit, pace: paceVal });
    setShowSummary(true);
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.black }}>
      {/* Map */}
      <MapRunView 
        region={region} path={path} 
        polygons={territories.map(t => ({ points: t.polygon, color: t.color }))}
        showPolygons={showPolygons} showPath={showPath} tileStyle={tileStyle}
        accuracyMeters={accuracyMeters} headingDeg={headingDeg}
      />

      <SummaryModal 
        visible={showSummary} 
        data={summary} 
        isLight={isLight}
        closedLoop={closedLoop}
        onClaim={onClaim}
        onClose={() => { setShowSummary(false); setElapsed(0); reset(); }} 
      />

      <WeatherModal visible={showWeatherModal} onClose={() => setShowWeatherModal(false)} weather={weather} isLight={isLight} />

      {/* Overlay — only loop toast + header, box-none so touches pass through */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {showLoopToast && (
          <View style={[styles.loopToast, { backgroundColor: T.green + '15', borderColor: T.green + '40' }]}>
            <Text style={[styles.loopToastText, { color: T.green }]}>🔒 Loop Closed!</Text>
          </View>
        )}
        {/* Header Panel */}
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
           <View style={[styles.headerBlur, { backgroundColor: isLight ? 'rgba(255,255,255,0.95)' : 'rgba(15,15,15,0.92)', borderColor: isLight ? '#DDD' : 'rgba(255,255,255,0.12)', borderWidth: 1 }]}>
              <View style={styles.headerTop}>
                 <View style={[styles.statusBlock, { backgroundColor: isLight ? '#F2F2F7' : 'rgba(0,0,0,0.5)' }]}>
                    <Animated.View style={[styles.statusDot, { backgroundColor: state === 'running' ? T.green : T.orange, transform: [{ scale: pulseAnim }] }]} />
                    <Text style={[styles.statusText, { color: isLight ? '#000' : '#FFF' }]}>{state === 'idle' ? 'READY' : state.toUpperCase()}</Text>
                 </View>
                 <Text style={[styles.timer, { color: isLight ? '#000' : '#FFF' }]}>{formatTime(elapsed)}</Text>
              </View>
              <View style={styles.headerBottom}>
                 <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 6 }}>
                   <Ionicons name="location-sharp" size={14} color={T.green} />
                   <Text style={[styles.locationText, { color: T.text }]} numberOfLines={1}>
                     {locationName
                       ? locationName
                       : region
                         ? `${region.latitude.toFixed(4)}, ${region.longitude.toFixed(4)}`
                         : state === 'idle' ? 'Awaiting GPS...' : 'Acquiring GPS...'
                     }
                   </Text>
                 </View>
                 {weather && (
                   <TouchableOpacity
                     onPress={() => setShowWeatherModal(true)}
                     style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: isLight ? '#F2F2F7' : 'rgba(255,255,255,0.12)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 }}
                     activeOpacity={0.8}
                   >
                     <Ionicons name={weather.icon as any} size={13} color={T.accent2} />
                     <Text style={{ fontSize: 12, fontWeight: '700', color: isLight ? '#000' : '#FFF' }}>{weather.temperature}°C</Text>
                     <Ionicons name="chevron-up" size={10} color={T.text} />
                   </TouchableOpacity>
                 )}
                 {accuracyMeters !== null && (
                   <Text style={[styles.accuracyText, { color: T.green }]}>±{Math.round(accuracyMeters)}m</Text>
                 )}
                 {accuracyMeters !== null && accuracyMeters > 20 && (
                   <View style={{ backgroundColor: '#FF9F0A20', borderWidth: 1, borderColor: '#FF9F0A50', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                     <Text style={{ color: '#FF9F0A', fontSize: 10, fontWeight: '800' }}>⚠ Poor GPS</Text>
                   </View>
                 )}
              </View>
           </View>
        </View>
      </View>

      {/* Toolbar — direct child of root, always pressable */}
      <View style={[styles.toolBar, { top: insets.top + 160, right: 16 }]}>
        <TouchableOpacity onPress={() => setShowPolygons(!showPolygons)} style={[styles.toolBtn, { backgroundColor: showPolygons ? T.green + '20' : isLight ? '#FFF' : 'rgba(0,0,0,0.6)', borderColor: isLight ? '#DDD' : 'rgba(255,255,255,0.1)' }]}>
          <Ionicons name={showPolygons ? "map" : "map-outline"} size={22} color={showPolygons ? T.green : isLight ? '#000' : '#FFF'} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setTileStyle(tileStyle === 'dark' ? 'default' : 'dark')} style={[styles.toolBtn, { backgroundColor: isLight ? '#FFF' : 'rgba(0,0,0,0.6)', borderColor: isLight ? '#DDD' : 'rgba(255,255,255,0.1)' }]}>
          <Ionicons name={tileStyle === 'dark' ? "sunny-outline" : "moon-outline"} size={22} color={isLight ? '#000' : '#FFF'} />
        </TouchableOpacity>
        <TouchableOpacity onPress={recenter} style={[styles.toolBtn, { backgroundColor: isLight ? '#FFF' : 'rgba(0,0,0,0.6)', borderColor: isLight ? '#DDD' : 'rgba(255,255,255,0.1)' }]}>
          <Ionicons name="locate" size={22} color={isLight ? '#000' : '#FFF'} />
        </TouchableOpacity>
      </View>

      {/* Dashboard — direct child of root, always pressable */}
      <Animated.View style={[styles.dashboard, { transform: [{ translateY: dashAnim.interpolate({ inputRange: [0, 1], outputRange: [200, 0] }) }] }]}>
         <View style={[styles.dashBlur, { backgroundColor: isLight ? 'rgba(255,255,255,0.97)' : 'rgba(12,12,12,0.94)', borderColor: isLight ? '#DDD' : 'rgba(255,255,255,0.12)', borderWidth: 1, paddingBottom: insets.bottom + 90 }]}>
            {state === 'idle' && quote && (
               <View style={{ marginBottom: 20, paddingHorizontal: 10 }}>
                 <Text style={{ color: isLight ? '#555' : '#CCC', fontStyle: 'italic', fontSize: 13, textAlign: 'center' }}>"{quote.text}"</Text>
                 <Text style={{ color: T.green, fontSize: 11, fontWeight: '800', textAlign: 'center', marginTop: 4 }}>- {quote.author}</Text>
               </View>
            )}
            <View style={styles.gaugesRow}>
               <Gauge label="DISTANCE" value={distVal} unit={isMetric ? 'KM' : 'MI'} icon="walk-outline" color={T.green} />
               <View style={[styles.vLine, { backgroundColor: isLight ? '#DDD' : 'rgba(255,255,255,0.1)' }]} />
               <Gauge label="PACE" value={pace > 0 ? pace.toFixed(1) : '--'} unit="MIN" icon="speedometer-outline" color={T.accent2} />
               <View style={[styles.vLine, { backgroundColor: isLight ? '#DDD' : 'rgba(255,255,255,0.1)' }]} />
               <Gauge label="ALTITUDE" value={altitudeMeters !== null ? String(Math.round(altitudeMeters)) : 'N/A'} unit="M" icon="analytics-outline" color={T.gold || '#FFD700'} />
            </View>

            <View style={styles.actionRow}>
               {state === 'idle' ? (
                 <TouchableOpacity activeOpacity={0.8} onPress={startRun} style={[styles.primaryBtn, { backgroundColor: T.green }]}>
                   <View style={styles.btnGrad}>
                     <Ionicons name="play" size={24} color="#000" />
                     <Text style={styles.btnText}>START RUN</Text>
                   </View>
                 </TouchableOpacity>
               ) : state === 'running' ? (
                 <>
                   <TouchableOpacity onPress={pauseRun} disabled={isSaving} style={[styles.secondaryBtn, { backgroundColor: isLight ? '#F2F2F7' : 'rgba(255,255,255,0.1)', borderColor: isLight ? '#DDD' : 'rgba(255,255,255,0.1)' }]}>
                      <Ionicons name="pause" size={24} color={isLight ? '#000' : '#FFF'} />
                   </TouchableOpacity>
                   <TouchableOpacity onPress={handleStop} disabled={isSaving} style={[styles.primaryBtn, { backgroundColor: isSaving ? '#8E8E93' : '#FF3B30' }]}>
                     <View style={styles.btnGrad}>
                       {isSaving ? <ActivityIndicator color="#FFF" /> : <Ionicons name="square" size={22} color="#FFF" />}
                       <Text style={[styles.btnText, { color: '#FFF' }]}>{isSaving ? 'SAVING...' : 'STOP RUN'}</Text>
                     </View>
                   </TouchableOpacity>
                 </>
               ) : state === 'paused' ? (
                 <>
                   <TouchableOpacity onPress={resumeRun} disabled={isSaving} style={[styles.primaryBtn, { backgroundColor: T.green }]}>
                     <View style={styles.btnGrad}>
                       <Ionicons name="play" size={24} color="#000" />
                       <Text style={styles.btnText}>RESUME</Text>
                     </View>
                   </TouchableOpacity>
                   <TouchableOpacity onPress={handleStop} disabled={isSaving} style={[styles.secondaryBtn, { backgroundColor: isLight ? '#F2F2F7' : 'rgba(255,255,255,0.1)', borderColor: isLight ? '#DDD' : 'rgba(255,255,255,0.1)' }]}>
                      {isSaving ? <ActivityIndicator color={isLight ? '#000' : '#FFF'} /> : <Ionicons name="square" size={22} color={isLight ? '#000' : '#FF453A'} />}
                   </TouchableOpacity>
                 </>
               ) : (
                 <>
                   <TouchableOpacity onPress={reset} style={[styles.secondaryBtn, { backgroundColor: isLight ? '#F2F2F7' : 'rgba(255,255,255,0.1)', borderColor: isLight ? '#DDD' : 'rgba(255,255,255,0.1)' }]}>
                      <Ionicons name="refresh" size={24} color={isLight ? '#000' : '#FFF'} />
                   </TouchableOpacity>
                   <TouchableOpacity
                     onPress={onClaim}
                     disabled={!closedLoop}
                     style={[styles.primaryBtn, { opacity: closedLoop ? 1 : 0.5, backgroundColor: closedLoop ? T.green : T.muted }]}
                   >
                     <View style={styles.btnGrad}>
                       <Ionicons name="flag-outline" size={22} color={closedLoop ? '#000' : T.text} />
                       <Text style={[styles.btnText, { color: closedLoop ? '#000' : T.text }]}>
                         {closedLoop ? 'CLAIM TERRITORY' : 'NO LOOP'}
                       </Text>
                     </View>
                   </TouchableOpacity>
                 </>
               )}
            </View>
         </View>
      </Animated.View>

      {/* RunBot FAB — direct child of root, draggable */}
      {settings?.showRunBotFab !== false && (
      <Animated.View
        style={[styles.botFab, { backgroundColor: T.card, borderColor: T.border, bottom: insets.bottom + 100, transform: botPosition.getTranslateTransform() }]}
        {...botPanResponder.panHandlers}
      >
        <TouchableOpacity
          onPress={() => setShowBotHelp(true)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10 }}
          activeOpacity={0.8}
        >
          <Ionicons name="hardware-chip-outline" size={16} color={T.green} />
          <Text style={{ color: T.green, fontSize: 12, fontWeight: '800' }}>RunBot</Text>
        </TouchableOpacity>
      </Animated.View>
      )}

      {/* RunBot Help Modal */}
      <Modal visible={showBotHelp} transparent animationType="fade" onRequestClose={() => setShowBotHelp(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }} activeOpacity={1} onPress={() => setShowBotHelp(false)}>
          <View style={{ backgroundColor: isLight ? '#FFF' : '#111', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#333', alignSelf: 'center', marginBottom: 20 }} />
            <Text style={{ color: isLight ? '#000' : T.white, fontSize: 20, fontWeight: '900', marginBottom: 16 }}>🤖 RunBot Tips</Text>
            {[
              { icon: 'map-outline', tip: 'Run a closed loop to claim territory — end within 30m of start' },
              { icon: 'location-outline', tip: 'Wait for GPS accuracy below 20m before starting' },
              { icon: 'flag-outline', tip: 'Bigger loops = more territory area claimed' },
              { icon: 'speedometer-outline', tip: 'Maintain steady pace for better heart rate zone' },
              { icon: 'cloud-outline', tip: 'Tap the weather pill for full forecast details' },
            ].map((item, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
                <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: T.green + '18', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={item.icon as any} size={16} color={T.green} />
                </View>
                <Text style={{ color: T.text, fontSize: 14, flex: 1, lineHeight: 20 }}>{item.tip}</Text>
              </View>
            ))}
            {/* Open full ChatBot */}
            <TouchableOpacity
              onPress={() => {
                setShowBotHelp(false);
                setTimeout(() => {
                  try { navigation.navigate('Profile', { screen: 'ChatBot' }); } catch (e) {}
                }, 300);
              }}
              activeOpacity={0.85}
              style={{ marginTop: 8, borderRadius: 16, overflow: 'hidden' }}
            >
              <LinearGradient colors={[T.green, '#00C6A0']} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 }} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Ionicons name="chatbubble-ellipses" size={18} color="#000" />
                <Text style={{ color: '#000', fontWeight: '900', fontSize: 15 }}>Open Full Chat</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { position: 'absolute', top: 0, left: 16, right: 16, zIndex: 100, elevation: 100 },
  headerBlur: { borderRadius: 24, overflow: 'hidden', padding: 16 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusBlock: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  timer: { fontSize: 34, fontWeight: '900', fontVariant: ['tabular-nums'] },
  headerBottom: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  locationText: { flex: 1, fontSize: 13, fontWeight: '600', opacity: 0.8 },
  accuracyText: { fontSize: 11, fontWeight: '800' },
  toolBar: { position: 'absolute', right: 16, gap: 10, zIndex: 200, elevation: 200 },
  toolBtn: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5, elevation: 3 },
  dashboard: { position: 'absolute', bottom: 0, left: 16, right: 16, zIndex: 100, elevation: 100 },
  dashBlur: { borderRadius: 28, padding: 20 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 30 },
  summaryCard: { borderRadius: 32, padding: 30, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  summaryTitle: { fontSize: 24, fontWeight: '900', textAlign: 'center', marginBottom: 30, letterSpacing: -0.5 },
  summaryGrid: { flexDirection: 'row', justifyContent: 'space-around', gap: 20 },
  summaryItem: { alignItems: 'center' },
  summaryLabel: { fontSize: 10, fontWeight: '800', opacity: 0.6, letterSpacing: 1, marginBottom: 4 },
  summaryValue: { fontSize: 22, fontWeight: '900' },
  gaugesRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  gauge: { flex: 1, alignItems: 'center', gap: 6 },
  gaugeIconBox: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  gaugeLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  gaugeValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  gaugeValue: { fontSize: 22, fontWeight: '900' },
  gaugeUnit: { fontSize: 10, fontWeight: '700', opacity: 0.7 },
  vLine: { width: 1, height: '50%', alignSelf: 'center' },
  actionRow: { flexDirection: 'row', gap: 12, minHeight: 64 },
  primaryBtn: { height: 64, borderRadius: 20, flex: 1 },
  secondaryBtn: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  btnGrad: { height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  btnText: { color: '#000', fontWeight: '900', fontSize: 16 },
  loopToast: { position: 'absolute', bottom: 180, alignSelf: 'center', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, borderWidth: 1 },
  loopToastText: { fontSize: 15, fontWeight: '800' },
  noLoopHint: { fontSize: 11, textAlign: 'center', marginTop: 8, opacity: 0.7 },
  botFab: { position: 'absolute', left: 16, borderRadius: 20, borderWidth: 1, zIndex: 200, elevation: 200, overflow: 'hidden' },
});
