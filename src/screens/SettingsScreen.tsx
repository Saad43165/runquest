import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Switch,
  Animated, ScrollView, Dimensions, Alert,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { SvgXml } from 'react-native-svg';
import { getSettings, updateSettings, Settings } from '../config/settings';
import { clearHistory } from '../services/history';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, ThemeName } from '@/utils/ThemeContext';
import * as Haptics from 'expo-haptics';
import { logoutUser } from '../services/authService';
import { getFriendlyErrorMessage } from '../utils/ErrorUtils';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { OrbBackground } from '../components/OrbBackground';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { MusicWarningDialog } from '../components/MusicWarningDialog';
import { usePremium } from '../context/PremiumContext';
import { setDeveloperOverrideTier } from '../services/premiumService';

const { width } = Dimensions.get('window');

function goToPremium(navigation: any) {
  try {
    const parent = navigation.getParent?.();
    if (parent) {
      parent.navigate('Profile', { screen: 'Premium' });
    } else {
      navigation.navigate('Profile', { screen: 'Premium' });
    }
  } catch {
    try {
      navigation.navigate('Premium');
    } catch {}
  }
}

const THEME_DATA: { key: ThemeName; label: string; emoji: string; primary: string; surface: string }[] = [
  { key: 'midnight', label: 'Dark',   emoji: '🌑', primary: '#00C6FF', surface: '#1C1C1E' },
  { key: 'aurora',   label: 'Blue',   emoji: '🌊', primary: '#00C6FF', surface: '#0B1B20' },
  { key: 'sunset',   label: 'Orange', emoji: '🌅', primary: '#FFC247', surface: '#24150D' },
  { key: 'light',    label: 'Light',  emoji: '☀️', primary: '#007AFF', surface: '#F2F2F7' },
];

type Tab = 'map' | 'run' | 'general' | 'profile' | 'account';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'map',     label: 'Map',     icon: 'map-outline' },
  { id: 'run',     label: 'Run',     icon: 'fitness-outline' },
  { id: 'general', label: 'General', icon: 'settings-outline' },
  { id: 'profile', label: 'Profile', icon: 'person-circle-outline' },
  { id: 'account', label: 'Account', icon: 'key-outline' },
];

// ─── Row ──────────────────────────────────────────────────────────────────────

