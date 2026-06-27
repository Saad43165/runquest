/**
 * Live user presence — writes the current user's location to Firestore
 * so other users can see active runners on the map in real-time.
 *
 * Privacy: only published when user has showMyLocation = true (default on).
 * Presence expires after 5 minutes of no update.
 */

import {
  doc, setDoc, deleteDoc, onSnapshot, collection,
  query, serverTimestamp, getDoc,
} from 'firebase/firestore';
import { auth, db } from './firebase';

export type LiveUser = {
  uid: string;
  displayName: string;
  photoURL: string | null;
  username: string | null;
  latitude: number;
  longitude: number;
  isRunning: boolean;
  updatedAt: number;
  avatarIndex: number;
};

const PRESENCE_TTL_MS = 5 * 60 * 1000; // 5 min — stale after this
const HEARTBEAT_MS    = 60 * 1000;      // publish heartbeat every 60s to stay alive

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let lastLat = 0;
let lastLng = 0;
let lastRunning = false;
let presenceActive = false;

// ─── Publish own location ─────────────────────────────────────────────────────

export async function startPresence(
  latitude: number,
  longitude: number,
  isRunning: boolean,
): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;

  lastLat = latitude;
  lastLng = longitude;
  lastRunning = isRunning;
  presenceActive = true;

  try {
    // Fetch username and avatarIndex from profile
    let username: string | null = null;
    let avatarIndex = 0;
    try {
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (snap.exists()) {
        username = snap.data().username ?? null;
        avatarIndex = snap.data().avatarIndex ?? 0;
      }
    } catch {}

    await setDoc(doc(db, 'presence', user.uid), {
      uid: user.uid,
      displayName: user.displayName || 'Warrior',
      photoURL: user.photoURL || null,
      username,
      avatarIndex,
      latitude,
      longitude,
      isRunning,
      updatedAt: serverTimestamp(),
      expiresAt: Date.now() + PRESENCE_TTL_MS,
    });

    // Start heartbeat — keeps presence alive while app is open
    _startHeartbeat();
  } catch { /* non-critical */ }
}

export async function updatePresence(
  latitude: number,
  longitude: number,
  isRunning: boolean,
): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;

  lastLat = latitude;
  lastLng = longitude;
  lastRunning = isRunning;

  if (!presenceActive) {
    // First update — do a full write with all fields
    await startPresence(latitude, longitude, isRunning);
    return;
  }

  try {
    await setDoc(doc(db, 'presence', user.uid), {
      latitude,
      longitude,
      isRunning,
      updatedAt: serverTimestamp(),
      expiresAt: Date.now() + PRESENCE_TTL_MS,
    }, { merge: true });
  } catch {}
}

export async function stopPresence(): Promise<void> {
  const user = auth.currentUser;
  presenceActive = false;
  _stopHeartbeat();
  if (!user) return;
  try {
    await deleteDoc(doc(db, 'presence', user.uid));
  } catch {}
}

function _startHeartbeat() {
  _stopHeartbeat();
  heartbeatTimer = setInterval(async () => {
    const user = auth.currentUser;
    if (!user || !presenceActive) { _stopHeartbeat(); return; }
    try {
      await setDoc(doc(db, 'presence', user.uid), {
        latitude: lastLat,
        longitude: lastLng,
        isRunning: lastRunning,
        updatedAt: serverTimestamp(),
        expiresAt: Date.now() + PRESENCE_TTL_MS,
      }, { merge: true });
    } catch {}
  }, HEARTBEAT_MS);
}

function _stopHeartbeat() {
  if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
}

// ─── Subscribe to ALL live users globally ────────────────────────────────────
// No geo filter — presence collection is small (only active runners)
// so loading all is fine and enables global Snapchat-style visibility

export function subscribeLiveUsers(
  onUpdate: (users: LiveUser[]) => void,
): () => void {
  try {
    const q = query(collection(db, 'presence'));

    return onSnapshot(q, (snap) => {
      const now = Date.now();
      const users: LiveUser[] = [];
      const currentUid = auth.currentUser?.uid;

      snap.forEach((d) => {
        const data = d.data();
        if (data.uid === currentUid) return;                          // skip self
        if (data.expiresAt && data.expiresAt < now) return;          // skip stale
        if (!data.latitude || !data.longitude) return;               // skip no-location

        users.push({
          uid: data.uid,
          displayName: data.displayName || 'Warrior',
          photoURL: data.photoURL || null,
          username: data.username || null,
          latitude: data.latitude,
          longitude: data.longitude,
          isRunning: data.isRunning === true,
          updatedAt: data.updatedAt?.toMillis?.() ?? now,
          avatarIndex: data.avatarIndex ?? 0,
        });
      });

      onUpdate(users);
    }, () => {
      onUpdate([]);
    });
  } catch {
    return () => {};
  }
}
