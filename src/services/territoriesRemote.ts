import { initFirebase } from '../config/firebase';
import { ensureUserId } from '../config/user';
import { getServerUrl } from '../config/serverUrl';
import { getFirestore, collection, onSnapshot, addDoc, serverTimestamp, doc, runTransaction, getDocs, query, getDoc, deleteDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { LatLng, Territory } from '../types';
import { pathPerimeter, polygonAreaSqMeters } from '../utils/geometry';
import { intersect } from '@turf/turf';
import area from '@turf/area';
import { polygon as turfPolygon } from '@turf/helpers';

function toTurfPolygon(path: LatLng[]) {
  const coords = path.map((p) => [p.longitude, p.latitude]);
  if (coords.length && (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1])) {
    coords.push(coords[0]);
  }
  return turfPolygon([coords]);
}

export async function subscribeTerritories(onUpdate: (territories: Territory[]) => void) {
  const app = initFirebase();
  if (!app) {
    const serverUrl = await getServerUrl();
    const wsUrl = serverUrl.replace('http', 'ws') + '/ws';
    const ws = new WebSocket(wsUrl);
    ws.onmessage = (ev) => {
      try {
        const payload = JSON.parse(ev.data);
        if (payload.type === 'snapshot') {
          const list = (payload.territories || []) as Territory[];
          onUpdate(list.sort((a, b) => b.createdAt - a.createdAt));
        }
      } catch {}
    };
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'subscribe' }));
    };
    return () => {
      try { ws.close(); } catch {}
    };
  }
  const db = getFirestore(app);
  const ref = collection(db, 'territories');
  return onSnapshot(ref, (snap) => {
    const list: Territory[] = [];
    snap.forEach((d) => {
      const data = d.data() as any;
      const polygon: LatLng[] = (data.polygon || []).map((p: any) => ({ latitude: p.latitude, longitude: p.longitude }));
      list.push({
        id: d.id,
        name: data.name,
        ownerId: data.ownerId,
        color: data.color,
        createdAt: data.createdAt?.toMillis?.() ?? Date.now(),
        polygon,
        perimeterMeters: data.perimeterMeters,
        areaSqMeters: data.areaSqMeters
      });
    });
    onUpdate(list.sort((a, b) => b.createdAt - a.createdAt));
  });
}

export async function claimAndConquerRemote(name: string, path: LatLng[]): Promise<{ claimed: Territory; conquered: string[] } | null> {
  const uid = await ensureUserId();
  const app = initFirebase();
  if (!app || !uid) {
    const serverUrl = await getServerUrl();
    const res = await fetch(`${serverUrl}/territories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, ownerId: uid, polygon: path })
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json;
  }
  const db = getFirestore(app);
  const ref = collection(db, 'territories');
  const perimeter = pathPerimeter(path);
  const areaSq = polygonAreaSqMeters(path);
  const color = colorFromId(uid);
  const claimedDoc = await addDoc(ref, {
    name,
    ownerId: uid,
    color,
    createdAt: serverTimestamp(),
    polygon: path,
    perimeterMeters: Math.round(perimeter),
    areaSqMeters: Math.round(areaSq)
  });

  const turfA = toTurfPolygon(path);
  const all = await getDocs(query(ref));
  const conqueredIds: string[] = [];
  await runTransaction(db, async (tx) => {
    for (const d of all.docs) {
      if (d.id === claimedDoc.id) {
        continue;
      }
      const data = d.data() as any;
      const polyB = toTurfPolygon((data.polygon || []).map((p: any) => ({ latitude: p.latitude, longitude: p.longitude })));
      const inter = intersect(turfA, polyB);
      if (!inter) {
        continue;
      }
      const interArea = area(inter);
      const ratio = interArea / (data.areaSqMeters || 1);
      if (ratio >= 0.5) {
        const tRef = doc(db, 'territories', d.id);
        tx.update(tRef, { ownerId: uid, color });
        conqueredIds.push(d.id);
      }
    }
  });
  return {
    claimed: {
      id: claimedDoc.id,
      name,
      ownerId: uid,
      color,
      createdAt: Date.now(),
      polygon: path,
      perimeterMeters: Math.round(perimeter),
      areaSqMeters: Math.round(areaSq)
    },
    conquered: conqueredIds
  };
}

export async function removeTerritoryRemote(id: string): Promise<boolean> {
  const app = initFirebase();
  if (!app) {
    const uid = await ensureUserId();
    const serverUrl = await getServerUrl();
    const res = await fetch(`${serverUrl}/territories/${id}?ownerId=${encodeURIComponent(uid)}`, { method: 'DELETE' });
    return res.ok;
  }
  const db = getFirestore(app);
  const auth = getAuth(app);
  const uid = auth.currentUser?.uid;
  if (!uid) {
    return false;
  }
  const ref = doc(db, 'territories', id);
  const current = await getDoc(ref);
  const data = current.data() as any;
  if (!data) {
    return false;
  }
  if (data.ownerId !== uid) {
    return false;
  }
  await deleteDoc(ref);
  return true;
}

function colorFromId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) % 100000;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 55%)`;
}