function Row({ label, desc, icon, color, children, last }: {
  label: string; desc?: string; icon: string; color: string;
  children: React.ReactNode; last?: boolean;
}) {
  const { T, themeName } = useTheme();
  const isLight = themeName === 'light';
  return (
    <View style={[styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.border }]}>
      <View style={[styles.rowIcon, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon as any} size={19} color={color} />
      </View>
      <View style={{ flex: 1, marginRight: 10 }}>
        <Text style={[styles.rowLabel, { color: isLight ? '#000' : T.white }]}>{label}</Text>
        {desc ? <Text style={[styles.rowDesc, { color: T.text }]}>{desc}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  const { T, themeName } = useTheme();
  const isLight = themeName === 'light';
  return (
    <View style={[styles.card, { backgroundColor: isLight ? '#FFF' : T.card, borderColor: T.border }]}>
      {children}
    </View>
  );
}

function SectionLabel({ title }: { title: string }) {
  const { T, themeName } = useTheme();
  const isLight = themeName === 'light';
  return (
    <Text style={[styles.sectionLabel, { color: isLight ? '#555' : '#AAA' }]}>{title}</Text>
  );
}

// ─── Tab content ──────────────────────────────────────────────────────────────

function MapTab({ settings, update }: { settings: Settings; update: (p: Partial<Settings>) => void }) {
  const { T, setTheme, themeName } = useTheme();
  const isLight = themeName === 'light';
  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.tabContent}>
      <SectionLabel title="THEME" />
      <View style={styles.themeRow}>
        {THEME_DATA.map(t => (
          <TouchableOpacity
            key={t.key}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setTheme(t.key); update({ uiTheme: t.key }); }}
            style={[styles.themeCard, { backgroundColor: t.surface, borderColor: themeName === t.key ? t.primary : T.border, borderWidth: themeName === t.key ? 2 : 1 }]}
          >
            <Text style={{ fontSize: 22 }}>{t.emoji}</Text>
            <Text style={[styles.themeLabel, { color: t.key === 'light' ? '#000' : '#FFF' }]}>{t.label}</Text>
            {themeName === t.key && <View style={[styles.activeDot, { backgroundColor: t.primary }]} />}
          </TouchableOpacity>
        ))}
      </View>

      <SectionLabel title="MAP STYLE" />
      <Card>
        {/* Map mode selector — 4 options */}
        <View style={{ padding: 14, gap: 8 }}>
          <Text style={{ color: T.text, fontSize: 10, fontWeight: '800', letterSpacing: 1 }}>MAP MODE</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {([
              { value: 'default',   label: 'Light',     icon: 'sunny-outline', color: '#007AFF' },
              { value: 'dark',      label: 'Dark',       icon: 'moon-outline',  color: '#5E5CE6' },
              { value: 'satellite', label: 'Satellite',  icon: 'earth',         color: '#FFD60A' },
              { value: '3d',        label: '3D',         icon: 'cube-outline',  color: '#FF6B35' },
            ] as const).map(opt => (
              <TouchableOpacity
                key={opt.value}
                onPress={() => update({ tileStyle: opt.value })}
                style={[{
                  flex: 1, borderRadius: 14, borderWidth: 1.5, paddingVertical: 12,
                  alignItems: 'center', gap: 6,
                  backgroundColor: settings.tileStyle === opt.value ? opt.color + '20' : T.card,
                  borderColor: settings.tileStyle === opt.value ? opt.color : T.border,
                }]}
              >
                <Ionicons name={opt.icon as any} size={20} color={settings.tileStyle === opt.value ? opt.color : T.text} />
                <Text style={{ fontSize: 11, fontWeight: '800', color: settings.tileStyle === opt.value ? opt.color : T.text }}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <Row label="Show Territories" desc="Claimed areas on map" icon="grid-outline" color="#AF52DE">
          <Switch value={settings.defaultShowPolygons} onValueChange={v => update({ defaultShowPolygons: v })} trackColor={{ true: T.green, false: T.muted }} thumbColor="#FFF" />
        </Row>
        <Row label="Show Run Path" desc="Route line while running" icon="analytics-outline" color="#FF9500">
          <Switch value={settings.defaultShowPath} onValueChange={v => update({ defaultShowPath: v })} trackColor={{ true: T.green, false: T.muted }} thumbColor="#FFF" />
        </Row>
        <Row label="Global Territories" desc="Show all territories worldwide" icon="earth-outline" color="#00C6FF">
          <Switch value={(settings as any).showGlobalTerritories !== false} onValueChange={v => update({ showGlobalTerritories: v } as any)} trackColor={{ true: T.green, false: T.muted }} thumbColor="#FFF" />
        </Row>
        <Row label="Live Warriors" desc="See active runners on map" icon="radio-outline" color="#FF453A">
          <Switch value={(settings as any).showLiveUsers !== false} onValueChange={v => update({ showLiveUsers: v } as any)} trackColor={{ true: T.green, false: T.muted }} thumbColor="#FFF" />
        </Row>
        <Row label="Share My Location" desc="Let others see you on the global map" icon="location-outline" color="#FF9F0A">
          <Switch value={(settings as any).showMyLocation !== false} onValueChange={v => update({ showMyLocation: v } as any)} trackColor={{ true: T.green, false: T.muted }} thumbColor="#FFF" />
        </Row>
        <Row label="Zoom Buttons" desc="+/- buttons on map" icon="add-circle-outline" color="#5E5CE6" last>
          <Switch value={settings.showZoomButtons !== false} onValueChange={v => update({ showZoomButtons: v })} trackColor={{ true: T.green, false: T.muted }} thumbColor="#FFF" />
        </Row>
      </Card>
    </ScrollView>
  );
}

function RunTab({ settings, update, onShowMusicWarning }: { settings: Settings; update: (p: Partial<Settings>) => void; onShowMusicWarning: () => void }) {
  const { T } = useTheme();
  const { status } = usePremium();
  const userTier = status.tier || 'free';
  const navigation = useNavigation<any>();

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.tabContent}>
      <SectionLabel title="UNITS" />
      <View style={styles.unitRow}>
        {(['metric', 'imperial'] as const).map(u => (
          <TouchableOpacity
            key={u}
            onPress={() => update({ units: u })}
            style={[styles.unitBtn, { backgroundColor: settings.units === u ? T.green + '20' : T.card, borderColor: settings.units === u ? T.green : T.border }]}
          >
            <Text style={[styles.unitText, { color: settings.units === u ? T.green : T.text }]}>
              {u === 'metric' ? '📏 Metric (KM)' : '🦅 Imperial (MI)'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <SectionLabel title="GPS & TRACKING" />
      <Card>
        <Row label="High Precision GPS" desc="Better accuracy, more battery" icon="locate" color="#FF3B30">
          <Switch value={settings.locationAccuracy === 'High'} onValueChange={v => update({ locationAccuracy: v ? 'High' : 'Balanced' })} trackColor={{ true: T.green, false: T.muted }} thumbColor="#FFF" />
        </Row>
        <Row label="Auto-Pause" desc="Pause when you stop moving" icon="pause-circle-outline" color="#00C6FF" last>
          <Switch value={settings.autoPause} onValueChange={v => update({ autoPause: v })} trackColor={{ true: T.green, false: T.muted }} thumbColor="#FFF" />
        </Row>
      </Card>

      <SectionLabel title="PREMIUM COACHING" />
      <Card>
        {/* Virtual Pacer toggle */}
        <Row label="Virtual Pacer" desc="Race against a target speed" icon="speedometer-outline" color="#BF5FFF">
          {(() => {
            const isLocked = userTier !== 'pro' && userTier !== 'elite';
            const meta = isLocked ? TIER_META.pro : null;
            return (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {isLocked && meta && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: meta.bg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: meta.color + '50' }}>
                    <Ionicons name="lock-closed" size={11} color={meta.color} />
                    <Text style={{ color: meta.color, fontSize: 10, fontWeight: '900' }}>{meta.label}</Text>
                  </View>
                )}
                <Switch
                  value={settings.pacerEnabled && !isLocked}
                  onValueChange={v => {
                    if (isLocked) {
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                      Alert.alert(
                        'Unlock Required',
                        'The Virtual Pacer is exclusive to RunQuest PRO and ELITE members. Upgrade now to race against your target pace!',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'View Plans', onPress: () => goToPremium(navigation) }
                        ]
                      );
                      return;
                    }
                    update({ pacerEnabled: v });
                  }}
                  trackColor={{ true: T.green, false: T.muted }}
                  thumbColor="#FFF"
                />
              </View>
            );
          })()}
        </Row>

        {/* AI Voice Coach toggle */}
        <Row label="AI Voice Coach" desc="Audio progress & territory announcements" icon="mic-outline" color={T.green} last>
          {(() => {
            const isLocked = userTier !== 'pro' && userTier !== 'elite';
            const meta = isLocked ? TIER_META.pro : null;
            return (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {isLocked && meta && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: meta.bg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: meta.color + '50' }}>
                    <Ionicons name="lock-closed" size={11} color={meta.color} />
                    <Text style={{ color: meta.color, fontSize: 10, fontWeight: '900' }}>{meta.label}</Text>
                  </View>
                )}
                <Switch
                  value={settings.voiceCoachEnabled !== false && !isLocked}
                  onValueChange={v => {
                    if (isLocked) {
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                      Alert.alert(
                        'Unlock Required',
                        'The AI Voice Coach is exclusive to RunQuest PRO and ELITE members. Upgrade now to get real-time audio pace alerts!',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'View Plans', onPress: () => goToPremium(navigation) }
                        ]
                      );
                      return;
                    }
                    update({ voiceCoachEnabled: v });
                  }}
                  trackColor={{ true: T.green, false: T.muted }}
                  thumbColor="#FFF"
                />
              </View>
            );
          })()}
        </Row>
      </Card>

      <SectionLabel title="RUN SCREEN" />
      {/* Clean Map Mode — prominent card */}
      <TouchableOpacity
        onPress={() => update({ mapCleanMode: !settings.mapCleanMode })}
        activeOpacity={0.85}
        style={{
          borderRadius: 20, borderWidth: 2,
          borderColor: settings.mapCleanMode ? '#FF6B35' : T.border,
          backgroundColor: settings.mapCleanMode ? '#FF6B3518' : T.card,
          padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 14,
        }}
      >
        <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: settings.mapCleanMode ? '#FF6B3520' : T.muted, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={settings.mapCleanMode ? 'eye-off' : 'eye-outline'} size={22} color={settings.mapCleanMode ? '#FF6B35' : T.text} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: settings.mapCleanMode ? '#FF6B35' : T.white, fontSize: 16, fontWeight: '900' }}>
            {settings.mapCleanMode ? '🗺️ Clean Map ON' : '🗺️ Clean Map Mode'}
          </Text>
          <Text style={{ color: T.text, fontSize: 12, marginTop: 3, lineHeight: 16 }}>
            {settings.mapCleanMode
              ? 'All overlays hidden. Tap to restore buttons & player.'
              : 'Hide all buttons, music player & quotes. Only map + dashboard visible.'}
          </Text>
        </View>
        <View style={[{
          width: 52, height: 30, borderRadius: 15,
          backgroundColor: settings.mapCleanMode ? '#FF6B35' : T.muted,
          alignItems: 'center', justifyContent: 'center',
        }]}>
          <View style={{
            width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFF',
            transform: [{ translateX: settings.mapCleanMode ? 10 : -10 }],
          }} />
        </View>
      </TouchableOpacity>

      <Card>
        <Row label="RunBot Assistant" desc={settings.mapCleanMode ? 'Disabled in Clean Mode' : 'Floating AI button on map'} icon="hardware-chip-outline" color={settings.mapCleanMode ? T.text : T.green}>
          <Switch value={settings.showRunBotFab && !settings.mapCleanMode} disabled={settings.mapCleanMode} onValueChange={v => update({ showRunBotFab: v })} trackColor={{ true: T.green, false: T.muted }} thumbColor="#FFF" />
        </Row>
        <Row label="Map Search" desc={settings.mapCleanMode ? 'Disabled in Clean Mode' : 'Search icon to find locations'} icon="search-outline" color={settings.mapCleanMode ? T.text : '#0A84FF'}>
          <Switch value={settings.showMapSearch !== false && !settings.mapCleanMode} disabled={settings.mapCleanMode} onValueChange={v => update({ showMapSearch: v })} trackColor={{ true: T.green, false: T.muted }} thumbColor="#FFF" />
        </Row>
        <Row label="Territory Button" desc={settings.mapCleanMode ? 'Disabled in Clean Mode' : 'Show territory toggle on map'} icon="flag-outline" color={settings.mapCleanMode ? T.text : '#AF52DE'}>
          <Switch value={settings.showTerritoryBtn !== false && !settings.mapCleanMode} disabled={settings.mapCleanMode} onValueChange={v => update({ showTerritoryBtn: v })} trackColor={{ true: T.green, false: T.muted }} thumbColor="#FFF" />
        </Row>
        <Row label="Nearby Warriors" desc="Show owner names & pics on territories within 10km" icon="people-outline" color="#00C6FF">
          <Switch value={(settings as any).showNearbyTerritories !== false} onValueChange={v => update({ showNearbyTerritories: v } as any)} trackColor={{ true: T.green, false: T.muted }} thumbColor="#FFF" />
        </Row>
        <Row label="Music Player" desc={settings.mapCleanMode ? 'Disabled in Clean Mode' : 'Mini player in dashboard'} icon="musical-notes-outline" color={settings.mapCleanMode ? T.text : '#FF2D55'} last>
          <Switch
            value={settings.showMusicPlayer !== false && !settings.mapCleanMode}
            disabled={settings.mapCleanMode}
            onValueChange={v => {
              if (!v) {
                const { getMusicState } = require('../hooks/useMusicStore');
                const ms = getMusicState();
                if (ms.isPlaying) {
                  onShowMusicWarning();
                  return;
                }
              }
              update({ showMusicPlayer: v });
            }}
            trackColor={{ true: T.green, false: T.muted }}
            thumbColor="#FFF"
          />
        </Row>
      </Card>
    </ScrollView>
  );
}

