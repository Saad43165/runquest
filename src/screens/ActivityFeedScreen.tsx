import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, Animated,
  TouchableOpacity, Image,
} from 'react-native';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/utils/ThemeContext';
import { OrbBackground } from '../components/OrbBackground';
import { subscribeFollowing } from '../services/friendsService';

// ─── Types ────────────────────────────────────────────────────────────────────
type ConquestEvent = {
  id: string;
  conqueredBy: string;
  conqueredByName: string;
  territoryName: string;
  previousOwner: string;
  areaSqMeters: number;
  timestamp: number;
};

// ─── Avatar styles ────────────────────────────────────────────────────────────
const AVATAR_STYLES = [
  'adventurer', 'avataaars', 'big-ears', 'bottts', 'croodles',
  'fun-emoji', 'icons', 'lorelei', 'micah', 'miniavs',
];
function getAvatarStyle(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffffffff;
  return AVATAR_STYLES[Math.abs(h) % AVATAR_STYLES.length];
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ─── Feed Item ────────────────────────────────────────────────────────────────
const FeedItem = React.memo(function FeedItem({ item, index }: { item: ConquestEvent; index: number }) {
  const { T } = useTheme();
  const anim = useRef(new Animated.Value(0)).current;
  const [imgErr, setImgErr] = useState(false);
  const style = getAvatarStyle(item.conqueredBy);
  const avatarUrl = imgErr
    ? `https://api.dicebear.com/7.x/${style}/png?seed=${encodeURIComponent(item.conqueredBy)}&size=80`
    : `https://api.dicebear.com/7.x/${style}/png?seed=${encodeURIComponent(item.conqueredBy)}&size=80`;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: 1,
      delay: Math.min(index * 40, 400),
      useNativeDriver: true,
      tension: 60,
      friction: 9,
    }).start();
  }, []);

  return (
    <Animated.View style={[
      styles.feedItem,
      { backgroundColor: T.card, borderColor: T.border },
      { opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] },
    ]}>
      {/* Avatar */}
      <View style={[styles.avatarWrap, { borderColor: T.green + '40', backgroundColor: T.green + '10' }]}>
        <Image
          source={{ uri: avatarUrl }}
          style={styles.avatar}
          onError={() => setImgErr(true)}
        />
      </View>

      {/* Content */}
      <View style={{ flex: 1 }}>
        <Text style={{ color: T.white, fontSize: 13, fontWeight: '700', lineHeight: 18 }}>
          <Text style={{ color: T.green }}>{item.conqueredByName}</Text>
          {' conquered '}
          <Text style={{ color: T.white, fontWeight: '900' }}>{item.previousOwner}</Text>
          {"'s territory"}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <View style={[styles.territoryBadge, { backgroundColor: '#FF453A18', borderColor: '#FF453A30' }]}>
            <Ionicons name="map" size={10} color="#FF453A" />
            <Text style={{ color: '#FF453A', fontSize: 10, fontWeight: '800' }}>{item.territoryName}</Text>
          </View>
          <Text style={{ color: T.text, fontSize: 10 }}>
            {item.areaSqMeters >= 1000
              ? `${(item.areaSqMeters / 1000).toFixed(1)}k m²`
              : `${Math.round(item.areaSqMeters)} m²`}
          </Text>
        </View>
      </View>

      {/* Time */}
      <Text style={{ color: T.text, fontSize: 10, fontWeight: '700' }}>{timeAgo(item.timestamp)}</Text>
    </Animated.View>
  );
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ActivityFeedScreen() {
  const { T } = useTheme();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [events, setEvents] = useState<ConquestEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'global' | 'friends'>('global');
  const [followingUids, setFollowingUids] = useState<Set<string>>(new Set());
  const headerAnim = useRef(new Animated.Value(0)).current;

  // Subscribe to following list
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const unsub = subscribeFollowing(uid, (uids) => setFollowingUids(new Set(uids)));
    return unsub;
  }, []);

  useEffect(() => {
    Animated.spring(headerAnim, { toValue: 1, useNativeDriver: true, tension: 50, friction: 8 }).start();

    const q = query(
      collection(db, 'conquestEvents'),
      orderBy('timestamp', 'desc'),
      limit(50),
    );

    const unsub = onSnapshot(q, (snap) => {
      const list: ConquestEvent[] = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          conqueredBy: data.conqueredBy ?? '',
          conqueredByName: data.conqueredByName ?? 'Unknown',
          territoryName: data.territoryName ?? 'Unknown Territory',
          previousOwner: data.previousOwner ?? 'Unknown',
          areaSqMeters: data.areaSqMeters ?? 0,
          timestamp: data.timestamp?.toMillis?.() ?? Date.now(),
        };
      });
      setEvents(list);
      setLoading(false);
    }, () => setLoading(false));

    return unsub;
  }, []);

  const displayedEvents = tab === 'friends'
    ? events.filter(e => followingUids.has(e.conqueredBy))
    : events;

  return (
    <View style={{ flex: 1, backgroundColor: T.black }}>
      <OrbBackground />
      <LinearGradient colors={['#FF453A14', 'transparent']} style={StyleSheet.absoluteFillObject} pointerEvents="none" />

      <FlatList
        data={displayedEvents}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}
        ListHeaderComponent={
          <>
            <Animated.View style={[styles.header, { paddingTop: insets.top + 16, opacity: headerAnim }]}>
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                style={[styles.iconBtn, { backgroundColor: T.card, borderColor: T.border }]}
              >
                <Ionicons name="arrow-back" size={20} color={T.white} />
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={{ color: T.white, fontSize: 26, fontWeight: '900', letterSpacing: -0.5 }}>Activity Feed</Text>
                <Text style={{ color: T.text, fontSize: 12, marginTop: 2 }}>
                  {loading ? 'Loading...' : `${displayedEvents.length} recent conquests`}
                </Text>
              </View>
              <View style={[styles.liveBadge, { backgroundColor: '#FF453A20', borderColor: '#FF453A40' }]}>
                <View style={[styles.liveDot, { backgroundColor: '#FF453A' }]} />
                <Text style={{ color: '#FF453A', fontSize: 10, fontWeight: '900' }}>LIVE</Text>
              </View>
            </Animated.View>

            {/* What is Activity Feed? — shown only when empty or first time */}
            {events.length === 0 && !loading && (
              <View style={{ backgroundColor: T.card, borderRadius: 18, borderWidth: 1, borderColor: T.border, borderLeftWidth: 3, borderLeftColor: '#FF453A', padding: 16, marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#FF453A20', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="flash" size={18} color="#FF453A" />
                  </View>
                  <Text style={{ color: T.white, fontSize: 15, fontWeight: '900' }}>What is Activity Feed?</Text>
                </View>
                {[
                  { icon: 'globe-outline', text: 'See every territory conquest happening worldwide in real-time', color: '#FF453A' },
                  { icon: 'people-outline', text: 'Switch to Friends tab to only see conquests from people you follow', color: '#00C6FF' },
                  { icon: 'notifications-outline', text: 'Get notified when someone invades your territory', color: '#FFD60A' },
                ].map((tip, i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 }}>
                    <Ionicons name={tip.icon as any} size={14} color={tip.color} />
                    <Text style={{ color: T.text, fontSize: 12, flex: 1, lineHeight: 18 }}>{tip.text}</Text>
                  </View>
                ))}
              </View>
            )}
            <View style={[styles.filterTabs, { backgroundColor: T.card, borderColor: T.border }]}>
              {(['global', 'friends'] as const).map(t => (
                <TouchableOpacity
                  key={t}
                  onPress={() => setTab(t)}
                  style={[styles.filterTabBtn, tab === t && { backgroundColor: T.green + '20' }]}
                  activeOpacity={0.8}
                >
                  <Text style={{ color: tab === t ? T.green : T.text, fontSize: 12, fontWeight: tab === t ? '900' : '600' }}>
                    {t === 'global' ? '🌍 Global' : '👥 Friends'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        }
        ListEmptyComponent={
          !loading ? (
            tab === 'friends' && followingUids.size === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: T.card, borderColor: T.border }]}>
                <Ionicons name="people-outline" size={44} color={T.text} />
                <Text style={{ color: T.white, fontSize: 16, fontWeight: '800', marginTop: 14 }}>Not following anyone</Text>
                <Text style={{ color: T.text, fontSize: 13, marginTop: 6, textAlign: 'center', lineHeight: 20 }}>
                  Follow warriors on the Leaderboard to see their activity here
                </Text>
              </View>
            ) : (
              <View style={[styles.emptyCard, { backgroundColor: T.card, borderColor: T.border }]}>
                <Ionicons name="flash-outline" size={44} color={T.text} />
                <Text style={{ color: T.white, fontSize: 16, fontWeight: '800', marginTop: 14 }}>No activity yet</Text>
                <Text style={{ color: T.text, fontSize: 13, marginTop: 6, textAlign: 'center', lineHeight: 20 }}>
                  {tab === 'friends' ? 'Your friends have no conquests yet' : 'Conquests will appear here in real-time'}
                </Text>
              </View>
            )
          ) : null
        }
        renderItem={({ item, index }) => <FeedItem item={item} index={index} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 12 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 12, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5 },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  filterTabs: { flexDirection: 'row', borderRadius: 16, borderWidth: 1, padding: 4, marginBottom: 12, gap: 4 },
  filterTabBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: 12 },
  feedItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, borderWidth: 1, marginBottom: 8 },
  avatarWrap: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden', borderWidth: 2 },
  avatar: { width: 44, height: 44 },
  territoryBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  emptyCard: { padding: 48, borderRadius: 24, alignItems: 'center', borderWidth: 1, marginTop: 20 },
});
