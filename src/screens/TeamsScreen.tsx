import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Animated, Modal, Dimensions, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/utils/ThemeContext';
import { useNavigation } from '@react-navigation/native';
import { auth, db } from '../services/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Team, createTeam, joinTeam, leaveTeam, getUserTeam, subscribeTeams } from '../services/teamsService';
import { useTerritories } from '../context/TerritoriesContext';
import { OrbBackground } from '../components/OrbBackground';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');
const TEAM_COLORS = ['#32D74B', '#0A84FF', '#FF453A', '#FF9F0A', '#BF5FFF', '#00C6FF', '#FFD60A', '#FF6B35'];

function sanitize(input: string, maxLen: number): string {
  return input.replace(/<[^>]*>/g, '').trim().slice(0, maxLen);
}

// ─── Confirm Dialog ───────────────────────────────────────────────────────────
function ConfirmModal({ visible, title, message, icon, iconColor, confirmText, confirmColor, onCancel, onConfirm, loading }: {
  visible: boolean; title: string; message: string; icon: string; iconColor: string;
  confirmText: string; confirmColor: string; onCancel: () => void; onConfirm: () => void; loading?: boolean;
}) {
  const { T } = useTheme();
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 100, friction: 10 }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      scaleAnim.setValue(0.85);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onCancel}>
      <Animated.View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: 28, opacity: opacityAnim }}>
        <Animated.View style={{
          backgroundColor: '#111', borderRadius: 28, padding: 28, width: '100%',
          borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
          transform: [{ scale: scaleAnim }],
        }}>
          <View style={{ width: 60, height: 60, borderRadius: 18, backgroundColor: iconColor + '18', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 16 }}>
            <Ionicons name={icon as any} size={28} color={iconColor} />
          </View>
          <Text style={{ color: '#FFF', fontSize: 20, fontWeight: '900', textAlign: 'center', marginBottom: 10 }}>{title}</Text>
          <Text style={{ color: '#8E8E93', fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 28 }}>{message}</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity onPress={onCancel} style={{ flex: 1, paddingVertical: 14, borderRadius: 16, backgroundColor: '#1C1C1E', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center' }}>
              <Text style={{ color: '#8E8E93', fontWeight: '700', fontSize: 15 }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onConfirm} disabled={loading} style={{ flex: 1, paddingVertical: 14, borderRadius: 16, backgroundColor: confirmColor, alignItems: 'center' }}>
              {loading ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 15 }}>{confirmText}</Text>}
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ─── Team Card with expandable member list ────────────────────────────────────
type MemberProfile = { uid: string; displayName: string; photoURL: string | null; username: string };

