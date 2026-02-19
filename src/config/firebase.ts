import Constants from 'expo-constants';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';

export function initFirebase() {
  const extra = (Constants?.expoConfig?.extra as any) || {};
  const cfg = extra.firebase;
  if (!cfg) {
    return null;
  }
  const app = getApps().length ? getApps()[0] : initializeApp(cfg);
  return app;
}

export async function ensureAnonymousAuth(): Promise<string | null> {
  const app = initFirebase();
  if (!app) {
    return null;
  }
  const auth = getAuth(app);
  if (auth.currentUser?.uid) {
    return auth.currentUser.uid;
  }
  const res = await signInAnonymously(auth);
  return res.user.uid;
}
