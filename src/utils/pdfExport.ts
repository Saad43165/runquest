import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Paths, File } from "expo-file-system/next";
import { RunRecord } from "../services/history";
import { Territory } from "../types";

interface ProfileStats {
  runs: number;
  totalDistanceMeters: number;
  totalDurationSec: number;
  longestDistanceMeters: number;
}

interface ProfileData {
  displayName: string;
  username: string;
  email?: string;
  level: number;
  progress: number;
  avatarColor: string;
  photoURL?: string | null;
}

function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${sec % 60}s`;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatPace(distM: number, durationSec: number): string {
  if (distM === 0 || durationSec === 0) return "--";
  const p = durationSec / 60 / (distM / 1000);
  const min = Math.floor(p);
  const sec = Math.round((p - min) * 60);
  return `${min}:${sec < 10 ? "0" : ""}${sec} /km`;
}

function buildTileUrl(polygon: { latitude: number; longitude: number }[]): string | null {
  if (!polygon || polygon.length < 3) return null;
  const lats = polygon.map(p => p.latitude);
  const lngs = polygon.map(p => p.longitude);
  const clat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const clng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
  const span = Math.max(Math.max(...lats) - Math.min(...lats), Math.max(...lngs) - Math.min(...lngs));
  const zoom = span < 0.001 ? 17 : span < 0.005 ? 16 : span < 0.01 ? 15 : span < 0.05 ? 14 : 13;
  const n = Math.pow(2, zoom);
  const x = Math.floor((clng + 180) / 360 * n);
  const latRad = clat * Math.PI / 180;
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
  return `https://cartodb-basemaps-a.global.ssl.fastly.net/light_all/${zoom}/${x}/${y}.png`;
}

// Convert remote image URL to base64 for PDF embedding
async function imageToBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// ─── Share PDF with correct filename ─────────────────────────────────────────
async function shareWithName(tempUri: string, fileName: string): Promise<void> {
  const name = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
  let shareUri = tempUri;
  let copiedPath: string | null = null;
  try {
    // Copy to cache dir with correct name so the share sheet shows the right filename
    const dest = new File(Paths.cache, name);
    const src = new File(tempUri);
    // expo-file-system/next copy is synchronous
    src.copy(dest);
    shareUri = dest.uri;
    copiedPath = dest.uri;
  } catch {
    // fallback: share temp file directly
  }
  try {
    await Sharing.shareAsync(shareUri, {
      mimeType: 'application/pdf',
      dialogTitle: name,
      UTI: 'com.adobe.pdf',
    });
  } finally {
    // Clean up copied file
    if (copiedPath) { try { new File(copiedPath).delete(); } catch {} }
    // Clean up original temp file
    try { new File(tempUri).delete(); } catch {}
  }
}
async function buildAvatarHtml(profile: ProfileData): Promise<string> {
  if (profile.photoURL) {
    const b64 = await imageToBase64(profile.photoURL).catch(() => null);
    if (b64) {
      return `<img src="${b64}" style="width:72px;height:72px;border-radius:20px;object-fit:cover;" alt="avatar"/>`;
    }
  }
  // Fallback: colored circle with initial
  const initial = (profile.displayName?.[0] ?? 'R').toUpperCase();
  return `<div style="width:72px;height:72px;border-radius:20px;background:${profile.avatarColor};display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:900;color:#fff;flex-shrink:0;">${initial}</div>`;
}

