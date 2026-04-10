import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Animated, Dimensions, TouchableOpacity } from 'react-native';
import { getHistory, RunRecord } from '../services/history';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/utils/ThemeContext';
import { useNavigation } from '@react-navigation/native';

const { width } = Dimensions.get('window');
const CARD_W = (width - 52) / 2;

type Achievement = {
  id: string; title: string; description: string; achieved: boolean;
  progressLabel: string; progress: number; icon: string; tier: 'bronze' | 'silver' | 'gold' | 'locked';
};

function computeAchievements(history: RunRecord[]): Achievement[] {
  const runs = history.length;
  const totalDistance = history.reduce((a, r) => a + (r.distanceMeters || 0), 0);
  const totalArea = history.reduce((a, r) => a + (r.areaSqMeters || 0), 0);
  const loops = history.filter(r => (r.areaSqMeters || 0) > 100).length;
  const days = Array.from(new Set(history.map(r => new Date(r.createdAt).toDateString()))).sort();
  let maxStreak = 0, streak = 0;
  for (let i = 0; i < days.length; i++) {
    if (i === 0) { streak = 1; }
    else {
      const diff = Math.floor((new Date(days[i]).getTime() - new Date(days[i - 1]).getTime()) / 86400000);
      streak = diff === 1 ? streak + 1 : 1;
    }
    if (streak > maxStreak) {maxStreak = streak;}
  }
  return [
    { id: 'first-run', title: 'First Step', description: 'Complete your first run', icon: 'footsteps', achieved: runs >= 1, progress: Math.min(runs / 1, 1), progressLabel: `${Math.min(runs, 1)}/1 runs`, tier: runs >= 1 ? 'bronze' : 'locked' },
    { id: '5k', title: '5K Warrior', description: 'Accumulate 5,000 m total', icon: 'trending-up', achieved: totalDistance >= 5000, progress: Math.min(totalDistance / 5000, 1), progressLabel: `${Math.min(Math.round(totalDistance), 5000)}/5000 m`, tier: totalDistance >= 5000 ? 'silver' : 'locked' },
    { id: 'half-marathon', title: 'Half Hero', description: 'Run 21,097 m total', icon: 'medal', achieved: totalDistance >= 21097, progress: Math.min(totalDistance / 21097, 1), progressLabel: `${Math.min(Math.round(totalDistance), 21097)}/21097 m`, tier: totalDistance >= 21097 ? 'gold' : 'locked' },
    { id: 'marathon', title: 'Marathon Legend', description: 'Run 42,195 m total', icon: 'trophy', achieved: totalDistance >= 42195, progress: Math.min(totalDistance / 42195, 1), progressLabel: `${Math.min(Math.round(totalDistance), 42195)}/42195 m`, tier: totalDistance >= 42195 ? 'gold' : 'locked' },
    { id: 'loops-5', title: 'Loop Builder', description: 'Close 5 loops', icon: 'git-commit', achieved: loops >= 5, progress: Math.min(loops / 5, 1), progressLabel: `${loops}/5 loops`, tier: loops >= 5 ? 'silver' : 'locked' },
    { id: 'area-50k', title: 'Conqueror', description: 'Cover 50,000 m² total area', icon: 'globe', achieved: totalArea >= 50000, progress: Math.min(totalArea / 50000, 1), progressLabel: `${Math.round(Math.min(totalArea, 50000))}/50000 m²`, tier: totalArea >= 50000 ? 'gold' : 'locked' },
    { id: 'streak-3', title: '3-Day Streak', description: 'Run 3 days in a row', icon: 'flame', achieved: maxStreak >= 3, progress: Math.min(maxStreak / 3, 1), progressLabel: `${maxStreak}/3 days`, tier: maxStreak >= 3 ? 'silver' : 'locked' },
    { id: 'streak-7', title: 'Week Warrior', description: 'Run 7 days in a row', icon: 'star', achieved: maxStreak >= 7, progress: Math.min(maxStreak / 7, 1), progressLabel: `${maxStreak}/7 days`, tier: maxStreak >= 7 ? 'gold' : 'locked' },
  ];
}

