import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Dimensions, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/utils/ThemeContext';

const { width, height } = Dimensions.get('window');
const KEY = 'runquest:onboardingDone';

type Slide = {
  id: number;
  tag: string;
  title: string;
  description: string;
  icon: string;
  accentColor: string;
  gradientColors: [string, string];
  steps: string[];
};

const SLIDES: Slide[] = [
  {
    id: 0,
    tag: 'WELCOME TO RUNQUEST',
    title: 'Run. Claim.\nConquer.',
    description: 'Turn every run into a battle for territory. Lace up, hit the streets, and carve your empire one loop at a time.',
    icon: 'globe',
    accentColor: '#32D74B',
    gradientColors: ['#32D74B', '#00C6A0'],
    steps: ['Run any route outdoors', 'Close your loop to claim land', 'Defend your territory'],
  },
  {
    id: 1,
    tag: 'HOW IT WORKS',
    title: 'Draw Your\nTerritory',
    description: 'Start a run, trace a closed loop on the map, and that area becomes yours. The bigger the loop, the more land you own.',
    icon: 'map',
    accentColor: '#0A84FF',
    gradientColors: ['#0A84FF', '#5E5CE6'],
    steps: ['Tap START RUN', 'Run a closed GPS loop', 'Tap CLAIM TERRITORY'],
  },
  {
    id: 2,
    tag: 'COMPETE & WIN',
    title: 'Rise to the\nTop',
    description: 'Every square meter counts. Climb the global leaderboard, unlock achievements, and dominate your city.',
    icon: 'trophy',
    accentColor: '#FFD60A',
    gradientColors: ['#FFD60A', '#FF9F0A'],
    steps: ['Own the most area', 'Earn achievement badges', 'Top the leaderboard'],
  },
];

