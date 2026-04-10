import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Animated, RefreshControl, Platform, Alert, Dimensions,
} from 'react-native';
import { Territory } from '../types';
import { subscribeTerritories, removeTerritoryRemote } from '../services/territoriesRemote';
import { ensureUserId, getDisplayName } from '../config/user';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, THEMES } from '@/utils/ThemeContext';
import { getFriendlyErrorMessage } from '../utils/ErrorUtils';
import { confirmAction } from '../utils/AlertUtils';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

// ─── Sub-components ───────────────────────────────────────────────────────────

function TerritoryProCard({ item, uid, myName, index }: { item: Territory; uid: string; myName: string; index: number }) {
  const { T } = useTheme();
  const anim = useRef(new Animated.Value(0)).current;
  const isMe = item.ownerId === uid;

  useEffect(() => {
    Animated.spring(anim, { toValue: 1, delay: index * 40, useNativeDriver: true, tension: 50, friction: 9 }).start();
  }, [anim, index]);

  const initials = (isMe ? myName : (item.ownerDisplayName ?? 'Unknown Warrior')).split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <Animated.View style={[
      styles.card,
      { backgroundColor: T.card, borderColor: isMe ? T.green + '50' : T.border, opacity: anim },
      { transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }
    ]}>
      <View style={styles.cardHeader}>
         <View style={[styles.ownerBadge, { backgroundColor: isMe ? T.green + '15' : T.muted }]}>
            <Text style={[styles.ownerBadgeText, { color: isMe ? T.green : T.text }]}>
               {isMe ? 'MY DOMAIN' : 'CONQUERED'}
            </Text>
         </View>
         {isMe && (
           <TouchableOpacity 
             onPress={() => {
               Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
               confirmAction({
                 title: 'Release Domain',
                 message: 'This territory will be removed from your kingdom.',
                 confirmText: 'Release',
                 style: 'destructive',
                 onConfirm: () => { removeTerritoryRemote(item.id); }
               });
             }}
             style={styles.deleteBtn}
           >
             <Ionicons name="trash-outline" size={16} color={T.red} />
           </TouchableOpacity>
         )}
      </View>

      <View style={styles.cardMain}>
         <View style={[styles.colorOrb, { backgroundColor: item.color, shadowColor: item.color }]} />
         <View style={{ flex: 1 }}>
            <Text style={[styles.territoryName, { color: T.white }]}>{item.name}</Text>
            <View style={styles.statLine}>
               <Ionicons name="expand-outline" size={10} color={T.text} />
               <Text style={[styles.statValue, { color: T.text }]}>{Math.round(item.areaSqMeters).toLocaleString()} m²</Text>
               <View style={styles.dotSeparator} />
               <Ionicons name="git-commit-outline" size={10} color={T.text} />
               <Text style={[styles.statValue, { color: T.text }]}>{Math.round(item.perimeterMeters).toLocaleString()} m</Text>
            </View>
         </View>
      </View>

      <View style={[styles.cardFooter, { backgroundColor: T.black + '40', borderTopColor: T.border }]}>
         <View style={[styles.avatar, { backgroundColor: item.color + '20', borderColor: item.color + '40' }]}>
            <Text style={[styles.avatarText, { color: item.color }]}>{initials}</Text>
         </View>
         <Text style={[styles.ownerLabel, { color: T.text }]}>Claimed by</Text>
         <Text style={[styles.ownerName, { color: T.white }]} numberOfLines={1}>
            {isMe ? 'You' : (item.ownerDisplayName ?? 'Unknown Warrior')}
         </Text>
      </View>
    </Animated.View>
  );
}

// ─── Leaderboard Item ─────────────────────────────────────────────────────────

