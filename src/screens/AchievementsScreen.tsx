import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, Dimensions, Modal,
} from 'react-native';
import { getHistory } from '../services/history';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/utils/ThemeContext';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OrbBackground } from '../components/OrbBackground';
import { computeAchievements, Achievement, Tier } from '../utils/computeAchievements';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');
const CARD_W = (width - 42) / 2;

const TIER_CONFIG: Record<Tier, { color: string; label: string; ionicon: string; emoji: string }> = {
  locked:    { color: '#3A3A3C', label: 'Locked',    ionicon: 'lock-closed',     emoji: '🔒' },
  bronze:    { color: '#CD7F32', label: 'Bronze',    ionicon: 'medal-outline',   emoji: '🥉' },
  silver:    { color: '#C0C0C0', label: 'Silver',    ionicon: 'medal',           emoji: '🥈' },
  gold:      { color: '#FFD60A', label: 'Gold',      ionicon: 'trophy-outline',  emoji: '🥇' },
  diamond:   { color: '#00C6FF', label: 'Diamond',   ionicon: 'diamond-outline', emoji: '💎' },
  legendary: { color: '#FF6B35', label: 'Legendary', ionicon: 'flame',           emoji: '🔥' },
  mythic:    { color: '#BF5FFF', label: 'Mythic',    ionicon: 'planet',          emoji: '🌌' },
};

const TIER_GRADIENTS: Record<Tier, [string, string]> = {
  locked:    ['#2A2A2C', '#1A1A1C'],
  bronze:    ['#CD7F3240', '#CD7F3215'],
  silver:    ['#C0C0C040', '#C0C0C015'],
  gold:      ['#FFD60A40', '#FFD60A15'],
  diamond:   ['#00C6FF40', '#00C6FF15'],
  legendary: ['#FF6B3540', '#FF6B3515'],
  mythic:    ['#BF5FFF40', '#BF5FFF15'],
};

