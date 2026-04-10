import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';

export type Settings = {
  units: 'metric' | 'imperial';
  tileStyle: 'default' | 'dark';
  defaultShowPolygons: boolean;
  defaultShowPath: boolean;
  autoPause: boolean;
  defaultZoom: 14 | 15 | 16;
  locationAccuracy: 'High' | 'Balanced';
  timeIntervalMs: number;
  distanceIntervalMeters: number;
  vibrateOnAction: boolean;
  uiTheme: 'light' | 'midnight' | 'aurora' | 'sunset';
  showRunBotFab: boolean;
};

const KEY = 'runquest:settings';

const DEFAULTS: Settings = {
  units: 'metric',
  tileStyle: Appearance.getColorScheme() === 'dark' ? 'dark' : 'default',
  defaultShowPolygons: true,
  defaultShowPath: true,
  autoPause: false,
  defaultZoom: 15,
  locationAccuracy: 'High',
  timeIntervalMs: 2000,
  distanceIntervalMeters: 5,
  vibrateOnAction: true,
  uiTheme: 'light',
  showRunBotFab: true,
};

export async function getSettings(): Promise<Settings> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) {
      return DEFAULTS;
    }
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return DEFAULTS;
  }
}

export async function setSettings(next: Settings): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  const next = { ...current, ...patch };
  await setSettings(next);
  return next;
}

export async function resetSettings(): Promise<Settings> {
  await setSettings(DEFAULTS);
  return DEFAULTS;
}
