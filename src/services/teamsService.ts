import {
  collection, doc, addDoc, updateDoc, getDoc, getDocs,
  onSnapshot, query, arrayUnion, arrayRemove, serverTimestamp, where,
} from 'firebase/firestore';
import { auth, db } from './firebase';

export interface Team {
  id: string;
  name: string;
  tag: string; // 3-4 chars
  color: string;
  ownerId: string;
  memberIds: string[];
  createdAt: number;
}

function sanitize(input: string, maxLen: number): string {
  return input.replace(/<[^>]*>/g, '').trim().slice(0, maxLen);
}

export async function createTeam(name: string, tag: string, color: string): Promise<Team | null> {
  try {
    const user = auth.currentUser;
    if (!user) return null;
    const cleanName = sanitize(name, 40);
    const cleanTag = sanitize(tag, 4).toUpperCase();
    if (!cleanName || cleanTag.length < 2) return null;

    const ref = await addDoc(collection(db, 'teams'), {
      name: cleanName,
      tag: cleanTag,
      color,
      ownerId: user.uid,
      memberIds: [user.uid],
      createdAt: serverTimestamp(),
    });
    return {
      id: ref.id,
      name: cleanName,
      tag: cleanTag,
      color,
      ownerId: user.uid,
      memberIds: [user.uid],
      createdAt: Date.now(),
    };
  } catch (err) {
    console.error('createTeam failed:', err);
    return null;
  }
}

export async function joinTeam(teamId: string): Promise<boolean> {
  try {
    const user = auth.currentUser;
    if (!user) return false;

    // Enforce one-team-per-user: leave current team first
    const currentTeam = await getUserTeam(user.uid);
    if (currentTeam) {
      if (currentTeam.id === teamId) return true; // already in this team
      await leaveTeam(currentTeam.id); // leave current team before joining new one
    }

    await updateDoc(doc(db, 'teams', teamId), {
      memberIds: arrayUnion(user.uid),
    });
    return true;
  } catch (err) {
    console.error('joinTeam failed:', err);
    return false;
  }
}

export async function leaveTeam(teamId: string): Promise<boolean> {
  try {
    const user = auth.currentUser;
    if (!user) return false;
    await updateDoc(doc(db, 'teams', teamId), {
      memberIds: arrayRemove(user.uid),
    });
    return true;
  } catch (err) {
    console.error('leaveTeam failed:', err);
    return false;
  }
}

export async function getUserTeam(uid: string): Promise<Team | null> {
  try {
    // Use a targeted query instead of fetching all teams (performance fix)
    const q = query(collection(db, 'teams'), where('memberIds', 'array-contains', uid));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    const data = d.data();
    return {
      id: d.id,
      name: data.name,
      tag: data.tag,
      color: data.color,
      ownerId: data.ownerId,
      memberIds: data.memberIds,
      createdAt: data.createdAt?.toMillis?.() || Date.now(),
    };
  } catch (err: any) {
    // Silently return null if rules not yet deployed — teams feature degrades gracefully
    if (err?.code === 'permission-denied' || err?.message?.includes('permissions')) {
      return null;
    }
    console.error('getUserTeam failed:', err);
    return null;
  }
}

export function subscribeTeams(onUpdate: (teams: Team[]) => void): () => void {
  const q = query(collection(db, 'teams'));
  return onSnapshot(q, (snap) => {
    const list: Team[] = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        name: data.name,
        tag: data.tag,
        color: data.color,
        ownerId: data.ownerId,
        memberIds: data.memberIds || [],
        createdAt: data.createdAt?.toMillis?.() || Date.now(),
      };
    });
    onUpdate(list);
  }, (err: any) => {
    // Silently ignore permission errors — rules not yet deployed
    if (err?.code === 'permission-denied' || err?.message?.includes('permissions')) {
      onUpdate([]); // return empty list gracefully
      return;
    }
    console.warn('subscribeTeams error:', err);
  });
}
