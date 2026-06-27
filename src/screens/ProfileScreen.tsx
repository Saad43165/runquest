import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, ScrollView, Alert, ActivityIndicator, Image, Modal, TextInput, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';

import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { ProfileStackParamList } from '../navigation/ProfileStackNavigator';
import { useTheme } from '@/utils/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { logoutUser, updateUserProfile, uploadProfileImage, avatarColor } from '../services/authService';
import { updateProfile } from 'firebase/auth';
import { auth } from '../services/firebase';
import { getFriendlyErrorMessage } from '../utils/ErrorUtils';
import { getHistory, getHistoryStats, RunRecord, deleteRun } from '../services/history';
import { getSettings, Settings } from '../config/settings';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { exportProfileAsPDF } from '../utils/pdfExport';
import { OrbBackground } from '../components/OrbBackground';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useTerritories } from '../context/TerritoriesContext';

function getLevelInfo(totalDistM: number) {
  const km = totalDistM / 1000;
  const level = Math.min(Math.floor(km / 10) + 1, 100); // cap at level 100
  const progress = Math.min((km % 10) / 10, 1);         // clamp 0-1
  return { level, progress, km };
}

function EditProfileModal({ visible, onClose, initialName, initialUsername, initialBio, onSave }: {
  visible: boolean; onClose: () => void; initialName: string; initialUsername: string; initialBio: string;
  onSave: (n: string, u: string, b: string) => Promise<void>;
}) {
  const { T } = useTheme();
  const [name, setName] = useState(initialName);
  const [username, setUsername] = useState(initialUsername);
  const [bio, setBio] = useState(initialBio);
  const [saving, setSaving] = useState(false);
  const slideAnim = useRef(new Animated.Value(600)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  const close = () => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 600, duration: 260, useNativeDriver: true }),
      Animated.timing(backdropAnim, { toValue: 0, duration: 260, useNativeDriver: true }),
    ]).start(() => onClose());
  };

  useEffect(() => {
    if (visible) {
      setName(initialName); setUsername(initialUsername); setBio(initialBio);
      slideAnim.setValue(600); backdropAnim.setValue(0);
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 60, friction: 12 }),
        Animated.timing(backdropAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const save = async () => {
    if (!name.trim() || !username.trim()) return;
    setSaving(true);
    try { await onSave(name.trim(), username.trim(), bio.trim()); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); close(); }
    catch (e) { Alert.alert('Error', getFriendlyErrorMessage(e)); }
    finally { setSaving(false); }
  };

  const keyboardOffset = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardWillShow', e => {
      Animated.timing(keyboardOffset, { toValue: e.endCoordinates.height, duration: e.duration || 250, useNativeDriver: true }).start();
    });
    const hideSub = Keyboard.addListener('keyboardWillHide', e => {
      Animated.timing(keyboardOffset, { toValue: 0, duration: e.duration || 200, useNativeDriver: true }).start();
    });
    // Android uses keyboardDidShow (no animation duration)
    const showSubA = Keyboard.addListener('keyboardDidShow', e => {
      Animated.timing(keyboardOffset, { toValue: e.endCoordinates.height, duration: 200, useNativeDriver: true }).start();
    });
    const hideSubA = Keyboard.addListener('keyboardDidHide', () => {
      Animated.timing(keyboardOffset, { toValue: 0, duration: 180, useNativeDriver: true }).start();
    });
    return () => { showSub.remove(); hideSub.remove(); showSubA.remove(); hideSubA.remove(); };
  }, []);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={close}>
      <View style={{ flex: 1 }}>
        <Animated.View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', opacity: backdropAnim }}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={close} />
        </Animated.View>
        <Animated.View style={{
          transform: [{ translateY: slideAnim }, { translateY: Animated.multiply(keyboardOffset, -1) }],
          position: 'absolute', bottom: 0, left: 0, right: 0,
        }}>
          <View style={{ backgroundColor: '#111', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
            <TouchableOpacity onPress={close} style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 4 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#444' }} />
            </TouchableOpacity>
            <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <Text style={{ color: '#FFF', fontSize: 20, fontWeight: '900' }}>Edit Profile</Text>
                <TouchableOpacity onPress={close}><Ionicons name="close" size={24} color="#8E8E93" /></TouchableOpacity>
              </View>
              {[
                { label: 'DISPLAY NAME', value: name, set: setName, placeholder: 'Your name', icon: 'person-outline' },
                { label: 'USERNAME', value: username, set: setUsername, placeholder: 'username', icon: 'at-outline' },
              ].map(f => (
                <View key={f.label} style={{ marginBottom: 16 }}>
                  <Text style={{ color: '#8E8E93', fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 8 }}>{f.label}</Text>
                  <View style={{ backgroundColor: '#1C1C1E', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Ionicons name={f.icon as any} size={16} color="#8E8E93" />
                    <TextInput value={f.value} onChangeText={f.set} style={{ flex: 1, color: '#FFF', fontSize: 16, paddingVertical: 12 }} placeholderTextColor="#555" placeholder={f.placeholder} autoCapitalize="none" />
                  </View>
                </View>
              ))}
              <Text style={{ color: '#8E8E93', fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 8 }}>BIO</Text>
              <View style={{ backgroundColor: '#1C1C1E', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 4, marginBottom: 28 }}>
                <TextInput value={bio} onChangeText={setBio} style={{ color: '#FFF', fontSize: 15, paddingVertical: 12, minHeight: 80, textAlignVertical: 'top' }} placeholderTextColor="#555" placeholder="Tell the world..." multiline maxLength={160} />
                <Text style={{ color: '#555', fontSize: 11, textAlign: 'right', paddingBottom: 8 }}>{bio.length}/160</Text>
              </View>
              <TouchableOpacity onPress={save} disabled={saving} style={{ borderRadius: 16, overflow: 'hidden' }}>
                <LinearGradient colors={['#32D74B', '#28C041']} style={{ paddingVertical: 18, alignItems: 'center' }}>
                  {saving ? <ActivityIndicator color="#000" /> : <Text style={{ color: '#000', fontWeight: '900', fontSize: 16 }}>SAVE CHANGES</Text>}
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── Menu Row ─────────────────────────────────────────────────────────────────
function MenuRow({ icon, label, desc, color, onPress, badge }: {
  icon: string; label: string; desc?: string; color: string; onPress: () => void; badge?: string;
}) {
  const { T } = useTheme();
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13, paddingHorizontal: 16 }}>
      <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: color + '18', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon as any} size={18} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: T.white, fontSize: 15, fontWeight: '700' }}>{label}</Text>
        {desc ? <Text style={{ color: T.text, fontSize: 11, marginTop: 1 }}>{desc}</Text> : null}
      </View>
      {badge ? (
        <View style={{ backgroundColor: '#FF9F0A', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 }}>
          <Text style={{ color: '#000', fontSize: 10, fontWeight: '900' }}>{badge}</Text>
        </View>
      ) : null}
      <Ionicons name="chevron-forward" size={15} color={T.text + '50'} />
    </TouchableOpacity>
  );
}

