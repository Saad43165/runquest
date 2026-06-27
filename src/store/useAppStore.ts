import { create } from 'zustand';
import { Settings } from '../config/settings';

interface AppState {
  // Settings
  settings: Settings;
  setSettings: (s: Settings) => void;
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;

  // FCM token
  fcmToken: string | null;
  setFcmToken: (token: string | null) => void;

  // Offline queue
  offlineQueue: OfflineOperation[];
  addToQueue: (op: OfflineOperation) => void;
  clearQueue: () => void;
  removeFromQueue: (id: string) => void;
}

export interface OfflineOperation {
  id: string;
  type: 'claim_territory' | 'delete_territory' | 'update_profile';
  payload: Record<string, unknown>;
  createdAt: number;
  retries: number;
}

const FALLBACK_SETTINGS: Settings = {
  units: 'metric',
  tileStyle: 'dark',
  defaultShowPolygons: true,
  defaultShowPath: true,
  mapCleanMode: false,
  navbarStyle: 'pill',
  showMapSearch: true,
  showZoomButtons: true,
  showTerritoryBtn: true,
  showMusicPlayer: true,
  showNearbyTerritories: true,
  showLiveUsers: true,
  showGlobalTerritories: true,
  showMyLocation: true,
  avatarIndex: 0,
  pathStyle: 'solid',
  pathColor: 'green',
  autoPause: false,
  defaultZoom: 15,
  locationAccuracy: 'High',
  timeIntervalMs: 2000,
  distanceIntervalMeters: 5,
  vibrateOnAction: true,
  uiTheme: 'midnight',
  showRunBotFab: true,
};

export const useAppStore = create<AppState>((set) => ({
  settings: FALLBACK_SETTINGS,
  setSettings: (s) => set({ settings: s }),
  updateSetting: (key, value) =>
    set((state) => ({ settings: { ...state.settings, [key]: value } })),

  fcmToken: null,
  setFcmToken: (token) => set({ fcmToken: token }),

  offlineQueue: [],
  addToQueue: (op) =>
    set((state) => ({ offlineQueue: [...state.offlineQueue, op] })),
  clearQueue: () => set({ offlineQueue: [] }),
  removeFromQueue: (id) =>
    set((state) => ({ offlineQueue: state.offlineQueue.filter((op) => op.id !== id) })),
}));
