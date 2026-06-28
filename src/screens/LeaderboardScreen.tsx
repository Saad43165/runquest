import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, Animated,
  TouchableOpacity, TextInput, Dimensions, Image,
} from 'react-native';
import { ensureUserId, getDisplayName } from '../config/user';
import { auth } from '../services/firebase';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/utils/ThemeContext';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTerritories } from '../context/TerritoriesContext';
import { OrbBackground } from '../components/OrbBackground';
import { getUserTeam } from '../services/teamsService';
import { followUser, unfollowUser, subscribeFollowing } from '../services/friendsService';
import { getUserProfile } from '../services/authService';

const { width } = Dimensions.get('window');

type Rank = {
  ownerId: string;
  ownerName: string;
  ownerPhotoURL?: string | null;
  totalArea: number;
  count: number;
  color: string;
  teamId?: string;
  teamColor?: string;
  teamTag?: string;
  isPremium?: boolean;
};

// ─── Avatar styles — 20 unique cartoon styles ─────────────────────────────────
const AVATAR_STYLES = [
  'adventurer', 'adventurer-neutral', 'avataaars', 'avataaars-neutral',
  'big-ears', 'big-ears-neutral', 'big-smile', 'bottts', 'bottts-neutral',
  'croodles', 'croodles-neutral', 'fun-emoji', 'icons', 'identicon',
  'initials', 'lorelei', 'lorelei-neutral', 'micah', 'miniavs', 'notionists',
];
function getAvatarStyle(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffffffff;
  return AVATAR_STYLES[Math.abs(h) % AVATAR_STYLES.length];
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ photoURL, ownerId, color, size = 44 }: {
  photoURL?: string | null; ownerId: string; color: string; size?: number;
}) {
  const [err, setErr] = useState(false);
  const style = getAvatarStyle(ownerId);
  const url = photoURL && !err
    ? photoURL
    : `https://api.dicebear.com/7.x/${style}/png?seed=${encodeURIComponent(ownerId)}&backgroundColor=transparent&size=128`;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2.5, overflow: 'hidden', borderWidth: 2, borderColor: color + '60', backgroundColor: color + '20' }}>
      <Image source={{ uri: url }} style={{ width: size, height: size }} onError={() => setErr(true)} />
    </View>
  );
}

// ─── Podium ───────────────────────────────────────────────────────────────────
function PodiumItem({ rank, item, isMe }: { rank: number; item: Rank; isMe: boolean }) {
  const { T } = useTheme();
  const heights = [130, 90, 68];
  const medals = ['🥇', '🥈', '🥉'];
  const colors = [T.gold, '#C0C0C0', '#CD7F32'];
  const h = heights[rank - 1] ?? 50;
  const c = colors[rank - 1] ?? T.muted;
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const rankScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1, delay: (rank - 1) * 100,
      useNativeDriver: true, tension: 80, friction: 9,
    }).start();

    Animated.sequence([
      Animated.delay((rank - 1) * 150 + 200),
      Animated.spring(rankScale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 6,
      }),
    ]).start();

    if (rank === 1) {
      Animated.loop(Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 1500, useNativeDriver: true }),
      ])).start();
    }
  }, []);

  return (
    <Animated.View style={[
      { alignItems: 'center', flex: 1, justifyContent: 'flex-end' },
      { transform: [{ scale: scaleAnim }], opacity: scaleAnim },
    ]}>
      {rank === 1 && <Text style={{ fontSize: 24, marginBottom: 4 }}>👑</Text>}

      {/* Glow ring for #1 */}
      {rank === 1 && (
        <Animated.View style={{
          position: 'absolute', top: 24, width: 64, height: 64, borderRadius: 32,
          borderWidth: 2, borderColor: c,
          opacity: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.7] }),
        }} />
      )}

      <Avatar photoURL={null} ownerId={item.ownerId} color={c} size={rank === 1 ? 56 : 44} />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 6, marginBottom: 2 }}>
        <Text style={{ color: isMe ? T.green : T.white, fontSize: 11, fontWeight: '800', textAlign: 'center', maxWidth: item.isPremium ? 65 : 80 }} numberOfLines={1}>
          {item.ownerName}
        </Text>
        {item.isPremium && <FontAwesome5 name="crown" size={8} color="#FFD60A" />}
      </View>
      <Text style={{ color: T.text, fontSize: 10, marginBottom: 8 }}>
        {item.totalArea >= 1000 ? `${(item.totalArea / 1000).toFixed(1)}k` : Math.round(item.totalArea)} m²
      </Text>

      {/* Podium block */}
      <View style={[styles.podiumBlock, { height: h, borderColor: c + '50', backgroundColor: c + '18' }]}>
        <Text style={{ fontSize: rank === 1 ? 24 : 20 }}>{medals[rank - 1]}</Text>
        <Animated.Text style={{ color: c, fontSize: rank === 1 ? 16 : 13, fontWeight: '900', marginTop: 4, transform: [{ scale: rankScale }] }}>
          #{rank}
        </Animated.Text>
      </View>
    </Animated.View>
  );
}