type NavbarStyle = 'pill' | 'minimal' | 'glass' | 'curved';

function getRequiredTierForAvatar(index: number): 'basic' | 'pro' | 'elite' | null {
  if (index < 4) return null;
  if (index < 8) return 'basic';
  if (index < 12) return 'pro';
  return 'elite';
}

function getRequiredTierForPathStyle(styleId: string): 'basic' | 'pro' | 'elite' | null {
  if (styleId === 'solid' || styleId === 'dashed') return null;
  return 'pro';
}

function getRequiredTierForPathColor(colorId: string): 'basic' | 'pro' | 'elite' | null {
  if (colorId === 'green') return null;
  if (colorId === 'blue') return 'basic';
  if (colorId === 'orange' || colorId === 'purple') return 'pro';
  return 'elite';
}

function getRequiredTierForNavbarStyle(styleId: string): 'basic' | 'pro' | 'elite' | null {
  if (styleId === 'pill') return null;
  if (styleId === 'minimal') return 'basic';
  if (styleId === 'glass') return 'pro';
  return 'elite';
}

function isTierLocked(required: 'basic' | 'pro' | 'elite' | null, userTier: string): boolean {
  if (!required) return false;
  if (userTier === 'elite') return false;
  if (userTier === 'pro') return required === 'elite';
  if (userTier === 'basic') return required === 'pro' || required === 'elite';
  return true;
}

const TIER_META = {
  basic: { label: 'BASIC', color: '#00C6FF', bg: 'rgba(0,198,255,0.15)' },
  pro: { label: 'PRO', color: '#BF5FFF', bg: 'rgba(191,95,255,0.15)' },
  elite: { label: 'ELITE', color: '#FFD60A', bg: 'rgba(255,214,10,0.15)' },
};

// ─── Profile Tab — avatar picker + path style ─────────────────────────────────

// 16 warrior SVG previews (same as map, but rendered as React Native SVG-in-Image via data URI)
const WARRIOR_NAMES = [
  'Ninja','Knight','Mage','Scout','Berserker','Cyber','Pirate','Ghost',
  'Samurai','Viking','Astronaut','Witch','Archer','Alchemist','Paladin','Rogue',
];
const WARRIOR_COLORS = [
  '#00FF87','#A0A0B0','#BF5FFF','#32D74B','#FF453A','#00C6FF','#FFD60A','#8888CC',
  '#FF6B35','#FFD60A','#00C6FF','#CC44FF','#32D74B','#FF9F0A','#FFD60A','#888899',
];

