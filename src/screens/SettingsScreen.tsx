import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Switch,
  Animated, ScrollView, Dimensions,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { getSettings, updateSettings, Settings } from '../config/settings';
import { clearHistory } from '../services/history';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, ThemeName } from '@/utils/ThemeContext';
import * as Haptics from 'expo-haptics';
import { logoutUser } from '../services/authService';
import { getFriendlyErrorMessage } from '../utils/ErrorUtils';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import { OrbBackground } from '../components/OrbBackground';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { MusicWarningDialog } from '../components/MusicWarningDialog';

const { width } = Dimensions.get('window');

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

// Same SVGs as the map — 48x64 standing person characters
const WARRIOR_SVGS = [
  '<svg width="48" height="64" viewBox="0 0 48 64" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="12" r="9" fill="#C8956C"/><rect x="16" y="8" width="16" height="9" rx="2" fill="#1A1A2E"/><rect x="16" y="13" width="16" height="4" fill="#00FF87" rx="1"/><circle cx="20" cy="12" r="2" fill="#00FF87"/><circle cx="28" cy="12" r="2" fill="#00FF87"/><rect x="15" y="21" width="18" height="22" rx="4" fill="#1A1A2E"/><rect x="15" y="21" width="18" height="5" fill="#00FF87" rx="2"/><rect x="7" y="22" width="8" height="17" rx="4" fill="#1A1A2E"/><rect x="33" y="22" width="8" height="17" rx="4" fill="#1A1A2E"/><rect x="16" y="43" width="7" height="18" rx="3" fill="#1A1A2E"/><rect x="25" y="43" width="7" height="18" rx="3" fill="#1A1A2E"/></svg>',
  '<svg width="48" height="64" viewBox="0 0 48 64" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="12" r="9" fill="#E8C49A"/><rect x="14" y="7" width="20" height="11" rx="4" fill="#8A9BB0"/><rect x="16" y="9" width="16" height="6" rx="2" fill="#C0C0C0"/><circle cx="20" cy="12" r="1.5" fill="#1C2333"/><circle cx="28" cy="12" r="1.5" fill="#1C2333"/><rect x="14" y="21" width="20" height="23" rx="3" fill="#8A9BB0"/><rect x="14" y="21" width="20" height="5" fill="#C0C0C0" rx="2"/><line x1="24" y1="26" x2="24" y2="44" stroke="#C0C0C0" stroke-width="2"/><rect x="6" y="22" width="8" height="18" rx="4" fill="#8A9BB0"/><rect x="34" y="22" width="8" height="18" rx="4" fill="#8A9BB0"/><rect x="16" y="44" width="7" height="18" rx="3" fill="#6B7A8D"/><rect x="25" y="44" width="7" height="18" rx="3" fill="#6B7A8D"/></svg>',
  '<svg width="48" height="64" viewBox="0 0 48 64" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="14" r="8" fill="#D4A574"/><polygon points="24,1 16,15 32,15" fill="#6B2FA0"/><ellipse cx="24" cy="15" rx="11" ry="3" fill="#8B3FC0"/><circle cx="20" cy="14" r="1.5" fill="#BF5FFF"/><circle cx="28" cy="14" r="1.5" fill="#BF5FFF"/><path d="M14 22 Q24 19 34 22 L32 45 L16 45 Z" fill="#6B2FA0"/><rect x="14" y="22" width="20" height="5" fill="#BF5FFF" rx="2"/><rect x="6" y="23" width="8" height="18" rx="4" fill="#6B2FA0"/><rect x="34" y="23" width="8" height="18" rx="4" fill="#6B2FA0"/><rect x="17" y="45" width="6" height="17" rx="3" fill="#4A1A7A"/><rect x="25" y="45" width="6" height="17" rx="3" fill="#4A1A7A"/></svg>',
  '<svg width="48" height="64" viewBox="0 0 48 64" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="12" r="8" fill="#C8956C"/><ellipse cx="24" cy="9" rx="11" ry="5" fill="#2D5A27"/><rect x="13" y="9" width="22" height="5" fill="#1A3A15" rx="2"/><circle cx="20" cy="13" r="1.5" fill="#1A3A15"/><circle cx="28" cy="13" r="1.5" fill="#1A3A15"/><rect x="15" y="20" width="18" height="23" rx="3" fill="#2D5A27"/><rect x="15" y="20" width="18" height="5" fill="#32D74B" rx="2"/><rect x="7" y="21" width="8" height="17" rx="4" fill="#2D5A27"/><rect x="33" y="21" width="8" height="17" rx="4" fill="#2D5A27"/><rect x="16" y="43" width="7" height="19" rx="3" fill="#1A3A15"/><rect x="25" y="43" width="7" height="19" rx="3" fill="#1A3A15"/></svg>',
  '<svg width="48" height="64" viewBox="0 0 48 64" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="12" r="9" fill="#D4845A"/><rect x="14" y="7" width="20" height="11" rx="3" fill="#8B0000"/><circle cx="20" cy="12" r="2" fill="#FF453A"/><circle cx="28" cy="12" r="2" fill="#FF453A"/><path d="M20 16 L24 18 L28 16" stroke="#FF453A" stroke-width="1.5" fill="none"/><rect x="14" y="21" width="20" height="23" rx="3" fill="#8B0000"/><rect x="14" y="21" width="20" height="5" fill="#FF453A" rx="2"/><rect x="6" y="22" width="8" height="18" rx="4" fill="#8B0000"/><rect x="34" y="22" width="8" height="18" rx="4" fill="#8B0000"/><rect x="16" y="44" width="7" height="18" rx="3" fill="#6B0000"/><rect x="25" y="44" width="7" height="18" rx="3" fill="#6B0000"/></svg>',
  '<svg width="48" height="64" viewBox="0 0 48 64" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="12" r="9" fill="#1A2A3E"/><rect x="14" y="7" width="20" height="12" rx="4" fill="#0D1F35"/><rect x="15" y="9" width="18" height="7" rx="3" fill="#00C6FF" opacity="0.5"/><circle cx="20" cy="12" r="2" fill="#00C6FF"/><circle cx="28" cy="12" r="2" fill="#00C6FF"/><rect x="14" y="21" width="20" height="23" rx="3" fill="#0D1F35"/><line x1="14" y1="27" x2="34" y2="27" stroke="#00C6FF" stroke-width="1.5"/><line x1="14" y1="33" x2="34" y2="33" stroke="#00C6FF" stroke-width="1"/><rect x="6" y="22" width="8" height="18" rx="4" fill="#0D1F35"/><rect x="34" y="22" width="8" height="18" rx="4" fill="#0D1F35"/><rect x="16" y="44" width="7" height="18" rx="3" fill="#0A1828"/><rect x="25" y="44" width="7" height="18" rx="3" fill="#0A1828"/></svg>',
  '<svg width="48" height="64" viewBox="0 0 48 64" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="13" r="8" fill="#C8956C"/><path d="M13 9 L24 3 L35 9 L33 16 L15 16 Z" fill="#2A1800"/><rect x="20" y="10" width="8" height="3" rx="1" fill="#FFD60A"/><circle cx="20" cy="13" r="1.5" fill="#2A1800"/><rect x="22" y="11" width="7" height="5" rx="1" fill="#1A1000"/><rect x="14" y="21" width="20" height="23" rx="3" fill="#5C3A1E"/><rect x="14" y="21" width="20" height="5" fill="#8B5E3C" rx="2"/><rect x="6" y="22" width="8" height="18" rx="4" fill="#5C3A1E"/><rect x="34" y="22" width="8" height="18" rx="4" fill="#5C3A1E"/><rect x="16" y="44" width="7" height="18" rx="3" fill="#3A2010"/><rect x="25" y="44" width="7" height="18" rx="3" fill="#3A2010"/></svg>',
  '<svg width="48" height="64" viewBox="0 0 48 64" xmlns="http://www.w3.org/2000/svg"><ellipse cx="24" cy="13" rx="11" ry="12" fill="#D0D8F0" opacity="0.95"/><circle cx="19" cy="12" r="3" fill="#1A1A3E"/><circle cx="29" cy="12" r="3" fill="#1A1A3E"/><circle cx="19" cy="12" r="1.5" fill="#6080FF"/><circle cx="29" cy="12" r="1.5" fill="#6080FF"/><path d="M13 22 Q24 18 35 22 L35 52 Q31 48 24 52 Q17 48 13 52 Z" fill="#D0D8F0" opacity="0.9"/><path d="M13 22 Q24 18 35 22 L35 27 Q24 23 13 27 Z" fill="#A0B0D0" opacity="0.9"/></svg>',
  '<svg width="48" height="64" viewBox="0 0 48 64" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="13" r="8" fill="#C8956C"/><rect x="21" y="3" width="6" height="9" rx="3" fill="#1A0A0A"/><rect x="14" y="9" width="20" height="9" rx="2" fill="#1A0A0A"/><circle cx="20" cy="13" r="1.5" fill="#FF6B35"/><circle cx="28" cy="13" r="1.5" fill="#FF6B35"/><rect x="14" y="21" width="20" height="23" rx="3" fill="#1A0A0A"/><rect x="14" y="21" width="20" height="5" fill="#FF6B35" rx="2"/><line x1="24" y1="26" x2="24" y2="44" stroke="#FF6B35" stroke-width="2"/><rect x="6" y="22" width="8" height="18" rx="4" fill="#1A0A0A"/><rect x="34" y="22" width="8" height="18" rx="4" fill="#1A0A0A"/><rect x="16" y="44" width="7" height="18" rx="3" fill="#0A0505"/><rect x="25" y="44" width="7" height="18" rx="3" fill="#0A0505"/></svg>',
  '<svg width="48" height="64" viewBox="0 0 48 64" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="13" r="8" fill="#D4A574"/><rect x="14" y="7" width="20" height="11" rx="3" fill="#2A2A55"/><path d="M10 11 L14 7" stroke="#FFD60A" stroke-width="3" stroke-linecap="round"/><path d="M38 11 L34 7" stroke="#FFD60A" stroke-width="3" stroke-linecap="round"/><circle cx="20" cy="13" r="1.5" fill="#2A2A55"/><circle cx="28" cy="13" r="1.5" fill="#2A2A55"/><path d="M18 17 Q24 20 30 17" fill="#8B6914" stroke="#8B6914" stroke-width="1"/><rect x="14" y="21" width="20" height="23" rx="3" fill="#2A2A55"/><rect x="14" y="21" width="20" height="5" fill="#FFD60A" rx="2"/><rect x="6" y="22" width="8" height="18" rx="4" fill="#2A2A55"/><rect x="34" y="22" width="8" height="18" rx="4" fill="#2A2A55"/><rect x="16" y="44" width="7" height="18" rx="3" fill="#1A1A3A"/><rect x="25" y="44" width="7" height="18" rx="3" fill="#1A1A3A"/></svg>',
  '<svg width="48" height="64" viewBox="0 0 48 64" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="12" r="11" fill="#E8E8F0"/><circle cx="24" cy="12" r="8" fill="#1A1A3E"/><rect x="17" y="8" width="14" height="9" rx="4" fill="#00C6FF" opacity="0.5"/><circle cx="20" cy="12" r="1.5" fill="#00C6FF"/><circle cx="28" cy="12" r="1.5" fill="#00C6FF"/><rect x="13" y="23" width="22" height="22" rx="5" fill="#E8E8F0"/><rect x="18" y="28" width="12" height="8" rx="2" fill="#C0C8D8"/><rect x="5" y="24" width="8" height="18" rx="4" fill="#E8E8F0"/><rect x="35" y="24" width="8" height="18" rx="4" fill="#E8E8F0"/><rect x="16" y="45" width="7" height="17" rx="3" fill="#C0C8D8"/><rect x="25" y="45" width="7" height="17" rx="3" fill="#C0C8D8"/></svg>',
  '<svg width="48" height="64" viewBox="0 0 48 64" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="15" r="8" fill="#D4A574"/><polygon points="24,1 16,16 32,16" fill="#4A0080"/><ellipse cx="24" cy="16" rx="12" ry="3" fill="#6B00B0"/><circle cx="20" cy="15" r="2" fill="#BF5FFF"/><circle cx="28" cy="15" r="2" fill="#BF5FFF"/><path d="M14 23 Q24 20 34 23 L32 45 L16 45 Z" fill="#4A0080"/><rect x="14" y="23" width="20" height="5" fill="#BF5FFF" rx="2"/><rect x="6" y="24" width="8" height="18" rx="4" fill="#4A0080"/><rect x="34" y="24" width="8" height="18" rx="4" fill="#4A0080"/><rect x="17" y="45" width="6" height="17" rx="3" fill="#2A0050"/><rect x="25" y="45" width="6" height="17" rx="3" fill="#2A0050"/></svg>',
  '<svg width="48" height="64" viewBox="0 0 48 64" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="12" r="8" fill="#C8956C"/><path d="M13 8 Q24 3 35 8 L33 17 L15 17 Z" fill="#1A4A1A"/><circle cx="20" cy="13" r="1.5" fill="#32D74B"/><circle cx="28" cy="13" r="1.5" fill="#32D74B"/><rect x="15" y="20" width="18" height="23" rx="3" fill="#1A4A1A"/><rect x="15" y="20" width="18" height="5" fill="#32D74B" rx="2"/><rect x="7" y="21" width="8" height="17" rx="4" fill="#1A4A1A"/><rect x="33" y="21" width="8" height="17" rx="4" fill="#1A4A1A"/><path d="M40 8 Q46 16 40 24" stroke="#8B5E3C" stroke-width="2.5" fill="none"/><line x1="40" y1="8" x2="40" y2="24" stroke="#8B5E3C" stroke-width="1.5"/><rect x="17" y="43" width="6" height="19" rx="3" fill="#0A2A0A"/><rect x="25" y="43" width="6" height="19" rx="3" fill="#0A2A0A"/></svg>',
  '<svg width="48" height="64" viewBox="0 0 48 64" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="13" r="8" fill="#D4A574"/><rect x="15" y="9" width="18" height="9" rx="2" fill="#5C3A00"/><circle cx="19" cy="12" r="3.5" fill="#FF9F0A" opacity="0.7"/><circle cx="29" cy="12" r="3.5" fill="#FF9F0A" opacity="0.7"/><circle cx="19" cy="12" r="1.5" fill="#1A0A00"/><circle cx="29" cy="12" r="1.5" fill="#1A0A00"/><path d="M14 21 Q24 18 34 21 L32 44 L16 44 Z" fill="#8B4500"/><rect x="14" y="21" width="20" height="5" fill="#FF9F0A" rx="2"/><rect x="6" y="22" width="8" height="18" rx="4" fill="#8B4500"/><rect x="34" y="22" width="8" height="18" rx="4" fill="#8B4500"/><circle cx="40" cy="28" r="5" fill="#32D74B" opacity="0.9"/><rect x="17" y="44" width="6" height="18" rx="3" fill="#5C3A00"/><rect x="25" y="44" width="6" height="18" rx="3" fill="#5C3A00"/></svg>',
  '<svg width="48" height="64" viewBox="0 0 48 64" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="4" r="5" fill="none" stroke="#FFD60A" stroke-width="2.5" opacity="0.9"/><circle cx="24" cy="13" r="8" fill="#E8C49A"/><rect x="14" y="8" width="20" height="10" rx="3" fill="#B8860B"/><circle cx="20" cy="13" r="1.5" fill="#1A1400"/><circle cx="28" cy="13" r="1.5" fill="#1A1400"/><rect x="14" y="21" width="20" height="23" rx="3" fill="#B8860B"/><rect x="14" y="21" width="20" height="5" fill="#FFD60A" rx="2"/><line x1="24" y1="26" x2="24" y2="44" stroke="#FFD60A" stroke-width="2"/><rect x="6" y="22" width="8" height="18" rx="4" fill="#B8860B"/><rect x="34" y="22" width="8" height="18" rx="4" fill="#B8860B"/><rect x="16" y="44" width="7" height="18" rx="3" fill="#8B6500"/><rect x="25" y="44" width="7" height="18" rx="3" fill="#8B6500"/></svg>',
  '<svg width="48" height="64" viewBox="0 0 48 64" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="13" r="8" fill="#B07850"/><path d="M13 9 Q24 4 35 9 L33 18 L15 18 Z" fill="#1A1A1A"/><circle cx="20" cy="13" r="1.5" fill="#888"/><circle cx="28" cy="13" r="1.5" fill="#888"/><path d="M14 21 Q24 18 34 21 L34 44 L14 44 Z" fill="#1A1A1A"/><rect x="14" y="21" width="20" height="5" fill="#444" rx="2"/><rect x="6" y="22" width="8" height="18" rx="4" fill="#1A1A1A"/><rect x="34" y="22" width="8" height="18" rx="4" fill="#1A1A1A"/><line x1="8" y1="26" x2="12" y2="36" stroke="#AAA" stroke-width="2.5" stroke-linecap="round"/><line x1="40" y1="26" x2="36" y2="36" stroke="#AAA" stroke-width="2.5" stroke-linecap="round"/><rect x="17" y="44" width="6" height="18" rx="3" fill="#0A0A0A"/><rect x="25" y="44" width="6" height="18" rx="3" fill="#0A0A0A"/></svg>',
];

