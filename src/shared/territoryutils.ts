import { polygon as turfPolygon, simplify, unkinkPolygon, union, area } from '@turf/turf';
import { LatLng } from '../types';

/**
 * Deterministically maps any string ID to a consistent HSL color.
 */
export function colorFromId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) % 360;
  }
  return `hsl(${hash}, 70%, 55%)`;
}

/**
 * Converts a LatLng path to a Turf.js polygon, auto-closing if needed.
 * Throws if the path has fewer than 3 points.
 */
export function toTurfPolygon(path: LatLng[]) {
  if (path.length < 3) {
    throw new Error(`toTurfPolygon: path must have at least 3 points, got ${path.length}`);
  }
  const coords = path.map((p) => [p.longitude, p.latitude]);
  const first = coords[0];
  const last = coords[coords.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    coords.push(first);
  }
  return turfPolygon([coords]);
}

/**
 * Cleans, simplifies, and resolves self-intersections (kinks) in a running path.
 * Returns a valid, non-self-intersecting LatLng[] closed loop.
 */
export function cleanAndSimplifyPath(path: LatLng[]): LatLng[] {
  if (path.length < 3) return path;

  try {
    const coords = path.map((p) => [p.longitude, p.latitude]);
    // Ensure closed loop
    if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) {
      coords.push([coords[0][0], coords[0][1]]);
    }

    const rawPoly = turfPolygon([coords]);

    // Simplify to remove minor GPS jitter (tolerance of 1.5 meters)
    // 0.0015 km = 1.5 meters
    const simplified = simplify(rawPoly, { tolerance: 0.0015, highQuality: true });

    // Solve self-intersections (kinks)
    const unkinked = unkinkPolygon(simplified);

    if (!unkinked || unkinked.features.length === 0) {
      const simpCoords = (simplified.geometry as any).coordinates[0];
      return simpCoords.map(([lng, lat]: any) => ({ latitude: lat, longitude: lng }));
    }

    if (unkinked.features.length === 1) {
      const singleCoords = (unkinked.features[0].geometry as any).coordinates[0];
      return singleCoords.map(([lng, lat]: any) => ({ latitude: lat, longitude: lng }));
    }

    // Merge multiple self-intersecting loops into one clean shape
    let merged = unkinked.features[0];
    for (let i = 1; i < unkinked.features.length; i++) {
      const nextUnion = union(merged as any, unkinked.features[i] as any);
      if (nextUnion) {
        merged = nextUnion as any;
      }
    }

    if (merged.geometry.type === 'Polygon') {
      const mergedCoords = (merged.geometry as any).coordinates[0];
      return mergedCoords.map(([lng, lat]: any) => ({ latitude: lat, longitude: lng }));
    } else if (merged.geometry.type === 'MultiPolygon') {
      // For MultiPolygons, choose the polygon with the largest area
      let maxArea = 0;
      let largestPolyCoords = (merged.geometry as any).coordinates[0][0];

      const features = (merged.geometry as any).coordinates;
      for (const polyCoords of features) {
        try {
          const areaVal = area(turfPolygon(polyCoords));
          if (areaVal > maxArea) {
            maxArea = areaVal;
            largestPolyCoords = polyCoords[0];
          }
        } catch {}
      }
      return largestPolyCoords.map(([lng, lat]: any) => ({ latitude: lat, longitude: lng }));
    }

    const fallbackCoords = (simplified.geometry as any).coordinates[0];
    return fallbackCoords.map(([lng, lat]: any) => ({ latitude: lat, longitude: lng }));
  } catch (e) {
    console.warn('Polygon cleaning failed, using raw coordinates:', e);
    return path;
  }
}

/**
 * Generates a unique territory ID.
 */
export function generateTerritoryId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Validates that a territory path and name are usable.
 */
export function validateTerritoryInput(name: string, path: LatLng[]): void {
  if (!name || !name.trim()) throw new Error('Territory name must not be empty.');
  if (!path || path.length < 3) throw new Error('Territory path must have at least 3 points.');
}