// ─── Section Card ─────────────────────────────────────────────────────────────
function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  const { T } = useTheme();
  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={{ color: T.text, fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 8, paddingHorizontal: 4 }}>{title}</Text>
      <View style={{ backgroundColor: T.card, borderRadius: 20, borderWidth: 1, borderColor: T.border, overflow: 'hidden' }}>
        {children}
      </View>
    </View>
  );
}

function Divider() {
  const { T } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: T.border, marginLeft: 68 }} />;
}

export default function ProfileScreen() {
  const { T } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, profile, refreshProfile } = useAuth();
  const navigation = useNavigation<StackNavigationProp<ProfileStackParamList>>();
  const { territories } = useTerritories();
  const [history, setHistory] = useState<RunRecord[]>([]);
  const [stats, setStats] = useState({ runs: 0, totalDistanceMeters: 0, totalDurationSec: 0, longestDistanceMeters: 0 });
  const [settings, setSettings] = useState<Settings | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);
  const [showLogout, setShowLogout] = useState(false);
  const [cropUri, setCropUri] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setHistory(await getHistory());
      setStats(await getHistoryStats());
      setSettings(await getSettings());
    })();
  }, []);

  const photoURL = profile?.photoURL || user?.photoURL || null;
  const isMetric = settings?.units !== 'imperial';
  const unitLabel = isMetric ? 'KM' : 'MI';
  const distMult = isMetric ? 1000 : 1609.34;
  const { level, progress, km } = getLevelInfo(stats.totalDistanceMeters);
  const avatarCol = profile?.avatarColor || avatarColor(user?.uid || 'user');
  const displayName = profile?.displayName || user?.displayName || 'Runner';
  const username = profile?.username || '';
  const bio = profile?.bio || '';
  const email = user?.email || '';
  const myTerritories = territories.filter(t => t.ownerId === user?.uid);
  const expiringSoon = myTerritories.filter(t => t.expiresAt && (t.expiresAt - Date.now()) < 172800000);

  const onPickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission Required', 'Gallery access is needed to change your photo.');
      return;
    }
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!r.canceled && r.assets[0]) {
      setCropUri(r.assets[0].uri);
    }
  };

  const onSave = async (n: string, u: string, b: string) => {
    if (!user) return;
    await updateProfile(auth.currentUser!, { displayName: n });
    await updateUserProfile(user.uid, { displayName: n, username: u, bio: b });
    await refreshProfile();
  };

  const onExportPDF = async () => {
    setExportingPDF(true);
    try {
      await exportProfileAsPDF({ displayName, username, email, level, progress, avatarColor: avatarCol }, stats, history, isMetric, myTerritories);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert('Export Failed', e?.message || 'Could not export PDF. Please try again.');
    } finally {
      setExportingPDF(false);
    }
  };

  // Tab-level screens must be navigated via the parent tab navigator
  const TAB_SCREENS = ['Run', 'Territories', 'Settings'];
  const nav = (route: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      if (TAB_SCREENS.includes(route)) {
        const parent = navigation.getParent();
        if (parent) { parent.navigate(route as any); return; }
      }
      navigation.navigate(route as any);
    } catch {}
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.black }}>
      <OrbBackground />
      <LinearGradient colors={[avatarCol + '22', 'transparent']} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 280 }} pointerEvents="none" />

      <ConfirmDialog
        visible={showLogout} title="Sign Out" message="Are you sure you want to sign out?" confirmText="Sign Out" cancelText="Stay" destructive icon="log-out-outline"
        onCancel={() => setShowLogout(false)}
        onConfirm={() => { setShowLogout(false); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); logoutUser(); }}
      />
      <EditProfileModal visible={showEdit} onClose={() => setShowEdit(false)} initialName={displayName} initialUsername={username} initialBio={bio} onSave={onSave} />

      {/* ── Custom photo preview modal ── */}
      <Modal visible={!!cropUri} transparent animationType="slide" onRequestClose={() => setCropUri(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: T.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: insets.bottom + 24, borderWidth: 1, borderColor: T.border }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: T.border, alignSelf: 'center', marginBottom: 20 }} />
            <Text style={{ color: T.white, fontSize: 20, fontWeight: '900', textAlign: 'center', marginBottom: 20 }}>Use this photo?</Text>
            {cropUri && (
              <View style={{ alignItems: 'center', marginBottom: 24 }}>
                <Image source={{ uri: cropUri }} style={{ width: 140, height: 140, borderRadius: 70, borderWidth: 3, borderColor: avatarCol }} />
              </View>
            )}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity onPress={() => setCropUri(null)} style={{ flex: 1, paddingVertical: 15, borderRadius: 16, backgroundColor: T.muted, borderWidth: 1, borderColor: T.border, alignItems: 'center' }}>
                <Text style={{ color: T.white, fontWeight: '700', fontSize: 15 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  if (!cropUri || !user) return;
                  setCropUri(null);
                  setUploading(true);
                  try {
                    await uploadProfileImage(user.uid, cropUri);
                    await refreshProfile();
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  } catch {
                    Alert.alert('Upload Failed', 'Could not save your photo. Please try again.');
                  } finally { setUploading(false); }
                }}
                style={{ flex: 1, borderRadius: 16, overflow: 'hidden' }}
              >
                <LinearGradient colors={[avatarCol, avatarCol + 'CC']} style={{ paddingVertical: 15, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
                  <Ionicons name="checkmark-circle" size={18} color="#000" />
                  <Text style={{ color: '#000', fontWeight: '900', fontSize: 15 }}>Done</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>

        {/* ── Hero ── */}
        <View style={{ paddingTop: insets.top + 20, paddingHorizontal: 20, paddingBottom: 8 }}>
          {/* Avatar row — horizontal: avatar left, info right, buttons top-right */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 16 }}>
            {/* Avatar */}
            <TouchableOpacity activeOpacity={0.9} onPress={onPickImage} style={{ position: 'relative' }}>
              <View style={{ width: 86, height: 86, borderRadius: 26, borderWidth: 2.5, borderColor: avatarCol, overflow: 'hidden', backgroundColor: avatarCol + '20' }}>
                {photoURL ? <Image source={{ uri: photoURL }} style={{ width: '100%', height: '100%' }} /> : (
                  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 30, fontWeight: '900', color: '#FFF' }}>{displayName[0]?.toUpperCase() ?? 'R'}</Text>
                  </View>
                )}
                {uploading && <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color="#FFF" /></View>}
              </View>
              <View style={{ position: 'absolute', bottom: -2, right: -2, width: 26, height: 26, borderRadius: 13, backgroundColor: avatarCol, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: T.black }}>
                <Ionicons name="camera" size={12} color="#000" />
              </View>
            </TouchableOpacity>

            {/* Name block */}
            <View style={{ flex: 1 }}>
              <Text style={{ color: T.white, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 }} numberOfLines={1}>{displayName}</Text>
              {username ? <Text style={{ color: avatarCol, fontSize: 13, marginTop: 2, fontWeight: '700' }}>@{username}</Text> : null}
              {email ? <Text style={{ color: T.text, fontSize: 12, marginTop: 2 }}>{email}</Text> : null}
              {bio ? <Text style={{ color: T.text, fontSize: 12, marginTop: 4, lineHeight: 17 }} numberOfLines={2}>{bio}</Text> : (
                <TouchableOpacity onPress={() => setShowEdit(true)} style={{ marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="add-circle-outline" size={13} color={T.text} />
                  <Text style={{ color: T.text, fontSize: 12 }}>Add bio</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Edit + PDF icon buttons */}
            <View style={{ gap: 8 }}>
              <TouchableOpacity onPress={() => setShowEdit(true)} style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: T.card, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="pencil" size={15} color={T.green} />
              </TouchableOpacity>
              <TouchableOpacity onPress={onExportPDF} disabled={exportingPDF} style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: T.card, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center' }}>
                {exportingPDF ? <ActivityIndicator size="small" color={T.accent2} /> : <Ionicons name="document-text-outline" size={15} color={T.accent2} />}
              </TouchableOpacity>
            </View>
          </View>

          {/* Level card — Fitness card style */}
          <View style={{ backgroundColor: T.card, borderRadius: 16, borderWidth: 1, borderTopWidth: 3, borderColor: T.border, borderTopColor: avatarCol, padding: 14, marginTop: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: avatarCol + '20', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="flash" size={16} color={avatarCol} />
                </View>
                <View>
                  <Text style={{ color: T.white, fontSize: 14, fontWeight: '900' }}>Level {level}</Text>
                  <Text style={{ color: T.text, fontSize: 11 }}>{km.toFixed(1)} {unitLabel} total distance</Text>
                </View>
              </View>
              <View style={{ backgroundColor: avatarCol + '20', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 }}>
                <Text style={{ color: avatarCol, fontSize: 13, fontWeight: '900' }}>{Math.round(progress * 100)}%</Text>
              </View>
            </View>
            <View style={{ height: 8, backgroundColor: T.muted, borderRadius: 4, overflow: 'hidden' }}>
              <View style={{ height: '100%', width: `${progress * 100}%`, backgroundColor: avatarCol, borderRadius: 4 }} />
            </View>
            <Text style={{ color: T.text, fontSize: 10, marginTop: 6, textAlign: 'right' }}>
              {Math.round((1 - progress) * 10)} {unitLabel} to Level {level + 1}
            </Text>
          </View>
        </View>

        {/* ── Stats strip — Fitness card style ── */}
        <View style={{ flexDirection: 'row', paddingHorizontal: 20, gap: 10, marginTop: 20, marginBottom: 28 }}>
          {[
            { label: 'RUNS', value: String(stats.runs), unit: 'total', color: avatarCol, icon: 'fitness-outline' },
            { label: unitLabel, value: (stats.totalDistanceMeters / distMult).toFixed(1), unit: 'dist', color: T.accent2, icon: 'walk-outline' },
            { label: 'ZONES', value: String(myTerritories.length), unit: 'owned', color: T.green, icon: 'map-outline' },
            { label: 'BEST', value: (stats.longestDistanceMeters / distMult).toFixed(1), unit: unitLabel.toLowerCase(), color: T.gold, icon: 'trophy-outline' },
          ].map((s, i) => (
            <View key={i} style={{ flex: 1, backgroundColor: T.card, borderRadius: 14, borderWidth: 1, borderTopWidth: 3, borderColor: T.border, borderTopColor: s.color, padding: 10, alignItems: 'center', gap: 3 }}>
              <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: s.color + '20', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={s.icon as any} size={13} color={s.color} />
              </View>
              <Text style={{ color: T.white, fontSize: 16, fontWeight: '900', letterSpacing: -0.3 }}>{s.value}</Text>
              <Text style={{ color: s.color, fontSize: 8, fontWeight: '800' }}>{s.unit}</Text>
              <Text style={{ color: T.text, fontSize: 7, fontWeight: '700', letterSpacing: 0.5 }}>{s.label}</Text>
            </View>
          ))}
        </View>

        <View style={{ paddingHorizontal: 20 }}>

          {/* Expiry warning */}
          {expiringSoon.length > 0 && (
            <TouchableOpacity onPress={() => nav('Territories')}
              style={{ backgroundColor: '#FF9F0A15', borderRadius: 16, borderWidth: 1, borderColor: '#FF9F0A40', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#FF9F0A20', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="time-outline" size={18} color="#FF9F0A" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#FF9F0A', fontSize: 13, fontWeight: '900' }}>{expiringSoon.length} {expiringSoon.length === 1 ? 'territory' : 'territories'} expiring soon!</Text>
                <Text style={{ color: '#FF9F0A', fontSize: 11, opacity: 0.8, marginTop: 1 }}>Tap to defend before they disappear</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#FF9F0A" />
            </TouchableOpacity>
          )}

          {/* COMPETE section */}
          <SectionCard title="COMPETE">
            <MenuRow icon="podium" label="Leaderboard" desc="See global rankings" color="#0A84FF" onPress={() => nav('Leaderboard')} />
            <Divider />
            <MenuRow icon="trophy" label="Achievements" desc="Badges & XP rewards" color="#FFD60A" onPress={() => nav('Achievements')} />
            <Divider />
            <MenuRow icon="people" label="Teams & Alliances" desc="Form a team, conquer together" color="#BF5FFF" onPress={() => nav('Teams')} />
            <Divider />
            <MenuRow icon="flash" label="Activity Feed" desc="Live conquest events" color="#FF453A" onPress={() => nav('ActivityFeed')} />
          </SectionCard>

          {/* TRAIN section */}
          <SectionCard title="TRAIN">
            <MenuRow icon="flame" label="Fitness Stats" desc="Heart rate zones & calories" color="#FF453A" onPress={() => nav('Fitness')} />
            <Divider />
            <MenuRow icon="hardware-chip" label="RunBot AI" desc="Your AI running assistant" color={T.green} onPress={() => nav('ChatBot')} />
          </SectionCard>

          {/* Activity — split into Loop Runs and Open Runs */}
          {history.length > 0 && (() => {
            const loops = history.filter(r => r.areaSqMeters > 500 && r.perimeterMeters > 200);
            const opens = history.filter(r => !(r.areaSqMeters > 500 && r.perimeterMeters > 200));

            const RunItem = ({ run, color, icon }: { run: typeof history[0]; color: string; icon: string }) => {
              const distVal = (run.distanceMeters / distMult).toFixed(2);
              const mins = Math.round(run.durationSec / 60);
              const isLoop = color === T.green;
              return (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 16 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: color + '18', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={icon as any} size={16} color={color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: T.white, fontSize: 13, fontWeight: '700' }}>
                      {new Date(run.createdAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                    </Text>
                    <Text style={{ color: T.text, fontSize: 11, marginTop: 1 }}>
                      {mins} min{isLoop && run.areaSqMeters > 0 ? ` · ${Math.round(run.areaSqMeters).toLocaleString()} m²` : ''}
                    </Text>
                  </View>
                  <Text style={{ color, fontSize: 14, fontWeight: '900' }}>{distVal} {unitLabel}</Text>
                </View>
              );
            };

            return (
              <>
                {/* Loop Runs — territory-eligible */}
                {loops.length > 0 && (
                  <View style={{ marginBottom: 20 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, paddingHorizontal: 4 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: T.green }} />
                      <Text style={{ color: T.text, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 }}>LOOP RUNS</Text>
                      <View style={{ backgroundColor: T.green + '30', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                        <Text style={{ color: T.green, fontSize: 9, fontWeight: '900' }}>TERRITORY ELIGIBLE</Text>
                      </View>
                    </View>
                    <View style={{ backgroundColor: T.card, borderRadius: 20, borderWidth: 1, borderColor: T.green + '30', overflow: 'hidden' }}>
                      {loops.slice(0, 2).map((run, i) => (
                        <View key={run.id}>
                          <RunItem run={run} color={T.green} icon="flag" />
                          {i < Math.min(loops.length, 2) - 1 && <Divider />}
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Open Runs — fitness only */}
                {opens.length > 0 && (
                  <View style={{ marginBottom: 20 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, paddingHorizontal: 4 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#00C6FF' }} />
                      <Text style={{ color: T.text, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 }}>OPEN RUNS</Text>
                      <View style={{ backgroundColor: '#00C6FF30', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                        <Text style={{ color: '#00C6FF', fontSize: 9, fontWeight: '900' }}>FITNESS ONLY</Text>
                      </View>
                    </View>
                    <View style={{ backgroundColor: T.card, borderRadius: 20, borderWidth: 1, borderColor: '#00C6FF25', overflow: 'hidden' }}>
                      {opens.slice(0, 2).map((run, i) => (
                        <View key={run.id}>
                          <RunItem run={run} color="#00C6FF" icon="walk-outline" />
                          {i < Math.min(opens.length, 2) - 1 && <Divider />}
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* See all link — always visible */}
                <TouchableOpacity
                  onPress={() => nav('RunHistory')}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, marginBottom: 20, borderRadius: 14, backgroundColor: T.card, borderWidth: 1, borderTopWidth: 3, borderColor: T.border, borderTopColor: T.green }}
                >
                  <Ionicons name="time-outline" size={16} color={T.green} />
                  <Text style={{ color: T.green, fontSize: 14, fontWeight: '800' }}>Full Run History ({history.length})</Text>
                  <Ionicons name="arrow-forward" size={16} color={T.green} />
                </TouchableOpacity>
              </>
            );
          })()}

          {/* SUPPORT section */}
          <SectionCard title="SUPPORT">
            <MenuRow icon="help-circle" label="Help & Support" desc="FAQs, guides & contact" color={T.accent2} onPress={() => nav('HelpSupport')} />
          </SectionCard>

          {/* Sign out */}
          <TouchableOpacity onPress={() => setShowLogout(true)}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 16, backgroundColor: T.red + '12', borderWidth: 1, borderColor: T.red + '30', marginBottom: 8 }}>
            <Ionicons name="log-out-outline" size={18} color={T.red} />
            <Text style={{ color: T.red, fontSize: 15, fontWeight: '800' }}>Sign Out</Text>
          </TouchableOpacity>

        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({});