/** Renders the actual warrior SVG in a tiny WebView — same as what appears on the map */
function AvatarPreview({ svgString, size = 44 }: { svgString: string; size?: number }) {
  const html = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><style>*{margin:0;padding:0;background:transparent}body{display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;overflow:hidden}</style></head><body>${svgString}</body></html>`;
  return (
    <WebView
      source={{ html }}
      style={{ width: size, height: size, backgroundColor: 'transparent' }}
      scrollEnabled={false}
      pointerEvents="none"
      originWhitelist={['*']}
      javaScriptEnabled={false}
      androidLayerType="hardware"
    />
  );
}

function ProfileTab({ settings, update }: { settings: Settings; update: (p: Partial<Settings>) => void }) {
  const { T } = useTheme();

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
          return (
            <TouchableOpacity
              key={i}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); update({ avatarIndex: i } as any); }}
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
            </TouchableOpacity>
          );
        })}
      </View>

      <SectionLabel title="RUN PATH STYLE" />
      <View style={{ gap: 8, marginBottom: 4 }}>
        {PATH_STYLES.map(ps => {
          const isActive = currentPathStyle === ps.id;
          return (
            <TouchableOpacity
              key={ps.id}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); update({ pathStyle: ps.id as any } as any); }}
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
              {isActive && <Ionicons name="checkmark-circle" size={22} color="#FFF" />}
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
          return (
            <TouchableOpacity
              key={pc.id}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); update({ pathColor: pc.id as any } as any); }}
              activeOpacity={0.8}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 10,
                borderRadius: 14, borderWidth: isActive ? 2.5 : 1.5,
                borderColor: isActive ? pc.hex : T.border,
                backgroundColor: isActive ? pc.hex + 'CC' : T.card,
                paddingHorizontal: 14, paddingVertical: 12,
                width: '47%',
              }}
            >
              <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: pc.hex, borderWidth: 2, borderColor: isActive ? '#FFF' : 'transparent' }} />
              <Text style={{ color: isActive ? (pc.id === 'white' ? '#000' : '#FFF') : T.white, fontSize: 13, fontWeight: '900' }}>{pc.label}</Text>
              {isActive && <Ionicons name="checkmark-circle" size={16} color={pc.id === 'white' ? '#000' : '#FFF'} style={{ marginLeft: 'auto' }} />}
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
        {NAVBAR_STYLES.map(ns => {
          const isActive = ((settings as any).navbarStyle || 'pill') === ns.id;
          return (
            <TouchableOpacity
              key={ns.id}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); update({ navbarStyle: ns.id } as any); }}
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
              {isActive && (
                <View style={[styles.navbarCheckmark, { backgroundColor: ns.color }]}>
                  <Ionicons name="checkmark" size={12} color="#FFF" />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

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

  const update = async (patch: Partial<Settings>) => {
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
        {activeTab === 'account' && <AccountTab onLogout={() => setShowLogoutDialog(true)} onClearHistory={() => setShowClearHistoryDialog(true)} />}
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
