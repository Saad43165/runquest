import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Dimensions, StatusBar, PanResponder, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/utils/ThemeContext';
import { AppLogo } from '../components/AppLogo';

const { width, height } = Dimensions.get('window');
const KEY = 'runquest:onboardingDone';

// ─── Animated Map Demo ────────────────────────────────────────────────────────

function MapDemo() {
  const dotAnim = useRef(new Animated.Value(0)).current;
  const pathAnim = useRef(new Animated.Value(0)).current;
  const territoryAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const claimAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Sequence: dot moves → path draws → territory fills → claim badge
    Animated.sequence([
      Animated.delay(400),
      Animated.timing(dotAnim, { toValue: 1, duration: 1800, useNativeDriver: false }),
      Animated.timing(pathAnim, { toValue: 1, duration: 600, useNativeDriver: false }),
      Animated.timing(territoryAnim, { toValue: 1, duration: 700, useNativeDriver: false }),
      Animated.spring(claimAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 7 }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.3, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Dot path: traces a rough loop on the mini-map
  const MAP_W = width - 80;
  const MAP_H = 180;
  const cx = MAP_W / 2;
  const cy = MAP_H / 2;
  const rx = MAP_W * 0.32;
  const ry = MAP_H * 0.32;

  const dotX = dotAnim.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [cx, cx + rx, cx, cx - rx, cx],
  });
  const dotY = dotAnim.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [cy - ry, cy, cy + ry, cy, cy - ry],
  });

  return (
    <View style={{ width: MAP_W, height: MAP_H, borderRadius: 20, overflow: 'hidden', backgroundColor: '#0D1B2A', borderWidth: 1, borderColor: 'rgba(0,255,135,0.2)' }}>
      {/* Grid lines */}
      {[0.25, 0.5, 0.75].map(f => (
        <View key={`h${f}`} style={{ position: 'absolute', left: 0, right: 0, top: MAP_H * f, height: 1, backgroundColor: 'rgba(255,255,255,0.04)' }} />
      ))}
      {[0.25, 0.5, 0.75].map(f => (
        <View key={`v${f}`} style={{ position: 'absolute', top: 0, bottom: 0, left: MAP_W * f, width: 1, backgroundColor: 'rgba(255,255,255,0.04)' }} />
      ))}

      {/* Territory fill — animated opacity */}
      <Animated.View style={{
        position: 'absolute',
        left: cx - rx, top: cy - ry,
        width: rx * 2, height: ry * 2,
        borderRadius: rx,
        backgroundColor: '#00C6FF',
        opacity: territoryAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.18] }),
      }} />
      <Animated.View style={{
        position: 'absolute',
        left: cx - rx, top: cy - ry,
        width: rx * 2, height: ry * 2,
        borderRadius: rx,
        borderWidth: 2,
        borderColor: '#00C6FF',
        opacity: territoryAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.7] }),
      }} />

      {/* Moving dot */}
      <Animated.View style={{
        position: 'absolute',
        width: 14, height: 14, borderRadius: 7,
        backgroundColor: '#00C6FF',
        borderWidth: 2, borderColor: '#FFF',
        transform: [
          { translateX: Animated.subtract(dotX, new Animated.Value(7)) },
          { translateY: Animated.subtract(dotY, new Animated.Value(7)) },
        ],
        zIndex: 10,
      }}>
        <Animated.View style={{
          position: 'absolute', top: -6, left: -6, right: -6, bottom: -6,
          borderRadius: 13, backgroundColor: '#00C6FF30',
          transform: [{ scale: pulseAnim }],
        }} />
      </Animated.View>

      {/* Start marker */}
      <View style={{ position: 'absolute', left: cx - 8, top: cy - ry - 8, width: 16, height: 16, borderRadius: 8, backgroundColor: '#00C6FF', alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#000' }} />
      </View>

      {/* Claim badge */}
      <Animated.View style={{
        position: 'absolute', bottom: 10, right: 10,
        backgroundColor: '#00C6FF', borderRadius: 12,
        paddingHorizontal: 10, paddingVertical: 5,
        flexDirection: 'row', alignItems: 'center', gap: 4,
        opacity: claimAnim,
        transform: [{ scale: claimAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }],
      }}>
        <Ionicons name="flag" size={11} color="#000" />
        <Text style={{ color: '#000', fontSize: 10, fontWeight: '900' }}>CLAIMED!</Text>
      </Animated.View>

      {/* Label */}
      <View style={{ position: 'absolute', top: 8, left: 10 }}>
        <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9, fontWeight: '700', letterSpacing: 1 }}>LIVE MAP</Text>
      </View>
    </View>
  );
}

