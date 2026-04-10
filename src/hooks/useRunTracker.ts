import { useEffect, useRef, useReducer, useCallback } from 'react';
import * as Location from 'expo-location';
import { Alert } from 'react-native';
import { LatLng, RunState } from '../types';
import { isClosedLoop, pathDistance, pathPerimeter, polygonAreaSqMeters } from '../utils/geometry';
import { addRun } from '../services/history';
import { getSettings, Settings } from '../config/settings';
import { Region } from 'react-native-maps';

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
      // Deduplicate: skip point if < 2m from last recorded point
      if (state.path.length > 0) {
        const last = state.path[state.path.length - 1];
        const dLat = (action.point.latitude - last.latitude) * 111000;
        const dLng = (action.point.longitude - last.longitude) * 111000 * Math.cos(last.latitude * Math.PI / 180);
        const dist = Math.sqrt(dLat * dLat + dLng * dLng);
        if (dist < 2) return { ...state, accuracyMeters: action.accuracy, headingDeg: action.heading, altitudeMeters: action.altitude ?? null };
      }
      return {
        ...state,
        path: [...state.path, action.point],
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
  region: Region | null;
  startedAt: number | null;
  accuracyMeters: number | null;
  headingDeg: number | null;
  altitudeMeters: number | null;
  startRun: () => Promise<void>;
  pauseRun: () => Promise<void>;
  resumeRun: () => Promise<void>;
  stopRun: () => Promise<void>;
  reset: () => void;
  recenter: () => Promise<void>;
  closedLoop: boolean;
  isSaving: boolean;
};

export function useRunTracker(): Tracker {
  const [internal, dispatch] = useReducer(runReducer, initialInternalState);
  const locationSub = useRef<Location.LocationSubscription | null>(null);
  const settingsRef = useRef<Settings | null>(null);

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

  // Initial location setup
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted' || !mounted) {return;}

        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        if (!mounted) { return; }
        const delta = 0.01;
          type: 'UPDATE_REGION',
          region: {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            latitudeDelta: delta,
            longitudeDelta: delta,
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

  const startRun = useCallback(async () => {
    if (internal.status === 'running') {return;}

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

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Location access is needed to start tracking.');
      return;
    }

    dispatch({ type: 'START', settings });

    try {
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
  }, [internal.status]);

  const pauseRun = useCallback(async () => {
    if (internal.status !== 'running') {return;}

    locationSub.current?.remove();
    locationSub.current = null;
    dispatch({ type: 'PAUSE' });
  }, [internal.status]);

  const resumeRun = useCallback(async () => {
    if (internal.status !== 'paused') {return;}

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

    try {
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
  }, [internal.status, internal.region]);

  const stopRun = useCallback(async () => {
    // If we are already saving, don't trigger stop again
    if (internal.isSaving) return;

    locationSub.current?.remove();
    locationSub.current = null;

    if (internal.path.length > 1 && internal.startedAt != null) {
      dispatch({ type: 'SET_SAVING', isSaving: true });
      const distance = pathDistance(internal.path);
      const perimeter = pathPerimeter(internal.path);
      const areaSq = polygonAreaSqMeters(internal.path);
      const durationSec = Math.max(0, Math.floor((Date.now() - internal.startedAt - internal.totalPausedMs) / 1000));

      try {
        await addRun({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          createdAt: Date.now(),
          distanceMeters: Math.round(distance),
          durationSec,
          perimeterMeters: Math.round(perimeter),
          areaSqMeters: Math.round(areaSq),
          points: internal.path,
        });
      } catch (err) {
        console.error('Failed to save run:', err);
        Alert.alert('Save Error', 'Run tracked but could not be saved due to network error.');
      } finally {
        dispatch({ type: 'SET_SAVING', isSaving: false });
      }
    }

    dispatch({ type: 'STOP' });
  }, [internal]);

  const reset = useCallback(() => {
    locationSub.current?.remove();
    locationSub.current = null;
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
      Alert.alert('Location Error', 'Could not get current position.');
    }
  }, []);

  // Final cleanup
  useEffect(() => {
    return () => {
      locationSub.current?.remove();
    };
  }, []);

  return {
    state: internal.status,
    path: internal.path,
    region: internal.region,
    startedAt: internal.startedAt,
    accuracyMeters: internal.accuracyMeters,
    headingDeg: internal.headingDeg,
    altitudeMeters: internal.altitudeMeters,
    startRun,
    pauseRun,
    resumeRun,
    stopRun,
    reset,
    recenter,
    closedLoop: internal.closedLoop,
    isSaving: internal.isSaving,
  };
}
