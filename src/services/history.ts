/**
 * Run history service — persists to BOTH AsyncStorage (offline cache)
 * AND Firestore (cloud sync per user UID).
 *
 * On first load after login, data is pulled from Firestore and merged
 * into the local cache so reinstalling the app never loses history.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  collection, doc, setDoc, getDocs, deleteDoc,
  query, orderBy, writeBatch,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { LatLng } from '../types';

export type RunRecord = {
  id: string;
  createdAt: number;
  distanceMeters: number;
  durationSec: number;
  perimeterMeters: number;
  areaSqMeters: number;
  points: LatLng[];
};

const LOCAL_KEY = 'runquest:history';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid(): string | null {
  return auth.currentUser?.uid ?? null;
}

function runsCollection(userId: string) {
  return collection(db, 'users', userId, 'runs');
}

// ─── Local cache ──────────────────────────────────────────────────────────────

async function getLocalHistory(): Promise<RunRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_KEY);
    return raw ? (JSON.parse(raw) as RunRecord[]) : [];
  } catch {
    return [];
  }
}

async function setLocalHistory(list: RunRecord[]): Promise<void> {
  try {
    await AsyncStorage.setItem(LOCAL_KEY, JSON.stringify(list));
  } catch {}
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Add a run — saves locally immediately, then syncs to Firestore.
 */
export async function addRun(rec: RunRecord): Promise<void> {
  // 1. Save locally first (instant, works offline)
  const list = await getLocalHistory();
  const updated = [rec, ...list];
  await setLocalHistory(updated);

  // 2. Sync to Firestore if logged in
  const userId = uid();
  if (!userId) return;
  try {
    await setDoc(doc(runsCollection(userId), rec.id), {
      ...rec,
      // Firestore can't store nested arrays of objects directly — serialize points
      points: JSON.stringify(rec.points),
    });
  } catch (e) {
    console.warn('Failed to sync run to Firestore:', e);
  }
}

/**
 * Get history — returns local cache, but first syncs from Firestore
 * if the local cache is empty (e.g. after reinstall).
 */
export async function getHistory(): Promise<RunRecord[]> {
  const local = await getLocalHistory();

  const userId = uid();
  if (!userId) return local;

  // If local is empty, try to restore from Firestore
  if (local.length === 0) {
    try {
      const snap = await getDocs(
        query(runsCollection(userId), orderBy('createdAt', 'desc'))
      );
      if (!snap.empty) {
        const fromCloud: RunRecord[] = snap.docs.map(d => {
          const data = d.data();
          return {
            ...data,
            id: d.id,
            points: typeof data.points === 'string'
              ? JSON.parse(data.points)
              : (data.points ?? []),
          } as RunRecord;
        });
        // Populate local cache from cloud
        await setLocalHistory(fromCloud);
        return fromCloud;
      }
    } catch (e) {
      console.warn('Failed to restore history from Firestore:', e);
    }
  }

  return local;
}

/**
 * Clear all history — removes locally and from Firestore.
 */
export async function clearHistory(): Promise<void> {
  await AsyncStorage.removeItem(LOCAL_KEY);

  const userId = uid();
  if (!userId) return;
  try {
    const snap = await getDocs(runsCollection(userId));
    if (!snap.empty) {
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
  } catch (e) {
    console.warn('Failed to clear Firestore history:', e);
  }
}

/**
 * Sync local history to Firestore — call this after login to push
 * any runs recorded while offline.
 */
export async function syncHistoryToCloud(): Promise<void> {
  const userId = uid();
  if (!userId) return;

  const local = await getLocalHistory();
  if (local.length === 0) return;

  try {
    const batch = writeBatch(db);
    for (const rec of local) {
      batch.set(doc(runsCollection(userId), rec.id), {
        ...rec,
        points: JSON.stringify(rec.points),
      });
    }
    await batch.commit();
  } catch (e) {
    console.warn('Failed to sync history to Firestore:', e);
  }
}

/**
 * Compute aggregate stats from history.
 */
export async function getHistoryStats(): Promise<{
  runs: number;
  totalDistanceMeters: number;
  totalDurationSec: number;
  longestDistanceMeters: number;
}> {
  const list = await getHistory();
  let dist = 0, dur = 0, longest = 0;
  for (const r of list) {
    dist += r.distanceMeters || 0;
    dur  += r.durationSec    || 0;
    if ((r.distanceMeters || 0) > longest) longest = r.distanceMeters;
  }
  return { runs: list.length, totalDistanceMeters: dist, totalDurationSec: dur, longestDistanceMeters: longest };
}