// Same SVGs as the map — 48x64 standing person characters (Premium Neon silhouettes)
const WARRIOR_SVGS = [
  `<svg width="48" height="64" viewBox="0 0 48 64" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="ninjaGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#1A1A2E"/>
        <stop offset="100%" stop-color="#0A0A15"/>
      </linearGradient>
    </defs>
    <rect x="14" y="16" width="20" height="28" rx="6" fill="url(#ninjaGrad)" stroke="#00FF87" stroke-width="1.5"/>
    <circle cx="24" cy="24" r="8" fill="#111"/>
    <rect x="17" y="21" width="14" height="4" rx="2" fill="#00FF87"/>
    <circle cx="21" cy="23" r="1" fill="#FFF"/>
    <circle cx="27" cy="23" r="1" fill="#FFF"/>
    <path d="M14 28 L34 28 L30 36 L18 36 Z" fill="#00FF87" opacity="0.8"/>
    <path d="M10 32 C12 28, 14 28, 14 32 L11 46 C11 46, 9 46, 8 42 Z" fill="#1A1A2E"/>
    <path d="M38 32 C36 28, 34 28, 34 32 L37 46 C37 46, 39 46, 40 42 Z" fill="#1A1A2E"/>
    <line x1="12" y1="12" x2="18" y2="20" stroke="#00FF87" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="36" y1="12" x2="30" y2="20" stroke="#00FF87" stroke-width="2.5" stroke-linecap="round"/>
    <rect x="16" y="44" width="6" height="16" rx="2" fill="#0A0A15" stroke="#00FF87" stroke-width="1"/>
    <rect x="26" y="44" width="6" height="16" rx="2" fill="#0A0A15" stroke="#00FF87" stroke-width="1"/>
  </svg>`,
  `<svg width="48" height="64" viewBox="0 0 48 64" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="knightGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#E2F5FA"/>
        <stop offset="100%" stop-color="#8A9BB0"/>
      </linearGradient>
    </defs>
    <rect x="14" y="16" width="20" height="28" rx="5" fill="url(#knightGrad)" stroke="#00C6FF" stroke-width="1.5"/>
    <path d="M22 18 L26 18 L26 25 L31 25 L31 28 L17 28 L17 25 L22 25 Z" fill="#1A1A2E"/>
    <line x1="24" y1="18" x2="24" y2="28" stroke="#00C6FF" stroke-width="1.5"/>
    <path d="M24 16 C20 10, 28 6, 32 10 C32 10, 28 14, 24 16 Z" fill="#00C6FF"/>
    <circle cx="12" cy="30" r="4.5" fill="#E2F5FA" stroke="#00C6FF" stroke-width="1"/>
    <circle cx="36" cy="30" r="4.5" fill="#E2F5FA" stroke="#00C6FF" stroke-width="1"/>
    <line x1="24" y1="32" x2="24" y2="42" stroke="#00C6FF" stroke-width="2"/>
    <rect x="16" y="44" width="6" height="16" rx="2" fill="#8A9BB0" stroke="#00C6FF" stroke-width="1"/>
    <rect x="26" y="44" width="6" height="16" rx="2" fill="#8A9BB0" stroke="#00C6FF" stroke-width="1"/>
  </svg>`,
  `<svg width="48" height="64" viewBox="0 0 48 64" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="mageGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#8B3FC0"/>
        <stop offset="100%" stop-color="#3A1A7A"/>
      </linearGradient>
    </defs>
    <path d="M24 12 L14 26 L14 46 L34 46 L34 26 Z" fill="url(#mageGrad)" stroke="#BF5FFF" stroke-width="1.5"/>
    <path d="M24 16 L17 26 L31 26 Z" fill="#0D0D1A"/>
    <circle cx="21" cy="23" r="1.5" fill="#BF5FFF"/>
    <circle cx="27" cy="23" r="1.5" fill="#BF5FFF"/>
    <path d="M14 28 L24 34 L34 28" fill="none" stroke="#FFD60A" stroke-width="1.5"/>
    <line x1="38" y1="12" x2="38" y2="52" stroke="#8B5E3C" stroke-width="2" stroke-linecap="round"/>
    <circle cx="38" cy="8" r="5" fill="#BF5FFF" opacity="0.9"/>
    <circle cx="38" cy="8" r="2.5" fill="#FFF"/>
    <rect x="17" y="46" width="5" height="14" rx="2" fill="#3A1A7A"/>
    <rect x="26" y="46" width="5" height="14" rx="2" fill="#3A1A7A"/>
  </svg>`,
  `<svg width="48" height="64" viewBox="0 0 48 64" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="scoutGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#2D5A27"/>
        <stop offset="100%" stop-color="#142B11"/>
      </linearGradient>
    </defs>
    <path d="M24 14 C15 14, 14 22, 14 26 L14 44 L34 44 L34 26 C34 22, 33 14, 24 14 Z" fill="url(#scoutGrad)" stroke="#32D74B" stroke-width="1.5"/>
    <rect x="17" y="20" width="14" height="6" rx="3" fill="#111" stroke="#32D74B" stroke-width="1"/>
    <circle cx="21" cy="23" r="1.5" fill="#32D74B"/>
    <circle cx="27" cy="23" r="1.5" fill="#32D74B"/>
    <path d="M14 28 L24 24 L34 28" fill="none" stroke="#32D74B" stroke-width="1.5"/>
    <rect x="9" y="16" width="4" height="12" rx="1" fill="#FF9F0A" transform="rotate(-20,9,16)"/>
    <rect x="16" y="44" width="6" height="16" rx="2" fill="#142B11" stroke="#32D74B" stroke-width="1"/>
    <rect x="26" y="44" width="6" height="16" rx="2" fill="#142B11" stroke="#32D74B" stroke-width="1"/>
  </svg>`,
  `<svg width="48" height="64" viewBox="0 0 48 64" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bersGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#FF3B30"/>
        <stop offset="100%" stop-color="#800A0A"/>
      </linearGradient>
    </defs>
    <rect x="14" y="18" width="20" height="26" rx="4" fill="url(#bersGrad)" stroke="#FF453A" stroke-width="1.5"/>
    <path d="M14 20 Q8 12, 10 6 Q14 12, 15 20 Z" fill="#FFE066"/>
    <path d="M34 20 Q40 12, 38 6 Q34 12, 33 20 Z" fill="#FFE066"/>
    <polygon points="18,25 23,25 21,28" fill="#FF453A"/>
    <polygon points="30,25 25,25 27,28" fill="#FF453A"/>
    <line x1="20" y1="32" x2="28" y2="32" stroke="#FF453A" stroke-width="1.5"/>
    <line x1="22" y1="30" x2="22" y2="34" stroke="#FF453A" stroke-width="1"/>
    <line x1="26" y1="30" x2="26" y2="34" stroke="#FF453A" stroke-width="1"/>
    <polygon points="10,28 6,24 12,32" fill="#FF453A"/>
    <polygon points="38,28 42,24 36,32" fill="#FF453A"/>
    <rect x="16" y="44" width="6" height="16" rx="2" fill="#800A0A" stroke="#FF453A" stroke-width="1"/>
    <rect x="26" y="44" width="6" height="16" rx="2" fill="#800A0A" stroke="#FF453A" stroke-width="1"/>
  </svg>`,
  `<svg width="48" height="64" viewBox="0 0 48 64" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="cyberGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#00C6FF"/>
        <stop offset="100%" stop-color="#0A1828"/>
      </linearGradient>
    </defs>
    <rect x="14" y="16" width="20" height="28" rx="6" fill="url(#cyberGrad)" stroke="#00C6FF" stroke-width="1.5"/>
    <rect x="16" y="21" width="16" height="7" rx="2" fill="#00C6FF" opacity="0.8"/>
    <line x1="17" y1="24" x2="31" y2="24" stroke="#FFF" stroke-width="1.5"/>
    <line x1="14" y1="22" x2="10" y2="16" stroke="#00C6FF" stroke-width="2"/>
    <line x1="34" y1="22" x2="38" y2="16" stroke="#00C6FF" stroke-width="2"/>
    <circle cx="24" cy="35" r="3" fill="none" stroke="#00C6FF" stroke-width="1.5"/>
    <rect x="16" y="44" width="6" height="16" rx="2" fill="#0A1828" stroke="#00C6FF" stroke-width="1"/>
    <rect x="26" y="44" width="6" height="16" rx="2" fill="#0A1828" stroke="#00C6FF" stroke-width="1"/>
  </svg>`,
  `<svg width="48" height="64" viewBox="0 0 48 64" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="pirateGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#FFD60A"/>
        <stop offset="100%" stop-color="#3A2D00"/>
      </linearGradient>
    </defs>
    <rect x="14" y="18" width="20" height="26" rx="4" fill="#1C1C1C" stroke="#FFD60A" stroke-width="1.5"/>
    <circle cx="24" cy="24" r="8" fill="#F3D1B4"/>
    <line x1="16" y1="20" x2="32" y2="26" stroke="#000" stroke-width="2.5"/>
    <circle cx="22" cy="23" r="3.5" fill="#000"/>
    <circle cx="27" cy="23" r="1.5" fill="#FFD60A"/>
    <path d="M10 18 Q24 8, 38 18 Z" fill="#000" stroke="#FFD60A" stroke-width="1.5"/>
    <circle cx="24" cy="14" r="2.5" fill="#FFD60A"/>
    <rect x="21" y="34" width="6" height="4" fill="#FFD60A"/>
    <path d="M10 32 Q6 36, 10 40" fill="none" stroke="#C0C0C0" stroke-width="2.5" stroke-linecap="round"/>
    <rect x="16" y="44" width="6" height="16" rx="2" fill="#1C1C1C" stroke="#FFD60A" stroke-width="1"/>
    <line x1="29" y1="44" x2="29" y2="60" stroke="#8B5E3C" stroke-width="3" stroke-linecap="round"/>
  </svg>`,
  `<svg width="48" height="64" viewBox="0 0 48 64" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="ghostGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#E2F5FA"/>
        <stop offset="100%" stop-color="#8A9BB0"/>
      </linearGradient>
    </defs>
    <path d="M24 12 C14 12, 12 20, 12 28 C12 36, 14 44, 14 48 C18 46, 20 50, 24 48 C28 50, 30 46, 34 48 C34 44, 36 36, 36 28 C36 20, 34 12, 24 12 Z" fill="url(#ghostGrad)" opacity="0.85" stroke="#00C6FF" stroke-width="2"/>
    <ellipse cx="20" cy="24" rx="2.5" ry="3.5" fill="#1C2333"/>
    <ellipse cx="28" cy="24" rx="2.5" ry="3.5" fill="#1C2333"/>
    <circle cx="20" cy="24" r="1" fill="#00C6FF"/>
    <circle cx="28" cy="24" r="1" fill="#00C6FF"/>
    <path d="M22 32 Q24 35, 26 32" stroke="#1C2333" stroke-width="1.5" fill="none"/>
    <circle cx="10" cy="46" r="1.5" fill="#00C6FF" opacity="0.7"/>
    <circle cx="38" cy="40" r="1" fill="#00C6FF" opacity="0.7"/>
  </svg>`,
  `<svg width="48" height="64" viewBox="0 0 48 64" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="samGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#FF6B35"/>
        <stop offset="100%" stop-color="#1A1008"/>
      </linearGradient>
    </defs>
    <rect x="14" y="16" width="20" height="28" rx="4" fill="url(#samGrad)" stroke="#FF6B35" stroke-width="1.5"/>
    <path d="M20 16 L24 8 L28 16" fill="none" stroke="#FFD60A" stroke-width="2.5" stroke-linecap="round"/>
    <rect x="16" y="22" width="16" height="8" rx="2" fill="#1A1008" stroke="#FF6B35" stroke-width="1"/>
    <circle cx="20" cy="25" r="1.5" fill="#FFD60A"/>
    <circle cx="28" cy="25" r="1.5" fill="#FFD60A"/>
    <line x1="12" y1="26" x2="12" y2="38" stroke="#FF6B35" stroke-width="3" stroke-linecap="round"/>
    <line x1="36" y1="26" x2="36" y2="38" stroke="#FF6B35" stroke-width="3" stroke-linecap="round"/>
    <rect x="16" y="44" width="6" height="16" rx="2" fill="#1A1008" stroke="#FF6B35" stroke-width="1"/>
    <rect x="26" y="44" width="6" height="16" rx="2" fill="#1A1008" stroke="#FF6B35" stroke-width="1"/>
  </svg>`,
  `<svg width="48" height="64" viewBox="0 0 48 64" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="vikGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#FFD700"/>
        <stop offset="100%" stop-color="#4A3B00"/>
      </linearGradient>
    </defs>
    <rect x="14" y="18" width="20" height="26" rx="4" fill="#333" stroke="#FFD700" stroke-width="1.5"/>
    <path d="M14 18 Q24 10, 34 18 Z" fill="url(#vikGrad)" stroke="#FFF" stroke-width="1"/>
    <line x1="24" y1="12" x2="24" y2="18" stroke="#FFF" stroke-width="1.5"/>
    <path d="M14 16 Q8 10, 10 4 Q13 8, 15 16 Z" fill="#FFF"/>
    <path d="M34 16 Q40 10, 38 4 Q35 8, 33 16 Z" fill="#FFF"/>
    <path d="M16 26 L24 38 L32 26 Z" fill="#FF8C00"/>
    <circle cx="20" cy="23" r="1.5" fill="#FFF"/>
    <circle cx="28" cy="23" r="1.5" fill="#FFF"/>
    <circle cx="38" cy="34" r="7" fill="#FFD700" stroke="#333" stroke-width="1.5"/>
    <circle cx="38" cy="34" r="1.5" fill="#FFF"/>
    <rect x="16" y="44" width="6" height="16" rx="2" fill="#333" stroke="#FFD700" stroke-width="1"/>
    <rect x="26" y="44" width="6" height="16" rx="2" fill="#333" stroke="#FFD700" stroke-width="1"/>
  </svg>`,
  `<svg width="48" height="64" viewBox="0 0 48 64" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="astroGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#FFFFFF"/>
        <stop offset="100%" stop-color="#A0B0D0"/>
      </linearGradient>
      <linearGradient id="visorGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#00C6FF"/>
        <stop offset="100%" stop-color="#FFD60A"/>
      </linearGradient>
    </defs>
    <rect x="12" y="24" width="24" height="20" rx="6" fill="url(#astroGrad)" stroke="#A0B0D0" stroke-width="1.5"/>
    <rect x="10" y="26" width="4" height="14" rx="1" fill="#FF3B30"/>
    <circle cx="24" cy="16" r="10" fill="#FFF" stroke="#A0B0D0" stroke-width="1.5"/>
    <ellipse cx="24" cy="16" rx="8" ry="6" fill="url(#visorGrad)"/>
    <circle cx="21" cy="14" r="1.5" fill="#FFF" opacity="0.8"/>
    <rect x="18" y="28" width="12" height="6" rx="1" fill="#1A1A3E"/>
    <circle cx="21" cy="31" r="1" fill="#32D74B"/>
    <circle cx="24" cy="31" r="1" fill="#FF3B30"/>
    <rect x="16" y="44" width="6" height="16" rx="2" fill="#FFF" stroke="#A0B0D0" stroke-width="1"/>
    <rect x="26" y="44" width="6" height="16" rx="2" fill="#FFF" stroke="#A0B0D0" stroke-width="1"/>
  </svg>`,
  `<svg width="48" height="64" viewBox="0 0 48 64" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="witchGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#6B00B0"/>
        <stop offset="100%" stop-color="#2A0050"/>
      </linearGradient>
    </defs>
    <path d="M24 16 L14 30 L14 46 L34 46 L34 30 Z" fill="url(#witchGrad)" stroke="#BF5FFF" stroke-width="1.5"/>
    <path d="M24 2 Q18 10, 10 16 L38 16 Q30 10, 24 2 Z" fill="#1C1A27" stroke="#BF5FFF" stroke-width="1.5"/>
    <ellipse cx="24" cy="16" rx="15" ry="3" fill="#1C1A27" stroke="#BF5FFF" stroke-width="1.5"/>
    <circle cx="24" cy="22" r="6" fill="#FFDBB5"/>
    <circle cx="22" cy="21" r="1" fill="#1C1A27"/>
    <circle cx="26" cy="21" r="1" fill="#1C1A27"/>
    <path d="M22 25 Q24 27, 26 25" stroke="#1C1A27" stroke-width="1" fill="none"/>
    <rect x="6" y="28" width="6" height="10" rx="2" fill="#BF5FFF" stroke="#FFF" stroke-width="1"/>
    <circle cx="9" cy="26" r="2" fill="#FFF"/>
    <rect x="17" y="46" width="5" height="14" rx="2" fill="#2A0050"/>
    <rect x="26" y="46" width="5" height="14" rx="2" fill="#2A0050"/>
  </svg>`,
  `<svg width="48" height="64" viewBox="0 0 48 64" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="archGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#1A4A1A"/>
        <stop offset="100%" stop-color="#0A2A0A"/>
      </linearGradient>
    </defs>
    <rect x="14" y="18" width="20" height="26" rx="4" fill="url(#archGrad)" stroke="#32D74B" stroke-width="1.5"/>
    <path d="M24 12 C16 12, 15 18, 15 22 C15 28, 33 28, 33 22 C33 18, 32 12, 24 12 Z" fill="#1A4A1A" stroke="#32D74B" stroke-width="1"/>
    <circle cx="24" cy="21" r="6" fill="#E8C49A"/>
    <rect x="18" y="20" width="12" height="4" rx="1.5" fill="#1A4A1A"/>
    <circle cx="21" cy="22" r="1" fill="#32D74B"/>
    <circle cx="27" cy="22" r="1" fill="#32D74B"/>
    <path d="M40 8 Q46 22, 40 36" fill="none" stroke="#FF9F0A" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="40" y1="8" x2="40" y2="36" stroke="#FFF" stroke-width="1" opacity="0.6"/>
    <rect x="16" y="44" width="6" height="16" rx="2" fill="#0A2A0A" stroke="#32D74B" stroke-width="1"/>
    <rect x="26" y="44" width="6" height="16" rx="2" fill="#0A2A0A" stroke="#32D74B" stroke-width="1"/>
  </svg>`,
  `<svg width="48" height="64" viewBox="0 0 48 64" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="alcGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#FF9F0A"/>
        <stop offset="100%" stop-color="#5C3A00"/>
      </linearGradient>
    </defs>
    <rect x="14" y="18" width="20" height="26" rx="4" fill="url(#alcGrad)" stroke="#FF9F0A" stroke-width="1.5"/>
    <path d="M24 12 C16 12, 15 18, 15 22 C15 28, 33 28, 33 22 C33 18, 32 12, 24 12 Z" fill="#5C3A00" stroke="#FF9F0A" stroke-width="1"/>
    <circle cx="24" cy="21" r="6" fill="#111"/>
    <circle cx="21" cy="20" r="2.5" fill="none" stroke="#FF9F0A" stroke-width="1.5"/>
    <circle cx="27" cy="20" r="2.5" fill="none" stroke="#FF9F0A" stroke-width="1.5"/>
    <path d="M23 23 L25 23 L24 26 Z" fill="#FF9F0A"/>
    <polygon points="6,34 12,34 9,28" fill="#32D74B" stroke="#FFF" stroke-width="1"/>
    <circle cx="9" cy="35" r="3.5" fill="#32D74B" opacity="0.9"/>
    <rect x="16" y="44" width="6" height="16" rx="2" fill="#5C3A00" stroke="#FF9F0A" stroke-width="1"/>
    <rect x="26" y="44" width="6" height="16" rx="2" fill="#5C3A00" stroke="#FF9F0A" stroke-width="1"/>
  </svg>`,
  `<svg width="48" height="64" viewBox="0 0 48 64" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="palGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#FFD60A"/>
        <stop offset="100%" stop-color="#8B6500"/>
      </linearGradient>
    </defs>
    <rect x="14" y="18" width="20" height="26" rx="4" fill="url(#palGrad)" stroke="#FFF" stroke-width="2"/>
    <path d="M21 26 L27 26 L24 32 Z" fill="#FFF"/>
    <circle cx="24" cy="13" r="10" fill="none" stroke="#FFD60A" stroke-width="2.5" opacity="0.75"/>
    <path d="M14 18 Q24 10, 34 18 Z" fill="#FFF" stroke="#FFD60A" stroke-width="1.5"/>
    <path d="M22 18 L26 18 L26 25 L18 25 L18 27 L30 27 L30 25 L26 25 Z" fill="#FFD60A"/>
    <rect x="16" y="44" width="6" height="16" rx="2" fill="#8B6500" stroke="#FFD60A" stroke-width="1"/>
    <rect x="26" y="44" width="6" height="16" rx="2" fill="#8B6500" stroke="#FFD60A" stroke-width="1"/>
  </svg>`,
  `<svg width="48" height="64" viewBox="0 0 48 64" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="rogGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#1F1F2E"/>
        <stop offset="100%" stop-color="#0A0A0F"/>
      </linearGradient>
    </defs>
    <rect x="14" y="18" width="20" height="26" rx="4" fill="url(#rogGrad)" stroke="#888899" stroke-width="1.5"/>
    <path d="M24 12 C16 12, 14 18, 14 22 L14 26 C14 26, 17 28, 24 28 C31 28, 34 26, 34 26 L34 22 C34 18, 32 12, 24 12 Z" fill="#1F1F2E" stroke="#888899" stroke-width="1"/>
    <circle cx="20" cy="22" r="1.5" fill="#BF5FFF"/>
    <circle cx="28" cy="22" r="1.5" fill="#BF5FFF"/>
    <line x1="10" y1="28" x2="8" y2="40" stroke="#BF5FFF" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="38" y1="28" x2="40" y2="40" stroke="#BF5FFF" stroke-width="2.5" stroke-linecap="round"/>
    <rect x="16" y="44" width="6" height="16" rx="2" fill="#0A0A0F" stroke="#888899" stroke-width="1"/>
    <rect x="26" y="44" width="6" height="16" rx="2" fill="#0A0A0F" stroke="#888899" stroke-width="1"/>
  </svg>`,
];

