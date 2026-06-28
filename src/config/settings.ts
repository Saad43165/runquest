import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { emitSettingsChange } from './settingsEvents';

export type Settings = {
  units: 'metric' | 'imperial';
  tileStyle: 'default' | 'dark' | 'satellite' | '3d';
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
  showMapSearch: boolean;
  showZoomButtons: boolean;
  showTerritoryBtn: boolean;
  showMusicPlayer: boolean;
  mapCleanMode: boolean;
  navbarStyle: 'pill' | 'minimal' | 'glass' | 'curved';
  showNearbyTerritories: boolean;
  showLiveUsers: boolean;
  showGlobalTerritories: boolean;
  showMyLocation: boolean;       // privacy: whether to share own live location with others
  avatarIndex: number;
  pathStyle: 'solid' | 'dashed' | 'glow';
  pathColor: 'green' | 'blue' | 'orange' | 'purple' | 'red' | 'white';
  pacerEnabled: boolean;
  pacerPaceMinPerKm: number;
  voiceCoachEnabled: boolean;
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
  uiTheme: 'midnight',
  showRunBotFab: true,
  showMapSearch: true,
  showZoomButtons: true,
  showTerritoryBtn: true,
  showMusicPlayer: true,
  mapCleanMode: false,
  navbarStyle: 'pill',
  showNearbyTerritories: true,
  showLiveUsers: true,
  showGlobalTerritories: true,
  showMyLocation: true,
  avatarIndex: 0,
  pathStyle: 'solid',
  pathColor: 'green',
  pacerEnabled: false,
  pacerPaceMinPerKm: 5.5,
  voiceCoachEnabled: true,
};

export async function getSettings(): Promise<Settings> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Settings>;
      return { ...DEFAULTS, ...parsed };
    }
    // Try cloud if local is empty
    const cloud = await loadSettingsFromCloud();
    if (cloud) {
      const merged = { ...DEFAULTS, ...cloud };
      await AsyncStorage.setItem(KEY, JSON.stringify(merged));
      return merged;
    }
    return DEFAULTS;
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
  emitSettingsChange(); // notify all subscribers instantly
  syncSettingsToCloud(next).catch(() => {}); // fire-and-forget
  return next;
}

export async function resetSettings(): Promise<Settings> {
  await setSettings(DEFAULTS);
  return DEFAULTS;
}

export async function syncSettingsToCloud(settings: Settings): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  try {
    await setDoc(doc(db, 'users', uid, 'meta', 'settings'), settings, { merge: true });
  } catch {}
}

export async function loadSettingsFromCloud(): Promise<Partial<Settings> | null> {
  const uid = auth.currentUser?.uid;
  if (!uid) return null;
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'meta', 'settings'));
    return snap.exists() ? (snap.data() as Partial<Settings>) : null;
  } catch {
    return null;
  }
}
