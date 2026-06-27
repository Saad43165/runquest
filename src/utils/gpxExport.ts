import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { Alert } from 'react-native';
import { RunRecord } from '../services/history';

function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

function formatPace(distM: number, durationSec: number): string {
  if (distM === 0 || durationSec === 0) return '--';
  const paceMinPerKm = durationSec / 60 / (distM / 1000);
  const min = Math.floor(paceMinPerKm);
  const sec = Math.round((paceMinPerKm - min) * 60);
  return `${min}:${sec < 10 ? '0' : ''}${sec} min/km`;
}

function getZoneLabel(pace: number): string {
  if (pace === 0 || pace > 12) return 'Rest';
  if (pace > 8) return 'Zone 1 — Easy';
  if (pace > 6) return 'Zone 2 — Aerobic';
  if (pace > 5) return 'Zone 3 — Tempo';
  if (pace > 4) return 'Zone 4 — High Intensity';
  return 'Zone 5 — Max Effort';
}

export async function exportRunAsGPX(run: RunRecord): Promise<void> {
  const date = new Date(run.createdAt);
  const distKm = (run.distanceMeters / 1000).toFixed(2);
  const pace = formatPace(run.distanceMeters, run.durationSec);
  const paceNum = run.distanceMeters > 0 ? (run.durationSec / 60) / (run.distanceMeters / 1000) : 0;
  const duration = formatDuration(run.durationSec);
  const calories = Math.round(run.distanceMeters / 1000 * 9.8 * 70 / 60);
  const zone = getZoneLabel(paceNum);
  const dateStr = date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const points = Array.isArray(run.points) ? run.points : [];

  // Build static map URL if we have GPS points
  let mapHtml = '';
  if (points.length >= 2) {
    const lats = points.map(p => p.latitude);
    const lngs = points.map(p => p.longitude);
    const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
    const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
    // Use OpenStreetMap static map via staticmap.net (free, no key)
    const pathStr = points.filter((_, i) => i % Math.max(1, Math.floor(points.length / 50)) === 0)
      .map(p => `${p.latitude},${p.longitude}`).join('|');
    const mapUrl = `https://staticmap.openstreetmap.de/staticmap.php?center=${centerLat},${centerLng}&zoom=14&size=600x300&maptype=osm&path=color:0x00FF87|weight:3|${pathStr}`;
    mapHtml = `
    <div style="margin:20px 0;border-radius:12px;overflow:hidden;border:1px solid #E0E0E0;">
      <img src="${mapUrl}" style="width:100%;display:block;" onerror="this.style.display='none'" />
    </div>`;
  }

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  body { font-family: -apple-system, Arial, sans-serif; background: #fff; color: #1a1a1a; margin: 0; padding: 0; }
  .header { background: linear-gradient(135deg, #0b1026, #1a2a4a); color: white; padding: 28px 32px; }
  .header h1 { font-size: 22px; font-weight: 900; margin: 0 0 4px; }
  .header p { font-size: 13px; opacity: 0.6; margin: 0; }
  .body { padding: 24px 32px; }
  .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
  .stat { background: #F8F9FA; border-radius: 12px; padding: 16px; border-left: 3px solid #00FF87; }
  .stat.blue { border-left-color: #0A84FF; }
  .stat.red { border-left-color: #FF453A; }
  .stat.gold { border-left-color: #FFD60A; }
  .stat.purple { border-left-color: #BF5AF2; }
  .stat-label { font-size: 9px; font-weight: 700; color: #888; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 6px; }
  .stat-value { font-size: 22px; font-weight: 900; }
  .stat-unit { font-size: 11px; color: #888; margin-left: 3px; }
  .zone-badge { display: inline-block; background: #00FF8720; color: #00AA55; border-radius: 8px; padding: 6px 12px; font-size: 12px; font-weight: 700; margin-top: 12px; }
  .footer { background: #F8F9FA; padding: 16px 32px; border-top: 1px solid #EEE; display: flex; justify-content: space-between; font-size: 11px; color: #888; }
</style>
</head>
<body>
<div class="header">
  <h1>🏃 Run Summary</h1>
  <p>${dateStr}</p>
</div>
<div class="body">
  ${mapHtml}
  <div class="stats">
    <div class="stat">
      <div class="stat-label">Distance</div>
      <div class="stat-value">${distKm}<span class="stat-unit">km</span></div>
    </div>
    <div class="stat blue">
      <div class="stat-label">Duration</div>
      <div class="stat-value" style="font-size:18px">${duration}</div>
    </div>
    <div class="stat gold">
      <div class="stat-label">Pace</div>
      <div class="stat-value" style="font-size:18px">${pace}</div>
    </div>
    <div class="stat red">
      <div class="stat-label">Calories</div>
      <div class="stat-value">${calories}<span class="stat-unit">kcal</span></div>
    </div>
    <div class="stat purple">
      <div class="stat-label">GPS Points</div>
      <div class="stat-value">${points.length}<span class="stat-unit">pts</span></div>
    </div>
    <div class="stat">
      <div class="stat-label">Territory</div>
      <div class="stat-value" style="font-size:16px">${run.areaSqMeters && run.areaSqMeters > 0 ? Math.round(run.areaSqMeters) + '<span class="stat-unit">m²</span>' : 'None'}</div>
    </div>
  </div>
  <div class="zone-badge">⚡ ${zone}</div>
</div>
<div class="footer">
  <span>RunQuest — Territory Conquest</span>
  <span>${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
</div>
</body>
</html>`;

  try {
    const { uri } = await Print.printToFileAsync({ html, base64: false });
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Share Run Summary', UTI: 'com.adobe.pdf' });
    } else {
      Alert.alert('Sharing not available', 'Cannot share on this device.');
    }
  } catch (err) {
    console.warn('PDF generation failed, falling back to text:', err);
    // Fallback: share as text
    const summary = `RunQuest Run — ${dateStr}\n\nDistance: ${distKm} km\nDuration: ${duration}\nPace: ${pace}\nCalories: ${calories} kcal\nZone: ${zone}`;
    try {
      const dir = (FileSystem as any).documentDirectory as string | undefined;
      const enc = (FileSystem as any).EncodingType?.UTF8;
      const path = `${dir ?? ''}run_${run.id}.txt`;
      await FileSystem.writeAsStringAsync(path, summary, enc ? { encoding: enc } : undefined);
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) await Sharing.shareAsync(path, { mimeType: 'text/plain', dialogTitle: 'Share Run' });
    } catch (e2) {
      Alert.alert('Share Failed', 'Could not share this run. Please try again.');
    }
  }
}
