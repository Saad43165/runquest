import { collection, addDoc, onSnapshot, query, deleteDoc, doc, serverTimestamp, orderBy, getDocs, where, limit, startAfter, QueryDocumentSnapshot, DocumentData, writeBatch, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { LatLng, Territory } from '../types';
import { pathPerimeter, polygonAreaSqMeters } from '../utils/geometry';
import { toTurfPolygon, cleanAndSimplifyPath } from '../shared/territoryutils';
import { union, difference, intersect, area, featureCollection } from '@turf/turf';
import { getUserTeam } from './teamsService';
import { NotificationService } from './notificationService';
import { getPremiumStatus } from './premiumService';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000;
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
const TWENTY_ONE_DAYS_MS = 21 * 24 * 60 * 60 * 1000;

function getExpiryDuration(): number {
  const status = getPremiumStatus();
  if (!status.isPremium) return SEVEN_DAYS_MS;
  if (status.tier === 'basic') return TEN_DAYS_MS;
  if (status.tier === 'pro') return FOURTEEN_DAYS_MS;
  if (status.tier === 'elite') return TWENTY_ONE_DAYS_MS;
  return TEN_DAYS_MS;
}

// Keep this in sync with RunScreen UI copy ("Minimum 100m² required")
const MIN_AREA_SQ_METERS = 100;

function colorFromId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) % 360;
  }
  return `hsl(${hash}, 70%, 55%)`;
}

/** Rough bounding box for ~10km radius around a point */
function boundingBox(lat: number, lng: number, radiusKm = 10) {
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.cos(lat * Math.PI / 180));
  return {
    minLat: lat - latDelta, maxLat: lat + latDelta,
    minLng: lng - lngDelta, maxLng: lng + lngDelta,
  };
}

/**
 * Subscribe to territories.
 * If globalMode=true, loads ALL territories worldwide (up to 1000).
 * Otherwise loads within ~10km of nearLocation.
 */
export async function subscribeTerritories(
  onUpdate: (territories: Territory[]) => void,
  nearLocation?: { latitude: number; longitude: number },
  globalMode = false,
): Promise<() => void> {
  try {
    let q;
    if (globalMode || !nearLocation) {
      // Global — filter expired server-side, up to 2000 territories
      q = query(
        collection(db, 'territories'),
        where('expiresAt', '>', Date.now()),
        orderBy('expiresAt', 'desc'),
        limit(2000),
      );
    } else {
      const { minLat, maxLat } = boundingBox(nearLocation.latitude, nearLocation.longitude, 10);
      q = query(
        collection(db, 'territories'),
        where('centroidLat', '>=', minLat),
        where('centroidLat', '<=', maxLat),
        orderBy('centroidLat', 'asc'),
        limit(500),
      );
    }

    return onSnapshot(q, (snap) => {
      const list: Territory[] = [];
      snap.forEach((d) => {
        const data = d.data();
        if (!globalMode && nearLocation) {
          const { minLng, maxLng } = boundingBox(nearLocation.latitude, nearLocation.longitude, 10);
          const cLng = data.centroidLng ?? data.polygon?.[0]?.longitude;
          if (cLng !== undefined && (cLng < minLng || cLng > maxLng)) return;
        }
        if (data.expiresAt && data.expiresAt < Date.now()) return;
        list.push({
          id: d.id,
          name: data.name,
          ownerId: data.ownerId,
          ownerDisplayName: data.ownerDisplayName ?? null,
          ownerPhotoURL: data.ownerPhotoURL ?? null,
          ownerUsername: data.ownerUsername ?? null,
          color: data.color,
          createdAt: data.createdAt?.toMillis() || Date.now(),
          polygon: data.polygon,
          perimeterMeters: data.perimeterMeters,
          areaSqMeters: data.areaSqMeters,
          expiresAt: data.expiresAt ?? undefined,
          history: data.history ?? [],
          teamId: data.teamId ?? undefined,
          teamColor: data.teamColor ?? undefined,
        });
      });
      onUpdate(list);
    }, (err) => {
      console.warn('Firestore subscription error:', err.code ?? err.message);
      onUpdate([]);
    });
  } catch (err) {
    console.error('Failed to subscribe to territories:', err);
    return () => {};
  }
}