/** Renders the actual warrior SVG natively using react-native-svg SvgXml */
function AvatarPreview({ svgString, size = 44 }: { svgString: string; size?: number }) {
  const scaledXml = svgString
    .replace(/width="\\d+"/, `width="\${size}"`)
    .replace(/height="\\d+"/, `height="\${Math.round((size * 64) / 48)}"`);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <SvgXml xml={scaledXml} width={size} height={Math.round((size * 64) / 48)} />
    </View>
  );
}

function ProfileTab({ settings, update }: { settings: Settings; update: (p: Partial<Settings>) => void }) {
  const { T } = useTheme();
  const { status } = usePremium();
  const userTier = status.tier || 'free';
  const navigation = useNavigation<any>();

  const [isRunning, setIsRunning] = React.useState(() => {
    const { getRunStore } = require('../store/useRunStore');
    return getRunStore().isActive;
  });
  React.useEffect(() => {
    const { subscribeRunStore, getRunStore } = require('../store/useRunStore');
    return subscribeRunStore(() => setIsRunning(getRunStore().isActive));
  }, []);

  const PATH_STYLES: { id: string; label: string; desc: string; icon: string }[] = [
    { id: 'solid',  label: 'Solid',  desc: 'Clean continuous line',    icon: 'remove-outline' },
    { id: 'dashed', label: 'Dashed', desc: 'Segmented dash pattern',   icon: 'ellipsis-horizontal-outline' },
    { id: 'glow',   label: 'Glow',   desc: 'Neon glow effect',         icon: 'flash-outline' },
  ];

  const PATH_COLORS: { id: string; label: string; hex: string }[] = [
    { id: 'green',  label: 'Neon Green', hex: '#00FF87' },
    { id: 'blue',   label: 'Cyber Blue', hex: '#00C6FF' },
    { id: 'orange', label: 'Blaze',      hex: '#FF9F0A' },
    { id: 'purple', label: 'Mystic',     hex: '#BF5FFF' },
    { id: 'red',    label: 'Crimson',    hex: '#FF453A' },
    { id: 'white',  label: 'Ghost',      hex: '#FFFFFF' },
  ];

  const currentAvatar = (settings as any).avatarIndex ?? 0;
  const currentPathStyle = (settings as any).pathStyle ?? 'solid';
  const currentPathColor = (settings as any).pathColor ?? 'green';

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.tabContent}>
      {isRunning && (
        <View style={{ backgroundColor: '#FFD60A22', borderWidth: 1.5, borderColor: '#FFD60A', borderRadius: 14, padding: 12, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Ionicons name="warning-outline" size={18} color="#FFD60A" />
          <Text style={{ color: '#FFD60A', fontSize: 13, fontWeight: '700', flex: 1 }}>Stop your run to change avatar &amp; path style</Text>
        </View>
      )}
      <View style={{ opacity: isRunning ? 0.4 : 1, pointerEvents: isRunning ? 'none' : 'auto' } as any}>
      <SectionLabel title="WARRIOR AVATAR" />
      <Text style={{ color: T.text, fontSize: 11, marginBottom: 12, paddingHorizontal: 4 }}>
        Your avatar appears on the map for other players to see
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 4 }}>
        {WARRIOR_NAMES.map((name, i) => {
          const isActive = currentAvatar === i;
          const col = WARRIOR_COLORS[i];
          const reqTier = getRequiredTierForAvatar(i);
          const isLocked = isTierLocked(reqTier, userTier);
          const meta = reqTier ? TIER_META[reqTier] : null;

          return (
            <TouchableOpacity
              key={i}
              onPress={() => {
                if (isLocked && reqTier) {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                  Alert.alert(
                    'Unlock Required',
                    `The ${name} avatar is exclusive to RunQuest ${reqTier.toUpperCase()} members. Upgrade now?`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'View Plans', onPress: () => goToPremium(navigation) }
                    ]
                  );
                  return;
                }
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                update({ avatarIndex: i } as any);
              }}
              activeOpacity={0.75}
              style={{
                width: '22%',
                borderRadius: 16,
                borderWidth: isActive ? 3 : 1.5,
                borderColor: isActive ? col : T.border,
                backgroundColor: isActive ? col + 'CC' : T.card,
                alignItems: 'center',
                paddingVertical: 12,
                gap: 6,
                position: 'relative',
              }}
            >
              {/* Actual SVG warrior — same as shown on map */}
              <View style={{
                width: 44, height: 44, borderRadius: 12,
                overflow: 'hidden',
                backgroundColor: isActive ? 'rgba(0,0,0,0.2)' : col + '15',
              }}>
                <AvatarPreview svgString={WARRIOR_SVGS[i]} size={44} />
              </View>
              <Text style={{
                color: isActive ? '#FFF' : T.white,
                fontSize: 9, fontWeight: '900', textAlign: 'center',
              }}>{name}</Text>
              {isActive && (
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFF' }} />
              )}
              {isLocked && meta && (
                <View style={{ position: 'absolute', top: 5, right: 5, width: 16, height: 16, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: meta.color }}>
                  <Ionicons name="lock-closed" size={9} color={meta.color} />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
 
      <SectionLabel title="RUN PATH STYLE" />
      <View style={{ gap: 8, marginBottom: 4 }}>
        {PATH_STYLES.map(ps => {
          const isActive = currentPathStyle === ps.id;
          const reqTier = getRequiredTierForPathStyle(ps.id);
          const isLocked = isTierLocked(reqTier, userTier);
          const meta = reqTier ? TIER_META[reqTier] : null;

          return (
            <TouchableOpacity
              key={ps.id}
              onPress={() => {
                if (isLocked && reqTier) {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                  Alert.alert(
                    'Unlock Required',
                    `The ${ps.label} path style is exclusive to RunQuest ${reqTier.toUpperCase()} members. Upgrade now?`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'View Plans', onPress: () => goToPremium(navigation) }
                    ]
                  );
                  return;
                }
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                update({ pathStyle: ps.id as any } as any);
              }}
              activeOpacity={0.8}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 12,
                borderRadius: 16, borderWidth: isActive ? 2.5 : 1.5,
                borderColor: isActive ? T.green : T.border,
                backgroundColor: isActive ? T.green + 'CC' : T.card,
                padding: 14,
              }}
            >
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: isActive ? 'rgba(0,0,0,0.2)' : T.green + '25', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={ps.icon as any} size={20} color={isActive ? '#FFF' : T.green} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: isActive ? '#FFF' : T.white, fontSize: 15, fontWeight: '900' }}>{ps.label}</Text>
                <Text style={{ color: isActive ? 'rgba(255,255,255,0.7)' : T.text, fontSize: 12, marginTop: 2 }}>{ps.desc}</Text>
              </View>
              {isActive && !isLocked && <Ionicons name="checkmark-circle" size={22} color="#FFF" />}
              {isLocked && meta && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: meta.bg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: meta.color + '50' }}>
                  <Ionicons name="lock-closed" size={11} color={meta.color} />
                  <Text style={{ color: meta.color, fontSize: 10, fontWeight: '900' }}>{meta.label}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
 
      <SectionLabel title="PATH COLOR" />
      {/* Team color note */}
      <View style={{ backgroundColor: T.card, borderRadius: 12, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: T.border, flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
        <Ionicons name="information-circle-outline" size={15} color={T.accent2} style={{ marginTop: 1 }} />
        <Text style={{ color: T.text, fontSize: 11, flex: 1, lineHeight: 16 }}>
          <Text style={{ color: T.white, fontWeight: '800' }}>Team color takes priority</Text> for territory fills. Path color only affects your run trail line.
        </Text>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 4 }}>
        {PATH_COLORS.map(pc => {
          const isActive = currentPathColor === pc.id;
          const reqTier = getRequiredTierForPathColor(pc.id);
          const isLocked = isTierLocked(reqTier, userTier);
          const meta = reqTier ? TIER_META[reqTier] : null;

          return (
            <TouchableOpacity
              key={pc.id}
              onPress={() => {
                if (isLocked && reqTier) {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                  Alert.alert(
                    'Unlock Required',
                    `The ${pc.label} trail color is exclusive to RunQuest ${reqTier.toUpperCase()} members. Upgrade now?`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'View Plans', onPress: () => goToPremium(navigation) }
                    ]
                  );
                  return;
                }
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                update({ pathColor: pc.id as any } as any);
              }}
              activeOpacity={0.8}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 10,
                borderRadius: 14, borderWidth: isActive ? 2.5 : 1.5,
                borderColor: isActive ? pc.hex : T.border,
                backgroundColor: isActive ? pc.hex + 'CC' : T.card,
                paddingHorizontal: 14, paddingVertical: 12,
                width: '47%',
                position: 'relative',
              }}
            >
              <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: pc.hex, borderWidth: 2, borderColor: isActive ? '#FFF' : 'transparent' }} />
              <Text style={{ color: isActive ? (pc.id === 'white' ? '#000' : '#FFF') : T.white, fontSize: 13, fontWeight: '900' }}>{pc.label}</Text>
              {isActive && !isLocked && <Ionicons name="checkmark-circle" size={16} color={pc.id === 'white' ? '#000' : '#FFF'} style={{ marginLeft: 'auto' }} />}
              {isLocked && meta && (
                <View style={{ position: 'absolute', top: 5, right: 5, width: 14, height: 14, borderRadius: 7, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="lock-closed" size={9} color={meta.color} />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
      </View>
    </ScrollView>
  );
}

function GeneralTab({ settings, update }: { settings: Settings; update: (p: Partial<Settings>) => void }) {
  const { T } = useTheme();

  const NAVBAR_STYLES: { id: NavbarStyle; label: string; desc: string; icon: string; color: string }[] = [
    { id: 'pill',    label: 'Floating Pill',   desc: 'Classic floating rounded bar',     icon: 'ellipse-outline',        color: T.green },
    { id: 'minimal', label: 'Neon Dot',        desc: 'Glowing dot under active tab',     icon: 'radio-button-on-outline', color: T.accent2 },
    { id: 'glass',   label: 'Side Accent',     desc: 'Left accent line, full-width bar', icon: 'reorder-four-outline',   color: '#BF5FFF' },
    { id: 'curved',  label: 'Bubble Slide',    desc: 'Morphing bubble + slide indicator',icon: 'albums-outline',         color: T.gold },
  ];

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.tabContent}>
      <SectionLabel title="NOTIFICATIONS" />
      <Card>
        <Row label="Milestone Vibration" desc="Vibrate on each KM" icon="notifications-outline" color={T.gold} last>
          <Switch value={settings.vibrateOnAction} onValueChange={v => update({ vibrateOnAction: v })} trackColor={{ true: T.green, false: T.muted }} thumbColor="#FFF" />
        </Row>
      </Card>

      <SectionLabel title="NAVIGATION BAR STYLE" />
      <View style={{ gap: 8, marginBottom: 4 }}>
        {(() => {
          const { status } = usePremium();
          const userTier = status.tier || 'free';
          const navigation = useNavigation<any>();

          return NAVBAR_STYLES.map(ns => {
            const isActive = ((settings as any).navbarStyle || 'pill') === ns.id;
            const reqTier = getRequiredTierForNavbarStyle(ns.id);
            const isLocked = isTierLocked(reqTier, userTier);
            const meta = reqTier ? TIER_META[reqTier] : null;

            return (
              <TouchableOpacity
                key={ns.id}
                onPress={() => {
                  if (isLocked && reqTier) {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                    Alert.alert(
                      'Unlock Required',
                      `The ${ns.label} navigation bar style is exclusive to RunQuest ${reqTier.toUpperCase()} members. Upgrade now?`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'View Plans', onPress: () => goToPremium(navigation) }
                      ]
                    );
                    return;
                  }
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  update({ navbarStyle: ns.id } as any);
                }}
                activeOpacity={0.8}
                style={[styles.navbarOption, {
                  backgroundColor: isActive ? ns.color + '15' : T.card,
                  borderColor: isActive ? ns.color : T.border,
                  borderWidth: isActive ? 2 : 1,
                }]}
              >
                <View style={[styles.navbarOptionIcon, { backgroundColor: ns.color + '20' }]}>
                  <Ionicons name={ns.icon as any} size={20} color={ns.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: isActive ? ns.color : T.white, fontSize: 15, fontWeight: '800' }}>
                    {ns.label}
                    {ns.id === 'pill' ? <Text style={{ fontSize: 10, fontWeight: '600', color: T.text }}> (Default)</Text> : null}
                  </Text>
                  <Text style={{ color: T.text, fontSize: 12, marginTop: 2 }}>{ns.desc}</Text>
                </View>
                {isActive && !isLocked && (
                  <View style={[styles.navbarCheckmark, { backgroundColor: ns.color }]}>
                    <Ionicons name="checkmark" size={12} color="#FFF" />
                  </View>
                )}
                {isLocked && meta && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: meta.bg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: meta.color + '50' }}>
                    <Ionicons name="lock-closed" size={11} color={meta.color} />
                    <Text style={{ color: meta.color, fontSize: 10, fontWeight: '900' }}>{meta.label}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          });
        })()}
      </View>

      {/* Dev Premium Override Section */}
      {(() => {
        const { status } = usePremium();
        return process.env.EXPO_PUBLIC_DEV_UNLOCK_PREMIUM === 'true' ? (
          <>
            <SectionLabel title="DEVELOPER OVERRIDES" />
            <Card>
              <View style={{ padding: 14, gap: 8 }}>
                <Text style={{ color: T.text, fontSize: 10, fontWeight: '800', letterSpacing: 1 }}>SIMULATED SUBSCRIPTION TIER</Text>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {(['free', 'basic', 'pro', 'elite'] as const).map(tier => {
                    const isActive = (status.tier || 'free') === tier;
                    const tierColor = tier === 'free' ? T.text : tier === 'basic' ? '#00C6FF' : tier === 'pro' ? '#BF5FFF' : '#FFD60A';
                    return (
                      <TouchableOpacity
                        key={tier}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                          setDeveloperOverrideTier(tier);
                        }}
                        style={{
                          flex: 1, borderRadius: 12, borderWidth: 1.5, paddingVertical: 10,
                          alignItems: 'center',
                          backgroundColor: isActive ? tierColor + '20' : T.card,
                          borderColor: isActive ? tierColor : T.border,
                        }}
                      >
                        <Text style={{ fontSize: 10, fontWeight: '900', color: isActive ? tierColor : T.text }}>
                          {tier.toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </Card>
          </>
        ) : null;
      })()}

      <SectionLabel title="APP INFO" />
      <Card>
        <View style={[styles.row, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.border }]}>
          <View style={[styles.rowIcon, { backgroundColor: T.green + '18' }]}>
            <Ionicons name="information-circle-outline" size={19} color={T.green} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowLabel, { color: T.white }]}>Version</Text>
          </View>
          <Text style={{ color: T.text, fontSize: 14, fontWeight: '700' }}>1.0.4</Text>
        </View>
        <View style={[styles.row, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.border }]}>
          <View style={[styles.rowIcon, { backgroundColor: T.accent2 + '18' }]}>
            <Ionicons name="globe-outline" size={19} color={T.accent2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowLabel, { color: T.white }]}>Territory Conquest</Text>
            <Text style={[styles.rowDesc, { color: T.text }]}>Run. Claim. Conquer.</Text>
          </View>
        </View>
        <View style={styles.row}>
          <View style={[styles.rowIcon, { backgroundColor: T.card }]}>
            <Ionicons name="code-slash-outline" size={19} color={T.text} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowLabel, { color: T.white }]}>Developer</Text>
            <Text style={{ color: T.text, fontSize: 13, marginTop: 2 }}>Saad Ikram</Text>
          </View>
        </View>
      </Card>
    </ScrollView>
  );
}