function AchievementCard({ item, index }: { item: Achievement; index: number }) {
  const { T } = useTheme();
  const anim = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(0)).current;

  const TIER_COLORS = { gold: T.gold, silver: '#C0C0C0', bronze: '#CD7F32', locked: T.border };
  const TIER_BG = { gold: T.gold + '20', silver: '#C0C0C020', bronze: '#CD7F3220', locked: T.card };

  const tierColor = TIER_COLORS[item.tier];
  const tierBg = TIER_BG[item.tier];

  useEffect(() => {
    Animated.spring(anim, { toValue: 1, delay: index * 60, useNativeDriver: true, tension: 55, friction: 8 }).start();
    if (item.achieved) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(shimmer, { toValue: 1, duration: 2000, useNativeDriver: true }),
          Animated.timing(shimmer, { toValue: 0, duration: 2000, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [item.achieved, index, anim, shimmer]);

  return (
    <Animated.View
      style={[
        { width: CARD_W, borderRadius: 16, borderWidth: 1, padding: 14, position: 'relative' },
        { opacity: anim, transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }] },
        { backgroundColor: item.achieved ? tierBg : T.card, borderColor: item.achieved ? tierColor + '60' : T.border },
      ]}
    >
      <View
        style={[
          { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
          { backgroundColor: item.achieved ? tierColor + '25' : T.muted, borderColor: item.achieved ? tierColor + '60' : T.border },
        ]}
      >
        <Ionicons name={item.icon as any} size={22} color={item.achieved ? tierColor : T.text} />
      </View>
      <Text style={{ color: item.achieved ? T.white : T.text, fontSize: 13, fontWeight: '800', marginBottom: 4 }} numberOfLines={1}>
        {item.title}
      </Text>
      <Text style={{ color: T.text, fontSize: 11, marginBottom: 10, lineHeight: 15 }} numberOfLines={2}>
        {item.description}
      </Text>
      <View style={{ height: 4, backgroundColor: T.border, borderRadius: 2, marginBottom: 6, overflow: 'hidden' }}>
        <View style={{ width: `${item.progress * 100}%`, height: '100%', borderRadius: 2, backgroundColor: item.achieved ? tierColor : T.muted }} />
      </View>
      <Text style={{ color: item.achieved ? tierColor : T.text, fontSize: 10, fontWeight: '700' }}>{item.progressLabel}</Text>
      {item.achieved && (
        <Animated.View style={[{ position: 'absolute', top: 10, right: 10 }, { opacity: shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }]}>
          <Ionicons name="checkmark-circle" size={16} color={tierColor} />
        </Animated.View>
      )}
    </Animated.View>
  );
}

function CelebrationPopup({ achievement }: { achievement: Achievement }) {
  const { T } = useTheme();
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const bounceAnim = useRef(new Animated.Value(0)).current;

  const TIER_COLORS = { gold: T.gold, silver: '#C0C0C0', bronze: '#CD7F32', locked: T.border };
  const tierColor = TIER_COLORS[achievement.tier];

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 8 }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    Animated.loop(
      Animated.sequence([
        Animated.spring(bounceAnim, { toValue: -8, useNativeDriver: true, tension: 200, friction: 5 }),
        Animated.spring(bounceAnim, { toValue: 0, useNativeDriver: true, tension: 200, friction: 5 }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.7)',
      zIndex: 999,
      opacity: opacityAnim,
    }}>
      <Animated.View style={{
        transform: [{ scale: scaleAnim }, { translateY: bounceAnim }],
        alignItems: 'center',
        backgroundColor: T.card,
        borderRadius: 32,
        padding: 32,
        borderWidth: 2,
        borderColor: tierColor,
        width: 280,
        shadowColor: tierColor,
        shadowOpacity: 0.5,
        shadowRadius: 30,
        elevation: 20,
      }}>
        <Text style={{ fontSize: 28, marginBottom: 8 }}>✨🎉✨</Text>
        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: tierColor + '25', borderWidth: 2, borderColor: tierColor, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <Ionicons name={achievement.icon as any} size={40} color={tierColor} />
        </View>
        <Text style={{ color: tierColor, fontSize: 12, fontWeight: '900', letterSpacing: 2, marginBottom: 8 }}>
          {achievement.tier.toUpperCase()} ACHIEVEMENT
        </Text>
        <Text style={{ color: T.white, fontSize: 22, fontWeight: '900', textAlign: 'center', marginBottom: 8 }}>
          {achievement.title}
        </Text>
        <Text style={{ color: T.text, fontSize: 14, textAlign: 'center', lineHeight: 20 }}>
          {achievement.description}
        </Text>
        <View style={{ marginTop: 20, backgroundColor: tierColor + '20', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8 }}>
          <Text style={{ color: tierColor, fontWeight: '800', fontSize: 13 }}>🏆 Unlocked!</Text>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

export default function AchievementsScreen() {
  const { T } = useTheme();
  const navigation = useNavigation();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [stats, setStats] = useState({ total: 0, earned: 0 });
  const [celebrateAchievement, setCelebrateAchievement] = useState<Achievement | null>(null);
  const headerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    (async () => {
      const h = await getHistory();
      const a = computeAchievements(h);
      setAchievements(a);
      setStats({ total: a.length, earned: a.filter(x => x.achieved).length });
      Animated.spring(headerAnim, { toValue: 1, useNativeDriver: true, tension: 50, friction: 8 }).start();
      const earned = a.filter(x => x.achieved);
      if (earned.length > 0) {
        setTimeout(() => setCelebrateAchievement(earned[0]), 500);
        setTimeout(() => setCelebrateAchievement(null), 3500);
      }
    })();
  }, [headerAnim]);

  const pct = stats.total > 0 ? Math.round((stats.earned / stats.total) * 100) : 0;

  const TIER_COLORS = { gold: T.gold, silver: '#C0C0C0', bronze: '#CD7F32', locked: T.border };

  return (
    <View style={{ flex: 1, backgroundColor: T.black }}>
      <LinearGradient colors={[T.gold + '12', 'transparent']} style={StyleSheet.absoluteFillObject} pointerEvents="none" />

      <Animated.View
        style={[
          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 56, paddingHorizontal: 20, paddingBottom: 16 },
          { opacity: headerAnim, transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] },
        ]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: T.card, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
            <Ionicons name="arrow-back" size={20} color={T.white} />
          </TouchableOpacity>
          <View>
            <Text style={{ color: T.white, fontSize: 28, fontWeight: '900', letterSpacing: -0.8 }}>Achievements</Text>
            <Text style={{ color: T.text, fontSize: 13, marginTop: 4 }}>{stats.earned} of {stats.total} earned</Text>
          </View>
        </View>
        <View style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 3, borderColor: T.gold, alignItems: 'center', justifyContent: 'center', backgroundColor: T.gold + '20' }}>
          <Text style={{ color: T.gold, fontSize: 16, fontWeight: '900' }}>{pct}%</Text>
          <Text style={{ color: T.gold, fontSize: 8, fontWeight: '800', letterSpacing: 1 }}>DONE</Text>
        </View>
      </Animated.View>

      <View style={{ flexDirection: 'row', gap: 16, paddingHorizontal: 20, paddingBottom: 16 }}>
        {(['bronze', 'silver', 'gold'] as const).map(t => (
          <View key={t} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: TIER_COLORS[t] }} />
            <Text style={{ color: T.text, fontSize: 11, fontWeight: '700' }}>{t.charAt(0).toUpperCase() + t.slice(1)}</Text>
          </View>
        ))}
      </View>

      <FlatList
        data={achievements}
        keyExtractor={item => item.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 12, marginBottom: 12 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        renderItem={({ item, index }) => <AchievementCard item={item} index={index} />}
      />

      {celebrateAchievement && (
        <CelebrationPopup achievement={celebrateAchievement} />
      )}
    </View>
  );
}