async function fetchTerritoriesNearLocation(nearLocation: { latitude: number; longitude: number }): Promise<Territory[]> {
  try {
    const now = Date.now();
    const { minLat, maxLat, minLng, maxLng } = boundingBox(nearLocation.latitude, nearLocation.longitude, 10);
    const q = query(
      collection(db, 'territories'),
      where('centroidLat', '>=', minLat),
      where('centroidLat', '<=', maxLat),
      orderBy('centroidLat', 'asc'),
      limit(500),
    );

    const snap = await getDocs(q);
    const list: Territory[] = [];
    snap.forEach((d) => {
      const data = d.data();
      const cLng = data.centroidLng ?? data.polygon?.[0]?.longitude;
      if (cLng !== undefined && (cLng < minLng || cLng > maxLng)) return;
      if (data.expiresAt && data.expiresAt < now) return;
      list.push({
        id: d.id,
        name: data.name,
        ownerId: data.ownerId,
        ownerDisplayName: data.ownerDisplayName ?? null,
        ownerPhotoURL: data.ownerPhotoURL ?? null,
        ownerUsername: data.ownerUsername ?? null,
        color: data.color,
        createdAt: data.createdAt?.toMillis?.() ?? Date.now(),
        polygon: data.polygon,
        perimeterMeters: data.perimeterMeters,
        areaSqMeters: data.areaSqMeters,
        expiresAt: data.expiresAt ?? undefined,
        history: data.history ?? [],
        teamId: data.teamId ?? undefined,
        teamColor: data.teamColor ?? undefined,
      });
    });
    return list;
  } catch {
    return [];
  }
}

// ─── Geometry helpers ─────────────────────────────────────────────────────────

/** Overlap ratio of newPath over existingPolygon (0–1). */
function computeOverlapRatio(newPath: LatLng[], existingPolygon: LatLng[]): number {
  try {
    if (newPath.length < 3 || existingPolygon.length < 3) return 0;
    const polyA = toTurfPolygon(newPath);
    const polyB = toTurfPolygon(existingPolygon);
    const intersection = intersect(featureCollection([polyA, polyB])) as any;
    if (!intersection) return 0;
    const intersectionArea = area(intersection);
    const existingArea = area(polyB);
    if (existingArea === 0) return 0;
    return intersectionArea / existingArea;
  } catch {
    return 0;
  }
}

/** Returns the intersection polygon as LatLng[] (the overlapping slice). */
function computeIntersectionPolygon(newPath: LatLng[], existingPolygon: LatLng[]): LatLng[] | null {
  try {
    if (newPath.length < 3 || existingPolygon.length < 3) return null;
    const polyA = toTurfPolygon(newPath);
    const polyB = toTurfPolygon(existingPolygon);
    const intersection = intersect(featureCollection([polyA, polyB])) as any;
    if (!intersection) return null;
    if (intersection.geometry.type === 'Polygon') {
      return (intersection.geometry.coordinates[0] as number[][])
        .map(([lng, lat]) => ({ latitude: lat, longitude: lng }));
    } else if (intersection.geometry.type === 'MultiPolygon') {
      let maxArea = 0;
      let largestCoords: number[][] = [];
      const coordsList = intersection.geometry.coordinates as number[][][][];
      for (const coords of coordsList) {
        const areaVal = area({ type: 'Feature', geometry: { type: 'Polygon', coordinates: coords }, properties: {} });
        if (areaVal > maxArea) {
          maxArea = areaVal;
          largestCoords = coords[0];
        }
      }
      if (largestCoords.length >= 3) {
        return largestCoords.map(([lng, lat]) => ({ latitude: lat, longitude: lng }));
      }
    }
    return null;
  } catch {
    return null;
  }
}