export default function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const { T } = useTheme();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const iconScale = useRef(new Animated.Value(0.8)).current;
  const iconRotate = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(SLIDES.map((_, i) => new Animated.Value(i === 0 ? 1 : 0))).current;

  const s = SLIDES[index];
  const isLast = index === SLIDES.length - 1;

  const animateIn = (newIndex: number) => {
    iconScale.setValue(0.6);
    iconRotate.setValue(-0.05);
    Animated.parallel([
      Animated.spring(iconScale, { toValue: 1, useNativeDriver: true, tension: 80, friction: 8 }),
      Animated.spring(iconRotate, { toValue: 0, useNativeDriver: true, tension: 80, friction: 8 }),
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 60, friction: 9 }),
    ]).start();
    progressAnim.forEach((a, i) =>
      Animated.spring(a, { toValue: i === newIndex ? 1 : 0, useNativeDriver: false, tension: 80, friction: 10 }).start()
    );
  };

  useEffect(() => { animateIn(0); }, []);

  const goNext = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: -30, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      const next = index + 1;
      setIndex(next);
      slideAnim.setValue(40);
      fadeAnim.setValue(0);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
      animateIn(next);
    });
  };

  const done = async () => {
    await AsyncStorage.setItem(KEY, '1');
    onDone();
  };

  return (
    <View style={[styles.root, { backgroundColor: '#050505' }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Background gradient */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim }]}>
        <LinearGradient
          colors={[s.accentColor + '22', s.accentColor + '08', 'transparent']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 0.6 }}
        />
      </Animated.View>

      {/* Decorative rings */}
      <Animated.View style={[styles.ring1, { borderColor: s.accentColor + '18', opacity: fadeAnim }]} />
      <Animated.View style={[styles.ring2, { borderColor: s.accentColor + '10', opacity: fadeAnim }]} />

      {/* Skip button */}
      {!isLast && (
        <TouchableOpacity
          style={[styles.skipBtn, { top: insets.top + 16 }]}
          onPress={done}
        >
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      )}

      {/* Icon area */}
      <Animated.View
        style={[
          styles.iconWrap,
          { marginTop: insets.top + 80 },
          {
            transform: [
              { scale: iconScale },
              { rotate: iconRotate.interpolate({ inputRange: [-0.1, 0.1], outputRange: ['-6deg', '6deg'] }) },
            ],
          },
        ]}
      >
        <LinearGradient
          colors={s.gradientColors}
          style={styles.iconGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Ionicons name={s.icon as any} size={72} color="#000" />
        </LinearGradient>
        {/* Glow ring */}
        <View style={[styles.iconGlow, { borderColor: s.accentColor + '40' }]} />
      </Animated.View>

      {/* Content */}
      <Animated.View
        style={[
          styles.content,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
        <Text style={[styles.tag, { color: s.accentColor }]}>{s.tag}</Text>
        <Text style={styles.title}>{s.title}</Text>
        <Text style={styles.description}>{s.description}</Text>

        {/* Steps */}
        <View style={styles.stepsWrap}>
          {s.steps.map((step, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={[styles.stepDot, { backgroundColor: s.accentColor }]}>
                <Text style={styles.stepNum}>{i + 1}</Text>
              </View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>
      </Animated.View>

      {/* Bottom area */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 24 }]}>
        {/* Progress dots */}
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <Animated.View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: i === index ? s.accentColor : 'rgba(255,255,255,0.2)',
                  width: progressAnim[i].interpolate({ inputRange: [0, 1], outputRange: [8, 28] }),
                },
              ]}
            />
          ))}
        </View>

        {/* CTA Button */}
        {isLast ? (
          <TouchableOpacity style={styles.ctaBtn} onPress={done} activeOpacity={0.85}>
            <LinearGradient
              colors={s.gradientColors}
              style={styles.ctaGrad}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Ionicons name="rocket" size={22} color="#000" />
              <Text style={styles.ctaText}>START CONQUERING</Text>
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.ctaBtn} onPress={goNext} activeOpacity={0.85}>
            <LinearGradient
              colors={s.gradientColors}
              style={styles.ctaGrad}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.ctaText}>NEXT</Text>
              <Ionicons name="arrow-forward" size={20} color="#000" />
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  ring1: {
    position: 'absolute',
    top: -width * 0.3,
    alignSelf: 'center',
    width: width * 1.4,
    height: width * 1.4,
    borderRadius: width * 0.7,
    borderWidth: 1,
  },
  ring2: {
    position: 'absolute',
    top: -width * 0.1,
    alignSelf: 'center',
    width: width * 0.9,
    height: width * 0.9,
    borderRadius: width * 0.45,
    borderWidth: 1,
  },
  skipBtn: {
    position: 'absolute',
    right: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    zIndex: 10,
  },
  skipText: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '600' },
  iconWrap: {
    alignSelf: 'center',
    marginBottom: 48,
  },
  iconGradient: {
    width: 160,
    height: 160,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGlow: {
    position: 'absolute',
    top: -8,
    left: -8,
    right: -8,
    bottom: -8,
    borderRadius: 56,
    borderWidth: 1.5,
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
  },
  tag: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2.5,
    marginBottom: 12,
  },
  title: {
    fontSize: 42,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -1,
    lineHeight: 48,
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 26,
    marginBottom: 32,
  },
  stepsWrap: { gap: 14 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNum: { color: '#000', fontSize: 13, fontWeight: '900' },
  stepText: { color: 'rgba(255,255,255,0.75)', fontSize: 15, fontWeight: '600', flex: 1 },
  bottom: {
    paddingHorizontal: 32,
    gap: 24,
  },
  dots: { flexDirection: 'row', gap: 6, justifyContent: 'center' },
  dot: { height: 8, borderRadius: 4 },
  ctaBtn: { borderRadius: 20, overflow: 'hidden' },
  ctaGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 12,
  },
  ctaText: { color: '#000', fontSize: 17, fontWeight: '900', letterSpacing: 1 },
});
