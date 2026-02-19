import { LatLng } from '../types';
import area from '@turf/area';
import { polygon as turfPolygon } from '@turf/helpers';

export function haversineDistance(a: LatLng, b: LatLng): number {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const c =
    2 *
    Math.asin(
      Math.sqrt(
        sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon
      )
    );
  return R * c;
}

export function pathPerimeter(path: LatLng[]): number {
  if (path.length < 2) {
    return 0;
  }
  let sum = 0;
  for (let i = 1; i < path.length; i++) {
    sum += haversineDistance(path[i - 1], path[i]);
  }
  sum += haversineDistance(path[path.length - 1], path[0]);
  return sum;
}

export function pathDistance(path: LatLng[]): number {
  if (path.length < 2) {
    return 0;
  }
  let sum = 0;
  for (let i = 1; i < path.length; i++) {
    sum += haversineDistance(path[i - 1], path[i]);
  }
  return sum;
}

export function isClosedLoop(
  path: LatLng[],
  closeThresholdMeters = 30,
  minPerimeterMeters = 500
): boolean {
  if (path.length < 4) {
    return false;
  }
  const start = path[0];
  const end = path[path.length - 1];
  const closed = haversineDistance(start, end) <= closeThresholdMeters;
  if (!closed) {
    return false;
  }
  const perimeter = pathPerimeter(path);
  return perimeter >= minPerimeterMeters;
}

export function polygonAreaSqMeters(path: LatLng[]): number {
  if (path.length < 3) {
    return 0;
  }
  const coords = path.map((p) => [p.longitude, p.latitude]);
  // Ensure polygon is closed
  if (coords.length && (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1])) {
    coords.push(coords[0]);
  }
  const poly = turfPolygon([coords]);
  return area(poly);
}