/** Returns existingPolygon minus newPath (the remaining enemy slice). */
function computeDifferencePolygon(existingPolygon: LatLng[], newPath: LatLng[]): LatLng[] | null {
  try {
    if (existingPolygon.length < 3 || newPath.length < 3) return null;
    const polyA = toTurfPolygon(existingPolygon);
    const polyB = toTurfPolygon(newPath);
    const diff = difference(featureCollection([polyA, polyB])) as any;
    if (!diff) return null;
    if (diff.geometry.type === 'Polygon') {
      return (diff.geometry.coordinates[0] as number[][])
        .map(([lng, lat]) => ({ latitude: lat, longitude: lng }));
    } else if (diff.geometry.type === 'MultiPolygon') {
      let maxArea = 0;
      let largestCoords: number[][] = [];
      const coordsList = diff.geometry.coordinates as number[][][][];
      for (const coords of coordsList) {
        const areaVal = area({ type: 'Feature', geometry: { type: 'Polygon', coordinates: coords }, properties: {} });
        if (areaVal > maxArea) {
          maxArea = areaVal;
          largestCoords = coords[0];
        }
      }
      if (largestCoords.length >= 3) {
        return largestCoords.map(([lng, lat]) => ({ latitude: lat, longitude: lng }));
      }
    }
    return null;
  } catch {
    return null;
  }
}

/** Returns all resulting polygons from existingPolygon minus newPath as LatLng[][]. */
function computeDifferencePolygons(existingPolygon: LatLng[], newPath: LatLng[]): LatLng[][] {
  try {
    if (existingPolygon.length < 3 || newPath.length < 3) return [];
    const polyA = toTurfPolygon(existingPolygon);
    const polyB = toTurfPolygon(newPath);
    const diff = difference(featureCollection([polyA, polyB])) as any;
    if (!diff) return [];
    
    const results: LatLng[][] = [];
    if (diff.geometry.type === 'Polygon') {
      const coords = diff.geometry.coordinates[0] as number[][];
      if (coords.length >= 3) {
        results.push(coords.map(([lng, lat]) => ({ latitude: lat, longitude: lng })));
      }
    } else if (diff.geometry.type === 'MultiPolygon') {
      const coordsList = diff.geometry.coordinates as number[][][][];
      for (const coords of coordsList) {
        const ring = coords[0];
        if (ring.length >= 3) {
          results.push(ring.map(([lng, lat]) => ({ latitude: lat, longitude: lng })));
        }
      }
    }
    return results;
  } catch {
    return [];
  }
}