// ─── Territory Battle Demo ────────────────────────────────────────────────────

function TerritoryDemo() {
  const enemy1 = useRef(new Animated.Value(1)).current;
  const enemy2 = useRef(new Animated.Value(1)).current;
  const yours = useRef(new Animated.Value(0)).current;
  const swordAnim = useRef(new Animated.Value(0)).current;
  const conqueredAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(500),
      Animated.spring(yours, { toValue: 1, useNativeDriver: true, tension: 60, friction: 8 }),
      Animated.delay(400),
      Animated.spring(swordAnim, { toValue: 1, useNativeDriver: true, tension: 100, friction: 6 }),
      Animated.parallel([
        Animated.timing(enemy1, { toValue: 0, duration: 400, useNativeDriver: true }),
        Animated.timing(enemy2, { toValue: 0, duration: 400, useNativeDriver: true }),
        Animated.spring(conqueredAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 7 }),
      ]),
    ]).start();
  }, []);

  const MAP_W = width - 80;

  return (
    <View style={{ width: MAP_W, height: 180, borderRadius: 20, overflow: 'hidden', backgroundColor: '#0D1B2A', borderWidth: 1, borderColor: 'rgba(255,107,53,0.3)' }}>
      {/* Enemy territories */}
      <Animated.View style={{ position: 'absolute', left: 20, top: 30, width: 100, height: 80, borderRadius: 16, backgroundColor: '#FF453A', opacity: enemy1, borderWidth: 1, borderColor: '#FF453A80', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="person" size={18} color="#FFF" />
        <Text style={{ color: '#FFF', fontSize: 9, fontWeight: '800', marginTop: 2 }}>ENEMY</Text>
        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 8 }}>1,200 m²</Text>
      </Animated.View>
      <Animated.View style={{ position: 'absolute', right: 20, top: 30, width: 100, height: 80, borderRadius: 16, backgroundColor: '#FF9F0A', opacity: enemy2, borderWidth: 1, borderColor: '#FF9F0A80', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="person" size={18} color="#FFF" />
        <Text style={{ color: '#FFF', fontSize: 9, fontWeight: '800', marginTop: 2 }}>ENEMY</Text>
        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 8 }}>980 m²</Text>
      </Animated.View>

      {/* Your territory expanding */}
      <Animated.View style={{
        position: 'absolute', left: MAP_W / 2 - 60, top: 20, width: 120, height: 140,
        borderRadius: 20, backgroundColor: '#00C6FF',
        opacity: yours.interpolate({ inputRange: [0, 1], outputRange: [0, 0.15] }),
        transform: [{ scale: yours }],
      }} />
      <Animated.View style={{
        position: 'absolute', left: MAP_W / 2 - 60, top: 20, width: 120, height: 140,
        borderRadius: 20, borderWidth: 2, borderColor: '#00C6FF',
        opacity: yours,
        transform: [{ scale: yours }],
      }} />

      {/* Sword icon */}
      <Animated.View style={{
        position: 'absolute', left: MAP_W / 2 - 16, top: 70,
        opacity: swordAnim,
        transform: [{ scale: swordAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1.2] }) }],
      }}>
        <Text style={{ fontSize: 28 }}>⚔️</Text>
      </Animated.View>

      {/* Conquered badge */}
      <Animated.View style={{
        position: 'absolute', bottom: 10, alignSelf: 'center', left: MAP_W / 2 - 70,
        backgroundColor: '#FF453A', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 5,
        flexDirection: 'row', alignItems: 'center', gap: 5,
        opacity: conqueredAnim,
        transform: [{ scale: conqueredAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }],
      }}>
        <Ionicons name="flash" size={11} color="#FFF" />
        <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '900' }}>2 TERRITORIES CONQUERED!</Text>
      </Animated.View>
    </View>
  );
}

// ─── Achievement Demo ─────────────────────────────────────────────────────────

const ACHIEVEMENT_CARDS = [
  { icon: 'footsteps', title: 'First Step', tier: 'BRONZE', color: '#CD7F32', delay: 200 },
  { icon: 'trophy', title: 'Marathon Legend', tier: 'GOLD', color: '#FFD60A', delay: 500 },
  { icon: 'flame', title: 'Unstoppable', tier: 'LEGENDARY', color: '#FF6B35', delay: 800 },
  { icon: 'planet', title: 'Immortal Runner', tier: 'MYTHIC', color: '#BF5FFF', delay: 1100 },
];

