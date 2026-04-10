import { polygon as turfPolygon } from '@turf/turf';
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