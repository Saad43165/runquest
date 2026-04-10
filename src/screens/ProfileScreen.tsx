import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  ScrollView, Alert, ActivityIndicator, Image, Modal,
  TextInput, KeyboardAvoidingView, Platform, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { ProfileStackParamList } from '../navigation/ProfileStackNavigator';
import { useTheme } from '@/utils/ThemeContext';
import { useAuth } from '../context/AuthContext';
import {
  logoutUser, updateUserProfile, uploadProfileImage, avatarColor,
} from '../services/authService';
import { updateProfile } from 'firebase/auth';
import { auth } from '../services/firebase';
import { confirmAction } from '../utils/AlertUtils';
import { getFriendlyErrorMessage } from '../utils/ErrorUtils';
import { getHistory, getHistoryStats, RunRecord } from '../services/history';
import { getSettings, Settings } from '../config/settings';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

function getLevelInfo(totalDistM: number) {
  const km = totalDistM / 1000;
  const xpPerLevel = 10;
  const level = Math.floor(km / xpPerLevel) + 1;
  const progress = (km % xpPerLevel) / xpPerLevel;
  return { level, progress, km };
}

// ─── Stat Box ─────────────────────────────────────────────────────────────────

function StatBox({ label, value, icon, color, index }: { label: string; value: string; icon: string; color: string; index: number }) {
  const { T, themeName } = useTheme();
  const isLight = themeName === 'light';
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: 1, delay: index * 100, useNativeDriver: true, tension: 50, friction: 8 }).start();
  }, []);
  return (
    <Animated.View style={[styles.statBox, { opacity: anim, transform: [{ scale: anim }] }]}>
      <View style={[styles.statInner, { backgroundColor: isLight ? '#FFF' : T.card, borderColor: isLight ? '#EEE' : T.border, borderWidth: 1 }]}>
        <View style={[styles.statIconCircle, { backgroundColor: color + '15' }]}>
          <Ionicons name={icon as any} size={18} color={color} />
        </View>
        <Text style={[styles.statValue, { color: isLight ? '#000' : T.white }]}>{value}</Text>
        <Text style={[styles.statLabel, { color: T.text }]}>{label}</Text>
      </View>
    </Animated.View>
  );
}

// ─── Nav Card ─────────────────────────────────────────────────────────────────