function AchievementCard({ card }: { card: typeof ACHIEVEMENT_CARDS[0] }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: 1, delay: card.delay, useNativeDriver: true, tension: 70, friction: 9 }).start();
  }, []);
  return (
    <Animated.View style={{
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: card.color + '15', borderRadius: 14, padding: 12,
      borderWidth: 1, borderColor: card.color + '40',
      opacity: anim,
      transform: [
        { translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [60, 0] }) },
        { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) },
      ],
    }}>
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: card.color + '25', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: card.color + '50' }}>
        <Ionicons name={card.icon as any} size={20} color={card.color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '800' }}>{card.title}</Text>
        <Text style={{ color: card.color, fontSize: 9, fontWeight: '900', letterSpacing: 1 }}>{card.tier}</Text>
      </View>
      <View style={{ backgroundColor: card.color + '20', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
        <Text style={{ color: card.color, fontSize: 10, fontWeight: '900' }}>UNLOCKED</Text>
      </View>
    </Animated.View>
  );
}

function AchievementDemo() {
  return (
    <View style={{ width: width - 80, gap: 8 }}>
      {ACHIEVEMENT_CARDS.map(c => <AchievementCard key={c.title} card={c} />)}
    </View>
  );
}

// ─── App Identity Demo — slide 0: animated city map with territories ─────────
function AppIdentityDemo({ accentColor }: { accentColor: string }) {
  const MAP_W = width - 80;
  const MAP_H = 180;

  const zone1 = useRef(new Animated.Value(0)).current;
  const zone2 = useRef(new Animated.Value(0)).current;
  const zone3 = useRef(new Animated.Value(0)).current;
  const zone4 = useRef(new Animated.Value(0)).current;
  const runner1 = useRef(new Animated.Value(0)).current;
  const runner2 = useRef(new Animated.Value(0)).current;
  const pulse1 = useRef(new Animated.Value(1)).current;
  const pulse2 = useRef(new Animated.Value(1)).current;
  const gpsSignal = useRef(new Animated.Value(0)).current;

  // Warrior spawn animations
  const warriorScale = useRef(new Animated.Value(0)).current;
  const warriorOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Zones fade+grow in sequence
    Animated.sequence([
      Animated.delay(300),
      Animated.timing(zone1, { toValue: 1, duration: 600, useNativeDriver: false }),
      Animated.delay(150),
      Animated.timing(zone2, { toValue: 1, duration: 550, useNativeDriver: false }),
      Animated.delay(100),
      Animated.timing(zone3, { toValue: 1, duration: 500, useNativeDriver: false }),
      Animated.delay(80),
      Animated.timing(zone4, { toValue: 1, duration: 480, useNativeDriver: false }),
    ]).start();

    // Warrior spawns cinematically
    Animated.sequence([
      Animated.delay(800),
      Animated.parallel([
        Animated.spring(warriorScale, { toValue: 1, tension: 70, friction: 6, useNativeDriver: true }),
        Animated.timing(warriorOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
    ]).start();

    Animated.loop(Animated.timing(runner1, { toValue: 1, duration: 3200, useNativeDriver: false })).start();
    Animated.loop(Animated.timing(runner2, { toValue: 1, duration: 4200, useNativeDriver: false })).start();

    Animated.loop(Animated.sequence([
      Animated.timing(pulse1, { toValue: 1.7, duration: 900, useNativeDriver: false }),
      Animated.timing(pulse1, { toValue: 1, duration: 900, useNativeDriver: false }),
    ])).start();
    Animated.loop(Animated.sequence([
      Animated.delay(450),
      Animated.timing(pulse2, { toValue: 1.7, duration: 900, useNativeDriver: false }),
      Animated.timing(pulse2, { toValue: 1, duration: 900, useNativeDriver: false }),
    ])).start();

    Animated.loop(Animated.sequence([
      Animated.timing(gpsSignal, { toValue: 1, duration: 500, useNativeDriver: false }),
      Animated.timing(gpsSignal, { toValue: 0.2, duration: 500, useNativeDriver: false }),
    ])).start();
  }, []);

  const r1x = runner1.interpolate({ inputRange: [0, 0.5, 1], outputRange: [MAP_W * 0.08, MAP_W * 0.72, MAP_W * 0.08] });
  const r1y = runner1.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [MAP_H * 0.28, MAP_H * 0.18, MAP_H * 0.28, MAP_H * 0.38, MAP_H * 0.28] });
  const r2x = runner2.interpolate({ inputRange: [0, 0.5, 1], outputRange: [MAP_W * 0.58, MAP_W * 0.82, MAP_W * 0.58] });
  const r2y = runner2.interpolate({ inputRange: [0, 0.5, 1], outputRange: [MAP_H * 0.58, MAP_H * 0.72, MAP_H * 0.58] });

  const z1w = zone1.interpolate({ inputRange: [0, 1], outputRange: [0, MAP_W * 0.32] });
  const z1h = zone1.interpolate({ inputRange: [0, 1], outputRange: [0, MAP_H * 0.44] });
  const z2w = zone2.interpolate({ inputRange: [0, 1], outputRange: [0, MAP_W * 0.26] });
  const z2h = zone2.interpolate({ inputRange: [0, 1], outputRange: [0, MAP_H * 0.38] });
  const z3w = zone3.interpolate({ inputRange: [0, 1], outputRange: [0, MAP_W * 0.28] });
  const z3h = zone3.interpolate({ inputRange: [0, 1], outputRange: [0, MAP_H * 0.36] });
  const z4w = zone4.interpolate({ inputRange: [0, 1], outputRange: [0, MAP_W * 0.30] });
  const z4h = zone4.interpolate({ inputRange: [0, 1], outputRange: [0, MAP_H * 0.34] });

  return (
    <View style={{ width: MAP_W, height: MAP_H, borderRadius: 20, overflow: 'hidden', backgroundColor: '#080E1A', borderWidth: 1, borderColor: accentColor + '25' }}>
      {[0.25, 0.5, 0.75].map(f => (
        <View key={`h${f}`} style={{ position: 'absolute', left: 0, right: 0, top: MAP_H * f, height: 1, backgroundColor: 'rgba(255,255,255,0.05)' }} />
      ))}
      {[0.2, 0.4, 0.6, 0.8].map(f => (
        <View key={`v${f}`} style={{ position: 'absolute', top: 0, bottom: 0, left: MAP_W * f, width: 1, backgroundColor: 'rgba(255,255,255,0.05)' }} />
      ))}

      {/* Zone 1 — blue, top-left, expands right+down */}
      <Animated.View style={{ position: 'absolute', left: MAP_W * 0.04, top: MAP_H * 0.07, width: z1w, height: z1h, borderRadius: 16, backgroundColor: accentColor, opacity: zone1.interpolate({ inputRange: [0, 1], outputRange: [0, 0.25] }), borderWidth: 1.5, borderColor: accentColor, overflow: 'hidden' }} />

      {/* Zone 2 — orange, top-right, expands left+down */}
      <Animated.View style={{ position: 'absolute', right: MAP_W * 0.04, top: MAP_H * 0.06, width: z2w, height: z2h, borderRadius: 14, backgroundColor: '#FF6B35', opacity: zone2.interpolate({ inputRange: [0, 1], outputRange: [0, 0.28] }), borderWidth: 1.5, borderColor: '#FF6B35', overflow: 'hidden' }} />

      {/* Zone 3 — green, bottom-left */}
      <Animated.View style={{ position: 'absolute', left: MAP_W * 0.06, bottom: MAP_H * 0.07, width: z3w, height: z3h, borderRadius: 14, backgroundColor: '#32D74B', opacity: zone3.interpolate({ inputRange: [0, 1], outputRange: [0, 0.22] }), borderWidth: 1.5, borderColor: '#32D74B', overflow: 'hidden' }} />

      {/* Zone 4 — purple, bottom-right */}
      <Animated.View style={{ position: 'absolute', right: MAP_W * 0.05, bottom: MAP_H * 0.08, width: z4w, height: z4h, borderRadius: 16, backgroundColor: '#BF5FFF', opacity: zone4.interpolate({ inputRange: [0, 1], outputRange: [0, 0.22] }), borderWidth: 1.5, borderColor: '#BF5FFF', overflow: 'hidden' }} />

      {/* Runner 1 */}
      <Animated.View style={{ position: 'absolute', transform: [{ translateX: Animated.subtract(r1x, new Animated.Value(6)) }, { translateY: Animated.subtract(r1y, new Animated.Value(6)) }] }}>
        <Animated.View style={{ position: 'absolute', top: -6, left: -6, width: 24, height: 24, borderRadius: 12, backgroundColor: accentColor + '35', transform: [{ scale: pulse1 }] }} />
        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: accentColor, borderWidth: 2, borderColor: '#FFF' }} />
      </Animated.View>

      {/* Runner 2 */}
      <Animated.View style={{ position: 'absolute', transform: [{ translateX: Animated.subtract(r2x, new Animated.Value(6)) }, { translateY: Animated.subtract(r2y, new Animated.Value(6)) }] }}>
        <Animated.View style={{ position: 'absolute', top: -6, left: -6, width: 24, height: 24, borderRadius: 12, backgroundColor: '#FF6B3535', transform: [{ scale: pulse2 }] }} />
        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#FF6B35', borderWidth: 2, borderColor: '#FFF' }} />
      </Animated.View>

      {/* Animated Warrior Spawner Badge */}
      <Animated.View style={{
        position: 'absolute',
        left: MAP_W / 2 - 24,
        top: MAP_H / 2 - 24,
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#080E1A',
        borderWidth: 2,
        borderColor: accentColor,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: warriorOpacity,
        transform: [{ scale: warriorScale }],
        shadowColor: accentColor,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 10,
        elevation: 6,
      }}>
        <Animated.View style={{
          position: 'absolute',
          top: -4, left: -4, right: -4, bottom: -4,
          borderRadius: 28,
          borderWidth: 1.5,
          borderColor: accentColor + '40',
          transform: [{ scale: pulse1 }]
        }} />
        <Ionicons name="shield-half" size={22} color={accentColor} />
      </Animated.View>

      <Animated.View style={{ position: 'absolute', top: 9, right: 11, flexDirection: 'row', alignItems: 'center', gap: 4, opacity: gpsSignal }}>
        <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#32D74B' }} />
        <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 8, fontWeight: '700', letterSpacing: 1 }}>GPS</Text>
      </Animated.View>
      <View style={{ position: 'absolute', top: 9, left: 11 }}>
        <Text style={{ color: 'rgba(255,255,255,0.2)', fontSize: 8, fontWeight: '700', letterSpacing: 1 }}>LIVE MAP</Text>
      </View>
    </View>
  );
}

