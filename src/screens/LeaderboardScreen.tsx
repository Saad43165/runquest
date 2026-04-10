import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Animated, TouchableOpacity } from 'react-native';
import { subscribeTerritories } from '../services/territoriesRemote';
import { ensureUserId, getDisplayName } from '../config/user';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/utils/ThemeContext';
import { useNavigation } from '@react-navigation/native';

type Rank = { ownerId: string; ownerName: string; totalArea: number; count: number };

function PodiumItem({ rank, item, isMe }: { rank: number; item: Rank; isMe: boolean }) {
  const { T } = useTheme();
  const heights = [120, 90, 70];
  const colors = [T.gold, '#C0C0C0', '#CD7F32'];
  const h = heights[rank - 1] ?? 50;
  const c = colors[rank - 1] ?? T.muted;
  const initials = item.ownerName.slice(0, 2).toUpperCase();

  return (
    <View style={{ alignItems: 'center', flex: 1, justifyContent: 'flex-end' }}>
      <View style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: c, backgroundColor: c + '20', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
        <Text style={{ fontSize: 16, fontWeight: '900', color: c }}>{initials}</Text>
      </View>
      <Text style={{ color: isMe ? T.green : T.white, fontSize: 11, fontWeight: '700', marginBottom: 2, textAlign: 'center' }} numberOfLines={1}>
        {item.ownerName}
      </Text>
      <Text style={{ color: T.text, fontSize: 10, marginBottom: 4 }}>{Math.round(item.totalArea)}m²</Text>
      <View style={{ width: '70%', height: h, borderTopLeftRadius: 8, borderTopRightRadius: 8, borderWidth: 1, borderBottomWidth: 0, borderColor: c + '60', backgroundColor: c + '30', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 20 }}>{rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'}</Text>
      </View>
    </View>
  );
}

function RankRow({ item, index, isMe }: { item: Rank; index: number; isMe: boolean }) {
  const { T } = useTheme();
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: 1, delay: index * 50, useNativeDriver: true, tension: 60, friction: 9 }).start();
  }, [anim, index]);
  const rankColors = [T.gold, '#C0C0C0', '#CD7F32'];
  const rc = rankColors[index] ?? T.text;

  return (
    <Animated.View
      style={[
        { flexDirection: 'row', alignItems: 'center', backgroundColor: T.card, borderRadius: 14, borderWidth: 1, borderColor: T.border, padding: 14, marginBottom: 8, gap: 12 },
        isMe && { borderColor: T.green + '50', backgroundColor: T.greenDim },
        { opacity: anim, transform: [{ translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }] },
      ]}
    >
      <View style={{ width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: rc + '40', backgroundColor: rc + '20', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 13, fontWeight: '900', color: rc }}>{index + 1}</Text>
      </View>
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: T.muted, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 13, fontWeight: '900', color: isMe ? T.green : T.text }}>{item.ownerName.slice(0, 2).toUpperCase()}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: isMe ? T.green : T.white, fontSize: 14, fontWeight: '700' }}>
          {item.ownerName}
          {isMe ? <Text style={{ color: T.green, fontSize: 10, fontWeight: '900', letterSpacing: 1 }}> YOU</Text> : null}
        </Text>
        <Text style={{ color: T.text, fontSize: 11, marginTop: 2 }}>{item.count} territories · {Math.round(item.totalArea).toLocaleString()} m²</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ color: T.white, fontSize: 16, fontWeight: '900' }}>{(item.totalArea / 1000).toFixed(1)}k</Text>
        <Text style={{ color: T.text, fontSize: 9, fontWeight: '700' }}>m²</Text>
      </View>
    </Animated.View>
  );
}

