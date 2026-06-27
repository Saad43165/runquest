import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Animated, RefreshControl, Dimensions, TextInput, Keyboard,
} from 'react-native';
import { Territory } from '../types';
import { ensureUserId, getDisplayName } from '../config/user';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/utils/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTerritories } from '../context/TerritoriesContext';
import { OrbBackground } from '../components/OrbBackground';
import { auth } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '@react-navigation/native';

// Modular components
import TerritoryCard from '../components/territories/TerritoryCard';
import TerritoryDetailModal from '../components/territories/TerritoryDetailModal';

const { width } = Dimensions.get('window');

type FilterMode = 'all' | 'mine' | 'others';

// ─── Stats Hero ───────────────────────────────────────────────────────────────

function StatHero({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) {
  const { T } = useTheme();
  return (
    <View style={[styles.heroCard, { backgroundColor: T.card, borderColor: T.border }]}>
      <View style={[styles.heroIcon, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon as any} size={20} color={color} />
      </View>
      <Text style={[styles.heroValue, { color: T.white }]}>{value}</Text>
      <Text style={[styles.heroLabel, { color: T.text }]}>{label}</Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function TerritoriesScreen() {
  const { T } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { territories, loading } = useTerritories();
  const { user, profile } = useAuth();
  const [uid, setUid] = useState(auth.currentUser?.uid || '');
  const [myName, setMyName] = useState('Warrior');
  const [myPhotoURL, setMyPhotoURL] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterMode>('all');
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const searchInputRef = useRef<TextInput>(null);
  const [selectedTerritory, setSelectedTerritory] = useState<Territory | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const headerAnim = useRef(new Animated.Value(0)).current;

  const initData = useCallback(async () => {
    try {
      const firebaseUid = auth.currentUser?.uid;
      const localUid = await ensureUserId();
      const resolvedUid = firebaseUid || localUid;
      setUid(resolvedUid);
      setMyName(await getDisplayName());
      setMyPhotoURL(profile?.photoURL || auth.currentUser?.photoURL || null);
    } catch {}
  }, [profile?.photoURL, user?.photoURL]);

  const onRefresh = async () => {
    setRefreshing(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await initData();
    setRefreshing(false);
  };

  useEffect(() => {
    initData();
    Animated.spring(headerAnim, { toValue: 1, useNativeDriver: true, tension: 50, friction: 8 }).start();
  }, [headerAnim, initData]);

  useEffect(() => {
    if (showSearch) {
      const t = setTimeout(() => searchInputRef.current?.focus(), 100);
      return () => clearTimeout(t);
    } else {
      Keyboard.dismiss();
      setSearch('');
    }
  }, [showSearch]);

  useEffect(() => {
    if (showDetail) Keyboard.dismiss();
  }, [showDetail]);

  useEffect(() => {
    const photo = profile?.photoURL || user?.photoURL || null;
    setMyPhotoURL(photo);
  }, [profile, user]);

  const myTerritories = territories.filter(t => t.ownerId === uid);
  const myTotalArea = myTerritories.reduce((s, t) => s + t.areaSqMeters, 0);
  const uniqueWarriors = new Set(territories.map(t => t.ownerId)).size;

  const filtered = useMemo(() => {
    let list = territories;
    if (filter === 'mine') list = list.filter(t => t.ownerId === uid);
    if (filter === 'others') list = list.filter(t => t.ownerId !== uid);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(t =>
        t.name.toLowerCase().includes(q) ||
        (t.ownerDisplayName ?? '').toLowerCase().includes(q) ||
        (t.ownerUsername ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [territories, filter, search, uid]);

  const FILTERS: { id: FilterMode; label: string; icon: string }[] = useMemo(() => [
    { id: 'all',    label: `All (${territories.length})`,    icon: 'globe-outline' },
    { id: 'mine',   label: `Mine (${myTerritories.length})`, icon: 'person-outline' },
    { id: 'others', label: 'Others',                         icon: 'people-outline' },
  ], [territories.length, myTerritories.length]);

  const renderHeader = useCallback(() => (
    <Animated.View style={{ opacity: headerAnim }}>
      <View style={styles.header}>
        <View style={styles.headerTitleWrap}>
          <Text style={[styles.title, { color: T.white }]}>Kingdoms</Text>
          <Text style={[styles.subtitle, { color: T.text }]}>{uniqueWarriors} warriors · {territories.length} territories</Text>
        </View>
        <TouchableOpacity
          onPress={() => setShowSearch(v => !v)}
          style={[styles.iconBtn, { backgroundColor: showSearch ? T.green + '20' : T.card, borderColor: showSearch ? T.green : T.border }]}
          accessibilityLabel={showSearch ? 'Close search' : 'Search territories'}
          accessibilityRole="button"
        >
          <Ionicons name="search" size={18} color={showSearch ? T.green : T.text} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onRefresh}
          style={[styles.iconBtn, { backgroundColor: T.card, borderColor: T.border }]}
          accessibilityLabel="Refresh territories"
          accessibilityRole="button"
        >
          <Ionicons name="sync" size={18} color={T.green} />
        </TouchableOpacity>
      </View>

      <View style={styles.statsGrid}>
        <StatHero label="MY AREA" value={myTotalArea >= 1000 ? `${(myTotalArea/1000).toFixed(1)}k` : String(Math.round(myTotalArea))} icon="flag" color={T.green} />
        <StatHero label="GLOBAL" value={territories.length.toString()} icon="globe-outline" color={T.accent2} />
        <StatHero label="WARRIORS" value={uniqueWarriors.toString()} icon="people-outline" color={T.gold} />
      </View>

      {myTerritories.length > 0 && (
        <View style={[styles.myCard, { backgroundColor: T.green + '10', borderColor: T.green + '30' }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.myCardLabel, { color: T.green }]}>YOUR KINGDOM</Text>
            <Text style={[styles.myCardTitle, { color: T.white }]}>{myName}</Text>
            <Text style={[styles.myCardStats, { color: T.text }]}>
              {myTerritories.length} territories · {(myTotalArea / 1000000).toFixed(4)} km²
            </Text>
          </View>
          <View style={styles.myCardAreaWrap}>
            <Text style={[styles.myCardAreaLabel, { color: T.text }]}>TOTAL AREA</Text>
            <Text style={[styles.myCardAreaValue, { color: T.green }]}>
              {myTotalArea >= 1000 ? `${(myTotalArea/1000).toFixed(0)}k` : Math.round(myTotalArea)}
            </Text>
            <Text style={[styles.myCardAreaUnit, { color: T.text }]}>m²</Text>
          </View>
        </View>
      )}

      <View style={styles.filterRow}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f.id}
            onPress={() => { setFilter(f.id); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
            style={[styles.filterBtn, { backgroundColor: filter === f.id ? T.green + '20' : T.card, borderColor: filter === f.id ? T.green : T.border }]}
          >
            <Ionicons name={f.icon as any} size={13} color={filter === f.id ? T.green : T.text} />
            <Text style={[styles.filterText, { color: filter === f.id ? T.green : T.text }]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </Animated.View>
  ), [headerAnim, T, territories, myTerritories, myTotalArea, myName, uniqueWarriors, filter, FILTERS, showSearch, onRefresh]);

  return (
    <View style={[styles.root, { backgroundColor: T.black }]}>
      <OrbBackground />
      <LinearGradient colors={[T.accent2 + '10', 'transparent']} style={StyleSheet.absoluteFill} />

      {showSearch && (
        <View style={[styles.searchBarFixed, {
          top: insets.top + 16,
          backgroundColor: T.card,
          borderColor: T.border,
        }]}>
          <Ionicons name="search" size={16} color={T.text} />
          <TextInput
            ref={searchInputRef}
            style={[styles.searchInput, { color: T.white }]}
            placeholder="Search territories or warriors..."
            placeholderTextColor={T.text + '80'}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color={T.text} />
            </TouchableOpacity>
          )}
        </View>
      )}

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        contentContainerStyle={[styles.listContent, { paddingTop: showSearch ? insets.top + 72 : insets.top + 16 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.green} />}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={() => (
          <View style={styles.empty}>
            <Ionicons name={search.trim() ? 'search-outline' : 'map-outline'} size={56} color={T.border} />
            <Text style={[styles.emptyTitle, { color: T.white }]}>
              {search.trim()
                ? 'No results found'
                : filter === 'mine'
                ? 'No territories yet'
                : 'Empty Realm'}
            </Text>
            <Text style={[styles.emptySub, { color: T.text }]}>
              {search.trim()
                ? `No territories or warriors match "${search}"`
                : filter === 'mine'
                ? 'Run a closed loop on the map to claim your first territory!'
                : 'Be the first warrior to carve a territory in this world.'}
            </Text>
            {search.trim() && (
              <TouchableOpacity
                onPress={() => setSearch('')}
                style={[styles.clearSearchBtn, { backgroundColor: T.card, borderColor: T.border }]}
              >
                <Text style={{ color: T.text, fontSize: 13, fontWeight: '700' }}>Clear search</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        renderItem={({ item, index }) => (
          <TerritoryCard
            item={item}
            uid={uid}
            myName={myName}
            myPhotoURL={myPhotoURL}
            index={index}
            onOpen={() => {
              Keyboard.dismiss();
              setSelectedTerritory(item);
              setShowDetail(true);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          />
        )}
      />

      <TerritoryDetailModal
        visible={showDetail}
        item={selectedTerritory}
        uid={uid}
        myName={myName}
        myPhotoURL={myPhotoURL}
        onClose={() => setShowDetail(false)}
        navigation={navigation}
        insets={insets}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  headerTitleWrap: { flex: 1 },
  title: { fontSize: 32, fontWeight: '900', letterSpacing: -0.8 },
  subtitle: { fontSize: 12, marginTop: 2, opacity: 0.7 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  searchBarFixed: { position: 'absolute', left: 16, right: 16, zIndex: 100, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, height: 44 },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 0 },
  listContent: { paddingBottom: 120, paddingHorizontal: 16 },
  statsGrid: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  heroCard: { flex: 1, borderRadius: 18, borderWidth: 1, padding: 14, alignItems: 'center', gap: 4 },
  heroIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  heroValue: { fontSize: 18, fontWeight: '900' },
  heroLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  myCard: { borderRadius: 20, borderWidth: 1, padding: 18, flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  myCardLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  myCardTitle: { fontSize: 18, fontWeight: '900', marginTop: 4 },
  myCardStats: { fontSize: 12, marginTop: 2 },
  myCardAreaWrap: { alignItems: 'flex-end' },
  myCardAreaLabel: { fontSize: 10, fontWeight: '700' },
  myCardAreaValue: { fontSize: 26, fontWeight: '900', lineHeight: 30 },
  myCardAreaUnit: { fontSize: 10 },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  filterBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 14, borderWidth: 1, paddingVertical: 9 },
  filterText: { fontSize: 11, fontWeight: '800' },
  empty: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 20, fontWeight: '900', marginTop: 16 },
  emptySub: { fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  clearSearchBtn: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, borderWidth: 1 },
});
