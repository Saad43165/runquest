import {
  doc, setDoc, deleteDoc, getDocs, getDoc,
  collection, onSnapshot, query,
} from 'firebase/firestore';
import { auth, db } from './firebase';

// ─── Firestore paths ──────────────────────────────────────────────────────────
// follows/{uid}/following/{targetUid}

function followingRef(uid: string) {
  return collection(db, 'follows', uid, 'following');
}

function followDocRef(uid: string, targetUid: string) {
  return doc(db, 'follows', uid, 'following', targetUid);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Follow a user */
export async function followUser(targetUid: string): Promise<void> {
  const user = auth.currentUser;
  if (!user || user.uid === targetUid) return;
  await setDoc(followDocRef(user.uid, targetUid), {
    followedAt: Date.now(),
    targetUid,
  });
}

/** Unfollow a user */
export async function unfollowUser(targetUid: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;
  await deleteDoc(followDocRef(user.uid, targetUid));
}

/** Get list of UIDs the given user follows */
export async function getFollowing(uid: string): Promise<string[]> {
  try {
    const snap = await getDocs(followingRef(uid));
    return snap.docs.map(d => d.id);
  } catch {
    return [];
  }
}

/** Check if uid follows targetUid */
export async function isFollowing(uid: string, targetUid: string): Promise<boolean> {
  try {
    const snap = await getDoc(followDocRef(uid, targetUid));
    return snap.exists();
  } catch {
    return false;
  }
}

/** Real-time listener for the list of UIDs the given user follows */
export function subscribeFollowing(
  uid: string,
  onUpdate: (followingUids: string[]) => void,
): () => void {
  try {
    const q = query(followingRef(uid));
    return onSnapshot(q, (snap) => {
      onUpdate(snap.docs.map(d => d.id));
    }, () => onUpdate([]));
  } catch {
    return () => {};
  }
}