// ─── Achievement Card ─────────────────────────────────────────────────────────
function AchievementCard({ item, onPress, cardIndex }: { item: Achievement; onPress: () => void; cardIndex: number }) {
  const { T, themeName } = useTheme();
  const isLight = themeName === 'light';
  const tc = TIER_CONFIG[item.tier];
  const anim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 65,
      friction: 9,
    }).start();
    // Only animate glow on first 6 earned items to save CPU
    if (item.achieved && cardIndex < 6) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 2200, useNativeDriver: true }),
          Animated.timing(glowAnim, { toValue: 0, duration: 2200, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [item.achieved]);

  const isLocked = item.tier === 'locked';

  return (
    <Animated.View style={{
      opacity: anim,
      transform: [
        { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) },
        { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) },
      ],
    }}>
      <TouchableOpacity
        activeOpacity={item.achieved ? 0.75 : 0.9}
        onPress={onPress}
        style={[
          styles.card,
          {
            backgroundColor: isLocked
              ? (isLight ? '#E8E8EE' : '#1C1C1E')
              : (isLight ? '#FFF' : T.card),
            borderColor: item.achieved
              ? tc.color + 'AA'
              : (isLight ? '#C0C0C8' : '#2C2C2E'),
            borderWidth: item.achieved ? 2 : 1,
          },
        ]}
      >
        {item.achieved && (
          <LinearGradient
            colors={TIER_GRADIENTS[item.tier]}
            style={StyleSheet.absoluteFill}
          />
        )}

        {/* Glow border for earned */}
        {item.achieved && (
          <Animated.View style={[
            StyleSheet.absoluteFill,
            styles.glowBorder,
            {
              borderColor: tc.color,
              opacity: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.1, 0.45] }),
            },
          ]} />
        )}

        {/* Icon circle */}
        <View style={styles.iconCircleWrap}>
          <View style={[
            styles.iconCircle,
            {
              backgroundColor: item.achieved ? tc.color + '25' : '#2A2A2C',
              borderColor: item.achieved ? tc.color + '55' : '#3A3A3C',
            },
          ]}>
            <Ionicons
              name={item.icon as any}
              size={26}
              color={item.achieved ? tc.color : (isLight ? '#888' : '#555')}
            />
          </View>
        </View>

        {/* Title */}
        <Text
          style={[styles.cardTitle, {
            color: item.achieved
              ? (isLight ? '#1A1A1A' : '#FFFFFF')
              : (isLight ? '#555' : '#666')
          }]}
          numberOfLines={2}
        >
          {item.title}
        </Text>

        {/* Description */}
        <Text
          style={[styles.cardDesc, {
            color: item.achieved
              ? (isLight ? '#444' : '#CCC')
              : (isLight ? '#666' : '#444')
          }]}
          numberOfLines={2}
        >
          {item.description}
        </Text>

        {/* Progress bar */}
        <View style={[styles.progressBg, { backgroundColor: isLight ? '#E0E0E0' : '#2A2A2C' }]}>
          <View style={[
            styles.progressFill,
            {
              backgroundColor: item.achieved ? tc.color : tc.color + '60',
              width: `${Math.round(item.progress * 100)}%`,
            },
          ]} />
        </View>

        {/* Progress label */}
        <Text style={[styles.progressLabel, {
          color: item.achieved
            ? tc.color
            : (isLight ? '#777' : '#555')
        }]}>
          {item.progressLabel}
        </Text>

        {/* Lock overlay for locked items */}
        {isLocked && (
          <View style={styles.lockOverlay}>
            <Ionicons name="lock-closed" size={12} color="#555" />
          </View>
        )}

        {/* XP badge for earned */}
        {item.achieved && (
          <View style={[styles.xpBadge, { backgroundColor: tc.color + '22' }]}>
            <Ionicons name="flash" size={8} color={tc.color} />
            <Text style={[styles.xpBadgeText, { color: tc.color }]}>+{item.xp}</Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Tier Section ─────────────────────────────────────────────────────────────
function TierSection({
  tier,
  items,
  onCardPress,
}: {
  tier: Tier;
  items: Achievement[];
  onCardPress: (a: Achievement) => void;
}) {
  if (!items.length) return null;
  const tc = TIER_CONFIG[tier];
  const earnedCount = items.filter(i => i.achieved).length;

  return (
    <View style={styles.tierSection}>
      {/* Tier header */}
      <View style={styles.tierHeader}>
        <View style={[styles.tierIconWrap, { backgroundColor: tc.color + '20' }]}>
          <Ionicons name={tc.ionicon as any} size={14} color={tc.color} />
        </View>
        <Text style={[styles.tierLabel, { color: tc.color }]}>
          {tc.label.toUpperCase()}
        </Text>
        <View style={[styles.tierLine, { backgroundColor: tc.color + '20' }]} />
        <View style={[styles.tierCountBadge, { backgroundColor: tc.color + '18', borderColor: tc.color + '30' }]}>
          <Text style={[styles.tierCountText, { color: tc.color }]}>
            {earnedCount}/{items.length}
          </Text>
        </View>
      </View>

      {/* Grid cabinet layout of cards */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16 }}>
        {items.map((item, idx) => (
          <AchievementCard
            key={item.id}
            item={item}
            cardIndex={idx}
            onPress={() => onCardPress(item)}
          />
        ))}
      </View>
    </View>
  );
}

// ─── Confetti Particle ────────────────────────────────────────────────────────
function ConfettiParticle({ color, delay }: { color: string; delay: number }) {
  const y = useRef(new Animated.Value(-20)).current;
  const x = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const startX = (Math.random() - 0.5) * width;
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(y, { toValue: 700, duration: 2200, useNativeDriver: true }),
        Animated.timing(x, { toValue: startX, duration: 2200, useNativeDriver: true }),
        Animated.timing(rotate, { toValue: 1, duration: 2200, useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(1600),
          Animated.timing(opacity, { toValue: 0, duration: 600, useNativeDriver: true }),
        ]),
      ]),
    ]).start();
  }, []);

  return (
    <Animated.View style={{
      position: 'absolute',
      top: 60,
      left: width / 2,
      width: 8,
      height: 8,
      borderRadius: 2,
      backgroundColor: color,
      opacity,
      transform: [
        { translateY: y },
        { translateX: x },
        { rotate: rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '720deg'] }) },
      ],
    }} />
  );
}