/** Returns the union of two polygons as LatLng[]. */
function computeUnionPolygon(polyA: LatLng[], polyB: LatLng[]): LatLng[] | null {
  try {
    if (polyA.length < 3 || polyB.length < 3) return null;
    const turfA = toTurfPolygon(polyA);
    const turfB = toTurfPolygon(polyB);
    const merged = union(featureCollection([turfA, turfB])) as any;
    if (!merged) return null;
    if (merged.geometry.type === 'Polygon') {
      return (merged.geometry.coordinates[0] as number[][])
        .map(([lng, lat]) => ({ latitude: lat, longitude: lng }));
    } else if (merged.geometry.type === 'MultiPolygon') {
      let maxArea = 0;
      let largestCoords: number[][] = [];
      const coordsList = merged.geometry.coordinates as number[][][][];
      for (const coords of coordsList) {
        const areaVal = area({ type: 'Feature', geometry: { type: 'Polygon', coordinates: coords }, properties: {} });
        if (areaVal > maxArea) {
          maxArea = areaVal;
          largestCoords = coords[0];
        }
      }
      if (largestCoords.length >= 3) {
        return largestCoords.map(([lng, lat]) => ({ latitude: lat, longitude: lng }));
      }
    }
    return null;
  } catch {
    return null;
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type ConquestResult = {
  claimed: Territory;
  conquered: ConqueredTerritory[];
  expanded: boolean;
  partialConquests: { id: string; ownerDisplayName: string; stolenAreaSqM: number }[];
};

export type ConqueredTerritory = {
  id: string;
  name: string;
  ownerDisplayName: string;
  areaSqMeters: number;
};

/**
 * Smart territory claim — 5 cases:
 *
 * OWN TERRITORY:
 *   A) Overlapping own territory → union-merge + renew expiry
 *   B) No overlap with own → create new territory
 *
 * ENEMY TERRITORY:
 *   C) >= 50% overlap → full conquest (enemy loses entire territory)
 *   D) Any overlap < 50% → partial conquest (carve out the slice,
 *      shrink enemy territory, attacker gains that slice)
 *   E) No overlap → no effect
 */
export async function claimAndConquerRemote(
  name: string,
  path: LatLng[],
  existingTerritories: Territory[] = [],
  forceCreateNew = false,
): Promise<ConquestResult | null> {
  try {
    const user = auth.currentUser;
    if (!user) return null;

    path = cleanAndSimplifyPath(path);
    const newAreaSq = polygonAreaSqMeters(path);
    if (newAreaSq < MIN_AREA_SQ_METERS) {
      throw new Error(`Territory too small. Run a larger loop (minimum ${MIN_AREA_SQ_METERS}m² area).`);
    }

    const color = colorFromId(user.uid);

    // ── Resolve team + profile info ──────────────────────────────────────────
    let teamId: string | undefined;
    let teamColor: string | undefined;
    let ownerUsername = user.displayName || 'Hero';
    try {
      const [userTeam, profileSnap] = await Promise.all([
        getUserTeam(user.uid),
        getDoc(doc(db, 'users', user.uid)),
      ]);
      if (userTeam) { teamId = userTeam.id; teamColor = userTeam.color; }
      if (profileSnap.exists()) {
        const pd = profileSnap.data();
        ownerUsername = pd.username || pd.displayName || user.displayName || 'Hero';
      }
    } catch { /* non-critical */ }

    const territoryColor = teamColor || color;

    // ── Classify existing territories ────────────────────────────────────────
    // If caller didn't supply territories (e.g. offline queue replay),
    // fetch a nearby slice so conquest/merge logic stays correct.
    let territoriesToCompare = existingTerritories;
    if (!territoriesToCompare || territoriesToCompare.length === 0) {
      const p0 = path?.[0];
      if (p0) {
        territoriesToCompare = await fetchTerritoriesNearLocation({ latitude: p0.latitude, longitude: p0.longitude });
      }
    }

    const ownOverlapping: Territory[] = [];
    const fullConquests: Territory[] = [];
    const partialConquests: Territory[] = [];

    for (const t of territoriesToCompare) {
      if (!t.polygon || t.polygon.length < 3) continue;
      const overlap = computeOverlapRatio(path, t.polygon);
      if (overlap === 0) continue;
      if (t.ownerId === user.uid) {
        ownOverlapping.push(t);
      } else if (overlap >= 0.5) {
        fullConquests.push(t);
      } else {
        partialConquests.push(t);
      }
    }

    const batch = writeBatch(db);
    const inheritedHistory: { ownerId: string; ownerName: string; conqueredAt: number }[] = [];
    const conqueredResult: ConqueredTerritory[] = [];
    const partialConquestResult: { id: string; ownerDisplayName: string; stolenAreaSqM: number }[] = [];

    // ── Case A: Merge own overlapping territories ────────────────────────────
    let finalPolygon: LatLng[] = path;
    let mergedTerritoryId: string | null = null;
    let mergedTerritoryName = name;

    if (ownOverlapping.length > 0) {
      // Sort by age — keep oldest as the base document
      const sorted = ownOverlapping.sort((a, b) => a.createdAt - b.createdAt);
      const base = sorted[0];
      mergedTerritoryId = base.id;
      mergedTerritoryName = base.name;

      let merged = path;
      for (const t of sorted) {
        const u = computeUnionPolygon(merged, t.polygon);
        if (u && u.length >= 3) merged = u;
        if (t.id !== base.id) batch.delete(doc(db, 'territories', t.id));
        try {
          const snap = await getDoc(doc(db, 'territories', t.id));
          if (snap.exists()) inheritedHistory.push(...(snap.data().history || []));
        } catch {}
      }
      finalPolygon = merged;
    }

    // ── Case C: Full conquest ────────────────────────────────────────────────
    for (const t of fullConquests) {
      conqueredResult.push({
        id: t.id,
        name: t.name,
        ownerDisplayName: t.ownerDisplayName ?? 'Unknown Warrior',
        areaSqMeters: t.areaSqMeters,
      });
      batch.delete(doc(db, 'territories', t.id));
      try {
        const snap = await getDoc(doc(db, 'territories', t.id));
        if (snap.exists()) {
          const cd = snap.data();
          inheritedHistory.push(...(cd.history || []));
          inheritedHistory.push({
            ownerId: t.ownerId,
            ownerName: t.ownerDisplayName || 'Unknown Warrior',
            conqueredAt: Date.now(),
          });
        }
      } catch {}
    }

    // ── Case D: Partial conquest — carve out the overlapping slice ───────────
    for (const t of partialConquests) {
      const intersectionPoly = computeIntersectionPolygon(path, t.polygon);
      if (!intersectionPoly || intersectionPoly.length < 3) continue;

      const stolenArea = polygonAreaSqMeters(intersectionPoly);
      if (stolenArea < 10) continue;

      const remainingPolys = computeDifferencePolygons(t.polygon, path);
      // Filter out pieces that are too small
      const validRemains = remainingPolys.filter(p => polygonAreaSqMeters(p) >= MIN_AREA_SQ_METERS);

      if (validRemains.length === 0) {
        // Remaining pieces are all too small — treat as full conquest
        conqueredResult.push({
          id: t.id,
          name: t.name,
          ownerDisplayName: t.ownerDisplayName ?? 'Unknown Warrior',
          areaSqMeters: t.areaSqMeters,
        });
        batch.delete(doc(db, 'territories', t.id));
        try {
          const snap = await getDoc(doc(db, 'territories', t.id));
          if (snap.exists()) {
            const cd = snap.data();
            inheritedHistory.push(...(cd.history || []));
            inheritedHistory.push({
              ownerId: t.ownerId,
              ownerName: t.ownerDisplayName || 'Unknown Warrior',
              conqueredAt: Date.now(),
            });
          }
        } catch {}
      } else {
        // Sort remaining pieces by area descending
        const sortedRemains = validRemains.sort((a, b) => polygonAreaSqMeters(b) - polygonAreaSqMeters(a));
        const largestRemaining = sortedRemains[0];

        // Update the original territory document with the largest remaining piece
        const rCentLat = largestRemaining.reduce((s, p) => s + p.latitude, 0) / largestRemaining.length;
        const rCentLng = largestRemaining.reduce((s, p) => s + p.longitude, 0) / largestRemaining.length;
        batch.update(doc(db, 'territories', t.id), {
          polygon: largestRemaining,
          areaSqMeters: Math.round(polygonAreaSqMeters(largestRemaining)),
          perimeterMeters: Math.round(pathPerimeter(largestRemaining)),
          centroidLat: rCentLat,
          centroidLng: rCentLng,
        });

        // For all other split pieces, create new territories for the enemy
        for (let idx = 1; idx < sortedRemains.length; idx++) {
          const splitPoly = sortedRemains[idx];
          const sCentLat = splitPoly.reduce((s, p) => s + p.latitude, 0) / splitPoly.length;
          const sCentLng = splitPoly.reduce((s, p) => s + p.longitude, 0) / splitPoly.length;
          
          const newDocRef = doc(collection(db, 'territories'));
          
          batch.set(newDocRef, {
            name: `${t.name} (Split)`,
            ownerId: t.ownerId,
            ownerDisplayName: t.ownerDisplayName,
            ownerPhotoURL: t.ownerPhotoURL || null,
            ownerUsername: t.ownerUsername || t.ownerDisplayName || 'Unknown Warrior',
            polygon: splitPoly,
            perimeterMeters: Math.round(pathPerimeter(splitPoly)),
            areaSqMeters: Math.round(polygonAreaSqMeters(splitPoly)),
            color: t.color,
            centroidLat: sCentLat,
            centroidLng: sCentLng,
            expiresAt: t.expiresAt || (Date.now() + getExpiryDuration()),
            history: t.history || [],
            createdAt: serverTimestamp(),
            ...(t.teamId ? { teamId: t.teamId, teamColor: t.teamColor } : {}),
          });
        }

        // Add stolen slice to attacker's final polygon
        const expanded = computeUnionPolygon(finalPolygon, intersectionPoly);
        if (expanded && expanded.length >= 3) finalPolygon = expanded;

        partialConquestResult.push({
          id: t.id,
          ownerDisplayName: t.ownerDisplayName ?? 'Unknown Warrior',
          stolenAreaSqM: Math.round(stolenArea),
        });
      }
    }

    // ── Write final territory ────────────────────────────────────────────────
    const finalArea = polygonAreaSqMeters(finalPolygon);
    const finalPerimeter = pathPerimeter(finalPolygon);
    const finalCentLat = finalPolygon.reduce((s, p) => s + p.latitude, 0) / finalPolygon.length;
    const finalCentLng = finalPolygon.reduce((s, p) => s + p.longitude, 0) / finalPolygon.length;

    const territoryData = {
      name: mergedTerritoryName,
      ownerId: user.uid,
      ownerDisplayName: user.displayName || 'Hero',
      ownerPhotoURL: user.photoURL || null,
      ownerUsername,
      polygon: finalPolygon,
      perimeterMeters: Math.round(finalPerimeter),
      areaSqMeters: Math.round(finalArea),
      color: territoryColor,
      centroidLat: finalCentLat,
      centroidLng: finalCentLng,
      expiresAt: Date.now() + getExpiryDuration(),
      history: inheritedHistory,
      ...(teamId ? { teamId, teamColor } : {}),
    };

    let finalTerritoryId: string;

    if (mergedTerritoryId) {
      // Update existing (merge/renew case — preserve createdAt)
      batch.update(doc(db, 'territories', mergedTerritoryId), territoryData);
      finalTerritoryId = mergedTerritoryId;
    } else {
      const newDocRef = doc(collection(db, 'territories'));
      batch.set(newDocRef, { ...territoryData, createdAt: serverTimestamp() });
      finalTerritoryId = newDocRef.id;
    }

    await batch.commit();

    // ── Log conquest events ──────────────────────────────────────────────────
    for (const c of conqueredResult) {
      try {
        await addDoc(collection(db, 'conquestEvents'), {
          conqueredBy: user.uid,
          conqueredByName: user.displayName || 'Hero',
          territoryId: c.id,
          territoryName: c.name,
          previousOwner: c.ownerDisplayName,
          previousOwnerId: territoriesToCompare.find(t => t.id === c.id)?.ownerId ?? '',
          areaSqMeters: c.areaSqMeters,
          isPartial: false,
          timestamp: serverTimestamp(),
        });
      } catch {}
    }
    for (const p of partialConquestResult) {
      try {
        await addDoc(collection(db, 'conquestEvents'), {
          conqueredBy: user.uid,
          conqueredByName: user.displayName || 'Hero',
          territoryId: p.id,
          territoryName: '',
          previousOwner: p.ownerDisplayName,
          previousOwnerId: territoriesToCompare.find(t => t.id === p.id)?.ownerId ?? '',
          areaSqMeters: p.stolenAreaSqM,
          isPartial: true,
          timestamp: serverTimestamp(),
        });
      } catch {}
    }

    return {
      claimed: {
        id: finalTerritoryId,
        name: mergedTerritoryName,
        ownerId: user.uid,
        ownerDisplayName: user.displayName || 'Hero',
        color: territoryColor,
        createdAt: Date.now(),
        polygon: finalPolygon,
        perimeterMeters: Math.round(finalPerimeter),
        areaSqMeters: Math.round(finalArea),
        expiresAt: Date.now() + getExpiryDuration(),
        history: inheritedHistory,
        ...(teamId ? { teamId, teamColor } : {}),
      },
      conquered: conqueredResult,
      expanded: ownOverlapping.length > 0 || partialConquestResult.length > 0,
      partialConquests: partialConquestResult,
    };
  } catch (err) {
    console.error('Claim and conquer failed:', err);
    throw err;
  }
}

/**
 * Remove a territory from Firestore (Owner only).
 */
export async function removeTerritoryRemote(id: string): Promise<boolean> {
  try {
    const user = auth.currentUser;
    if (!user) return false;
    const snap = await getDoc(doc(db, 'territories', id));
    if (!snap.exists()) return false;
    if (snap.data().ownerId !== user.uid) {
      console.warn('removeTerritoryRemote: permission denied — not owner');
      return false;
    }
    await deleteDoc(doc(db, 'territories', id));
    return true;
  } catch (err) {
    console.error('Failed to remove territory:', err);
    return false;
  }
}

const PAGE_SIZE = 50;

export async function fetchTerritoriesPaginated(
  cursor?: QueryDocumentSnapshot<DocumentData>
): Promise<{ territories: Territory[]; nextCursor: QueryDocumentSnapshot<DocumentData> | null }> {
  try {
    const q = cursor
      ? query(collection(db, 'territories'), orderBy('createdAt', 'desc'), startAfter(cursor), limit(PAGE_SIZE))
      : query(collection(db, 'territories'), orderBy('createdAt', 'desc'), limit(PAGE_SIZE));

    const snap = await getDocs(q);
    const territories: Territory[] = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        name: data.name,
        ownerId: data.ownerId,
        ownerDisplayName: data.ownerDisplayName ?? null,
        ownerPhotoURL: data.ownerPhotoURL ?? null,
        ownerUsername: data.ownerUsername ?? null,
        color: data.color,
        createdAt: data.createdAt?.toMillis() || Date.now(),
        polygon: data.polygon,
        perimeterMeters: data.perimeterMeters,
        areaSqMeters: data.areaSqMeters,
        expiresAt: data.expiresAt ?? undefined,
        history: data.history ?? [],
        teamId: data.teamId ?? undefined,
        teamColor: data.teamColor ?? undefined,
      };
    });

    const nextCursor = snap.docs.length === PAGE_SIZE ? snap.docs[snap.docs.length - 1] : null;
    return { territories, nextCursor };
  } catch (err) {
    console.error('Paginated fetch failed:', err);
    return { territories: [], nextCursor: null };
  }
}