// ─── Rank Row — memoized for FlatList performance ────────────────────────────
const RankRow = React.memo(function RankRow({
  item, rank, isMe, isFollowing, onToggleFollow, maxArea,
}: {
  item: Rank; rank: number; isMe: boolean;
  isFollowing?: boolean; onToggleFollow?: (uid: string) => void;
  maxArea: number;
}) {
  const { T } = useTheme();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(anim, { toValue: 1, delay: Math.min((rank - 4) * 35, 300), useNativeDriver: true, tension: 60, friction: 9 }).start();
  }, []);

  const rankColors: Record<number, string> = { 1: T.gold, 2: '#C0C0C0', 3: '#CD7F32' };
  const rc = rankColors[rank] ?? T.text;
  const pct = maxArea > 0 ? Math.min(100, Math.max(2, (item.totalArea / maxArea) * 100)) : 2;

  return (
    <Animated.View style={[
      styles.rankRow,
      { backgroundColor: isMe ? T.green + '14' : T.card, borderColor: isMe ? T.green : T.border },
      { opacity: anim, transform: [{ translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] },
    ]}>
      {/* Left neon green bar for personal rank highlighting */}
      {isMe && (
        <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, borderTopLeftRadius: 18, borderBottomLeftRadius: 18, backgroundColor: T.green }} />
      )}

      {/* Rank badge */}
      <View style={[styles.rankBadge, { backgroundColor: rc + '18', borderColor: rc + '30' }]}>
        <Text style={{ fontSize: 12, fontWeight: '900', color: rc }}>{rank}</Text>
      </View>

      {/* Avatar */}
      <Avatar photoURL={item.ownerPhotoURL} ownerId={item.ownerId} color={isMe ? T.green : item.color} size={40} />

      {/* Info */}
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ color: isMe ? T.green : T.white, fontSize: 14, fontWeight: '800' }} numberOfLines={1}>
            {item.ownerName}
          </Text>
          {item.isPremium && (
            <FontAwesome5 name="crown" size={10} color="#FFD60A" />
          )}
          {isMe && (
            <View style={[styles.youBadge, { backgroundColor: T.green + '20' }]}>
              <Text style={{ color: T.green, fontSize: 9, fontWeight: '900' }}>YOU</Text>
            </View>
          )}
          {item.teamId && item.teamColor && (
            <View style={{ backgroundColor: item.teamColor + '25', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5, borderWidth: 1, borderColor: item.teamColor + '50' }}>
              <Text style={{ color: item.teamColor, fontSize: 8, fontWeight: '900' }}>TEAM</Text>
            </View>
          )}
        </View>
        <Text style={{ color: T.text, fontSize: 11, marginTop: 2 }}>
          {item.count} {item.count === 1 ? 'territory' : 'territories'} · {item.totalArea >= 1000 ? `${(item.totalArea / 1000).toFixed(1)}k` : Math.round(item.totalArea)} m²
        </Text>
        {/* Progress bar vs #1 */}
        <View style={{ height: 4, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 2, marginTop: 6, overflow: 'hidden', width: '95%' }}>
          <View style={{ height: '100%', width: `${pct}%`, backgroundColor: isMe ? T.green : item.color || T.accent2 || '#00C6FF', borderRadius: 2 }} />
        </View>
      </View>

      {/* Area */}
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <Text style={{ color: isMe ? T.green : T.white, fontSize: 17, fontWeight: '900' }}>
          {item.totalArea >= 1000 ? `${(item.totalArea / 1000).toFixed(1)}k` : Math.round(item.totalArea)}
        </Text>
        <Text style={{ color: T.text, fontSize: 9, fontWeight: '700' }}>m²</Text>
      </View>

      {/* Follow button — only show for others */}
      {!isMe && onToggleFollow && (
        <TouchableOpacity
          onPress={() => onToggleFollow(item.ownerId)}
          style={[
            styles.followBtn,
            isFollowing
              ? { backgroundColor: T.green + '20', borderColor: T.green + '50' }
              : { backgroundColor: T.card, borderColor: T.border },
          ]}
        >
          <Text style={{ color: isFollowing ? T.green : T.text, fontSize: 10, fontWeight: '800' }}>
            {isFollowing ? 'Following' : 'Follow'}
          </Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
});