function AccountTab({ onLogout, onClearHistory }: { onLogout: () => void; onClearHistory: () => void }) {
  const { T } = useTheme();
  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.tabContent}>
      <SectionLabel title="DATA" />
      <Card>
        <TouchableOpacity
          style={[styles.row, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.border }]}
          onPress={onClearHistory}
        >
          <View style={[styles.rowIcon, { backgroundColor: T.red + '18' }]}>
            <Ionicons name="trash-outline" size={19} color={T.red} />
          </View>
          <Text style={[styles.rowLabel, { color: T.red }]}>Clear Run History</Text>
          <Ionicons name="chevron-forward" size={16} color={T.text} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.row} onPress={onLogout}>
          <View style={[styles.rowIcon, { backgroundColor: T.red + '18' }]}>
            <Ionicons name="log-out-outline" size={19} color={T.red} />
          </View>
          <Text style={[styles.rowLabel, { color: T.red }]}>Sign Out</Text>
          <Ionicons name="chevron-forward" size={16} color={T.text} />
        </TouchableOpacity>
      </Card>
    </ScrollView>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const { T, themeName } = useTheme();
  const isLight = themeName === 'light';
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('map');
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [showMusicWarning, setShowMusicWarning] = useState(false);
  const [showClearHistoryDialog, setShowClearHistoryDialog] = useState(false);
  const tabAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    getSettings().then(s => setSettings(s));
    Animated.timing(tabAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }, [tabAnim]);

  // Reload settings when screen comes back into focus (e.g. clean mode toggled from RunScreen)
  useEffect(() => {
    if (isFocused) {
      getSettings().then(s => setSettings(s));
    }
  }, [isFocused]);

  const { isPremium } = usePremium();
  const navigation = useNavigation<any>();

  const update = async (patch: Partial<Settings>) => {
    // Premium validation gate
    const isSelectingPremium =
      (patch.avatarIndex !== undefined && patch.avatarIndex >= 4) ||
      (patch.pathStyle === 'glow') ||
      (patch.pathColor !== undefined && patch.pathColor !== 'green') ||
      (patch.navbarStyle !== undefined && patch.navbarStyle !== 'pill');

    if (isSelectingPremium && !isPremium) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert(
        '✦ Premium Feature ✦',
        'Upgrade to RunQuest Premium to unlock this avatar, path style, neon color, or navigation bar style!',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Unlock Premium',
            onPress: () => {
              goToPremium(navigation);
            },
          },
        ]
      );
      return;
    }

    Haptics.selectionAsync();
    const next = await updateSettings(patch as any);
    setSettings(next);
    // Sync avatarIndex to Firestore user doc so other users see the correct warrior
    if ('avatarIndex' in patch) {
      try {
        const { auth, db } = require('../services/firebase');
        const { doc, setDoc } = require('firebase/firestore');
        const uid = auth.currentUser?.uid;
        if (uid) {
          setDoc(doc(db, 'users', uid), { avatarIndex: patch.avatarIndex }, { merge: true }).catch(() => {});
        }
      } catch {}
    }
  };

  const switchTab = (tab: Tab) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(tab);
  };

  if (!settings) return null;

  return (
    <View style={{ flex: 1, backgroundColor: T.black }}>
      <OrbBackground />
      <LinearGradient colors={[T.accent2 + (isLight ? '08' : '12'), 'transparent']} style={StyleSheet.absoluteFill} />

      <ConfirmDialog
        visible={showLogoutDialog}
        title="Sign Out"
        message="Are you sure you want to sign out of RunQuest?"
        confirmText="Sign Out"
        cancelText="Stay"
        destructive
        icon="log-out-outline"
        onCancel={() => setShowLogoutDialog(false)}
        onConfirm={async () => {
          setShowLogoutDialog(false);
          try {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            await logoutUser();
          } catch (e: any) {
            console.error('Logout error:', getFriendlyErrorMessage(e));
            // Force logout even if signOut throws
            try { await logoutUser(); } catch {}
          }
        }}
      />

      <ConfirmDialog
        visible={showClearHistoryDialog}
        title="Clear Run History"
        message="Delete all your previous runs permanently? This cannot be undone."
        confirmText="Delete All"
        cancelText="Cancel"
        destructive
        icon="trash-outline"
        onCancel={() => setShowClearHistoryDialog(false)}
        onConfirm={async () => {
          setShowClearHistoryDialog(false);
          await clearHistory();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }}
      />

      {/* Music Warning Dialog */}
      <MusicWarningDialog
        visible={showMusicWarning}
        onCancel={() => setShowMusicWarning(false)}
        onStopAndTurnOff={() => {
          setShowMusicWarning(false);
          try {
            const { getMusicState } = require('../hooks/useMusicStore');
            const ms = getMusicState();
            // Call onToggle to pause if playing, then turn off the player
            if (ms.isPlaying && ms.onToggle) {
              ms.onToggle();
            }
          } catch {}
          update({ showMusicPlayer: false });
        }}
      />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={[styles.title, { color: isLight ? '#000' : T.white }]}>Settings</Text>
      </View>

      {/* Tab bar — 5 tabs in a row */}
      <View style={[{
        flexDirection: 'row',
        marginHorizontal: 16,
        marginBottom: 8,
        borderRadius: 20,
        borderWidth: 1,
        padding: 4,
        backgroundColor: isLight ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.06)',
        borderColor: T.border,
      }]}>
        {TABS.map(tab => {
          const active = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              onPress={() => switchTab(tab.id)}
              style={[{ flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 16, gap: 2, position: 'relative' }, active && { backgroundColor: T.green + '20' }]}
              activeOpacity={0.7}
            >
              <Ionicons name={tab.icon as any} size={16} color={active ? T.green : T.text} />
              <Text style={{ fontSize: 9, fontWeight: '800', letterSpacing: 0.2, color: active ? T.green : T.text }}>{tab.label}</Text>
              {active && <View style={{ position: 'absolute', bottom: 3, width: 4, height: 4, borderRadius: 2, backgroundColor: T.green }} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Tab content */}
      <Animated.View style={{ flex: 1, opacity: tabAnim }}>
        {activeTab === 'map'     && <MapTab     settings={settings} update={update} />}
        {activeTab === 'run'     && <RunTab     settings={settings} update={update} onShowMusicWarning={() => setShowMusicWarning(true)} />}
        {activeTab === 'general' && <GeneralTab settings={settings} update={update} />}
        {activeTab === 'profile' && <ProfileTab settings={settings} update={update} />}
        {activeTab === 'account' && <AccountTab onLogout={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowLogoutDialog(true); }} onClearHistory={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowClearHistoryDialog(true); }} />}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 24, paddingBottom: 12 },
  title: { fontSize: 28, fontWeight: '900', letterSpacing: -0.8 },
  tabBar: { flexDirection: 'row', borderRadius: 20, borderWidth: 1, padding: 4 },
  tabBtn: { alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 16, gap: 3, position: 'relative', minWidth: 64 },
  tabLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  tabDot: { position: 'absolute', bottom: 4, width: 4, height: 4, borderRadius: 2 },
  tabContent: { paddingHorizontal: 16, paddingBottom: 120, paddingTop: 8 },
  sectionLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 8, marginTop: 16, paddingHorizontal: 4 },
  card: { borderRadius: 20, borderWidth: 1, overflow: 'hidden', marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 14, gap: 12 },
  rowIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontSize: 15, fontWeight: '700' },
  rowDesc: { fontSize: 11, marginTop: 1, opacity: 0.6 },
  themeRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  themeCard: { flex: 1, borderRadius: 16, padding: 12, alignItems: 'center', gap: 6, position: 'relative', minHeight: 80, justifyContent: 'center' },
  themeLabel: { fontSize: 11, fontWeight: '800' },
  activeDot: { position: 'absolute', top: 8, right: 8, width: 6, height: 6, borderRadius: 3 },
  unitRow: { gap: 10, marginBottom: 4 },
  unitBtn: { borderRadius: 16, borderWidth: 1, paddingVertical: 14, alignItems: 'center' },
  unitText: { fontSize: 14, fontWeight: '800' },
  navbarOption: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, padding: 14 },
  navbarOptionIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  navbarCheckmark: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