// ─── Welcome Demo — animated runner on map with territory zones ───────────────
function WelcomeDemo() {
  const runnerAnim = useRef(new Animated.Value(0)).current;
  const trailAnim = useRef(new Animated.Value(0)).current;
  const zone1Anim = useRef(new Animated.Value(0)).current;
  const zone2Anim = useRef(new Animated.Value(0)).current;
  const zone3Anim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const claimAnim = useRef(new Animated.Value(0)).current;

  const MAP_W = width - 80;
  const MAP_H = 180;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(200),
      // Runner moves along path
      Animated.timing(runnerAnim, { toValue: 1, duration: 2000, useNativeDriver: false }),
      // Trail fills in
      Animated.timing(trailAnim, { toValue: 1, duration: 400, useNativeDriver: false }),
      // Zones appear
      Animated.stagger(200, [
        Animated.spring(zone1Anim, { toValue: 1, useNativeDriver: true, tension: 70, friction: 8 }),
        Animated.spring(zone2Anim, { toValue: 1, useNativeDriver: true, tension: 70, friction: 8 }),
        Animated.spring(zone3Anim, { toValue: 1, useNativeDriver: true, tension: 70, friction: 8 }),
      ]),
      Animated.spring(claimAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 7 }),
    ]).start();

    Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.4, duration: 700, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
    ])).start();
  }, []);

  // Runner path: a rough loop around the map
  const cx = MAP_W / 2, cy = MAP_H / 2;
  const rx = MAP_W * 0.35, ry = MAP_H * 0.35;

  const runnerX = runnerAnim.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [cx, cx + rx, cx, cx - rx, cx],
  });
  const runnerY = runnerAnim.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [cy - ry, cy, cy + ry, cy, cy - ry],
  });

  return (
    <View style={{ width: MAP_W, height: MAP_H, borderRadius: 20, overflow: 'hidden', backgroundColor: '#0A0E1A', borderWidth: 1, borderColor: 'rgba(0,198,255,0.25)' }}>
      {/* Grid lines for map feel */}
      {[0.25, 0.5, 0.75].map(f => (
        <View key={`h${f}`} style={{ position: 'absolute', left: 0, right: 0, top: MAP_H * f, height: 1, backgroundColor: 'rgba(255,255,255,0.04)' }} />
      ))}
      {[0.2, 0.4, 0.6, 0.8].map(f => (
        <View key={`v${f}`} style={{ position: 'absolute', top: 0, bottom: 0, left: MAP_W * f, width: 1, backgroundColor: 'rgba(255,255,255,0.04)' }} />
      ))}

      {/* Enemy territory zones — orange/red */}
      <Animated.View style={{
        position: 'absolute', left: MAP_W * 0.05, top: MAP_H * 0.08,
        width: MAP_W * 0.28, height: MAP_H * 0.38,
        borderRadius: 14, backgroundColor: '#FF6B35',
        opacity: zone2Anim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.3] }),
        transform: [{ scale: zone2Anim }],
        borderWidth: 1.5, borderColor: '#FF6B35',
      }} />
      <Animated.View style={{
        position: 'absolute', right: MAP_W * 0.04, top: MAP_H * 0.12,
        width: MAP_W * 0.22, height: MAP_H * 0.32,
        borderRadius: 12, backgroundColor: '#FF453A',
        opacity: zone3Anim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.28] }),
        transform: [{ scale: zone3Anim }],
        borderWidth: 1.5, borderColor: '#FF453A',
      }} />
      <Animated.View style={{
        position: 'absolute', right: MAP_W * 0.06, bottom: MAP_H * 0.08,
        width: MAP_W * 0.3, height: MAP_H * 0.3,
        borderRadius: 16, backgroundColor: '#FF9F0A',
        opacity: zone3Anim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.22] }),
        transform: [{ scale: zone3Anim }],
        borderWidth: 1.5, borderColor: '#FF9F0A',
      }} />

      {/* Player territory — blue, expanding */}
      <Animated.View style={{
        position: 'absolute',
        left: cx - rx, top: cy - ry,
        width: rx * 2, height: ry * 2,
        borderRadius: rx,
        backgroundColor: '#00C6FF',
        opacity: zone1Anim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.18] }),
        transform: [{ scale: zone1Anim }],
      }} />
      <Animated.View style={{
        position: 'absolute',
        left: cx - rx, top: cy - ry,
        width: rx * 2, height: ry * 2,
        borderRadius: rx,
        borderWidth: 2, borderColor: '#00C6FF',
        opacity: zone1Anim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.8] }),
        transform: [{ scale: zone1Anim }],
      }} />

      {/* GPS trail dots */}
      {[0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9].map((t, i) => {
        const angle = t * 2 * Math.PI;
        const x = cx + rx * Math.sin(angle);
        const y = cy - ry * Math.cos(angle);
        return (
          <Animated.View key={i} style={{
            position: 'absolute', left: x - 2, top: y - 2,
            width: 4, height: 4, borderRadius: 2,
            backgroundColor: '#00C6FF',
            opacity: trailAnim.interpolate({ inputRange: [Math.max(0, t - 0.1), t], outputRange: [0, 0.7] }),
          }} />
        );
      })}

      {/* Runner dot with pulse */}
      <Animated.View style={{
        position: 'absolute',
        transform: [
          { translateX: Animated.subtract(runnerX, new Animated.Value(14)) },
          { translateY: Animated.subtract(runnerY, new Animated.Value(14)) },
        ],
      }}>
        <Animated.View style={{
          position: 'absolute', top: -6, left: -6, right: -6, bottom: -6,
          borderRadius: 20, backgroundColor: '#00C6FF30',
          transform: [{ scale: pulseAnim }],
        }} />
        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#00C6FF', borderWidth: 2.5, borderColor: '#FFF', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="walk" size={13} color="#000" />
        </View>
      </Animated.View>

      {/* Start marker */}
      <View style={{ position: 'absolute', left: cx - 6, top: cy - ry - 6, width: 12, height: 12, borderRadius: 6, backgroundColor: '#00C6FF', borderWidth: 2, borderColor: '#FFF' }} />

      {/* Claim badge */}
      <Animated.View style={{
        position: 'absolute', bottom: 10, alignSelf: 'center', left: MAP_W / 2 - 60,
        backgroundColor: '#00C6FF', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 5,
        flexDirection: 'row', alignItems: 'center', gap: 5,
        opacity: claimAnim,
        transform: [{ scale: claimAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }],
      }}>
        <Ionicons name="flag" size={11} color="#000" />
        <Text style={{ color: '#000', fontSize: 10, fontWeight: '900' }}>TERRITORY CLAIMED!</Text>
      </Animated.View>

      {/* Corner labels */}
      <View style={{ position: 'absolute', top: 8, left: 10 }}>
        <Text style={{ color: 'rgba(255,255,255,0.25)', fontSize: 8, fontWeight: '700', letterSpacing: 1 }}>LIVE MAP</Text>
      </View>
      <View style={{ position: 'absolute', top: 8, right: 10, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#32D74B' }} />
        <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 8, fontWeight: '700' }}>GPS ACTIVE</Text>
      </View>
    </View>
  );
}