function NavCard({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  const { T, themeName } = useTheme();
  const isLight = themeName === 'light';
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[styles.navCard, { backgroundColor: isLight ? '#FFF' : T.card, borderColor: isLight ? '#EEE' : T.border }]}
    >
      <View style={[styles.navCardIcon, { backgroundColor: T.green + '15' }]}>
        <Ionicons name={icon as any} size={20} color={T.green} />
      </View>
      <Text style={[styles.navCardLabel, { color: isLight ? '#000' : T.white }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={T.text} />
    </TouchableOpacity>
  );
}

// ─── Edit Profile Modal ───────────────────────────────────────────────────────

interface EditModalProps {
  visible: boolean;
  onClose: () => void;
  initialName: string;
  initialUsername: string;
  initialBio: string;
  onSave: (name: string, username: string, bio: string) => Promise<void>;
}

function EditProfileModal({ visible, onClose, initialName, initialUsername, initialBio, onSave }: EditModalProps) {
  const { T, themeName } = useTheme();
  const isLight = themeName === 'light';
  const [name, setName] = useState(initialName);
  const [username, setUsername] = useState(initialUsername);
  const [bio, setBio] = useState(initialBio);
  const [saving, setSaving] = useState(false);
  const slideAnim = useRef(new Animated.Value(600)).current;

  useEffect(() => {
    if (visible) {
      setName(initialName);
      setUsername(initialUsername);
      setBio(initialBio);
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 60, friction: 12 }).start();
    } else {
      slideAnim.setValue(600);
    }
  }, [visible, initialName, initialUsername, initialBio]);

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Error', 'Display name cannot be empty.'); return; }
    if (!username.trim()) { Alert.alert('Error', 'Username cannot be empty.'); return; }
    setSaving(true);
    try {
      await onSave(name.trim(), username.trim(), bio.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    } catch (e) {
      Alert.alert('Save Failed', getFriendlyErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const bg = isLight ? '#FFF' : '#111';
  const inputBg = isLight ? '#F5F5F5' : '#1C1C1E';
  const textColor = isLight ? '#000' : '#FFF';

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <Animated.View style={{ transform: [{ translateY: slideAnim }] }}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={{ backgroundColor: bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40, borderWidth: 1, borderColor: isLight ? '#EEE' : 'rgba(255,255,255,0.1)' }}>
              {/* Handle */}
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: isLight ? '#DDD' : '#333', alignSelf: 'center', marginBottom: 20 }} />

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <Text style={{ color: textColor, fontSize: 20, fontWeight: '900' }}>Edit Profile</Text>
                <TouchableOpacity onPress={onClose}>
                  <Ionicons name="close" size={24} color={T.text} />
                </TouchableOpacity>
              </View>

              {/* Display Name */}
              <Text style={{ color: T.text, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 8 }}>DISPLAY NAME</Text>
              <View style={{ backgroundColor: inputBg, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 4, marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name="person-outline" size={16} color={T.text} />
                <TextInput
                  value={name}
                  onChangeText={setName}
                  style={{ flex: 1, color: textColor, fontSize: 16, paddingVertical: 12 }}
                  placeholderTextColor={T.text + '80'}
                  placeholder="Your display name"
                />
              </View>

              {/* Username */}
              <Text style={{ color: T.text, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 8 }}>USERNAME</Text>
              <View style={{ backgroundColor: inputBg, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 4, marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={{ color: T.text, fontSize: 16 }}>@</Text>
                <TextInput
                  value={username}
                  onChangeText={setUsername}
                  style={{ flex: 1, color: textColor, fontSize: 16, paddingVertical: 12 }}
                  placeholderTextColor={T.text + '80'}
                  placeholder="username"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              {/* Bio */}
              <Text style={{ color: T.text, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 8 }}>BIO</Text>
              <View style={{ backgroundColor: inputBg, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 4, marginBottom: 28 }}>
                <TextInput
                  value={bio}
                  onChangeText={setBio}
                  style={{ color: textColor, fontSize: 15, paddingVertical: 12, minHeight: 80, textAlignVertical: 'top' }}
                  placeholderTextColor={T.text + '80'}
                  placeholder="Tell the world about yourself..."
                  multiline
                  maxLength={160}
                />
                <Text style={{ color: T.text, fontSize: 11, textAlign: 'right', opacity: 0.5, paddingBottom: 8 }}>{bio.length}/160</Text>
              </View>

              {/* Save Button */}
              <TouchableOpacity
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.85}
                style={{ borderRadius: 16, overflow: 'hidden' }}
              >
                <LinearGradient colors={[T.green, '#28C041']} style={{ paddingVertical: 18, alignItems: 'center', justifyContent: 'center' }}>
                  {saving
                    ? <ActivityIndicator color="#000" />
                    : <Text style={{ color: '#000', fontWeight: '900', fontSize: 16 }}>SAVE CHANGES</Text>
                  }
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { T, themeName } = useTheme();
  const isLight = themeName === 'light';
  const insets = useSafeAreaInsets();
  const { user, profile, refreshProfile } = useAuth();
  const navigation = useNavigation<StackNavigationProp<ProfileStackParamList>>();

  const [history, setHistory] = useState<RunRecord[]>([]);
  const [stats, setStats] = useState({ runs: 0, totalDistanceMeters: 0, totalDurationSec: 0, longestDistanceMeters: 0 });
  const [settings, setSettings] = useState<Settings | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const scrollY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    (async () => {
      setHistory(await getHistory());
      setStats(await getHistoryStats());
      setSettings(await getSettings());
    })();
  }, []);

  // Resolve photo URL — prefer Firestore profile, fallback to Firebase Auth
  const photoURL = profile?.photoURL || user?.photoURL || null;

  const onPickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission Required', 'We need camera roll access to update your profile photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled) {
      setUploading(true);
      try {
        await uploadProfileImage(user!.uid, result.assets[0].uri);
        await refreshProfile();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (e) {
        Alert.alert('Upload Failed', getFriendlyErrorMessage(e));
      } finally {
        setUploading(false);
      }
    }
  };

  const onSaveProfile = async (displayName: string, username: string, bio: string) => {
    if (!user) return;
    // Update Firebase Auth display name
    await updateProfile(auth.currentUser!, { displayName });
    // Update Firestore profile
    await updateUserProfile(user.uid, { displayName, username, bio });
    await refreshProfile();
  };

  const onLogout = () => {
    confirmAction({
      title: 'Sign Out',
      message: 'Are you sure you want to sign out?',
      confirmText: 'Sign Out',
      style: 'destructive',
      onConfirm: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        logoutUser();
      },
    });
  };

  const isMetric = settings?.units !== 'imperial';
  const unitLabel = isMetric ? 'KM' : 'MI';
  const distMult = isMetric ? 1000 : 1609.34;
  const { level, progress, km } = getLevelInfo(stats.totalDistanceMeters);
  const avatarCol = profile?.avatarColor || avatarColor(user?.uid || 'user');

  const displayName = profile?.displayName || user?.displayName || 'Runner';
  const username = profile?.username || '';
  const bio = profile?.bio || '';
  const email = profile?.email || user?.email || '';

  return (
    <View style={{ flex: 1, backgroundColor: T.black }}>
      <LinearGradient colors={[avatarCol + (isLight ? '10' : '20'), 'transparent']} style={StyleSheet.absoluteFill} />

      <EditProfileModal
        visible={showEditModal}
        onClose={() => setShowEditModal(false)}
        initialName={displayName}
        initialUsername={username}
        initialBio={bio}
        onSave={onSaveProfile}
      />

      <Animated.ScrollView
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        contentContainerStyle={{ paddingTop: insets.top + 20, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
      >
        {/* ── Avatar + Name ── */}
        <View style={styles.header}>
          <TouchableOpacity activeOpacity={0.9} onPress={onPickImage} style={[styles.avatarFrame, { borderColor: avatarCol }]}>
            {photoURL ? (
              <Image
                source={{ uri: photoURL }}
                style={styles.avatarImg}
                onError={() => {/* silently ignore broken image */}}
              />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: avatarCol }]}>
                <Text style={[styles.initials, { color: '#FFF' }]}>{displayName[0]?.toUpperCase() ?? 'R'}</Text>
              </View>
            )}
            {uploading && (
              <View style={styles.uploadOverlay}>
                <ActivityIndicator color="#FFF" />
              </View>
            )}
            <View style={styles.camBadge}>
              <Ionicons name="camera" size={12} color="#000" />
            </View>
          </TouchableOpacity>

          <View style={styles.nameBlock}>
            <Text style={[styles.displayName, { color: isLight ? '#000' : T.white }]} numberOfLines={1}>{displayName}</Text>
            {username ? <Text style={[styles.username, { color: T.text }]}>@{username}</Text> : null}
            {email ? <Text style={[styles.emailText, { color: T.text }]}>{email}</Text> : null}
            <View style={[styles.levelTag, { backgroundColor: avatarCol + '15', borderColor: avatarCol + '40' }]}>
              <Text style={[styles.levelText, { color: avatarCol }]}>LEVEL {level} RUNNER</Text>
            </View>
          </View>

          <View style={{ gap: 8 }}>
            <TouchableOpacity
              onPress={() => setShowEditModal(true)}
              style={[styles.iconBtn, { backgroundColor: isLight ? '#F2F2F7' : T.card, borderColor: isLight ? '#EEE' : T.border }]}
            >
              <Ionicons name="pencil" size={18} color={T.green} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onLogout}
              style={[styles.iconBtn, { backgroundColor: isLight ? '#F2F2F7' : T.card, borderColor: isLight ? '#EEE' : T.border }]}
            >
              <Ionicons name="log-out-outline" size={18} color={T.red} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Bio ── */}
        {bio ? (
          <View style={[styles.bioCard, { backgroundColor: isLight ? '#FFF' : T.card, borderColor: isLight ? '#EEE' : T.border }]}>
            <Text style={{ color: T.text, fontSize: 14, lineHeight: 22 }}>{bio}</Text>
          </View>
        ) : (
          <TouchableOpacity
            onPress={() => setShowEditModal(true)}
            style={[styles.bioCard, { backgroundColor: isLight ? '#FFF' : T.card, borderColor: isLight ? '#EEE' : T.border, flexDirection: 'row', alignItems: 'center', gap: 10 }]}
          >
            <Ionicons name="add-circle-outline" size={18} color={T.text} />
            <Text style={{ color: T.text, fontSize: 14 }}>Add a bio...</Text>
          </TouchableOpacity>
        )}

        {/* ── Stats ── */}
        <View style={styles.statsGrid}>
          <StatBox index={0} label="TOTAL RUNS" value={String(stats.runs)} icon="fitness-outline" color={avatarCol} />
          <StatBox index={1} label="DISTANCE" value={(stats.totalDistanceMeters / distMult).toFixed(1)} icon="walk-outline" color={T.accent2} />
          <StatBox index={2} label="BEST RUN" value={(stats.longestDistanceMeters / distMult).toFixed(1)} icon="trophy-outline" color={T.gold} />
        </View>

        {/* ── Level Progress ── */}
        <View style={styles.section}>
          <View style={[styles.progressCard, { backgroundColor: isLight ? '#FFF' : T.card, borderColor: isLight ? '#EEE' : T.border, borderWidth: 1 }]}>
            <View style={styles.progressHeader}>
              <Text style={[styles.progressTitle, { color: isLight ? '#000' : T.white }]}>Level {level} Progress</Text>
              <Text style={[styles.progressPercent, { color: avatarCol }]}>{Math.round(progress * 100)}%</Text>
            </View>
            <View style={[styles.progressBarBase, { backgroundColor: isLight ? '#EEE' : 'rgba(255,255,255,0.1)' }]}>
              <View style={[styles.progressBarFill, { backgroundColor: avatarCol, width: `${progress * 100}%` }]} />
            </View>
            <Text style={[styles.progressNext, { color: T.text }]}>
              {km.toFixed(1)} / {Math.ceil((km + 0.1) / 10) * 10} {unitLabel} to Level {level + 1}
            </Text>
          </View>
        </View>

        {/* ── Features Grid ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: T.text }]}>FEATURES</Text>
          <View style={styles.featureGrid}>
            {[
              { icon: 'trophy', label: 'Achievements', desc: 'Badges & milestones', color: T.gold, route: 'Achievements' },
              { icon: 'podium', label: 'Leaderboard', desc: 'Global rankings', color: T.accent2, route: 'Leaderboard' },
              { icon: 'flame', label: 'Fitness', desc: 'Calories & zones', color: '#FF453A', route: 'Fitness' },
              { icon: 'hardware-chip', label: 'RunBot', desc: 'AI assistant', color: T.green, route: 'ChatBot' },
            ].map((item) => (
              <TouchableOpacity
                key={item.route}
                activeOpacity={0.8}
                onPress={() => { try { navigation.navigate(item.route as any); } catch (e) {} }}
                style={[styles.featureCard, { backgroundColor: isLight ? '#FFF' : T.card, borderColor: isLight ? '#EEE' : T.border }]}
              >
                <View style={[styles.featureIconBox, { backgroundColor: item.color + '18' }]}>
                  <Ionicons name={item.icon as any} size={24} color={item.color} />
                </View>
                <Text style={[styles.featureLabel, { color: isLight ? '#000' : T.white }]}>{item.label}</Text>
                <Text style={[styles.featureDesc, { color: T.text }]}>{item.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {/* Help & Support as a single full-width row below the grid */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => { try { navigation.navigate('HelpSupport' as any); } catch (e) {} }}
            style={[styles.navCard, { backgroundColor: isLight ? '#FFF' : T.card, borderColor: isLight ? '#EEE' : T.border, marginTop: 4 }]}
          >
            <View style={[styles.navCardIcon, { backgroundColor: T.text + '15' }]}>
              <Ionicons name="help-circle-outline" size={20} color={T.text} />
            </View>
            <Text style={[styles.navCardLabel, { color: isLight ? '#000' : T.white }]}>Help & Support</Text>
            <Ionicons name="chevron-forward" size={18} color={T.text} />
          </TouchableOpacity>
        </View>

        {/* ── Recent Runs ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: T.text }]}>RECENT RUNS</Text>
          {history.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: isLight ? '#F2F2F7' : T.card }]}>
              <Ionicons name="trail-sign-outline" size={32} color={T.text} />
              <Text style={{ color: T.text, marginTop: 8, fontSize: 13 }}>No runs yet. Start your first quest!</Text>
            </View>
          ) : (
            history.slice(0, 5).map(run => (
              <View key={run.id} style={[styles.runItem, { backgroundColor: isLight ? '#FFF' : T.card, borderColor: isLight ? '#EEE' : T.border, borderWidth: 1 }]}>
                <View style={[styles.runIcon, { backgroundColor: avatarCol + '15' }]}>
                  <Ionicons name="map-outline" size={18} color={avatarCol} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.runDate, { color: isLight ? '#000' : T.white }]}>
                    {new Date(run.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </Text>
                  <Text style={[styles.runSub, { color: T.text }]}>{Math.round(run.durationSec / 60)} mins</Text>
                </View>
                <Text style={[styles.runValue, { color: T.green }]}>
                  {(run.distanceMeters / distMult).toFixed(2)} {unitLabel}
                </Text>
              </View>
            ))
          )}
        </View>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 24, flexDirection: 'row', alignItems: 'flex-start', gap: 16, marginBottom: 16 },
  avatarFrame: { width: 88, height: 88, borderRadius: 28, borderWidth: 2, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  avatarImg: { width: '100%', height: '100%' },
  avatarPlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  initials: { fontSize: 32, fontWeight: '900' },
  uploadOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  camBadge: { position: 'absolute', bottom: 6, right: 6, backgroundColor: '#FFF', borderRadius: 8, padding: 4, elevation: 3 },
  nameBlock: { flex: 1, paddingTop: 4 },
  displayName: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  username: { fontSize: 13, fontWeight: '600', opacity: 0.6, marginTop: 2 },
  emailText: { fontSize: 12, opacity: 0.5, marginTop: 2 },
  levelTag: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, marginTop: 8 },
  levelText: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  iconBtn: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  bioCard: { marginHorizontal: 24, marginBottom: 24, padding: 16, borderRadius: 16, borderWidth: 1 },
  statsGrid: { flexDirection: 'row', paddingHorizontal: 24, gap: 12, marginBottom: 24 },
  statBox: { flex: 1 },
  statInner: { borderRadius: 20, padding: 14, alignItems: 'center', gap: 6 },
  statIconCircle: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 17, fontWeight: '900' },
  statLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1, textAlign: 'center' },
  section: { paddingHorizontal: 24, marginBottom: 32 },
  sectionTitle: { fontSize: 12, fontWeight: '900', letterSpacing: 1.5, marginBottom: 16, opacity: 0.8 },
  progressCard: { padding: 20, borderRadius: 24 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 },
  progressTitle: { fontSize: 16, fontWeight: '800' },
  progressPercent: { fontSize: 20, fontWeight: '900' },
  progressBarBase: { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 4 },
  progressNext: { fontSize: 11, fontWeight: '700', marginTop: 10, textAlign: 'right' },
  runItem: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 20, marginBottom: 10 },
  runIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  runDate: { fontSize: 15, fontWeight: '800' },
  runSub: { fontSize: 12, fontWeight: '600', marginTop: 2, opacity: 0.7 },
  runValue: { fontSize: 16, fontWeight: '900' },
  emptyCard: { padding: 40, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  navCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 20, marginBottom: 10, borderWidth: 1 },
  navCardIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  navCardLabel: { flex: 1, fontSize: 16, fontWeight: '700' },
  featureGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 },
  featureCard: { width: '47%', borderRadius: 20, padding: 16, borderWidth: 1, gap: 8 },
  featureIconBox: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  featureLabel: { fontSize: 15, fontWeight: '800' },
  featureDesc: { fontSize: 12, opacity: 0.7 },
});
