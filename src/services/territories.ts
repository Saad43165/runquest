import AsyncStorage from '@react-native-async-storage/async-storage';
import { Territory, LatLng } from '../types';
import { pathPerimeter, polygonAreaSqMeters } from '../utils/geometry';
import area from '@turf/area';
import { polygon as turfPolygon } from '@turf/helpers';
import { intersect } from '@turf/turf';

const KEY = 'runquest:territories';

export async function getTerritories(): Promise<Territory[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) {
      return [];
    }
    return JSON.parse(raw) as Territory[];
  } catch {
    return [];
  }
}

export async function saveTerritory(
  name: string,
  ownerId: string,
  path: LatLng[]
): Promise<Territory> {
  const perimeter = pathPerimeter(path);
  const areaSq = polygonAreaSqMeters(path);
  const territory: Territory = {
    id: `${Date.now()}`,
    name,
    ownerId,
    color: colorFromId(ownerId),
    createdAt: Date.now(),
    polygon: path,
    perimeterMeters: Math.round(perimeter),
    areaSqMeters: Math.round(areaSq)
  };
  const list = await getTerritories();
  const next = [territory, ...list];
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return territory;
}

export async function claimAndConquer(
  name: string,
  ownerId: string,
  path: LatLng[]
): Promise<{ claimed: Territory; conquered: Territory[] }> {
  const claimed = await saveTerritory(name, ownerId, path);
  const list = await getTerritories();
  const meColor = colorFromId(ownerId);
  const polyA = toTurfPolygon(path);
  const conquered: Territory[] = [];
  const updated = list.map((t) => {
    if (t.id === claimed.id) {
      return t;
    }
    const polyB = toTurfPolygon(t.polygon);
    const inter = intersect(polyA, polyB);
    if (!inter) {
      return t;
    }
    const interArea = area(inter);
    if (interArea <= 0) {
      return t;
    }
    const ratio = interArea / t.areaSqMeters;
    if (ratio >= 0.5) {
      const next = { ...t, ownerId, color: meColor };
      conquered.push(next);
      return next;
    }
    return t;
  });
  await AsyncStorage.setItem(KEY, JSON.stringify(updated));
  return { claimed, conquered };
}

function toTurfPolygon(path: LatLng[]) {
  const coords = path.map((p) => [p.longitude, p.latitude]);
  if (coords.length && (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1])) {
    coords.push(coords[0]);
  }
  return turfPolygon([coords]);
}

export async function removeTerritory(id: string): Promise<void> {
  const list = await getTerritories();
  const next = list.filter((t) => t.id !== id);
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
}

function colorFromId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) % 100000;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 55%)`;
}