export default function LeaderboardScreen() {
  const { T } = useTheme();
  const navigation = useNavigation();
  const [ranks, setRanks] = useState<Rank[]>([]);
  const [myUid, setMyUid] = useState('');
  const headerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let unsub: any = null;
    (async () => {
      const uid = await ensureUserId();
      const name = await getDisplayName();
      setMyUid(uid);
      unsub = await subscribeTerritories((list) => {
        const map = new Map<string, { area: number; count: number }>();
        for (const t of list) {
          const cur = map.get(t.ownerId) || { area: 0, count: 0 };
          cur.area += t.areaSqMeters || 0;
          cur.count += 1;
          map.set(t.ownerId, cur);
        }
        const arr: Rank[] = Array.from(map.entries())
          .map(([ownerId, v]) => ({
            ownerId,
            ownerName: ownerId === uid
              ? name
              : (list.find(t => t.ownerId === ownerId)?.ownerDisplayName ?? 'Unknown Warrior'),
            totalArea: v.area,
            count: v.count,
          }))
          .sort((a, b) => b.totalArea - a.totalArea);
        setRanks(arr);
      });
    })();
    Animated.spring(headerAnim, { toValue: 1, useNativeDriver: true, tension: 50, friction: 8 }).start();
    return () => { if (typeof unsub === 'function') {unsub();} };
  }, [headerAnim]);

  const top3 = ranks.slice(0, 3);
  const rest = ranks.slice(3);
  const myRank = ranks.findIndex(r => r.ownerId === myUid);

  return (
    <View style={{ flex: 1, backgroundColor: T.black }}>
      <LinearGradient colors={[T.gold + '12', 'transparent']} style={StyleSheet.absoluteFillObject} pointerEvents="none" />

      <Animated.View
        style={[
          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 56, paddingHorizontal: 20, paddingBottom: 8 },
          { opacity: headerAnim },
        ]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: T.card, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
            <Ionicons name="arrow-back" size={20} color={T.white} />
          </TouchableOpacity>
          <View>
            <Text style={{ color: T.white, fontSize: 28, fontWeight: '900', letterSpacing: -0.8 }}>Leaderboard</Text>
            <Text style={{ color: T.text, fontSize: 13, marginTop: 4 }}>{ranks.length} runners competing</Text>
          </View>
        </View>
        {myRank >= 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: T.greenDim, borderRadius: 20, borderWidth: 1, borderColor: T.green + '40', paddingHorizontal: 12, paddingVertical: 6, gap: 5 }}>
            <Ionicons name="person" size={12} color={T.green} />
            <Text style={{ color: T.green, fontWeight: '800', fontSize: 14 }}>#{myRank + 1}</Text>
          </View>
        )}
      </Animated.View>

      <FlatList
        data={rest}
        keyExtractor={item => item.ownerId}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        ListEmptyComponent={
          ranks.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 60 }}>
              <Ionicons name="trophy-outline" size={48} color={T.border} />
              <Text style={{ color: T.white, fontSize: 18, fontWeight: '800', marginTop: 16 }}>No rankings yet</Text>
              <Text style={{ color: T.text, fontSize: 13, marginTop: 6 }}>Claim territories to appear here</Text>
            </View>
          ) : null
        }
        ListHeaderComponent={
          <>
            {top3.length >= 2 && (
              <View style={{ marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 8, paddingTop: 20, paddingHorizontal: 20 }}>
                  {top3.length > 1 && <PodiumItem rank={2} item={top3[1]} isMe={top3[1].ownerId === myUid} />}
                  {top3.length > 0 && <PodiumItem rank={1} item={top3[0]} isMe={top3[0].ownerId === myUid} />}
                  {top3.length > 2 && <PodiumItem rank={3} item={top3[2]} isMe={top3[2].ownerId === myUid} />}
                </View>
                <View style={{ height: 3, backgroundColor: T.border, marginHorizontal: 20, borderRadius: 2 }} />
              </View>
            )}
            {rest.length > 0 && (
              <View style={{ marginTop: 16, marginBottom: 8 }}>
                <Text style={{ color: T.text, fontSize: 10, fontWeight: '800', letterSpacing: 2.5 }}>RANKINGS</Text>
              </View>
            )}
          </>
        }
        renderItem={({ item, index }) => <RankRow item={item} index={index + 3} isMe={item.ownerId === myUid} />}
      />
    </View>
  );
}
