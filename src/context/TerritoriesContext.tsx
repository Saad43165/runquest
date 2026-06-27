import React, { createContext, useContext, useEffect, useState } from 'react';
import { Territory } from '../types';
import { subscribeTerritories } from '../services/territoriesRemote';
import { auth } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import * as Location from 'expo-location';

interface TerritoriesContextValue {
  territories: Territory[];
  loading: boolean;
}

const TerritoriesContext = createContext<TerritoriesContextValue>({
  territories: [],
  loading: true,
});

export function TerritoriesProvider({ children }: { children: React.ReactNode }) {
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubAuth: (() => void) | null = null;
    let unsubTerritories: (() => void) | null = null;
    let cancelled = false;

    unsubAuth = onAuthStateChanged(auth, async (user) => {
      // Clean up previous territory subscription if any
      if (unsubTerritories) {
        unsubTerritories();
        unsubTerritories = null;
      }

      if (!user) {
        if (!cancelled) {
          setTerritories([]);
          setLoading(false);
        }
        return;
      }

      if (!cancelled) {
        setLoading(true);
      }

      let nearLocation: { latitude: number; longitude: number } | undefined;
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === 'granted') {
          // Try last known first (instant), then current with timeout
          let loc: Location.LocationObject | null = null;
          try {
            loc = await Location.getLastKnownPositionAsync();
          } catch {}
          if (!loc) {
            try {
              loc = await Promise.race([
                Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
                new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 6000)),
              ]) as Location.LocationObject;
            } catch {}
          }
          if (loc) {
            nearLocation = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
          }
        }
      } catch {}

      if (cancelled) return;

      try {
        const fn = await subscribeTerritories((list) => {
          if (!cancelled) {
            setTerritories(list);
            setLoading(false);
          }
        }, nearLocation);

        if (cancelled) {
          fn();
          return;
        }
        unsubTerritories = fn;
      } catch (err) {
        console.error('Failed to subscribe to territories:', err);
        if (!cancelled) {
          setLoading(false);
        }
      }
    });

    return () => {
      cancelled = true;
      unsubAuth?.();
      unsubTerritories?.();
    };
  }, []);

  return (
    <TerritoriesContext.Provider value={{ territories, loading }}>
      {children}
    </TerritoriesContext.Provider>
  );
}

export function useTerritories() {
  return useContext(TerritoriesContext);
}