type SlideId = 'welcome' | 'howto' | 'conquer' | 'achievements';

const SLIDES: { id: SlideId; tag: string; title: string; description: string; accentColor: string; gradientColors: [string, string] }[] = [
  {
    id: 'welcome',
    tag: 'WELCOME TO RUNQUEST',
    title: 'Run. Claim.\nConquer.',
    description: 'Turn every run into a battle for territory. Lace up, hit the streets, and carve your empire one loop at a time.',
    accentColor: '#00C6FF',
    gradientColors: ['#00C6FF', '#0A84FF'],
  },
  {
    id: 'howto',
    tag: 'HOW IT WORKS',
    title: 'Draw Your\nTerritory',
    description: 'Run a closed GPS loop — your end point within 30m of start. The map fills with your color. Bigger loops = more land.',
    accentColor: '#0A84FF',
    gradientColors: ['#0A84FF', '#5E5CE6'],
  },
  {
    id: 'conquer',
    tag: 'INVADE & CONQUER',
    title: 'Steal Enemy\nLand',
    description: 'Overlap 50%+ of another player\'s territory with your loop and it\'s yours. Watch their land turn to yours in real-time.',
    accentColor: '#FF6B35',
    gradientColors: ['#FF6B35', '#FF453A'],
  },
  {
    id: 'achievements',
    tag: 'LEVEL UP',
    title: 'Earn Epic\nAchievements',
    description: 'From Bronze to Mythic — unlock badges as you run more, claim more, and dominate the leaderboard. Achievements never end.',
    accentColor: '#BF5FFF',
    gradientColors: ['#FFD60A', '#BF5FFF'],
  },
];