// ─── Celebration Popup ────────────────────────────────────────────────────────
function CelebrationPopup({ achievement, onDismiss }: { achievement: Achievement; onDismiss: () => void }) {
  const { T } = useTheme();
  const tc = TIER_CONFIG[achievement.tier];
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const xpBarAnim = useRef(new Animated.Value(0)).current;

  const confettiColors = ['#FFD60A', '#BF5FFF', '#00C6FF', '#FF6B35', '#CD7F32', '#C0C0C0', '#FF3B30'];

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 90, friction: 7 }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start(() => {
      Animated.timing(xpBarAnim, { toValue: 1, duration: 900, useNativeDriver: false }).start();
    });
  }, []);

  return (
    <Animated.View style={[styles.celebOverlay, { opacity: opacityAnim }]}>
      <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onDismiss} />

      {/* Confetti */}
      {confettiColors.map((c, i) => (
        <ConfettiParticle key={i} color={c} delay={i * 80} />
      ))}

      <Animated.View style={[
        styles.celebCard,
        {
          borderColor: tc.color,
          shadowColor: tc.color,
          transform: [{ scale: scaleAnim }],
        },
      ]}>
        <LinearGradient
          colors={TIER_GRADIENTS[achievement.tier]}
          style={StyleSheet.absoluteFill}
        />

        <Text style={styles.celebEmoji}>✨🎉✨</Text>

        {/* Icon */}
        <View style={[styles.celebIconWrap, { backgroundColor: tc.color + '22', borderColor: tc.color }]}>
          <Ionicons name={achievement.icon as any} size={48} color={tc.color} />
        </View>

        {/* Tier badge */}
        <View style={[styles.celebTierBadge, { backgroundColor: tc.color + '20' }]}>
          <Ionicons name={tc.ionicon as any} size={12} color={tc.color} />
          <Text style={[styles.celebTierText, { color: tc.color }]}>
            {tc.label.toUpperCase()} ACHIEVEMENT
          </Text>
        </View>

        <Text style={styles.celebTitle}>{achievement.title}</Text>
        <Text style={styles.celebDesc}>{achievement.description}</Text>

        {/* XP row */}
        <View style={[styles.celebXpRow, { backgroundColor: tc.color + '18', borderColor: tc.color + '40' }]}>
          <Ionicons name="flash" size={14} color={tc.color} />
          <Text style={[styles.celebXpText, { color: tc.color }]}>+{achievement.xp} XP Earned!</Text>
        </View>

        {/* Animated XP bar */}
        <View style={styles.celebXpBarBg}>
          <Animated.View style={[
            styles.celebXpBarFill,
            {
              backgroundColor: tc.color,
              width: xpBarAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
            },
          ]} />
        </View>

        {/* Dismiss button */}
        <TouchableOpacity onPress={onDismiss} style={[styles.celebBtn, { overflow: 'hidden' }]}>
          <LinearGradient
            colors={[tc.color, tc.color + 'BB']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
          <Text style={styles.celebBtnText}>AWESOME!</Text>
        </TouchableOpacity>

        <Text style={styles.celebHint}>Tap anywhere to dismiss</Text>
      </Animated.View>
    </Animated.View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function AchievementsScreen() {
  const { T } = useTheme();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [celebrateAchievement, setCelebrateAchievement] = useState<Achievement | null>(null);
  const [filter, setFilter] = useState<'all' | 'earned' | 'locked'>('all');
  const headerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    (async () => {
      const h = await getHistory();
      const a = computeAchievements(h);
      setAchievements(a);
      Animated.spring(headerAnim, { toValue: 1, useNativeDriver: true, tension: 50, friction: 8 }).start();
    })();
  }, []);

  const earned = achievements.filter(a => a.achieved);
  const totalXp = earned.reduce((s, a) => s + a.xp, 0);
  const pct = achievements.length > 0 ? Math.round((earned.length / achievements.length) * 100) : 0;

  const filtered = achievements.filter(a => {
    if (filter === 'earned') return a.achieved;
    if (filter === 'locked') return !a.achieved;
    return true;
  });

  const tierOrder: Tier[] = ['mythic', 'legendary', 'diamond', 'gold', 'silver', 'bronze', 'locked'];

  const handleCardPress = (item: Achievement) => {
    if (item.achieved) {
      setCelebrateAchievement(item);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: T.black }]}>
      <OrbBackground />
      <LinearGradient
        colors={[T.gold + '14', 'transparent']}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        <Animated.View style={{
          opacity: headerAnim,
          transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) }],
        }}>
          {/* ── Header row ── */}
          <View style={[styles.headerRow, { paddingTop: insets.top + 16 }]}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={[styles.backBtn, { backgroundColor: T.card, borderColor: T.border }]}
            >
              <Ionicons name="arrow-back" size={20} color={T.white} />
            </TouchableOpacity>
            <Text style={[styles.screenTitle, { color: T.white }]}>Achievements</Text>
          </View>

          {/* ── Hero card ── */}
          <View style={[styles.heroCard, { backgroundColor: T.card, borderColor: T.border }]}>
            {/* Progress ring (SVG-style via View borders) */}
            <View style={styles.ringOuter}>
              <View style={[styles.ringTrack, { borderColor: T.border }]}>
                {/* Filled arc approximation using a colored overlay */}
                <View style={[
                  styles.ringFill,
                  {
                    borderColor: T.gold,
                    // Rotate to show progress: 0% = -90deg, 100% = 270deg
                    transform: [{ rotate: `${-90 + (pct / 100) * 360}deg` }],
                  },
                ]} />
                <View style={[styles.ringCenter, { backgroundColor: T.black }]}>
                  <Text style={[styles.ringPct, { color: T.gold }]}>{pct}%</Text>
                  <Text style={[styles.ringLabel, { color: T.text }]}>DONE</Text>
                </View>
              </View>
            </View>

            {/* Stat pills */}
            <View style={styles.statPills}>
              {[
                { label: 'Earned',   value: earned.length,                    color: '#30D158', icon: 'checkmark-circle' as const },
                { label: 'Locked',   value: achievements.length - earned.length, color: T.text,   icon: 'lock-closed' as const },
                { label: 'Total XP', value: totalXp,                          color: T.gold,   icon: 'flash' as const },
              ].map(s => (
                <View key={s.label} style={[styles.statPill, { backgroundColor: T.black + 'AA', borderColor: T.border }]}>
                  <Ionicons name={s.icon} size={13} color={s.color} />
                  <Text style={[styles.statPillValue, { color: s.color }]}>
                    {s.value.toLocaleString()}
                  </Text>
                  <Text style={[styles.statPillLabel, { color: T.text }]}>{s.label}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* ── XP progress bar ── */}
          <View style={styles.xpBarSection}>
            <View style={styles.xpBarLabelRow}>
              <Text style={[styles.xpBarLabelLeft, { color: T.text }]}>OVERALL PROGRESS</Text>
              <Text style={[styles.xpBarLabelRight, { color: T.gold }]}>{totalXp.toLocaleString()} XP</Text>
            </View>
            <View style={[styles.xpBarBg, { backgroundColor: '#2A2A2C' }]}>
              <LinearGradient
                colors={[T.gold, T.gold + 'AA']}
                style={[styles.xpBarFill, { width: `${pct}%` }]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              />
            </View>
          </View>

          {/* ── Filter tabs ── */}
          <View style={styles.filterRow}>
            {(['all', 'earned', 'locked'] as const).map(f => (
              <TouchableOpacity
                key={f}
                onPress={() => setFilter(f)}
                style={[
                  styles.filterPill,
                  {
                    backgroundColor: filter === f ? T.gold + '20' : T.card,
                    borderColor: filter === f ? T.gold : T.border,
                  },
                ]}
              >
                <Text style={[styles.filterPillText, { color: filter === f ? T.gold : T.text }]}>
                  {f === 'all'
                    ? `All (${achievements.length})`
                    : f === 'earned'
                    ? `Earned (${earned.length})`
                    : `Locked (${achievements.length - earned.length})`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>

        {/* ── Tier sections ── */}
        {tierOrder.map(tier => {
          const items = filtered.filter(a => a.tier === tier);
          return (
            <TierSection
              key={tier}
              tier={tier}
              items={items}
              onCardPress={handleCardPress}
            />
          );
        })}

        {filtered.length === 0 && (
          <View style={styles.emptyWrap}>
            <View style={[styles.emptyIcon, { backgroundColor: T.card, borderColor: T.border }]}>
              <Ionicons name="trophy-outline" size={36} color={T.gold} />
            </View>
            <Text style={[styles.emptyTitle, { color: T.white }]}>No achievements yet</Text>
            <Text style={[styles.emptyDesc, { color: T.text }]}>Start running to unlock achievements!</Text>
          </View>
        )}
      </ScrollView>

      {/* ── Celebration Modal (guaranteed top-level rendering) ── */}
      <Modal
        visible={!!celebrateAchievement}
        transparent
        animationType="none"
        statusBarTranslucent
      >
        {celebrateAchievement && (
          <CelebrationPopup
            achievement={celebrateAchievement}
            onDismiss={() => setCelebrateAchievement(null)}
          />
        )}
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  screenTitle: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
  },

  // Hero card
  heroCard: {
    marginHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  ringOuter: {
    width: 80,
    height: 80,
  },
  ringTrack: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  ringFill: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderTopColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  ringCenter: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringPct: {
    fontSize: 15,
    fontWeight: '900',
  },
  ringLabel: {
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  statPills: {
    flex: 1,
    gap: 8,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
  },
  statPillValue: {
    fontSize: 14,
    fontWeight: '900',
  },
  statPillLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 'auto',
  },

  // XP bar
  xpBarSection: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  xpBarLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  xpBarLabelLeft: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  xpBarLabelRight: {
    fontSize: 10,
    fontWeight: '800',
  },
  xpBarBg: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  xpBarFill: {
    height: '100%',
    borderRadius: 4,
  },

  // Filter tabs
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  filterPill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '700',
  },

  // Tier section
  tierSection: {
    marginTop: 16,
  },
  tierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  tierIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tierLabel: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  tierLine: {
    flex: 1,
    height: 1,
  },
  tierCountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  tierCountText: {
    fontSize: 11,
    fontWeight: '800',
  },
  tierScrollContent: {
    paddingHorizontal: 16,
    gap: 10,
    paddingBottom: 4,
  },

  // Achievement card
  card: {
    width: CARD_W,
    borderRadius: 20,
    padding: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  glowBorder: {
    borderRadius: 20,
    borderWidth: 2,
  },
  iconCircleWrap: {
    alignItems: 'center',
    marginBottom: 10,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
    lineHeight: 18,
  },
  cardDesc: {
    fontSize: 11,
    lineHeight: 15,
    marginBottom: 10,
  },
  progressBg: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressLabel: {
    fontSize: 9,
    fontWeight: '700',
    marginBottom: 4,
  },
  lockOverlay: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  xpBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
  },
  xpBadgeText: {
    fontSize: 8,
    fontWeight: '900',
  },

  // Empty state
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 16,
  },
  emptyDesc: {
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
  },

  // Celebration popup
  celebOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  celebCard: {
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: 28,
    padding: 28,
    borderWidth: 2,
    width: width - 48,
    shadowOpacity: 0.8,
    shadowRadius: 40,
    elevation: 24,
    overflow: 'hidden',
  },
  celebEmoji: {
    fontSize: 30,
    marginBottom: 12,
  },
  celebIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  celebTierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    marginBottom: 10,
  },
  celebTierText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  celebTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  celebDesc: {
    color: '#AAA',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 16,
  },
  celebXpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  celebXpText: {
    fontSize: 14,
    fontWeight: '900',
  },
  celebXpBarBg: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    backgroundColor: '#2A2A2C',
    overflow: 'hidden',
    marginBottom: 20,
  },
  celebXpBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  celebBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  celebBtnText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  celebHint: {
    color: '#555',
    fontSize: 11,
  },
});
