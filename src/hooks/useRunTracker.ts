import { useEffect, useRef, useReducer, useCallback } from 'react';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import { Alert, Platform } from 'react-native';
import { LatLng, RunState } from '../types';
import { isClosedLoop, pathDistance, pathPerimeter, polygonAreaSqMeters } from '../utils/geometry';
import { addRun } from '../services/history';
import { getSettings, Settings } from '../config/settings';
import { NotificationService } from '../services/notificationService';
import { Region } from 'react-native-maps';

// ─── Background location task ─────────────────────────────────────────────────
const BG_TASK = 'runquest-bg-location';

// Shared ref accessible from background task
let bgLocationCallback: ((loc: Location.LocationObject) => void) | null = null;

export function setBgLocationCallback(cb: ((loc: Location.LocationObject) => void) | null) {
  bgLocationCallback = cb;
}

// Register the background task (must be at module level, outside component)
if (!TaskManager.isTaskDefined(BG_TASK)) {
  TaskManager.defineTask(BG_TASK, async ({ data, error }: any) => {
    if (error) { console.warn('BG location error:', error); return; }
    // Forward background location updates to the active tracker
    const locations: Location.LocationObject[] = data?.locations ?? [];
    if (locations.length > 0 && bgLocationCallback) {
      bgLocationCallback(locations[locations.length - 1]);
    }
  });
}

type RunAction =
  | { type: 'START'; settings: Settings }
  | { type: 'PAUSE' }
  | { type: 'RESUME'; settings: Settings }
  | { type: 'STOP' }
  | { type: 'RESET' }
  | { type: 'UPDATE_LOCATION'; point: LatLng; accuracy: number | null; heading: number | null; altitude: number | null }
  | { type: 'UPDATE_REGION'; region: Region }
  | { type: 'SET_CLOSED_LOOP'; closed: boolean }
  | { type: 'SET_SAVING'; isSaving: boolean };

type RunStateInternal = {
  status: RunState;
  path: LatLng[];
  altitudePoints: number[];
  region: Region | null;
  startedAt: number | null;
  pausedAt: number | null;
  totalPausedMs: number;
  accuracyMeters: number | null;
  headingDeg: number | null;
  altitudeMeters: number | null;
  closedLoop: boolean;
  isSaving: boolean;
};

const initialInternalState: RunStateInternal = {
  status: 'idle',
  path: [],
  altitudePoints: [],
  region: null,
  startedAt: null,
  pausedAt: null,
  totalPausedMs: 0,
  accuracyMeters: null,
  headingDeg: null,
  altitudeMeters: null,
  closedLoop: false,
  isSaving: false,
};

