import AsyncStorage from '@react-native-async-storage/async-storage';
import { Territory, LatLng } from '../types';
import { pathPerimeter, polygonAreaSqMeters } from '../utils/geometry';
import { area, polygon as turfPolygon, intersect } from '@turf/turf';

const KEY = 'runquest:territories';

function colorFromId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) % 360;
  }
  return `hsl(${hash}, 70%, 55%)`;
}

function toTurfPolygon(path: LatLng[]) {
  const coords = path.map((p) => [p.longitude, p.latitude]);
  if (coords.length && (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1])) {
    coords.push(coords[0]);
  }
  return turfPolygon([coords]);
}

export async function getTerritories(): Promise<Territory[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Territory[]) : [];
  } catch (err) {
    console.warn('Failed to load local territories:', err);
    return [];
  }
}

export async function saveTerritory(name: string, ownerId: string, path: LatLng[]): Promise<Territory> {
  const perimeter = pathPerimeter(path);
  const areaSq = polygonAreaSqMeters(path);

  const territory: Territory = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    ownerId,
    color: colorFromId(ownerId),
    createdAt: Date.now(),
    polygon: path,
    perimeterMeters: Math.round(perimeter),
    areaSqMeters: Math.round(areaSq),
  };

  const list = await getTerritories();
  const updated = [territory, ...list];

  await AsyncStorage.setItem(KEY, JSON.stringify(updated));
  return territory;
}

export async function claimAndConquer(
  name: string,
  ownerId: string,
  path: LatLng[]
): Promise<{ claimed: Territory; conquered: Territory[] }> {
  const claimed = await saveTerritory(name, ownerId, path);
  const list = await getTerritories();

  const polyA = toTurfPolygon(path);
  const conquered: Territory[] = [];
  const meColor = colorFromId(ownerId);

  const updated = list.map((t) => {
    if (t.id === claimed.id) { return t; }

    const polyB = toTurfPolygon(t.polygon);
    const inter = intersect(polyA, polyB);
    if (!inter) { return t; }

    const interArea = area(inter);
    if (interArea <= 0) { return t; }

    const ratio = interArea / t.areaSqMeters;
    if (ratio >= 0.5) {
      const conqueredTerritory = { ...t, ownerId, color: meColor };
      conquered.push(conqueredTerritory);
      return conqueredTerritory;
    }
    return t;
  });

  await AsyncStorage.setItem(KEY, JSON.stringify(updated));
  return { claimed, conquered };
}

export async function removeTerritory(id: string): Promise<void> {
  try {
    const list = await getTerritories();
    const updated = list.filter((t) => t.id !== id);
    await AsyncStorage.setItem(KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('Failed to remove local territory:', err);
  }
}
