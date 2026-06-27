import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, db } from '../services/firebase';
import { doc, getDoc } from 'firebase/firestore';

const KEY = 'runquest:userId';
const NAME_KEY = 'runquest:displayName';

export async function ensureUserId(): Promise<string> {
  // Always prefer Firebase UID when logged in
  const firebaseUid = auth.currentUser?.uid;
  if (firebaseUid) return firebaseUid;

  const existing = await AsyncStorage.getItem(KEY);
  if (existing) return existing;

  const gen = `local-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
  await AsyncStorage.setItem(KEY, gen);
  return gen;
}

/**
 * Get the best available display name for the current user.
 * Priority: Firestore profile username > Firebase Auth displayName > AsyncStorage > fallback
 */
export async function getDisplayName(): Promise<string> {
  try {
    const user = auth.currentUser;
    if (user) {
      // 1. Try Firestore profile username first (most accurate)
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) {
          const data = snap.data();
          const name = data.username || data.displayName;
          if (name && name.trim()) {
            // Cache it locally
            await AsyncStorage.setItem(NAME_KEY, name.trim());
            return name.trim();
          }
        }
      } catch {}

      // 2. Firebase Auth displayName
      if (user.displayName && user.displayName.trim()) {
        await AsyncStorage.setItem(NAME_KEY, user.displayName.trim());
        return user.displayName.trim();
      }

      // 3. Email prefix as fallback
      if (user.email) {
        const emailName = user.email.split('@')[0];
        return emailName;
      }
    }
  } catch {}

  // 4. AsyncStorage cache
  const cached = await AsyncStorage.getItem(NAME_KEY);
  if (cached && cached.trim()) return cached.trim();

  // 5. Last resort
  return 'Warrior';
}

export async function setDisplayName(name: string): Promise<void> {
  await AsyncStorage.setItem(NAME_KEY, name);
}