// ─── Build SVG route path for PDF embedding ───────────────────────────────────
function buildRouteSvg(points: { latitude: number; longitude: number }[], color = '#00C6FF'): string {
  if (!points || points.length < 2) return '';
  const lats = points.map(p => p.latitude);
  const lngs = points.map(p => p.longitude);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const latRange = maxLat - minLat || 0.001;
  const lngRange = maxLng - minLng || 0.001;
  const W = 400, H = 200, PAD = 20;
  const scaleX = (W - PAD * 2) / lngRange;
  const scaleY = (H - PAD * 2) / latRange;
  const scale = Math.min(scaleX, scaleY) * 0.88;
  const offX = PAD + ((W - PAD * 2) - lngRange * scale) / 2;
  const offY = PAD + ((H - PAD * 2) - latRange * scale) / 2;
  const toXY = (p: { latitude: number; longitude: number }) => ({
    x: offX + (p.longitude - minLng) * scale,
    y: H - offY - (p.latitude - minLat) * scale,
  });
  // Sample max 200 points for PDF
  const step = Math.max(1, Math.floor(points.length / 200));
  const sampled = points.filter((_, i) => i % step === 0);
  const d = sampled.map((p, i) => {
    const { x, y } = toXY(p);
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const start = toXY(points[0]);
  const end = toXY(points[points.length - 1]);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="background:#0D1B2A;border-radius:12px;display:block">
    <defs>
      <linearGradient id="rg" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" style="stop-color:#00C6FF"/>
        <stop offset="100%" style="stop-color:#00FF87"/>
      </linearGradient>
    </defs>
    <!-- Ghost full path -->
    <path d="${d}" fill="none" stroke="rgba(0,198,255,0.15)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <!-- Main path -->
    <path d="${d}" fill="none" stroke="url(#rg)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    <!-- Start dot -->
    <circle cx="${start.x.toFixed(1)}" cy="${start.y.toFixed(1)}" r="5" fill="#00C6FF" stroke="white" stroke-width="2"/>
    <!-- End dot -->
    <circle cx="${end.x.toFixed(1)}" cy="${end.y.toFixed(1)}" r="5" fill="#00FF87" stroke="white" stroke-width="2"/>
  </svg>`;
}

const BASE_STYLES = `
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;background:#fff;color:#1a1a1a}
.header{background:linear-gradient(135deg,#0b1026,#1a2a4a);padding:32px 40px 24px;color:white;display:flex;align-items:center;gap:20px}
.header-text h1{font-size:24px;font-weight:900;letter-spacing:-0.5px}
.header-text p{font-size:12px;opacity:0.55;margin-top:4px}
.header-meta{margin-left:auto;text-align:right}
.header-meta .level{font-size:12px;color:#00C6FF;font-weight:700}
.header-meta .date{font-size:10px;opacity:0.45;margin-top:4px}
.section{padding:24px 40px}
.section-title{font-size:9px;font-weight:800;letter-spacing:2px;color:#999;text-transform:uppercase;margin-bottom:16px;padding-bottom:8px;border-bottom:2px solid #F0F0F0}
.stats-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.stat-card{background:#F8F9FA;border-radius:12px;padding:16px;border-left:4px solid #00C6FF;position:relative;overflow:hidden}
.stat-card::before{content:'';position:absolute;top:0;right:0;width:40px;height:40px;border-radius:0 12px 0 40px;opacity:0.06}
.stat-card.blue{border-left-color:#00C6FF}.stat-card.blue::before{background:#00C6FF}
.stat-card.orange{border-left-color:#FF9F0A}.stat-card.orange::before{background:#FF9F0A}
.stat-card.gold{border-left-color:#FFD60A}.stat-card.gold::before{background:#FFD60A}
.stat-card.red{border-left-color:#FF453A}.stat-card.red::before{background:#FF453A}
.stat-card.purple{border-left-color:#BF5AF2}.stat-card.purple::before{background:#BF5AF2}
.stat-card.teal{border-left-color:#00C6A0}.stat-card.teal::before{background:#00C6A0}
.stat-card.green{border-left-color:#32D74B}.stat-card.green::before{background:#32D74B}
.stat-label{font-size:8px;font-weight:700;color:#999;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px}
.stat-value{font-size:24px;font-weight:900;color:#1a1a1a;line-height:1}
.stat-unit{font-size:11px;font-weight:600;color:#aaa;margin-left:2px}
table{width:100%;border-collapse:collapse;font-size:12px}
thead tr{background:linear-gradient(135deg,#0b1026,#1a2a4a);color:white}
thead th{padding:10px 12px;text-align:left;font-size:8px;font-weight:700;letter-spacing:1px;text-transform:uppercase}
tbody td{padding:10px 12px;border-bottom:1px solid #F5F5F5}
tbody tr:last-child td{border-bottom:none}
tbody tr:nth-child(even){background:#FAFAFA}
tbody tr:hover{background:#F0F8FF}
.loop-badge{display:inline-block;background:#00C6FF18;color:#00C6FF;font-size:8px;font-weight:800;padding:2px 6px;border-radius:4px;letter-spacing:0.5px}
.open-badge{display:inline-block;background:#00C6FF10;color:#888;font-size:8px;font-weight:700;padding:2px 6px;border-radius:4px}
.footer{background:linear-gradient(135deg,#0b1026,#1a2a4a);padding:16px 40px;display:flex;justify-content:space-between;align-items:center}
.footer-logo{font-size:16px;font-weight:900;color:white;letter-spacing:-0.5px}
.footer-logo span{color:#00C6FF}
.footer-date{font-size:10px;color:rgba(255,255,255,0.4)}
.divider{height:1px;background:linear-gradient(90deg,transparent,#E0E0E0,transparent);margin:0 40px}
.route-map{margin:0 40px 24px;border-radius:12px;overflow:hidden;border:1px solid #E8E8E8}
.hero-stat{text-align:center;padding:28px 40px;background:linear-gradient(135deg,#0b1026,#1a2a4a);color:white}
.hero-stat .big{font-size:72px;font-weight:900;color:#00C6FF;line-height:1;letter-spacing:-3px}
.hero-stat .unit{font-size:18px;color:rgba(255,255,255,0.5);margin-top:4px}
`;

// ─── Export full profile PDF ──────────────────────────────────────────────────
export async function exportProfileAsPDF(
  profile: ProfileData,
  stats: ProfileStats,
  history: RunRecord[],
  isMetric: boolean,
  territories?: Territory[],
  fileName?: string,
): Promise<void> {
  const unit = isMetric ? "km" : "mi";
  const mult = isMetric ? 1000 : 1609.34;
  const totalDist = (stats.totalDistanceMeters / mult).toFixed(2);
  const bestRun = (stats.longestDistanceMeters / mult).toFixed(2);
  const avgDist = stats.runs > 0 ? (stats.totalDistanceMeters / stats.runs / mult).toFixed(2) : "0.00";
  const totalTime = formatDuration(stats.totalDurationSec);
  const calories = Math.round(stats.totalDistanceMeters / 1000 * 9.8 * 70 / 60);

  const avatarHtml = await buildAvatarHtml(profile);

  const runRows = history.slice(0, 20).map((run) => {
    const dist = (run.distanceMeters / mult).toFixed(2);
    const dur = formatDuration(run.durationSec);
    const pace = formatPace(run.distanceMeters, run.durationSec);
    const cal = Math.round(run.distanceMeters / 1000 * 9.8 * 70 / 60);
    const isLoop = run.areaSqMeters > 500 && run.perimeterMeters > 200;
    return `<tr><td>${formatDate(run.createdAt)}</td><td><strong>${dist} ${unit}</strong></td><td>${dur}</td><td>${pace}</td><td>${cal} kcal</td><td>${isLoop ? '<span class="loop-badge">⬡ LOOP</span>' : '<span class="open-badge">→ OPEN</span>'}</td></tr>`;
  }).join("");

  const territorySection = (territories && territories.length > 0) ? `
<div class="section"><div class="section-title">My Territories (${Math.min(territories.length, 6)} shown)</div>
<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:16px">
${territories.slice(0, 6).map(t => {
  const mapUrl = buildTileUrl(t.polygon) || "";
  return `<div style="border-radius:14px;overflow:hidden;border:1px solid #E8E8E8">
    ${mapUrl ? `<img src="${mapUrl}" style="width:100%;height:120px;object-fit:cover;display:block" alt="map"/>` : `<div style="width:100%;height:120px;background:#0D1B2A"></div>`}
    <div style="padding:12px"><div style="font-size:13px;font-weight:800;margin-bottom:4px">${t.name}</div>
    <div style="font-size:11px;color:#666">${Math.round(t.areaSqMeters).toLocaleString()} m² · ${formatDate(t.createdAt)}</div></div>
  </div>`;
}).join("")}
</div></div><div class="divider"></div>` : "";

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>${BASE_STYLES}
.progress-section{background:#F8F9FA;border-radius:14px;padding:18px}
.progress-bar-bg{background:#E0E0E0;border-radius:6px;height:8px;overflow:hidden;margin:10px 0}
.progress-bar-fill{background:linear-gradient(90deg,#00C6FF,#0A84FF);height:100%;border-radius:6px}
</style></head><body>
<div class="header">${avatarHtml}<div class="header-text"><h1>${profile.displayName}</h1><p>${profile.username ? "@" + profile.username : ""}${profile.email ? " · " + profile.email : ""}</p></div><div class="header-meta"><div class="level">⚡ LEVEL ${profile.level} RUNNER</div><div class="date">Generated ${new Date().toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}</div></div></div>
<div class="section"><div class="section-title">Performance Overview</div><div class="stats-grid">
<div class="stat-card"><div class="stat-label">Total Runs</div><div class="stat-value">${stats.runs}<span class="stat-unit">runs</span></div></div>
<div class="stat-card orange"><div class="stat-label">Total Distance</div><div class="stat-value">${totalDist}<span class="stat-unit">${unit}</span></div></div>
<div class="stat-card gold"><div class="stat-label">Best Run</div><div class="stat-value">${bestRun}<span class="stat-unit">${unit}</span></div></div>
<div class="stat-card red"><div class="stat-label">Calories Burned</div><div class="stat-value">${calories.toLocaleString()}<span class="stat-unit">kcal</span></div></div>
<div class="stat-card purple"><div class="stat-label">Total Time</div><div class="stat-value" style="font-size:20px">${totalTime}</div></div>
<div class="stat-card teal"><div class="stat-label">Avg Distance</div><div class="stat-value">${avgDist}<span class="stat-unit">${unit}</span></div></div>
</div></div><div class="divider"></div>
<div class="section"><div class="section-title">Level Progress</div><div class="progress-section"><div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:14px;font-weight:800">Level ${profile.level} → Level ${profile.level + 1}</span><span style="font-size:16px;font-weight:900;color:#00C6FF">${Math.round(profile.progress * 100)}%</span></div><div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${Math.round(profile.progress * 100)}%"></div></div><div style="font-size:11px;color:#888;text-align:right">${(stats.totalDistanceMeters / mult).toFixed(1)} ${unit} completed</div></div></div><div class="divider"></div>
${territorySection}
${history.length > 0 ? `<div class="section"><div class="section-title">Run History (Last ${Math.min(history.length, 20)} Runs)</div><table><thead><tr><th>Date</th><th>Distance</th><th>Duration</th><th>Pace</th><th>Calories</th><th>Type</th></tr></thead><tbody>${runRows}</tbody></table></div>` : ""}
<div class="footer"><div class="footer-logo">Run<span>Quest</span></div><div class="footer-date">RunQuest · Made with love by Saad Ikram</div></div>
</body></html>`;

  const { uri } = await Print.printToFileAsync({ html, base64: false });
  const name = fileName || `RunQuest_${profile.displayName.replace(/\s+/g, '_')}_Report.pdf`;
  await shareWithName(uri, name);
}

// ─── Export single run PDF ────────────────────────────────────────────────────
export async function exportSingleRunAsPDF(
  run: RunRecord,
  isMetric: boolean,
  displayName: string,
  fileName?: string,
): Promise<void> {
  const unit = isMetric ? "km" : "mi";
  const mult = isMetric ? 1000 : 1609.34;
  const dist = (run.distanceMeters / mult).toFixed(2);
  const dur = formatDuration(run.durationSec);
  const pace = formatPace(run.distanceMeters, run.durationSec);
  const cal = Math.round(run.distanceMeters / 1000 * 9.8 * 70 / 60);
  const date = formatDate(run.createdAt);
  const isLoop = run.areaSqMeters > 500 && run.perimeterMeters > 200;

  // Build route SVG if GPS points available
  const routeSvg = run.points && run.points.length >= 2 ? buildRouteSvg(run.points) : '';
  const routeSection = routeSvg
    ? `<div class="route-map">${routeSvg}</div>`
    : '';

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>${BASE_STYLES}</style></head><body>
<div class="header">
  <div style="width:52px;height:52px;border-radius:14px;background:${isLoop ? 'linear-gradient(135deg,#00C6A0,#0A84FF)' : 'linear-gradient(135deg,#00C6FF,#0A84FF)'};display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0">${isLoop ? '⬡' : '🏃'}</div>
  <div class="header-text">
    <h1>${isLoop ? 'Loop Run Report' : 'Run Report'}</h1>
    <p>${date} · ${displayName}</p>
  </div>
  <div class="header-meta">
    <div class="level">${isLoop ? '⬡ TERRITORY ELIGIBLE' : '→ OPEN RUN'}</div>
    <div class="date">Generated ${new Date().toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}</div>
  </div>
</div>
<div class="hero-stat">
  <div class="big">${dist}</div>
  <div class="unit">${unit} · ${dur} · ${pace}</div>
</div>
${routeSection}
<div class="section"><div class="section-title">Run Details</div><div class="stats-grid">
<div class="stat-card blue"><div class="stat-label">Distance</div><div class="stat-value">${dist}<span class="stat-unit">${unit}</span></div></div>
<div class="stat-card orange"><div class="stat-label">Duration</div><div class="stat-value" style="font-size:18px">${dur}</div></div>
<div class="stat-card gold"><div class="stat-label">Avg Pace</div><div class="stat-value" style="font-size:18px">${pace}</div></div>
<div class="stat-card red"><div class="stat-label">Calories</div><div class="stat-value">${cal}<span class="stat-unit">kcal</span></div></div>
${isLoop ? `<div class="stat-card green"><div class="stat-label">Area</div><div class="stat-value" style="font-size:18px">${Math.round(run.areaSqMeters).toLocaleString()}<span class="stat-unit">m²</span></div></div>` : ''}
<div class="stat-card teal"><div class="stat-label">Perimeter</div><div class="stat-value" style="font-size:18px">${Math.round(run.perimeterMeters)}<span class="stat-unit">m</span></div></div>
</div></div>
<div class="footer"><div class="footer-logo">Run<span>Quest</span></div><div class="footer-date">RunQuest · ${date}</div></div>
</body></html>`;

  const { uri } = await Print.printToFileAsync({ html, base64: false });
  const name = fileName || `RunQuest_Run_${date.replace(/\s+/g, '_')}.pdf`;
  await shareWithName(uri, name);
}

// ─── Export all runs PDF ──────────────────────────────────────────────────────
export async function exportAllRunsAsPDF(
  history: RunRecord[],
  isMetric: boolean,
  displayName: string,
  fileName?: string,
): Promise<void> {
  const unit = isMetric ? "km" : "mi";
  const mult = isMetric ? 1000 : 1609.34;
  const totalDist = (history.reduce((s, r) => s + r.distanceMeters, 0) / mult).toFixed(2);
  const totalDurSec = history.reduce((s, r) => s + r.durationSec, 0);
  const totalDurStr = formatDuration(totalDurSec);
  const totalCal = Math.round(history.reduce((s, r) => s + r.distanceMeters / 1000 * 9.8 * 70 / 60, 0));
  const loops = history.filter(r => r.areaSqMeters > 500 && r.perimeterMeters > 200);
  const opens = history.filter(r => !(r.areaSqMeters > 500 && r.perimeterMeters > 200));

  const runRows = history.map((run, i) => {
    const dist = (run.distanceMeters / mult).toFixed(2);
    const dur = formatDuration(run.durationSec);
    const pace = formatPace(run.distanceMeters, run.durationSec);
    const cal = Math.round(run.distanceMeters / 1000 * 9.8 * 70 / 60);
    const isLoop = run.areaSqMeters > 500 && run.perimeterMeters > 200;
    return `<tr>
      <td>${i + 1}</td>
      <td>${formatDate(run.createdAt)}</td>
      <td><strong>${dist} ${unit}</strong></td>
      <td>${dur}</td>
      <td>${pace}</td>
      <td>${cal} kcal</td>
      <td>${isLoop ? '<span class="loop-badge">⬡ LOOP</span>' : '<span class="open-badge">→ OPEN</span>'}</td>
    </tr>`;
  }).join("");

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>${BASE_STYLES}</style></head><body>
<div class="header">
  <div style="width:52px;height:52px;border-radius:14px;background:linear-gradient(135deg,#00C6FF,#0A84FF);display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0">🏃</div>
  <div class="header-text"><h1>All Runs Report</h1><p>${displayName} · ${history.length} runs total</p></div>
  <div class="header-meta"><div class="level">⚡ COMPLETE HISTORY</div><div class="date">Generated ${new Date().toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}</div></div>
</div>
<div class="section"><div class="section-title">Summary</div><div class="stats-grid">
<div class="stat-card blue"><div class="stat-label">Total Runs</div><div class="stat-value">${history.length}</div></div>
<div class="stat-card green"><div class="stat-label">Loop Runs</div><div class="stat-value">${loops.length}<span class="stat-unit">loops</span></div></div>
<div class="stat-card teal"><div class="stat-label">Open Runs</div><div class="stat-value">${opens.length}<span class="stat-unit">runs</span></div></div>
<div class="stat-card orange"><div class="stat-label">Total Distance</div><div class="stat-value">${totalDist}<span class="stat-unit">${unit}</span></div></div>
<div class="stat-card red"><div class="stat-label">Total Calories</div><div class="stat-value">${totalCal.toLocaleString()}<span class="stat-unit">kcal</span></div></div>
<div class="stat-card purple"><div class="stat-label">Total Time</div><div class="stat-value" style="font-size:16px">${totalDurStr}</div></div>
</div></div><div class="divider"></div>
<div class="section"><div class="section-title">All Runs (${history.length} total)</div>
<table><thead><tr><th>#</th><th>Date</th><th>Distance</th><th>Duration</th><th>Pace</th><th>Calories</th><th>Type</th></tr></thead>
<tbody>${runRows}</tbody></table></div>
<div class="footer"><div class="footer-logo">Run<span>Quest</span></div><div class="footer-date">RunQuest · Made with love by Saad Ikram</div></div>
</body></html>`;

  const { uri } = await Print.printToFileAsync({ html, base64: false });
  const name = fileName || `RunQuest_AllRuns_${displayName.replace(/\s+/g, '_')}.pdf`;
  await shareWithName(uri, name);
}
