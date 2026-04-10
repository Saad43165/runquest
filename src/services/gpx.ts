import { RunRecord } from './history';

/**
 * Generates a valid GPX 1.1 file from a RunRecord.
 * Includes metadata, track name, and timestamp.
 *
 * @param rec Run record with points and metadata
 * @returns GPX XML string
 */
export function buildGPX(rec: RunRecord): string {
  if (!rec.points?.length) {
    console.warn('buildGPX: No points in run record');
    return '';
  }

  const createdDate = new Date(rec.createdAt);
  const isoTime = createdDate.toISOString();
  const friendlyName = `RunQuest - ${createdDate.toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })}`;

  // Escape special characters in name (XML safety)
  const escapeXml = (str: string) =>
    str.replace(/&/g, '&amp;')
       .replace(/</g, '&lt;')
       .replace(/>/g, '&gt;')
       .replace(/"/g, '&quot;')
       .replace(/'/g, '&apos;');

  const header = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="RunQuest" 
     xmlns="http://www.topografix.com/GPX/1/1"
     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
     xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${escapeXml(friendlyName)}</name>
    <time>${isoTime}</time>
    <desc>Run tracked with RunQuest - Distance: ${(rec.distanceMeters / 1000).toFixed(2)} km</desc>
  </metadata>
  <trk>
    <name>${escapeXml(friendlyName)}</name>
    <trkseg>`;

  const points = rec.points
    .map((p) => {
      // Only include lat/lon (GPX allows ele, time, etc. – can be extended later)
      return `      <trkpt lat="${p.latitude.toFixed(8)}" lon="${p.longitude.toFixed(8)}"></trkpt>`;
    })
    .join('\n');

  const footer = `    </trkseg>
  </trk>
</gpx>`;

  return `${header}\n${points}\n${footer}\n`;
}