function TeamCard({ team, isMyTeam, isMember, teamArea, teamTerritories, myTeam, actionLoading, onJoin, territories }: {
  team: Team; isMyTeam: boolean; isMember: boolean; teamArea: number; teamTerritories: number;
  myTeam: Team | null; actionLoading: boolean; onJoin: () => void; territories: any[];
}) {
  const { T } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const loadMembers = async () => {
    if (members.length > 0) { setExpanded(e => !e); return; }
    setExpanded(true);
    setLoadingMembers(true);
    try {
      const profiles = await Promise.all(
        team.memberIds.slice(0, 10).map(async (uid) => {
          try {
            const snap = await getDoc(doc(db, 'users', uid));
            if (snap.exists()) {
              const d = snap.data();
              return { uid, displayName: d.displayName || 'Warrior', photoURL: d.photoURL || null, username: d.username || '' };
            }
          } catch {}
          return { uid, displayName: 'Warrior', photoURL: null, username: '' };
        })
      );
      setMembers(profiles.filter(Boolean) as MemberProfile[]);
    } finally { setLoadingMembers(false); }
  };

  const getMemberArea = (uid: string) =>
    territories.filter(t => t.ownerId === uid).reduce((s: number, t: any) => s + t.areaSqMeters, 0);
  const getMemberTerritories = (uid: string) =>
    territories.filter(t => t.ownerId === uid).length;

  return (
    <View style={{
      backgroundColor: T.card, borderRadius: 20, borderWidth: isMyTeam ? 1.5 : 1,
      borderColor: isMyTeam ? team.color + '60' : T.border,
      marginBottom: 12, overflow: 'hidden',
    }}>
      {isMyTeam && <LinearGradient colors={[team.color + '10', 'transparent']} style={StyleSheet.absoluteFill} />}

      {/* Header row */}
      <TouchableOpacity onPress={loadMembers} activeOpacity={0.8} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
        <View style={{ width: 48, height: 48, borderRadius: 13, backgroundColor: team.color, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#000', fontSize: 12, fontWeight: '900', letterSpacing: 1 }}>{team.tag}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ color: T.white, fontSize: 15, fontWeight: '800' }}>{team.name}</Text>
            {isMyTeam && (
              <View style={{ backgroundColor: team.color + '25', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                <Text style={{ color: team.color, fontSize: 8, fontWeight: '900' }}>YOU</Text>
              </View>
            )}
          </View>
          <Text style={{ color: T.text, fontSize: 11, marginTop: 3 }}>
            {team.memberIds.length} members · {teamTerritories} territories · {teamArea >= 1000 ? `${(teamArea / 1000).toFixed(1)}k` : Math.round(teamArea)} m²
          </Text>
        </View>
        {!isMember && !myTeam ? (
          <TouchableOpacity
            onPress={(e) => { e.stopPropagation?.(); onJoin(); }}
            disabled={actionLoading}
            style={{ backgroundColor: team.color, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 }}
          >
            <Text style={{ color: '#000', fontSize: 12, fontWeight: '900' }}>Join</Text>
          </TouchableOpacity>
        ) : (
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={T.text} />
        )}
      </TouchableOpacity>

      {/* Expandable member list */}
      {expanded && (
        <View style={{ borderTopWidth: 1, borderTopColor: T.border, paddingHorizontal: 16, paddingBottom: 14, paddingTop: 10 }}>
          <Text style={{ color: T.text, fontSize: 9, fontWeight: '800', letterSpacing: 1.5, marginBottom: 10 }}>MEMBERS</Text>
          {loadingMembers ? (
            <ActivityIndicator color={team.color} size="small" style={{ marginVertical: 8 }} />
          ) : (
            members.map((m, i) => {
              const mArea = getMemberArea(m.uid);
              const mTerr = getMemberTerritories(m.uid);
              const isMe = m.uid === auth.currentUser?.uid;
              return (
                <View key={m.uid} style={{
                  flexDirection: 'row', alignItems: 'center', gap: 10,
                  paddingVertical: 8,
                  borderBottomWidth: i < members.length - 1 ? 1 : 0,
                  borderBottomColor: T.border,
                }}>
                  {/* Avatar */}
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: team.color + '30', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1.5, borderColor: team.color + '50' }}>
                    {m.photoURL ? (
                      <Image source={{ uri: m.photoURL }} style={{ width: 36, height: 36 }} />
                    ) : (
                      <Text style={{ color: team.color, fontSize: 14, fontWeight: '900' }}>{m.displayName[0]?.toUpperCase()}</Text>
                    )}
                  </View>
                  {/* Info */}
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ color: T.white, fontSize: 13, fontWeight: '800' }}>{m.displayName}</Text>
                      {isMe && <View style={{ backgroundColor: team.color + '25', borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1 }}>
                        <Text style={{ color: team.color, fontSize: 8, fontWeight: '900' }}>YOU</Text>
                      </View>}
                    </View>
                    {m.username ? <Text style={{ color: T.text, fontSize: 10, marginTop: 1 }}>@{m.username}</Text> : null}
                  </View>
                  {/* Stats */}
                  <View style={{ alignItems: 'flex-end', gap: 2 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="map-outline" size={10} color={team.color} />
                      <Text style={{ color: team.color, fontSize: 11, fontWeight: '800' }}>{mTerr}</Text>
                    </View>
                    <Text style={{ color: T.text, fontSize: 9 }}>
                      {mArea >= 1000 ? `${(mArea / 1000).toFixed(1)}k` : Math.round(mArea)} m²
                    </Text>
                  </View>
                </View>
              );
            })
          )}
          {team.memberIds.length > 10 && (
            <Text style={{ color: T.text, fontSize: 11, textAlign: 'center', marginTop: 8 }}>
              +{team.memberIds.length - 10} more members
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

export default function TeamsScreen() {
  const { T } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { territories } = useTerritories();

  const [teams, setTeams] = useState<Team[]>([]);
  const [myTeam, setMyTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [joinTarget, setJoinTarget] = useState<Team | null>(null);
  const [showJoinConfirm, setShowJoinConfirm] = useState(false);

  // Create form
  const [newName, setNewName] = useState('');
  const [newTag, setNewTag] = useState('');
  const [newColor, setNewColor] = useState(TEAM_COLORS[0]);

  const headerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(headerAnim, { toValue: 1, useNativeDriver: true, tension: 50, friction: 8 }).start();
    const uid = auth.currentUser?.uid;
    if (uid) getUserTeam(uid).then(t => setMyTeam(t));
    const unsub = subscribeTeams((list) => {
      setTeams(list);
      setLoading(false);
      if (uid) {
        const found = list.find(t => t.memberIds.includes(uid)) || null;
        setMyTeam(found);
      }
    });
    return unsub;
  }, []);

  const uid = auth.currentUser?.uid || '';

  const handleCreate = async () => {
    const name = sanitize(newName, 40);
    const tag = sanitize(newTag, 4).toUpperCase();
    if (!name || tag.length < 2) return;
    setActionLoading(true);
    try {
      const team = await createTeam(name, tag, newColor);
      if (team) {
        setMyTeam(team);
        setShowCreateModal(false);
        setNewName(''); setNewTag('');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } finally { setActionLoading(false); }
  };

  const handleJoinConfirm = async () => {
    if (!joinTarget) return;
    setActionLoading(true);
    try {
      await joinTeam(joinTarget.id);
      setShowJoinConfirm(false);
      setJoinTarget(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } finally { setActionLoading(false); }
  };

  const handleLeaveConfirm = async () => {
    if (!myTeam) return;
    setActionLoading(true);
    try {
      await leaveTeam(myTeam.id);
      setMyTeam(null);
      setShowLeaveConfirm(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } finally { setActionLoading(false); }
  };

  const getTeamArea = (teamId: string) =>
    territories.filter(t => t.teamId === teamId).reduce((s, t) => s + t.areaSqMeters, 0);

  const getTeamTerritoryCount = (teamId: string) =>
    territories.filter(t => t.teamId === teamId).length;

  return (
    <View style={{ flex: 1, backgroundColor: T.black }}>
      <OrbBackground />
      <LinearGradient colors={['#BF5FFF14', 'transparent']} style={StyleSheet.absoluteFill} pointerEvents="none" />

      {/* Confirm Modals */}
      <ConfirmModal
        visible={showLeaveConfirm}
        title="Leave Team?"
        message={`You'll lose your team tag on all territories. You can join or create a new team anytime.`}
        icon="exit-outline"
        iconColor={T.red}
        confirmText="Leave Team"
        confirmColor={T.red}
        onCancel={() => setShowLeaveConfirm(false)}
        onConfirm={handleLeaveConfirm}
        loading={actionLoading}
      />
      <ConfirmModal
        visible={showJoinConfirm}
        title={`Join ${joinTarget?.name}?`}
        message={`You'll join [${joinTarget?.tag}] and your territories will show this team's color. You can only be in one team at a time.`}
        icon="people"
        iconColor={joinTarget?.color || T.green}
        confirmText="Join Alliance"
        confirmColor={joinTarget?.color || T.green}
        onCancel={() => { setShowJoinConfirm(false); setJoinTarget(null); }}
        onConfirm={handleJoinConfirm}
        loading={actionLoading}
      />

      {/* Create Team Modal */}
      <Modal visible={showCreateModal} transparent animationType="slide" onRequestClose={() => setShowCreateModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowCreateModal(false)} />
          <View style={{ backgroundColor: '#111', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: insets.bottom + 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#333', alignSelf: 'center', marginBottom: 20 }} />
            <Text style={{ color: '#FFF', fontSize: 22, fontWeight: '900', marginBottom: 6 }}>Create Alliance</Text>
            <Text style={{ color: '#8E8E93', fontSize: 13, marginBottom: 24, lineHeight: 20 }}>
              Form a team with other warriors. Your territories will show your team tag and color on the map.
            </Text>

            <Text style={{ color: '#8E8E93', fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 8 }}>ALLIANCE NAME</Text>
            <View style={{ backgroundColor: '#1C1C1E', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 4, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
              <TextInput
                value={newName}
                onChangeText={t => setNewName(t.slice(0, 40))}
                style={{ color: '#FFF', fontSize: 16, paddingVertical: 12 }}
                placeholder="e.g. Iron Warriors"
                placeholderTextColor="#555"
                maxLength={40}
              />
            </View>

            <Text style={{ color: '#8E8E93', fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 8 }}>TAG (2-4 CHARS) — shown on map</Text>
            <View style={{ backgroundColor: '#1C1C1E', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 4, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
              <TextInput
                value={newTag}
                onChangeText={t => setNewTag(t.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4))}
                style={{ color: '#FFF', fontSize: 16, paddingVertical: 12, textTransform: 'uppercase', letterSpacing: 2 }}
                placeholder="IW"
                placeholderTextColor="#555"
                maxLength={4}
                autoCapitalize="characters"
              />
            </View>

            <Text style={{ color: '#8E8E93', fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 12 }}>TEAM COLOR</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
              {TEAM_COLORS.map(c => (
                <TouchableOpacity
                  key={c}
                  onPress={() => setNewColor(c)}
                  style={{
                    width: 34, height: 34, borderRadius: 17, backgroundColor: c,
                    borderWidth: newColor === c ? 3 : 0, borderColor: '#FFF',
                    shadowColor: newColor === c ? c : 'transparent',
                    shadowOpacity: 0.8, shadowRadius: 6, elevation: newColor === c ? 6 : 0,
                  }}
                />
              ))}
            </View>

            {/* Preview */}
            {(newName || newTag) && (
              <View style={{ backgroundColor: newColor + '15', borderRadius: 14, borderWidth: 1, borderColor: newColor + '40', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: newColor, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#000', fontSize: 11, fontWeight: '900' }}>{newTag || '??'}</Text>
                </View>
                <View>
                  <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '800' }}>{newName || 'Alliance Name'}</Text>
                  <Text style={{ color: '#8E8E93', fontSize: 11 }}>Preview</Text>
                </View>
              </View>
            )}

            <TouchableOpacity
              onPress={handleCreate}
              disabled={actionLoading || newName.trim().length === 0 || newTag.trim().length < 2}
              style={{ borderRadius: 18, overflow: 'hidden', opacity: (newName.trim().length === 0 || newTag.trim().length < 2) ? 0.5 : 1 }}
            >
              <LinearGradient colors={[newColor, newColor + 'CC']} style={{ paddingVertical: 16, alignItems: 'center' }} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                {actionLoading ? <ActivityIndicator color="#000" /> : <Text style={{ color: '#000', fontWeight: '900', fontSize: 16 }}>Create Alliance</Text>}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 120, paddingHorizontal: 16 }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: headerAnim }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: T.card, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="chevron-back" size={20} color={T.white} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={{ color: T.white, fontSize: 28, fontWeight: '900', letterSpacing: -0.6 }}>Alliances</Text>
              <Text style={{ color: T.text, fontSize: 12, marginTop: 2 }}>{teams.length} teams · {territories.filter(t => t.teamId).length} team territories</Text>
            </View>
          </View>

          {/* What are alliances? — Fitness card style */}
          <View style={{ backgroundColor: T.card, borderRadius: 20, borderWidth: 1, borderTopWidth: 3, borderColor: T.border, borderTopColor: '#BF5FFF', padding: 16, marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#BF5FFF20', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="shield" size={20} color="#BF5FFF" />
              </View>
              <View>
                <Text style={{ color: T.white, fontSize: 15, fontWeight: '900' }}>What are Alliances?</Text>
                <Text style={{ color: '#BF5FFF', fontSize: 10, fontWeight: '800' }}>TEAM FEATURE</Text>
              </View>
            </View>
            <View style={{ gap: 10 }}>
              {[
                { icon: 'people', text: 'Team up with other warriors', color: '#BF5FFF' },
                { icon: 'map', text: 'Your territories show your team tag & color', color: '#00C6FF' },
                { icon: 'podium', text: 'Combined territory area on leaderboard', color: '#FFD60A' },
                { icon: 'shield-checkmark', text: 'Coordinate territory defense together', color: '#32D74B' },
              ].map((tip, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: tip.color + '18', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={tip.icon as any} size={13} color={tip.color} />
                  </View>
                  <Text style={{ color: T.text, fontSize: 12, flex: 1, lineHeight: 17 }}>{tip.text}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* My Team */}
          {myTeam ? (
            <View style={{ backgroundColor: T.card, borderRadius: 22, borderWidth: 1, borderTopWidth: 3, borderColor: T.border, borderTopColor: myTeam.color, padding: 18, marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                <View style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: myTeam.color, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#000', fontSize: 14, fontWeight: '900', letterSpacing: 1 }}>{myTeam.tag}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ color: T.white, fontSize: 18, fontWeight: '900' }}>{myTeam.name}</Text>
                    <View style={{ backgroundColor: myTeam.color + '25', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7 }}>
                      <Text style={{ color: myTeam.color, fontSize: 9, fontWeight: '900' }}>YOUR TEAM</Text>
                    </View>
                  </View>
                  <Text style={{ color: T.text, fontSize: 12, marginTop: 3 }}>
                    {myTeam.memberIds.length} {myTeam.memberIds.length === 1 ? 'member' : 'members'}
                  </Text>
                </View>
              </View>

              {/* Team stats — Fitness StatCard style */}
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                {[
                  { label: 'TERRITORIES', value: String(getTeamTerritoryCount(myTeam.id)), unit: 'zones', icon: 'map', color: myTeam.color },
                  { label: 'TOTAL AREA', value: getTeamArea(myTeam.id) >= 1000 ? `${(getTeamArea(myTeam.id) / 1000).toFixed(1)}k` : String(Math.round(getTeamArea(myTeam.id))), unit: 'm²', icon: 'expand', color: myTeam.color },
                  { label: 'MEMBERS', value: String(myTeam.memberIds.length), unit: 'warriors', icon: 'people', color: myTeam.color },
                ].map(s => (
                  <View key={s.label} style={{ flex: 1, backgroundColor: T.card, borderRadius: 14, borderWidth: 1, borderTopWidth: 3, borderColor: T.border, borderTopColor: s.color, padding: 12, alignItems: 'center', gap: 4 }}>
                    <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: s.color + '20', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name={s.icon as any} size={14} color={s.color} />
                    </View>
                    <Text style={{ color: T.white, fontSize: 18, fontWeight: '900', letterSpacing: -0.5 }}>{s.value}</Text>
                    <Text style={{ color: s.color, fontSize: 9, fontWeight: '800' }}>{s.unit}</Text>
                    <Text style={{ color: T.text, fontSize: 8, fontWeight: '700', letterSpacing: 0.5 }}>{s.label}</Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity
                onPress={() => setShowLeaveConfirm(true)}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 14, backgroundColor: T.red + '15', borderWidth: 1, borderColor: T.red + '40' }}
              >
                <Ionicons name="exit-outline" size={16} color={T.red} />
                <Text style={{ color: T.red, fontSize: 14, fontWeight: '800' }}>Leave Alliance</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => setShowCreateModal(true)}
              style={{ borderRadius: 20, overflow: 'hidden', marginBottom: 20 }}
            >
              <LinearGradient colors={['#BF5FFF', '#7B2FBE']} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 }} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Ionicons name="add-circle" size={20} color="#FFF" />
                <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '900' }}>Create Your Alliance</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          <Text style={{ color: T.text, fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 12 }}>ALL ALLIANCES ({teams.length})</Text>
        </Animated.View>

        {/* Teams list */}
        {loading ? (
          <View style={{ alignItems: 'center', paddingVertical: 40 }}>
            <ActivityIndicator color={T.green} size="large" />
            <Text style={{ color: T.text, fontSize: 13, marginTop: 12 }}>Loading alliances...</Text>
          </View>
        ) : teams.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 60 }}>
            <View style={{ width: 80, height: 80, borderRadius: 24, backgroundColor: T.card, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <Ionicons name="people-outline" size={40} color={T.border} />
            </View>
            <Text style={{ color: T.white, fontSize: 18, fontWeight: '900' }}>No Alliances Yet</Text>
            <Text style={{ color: T.text, fontSize: 13, marginTop: 8, textAlign: 'center', lineHeight: 20 }}>
              Be the first warrior to forge{'\n'}an alliance and dominate together!
            </Text>
          </View>
        ) : (
          teams.map((team) => {
            const isMyTeam = myTeam?.id === team.id;
            const isMember = team.memberIds.includes(uid);
            const teamArea = getTeamArea(team.id);
            const teamTerritories = getTeamTerritoryCount(team.id);
            return (
              <TeamCard
                key={team.id}
                team={team}
                isMyTeam={isMyTeam}
                isMember={isMember}
                teamArea={teamArea}
                teamTerritories={teamTerritories}
                myTeam={myTeam}
                actionLoading={actionLoading}
                onJoin={() => { setJoinTarget(team); setShowJoinConfirm(true); }}
                territories={territories}
              />
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({});
