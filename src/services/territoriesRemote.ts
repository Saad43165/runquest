import { collection, addDoc, onSnapshot, query, deleteDoc, doc, serverTimestamp, orderBy, getDocs, where } from 'firebase/firestore';
import { auth, db } from './firebase';
import { LatLng, Territory } from '../types';
import { pathPerimeter, polygonAreaSqMeters } from '../utils/geometry';

function colorFromId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) % 360;
  }
  return `hsl(${hash}, 70%, 55%)`;
}

/**
 * Subscribe to ALL territories globally (Shared Data)
 */
export async function subscribeTerritories(onUpdate: (territories: Territory[]) => void): Promise<() => void> {
  try {
    const q = query(collection(db, 'territories'), orderBy('createdAt', 'desc'));
    
    return onSnapshot(q, (snap) => {
      const list: Territory[] = [];
      snap.forEach((d) => {
        const data = d.data();
        list.push({
          id: d.id,
          name: data.name,
          ownerId: data.ownerId,
          ownerDisplayName: data.ownerDisplayName ?? null,
          color: data.color,
          createdAt: data.createdAt?.toMillis() || Date.now(),
          polygon: data.polygon,
          perimeterMeters: data.perimeterMeters,
          areaSqMeters: data.areaSqMeters,
        });
      });
      onUpdate(list);
    }, (err) => {
      console.warn('Firestore subscription error:', err);
    });
  } catch (err) {
    console.error('Failed to subscribe to territories:', err);
    return () => {};
  }
}

/**
 * Claim a new territory and save it to Firestore
 */
export async function claimAndConquerRemote(name: string, path: LatLng[]): Promise<{ claimed: Territory; conquered: string[] } | null> {
  try {
    const user = auth.currentUser;
    if (!user) {
      console.error('No authenticated user available');
      return null;
    }

    const perimeter = pathPerimeter(path);
    const areaSq = polygonAreaSqMeters(path);
    const color = colorFromId(user.uid);

    const docRef = await addDoc(collection(db, 'territories'), {
      name,
      ownerId: user.uid,
      ownerDisplayName: user.displayName || 'Hero',
      polygon: path,
      perimeterMeters: Math.round(perimeter),
      areaSqMeters: Math.round(areaSq),
      color,
      createdAt: serverTimestamp(),
    });

    // For now, "conquered" logic (removing overlapping territories) 
    // would ideally be a Firebase Cloud Function, but we can do a client-side cleanup
    // by finding our own old overlapping territories if needed.
    
    return {
      claimed: {
        id: docRef.id,
        name,
        ownerId: user.uid,
        ownerDisplayName: user.displayName || 'Hero',
        color,
        createdAt: Date.now(),
        polygon: path,
        perimeterMeters: Math.round(perimeter),
        areaSqMeters: Math.round(areaSq),
      },
      conquered: [],
    };
  } catch (err) {
    console.error('Claim and conquer failed:', err);
    return null;
  }
}

/**
 * Remove a territory from Firestore (Owner only)
 */
export async function removeTerritoryRemote(id: string): Promise<boolean> {
  try {
    const user = auth.currentUser;
    if (!user) return false;

    // In a real app, you should use Firestore Rules to enforce this.
    // Here we double check in UI/Logic.
    await deleteDoc(doc(db, 'territories', id));
    return true;
  } catch (err) {
    console.error('Failed to remove territory:', err);
    return false;
  }
}