function runReducer(state: RunStateInternal, action: RunAction): RunStateInternal {
  switch (action.type) {
    case 'START':
      return {
        ...state,
        status: 'running',
        path: [],
        altitudePoints: [],
        startedAt: Date.now(),
        pausedAt: null,
        totalPausedMs: 0,
        closedLoop: false,
      };

    case 'PAUSE':
      return {
        ...state,
        status: 'paused',
        pausedAt: Date.now(),
      };

    case 'RESUME':
      return {
        ...state,
        status: 'running',
        pausedAt: null,
        totalPausedMs: state.pausedAt ? state.totalPausedMs + (Date.now() - state.pausedAt) : state.totalPausedMs,
      };

    case 'STOP':
      return {
        ...state,
        status: 'finished',
      };

    case 'RESET':
      return { ...initialInternalState, region: state.region };

    case 'UPDATE_LOCATION': {
      // Only record track points while actively running.
      // We still update accuracy/heading/altitude so the UI can display live GPS status.
      if (state.status !== 'running') {
        return {
          ...state,
          accuracyMeters: action.accuracy,
          headingDeg: action.heading,
          altitudeMeters: action.altitude ?? null,
        };
      }
      // Filter out low-accuracy points — GPS drift when sitting still
      // Accuracy > 25m means the GPS hasn't locked properly, skip the point
      if (action.accuracy !== null && action.accuracy > 25) {
        return { ...state, accuracyMeters: action.accuracy, headingDeg: action.heading, altitudeMeters: action.altitude ?? null };
      }
      // Deduplicate: skip point if < 8m from last recorded point
      // 8m threshold filters GPS jitter/drift while stationary (typical drift is 3-15m)
      if (state.path.length > 0) {
        const last = state.path[state.path.length - 1];
        const dLat = (action.point.latitude - last.latitude) * 111000;
        const dLng = (action.point.longitude - last.longitude) * 111000 * Math.cos(last.latitude * Math.PI / 180);
        const dist = Math.sqrt(dLat * dLat + dLng * dLng);
        if (dist < 8) return { ...state, accuracyMeters: action.accuracy, headingDeg: action.heading, altitudeMeters: action.altitude ?? null };
      }
      return {
        ...state,
        path: [...state.path, action.point],
        altitudePoints: [...state.altitudePoints, action.altitude ?? 0],
        accuracyMeters: action.accuracy,
        headingDeg: action.heading,
        altitudeMeters: action.altitude ?? null,
      };
    }

    case 'UPDATE_REGION':
      return { ...state, region: action.region };

    case 'SET_CLOSED_LOOP':
      return { ...state, closedLoop: action.closed };

    case 'SET_SAVING':
      return { ...state, isSaving: action.isSaving };

    default:
      return state;
  }
}

type Tracker = {
  state: RunState;
  path: LatLng[];
  altitudePoints: number[];
  region: Region | null;
  startedAt: number | null;
  totalPausedMs: number;
  pausedAt: number | null;
  accuracyMeters: number | null;
  headingDeg: number | null;
  altitudeMeters: number | null;
  startRun: () => Promise<void>;
  pauseRun: () => Promise<void>;
  resumeRun: () => Promise<void>;
  stopRun: () => Promise<string | null>;
  reset: () => void;
  recenter: () => Promise<void>;
  closedLoop: boolean;
  isSaving: boolean;
};

