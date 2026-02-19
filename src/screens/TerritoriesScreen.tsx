import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Territory } from '../types';
import { subscribeTerritories, removeTerritoryRemote } from '../services/territoriesRemote';
import { getAuth } from 'firebase/auth';
import { ensureUserId, getDisplayName } from '../config/user';
import { palette, spacing } from '../theme';

export default function TerritoriesScreen() {
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [uid, setUid] = useState<string>('');
  const [myName, setMyName] = useState<string>('You');

  useEffect(() => {
    let unsub: any = null;
    (async () => {
      unsub = await subscribeTerritories((list) => setTerritories(list));
      setUid(await ensureUserId());
      setMyName(await getDisplayName());
    })();
    return () => {
      if (typeof unsub === 'function') {
        unsub();
      }
    };
  }, []);

  

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Territories</Text>
      <FlatList
        data={territories}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={styles.empty}>No territories yet</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={[styles.swatch, { backgroundColor: item.color }]} />
            <View style={styles.cell}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.meta}>
                Area {item.areaSqMeters} m² • Perimeter {item.perimeterMeters} m
              </Text>
              <Text style={styles.meta}>
                Owner {item.ownerId === uid ? myName : item.ownerId}
              </Text>
            </View>
            <OwnerActions id={item.id} ownerId={item.ownerId} />
          </View>
        )}
      />
    </View>
  );
}

function OwnerActions({ id, ownerId }: { id: string; ownerId: string }) {
  const uid = getAuth().currentUser?.uid;
  if (!uid || uid !== ownerId) {
    return (
      <View style={styles.ownerBadge}>
        <Text style={styles.ownerBadgeText}>Owned</Text>
      </View>
    );
  }
  return (
    <TouchableOpacity style={styles.remove} onPress={() => removeTerritoryRemote(id)}>
      <Text style={styles.removeText}>Remove</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg, padding: spacing.md },
  title: {
    color: palette.white,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: spacing.md
  },
  empty: {
    color: palette.text,
    textAlign: 'center',
    marginTop: spacing.lg
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.card,
    padding: spacing.sm,
    borderRadius: 10,
    marginBottom: spacing.sm
  },
  swatch: {
    width: 10,
    height: 10,
    borderRadius: 2,
    marginRight: spacing.sm,
  },
  ownerBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: palette.muted,
    borderRadius: 6
  },
  ownerBadgeText: {
    color: palette.white,
    fontWeight: '600'
  },
  cell: {
    flex: 1
  },
  name: {
    color: palette.white,
    fontWeight: '600',
    marginBottom: 2
  },
  meta: {
    color: palette.text,
    fontSize: 12
  },
  remove: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: palette.muted,
    borderRadius: 6
  },
  removeText: {
    color: palette.white,
    fontWeight: '600'
  }
});
