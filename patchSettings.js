const fs = require('fs');

const code = `import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, TextInput, Alert, Animated, ScrollView } from 'react-native';
import { getSettings, updateSettings, Settings, resetSettings } from '../config/settings';
import { getServerUrl, setServerUrl } from '../config/serverUrl';
import { clearHistory } from '../services/history';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/utils/ThemeContext';
import * as Haptics from 'expo-haptics';

function Section({ title, children }: { title?: string; children: React.ReactNode }) {
  const { T } = useTheme();
  return (
    <View style={{ marginBottom: 24, paddingHorizontal: 16 }}>
      {title && <Text style={{ color: T.text, fontSize: 13, fontWeight: '600', textTransform: 'uppercase', marginBottom: 8, marginLeft: 8 }}>{title}</Text>}
      <View style={{ backgroundColor: T.card, borderRadius: 12, overflow: 'hidden' }}>
        {children}
      </View>
    </View>
  );
}

function RowItem({ label, desc, icon, iconBg, children, last }: { label: string; desc?: string; icon: string; iconBg: string; children?: React.ReactNode; last?: boolean }) {
  const { T } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingRight: 16, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, borderBottomColor: T.border, marginLeft: 16 }}>
      <View style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: iconBg, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
        <Ionicons name={icon as any} size={16} color="#FFF" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: T.white, fontSize: 16 }}>{label}</Text>
        {desc && <Text style={{ color: T.text, fontSize: 12, marginTop: 2 }}>{desc}</Text>}
      </View>
      {children}
    </View>
  );
}

function ThemeOption({ label, themeKey, active, onPress }: { label: string; themeKey: string; active: boolean; onPress: () => void }) {
  const { T } = useTheme();
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.border }}>
      <Text style={{ flex: 1, color: T.white, fontSize: 16 }}>{label}</Text>
      {active && <Ionicons name="checkmark" size={20} color={T.accent2} />}
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const { T, setTheme, themeName } = useTheme();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [serverUrl, setUrl] = useState('');
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    (async () => {
      setSettings(await getSettings());
      setUrl(await getServerUrl());
    })();
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [fadeAnim]);

  const toggle = async (key: keyof Settings) => {
    if (!settings) return;
    Haptics.selectionAsync();
    const next = await updateSettings({ [key]: !settings[key] } as any);
    setSettings(next);
  };

  const update = async (patch: Partial<Settings>) => {
    const next = await updateSettings(patch as any);
    setSettings(next);
  };

  const setUiTheme = async (uiTheme: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTheme(uiTheme);
    await updateSettings({ uiTheme });
    setSettings(await getSettings());
  };

  const saveUrl = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    let clean = serverUrl.trim().replace(/\\/$/, '');
    if (clean && !/^https?:\\/\\//i.test(clean) && !clean.startsWith('ws://')) {
      clean = 'http://' + clean;
    }
    setUrl(clean);
    await setServerUrl(clean);
  };

  if (!settings) return <View style={{ flex: 1, backgroundColor: T.surface }} />;

  return (
    <Animated.ScrollView style={{ flex: 1, backgroundColor: T.surface, opacity: fadeAnim }} contentContainerStyle={{ paddingTop: 60, paddingBottom: 40 }}>
      <Text style={{ fontSize: 32, fontWeight: '800', color: T.white, paddingHorizontal: 20, marginBottom: 20 }}>Settings</Text>

      <Section title="Appearance">
        <View style={{ paddingLeft: 16 }}>
          <ThemeOption label="Light" themeKey="light" active={themeName === 'light'} onPress={() => setUiTheme('light')} />
          <ThemeOption label="Midnight" themeKey="midnight" active={themeName === 'midnight'} onPress={() => setUiTheme('midnight')} />
          <ThemeOption label="Aurora" themeKey="aurora" active={themeName === 'aurora'} onPress={() => setUiTheme('aurora')} />
          <ThemeOption label="Sunset" themeKey="sunset" active={themeName === 'sunset'} onPress={() => setUiTheme('sunset')} />
        </View>
      </Section>

      <Section title="Format">
        <RowItem label="Distance Unit" desc={settings.distanceUnit === 'metric' ? 'Kilometers / Meters' : 'Miles / Feet'} icon="ruler" iconBg="#34C759">
          <Switch value={settings.distanceUnit === 'metric'} onValueChange={async (val) => { Haptics.selectionAsync(); await update({ distanceUnit: val ? 'metric' : 'imperial' }); }} trackColor={{ true: T.green }} />
        </RowItem>
        <RowItem label="Coordinate Format" desc={settings.coordinateFormat.toUpperCase()} icon="compass" iconBg="#007AFF" last>
          <Switch value={settings.coordinateFormat === 'dd'} onValueChange={async (val) => { Haptics.selectionAsync(); await update({ coordinateFormat: val ? 'dd' : 'dms' }); }} trackColor={{ true: T.green }} />
        </RowItem>
      </Section>

      <Section title="App Behavior">
        <RowItem label="Haptics & Vibration" desc="Tap feedback across the app" icon="phone-portrait" iconBg="#FF9500">
          <Switch value={settings.vibrateOnAction} onValueChange={() => toggle('vibrateOnAction')} trackColor={{ true: T.green }} />
        </RowItem>
        <RowItem label="Auto-Pan Map" desc="Follow location while running" icon="navigate" iconBg="#AF52DE" last>
          <Switch value={settings.mapAutoPan} onValueChange={() => toggle('mapAutoPan')} trackColor={{ true: T.green }} />
        </RowItem>
      </Section>

      <Section title="Developer / Network">
        <View style={{ padding: 16 }}>
          <Text style={{ color: T.white, fontSize: 16, marginBottom: 8 }}>Game Server URL</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput style={{ flex: 1, backgroundColor: T.muted, color: T.white, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 }} value={serverUrl} onChangeText={setUrl} placeholder="ws://localhost:3000" placeholderTextColor={T.text} autoCapitalize="none" autoCorrect={false} />
            <TouchableOpacity style={{ backgroundColor: T.accent2, borderRadius: 8, justifyContent: 'center', paddingHorizontal: 16 }} onPress={saveUrl} activeOpacity={0.7}>
              <Text style={{ color: '#FFF', fontWeight: '700' }}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Section>

      <Section>
        <TouchableOpacity style={{ padding: 16, alignItems: 'center' }} activeOpacity={0.6} onPress={() => {
          Alert.alert('Clear History', 'All runs will be vanished forever.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Clear', style: 'destructive', onPress: () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); clearHistory(); } }
          ]);
        }}>
          <Text style={{ color: T.red, fontSize: 16, fontWeight: '600' }}>Erase Run History</Text>
        </TouchableOpacity>
      </Section>
    </Animated.ScrollView>
  );
}
\`;

fs.writeFileSync('c:/Users/PC/Documents/trae_projects/world_map/src/screens/SettingsScreen.tsx', code);
console.log("SettingsScreen updated.");
