import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { subscribeTerritories } from '../services/territoriesRemote';
import { palette, spacing } from '../theme';
import { ensureUserId, getDisplayName } from '../config/user';

type Rank = { ownerId: string; ownerName: string; totalArea: number; count: number };

export default function LeaderboardScreen() {
  const [ranks, setRanks] = useState<Rank[]>([]);
  const uidRef = useRef<string>('');
  const nameRef = useRef<string>('You');
  useEffect(() => {
    let unsub: any = null;
    (async () => {
      uidRef.current = await ensureUserId();
      nameRef.current = await getDisplayName();
      unsub = await subscribeTerritories((list) => {
        const byOwner = new Map<string, { area: number; count: number }>();
        for (const t of list) {
          const cur = byOwner.get(t.ownerId) || { area: 0, count: 0 };
          cur.area += t.areaSqMeters || 0;
          cur.count += 1;
          byOwner.set(t.ownerId, cur);
        }
        const arr: Rank[] = Array.from(byOwner.entries()).map(([ownerId, v]) => ({
          ownerId,
          ownerName: ownerId === uidRef.current ? nameRef.current : ownerId,
          totalArea: v.area,
          count: v.count
        }));
        arr.sort((a, b) => b.totalArea - a.totalArea);
        setRanks(arr);
      });
    })();
    return () => {
      if (typeof unsub === 'function') {
        unsub();
      }
    };
  }, []);
  return (
    <View style={styles.root}>
      <Text style={styles.title}>Leaderboard</Text>
      <FlatList
        data={ranks}
        keyExtractor={(item) => item.ownerId}
        ListEmptyComponent={<Text style={styles.empty}>No territories yet</Text>}
        renderItem={({ item, index }) => (
          <View style={styles.row}>
            <View style={[styles.rankBadge]}><Text style={styles.rankText}>{index + 1}</Text></View>
            <View style={styles.cell}>
              <Text style={styles.name}>{item.ownerName}</Text>
              <Text style={styles.meta}>Territories {item.count} • Area {Math.round(item.totalArea)} m²</Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg, padding: spacing.md },
  title: { color: palette.white, fontSize: 20, fontWeight: '700', marginBottom: spacing.md },
  empty: { color: palette.text, textAlign: 'center', marginTop: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: palette.card, padding: spacing.sm, borderRadius: 10, marginBottom: spacing.sm },
  rankBadge: { width: 24, height: 24, borderRadius: 12, backgroundColor: palette.muted, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm },
  rankText: { color: palette.white, fontWeight: '700' },
  cell: { flex: 1 },
  name: { color: palette.white, fontWeight: '600', marginBottom: 2 },
  meta: { color: palette.text, fontSize: 12 }
});