export function subscribeToInvasionNotifications(): () => void {
  const user = auth.currentUser;
  if (!user) return () => {};
  try {
    const q = query(
      collection(db, 'conquestEvents'),
      where('previousOwnerId', '==', user.uid),
      orderBy('timestamp', 'desc'),
      limit(10),
    );
    let initialized = false;
    return onSnapshot(q, (snap) => {
      if (!initialized) { initialized = true; return; }
      snap.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          const msg = data.isPartial
            ? `${data.conqueredByName} seized ${data.areaSqMeters}m² of your territory!`
            : `Someone conquered your ${data.territoryName || 'territory'}!`;
          NotificationService.notify('⚔️ Territory invaded!', msg).catch(() => {});
        }
      });
    }, () => {});
  } catch {
    return () => {};
  }
}

export async function defendTerritoryRemote(id: string): Promise<boolean> {
  try {
    const user = auth.currentUser;
    if (!user) return false;
    const snap = await getDoc(doc(db, 'territories', id));
    if (!snap.exists()) return false;
    if (snap.data().ownerId !== user.uid) {
      console.warn('defendTerritoryRemote: permission denied — not owner');
      return false;
    }
    await updateDoc(doc(db, 'territories', id), {
      expiresAt: Date.now() + getExpiryDuration(),
      lastDefendedAt: Date.now(),
    });
    return true;
  } catch (err) {
    console.error('defendTerritoryRemote failed:', err);
    return false;
  }
}