// ─── Main Onboarding ──────────────────────────────────────────────────────────

export default function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(SLIDES.map((_, i) => new Animated.Value(i === 0 ? 1 : 0))).current;
  // Key to remount demo components on slide change
  const [demoKey, setDemoKey] = useState(0);

  const s = SLIDES[index];
  const isLast = index === SLIDES.length - 1;

  useEffect(() => { indexRef.current = index; }, [index]);

  const animateIn = (newIndex: number) => {
    progressAnim.forEach((a, i) =>
      Animated.spring(a, { toValue: i === newIndex ? 1 : 0, useNativeDriver: false, tension: 80, friction: 10 }).start()
    );
  };

  useEffect(() => { animateIn(0); }, []);

  const transitionTo = (next: number, direction: 'forward' | 'back') => {
    const outX = direction === 'forward' ? -40 : 40;
    const inX = direction === 'forward' ? 40 : -40;
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 160, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: outX, duration: 160, useNativeDriver: true }),
    ]).start(() => {
      setIndex(next);
      indexRef.current = next;
      setDemoKey(k => k + 1);
      slideAnim.setValue(inX);
      fadeAnim.setValue(0);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 240, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 70, friction: 10 }),
      ]).start();
      animateIn(next);
    });
  };

  const goNext = () => {
    const cur = indexRef.current;
    if (cur < SLIDES.length - 1) transitionTo(cur + 1, 'forward');
  };

  const done = async () => {
    await AsyncStorage.setItem(KEY, '1');
    onDone();
  };

  const swipePanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 20 && Math.abs(gs.dy) < 60,
      onPanResponderRelease: (_, gs) => {
        const cur = indexRef.current;
        if (gs.dx < -50 && cur < SLIDES.length - 1) transitionTo(cur + 1, 'forward');
        else if (gs.dx > 50 && cur > 0) transitionTo(cur - 1, 'back');
      },
    })
  ).current;

  return (
    <View style={[styles.root, { backgroundColor: '#050505' }]} {...swipePanResponder.panHandlers}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Background gradient */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim }]}>
        <LinearGradient
          colors={[s.accentColor + '25', s.accentColor + '08', 'transparent']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 0.7 }}
        />
      </Animated.View>

      {/* Decorative rings */}
      <View style={[styles.ring1, { borderColor: s.accentColor + '15' }]} />
      <View style={[styles.ring2, { borderColor: s.accentColor + '08' }]} />

      {/* Skip — pushed below safe area with enough gap so it doesn't overlap demo */}
      {!isLast && (
        <TouchableOpacity style={[styles.skipBtn, { top: insets.top + 16 }]} onPress={done}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      )}

      {/* Animated visual demo — consistent layout all slides */}
      <Animated.View style={[
        styles.demoWrap,
        { marginTop: insets.top + 60 },
        { opacity: fadeAnim, transform: [{ translateX: slideAnim }] },
      ]}>
        {index === 0 && <AppIdentityDemo key={demoKey} accentColor={s.accentColor} />}
        {index === 1 && <WelcomeDemo key={demoKey} />}
        {index === 2 && <TerritoryDemo key={demoKey} />}
        {index === 3 && <AchievementDemo key={demoKey} />}
      </Animated.View>

      {/* Text content */}
      <Animated.View style={[
        styles.content,
        { opacity: fadeAnim, transform: [{ translateX: slideAnim }] },
      ]}>
        <Text style={[styles.tag, { color: s.accentColor }]}>{s.tag}</Text>
        <Text style={styles.title}>{s.title}</Text>
        <Text style={styles.description}>{s.description}</Text>
      </Animated.View>

      {/* Bottom */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 24 }]}>
        {/* Progress dots */}
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <TouchableOpacity key={i} onPress={() => { if (i < index || i === index + 1) transitionTo(i, i > index ? 'forward' : 'back'); }}>
              <Animated.View style={[
                styles.dot,
                {
                  backgroundColor: i === index ? s.accentColor : 'rgba(255,255,255,0.2)',
                  width: progressAnim[i].interpolate({ inputRange: [0, 1], outputRange: [8, 28] }),
                },
              ]} />
            </TouchableOpacity>
          ))}
        </View>
        <Text style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10, textAlign: 'center', marginTop: -8 }}>Swipe to navigate</Text>

        {isLast ? (
          <TouchableOpacity style={styles.ctaBtn} onPress={done} activeOpacity={0.85}>
            <LinearGradient colors={s.gradientColors} style={styles.ctaGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Ionicons name="rocket" size={22} color="#000" />
              <Text style={styles.ctaText}>START CONQUERING</Text>
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.ctaBtn} onPress={goNext} activeOpacity={0.85}>
            <LinearGradient colors={s.gradientColors} style={styles.ctaGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
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
    position: 'absolute', top: -width * 0.3, alignSelf: 'center',
    width: width * 1.4, height: width * 1.4, borderRadius: width * 0.7, borderWidth: 1,
  },
  ring2: {
    position: 'absolute', top: -width * 0.1, alignSelf: 'center',
    width: width * 0.9, height: width * 0.9, borderRadius: width * 0.45, borderWidth: 1,
  },
  skipBtn: {
    position: 'absolute', right: 24, zIndex: 10,
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  skipText: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '600' },
  logoGrad: { width: 120, height: 120, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  logoGlow: { position: 'absolute', top: -8, left: -8, right: -8, bottom: -8, borderRadius: 46, borderWidth: 1.5 },
  demoWrap: { alignItems: 'center', paddingHorizontal: 40, marginBottom: 24 },
  content: { flex: 1, paddingHorizontal: 32 },
  contentSlide0: { paddingHorizontal: 32, paddingBottom: 8 },
  tag: { fontSize: 11, fontWeight: '800', letterSpacing: 2.5, marginBottom: 10 },
  title: { fontSize: 36, fontWeight: '900', color: '#FFF', letterSpacing: -1, lineHeight: 42, marginBottom: 12 },
  description: { fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 22, marginBottom: 16 },
  pillsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  pillNum: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  pillNumText: { color: '#000', fontSize: 10, fontWeight: '900' },
  pillText: { fontSize: 12, fontWeight: '700' },
  bottom: { paddingHorizontal: 32, gap: 16 },
  dots: { flexDirection: 'row', gap: 6, justifyContent: 'center' },
  dot: { height: 8, borderRadius: 4 },
  ctaBtn: { borderRadius: 20, overflow: 'hidden' },
  ctaGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 20, gap: 12 },
  ctaText: { color: '#000', fontSize: 17, fontWeight: '900', letterSpacing: 1 },
});