export function useRunTracker(): Tracker {
  const [internal, dispatch] = useReducer(runReducer, initialInternalState);
  const locationSub = useRef<Location.LocationSubscription | null>(null);
  const settingsRef = useRef<Settings | null>(null);
  const notifIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastLapDistanceRef = useRef<number>(0);
  // Ref to always have the latest path for background notification (avoids stale closure)
  const pathRef = useRef<LatLng[]>([]);
  const startedAtRef = useRef<number | null>(null);
  const statusRef = useRef<RunState>('idle');

  // Keep path/startedAt refs in sync for background notification
  useEffect(() => {
    pathRef.current = internal.path;
    startedAtRef.current = internal.startedAt;
    statusRef.current = internal.status;
  }, [internal.path, internal.startedAt]);

  // Only show a background notification when app is actually in background
  // When app is foreground, the in-app pill handles the live display
  const startNotifUpdater = (startedAt: number) => {
    if (notifIntervalRef.current) clearInterval(notifIntervalRef.current);
    
    const AppState = require('react-native').AppState;
    
    notifIntervalRef.current = setInterval(async () => {
      // Only notify when app is in background
      if (AppState.currentState !== 'background') return;
      try {
        // Ensure our low-importance "live run" channel exists (best-effort).
        NotificationService.requestPermissions().catch(() => {});

        const sAt = startedAtRef.current ?? startedAt;
        const elapsed = Math.floor((Date.now() - sAt) / 1000);
        const mins = Math.floor(elapsed / 60);
        const secs = elapsed % 60;
        // Use ref to get current path — avoids stale closure
        const distKm = (pathDistance(pathRef.current) / 1000).toFixed(2);
        await Notifications.dismissNotificationAsync('runquest-active-run').catch(() => {});
        await Notifications.scheduleNotificationAsync({
          identifier: 'runquest-active-run',
          content: {
            title: `RunQuest — ${mins}:${String(secs).padStart(2,'0')}`,
            body: `${distKm} km tracked • Tap to return`,
            data: {},
            color: '#00C6FF',
            // Android: silent, persistent-ish channel for live tracking updates
            ...(require('react-native').Platform.OS === 'android'
              ? ({ channelId: 'runquest-live-run', sticky: true } as any)
              : {}),
          },
          trigger: null,
        });
      } catch {}
    }, 10000); // every 10s, background only (feels "live" without spamming)
  };

  const stopNotifUpdater = () => {
    if (notifIntervalRef.current) {
      clearInterval(notifIntervalRef.current);
      notifIntervalRef.current = null;
    }
    Notifications.dismissNotificationAsync('runquest-active-run').catch(() => {});
  };

  // Load settings once (refresh on resume/start if needed)
  useEffect(() => {
    (async () => {
      try {
        settingsRef.current = await getSettings();
      } catch (err) {
        console.warn('Failed to load settings in tracker:', err);
      }
    })();
  }, []);

  // Initial location setup — request permission then get location with fallback
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        let status = 'denied';
        try {
          const res = await Location.requestForegroundPermissionsAsync();
          status = res.status;
        } catch {}

        if (status !== 'granted' || !mounted) {
          if (Platform.OS === 'web' && mounted) {
            dispatch({
              type: 'UPDATE_REGION',
              region: {
                latitude: 37.7749,
                longitude: -122.4194,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              },
            });
          }
          return;
        }

        // Try Balanced first (fast, ~1-3s) then fall back to High if it fails
        let loc: Location.LocationObject | null = null;
        try {
          loc = await Promise.race([
            Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000)),
          ]) as Location.LocationObject;
        } catch {
          // Balanced timed out — try last known position as instant fallback
          try {
            loc = await Location.getLastKnownPositionAsync();
          } catch {}
        }

        if (!loc && Platform.OS === 'web') {
          loc = {
            coords: {
              latitude: 37.7749,
              longitude: -122.4194,
              accuracy: 5,
              altitude: 0,
              heading: 0,
              speed: 0,
            },
          } as any;
        }

        if (!mounted || !loc) return;

        dispatch({
          type: 'UPDATE_REGION',
          region: {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          },
        });
      } catch (err) {
        console.warn('Initial location fetch failed:', err);
      }
    })();

    return () => { mounted = false; };
  }, []);

  // Auto-detect closed loop
  useEffect(() => {
    if (internal.path.length >= 4) {
      const closed = isClosedLoop(internal.path);
      if (closed !== internal.closedLoop) {
        dispatch({ type: 'SET_CLOSED_LOOP', closed });
      }
    }
  }, [internal.closedLoop, internal.path]);

  // Auto-lap: notify when crossing each km/mile threshold
  useEffect(() => {
    if (internal.status !== 'running' || internal.path.length < 2) return;
    const isMetric = settingsRef.current?.units !== 'imperial';
    const lapThreshold = isMetric ? 1000 : 1609.34;
    const currentDist = pathDistance(internal.path);
    const lapNumber = Math.floor(currentDist / lapThreshold);
    const lastLapNumber = Math.floor(lastLapDistanceRef.current / lapThreshold);
    if (lapNumber > lastLapNumber && lapNumber > 0) {
      lastLapDistanceRef.current = currentDist;
      const lapLabel = isMetric ? `${lapNumber} km` : `${lapNumber} mi`;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      NotificationService.notify('🏃 Lap Complete!', `You've run ${lapLabel}!`).catch(() => {});
    }
  }, [internal.path, internal.status]);

  // Web/Simulated Run Path Generator
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (internal.status !== 'running') return;

    // Start simulated movement from current region or a default center
    const baseLat = internal.region?.latitude ?? 37.7749;
    const baseLng = internal.region?.longitude ?? -122.4194;

    let step = 0;
    
    const interval = setInterval(() => {
      const totalSteps = 24;
      const angle = (step / totalSteps) * 2 * Math.PI;
      const radius = 0.0015; // about 150-200 meters radius
      const offsetLat = Math.sin(angle) * radius;
      const offsetLng = Math.cos(angle) * radius;

      const lat = baseLat - radius + offsetLat;
      const lng = baseLng + offsetLng;

      dispatch({
        type: 'UPDATE_LOCATION',
        point: { latitude: lat, longitude: lng },
        accuracy: 5,
        heading: (angle * 180) / Math.PI,
        altitude: 50,
      });

      // Update region to follow the simulated run
      dispatch({
        type: 'UPDATE_REGION',
        region: {
          latitude: lat,
          longitude: lng,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        },
      });

      step++;
    }, 2000);

    return () => clearInterval(interval);
  }, [internal.status]);

  // ── Auto-pause ────────────────────────────────────────────────────────────
  // Pauses after 8s of no movement (speed < 0.5 m/s).
  // Resets timer on every location update. 8s prevents frustrating pauses at lights.
  const autoPauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSpeedRef = useRef<number>(0);

  const clearAutoPauseTimer = () => {
    if (autoPauseTimerRef.current) { clearTimeout(autoPauseTimerRef.current); autoPauseTimerRef.current = null; }
  };

  const scheduleAutoPause = useCallback((speed: number) => {
    if (!settingsRef.current?.autoPause) return;
    lastSpeedRef.current = speed;
    clearAutoPauseTimer();
    if (speed < 0.5) {
      // Moving slowly — schedule pause after 8s
      autoPauseTimerRef.current = setTimeout(() => {
        if (lastSpeedRef.current < 0.5) {
          dispatch({ type: 'PAUSE' });
          locationSub.current?.remove();
          locationSub.current = null;
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
          NotificationService.notify('⏸ Auto-Paused', 'No movement detected. Tap Resume when ready.').catch(() => {});
        }
      }, 8000);
    }
    // If speed >= 0.5 m/s, timer is cleared — no pause scheduled
  }, []);

  const startRunFn = useCallback(async () => {
    if (internal.status === 'running') { return; }

    let settings = settingsRef.current;
    if (!settings) {
      try {
        settings = await getSettings();
        settingsRef.current = settings;
      } catch {
        Alert.alert('Error', 'Failed to load run settings.');
        return;
      }
    }

    if (Platform.OS !== 'web') {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Location access is needed to start tracking.');
        return;
      }
    }

    dispatch({ type: 'START', settings });
    lastLapDistanceRef.current = 0;
    startNotifUpdater(Date.now());

    // Request background location permission (best-effort — doesn't block run)
    try {
      const bgStatus = await Location.requestBackgroundPermissionsAsync();
      if (bgStatus.status === 'granted') {
        const isRunning = await Location.hasStartedLocationUpdatesAsync(BG_TASK).catch(() => false);
        if (!isRunning) {
          await Location.startLocationUpdatesAsync(BG_TASK, {
            accuracy: Location.Accuracy.High,
            distanceInterval: 10,
            timeInterval: 5000,
            showsBackgroundLocationIndicator: true,
            foregroundService: {
              notificationTitle: '🏃 RunQuest — Run Active',
              notificationBody: 'Your run is being tracked. Tap to return.',
              notificationColor: '#32D74B',
            },
          }).catch(() => {});
        }
        // Wire background task to dispatch location updates
        setBgLocationCallback((loc) => {
          // Avoid corrupting runs while paused/idle/finished.
          // Background updates can still arrive if the OS keeps the task alive.
          if (statusRef.current !== 'running') return;
          const point: LatLng = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
          dispatch({
            type: 'UPDATE_LOCATION',
            point,
            accuracy: loc.coords.accuracy ?? null,
            heading: loc.coords.heading ?? null,
            altitude: loc.coords.altitude ?? null,
          });
        });
      }
    } catch {}

    try {
      if (Platform.OS === 'web') return; // Skip watchPosition on web
      locationSub.current?.remove();
      locationSub.current = await Location.watchPositionAsync(
        {
          accuracy: settings.locationAccuracy === 'High' ? Location.Accuracy.High : Location.Accuracy.Balanced,
          distanceInterval: settings.distanceIntervalMeters,
          timeInterval: settings.timeIntervalMs,
        },
        (loc) => {
          const point: LatLng = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          };

          dispatch({
            type: 'UPDATE_LOCATION',
            point,
            accuracy: loc.coords.accuracy ?? null,
            heading: loc.coords.heading ?? null,
            altitude: loc.coords.altitude ?? null,
          });

          // Auto-pause: pass current speed (m/s) to scheduler
          const speed = loc.coords.speed ?? 0;
          scheduleAutoPause(speed);

          const delta = settings.defaultZoom === 16 ? 0.005 : settings.defaultZoom === 15 ? 0.01 : 0.02;
          dispatch({
            type: 'UPDATE_REGION',
            region: {
              latitude: point.latitude,
              longitude: point.longitude,
              latitudeDelta: delta,
              longitudeDelta: delta,
            },
          });
        }
      );
    } catch (err) {
      console.error('Failed to start tracking:', err);
      Alert.alert('Tracking Error', 'Could not start location tracking.');
      dispatch({ type: 'RESET' });
    }
  }, [internal.status, scheduleAutoPause]);

  const pauseRun = useCallback(async () => {
    if (internal.status !== 'running') { return; }
    clearAutoPauseTimer();
    locationSub.current?.remove();
    locationSub.current = null;
    // Pause should stop background tracking + the live notification updater.
    setBgLocationCallback(null);
    Location.hasStartedLocationUpdatesAsync(BG_TASK)
      .then(running => { if (running) Location.stopLocationUpdatesAsync(BG_TASK).catch(() => {}); })
      .catch(() => {});
    stopNotifUpdater();
    dispatch({ type: 'PAUSE' });
  }, [internal.status]);

  const resumeRun = useCallback(async () => {
    if (internal.status !== 'paused') { return; }

    let settings = settingsRef.current;
    if (!settings) {
      try {
        settings = await getSettings();
        settingsRef.current = settings;
      } catch {
        Alert.alert('Error', 'Failed to load settings.');
        return;
      }
    }

    dispatch({ type: 'RESUME', settings });
    lastLapDistanceRef.current = pathDistance(internal.path); // reset lap baseline to current distance
    startNotifUpdater(internal.startedAt ?? Date.now());

    // Best-effort: restart background location updates so Android shows a persistent
    // foreground-service tile while the run is active in the background.
    try {
      const bgStatus = await Location.requestBackgroundPermissionsAsync();
      if (bgStatus.status === 'granted') {
        const isRunning = await Location.hasStartedLocationUpdatesAsync(BG_TASK).catch(() => false);
        if (!isRunning) {
          await Location.startLocationUpdatesAsync(BG_TASK, {
            accuracy: Location.Accuracy.High,
            distanceInterval: 10,
            timeInterval: 5000,
            showsBackgroundLocationIndicator: true,
            foregroundService: {
              notificationTitle: 'RunQuest — Run Active',
              notificationBody: 'Live tracking in progress. Tap to return.',
              notificationColor: '#32D74B',
            },
          }).catch(() => {});
        }
        setBgLocationCallback((loc) => {
          if (statusRef.current !== 'running') return;
          const point: LatLng = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
          dispatch({
            type: 'UPDATE_LOCATION',
            point,
            accuracy: loc.coords.accuracy ?? null,
            heading: loc.coords.heading ?? null,
            altitude: loc.coords.altitude ?? null,
          });
        });
      }
    } catch {}

    try {
      if (Platform.OS === 'web') return; // Skip watchPosition on web
      locationSub.current = await Location.watchPositionAsync(
        {
          accuracy: settings.locationAccuracy === 'High' ? Location.Accuracy.High : Location.Accuracy.Balanced,
          distanceInterval: settings.distanceIntervalMeters,
          timeInterval: settings.timeIntervalMs,
        },
        (loc) => {
          const point: LatLng = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
          dispatch({
            type: 'UPDATE_LOCATION',
            point,
            accuracy: loc.coords.accuracy ?? null,
            heading: loc.coords.heading ?? null,
            altitude: loc.coords.altitude ?? null,
          });
          scheduleAutoPause(loc.coords.speed ?? 0);
          dispatch({
            type: 'UPDATE_REGION',
            region: {
              latitude: point.latitude,
              longitude: point.longitude,
              latitudeDelta: internal.region?.latitudeDelta ?? 0.01,
              longitudeDelta: internal.region?.longitudeDelta ?? 0.01,
            },
          });
        }
      );
    } catch (err) {
      console.error('Resume failed:', err);
      dispatch({ type: 'PAUSE' });
    }
  }, [internal.status, internal.region, scheduleAutoPause]);

  const stopRun = useCallback(async () => {
    if (internal.isSaving) return null;
    clearAutoPauseTimer();

    locationSub.current?.remove();
    locationSub.current = null;

    let savedId: string | null = null;

    if (internal.path.length > 1 && internal.startedAt != null) {
      dispatch({ type: 'SET_SAVING', isSaving: true });
      const distance = pathDistance(internal.path);
      const perimeter = pathPerimeter(internal.path);
      const areaSq = polygonAreaSqMeters(internal.path);
      const durationSec = Math.max(0, Math.floor((Date.now() - internal.startedAt - internal.totalPausedMs) / 1000));

      // ── Minimum criteria: at least 100m AND 30 seconds ──────────────────────
      // Prevents garbage runs (accidental taps, GPS drift, test runs) from polluting history
      const worthSaving = distance >= 100 && durationSec >= 30;

      if (worthSaving) {
        const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        try {
          await addRun({
            id: runId,
            createdAt: Date.now(),
            distanceMeters: Math.round(distance),
            durationSec,
            perimeterMeters: Math.round(perimeter),
            areaSqMeters: Math.round(areaSq),
            points: internal.path,
            altitudePoints: internal.altitudePoints.length > 0 ? internal.altitudePoints : undefined,
          });
          savedId = runId;
        } catch (err) {
          console.error('Failed to save run:', err);
          Alert.alert('Save Error', 'Run tracked but could not be saved due to network error.');
        }
      }
      dispatch({ type: 'SET_SAVING', isSaving: false });
    }

    dispatch({ type: 'STOP' });
    stopNotifUpdater();
    setBgLocationCallback(null); // stop background updates

    // Stop background location task
    Location.hasStartedLocationUpdatesAsync(BG_TASK)
      .then(running => { if (running) Location.stopLocationUpdatesAsync(BG_TASK).catch(() => {}); })
      .catch(() => {});

    return savedId;
  }, [internal]);

  const reset = useCallback(() => {
    locationSub.current?.remove();
    locationSub.current = null;
    clearAutoPauseTimer();
    stopNotifUpdater();
    dispatch({ type: 'RESET' });
  }, []);

  const recenter = useCallback(async () => {
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const delta = 0.01;
      dispatch({
        type: 'UPDATE_REGION',
        region: {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: delta,
          longitudeDelta: delta,
        },
      });
    } catch (err) {
      console.warn('Recenter failed:', err);
      // Silent fail — GPS may be temporarily unavailable
    }
  }, []);

  // Final cleanup
  useEffect(() => {
    return () => {
      locationSub.current?.remove();
      clearAutoPauseTimer();
      stopNotifUpdater();
    };
  }, []);

  return {
    state: internal.status,
    path: internal.path,
    altitudePoints: internal.altitudePoints,
    region: internal.region,
    startedAt: internal.startedAt,
    totalPausedMs: internal.totalPausedMs,
    pausedAt: internal.pausedAt,
    accuracyMeters: internal.accuracyMeters,
    headingDeg: internal.headingDeg,
    altitudeMeters: internal.altitudeMeters,
    startRun: startRunFn,
    pauseRun,
    resumeRun,
    stopRun,
    reset,
    recenter,
    closedLoop: internal.closedLoop,
    isSaving: internal.isSaving,
  };
}