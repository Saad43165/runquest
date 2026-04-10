import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Switch,
  Alert, Animated, ScrollView, Platform, Dimensions,
} from 'react-native';
import { getSettings, updateSettings, resetSettings, Settings } from '../config/settings';
import { clearHistory } from '../services/history';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, ThemeName } from '@/utils/ThemeContext';
import * as Haptics from 'expo-haptics';
import { logoutUser } from '../services/authService';
import { confirmAction } from '../utils/AlertUtils';
import { getFriendlyErrorMessage } from '../utils/ErrorUtils';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

// ─── Constants ────────────────────────────────────────────────────────────

const THEME_DATA: { key: ThemeName; label: string; primary: string; surface: string }[] = [
  { key: 'midnight', label: 'Dark',   primary: '#32D74B', surface: '#1C1C1E' },
  { key: 'aurora',   label: 'Blue',   primary: '#00C6FF', surface: '#0B1B20' },
  { key: 'sunset',   label: 'Orange', primary: '#FFC247', surface: '#24150D' },
  { key: 'light',    label: 'Light',  primary: '#007AFF', surface: '#F2F2F7' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function SettingsRow({
  label, icon, color, children, last, desc
}: {
  label: string; icon: string; color: string; children: React.ReactNode; last?: boolean; desc?: string;
}) {
  const { T, themeName } = useTheme();
  const isLight = themeName === 'light';
  return (
    <View style={[styles.settingsRow, !last && { borderBottomColor: T.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <View style={[styles.rowIconContainer, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon as any} size={20} color={color} />
      </View>
      <View style={{ flex: 1, marginRight: 12 }}>
        <Text style={[styles.rowLabel, { color: isLight ? '#000' : T.white }]}>{label}</Text>
        {desc && <Text style={[styles.rowDesc, { color: T.text }]}>{desc}</Text>}
      </View>
      {children}
    </View>
  );
}

function SectionTitle({ title }: { title: string }) {
  const { T } = useTheme();
  return (
    <Text style={[styles.sectionTitle, { color: T.text }]}>{title}</Text>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const { T, setTheme, themeName } = useTheme();
  const isLight = themeName === 'light';
  const insets = useSafeAreaInsets();
  const [settings, setSettings] = useState<Settings | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    (async () => {
      setSettings(await getSettings());
    })();
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  const update = async (patch: Partial<Settings>) => {
    Haptics.selectionAsync();
    const next = await updateSettings(patch as any);
    setSettings(next);
  };

  const onLogout = () => {
    confirmAction({
      title: 'Sign Out',
      message: 'Are you sure you want to sign out?',
      confirmText: 'Sign Out',
      style: 'destructive',
      onConfirm: async () => {
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          await logoutUser();
        } catch (e: any) {
          Alert.alert('Error', getFriendlyErrorMessage(e));
        }
      }
    });
  };

  if (!settings) return null;

  return (
    <View style={{ flex: 1, backgroundColor: T.black }}>
      <LinearGradient colors={[T.accent2 + (isLight ? '08' : '15'), 'transparent']} style={StyleSheet.absoluteFill} />
      
      <Animated.ScrollView
        style={{ flex: 1, opacity: fadeAnim }}
        contentContainerStyle={{ paddingTop: insets.top + 20, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: isLight ? '#000' : T.white }]}>Settings</Text>
          <Text style={[styles.subtitle, { color: T.text }]}>Customize your experience</Text>
        </View>

        {/* ── Theme Selection ── */}
        <SectionTitle title="THEME & APPEARANCE" />
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={{ paddingHorizontal: 24, gap: 12 }}
        >
          {THEME_DATA.map((t) => (
            <TouchableOpacity
              key={t.key}
              activeOpacity={0.8}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setTheme(t.key);
                update({ uiTheme: t.key });
              }}
              style={[
                styles.themeCard,
                { backgroundColor: t.surface, borderColor: themeName === t.key ? t.primary : T.border, borderWidth: themeName === t.key ? 2 : 1 }
              ]}
            >
              <View style={[styles.themePreview, { backgroundColor: t.primary }]}>
                <Ionicons name="color-palette-outline" size={16} color={t.key === 'light' ? '#FFF' : '#000'} />
              </View>
              <Text style={[styles.themeLabel, { color: t.key === 'light' ? '#000' : '#FFF' }]}>{t.label}</Text>
              {themeName === t.key && <View style={[styles.activeDot, { backgroundColor: t.primary }]} />}
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── Map Settings ── */}
        <SectionTitle title="MAP OPTIONS" />
        <View style={[styles.card, { backgroundColor: isLight ? '#FFF' : T.card, borderColor: T.border, borderWidth: 1 }]}>
          <SettingsRow label="Dark Map" desc="Use darker road tiles" icon="map-outline" color="#007AFF">
            <Switch
              value={settings.tileStyle === 'dark'}
              onValueChange={(v) => update({ tileStyle: v ? 'dark' : 'default' })}
              trackColor={{ true: T.green, false: T.muted }}
              thumbColor="#FFF"
            />
          </SettingsRow>
          <SettingsRow label="Show Territories" desc="Display claimed areas" icon="grid-outline" color="#AF52DE">
            <Switch
              value={settings.defaultShowPolygons}
              onValueChange={(v) => update({ defaultShowPolygons: v })}
              trackColor={{ true: T.green, false: T.muted }}
              thumbColor="#FFF"
            />
          </SettingsRow>
          <SettingsRow label="Show Run Path" desc="Draw route line on map" icon="analytics-outline" color="#FF9500" last>
            <Switch
              value={settings.defaultShowPath}
              onValueChange={(v) => update({ defaultShowPath: v })}
              trackColor={{ true: T.green, false: T.muted }}
              thumbColor="#FFF"
            />
          </SettingsRow>
        </View>

        {/* ── Tracking ── */}
        <SectionTitle title="TRACKING & GPS" />
        <View style={[styles.card, { backgroundColor: isLight ? '#FFF' : T.card, borderColor: T.border, borderWidth: 1 }]}>
          <SettingsRow label="High Precision GPS" desc="Better accuracy, more battery" icon="locate" color="#FF3B30">
            <Switch
              value={settings.locationAccuracy === 'High'}
              onValueChange={(v) => update({ locationAccuracy: v ? 'High' : 'Balanced' })}
              trackColor={{ true: T.green, false: T.muted }}
              thumbColor="#FFF"
            />
          </SettingsRow>
          <SettingsRow label="Auto-Pause" desc="Pause when you stop moving" icon="pause-circle" color="#00C6FF" last>
            <Switch
              value={settings.autoPause}
              onValueChange={(v) => update({ autoPause: v })}
              trackColor={{ true: T.green, false: T.muted }}
              thumbColor="#FFF"
            />
          </SettingsRow>
        </View>

        {/* ── Units ── */}
        <SectionTitle title="UNIT SYSTEM" />
        <View style={styles.unitsRow}>
          <TouchableOpacity 
            activeOpacity={0.7}
            onPress={() => update({ units: 'metric' })}
            style={[styles.unitBtn, { backgroundColor: isLight ? (settings.units === 'metric' ? T.green + '15' : '#FFF') : T.card, borderColor: settings.units === 'metric' ? T.green : T.border }]}
          >
            <Text style={[styles.unitText, { color: settings.units === 'metric' ? (isLight ? '#000' : T.green) : T.text }]}>Metric (KM)</Text>
          </TouchableOpacity>
          <TouchableOpacity 
             activeOpacity={0.7}
             onPress={() => update({ units: 'imperial' })}
             style={[styles.unitBtn, { backgroundColor: isLight ? (settings.units === 'imperial' ? T.green + '15' : '#FFF') : T.card, borderColor: settings.units === 'imperial' ? T.green : T.border }]}
          >
            <Text style={[styles.unitText, { color: settings.units === 'imperial' ? (isLight ? '#000' : T.green) : T.text }]}>Imperial (MI)</Text>
          </TouchableOpacity>
        </View>

        {/* ── Notifications ── */}
        <SectionTitle title="NOTIFICATIONS" />
        <View style={[styles.card, { backgroundColor: isLight ? '#FFF' : T.card, borderColor: T.border, borderWidth: 1 }]}>
          <SettingsRow label="Run Milestone Alerts" desc="Vibrate on KM reached" icon="notifications-outline" color={T.gold} last>
            <Switch
              value={settings.vibrateOnAction}
              onValueChange={(v) => update({ vibrateOnAction: v })}
              trackColor={{ true: T.green, false: T.muted }}
              thumbColor="#FFF"
            />
          </SettingsRow>
        </View>

        {/* ── RunBot ── */}
        <SectionTitle title="RUNBOT ASSISTANT" />
        <View style={[styles.card, { backgroundColor: isLight ? '#FFF' : T.card, borderColor: T.border, borderWidth: 1 }]}>
          <SettingsRow label="Show RunBot Button" desc="Floating assistant on Run screen" icon="hardware-chip-outline" color={T.green} last>
            <Switch
              value={settings.showRunBotFab}
              onValueChange={(v) => update({ showRunBotFab: v })}
              trackColor={{ true: T.green, false: T.muted }}
              thumbColor="#FFF"
            />
          </SettingsRow>
        </View>

        {/* ── Data Management ── */}
        <SectionTitle title="ACCOUNT & DATA" />
        <View style={[styles.card, { backgroundColor: isLight ? '#FFF' : T.card, borderColor: T.border, borderWidth: 1 }]}>
          <TouchableOpacity 
            activeOpacity={0.7}
            style={styles.actionRow}
            onPress={() => {
              Alert.alert('Reset History', 'Delete all your previous runs permanently?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete All', style: 'destructive', onPress: async () => {
                  await clearHistory();
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  Alert.alert('Success', 'History cleared.');
                }}
              ]);
            }}
          >
             <Ionicons name="trash-outline" size={20} color={T.red} />
             <Text style={[styles.actionText, { color: T.red }]}>Clear Run History</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            activeOpacity={0.7}
            style={[styles.actionRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.border }]}
            onPress={onLogout}
          >
             <Ionicons name="log-out-outline" size={20} color={T.text} />
             <Text style={[styles.actionText, { color: isLight ? '#000' : T.white }]}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.version, { color: T.text }]}>Version 1.0.4</Text>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 24, marginBottom: 32 },
  title: { fontSize: 32, fontWeight: '900', letterSpacing: -1 },
  subtitle: { fontSize: 13, fontWeight: '600', opacity: 0.6, marginTop: 4 },
  sectionTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, paddingHorizontal: 28, marginBottom: 12, marginTop: 24 },
  card: { marginHorizontal: 24, borderRadius: 24, overflow: 'hidden' },
  settingsRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16 },
  rowIconContainer: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  rowLabel: { fontSize: 16, fontWeight: '700' },
  rowDesc: { fontSize: 12, marginTop: 2, opacity: 0.6 },
  themeCard: { width: 100, height: 110, borderRadius: 20, padding: 12, borderWidth: 1, justifyContent: 'space-between' },
  themePreview: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  themeLabel: { fontSize: 13, fontWeight: '800' },
  activeDot: { position: 'absolute', top: 12, right: 12, width: 6, height: 6, borderRadius: 3 },
  unitsRow: { flexDirection: 'row', paddingHorizontal: 24, gap: 10 },
  unitBtn: { flex: 1, height: 48, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  unitText: { fontSize: 14, fontWeight: '800' },
  actionRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
  actionText: { fontSize: 16, fontWeight: '700' },
  version: { textAlign: 'center', fontSize: 11, fontWeight: '700', opacity: 0.3, marginTop: 40 },
});
