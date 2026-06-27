import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../services/firebase';
import { getUserProfile, UserProfile } from '../services/authService';
import { syncHistoryToCloud } from '../services/history';
import { registerFCMToken } from '../services/fcmService';
import { loadQueue, processQueue } from '../services/offlineQueue';
import { setMusicState } from '../hooks/useMusicStore';

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  reload: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  profile: null,
  loading: true,
  refreshProfile: async () => {},
  reload: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = async () => {
    if (user) {
      const p = await getUserProfile(user.uid);
      setProfile(p);
    }
  };

  const reload = async () => {
    if (auth.currentUser) {
      await auth.currentUser.reload();
      setUser({ ...auth.currentUser }); // Force a new object reference to trigger React update
    }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        setUser(firebaseUser);
        if (firebaseUser) {
          const p = await getUserProfile(firebaseUser.uid);
          setProfile(p);
          // Sync any locally-stored runs to the cloud for this user
          syncHistoryToCloud().catch(() => {});
          // Register FCM token for push notifications
          registerFCMToken().catch(() => {});
          // Process any queued offline operations
          loadQueue().then(queue => {
            if (queue.length > 0) processQueue(queue).catch(() => {});
          }).catch(() => {});
        } else {
          setProfile(null);
          // Stop music and reset music state on logout
          setMusicState({
            isPlaying: false,
            trackName: '',
            positionMs: 0,
            durationMs: 0,
            onToggle: null,
            onNext: null,
            onPrev: null,
            onPickMusic: null,
            onSeek: null,
          });
        }
      } catch (e) {
        console.error('AuthContext: Profile fetch failed', e);
      } finally {
        setLoading(false);
      }
    });
    return unsub;
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, refreshProfile, reload }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