// ─── Stat Pill ────────────────────────────────────────────────────────────────
function StatPill({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) {
  const { T } = useTheme();
  return (
    <View style={[styles.statPill, { backgroundColor: T.card, borderColor: T.border }]}>
      <View style={[styles.statPillIcon, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon as any} size={16} color={color} />
      </View>
      <Text style={{ color: T.white, fontSize: 16, fontWeight: '900' }}>{value}</Text>
      <Text style={{ color: T.text, fontSize: 9, fontWeight: '800', letterSpacing: 0.8 }}>{label}</Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function LeaderboardScreen() {
  const { T } = useTheme();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { territories } = useTerritories();
  const [ranks, setRanks] = useState<Rank[]>([]);
  const [myUid, setMyUid] = useState('');
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [timeTab, setTimeTab] = useState<'alltime' | 'week' | 'month' | 'friends'>('alltime');
  const [followingUids, setFollowingUids] = useState<Set<string>>(new Set());
  const headerAnim = useRef(new Animated.Value(0)).current;

  const tabWidth = (width - 40) / 4;
  const slideX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const tabIndices = { alltime: 0, week: 1, month: 2, friends: 3 };
    const idx = tabIndices[timeTab] ?? 0;
    Animated.spring(slideX, {
      toValue: idx * tabWidth,
      useNativeDriver: true,
      tension: 100,
      friction: 11,
    }).start();
  }, [timeTab]);

  // Subscribe to following list
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const unsub = subscribeFollowing(uid, (uids) => setFollowingUids(new Set(uids)));
    return unsub;
  }, []);

  const handleToggleFollow = async (targetUid: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Optimistic UI update — don't wait for subscription to fire
    const isFollowing = followingUids.has(targetUid);
    setFollowingUids(prev => {
      const next = new Set(prev);
      if (isFollowing) next.delete(targetUid); else next.add(targetUid);
      return next;
    });
    try {
      if (isFollowing) {
        await unfollowUser(targetUid);
      } else {
        await followUser(targetUid);
      }
    } catch {
      // Revert on error
      setFollowingUids(prev => {
        const next = new Set(prev);
        if (isFollowing) next.add(targetUid); else next.delete(targetUid);
        return next;
      });
    }
  };

  const handleTabChange = (tab: typeof timeTab) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimeTab(tab);
  };

  useEffect(() => {
    (async () => {
      const uid = auth.currentUser?.uid || await ensureUserId();
      const name = await getDisplayName();
      setMyUid(uid);

      const nameMap = new Map<string, { displayName: string; username: string; photoURL: string | null; isPremium?: boolean }>();
      const ownerIds = Array.from(new Set(territories.map(t => t.ownerId)));
      await Promise.all(ownerIds.map(async (ownerId) => {
        try {
          const profile = await getUserProfile(ownerId);
          nameMap.set(ownerId, {
            displayName: profile?.displayName || 'Unknown Warrior',
            username: profile?.username || '',
            photoURL: profile?.photoURL || null,
            isPremium: profile?.isPremium || false,
          });
        } catch {
          const t = territories.find(x => x.ownerId === ownerId);
          nameMap.set(ownerId, {
            displayName: t?.ownerDisplayName || 'Unknown Warrior',
            username: t?.ownerUsername || '',
            photoURL: t?.ownerPhotoURL || null,
            isPremium: false,
          });
        }
      }));

      const map = new Map<string, { area: number; count: number; color: string; photoURL?: string | null; teamId?: string; teamColor?: string; teamTag?: string }>();
      for (const t of territories) {
        const cur = map.get(t.ownerId) || { area: 0, count: 0, color: t.color, photoURL: t.ownerPhotoURL, teamId: t.teamId, teamColor: t.teamColor };
        cur.area += t.areaSqMeters || 0;
        cur.count += 1;
        // Keep team info from most recent territory
        if (t.teamId) { cur.teamId = t.teamId; cur.teamColor = t.teamColor; }
        map.set(t.ownerId, cur);
      }

      const arr: Rank[] = Array.from(map.entries())
        .map(([ownerId, v]) => {
          const nameInfo = nameMap.get(ownerId);
          return {
            ownerId,
            ownerName: ownerId === uid
              ? name
              : (nameInfo?.username || nameInfo?.displayName || 'Unknown Warrior'),
            ownerPhotoURL: ownerId === uid
              ? (auth.currentUser?.photoURL || v.photoURL)
              : v.photoURL,
            totalArea: v.area,
            count: v.count,
            color: v.color,
            teamId: v.teamId,
            teamColor: v.teamColor,
            isPremium: nameInfo?.isPremium || false,
          };
        })
        .sort((a, b) => b.totalArea - a.totalArea);

      setRanks(arr);
    })();
    Animated.spring(headerAnim, { toValue: 1, useNativeDriver: true, tension: 50, friction: 8 }).start();
  }, [territories]);

  // Filter territories by time window for weekly/monthly tabs
  const filteredRanks = useMemo(() => {
    if (timeTab === 'alltime') return ranks;

    const now = Date.now();
    const cutoff = timeTab === 'week'
      ? now - 7 * 24 * 60 * 60 * 1000
      : timeTab === 'month'
        ? now - 30 * 24 * 60 * 60 * 1000
        : 0;

    if (timeTab === 'friends') {
      return ranks.filter(r => followingUids.has(r.ownerId) || r.ownerId === myUid);
    }

    // Rebuild ranks from time-filtered territories
    const filteredTerritories = territories.filter(t => t.createdAt >= cutoff);
    const map = new Map<string, { area: number; count: number }>();
    for (const t of filteredTerritories) {
      const cur = map.get(t.ownerId) || { area: 0, count: 0 };
      cur.area += t.areaSqMeters || 0;
      cur.count += 1;
      map.set(t.ownerId, cur);
    }

    return ranks
      .filter(r => map.has(r.ownerId))
      .map(r => {
        const v = map.get(r.ownerId)!;
        return { ...r, totalArea: v.area, count: v.count };
      })
      .sort((a, b) => b.totalArea - a.totalArea);
  }, [ranks, timeTab, territories, followingUids, myUid]);

  const filtered = useMemo(() =>
    search.trim()
      ? filteredRanks.filter(r => r.ownerName.toLowerCase().includes(search.toLowerCase()))
      : filteredRanks,
    [filteredRanks, search]
  );

  const top3 = filtered.slice(0, 3);
  const rest = filtered.slice(3);
  const myRank = filteredRanks.findIndex(r => r.ownerId === myUid);
  const myData = filteredRanks.find(r => r.ownerId === myUid);
  const totalArea = filteredRanks.reduce((s, r) => s + r.totalArea, 0);

  const TIME_TABS: { id: typeof timeTab; label: string }[] = [
    { id: 'alltime', label: 'All Time' },
    { id: 'week', label: 'This Week' },
    { id: 'month', label: 'This Month' },
    { id: 'friends', label: 'Friends' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: T.black }}>
      <OrbBackground />
      <LinearGradient colors={[T.gold + '14', 'transparent']} style={StyleSheet.absoluteFillObject} pointerEvents="none" />

      <FlatList
        data={search ? filtered : rest}
        keyExtractor={item => item.ownerId}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}
        ListEmptyComponent={
          ranks.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 60, paddingHorizontal: 24 }}>
              <View style={[styles.emptyIcon, { backgroundColor: T.card, borderColor: T.border }]}>
                <Ionicons name="trophy-outline" size={40} color={T.gold} />
              </View>
              <Text style={{ color: T.white, fontSize: 20, fontWeight: '900', marginTop: 20 }}>No warriors yet</Text>
              <Text style={{ color: T.text, fontSize: 13, marginTop: 8, textAlign: 'center', lineHeight: 20 }}>
                Claim territories to appear{'\n'}on the leaderboard
              </Text>
              <View style={{ marginTop: 24, backgroundColor: T.card, borderRadius: 18, borderWidth: 1, borderColor: T.border, padding: 16, width: '100%', gap: 10 }}>
                {[
                  { icon: 'map', text: 'Run a closed GPS loop to claim land', color: T.green },
                  { icon: 'flash', text: 'Overlap 50%+ of enemy territory to invade', color: '#FF453A' },
                  { icon: 'podium', text: 'Ranked by total territory area worldwide', color: T.gold },
                ].map((tip, i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: tip.color + '18', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name={tip.icon as any} size={16} color={tip.color} />
                    </View>
                    <Text style={{ color: T.text, fontSize: 12, flex: 1, lineHeight: 18 }}>{tip.text}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null
        }
        ListHeaderComponent={
          <>
            {/* Header */}
            <Animated.View style={[styles.header, { paddingTop: insets.top + 16, opacity: headerAnim }]}>
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                style={[styles.iconBtn, { backgroundColor: T.card, borderColor: T.border }]}
                accessibilityLabel="Go back"
                accessibilityRole="button"
              >
                <Ionicons name="arrow-back" size={20} color={T.white} />
              </TouchableOpacity>

              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: T.white }]}>Leaderboard</Text>
                <Text style={{ color: T.text, fontSize: 12, marginTop: 2 }}>
                  {ranks.length} warriors competing
                </Text>
              </View>

              {myRank >= 0 && (
                <View style={[styles.myRankBadge, { backgroundColor: T.green + '18', borderColor: T.green + '40' }]}>
                  <Ionicons name="person" size={11} color={T.green} />
                  <Text style={{ color: T.green, fontWeight: '900', fontSize: 13 }}>#{myRank + 1}</Text>
                </View>
              )}

              <TouchableOpacity
                onPress={() => setShowSearch(v => !v)}
                style={[styles.iconBtn, { backgroundColor: showSearch ? T.green + '20' : T.card, borderColor: showSearch ? T.green : T.border }]}
              >
                <Ionicons name="search" size={18} color={showSearch ? T.green : T.white} />
              </TouchableOpacity>
            </Animated.View>

            {/* Search bar */}
            {showSearch && (
              <View style={[styles.searchBar, { backgroundColor: T.card, borderColor: T.border }]}>
                <Ionicons name="search" size={16} color={T.text} />
                <TextInput
                  style={{ flex: 1, color: T.white, fontSize: 14, paddingVertical: 0 }}
                  placeholder="Search warriors..."
                  placeholderTextColor={T.text + '80'}
                  value={search}
                  onChangeText={setSearch}
                  autoFocus
                />
                {search.length > 0 && (
                  <TouchableOpacity onPress={() => setSearch('')}>
                    <Ionicons name="close-circle" size={16} color={T.text} />
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Time filter tabs */}
            <View style={[styles.timeTabs, { backgroundColor: T.card, borderColor: T.border, position: 'relative' }]}>
              <Animated.View style={{
                position: 'absolute',
                top: 4, left: 4, bottom: 4,
                width: tabWidth,
                backgroundColor: T.green + '22',
                borderRadius: 12,
                transform: [{ translateX: slideX }],
              }} />
              {TIME_TABS.map(t => (
                <TouchableOpacity
                  key={t.id}
                  onPress={() => handleTabChange(t.id)}
                  style={styles.timeTabBtn}
                  activeOpacity={0.8}
                >
                  <Text style={{
                    color: timeTab === t.id ? T.green : T.text,
                    fontSize: 11,
                    fontWeight: timeTab === t.id ? '900' : '600',
                  }}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Stats pills */}
            <View style={styles.statsRow}>
              <StatPill label="WARRIORS" value={String(ranks.length)} icon="people-outline" color={T.accent2} />
              <StatPill label="TERRITORIES" value={String(territories.length)} icon="map-outline" color={T.green} />
              <StatPill label="TOTAL AREA" value={totalArea >= 1000 ? `${(totalArea / 1000).toFixed(0)}k` : String(Math.round(totalArea))} icon="expand-outline" color={T.gold} />
            </View>

            {/* My rank card */}
            {myData && !search && (
              <View style={[styles.myCard, { backgroundColor: T.green + '10', borderColor: T.green + '30' }]}>
                <LinearGradient colors={[T.green + '18', 'transparent']} style={StyleSheet.absoluteFill} />
                <Avatar photoURL={myData.ownerPhotoURL} ownerId={myData.ownerId} color={T.green} size={48} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: T.green, fontSize: 10, fontWeight: '800', letterSpacing: 1 }}>YOUR STANDING</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                    <Text style={{ color: T.white, fontSize: 16, fontWeight: '900' }}>{myData.ownerName}</Text>
                    {myData.isPremium && <FontAwesome5 name="crown" size={12} color="#FFD60A" />}
                  </View>
                  <Text style={{ color: T.text, fontSize: 12, marginTop: 2 }}>
                    {myData.count} territories · {(myData.totalArea / 1000).toFixed(2)}k m²
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: T.text, fontSize: 10, fontWeight: '700' }}>RANK</Text>
                  <Text style={{ color: T.green, fontSize: 34, fontWeight: '900', lineHeight: 38 }}>#{myRank + 1}</Text>
                  <Text style={{ color: T.text, fontSize: 10 }}>of {ranks.length}</Text>
                </View>
              </View>
            )}

            {/* Podium */}
            {top3.length >= 1 && !search && (
              <View style={styles.podiumSection}>
                <View style={styles.podiumLabelRow}>
                  <View style={[styles.podiumLine, { backgroundColor: T.gold + '30' }]} />
                  <Text style={{ color: T.gold, fontSize: 10, fontWeight: '900', letterSpacing: 2, paddingHorizontal: 12 }}>TOP WARRIORS</Text>
                  <View style={[styles.podiumLine, { backgroundColor: T.gold + '30' }]} />
                </View>

                {top3.length >= 2 ? (
                  <View style={styles.podiumRow}>
                    {top3.length > 1 && <PodiumItem rank={2} item={top3[1]} isMe={top3[1].ownerId === myUid} />}
                    <PodiumItem rank={1} item={top3[0]} isMe={top3[0].ownerId === myUid} />
                    {top3.length > 2 && <PodiumItem rank={3} item={top3[2]} isMe={top3[2].ownerId === myUid} />}
                  </View>
                ) : (
                  <View style={[styles.myCard, { backgroundColor: T.gold + '12', borderColor: T.gold + '40' }]}>
                    <Text style={{ fontSize: 36 }}>👑</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: T.gold, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>CHAMPION</Text>
                      <Text style={{ color: T.white, fontSize: 16, fontWeight: '900', marginTop: 3 }}>{top3[0].ownerName}</Text>
                      <Text style={{ color: T.text, fontSize: 12, marginTop: 2 }}>
                        {top3[0].count} territories · {(top3[0].totalArea / 1000).toFixed(2)}k m²
                      </Text>
                    </View>
                    <Text style={{ color: T.gold, fontSize: 28, fontWeight: '900' }}>🥇</Text>
                  </View>
                )}
              </View>
            )}

            {/* Rankings label */}
            {rest.length > 0 && !search && (
              <View style={styles.rankingsLabel}>
                <View style={[styles.podiumLine, { backgroundColor: T.border }]} />
                <Text style={{ color: T.text, fontSize: 10, fontWeight: '800', letterSpacing: 2, paddingHorizontal: 12 }}>RANKINGS</Text>
                <View style={[styles.podiumLine, { backgroundColor: T.border }]} />
              </View>
            )}
          </>
        }
        renderItem={({ item, index }) => (
          <RankRow
            item={item}
            rank={search ? filtered.indexOf(item) + 1 : index + 4}
            isMe={item.ownerId === myUid}
            isFollowing={followingUids.has(item.ownerId)}
            onToggleFollow={handleToggleFollow}
            maxArea={ranks[0]?.totalArea || 1}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 16 },
  title: { fontSize: 28, fontWeight: '900', letterSpacing: -0.8 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  myRankBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6 },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12, borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, height: 44 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  statPill: { flex: 1, borderRadius: 18, borderWidth: 1, padding: 14, alignItems: 'center', gap: 4 },
  statPillIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  myCard: { borderRadius: 22, borderWidth: 1, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20, overflow: 'hidden' },
  podiumSection: { marginBottom: 8 },
  podiumLabelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  podiumLine: { flex: 1, height: 1 },
  podiumRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 8, paddingHorizontal: 8, marginBottom: 20 },
  podiumBlock: { width: '80%', borderTopLeftRadius: 12, borderTopRightRadius: 12, borderWidth: 1, borderBottomWidth: 0, alignItems: 'center', justifyContent: 'center', paddingTop: 12 },
  rankingsLabel: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  rankRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 18, borderWidth: 1, padding: 14, marginBottom: 8, gap: 12 },
  rankBadge: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  youBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  emptyIcon: { width: 80, height: 80, borderRadius: 24, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  timeTabs: { flexDirection: 'row', borderRadius: 16, borderWidth: 1, padding: 4, marginBottom: 14, gap: 2 },
  timeTabBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: 12 },
  followBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1 },
});