function LeaderboardItem({ rank, name, area, color, isMe }: { rank: number; name: string; area: number; color: string; isMe: boolean }) {
  const { T } = useTheme();
  return (
    <View style={[styles.lbRow, { borderBottomColor: T.border }]}>
      <Text style={[styles.lbRank, { color: rank === 1 ? T.gold : T.text }]}>#{rank}</Text>
      <View style={[styles.lbAvatar, { backgroundColor: color + '20', borderColor: color + '40' }]}>
         <Text style={{ color, fontSize: 10, fontWeight: '900' }}>{name.slice(0, 1)}</Text>
      </View>
      <Text style={[styles.lbName, { color: isMe ? T.green : T.white }]} numberOfLines={1}>{name}</Text>
      <Text style={[styles.lbArea, { color: T.text }]}>{Math.round(area).toLocaleString()} m²</Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function TerritoriesScreen() {
  const { T } = useTheme();
  const insets = useSafeAreaInsets();
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [uid, setUid] = useState('');
  const [myName, setMyName] = useState('Warrior');
  const [refreshing, setRefreshing] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    initData();
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  const initData = async () => {
    try {
      subscribeTerritories(list => setTerritories(list));
      setUid(await ensureUserId());
      setMyName(await getDisplayName());
    } catch (e) {
      console.error(e);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await initData();
    setRefreshing(false);
  };

  const leaderboardData = Array.from(
    territories.reduce((acc, t) => {
      acc.set(t.ownerId, (acc.get(t.ownerId) || 0) + (t.areaSqMeters || 0));
      return acc;
    }, new Map<string, number>())
  ).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const myRankIdx = leaderboardData.findIndex(([id]) => id === uid);
  const myTotalArea = territories.filter(t => t.ownerId === uid).reduce((a, t) => a + t.areaSqMeters, 0);

  return (
    <View style={[styles.root, { backgroundColor: T.black }]}>
      <LinearGradient colors={[T.accent2 + '08', 'transparent']} style={StyleSheet.absoluteFill} />
      
      <Animated.FlatList
        data={territories}
        keyExtractor={item => item.id}
        style={{ opacity: fadeAnim }}
        contentContainerStyle={{ paddingTop: insets.top + 20, paddingBottom: 100, paddingHorizontal: 20 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.green} />}
        ListHeaderComponent={() => (
          <View style={{ marginBottom: 32 }}>
            <View style={styles.headerRow}>
               <View>
                  <Text style={[styles.title, { color: T.white }]}>Kingdoms</Text>
                  <Text style={[styles.subtitle, { color: T.text }]}>THE TERRITORY REGISTRY</Text>
               </View>
               <TouchableOpacity onPress={onRefresh} style={[styles.syncBtn, { backgroundColor: T.card }]}>
                  <Ionicons name="sync" size={18} color={T.green} />
               </TouchableOpacity>
            </View>

            {/* Overall Stats */}
            <View style={[styles.statsHero, { backgroundColor: T.card, borderColor: T.border }]}>
               <View style={styles.heroColumn}>
                  <Text style={[styles.heroLabel, { color: T.text }]}>GLOBAL REGIONS</Text>
                  <Text style={[styles.heroVal, { color: T.white }]}>{territories.length}</Text>
               </View>
               <View style={[styles.heroDivider, { backgroundColor: T.border }]} />
               <View style={styles.heroColumn}>
                  <Text style={[styles.heroLabel, { color: T.text }]}>YOUR CONQUESTS</Text>
                  <Text style={[styles.heroVal, { color: T.green }]}>{territories.filter(t => t.ownerId === uid).length}</Text>
               </View>
            </View>

            {/* Pro Leaderboard */}
            <Text style={[styles.sectionTitle, { color: T.text }]}>GLOBAL RANKINGS</Text>
            <View style={[styles.lbCard, { backgroundColor: T.card, borderColor: T.border }]}>
               {leaderboardData.length > 0 ? (
                 leaderboardData.map(([id, area], i) => (
                   <LeaderboardItem 
                     key={id} 
                     rank={i+1} 
                     name={id === uid ? myName : (territories.find(t => t.ownerId === id)?.ownerDisplayName ?? 'Unknown Warrior')} 
                     area={area} 
                     color={THEMES.midnight.green} 
                     isMe={id === uid} 
                    />
                 ))
               ) : (
                 <Text style={{ textAlign: 'center', color: T.text, padding: 20 }}>No warriors have claimed land yet.</Text>
               )}
               {myRankIdx === -1 && myTotalArea > 0 && (
                 <View style={{ borderTopWidth: 1, borderTopColor: T.border, paddingTop: 8 }}>
                    <LeaderboardItem rank={0} name="You" area={myTotalArea} color={T.green} isMe={true} />
                 </View>
               )}
            </View>

            <Text style={[styles.sectionTitle, { color: T.text, marginTop: 32 }]}>RECENT CONQUESTS</Text>
          </View>
        )}
        ListEmptyComponent={() => (
          <View style={styles.emptyWrap}>
             <Ionicons name="at-circle-outline" size={60} color={T.border} />
             <Text style={[styles.emptyTitle, { color: T.white }]}>Empty Realm</Text>
             <Text style={[styles.emptySub, { color: T.text }]}>Be the first to carve a territory in this world.</Text>
          </View>
        )}
        renderItem={({ item, index }) => (
          <TerritoryProCard item={item} uid={uid} myName={myName} index={index} />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 38, fontWeight: '900', letterSpacing: -1 },
  subtitle: { fontSize: 10, fontWeight: '800', letterSpacing: 2.5, marginTop: 2 },
  syncBtn: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  statsHero: { borderRadius: 24, padding: 20, flexDirection: 'row', alignItems: 'center', borderWidth: 1, marginBottom: 32 },
  heroColumn: { flex: 1, alignItems: 'center' },
  heroLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1.5, marginBottom: 6 },
  heroVal: { fontSize: 24, fontWeight: '900' },
  heroDivider: { width: 1, height: 30, marginHorizontal: 10 },
  sectionTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 2, marginBottom: 12 },
  lbCard: { borderRadius: 24, borderWidth: 1, overflow: 'hidden' },
  lbRow: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  lbRank: { width: 30, fontSize: 14, fontWeight: '900' },
  lbAvatar: { width: 22, height: 22, borderRadius: 6, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  lbName: { flex: 1, fontSize: 14, fontWeight: '700' },
  lbArea: { fontSize: 12, fontWeight: '800' },
  card: { borderRadius: 24, borderWidth: 1, marginBottom: 16, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 12, paddingBottom: 0 },
  ownerBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  ownerBadgeText: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  deleteBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  cardMain: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: 12, gap: 16 },
  colorOrb: { width: 10, height: 40, borderRadius: 5, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 10 },
  territoryName: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  statLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  statValue: { fontSize: 11, fontWeight: '700' },
  dotSeparator: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#555', marginHorizontal: 4 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', padding: 12, borderTopWidth: StyleSheet.hairlineWidth },
  avatar: { width: 24, height: 24, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  avatarText: { fontSize: 10, fontWeight: '900' },
  ownerLabel: { fontSize: 12, marginRight: 6 },
  ownerName: { fontSize: 12, fontWeight: '800' },
  emptyWrap: { alignItems: 'center', paddingVertical: 100 },
  emptyTitle: { fontSize: 20, fontWeight: '900', marginTop: 20 },
  emptySub: { fontSize: 13, textAlign: 'center', marginTop: 8, paddingHorizontal: 40, lineHeight: 20 },
});
