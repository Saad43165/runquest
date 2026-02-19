import { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { LatLng, RunState } from '../types';
import { isClosedLoop, pathDistance, pathPerimeter, polygonAreaSqMeters } from '../utils/geometry';
import { addRun } from '../services/history';

type Tracker = {
  state: RunState;
  path: LatLng[];
  region: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number } | null;
  startedAt: number | null;
  startRun: () => Promise<void>;
  stopRun: () => Promise<void>;
  reset: () => void;
  closedLoop: boolean;
};

export function useRunTracker(): Tracker {
  const [state, setState] = useState<RunState>('idle');
  const [path, setPath] = useState<LatLng[]>([]);
  const [region, setRegion] = useState<Tracker['region']>(null);
  const [closedLoop, setClosedLoop] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const subRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== Location.PermissionStatus.GRANTED) {
        console.warn('Location permission not granted');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      setRegion({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01
      });
    })();
  }, []);

  useEffect(() => {
    if (path.length >= 4) {
      setClosedLoop(isClosedLoop(path));
    } else {
      setClosedLoop(false);
    }
  }, [path]);

  const startRun = async () => {
    if (state === 'running') {
      return;
    }
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== Location.PermissionStatus.GRANTED) {
      console.warn('Location permission not granted');
      return;
    }
    setState('running');
    setPath([]);
    setStartedAt(Date.now());
    subRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        distanceInterval: 5,
        timeInterval: 2000
      },
      (update) => {
        const point = { latitude: update.coords.latitude, longitude: update.coords.longitude };
        setPath((prev) => {
          const next = prev.concat(point);
          return next;
        });
        setRegion((r) => {
          if (r) {
            return { ...r, latitude: point.latitude, longitude: point.longitude };
          }
          return {
            latitude: point.latitude,
            longitude: point.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          };
        });
      }
    );
  };

  const stopRun = async () => {
    if (subRef.current) {
      subRef.current.remove();
      subRef.current = null;
    }
    if (path.length > 1 && startedAt) {
      const distance = pathDistance(path);
      const perimeter = pathPerimeter(path);
      const area = polygonAreaSqMeters(path);
      const duration = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
      await addRun({
        id: `${Date.now()}`,
        createdAt: Date.now(),
        distanceMeters: Math.round(distance),
        durationSec: duration,
        perimeterMeters: Math.round(perimeter),
        areaSqMeters: Math.round(area)
      });
    }
    setState('finished');
  };

  const reset = () => {
    setState('idle');
    setPath([]);
    setClosedLoop(false);
    setStartedAt(null);
  };

  return { state, path, region, startedAt, startRun, stopRun, reset, closedLoop };
}
