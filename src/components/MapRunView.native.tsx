import React, { useRef, useEffect, memo, useState, forwardRef, useImperativeHandle } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { Region } from 'react-native-maps';
import { LatLng } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Cache MapLibre assets in AsyncStorage (avoids CDN on every load) ─────────
const CACHE_KEY_JS  = 'runquest:maplibre_js_4.7.1';
const CACHE_KEY_CSS = 'runquest:maplibre_css_4.7.1';
const CACHE_KEY_LOC = 'runquest:last_location';
const CDN_JS  = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js';
const CDN_CSS = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css';

// Default fallback location — Islamabad, Pakistan (center of the world for RunQuest users)
const DEFAULT_LAT = 33.6844;
const DEFAULT_LNG = 73.0479;

let MAPLIBRE_JS  = '';
let MAPLIBRE_CSS = '';
let assetsLoaded = false;
let loadPromise: Promise<void> | null = null;

export async function loadMapLibreAssets(): Promise<void> {
  if (assetsLoaded) return;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      // Try AsyncStorage cache first (instant, no network)
      const [cachedJs, cachedCss] = await Promise.all([
        AsyncStorage.getItem(CACHE_KEY_JS),
        AsyncStorage.getItem(CACHE_KEY_CSS),
      ]);

      if (cachedJs && cachedCss) {
        MAPLIBRE_JS  = cachedJs;
        MAPLIBRE_CSS = cachedCss;
        assetsLoaded = true;
        return;
      }

      // Not cached — fetch from CDN and store
      const [jsRes, cssRes] = await Promise.all([
        fetch(CDN_JS),
        fetch(CDN_CSS),
      ]);
      const [jsText, cssText] = await Promise.all([
        jsRes.text(),
        cssRes.text(),
      ]);

      MAPLIBRE_JS  = jsText;
      MAPLIBRE_CSS = cssText;
      assetsLoaded = true;

      // Cache for next time (fire and forget)
      AsyncStorage.setItem(CACHE_KEY_JS,  jsText).catch(() => {});
      AsyncStorage.setItem(CACHE_KEY_CSS, cssText).catch(() => {});
    } catch (e) {
      // Will fall back to CDN links in the HTML
      console.warn('MapLibre cache load failed, will use CDN:', e);
    }
  })();

  return loadPromise;
}

/** Save last known GPS location so map can pre-render at the right place next launch */
export function saveLastLocation(lat: number, lng: number): void {
  AsyncStorage.setItem(CACHE_KEY_LOC, JSON.stringify({ lat, lng })).catch(() => {});
}

/** Get last known GPS location (or default) for instant map pre-render */
export async function getLastLocation(): Promise<{ lat: number; lng: number }> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY_LOC);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { lat: DEFAULT_LAT, lng: DEFAULT_LNG };
}

// ─── Theme ────────────────────────────────────────────────────────────────────
const C = {
  green:  '#00FF87',
  accent: '#00C6FF',
  white:  '#F0F4F8',
  black:  '#080A0E',
  card:   '#141820',
  border: '#1E2530',
  red:    '#FF4B4B',
};

// ─── Props ────────────────────────────────────────────────────────────────────
type Props = {
  region: Region | null;
  path: LatLng[];
  polygons: { points: LatLng[]; color: string; ownerName?: string; ownerPhotoURL?: string | null; ownerId?: string }[];
  showPolygons?: boolean;
  showPath?: boolean;
  tileStyle?: 'default' | 'dark' | 'satellite' | '3d';
  accuracyMeters?: number | null;
  headingDeg?: number | null;
  showZoomButtons?: boolean;
  showNearbyTerritories?: boolean;
  goalCircleKm?: number | null;
  liveUsers?: { uid: string; displayName: string; photoURL: string | null; latitude: number; longitude: number; isRunning: boolean; avatarIndex?: number }[];
  showLiveUsers?: boolean;
  avatarIndex?: number;
  pathStyle?: 'solid' | 'dashed' | 'glow';
  pathColor?: string;
  items?: { id: string; type: 'gem' | 'shield' | 'boost' | 'chest'; latitude: number; longitude: number; collected: boolean }[];
};

// ─── Build MapLibre HTML (used for ALL tile styles) ──────────────────────────
function buildLeafletHTML(
  lat: number,
  lng: number,
  tileStyle: 'default' | 'dark' | 'satellite' | '3d',
  path: LatLng[],
  polygons: { points: LatLng[]; color: string; ownerName?: string; ownerPhotoURL?: string | null; ownerId?: string }[],
  showPath: boolean,
  showPolygons: boolean,
  accuracyMeters: number | null,
  headingDeg: number | null,
  showZoomButtons: boolean,
  showNearbyTerritories: boolean,
  goalCircleKm: number | null,
  liveUsers: { uid: string; displayName: string; photoURL: string | null; latitude: number; longitude: number; isRunning: boolean }[],
  showLiveUsers: boolean,
  avatarIndex: number,
  pathStyle: string,
  pathColor: string,
  items: { id: string; type: 'gem' | 'shield' | 'boost' | 'chest'; latitude: number; longitude: number; collected: boolean }[],
): string {
  const pathJSON = JSON.stringify(path.map(p => [p.latitude, p.longitude]));
  const itemsJSON = JSON.stringify(items || []);
  const polygonsJSON = JSON.stringify(
    polygons.map(p => ({
      points: p.points.map(pp => [pp.latitude, pp.longitude]),
      color: p.color,
      ownerName: p.ownerName || '',
      ownerPhotoURL: p.ownerPhotoURL || '',
      ownerId: p.ownerId || '',
    }))
  );
  const liveUsersJSON = JSON.stringify(
    liveUsers.map(u => ({
      uid: u.uid,
      displayName: u.displayName,
      photoURL: u.photoURL || '',
      latitude: u.latitude,
      longitude: u.longitude,
      isRunning: u.isRunning,
      avatarIndex: (u as any).avatarIndex ?? 0,
    }))
  );
  const heading = headingDeg ?? 0;
  const is3D = tileStyle === '3d';
  const pitch = is3D ? 55 : 0;
  const zoom = is3D ? 17 : 16;

  const MAPTILER_KEY = process.env.EXPO_PUBLIC_MAPTILER_KEY ?? '';

  // Satellite: Google satellite — standard {z}/{x}/{y}, full zoom, no key needed
  // Dark/Default: MapTiler raster
  // 3D: streets-v2-dark vector style — has building heights for real extrusions
  const tileUrl =
    tileStyle === 'satellite'
      ? 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'
      : tileStyle === 'dark'
        ? `https://api.maptiler.com/maps/dataviz-dark/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`
        : tileStyle === 'default'
          ? `https://api.maptiler.com/maps/dataviz/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`
          : `https://api.maptiler.com/maps/dataviz-dark/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`;

  // 3D: streets-v2-dark has maptiler_planet source with building render_height
  const mapStyle3D = `https://api.maptiler.com/maps/streets-v2-dark/style.json?key=${MAPTILER_KEY}`;

  const bgColor = (tileStyle === 'dark' || tileStyle === 'satellite' || tileStyle === '3d') ? '#0d1117' : '#f0f4f8';

  // Use locally bundled MapLibre if available, otherwise fall back to CDN
  const maplibreScript = assetsLoaded
    ? `<style>${MAPLIBRE_CSS}</style>\n<script>${MAPLIBRE_JS}</script>`
    : `<link href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css" rel="stylesheet">\n<script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>`;

  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
${maplibreScript}
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body,#map{width:100%;height:100%;background:${bgColor}}
  .maplibregl-ctrl-attrib,.maplibregl-ctrl-logo{display:none!important}
  .maplibregl-ctrl-bottom-left{display:none!important}
  @keyframes bounceLoot {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-8px); }
  }
  .loot-marker-container {
    animation: bounceLoot 2s infinite ease-in-out;
  }
  #zoom-btns{
    position:fixed;left:16px;bottom:420px;
    display:flex;flex-direction:column;gap:8px;z-index:9999;
  }
  #zoom-btns button{
    width:48px;height:48px;
    background-color:#0A0C10;
    border:2px solid rgba(255,255,255,0.6);
    border-radius:14px;
    color:#FFFFFF;
    font-size:28px;
    font-weight:bold;
    line-height:1;
    display:flex;
    align-items:center;
    justify-content:center;
    cursor:pointer;
    -webkit-tap-highlight-color:transparent;
    user-select:none;
    padding:0;
    margin:0;
    text-align:center;
  }
  #zoom-btns button:active{background-color:#1C1C2E;}
</style>
</head>
<body>
<div id="map"></div>
${showZoomButtons ? `<div id="zoom-btns"><button id="zi" onclick="map.zoomIn()"><span style="color:#FFF;font-size:28px;font-weight:bold;line-height:1;">+</span></button><button id="zo" onclick="map.zoomOut()"><span style="color:#FFF;font-size:32px;font-weight:bold;line-height:1;">&#8722;</span></button></div>` : ''}
<script>
var map = new maplibregl.Map({
  container: 'map',
  style: ${is3D
    ? `'${mapStyle3D}'`
    : `{
    version: 8,
    sources: {
      tiles: {
        type: 'raster',
        tiles: ['${tileUrl}'],
        tileSize: 256,
        maxzoom: 19,
        attribution: '© MapTiler © OpenStreetMap contributors'
      }
    },
    layers: [{ id: 'tiles', type: 'raster', source: 'tiles' }]
  }`},
  center: [${lng}, ${lat}],
  zoom: ${zoom},
  pitch: ${pitch},
  bearing: 0,
  antialias: true
});

// For 3D vector style — add building extrusions after style loads
${is3D ? `
map.on('load', function() {
  // Set dramatic pitch for 3D effect
  map.easeTo({ pitch: 60, zoom: 17, duration: 800 });

  // Add 3D building extrusions — streets-v2-dark uses maptiler_planet source
  try {
    var layers = map.getStyle().layers;
    var labelLayerId = null;
    for (var i = 0; i < layers.length; i++) {
      if (layers[i].type === 'symbol' && layers[i].layout && layers[i].layout['text-field']) {
        labelLayerId = layers[i].id;
        break;
      }
    }
    map.addLayer({
      id: '3d-buildings',
      source: 'maptiler_planet',
      'source-layer': 'building',
      type: 'fill-extrusion',
      minzoom: 14,
      paint: {
        'fill-extrusion-color': [
          'interpolate', ['linear'], ['zoom'],
          14, '#1e2d42',
          16, '#243550',
          18, '#2e4060'
        ],
        'fill-extrusion-height': [
          'interpolate', ['linear'], ['zoom'],
          14, 0,
          14.05, ['get', 'render_height']
        ],
        'fill-extrusion-base': [
          'interpolate', ['linear'], ['zoom'],
          14, 0,
          14.05, ['get', 'render_min_height']
        ],
        'fill-extrusion-opacity': 0.9
      }
    }, labelLayerId || undefined);
  } catch(e) { console.warn('3D buildings error:', e); }
});
` : ''}

// No native navigation control — using custom HTML zoom buttons above

// ── 16 warrior SVG personas ───────────────────────────────────────────────────
// Each is a unique character — user picks one, others see it on the map
var WARRIOR_SVGS = [
  '<svg width="48" height="64" viewBox="0 0 48 64" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="ninjaGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#1A1A2E"/><stop offset="100%" stop-color="#0A0A15"/></linearGradient></defs><rect x="14" y="16" width="20" height="28" rx="6" fill="url(#ninjaGrad)" stroke="#00FF87" stroke-width="1.5"/><circle cx="24" cy="24" r="8" fill="#111"/><rect x="17" y="21" width="14" height="4" rx="2" fill="#00FF87"/><circle cx="21" cy="23" r="1" fill="#FFF"/><circle cx="27" cy="23" r="1" fill="#FFF"/><path d="M14 28 L34 28 L30 36 L18 36 Z" fill="#00FF87" opacity="0.8"/><path d="M10 32 C12 28, 14 28, 14 32 L11 46 C11 46, 9 46, 8 42 Z" fill="#1A1A2E"/><path d="M38 32 C36 28, 34 28, 34 32 L37 46 C37 46, 39 46, 40 42 Z" fill="#1A1A2E"/><line x1="12" y1="12" x2="18" y2="20" stroke="#00FF87" stroke-width="2.5" stroke-linecap="round"/><line x1="36" y1="12" x2="30" y2="20" stroke="#00FF87" stroke-width="2.5" stroke-linecap="round"/><rect x="16" y="44" width="6" height="16" rx="2" fill="#0A0A15" stroke="#00FF87" stroke-width="1"/><rect x="26" y="44" width="6" height="16" rx="2" fill="#0A0A15" stroke="#00FF87" stroke-width="1"/></svg>',
  '<svg width="48" height="64" viewBox="0 0 48 64" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="knightGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#E2F5FA"/><stop offset="100%" stop-color="#8A9BB0"/></linearGradient></defs><rect x="14" y="16" width="20" height="28" rx="5" fill="url(#knightGrad)" stroke="#00C6FF" stroke-width="1.5"/><path d="M22 18 L26 18 L26 25 L31 25 L31 28 L17 28 L17 25 L22 25 Z" fill="#1A1A2E"/><line x1="24" y1="18" x2="24" y2="28" stroke="#00C6FF" stroke-width="1.5"/><path d="M24 16 C20 10, 28 6, 32 10 C32 10, 28 14, 24 16 Z" fill="#00C6FF"/><circle cx="12" cy="30" r="4.5" fill="#E2F5FA" stroke="#00C6FF" stroke-width="1"/><circle cx="36" cy="30" r="4.5" fill="#E2F5FA" stroke="#00C6FF" stroke-width="1"/><line x1="24" y1="32" x2="24" y2="42" stroke="#00C6FF" stroke-width="2"/><rect x="16" y="44" width="6" height="16" rx="2" fill="#8A9BB0" stroke="#00C6FF" stroke-width="1"/><rect x="26" y="44" width="6" height="16" rx="2" fill="#8A9BB0" stroke="#00C6FF" stroke-width="1"/></svg>',
  '<svg width="48" height="64" viewBox="0 0 48 64" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="mageGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#8B3FC0"/><stop offset="100%" stop-color="#3A1A7A"/></linearGradient></defs><path d="M24 12 L14 26 L14 46 L34 46 L34 26 Z" fill="url(#mageGrad)" stroke="#BF5FFF" stroke-width="1.5"/><path d="M24 16 L17 26 L31 26 Z" fill="#0D0D1A"/><circle cx="21" cy="23" r="1.5" fill="#BF5FFF"/><circle cx="27" cy="23" r="1.5" fill="#BF5FFF"/><path d="M14 28 L24 34 L34 28" fill="none" stroke="#FFD60A" stroke-width="1.5"/><line x1="38" y1="12" x2="38" y2="52" stroke="#8B5E3C" stroke-width="2" stroke-linecap="round"/><circle cx="38" cy="8" r="5" fill="#BF5FFF" opacity="0.9"/><circle cx="38" cy="8" r="2.5" fill="#FFF"/><rect x="17" y="46" width="5" height="14" rx="2" fill="#3A1A7A"/><rect x="26" y="46" width="5" height="14" rx="2" fill="#3A1A7A"/></svg>',
  '<svg width="48" height="64" viewBox="0 0 48 64" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="scoutGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#2D5A27"/><stop offset="100%" stop-color="#142B11"/></linearGradient></defs><path d="M24 14 C15 14, 14 22, 14 26 L14 44 L34 44 L34 26 C34 22, 33 14, 24 14 Z" fill="url(#scoutGrad)" stroke="#32D74B" stroke-width="1.5"/><rect x="17" y="20" width="14" height="6" rx="3" fill="#111" stroke="#32D74B" stroke-width="1"/><circle cx="21" cy="23" r="1.5" fill="#32D74B"/><circle cx="27" cy="23" r="1.5" fill="#32D74B"/><path d="M14 28 L24 24 L34 28" fill="none" stroke="#32D74B" stroke-width="1.5"/><rect x="9" y="16" width="4" height="12" rx="1" fill="#FF9F0A" transform="rotate(-20,9,16)"/><rect x="16" y="44" width="6" height="16" rx="2" fill="#142B11" stroke="#32D74B" stroke-width="1"/><rect x="26" y="44" width="6" height="16" rx="2" fill="#142B11" stroke="#32D74B" stroke-width="1"/></svg>',
  '<svg width="48" height="64" viewBox="0 0 48 64" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="bersGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#FF3B30"/><stop offset="100%" stop-color="#800A0A"/></linearGradient></defs><rect x="14" y="18" width="20" height="26" rx="4" fill="url(#bersGrad)" stroke="#FF453A" stroke-width="1.5"/><path d="M14 20 Q8 12, 10 6 Q14 12, 15 20 Z" fill="#FFE066"/><path d="M34 20 Q40 12, 38 6 Q34 12, 33 20 Z" fill="#FFE066"/><polygon points="18,25 23,25 21,28" fill="#FF453A"/><polygon points="30,25 25,25 27,28" fill="#FF453A"/><line x1="20" y1="32" x2="28" y2="32" stroke="#FF453A" stroke-width="1.5"/><line x1="22" y1="30" x2="22" y2="34" stroke="#FF453A" stroke-width="1"/><line x1="26" y1="30" x2="26" y2="34" stroke="#FF453A" stroke-width="1"/><polygon points="10,28 6,24 12,32" fill="#FF453A"/><polygon points="38,28 42,24 36,32" fill="#FF453A"/><rect x="16" y="44" width="6" height="16" rx="2" fill="#800A0A" stroke="#FF453A" stroke-width="1"/><rect x="26" y="44" width="6" height="16" rx="2" fill="#800A0A" stroke="#FF453A" stroke-width="1"/></svg>',
  '<svg width="48" height="64" viewBox="0 0 48 64" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="cyberGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#00C6FF"/><stop offset="100%" stop-color="#0A1828"/></linearGradient></defs><rect x="14" y="16" width="20" height="28" rx="6" fill="url(#cyberGrad)" stroke="#00C6FF" stroke-width="1.5"/><rect x="16" y="21" width="16" height="7" rx="2" fill="#00C6FF" opacity="0.8"/><line x1="17" y1="24" x2="31" y2="24" stroke="#FFF" stroke-width="1.5"/><line x1="14" y1="22" x2="10" y2="16" stroke="#00C6FF" stroke-width="2"/><line x1="34" y1="22" x2="38" y2="16" stroke="#00C6FF" stroke-width="2"/><circle cx="24" cy="35" r="3" fill="none" stroke="#00C6FF" stroke-width="1.5"/><rect x="16" y="44" width="6" height="16" rx="2" fill="#0A1828" stroke="#00C6FF" stroke-width="1"/><rect x="26" y="44" width="6" height="16" rx="2" fill="#0A1828" stroke="#00C6FF" stroke-width="1"/></svg>',
  '<svg width="48" height="64" viewBox="0 0 48 64" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="pirateGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#FFD60A"/><stop offset="100%" stop-color="#3A2D00"/></linearGradient></defs><rect x="14" y="18" width="20" height="26" rx="4" fill="#1C1C1C" stroke="#FFD60A" stroke-width="1.5"/><circle cx="24" cy="24" r="8" fill="#F3D1B4"/><line x1="16" y1="20" x2="32" y2="26" stroke="#000" stroke-width="2.5"/><circle cx="22" cy="23" r="3.5" fill="#000"/><circle cx="27" cy="23" r="1.5" fill="#FFD60A"/><path d="M10 18 Q24 8, 38 18 Z" fill="#000" stroke="#FFD60A" stroke-width="1.5"/><circle cx="24" cy="14" r="2.5" fill="#FFD60A"/><rect x="21" y="34" width="6" height="4" fill="#FFD60A"/><path d="M10 32 Q6 36, 10 40" fill="none" stroke="#C0C0C0" stroke-width="2.5" stroke-linecap="round"/><rect x="16" y="44" width="6" height="16" rx="2" fill="#1C1C1C" stroke="#FFD60A" stroke-width="1"/><line x1="29" y1="44" x2="29" y2="60" stroke="#8B5E3C" stroke-width="3" stroke-linecap="round"/></svg>',
  '<svg width="48" height="64" viewBox="0 0 48 64" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="ghostGrad" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#E2F5FA"/><stop offset="100%" stop-color="#8A9BB0"/></linearGradient></defs><path d="M24 12 C14 12, 12 20, 12 28 C12 36, 14 44, 14 48 C18 46, 20 50, 24 48 C28 50, 30 46, 34 48 C34 44, 36 36, 36 28 C36 20, 34 12, 24 12 Z" fill="url(#ghostGrad)" opacity="0.85" stroke="#00C6FF" stroke-width="2"/><ellipse cx="20" cy="24" rx="2.5" ry="3.5" fill="#1C2333"/><ellipse cx="28" cy="24" rx="2.5" ry="3.5" fill="#1C2333"/><circle cx="20" cy="24" r="1" fill="#00C6FF"/><circle cx="28" cy="24" r="1" fill="#00C6FF"/><path d="M22 32 Q24 35, 26 32" stroke="#1C2333" stroke-width="1.5" fill="none"/><circle cx="10" cy="46" r="1.5" fill="#00C6FF" opacity="0.7"/><circle cx="38" cy="40" r="1" fill="#00C6FF" opacity="0.7"/></svg>',
  '<svg width="48" height="64" viewBox="0 0 48 64" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="samGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#FF6B35"/><stop offset="100%" stop-color="#1A1008"/></linearGradient></defs><rect x="14" y="16" width="20" height="28" rx="4" fill="url(#samGrad)" stroke="#FF6B35" stroke-width="1.5"/><path d="M20 16 L24 8 L28 16" fill="none" stroke="#FFD60A" stroke-width="2.5" stroke-linecap="round"/><rect x="16" y="22" width="16" height="8" rx="2" fill="#1A1008" stroke="#FF6B35" stroke-width="1"/><circle cx="20" cy="25" r="1.5" fill="#FFD60A"/><circle cx="28" cy="25" r="1.5" fill="#FFD60A"/><line x1="12" y1="26" x2="12" y2="38" stroke="#FF6B35" stroke-width="3" stroke-linecap="round"/><line x1="36" y1="26" x2="36" y2="38" stroke="#FF6B35" stroke-width="3" stroke-linecap="round"/><rect x="16" y="44" width="6" height="16" rx="2" fill="#1A1008" stroke="#FF6B35" stroke-width="1"/><rect x="26" y="44" width="6" height="16" rx="2" fill="#1A1008" stroke="#FF6B35" stroke-width="1"/></svg>',
  '<svg width="48" height="64" viewBox="0 0 48 64" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="vikGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#FFD700"/><stop offset="100%" stop-color="#4A3B00"/></linearGradient></defs><rect x="14" y="18" width="20" height="26" rx="4" fill="#333" stroke="#FFD700" stroke-width="1.5"/><path d="M14 18 Q24 10, 34 18 Z" fill="url(#vikGrad)" stroke="#FFF" stroke-width="1"/><line x1="24" y1="12" x2="24" y2="18" stroke="#FFF" stroke-width="1.5"/><path d="M14 16 Q8 10, 10 4 Q13 8, 15 16 Z" fill="#FFF"/><path d="M34 16 Q40 10, 38 4 Q35 8, 33 16 Z" fill="#FFF"/><path d="M16 26 L24 38 L32 26 Z" fill="#FF8C00"/><circle cx="20" cy="23" r="1.5" fill="#FFF"/><circle cx="28" cy="23" r="1.5" fill="#FFF"/><circle cx="38" cy="34" r="7" fill="#FFD700" stroke="#333" stroke-width="1.5"/><circle cx="38" cy="34" r="1.5" fill="#FFF"/><rect x="16" y="44" width="6" height="16" rx="2" fill="#333" stroke="#FFD700" stroke-width="1"/><rect x="26" y="44" width="6" height="16" rx="2" fill="#333" stroke="#FFD700" stroke-width="1"/></svg>',
  '<svg width="48" height="64" viewBox="0 0 48 64" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="astroGrad" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#FFFFFF"/><stop offset="100%" stop-color="#A0B0D0"/></linearGradient><linearGradient id="visorGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#00C6FF"/><stop offset="100%" stop-color="#FFD60A"/></linearGradient></defs><rect x="12" y="24" width="24" height="20" rx="6" fill="url(#astroGrad)" stroke="#A0B0D0" stroke-width="1.5"/><rect x="10" y="26" width="4" height="14" rx="1" fill="#FF3B30"/><circle cx="24" cy="16" r="10" fill="#FFF" stroke="#A0B0D0" stroke-width="1.5"/><ellipse cx="24" cy="16" rx="8" ry="6" fill="url(#visorGrad)"/><circle cx="21" cy="14" r="1.5" fill="#FFF" opacity="0.8"/><rect x="18" y="28" width="12" height="6" rx="1" fill="#1A1A3E"/><circle cx="21" cy="31" r="1" fill="#32D74B"/><circle cx="24" cy="31" r="1" fill="#FF3B30"/><rect x="16" y="44" width="6" height="16" rx="2" fill="#FFF" stroke="#A0B0D0" stroke-width="1"/><rect x="26" y="44" width="6" height="16" rx="2" fill="#FFF" stroke="#A0B0D0" stroke-width="1"/></svg>',
  '<svg width="48" height="64" viewBox="0 0 48 64" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="witchGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#6B00B0"/><stop offset="100%" stop-color="#2A0050"/></linearGradient></defs><path d="M24 16 L14 30 L14 46 L34 46 L34 30 Z" fill="url(#witchGrad)" stroke="#BF5FFF" stroke-width="1.5"/><path d="M24 2 Q18 10, 10 16 L38 16 Q30 10, 24 2 Z" fill="#1C1A27" stroke="#BF5FFF" stroke-width="1.5"/><ellipse cx="24" cy="16" rx="15" ry="3" fill="#1C1A27" stroke="#BF5FFF" stroke-width="1.5"/><circle cx="24" cy="22" r="6" fill="#FFDBB5"/><circle cx="22" cy="21" r="1" fill="#1C1A27"/><circle cx="26" cy="21" r="1" fill="#1C1A27"/><path d="M22 25 Q24 27, 26 25" stroke="#1C1A27" stroke-width="1" fill="none"/><rect x="6" y="28" width="6" height="10" rx="2" fill="#BF5FFF" stroke="#FFF" stroke-width="1"/><circle cx="9" cy="26" r="2" fill="#FFF"/><rect x="17" y="46" width="5" height="14" rx="2" fill="#2A0050"/><rect x="26" y="46" width="5" height="14" rx="2" fill="#2A0050"/></svg>',
  '<svg width="48" height="64" viewBox="0 0 48 64" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="archGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#1A4A1A"/><stop offset="100%" stop-color="#0A2A0A"/></linearGradient></defs><rect x="14" y="18" width="20" height="26" rx="4" fill="url(#archGrad)" stroke="#32D74B" stroke-width="1.5"/><path d="M24 12 C16 12, 15 18, 15 22 C15 28, 33 28, 33 22 C33 18, 32 12, 24 12 Z" fill="#1A4A1A" stroke="#32D74B" stroke-width="1"/><circle cx="24" cy="21" r="6" fill="#E8C49A"/><rect x="18" y="20" width="12" height="4" rx="1.5" fill="#1A4A1A"/><circle cx="21" cy="22" r="1" fill="#32D74B"/><circle cx="27" cy="22" r="1" fill="#32D74B"/><path d="M40 8 Q46 22, 40 36" fill="none" stroke="#FF9F0A" stroke-width="2.5" stroke-linecap="round"/><line x1="40" y1="8" x2="40" y2="36" stroke="#FFF" stroke-width="1" opacity="0.6"/><rect x="16" y="44" width="6" height="16" rx="2" fill="#0A2A0A" stroke="#32D74B" stroke-width="1"/><rect x="26" y="44" width="6" height="16" rx="2" fill="#0A2A0A" stroke="#32D74B" stroke-width="1"/></svg>',
  '<svg width="48" height="64" viewBox="0 0 48 64" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="alcGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#FF9F0A"/><stop offset="100%" stop-color="#5C3A00"/></linearGradient></defs><rect x="14" y="18" width="20" height="26" rx="4" fill="url(#alcGrad)" stroke="#FF9F0A" stroke-width="1.5"/><path d="M24 12 C16 12, 15 18, 15 22 C15 28, 33 28, 33 22 C33 18, 32 12, 24 12 Z" fill="#5C3A00" stroke="#FF9F0A" stroke-width="1"/><circle cx="24" cy="21" r="6" fill="#111"/><circle cx="21" cy="20" r="2.5" fill="none" stroke="#FF9F0A" stroke-width="1.5"/><circle cx="27" cy="20" r="2.5" fill="none" stroke="#FF9F0A" stroke-width="1.5"/><path d="M23 23 L25 23 L24 26 Z" fill="#FF9F0A"/><polygon points="6,34 12,34 9,28" fill="#32D74B" stroke="#FFF" stroke-width="1"/><circle cx="9" cy="35" r="3.5" fill="#32D74B" opacity="0.9"/><rect x="16" y="44" width="6" height="16" rx="2" fill="#5C3A00" stroke="#FF9F0A" stroke-width="1"/><rect x="26" y="44" width="6" height="16" rx="2" fill="#5C3A00" stroke="#FF9F0A" stroke-width="1"/></svg>',
  '<svg width="48" height="64" viewBox="0 0 48 64" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="palGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#FFD60A"/><stop offset="100%" stop-color="#8B6500"/></linearGradient></defs><rect x="14" y="18" width="20" height="26" rx="4" fill="url(#palGrad)" stroke="#FFF" stroke-width="2"/><path d="M21 26 L27 26 L24 32 Z" fill="#FFF"/><circle cx="24" cy="13" r="10" fill="none" stroke="#FFD60A" stroke-width="2.5" opacity="0.75"/><path d="M14 18 Q24 10, 34 18 Z" fill="#FFF" stroke="#FFD60A" stroke-width="1.5"/><path d="M22 18 L26 18 L26 25 L18 25 L18 27 L30 27 L30 25 L26 25 Z" fill="#FFD60A"/><rect x="16" y="44" width="6" height="16" rx="2" fill="#8B6500" stroke="#FFD60A" stroke-width="1"/><rect x="26" y="44" width="6" height="16" rx="2" fill="#8B6500" stroke="#FFD60A" stroke-width="1"/></svg>',
  '<svg width="48" height="64" viewBox="0 0 48 64" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="rogGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#1F1F2E"/><stop offset="100%" stop-color="#0A0A0F"/></linearGradient></defs><rect x="14" y="18" width="20" height="26" rx="4" fill="url(#rogGrad)" stroke="#888899" stroke-width="1.5"/><path d="M24 12 C16 12, 14 18, 14 22 L14 26 C14 26, 17 28, 24 28 C31 28, 34 26, 34 26 L34 22 C34 18, 32 12, 24 12 Z" fill="#1F1F2E" stroke="#888899" stroke-width="1"/><circle cx="20" cy="22" r="1.5" fill="#BF5FFF"/><circle cx="28" cy="22" r="1.5" fill="#BF5FFF"/><line x1="10" y1="28" x2="8" y2="40" stroke="#BF5FFF" stroke-width="2.5" stroke-linecap="round"/><line x1="38" y1="28" x2="40" y2="40" stroke="#BF5FFF" stroke-width="2.5" stroke-linecap="round"/><rect x="16" y="44" width="6" height="16" rx="2" fill="#0A0A0F" stroke="#888899" stroke-width="1"/><rect x="26" y="44" width="6" height="16" rx="2" fill="#0A0A0F" stroke="#888899" stroke-width="1"/></svg>',
];

var PATH_COLORS = { green: '#00FF87', blue: '#00C6FF', orange: '#FF9F0A', purple: '#BF5FFF', red: '#FF453A', white: '#FFFFFF' };
var currentPathColor = '${pathColor}';
var currentPathStyle = '${pathStyle}';
var currentAvatarIndex = ${avatarIndex};

// ── Marker Interpolation (for smooth Snapchat-map movements) ───────────────
function animateMarker(marker, endCoords, duration) {
  if (!marker || !endCoords || isNaN(endCoords[0]) || isNaN(endCoords[1])) {
    return;
  }
  duration = duration || 1200;
  var start = null;
  var startCoords = marker.getLngLat();
  if (!startCoords) {
    marker.setLngLat(endCoords);
    return;
  }
  var startLng = startCoords.lng;
  var startLat = startCoords.lat;
  var endLng = endCoords[0];
  var endLat = endCoords[1];

  if (isNaN(startLng) || isNaN(startLat)) {
    marker.setLngLat(endCoords);
    return;
  }

  // If distance is very small (no real change), just set it
  if (Math.abs(startLng - endLng) < 0.000001 && Math.abs(startLat - endLat) < 0.000001) {
    marker.setLngLat(endCoords);
    return;
  }

  function step(timestamp) {
    if (!start) start = timestamp;
    var progress = (timestamp - start) / duration;
    if (progress > 1) progress = 1;

    // Smooth easeInOutQuad easing function
    var t = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;

    var curLng = startLng + (endLng - startLng) * t;
    var curLat = startLat + (endLat - startLat) * t;

    if (!isNaN(curLng) && !isNaN(curLat)) {
      marker.setLngLat([curLng, curLat]);
    }

    if (progress < 1) {
      marker._animationFrameId = requestAnimationFrame(step);
    }
  }

  if (marker._animationFrameId) {
    cancelAnimationFrame(marker._animationFrameId);
  }
  marker._animationFrameId = requestAnimationFrame(step);
}

// ── Self marker — uses selected warrior SVG ───────────────────────────────────
var selfSvg = WARRIOR_SVGS[currentAvatarIndex % WARRIOR_SVGS.length];
var el = document.createElement('div');
el.style.cssText = 'display:flex;flex-direction:column;align-items:center;';
el.innerHTML = [
  '<div style="position:relative;width:48px;height:48px;">',
  // Pulse ring
  '<svg style="position:absolute;top:-6px;left:-6px;" width="60" height="60" viewBox="0 0 60 60">',
  '<circle cx="30" cy="30" r="24" fill="none" stroke="#00FF87" stroke-width="2" opacity="0.6">',
  '<animate attributeName="r" values="20;30;20" dur="1.8s" repeatCount="indefinite"/>',
  '<animate attributeName="opacity" values="0.6;0;0.6" dur="1.8s" repeatCount="indefinite"/>',
  '</circle></svg>',
  // Warrior avatar
  selfSvg,
  '</div>',
  // YOU badge
  '<div style="background:#00FF87;color:#000;font-size:8px;font-weight:900;padding:2px 7px;border-radius:6px;margin-top:2px;font-family:Arial,sans-serif;letter-spacing:0.5px;box-shadow:0 2px 6px rgba(0,255,135,0.4);">YOU</div>'
].join('');

var initLng = parseFloat("${lng}");
var initLat = parseFloat("${lat}");
var userMarker = null;
if (!isNaN(initLng) && !isNaN(initLat) && initLng !== 0 && initLat !== 0) {
  userMarker = new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([initLng, initLat]).addTo(map);
}

// ── Path & polygons ───────────────────────────────────────────────────────────
var pathCoords = ${pathJSON};
var polygonsData = ${polygonsJSON};
var liveUsersData = ${liveUsersJSON};
var itemsData = ${itemsJSON};
var showLiveUsersFlag = ${showLiveUsers};
var pathAdded = false;
var addedPolyIds = [];
var labelMarkers = [];
var liveUserMarkers = {};
var lootMarkers = {};
var showNearbyTerritories = ${showNearbyTerritories};

function removeLootMarkers() {
  Object.values(lootMarkers).forEach(function(m) { try { m.remove(); } catch(e) {} });
  lootMarkers = {};
}

function drawItems() {
  var activeIds = {};
  var itemSVGs = {
    gem: '<svg width="36" height="36" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="gemGradNative" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#00F0FF"/><stop offset="100%" stop-color="#7000FF"/></linearGradient><filter id="glowNative1"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><polygon points="32,6 54,22 44,58 20,58 10,22" fill="url(#gemGradNative)" stroke="#FFF" stroke-width="2.5" filter="url(#glowNative1)"/><polygon points="32,6 32,58" stroke="rgba(255,255,255,0.4)" stroke-width="1.5"/><polygon points="10,22 54,22" stroke="rgba(255,255,255,0.4)" stroke-width="1.5"/></svg>',
    shield: '<svg width="36" height="36" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="shieldGradNative" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#00FF87"/><stop offset="100%" stop-color="#60EFFF"/></linearGradient><filter id="glowNative2"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><path d="M32 6 C42 6, 52 12, 54 24 C54 42, 32 58, 32 58 C32 58, 10 42, 10 24 C12 12, 22 6, 32 6 Z" fill="url(#shieldGradNative)" stroke="#FFF" stroke-width="2.5" filter="url(#glowNative2)"/><path d="M32 14 C38 14, 44 18, 45 26 C45 38, 32 48, 32 48 C32 48, 19 38, 19 26 C20 18, 26 14, 32 14 Z" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="1.5" stroke-dasharray="2,2"/></svg>',
    boost: '<svg width="36" height="36" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="boostGradNative" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#FF9F0A"/><stop offset="100%" stop-color="#FF375F"/></linearGradient><filter id="glowNative3"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><path d="M38 4 L14 34 L30 34 L22 60 L50 26 L32 26 Z" fill="url(#boostGradNative)" stroke="#FFF" stroke-width="2.5" filter="url(#glowNative3)"/></svg>',
    chest: '<svg width="36" height="36" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="chestGradNative" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#FFD60A"/><stop offset="100%" stop-color="#FF9F0A"/></linearGradient><filter id="glowNative4"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><rect x="8" y="24" width="48" height="32" rx="6" fill="url(#chestGradNative)" stroke="#FFF" stroke-width="2.5" filter="url(#glowNative4)"/><rect x="6" y="12" width="52" height="12" rx="3" fill="#FFE066" stroke="#FFF" stroke-width="2.5" filter="url(#glowNative4)"/><circle cx="32" cy="28" r="2.5" fill="#FFD60A"/></svg>'
  };
  itemsData.forEach(function(item) {
    if (item.collected) {
      if (lootMarkers[item.id]) {
        try { lootMarkers[item.id].remove(); } catch(e) {}
        delete lootMarkers[item.id];
      }
      return;
    }
    activeIds[item.id] = true;
    if (lootMarkers[item.id]) {
      return;
    }
    var el = document.createElement('div');
    el.className = 'loot-marker-container';
    el.style.cssText = 'width:36px;height:36px;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 4px 8px rgba(0,0,0,0.5));cursor:pointer;';
    el.innerHTML = itemSVGs[item.type] || '❓';
    var marker = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([item.longitude, item.latitude]).addTo(map);
    lootMarkers[item.id] = marker;
  });
  
  // Remove items that are no longer in itemsData
  Object.keys(lootMarkers).forEach(function(id) {
    if (!activeIds[id]) {
      try { lootMarkers[id].remove(); } catch(e) {}
      delete lootMarkers[id];
    }
  });
}

function getAvatarUrl(ownerId, photoURL) {
  if (photoURL && photoURL.length > 0) return photoURL;
  // Each user gets a unique style based on their uid hash
  var styles = ['adventurer','avataaars','big-ears','bottts','croodles','fun-emoji','lorelei','micah','miniavs','pixel-art'];
  var h = 0;
  for (var i = 0; i < ownerId.length; i++) h = (h * 31 + ownerId.charCodeAt(i)) & 0xffffffff;
  return 'https://api.dicebear.com/7.x/' + styles[Math.abs(h) % styles.length] + '/svg?seed=' + encodeURIComponent(ownerId);
}

// Deterministic color from uid — same as server-side colorFromId
function colorFromUid(uid) {
  var hash = 0;
  for (var i = 0; i < uid.length; i++) hash = (hash * 31 + uid.charCodeAt(i)) % 360;
  return 'hsl(' + hash + ',80%,60%)';
}

var renderedPolyIds = {};
var initialLoadDone = false;

function triggerParticleBurst(lng, lat, color) {
  var pix = map.project([lng, lat]);
  var burstContainer = document.createElement('div');
  burstContainer.style.cssText = 'position:absolute;left:' + pix.x + 'px;top:' + pix.y + 'px;width:0;height:0;z-index:99999;pointer-events:none;';
  document.body.appendChild(burstContainer);

  var particleCount = 24;
  for (var i = 0; i < particleCount; i++) {
    var p = document.createElement('div');
    var angle = Math.random() * Math.PI * 2;
    var distance = 30 + Math.random() * 80;
    var size = 4 + Math.random() * 6;
    var duration = 0.6 + Math.random() * 0.6;
    
    p.style.cssText = [
      'position:absolute;width:' + size + 'px;height:' + size + 'px;',
      'background:' + color + ';border-radius:50%;opacity:0.9;',
      'transform:translate(-50%,-50%);',
      'box-shadow:0 0 8px ' + color + ';',
      'transition:all ' + duration + 's cubic-bezier(0.1, 0.8, 0.3, 1);'
    ].join('');
    burstContainer.appendChild(p);

    (function(el, a, d) {
      requestAnimationFrame(function() {
        var tx = Math.cos(a) * d;
        var ty = Math.sin(a) * d;
        el.style.transform = 'translate(' + (tx - 50) + '%, ' + (ty - 50) + '%) scale(0)';
        el.style.opacity = '0';
      });
    })(p, angle, distance);
  }

  setTimeout(function() {
    try { document.body.removeChild(burstContainer); } catch(e) {}
  }, 1500);
}

function removePolygons() {
  addedPolyIds.forEach(function(id) {
    try { if (map.getLayer('fill-' + id)) map.removeLayer('fill-' + id); } catch(e) {}
    try { if (map.getLayer('line-' + id)) map.removeLayer('line-' + id); } catch(e) {}
    try { if (map.getLayer('glow-' + id)) map.removeLayer('glow-' + id); } catch(e) {}
    try { if (map.getSource(id)) map.removeSource(id); } catch(e) {}
  });
  addedPolyIds = [];
  // Remove all label markers
  labelMarkers.forEach(function(m) { try { m.remove(); } catch(e) {} });
  labelMarkers = [];
}

function drawPolygons() {
  if (!map.isStyleLoaded()) { map.once('idle', drawPolygons); return; }
  removePolygons();
  if (!${showPolygons} || polygonsData.length === 0) {
    initialLoadDone = true;
    return;
  }
  var currentPolyIds = {};

  polygonsData.forEach(function(poly, i) {
    var coords = poly.points.map(function(p) { return [p[1], p[0]]; });
    if (coords.length < 3) return;
    coords.push(coords[0]);
    
    // Stable ID based on owner and first point coordinates
    var polyId = poly.ownerId + '-' + coords[0][0].toFixed(5) + '-' + coords[0][1].toFixed(5);
    currentPolyIds[polyId] = true;
    
    var isNew = !renderedPolyIds[polyId];
    var srcId = 'poly-' + Date.now() + '-' + i;

    try {
      // Calculate Centroid
      var centLng = 0, centLat = 0;
      for (var ci = 0; ci < coords.length - 1; ci++) { centLng += coords[ci][0]; centLat += coords[ci][1]; }
      centLng /= (coords.length - 1); centLat /= (coords.length - 1);

      if (isNew && initialLoadDone) {
        // Initialize source with centroid points
        map.addSource(srcId, { type: 'geojson', data: { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[centLng, centLat], [centLng, centLat], [centLng, centLat], [centLng, centLat]]] } } });
      } else {
        map.addSource(srcId, { type: 'geojson', data: { type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] } } });
      }

      // Outer glow
      map.addLayer({ id: 'glow-' + srcId, type: 'line', source: srcId, paint: { 'line-color': poly.color, 'line-width': 10, 'line-opacity': 0.15, 'line-blur': 6 } });
      // Fill
      map.addLayer({ id: 'fill-' + srcId, type: 'fill', source: srcId, paint: { 'fill-color': poly.color, 'fill-opacity': isNew && initialLoadDone ? 0 : 0.28 } });
      // Sharp border
      map.addLayer({ id: 'line-' + srcId, type: 'line', source: srcId, paint: { 'line-color': poly.color, 'line-width': 2.5, 'line-opacity': isNew && initialLoadDone ? 0 : 1 } });
      addedPolyIds.push(srcId);

      if (isNew && initialLoadDone) {
        var startTime = null;
        var duration = 1500;
        function animateFlood(timestamp) {
          if (!startTime) startTime = timestamp;
          var progress = (timestamp - startTime) / duration;
          if (progress > 1) progress = 1;
          
          var t = 1 - Math.pow(1 - progress, 3); // easeOutCubic
          var animatedCoords = coords.map(function(c) {
            return [ centLng + (c[0] - centLng) * t, centLat + (c[1] - centLat) * t ];
          });
          
          try {
            if (map.getSource(srcId)) {
              map.getSource(srcId).setData({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [animatedCoords] } });
              map.setPaintProperty('fill-' + srcId, 'fill-opacity', 0.28 * t);
              map.setPaintProperty('line-' + srcId, 'line-opacity', 1 * t);
            }
          } catch(e) {}
          
          if (progress < 1) {
            requestAnimationFrame(animateFlood);
          }
        }
        requestAnimationFrame(animateFlood);
        triggerParticleBurst(centLng, centLat, poly.color);
      }

      // Owner name label
      if (poly.ownerName) {
        var name = poly.ownerName.length > 10 ? poly.ownerName.slice(0,9)+'\u2026' : poly.ownerName;
        var labelEl = document.createElement('div');
        labelEl.style.cssText = [
          'display:flex;align-items:center;gap:4px;',
          'background:rgba(8,10,16,0.88);',
          'border:1.5px solid ' + poly.color + ';',
          'border-left:3px solid ' + poly.color + ';',
          'border-radius:8px;',
          'padding:3px 8px 3px 6px;',
          'pointer-events:none;',
          'box-shadow:0 2px 12px rgba(0,0,0,0.7),0 0 8px ' + poly.color + '40;',
          'white-space:nowrap;',
          'backdrop-filter:blur(4px);',
        ].join('');
        labelEl.innerHTML = '<div style="width:6px;height:6px;border-radius:3px;background:' + poly.color + ';flex-shrink:0;"></div>' +
          '<span style="color:#FFFFFF;font-size:10px;font-weight:800;font-family:Arial,sans-serif;letter-spacing:0.3px;">' + name + '</span>';
        
        if (isNew && initialLoadDone) {
          labelEl.style.opacity = '0';
          labelEl.style.transform = 'scale(0.5)';
          labelEl.style.transition = 'all 0.5s ease-out 1.2s';
          setTimeout(function() {
            labelEl.style.opacity = '1';
            labelEl.style.transform = 'scale(1)';
          }, 50);
        }

        var lm = new maplibregl.Marker({ element: labelEl, anchor: 'center' }).setLngLat([centLng, centLat]).addTo(map);
        labelMarkers.push(lm);
      }
    } catch(e) {}
  });

  renderedPolyIds = currentPolyIds;
  initialLoadDone = true;
}

// ── Live user markers ─────────────────────────────────────────────────────────
function removeLiveUserMarkers() {
  Object.values(liveUserMarkers).forEach(function(m) {
    try {
      if (m._animationFrameId) cancelAnimationFrame(m._animationFrameId);
      m.remove();
    } catch(e) {}
  });
  liveUserMarkers = {};
}

function drawLiveUsers() {
  if (!showLiveUsersFlag) { removeLiveUserMarkers(); return; }
  var currentUids = {};
  liveUsersData.forEach(function(u) {
    currentUids[u.uid] = true;
    // Update position if marker already exists
    if (liveUserMarkers[u.uid]) {
      animateMarker(liveUserMarkers[u.uid], [u.longitude, u.latitude], 1500);
      return;
    }
    // Create new marker — use warrior SVG based on their stored avatarIndex
    var userColor = colorFromUid(u.uid);
    var runningColor = u.isRunning ? '#00FF87' : userColor;
    // Use their stored avatarIndex if available, otherwise fall back to uid hash
    var warriorIdx = (u.avatarIndex !== undefined && u.avatarIndex >= 0) ? (u.avatarIndex % WARRIOR_SVGS.length) : (function() {
      var h = 0; for (var ci = 0; ci < u.uid.length; ci++) h = (h * 31 + u.uid.charCodeAt(ci)) & 0xffffffff; return Math.abs(h) % WARRIOR_SVGS.length;
    })();
    var warriorSvg = WARRIOR_SVGS[warriorIdx];
    var pulseAnim = u.isRunning
      ? '<animate attributeName="r" values="22;30;22" dur="1.4s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.5;0;0.5" dur="1.4s" repeatCount="indefinite"/>'
      : '';

    var svgEl = document.createElement('div');
    svgEl.style.cssText = 'display:flex;flex-direction:column;align-items:center;cursor:pointer;';

    var svgStr = [
      '<div style="position:relative;width:48px;height:48px;">',
      // Pulse ring
      '<svg style="position:absolute;top:-8px;left:-8px;" width="64" height="64" viewBox="0 0 64 64">',
      '<circle cx="32" cy="32" r="22" fill="none" stroke="' + userColor + '" stroke-width="2.5" opacity="0.8">' + pulseAnim + '</circle>',
      '<circle cx="32" cy="32" r="26" fill="none" stroke="' + userColor + '" stroke-width="1.5" opacity="0.4"/>',
      '</svg>',
      // Warrior SVG
      warriorSvg,
      // Running badge
      u.isRunning ? '<div style="position:absolute;top:-4px;right:-4px;width:16px;height:16px;border-radius:8px;background:#00FF87;border:2px solid #0A0C10;display:flex;align-items:center;justify-content:center;font-size:7px;font-weight:900;color:#000;font-family:Arial;">▶</div>' : '',
      '</div>'
    ].join('');

    // Name badge — dark pill, always readable
    var shortName = u.displayName.length > 10 ? u.displayName.slice(0,9)+'\u2026' : u.displayName;
    var badgeStr = [
      '<div style="',
      'background:rgba(8,10,16,0.9);',
      'border:1.5px solid ' + userColor + ';',
      'border-radius:8px;',
      'padding:2px 8px;',
      'margin-top:-6px;',
      'white-space:nowrap;',
      'box-shadow:0 2px 8px rgba(0,0,0,0.8),0 0 6px ' + userColor + '50;',
      'display:flex;align-items:center;gap:4px;',
      '">',
      '<div style="width:5px;height:5px;border-radius:3px;background:' + (u.isRunning ? '#00FF87' : userColor) + ';"></div>',
      '<span style="color:#FFF;font-size:9px;font-weight:900;font-family:Arial,sans-serif;letter-spacing:0.3px;">' + shortName + '</span>',
      '</div>'
    ].join('');

    svgEl.innerHTML = svgStr + badgeStr;
    var marker = new maplibregl.Marker({ element: svgEl, anchor: 'bottom' }).setLngLat([u.longitude, u.latitude]).addTo(map);
    liveUserMarkers[u.uid] = marker;
  });
  // Remove markers for users no longer present
  Object.keys(liveUserMarkers).forEach(function(uid) {
    if (!currentUids[uid]) {
      try {
        var m = liveUserMarkers[uid];
        if (m._animationFrameId) cancelAnimationFrame(m._animationFrameId);
        m.remove();
      } catch(e) {}
      delete liveUserMarkers[uid];
    }
  });
}

function drawPath() {
  if (pathCoords.length < 2) return;
  if (!map.isStyleLoaded()) { map.once('idle', drawPath); return; }
  var coords = pathCoords.map(function(p) { return [p[1], p[0]]; });
  if (pathAdded) {
    try { map.getSource('rp').setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: coords } }); } catch(e) {}
  } else {
    try {
      map.addSource('rp', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: coords } } });
      // Shadow
      map.addLayer({ id: 'rp-shadow', type: 'line', source: 'rp', paint: { 'line-color': '#00000080', 'line-width': 8, 'line-blur': 3 } });
      // Glow layer (for glow style)
      if (currentPathStyle === 'glow') {
        map.addLayer({ id: 'rp-glow', type: 'line', source: 'rp', paint: { 'line-color': currentPathColor, 'line-width': 12, 'line-opacity': 0.3, 'line-blur': 6 } });
      }
      // Main line
      var linePaint = { 'line-color': currentPathColor, 'line-width': 4, 'line-opacity': 0.95 };
      if (currentPathStyle === 'dashed') {
        linePaint['line-dasharray'] = [8, 4];
      }
      map.addLayer({ id: 'rp-line', type: 'line', source: 'rp', paint: linePaint });
      // Animated dots on path (glow style only)
      pathAdded = true;
    } catch(e) {}
  }
}

map.on('load', function() { drawPolygons(); drawLiveUsers(); drawItems(); if (${showPath}) drawPath(); });

// ── Goal circle ───────────────────────────────────────────────────────────────
var goalCircleKm = ${goalCircleKm ?? 0};
var goalCircleAdded = false;
var startLat = ${lat}, startLng = ${lng};

function buildCircleGeoJSON(clat, clng, radiusKm, steps) {
  steps = steps || 64;
  var coords = [];
  var R = 6371;
  for (var i = 0; i <= steps; i++) {
    var angle = (i / steps) * 2 * Math.PI;
    var dLat = (radiusKm / R) * (180 / Math.PI);
    var dLng = (radiusKm / R) * (180 / Math.PI) / Math.cos(clat * Math.PI / 180);
    coords.push([clng + dLng * Math.sin(angle), clat + dLat * Math.cos(angle)]);
  }
  return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] } };
}

function drawGoalCircle(clat, clng, radiusKm) {
  if (!map.isStyleLoaded()) { map.once('idle', function() { drawGoalCircle(clat, clng, radiusKm); }); return; }
  if (radiusKm <= 0) {
    try { if (map.getLayer('goal-line')) map.removeLayer('goal-line'); } catch(e) {}
    try { if (map.getLayer('goal-dash')) map.removeLayer('goal-dash'); } catch(e) {}
    try { if (map.getSource('goal-circle')) map.removeSource('goal-circle'); } catch(e) {}
    goalCircleAdded = false;
    return;
  }
  var geoJSON = buildCircleGeoJSON(clat, clng, radiusKm, 64);
  if (goalCircleAdded) {
    try { map.getSource('goal-circle').setData(geoJSON); } catch(e) {}
  } else {
    try {
      map.addSource('goal-circle', { type: 'geojson', data: geoJSON });
      // No fill layer — keeps map fully visible inside the circle
      map.addLayer({ id: 'goal-line', type: 'line', source: 'goal-circle', paint: { 'line-color': '#00C6FF', 'line-width': 2.5, 'line-opacity': 0.85 } });
      map.addLayer({ id: 'goal-dash', type: 'line', source: 'goal-circle', paint: { 'line-color': '#FFFFFF', 'line-width': 1, 'line-opacity': 0.35, 'line-dasharray': [6, 5] } });
      goalCircleAdded = true;
    } catch(e) {}
  }
}

map.on('load', function() {
  if (goalCircleKm > 0) drawGoalCircle(startLat, startLng, goalCircleKm);
});

// ── Message handler ───────────────────────────────────────────────────────────
function handleMsg(raw) {
  try {
    var msg = JSON.parse(raw);
    if (msg.type === 'UPDATE') {
      if (!isNaN(msg.lng) && !isNaN(msg.lat) && msg.lng !== 0 && msg.lat !== 0) {
        if (!userMarker) {
          userMarker = new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([msg.lng, msg.lat]).addTo(map);
        } else {
          animateMarker(userMarker, [msg.lng, msg.lat], 1000);
        }
      }
      if (msg.recenter === true && !isNaN(msg.lng) && !isNaN(msg.lat)) map.easeTo({ center: [msg.lng, msg.lat], duration: 1200 });
      if (msg.path !== undefined) { pathCoords = msg.path; drawPath(); }
      if (msg.polygons !== undefined) { polygonsData = msg.polygons; drawPolygons(); }
      if (msg.showNearbyTerritories !== undefined) { showNearbyTerritories = msg.showNearbyTerritories; drawPolygons(); }
      if (msg.liveUsers !== undefined) { liveUsersData = msg.liveUsers; drawLiveUsers(); }
      if (msg.showLiveUsers !== undefined) { showLiveUsersFlag = msg.showLiveUsers; drawLiveUsers(); }
      if (msg.items !== undefined) { itemsData = msg.items; drawItems(); }
    } else if (msg.type === 'RECENTER') {
      map.flyTo({ center: [msg.lng, msg.lat], zoom: ${zoom}, pitch: ${pitch}, duration: 1000 });
    } else if (msg.type === 'FLY_TO') {
      map.flyTo({ center: [msg.lng, msg.lat], zoom: msg.zoom || 15, duration: 1200 });
    } else if (msg.type === 'GOAL_CIRCLE') {
      goalCircleKm = msg.radiusKm || 0;
      startLat = msg.lat; startLng = msg.lng;
      drawGoalCircle(msg.lat, msg.lng, msg.radiusKm || 0);
    } else if (msg.type === 'CHANGE_TILES') {
      var newStyle = msg.vectorStyle
        ? msg.vectorStyle
        : {
            version: 8,
            sources: { tiles: { type: 'raster', tiles: [msg.tileUrl], tileSize: 256, maxzoom: 19, attribution: '© MapTiler © OpenStreetMap contributors' } },
            layers: [{ id: 'tiles', type: 'raster', source: 'tiles' }]
          };
      map.setStyle(newStyle);
      // Set pitch for 3D mode
      if (msg.vectorStyle) {
        map.once('idle', function() {
          map.easeTo({ pitch: 60, zoom: 17, duration: 600 });
          // Add 3D building extrusions
          try {
            if (!map.getLayer('3d-buildings')) {
              var layers = map.getStyle().layers;
              var labelLayerId = null;
              for (var li = 0; li < layers.length; li++) {
                if (layers[li].type === 'symbol' && layers[li].layout && layers[li].layout['text-field']) {
                  labelLayerId = layers[li].id; break;
                }
              }
              map.addLayer({
                id: '3d-buildings',
                source: 'maptiler_planet',
                'source-layer': 'building',
                type: 'fill-extrusion',
                minzoom: 14,
                paint: {
                  'fill-extrusion-color': ['interpolate', ['linear'], ['zoom'], 14, '#1a2535', 18, '#2d3d55'],
                  'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 14, 0, 14.05, ['get', 'render_height']],
                  'fill-extrusion-base': ['interpolate', ['linear'], ['zoom'], 14, 0, 14.05, ['get', 'render_min_height']],
                  'fill-extrusion-opacity': 0.85
                }
              }, labelLayerId || undefined);
            }
          } catch(e) {}
        });
      } else {
        // Reset pitch for non-3D styles
        map.easeTo({ pitch: 0, duration: 400 });
      }
      // Wait for map to be fully idle after style change before redrawing overlays
      // 'styledata' fires too early — sources can't be added yet
      function redrawAfterStyle() {
        pathAdded = false;
        goalCircleAdded = false;
        drawPolygons();
        drawPath();
        drawLiveUsers();
        drawItems();
        if (goalCircleKm > 0) drawGoalCircle(startLat, startLng, goalCircleKm);
      }
      map.once('idle', redrawAfterStyle);
    } else if (msg.type === 'TOGGLE_ZOOM') {
      var zb = document.getElementById('zoom-btns');
      if (zb) { zb.style.display = msg.show ? 'flex' : 'none'; }
    }
  } catch(e) {}
}
document.addEventListener('message', function(e) { handleMsg(e.data); });
window.addEventListener('message', function(e) { handleMsg(e.data); });
</script>
</body>
</html>`;
}

export type MapRunViewRef = {
  flyTo: (lat: number, lng: number, zoom?: number) => void;
  recenter: (lat: number, lng: number) => void;
};

const MapRunViewInner = forwardRef<MapRunViewRef, Props>(function MapRunView({
  region,
  path,
  polygons,
  showPolygons  = true,
  showPath      = true,
  tileStyle     = 'dark',
  accuracyMeters = null,
  headingDeg    = null,
  showZoomButtons = true,
  showNearbyTerritories = true,
  goalCircleKm = null,
  liveUsers = [],
  showLiveUsers = true,
  avatarIndex = 0,
  pathStyle = 'solid',
  pathColor = '#00FF87',
  items = [],
}, ref) {
  const webRef          = useRef<WebView>(null);
  const [mapReady, setMapReady] = useState(false);
  const [webViewKey, setWebViewKey] = useState(0);
  const [localAssetsReady, setLocalAssetsReady] = useState(assetsLoaded);
  // Pre-render location — use last known or default so map starts loading immediately
  const [preRenderLoc, setPreRenderLoc] = useState<{ lat: number; lng: number } | null>(null);
  const prevRegionRef   = useRef<Region | null>(null);
  const prevHeadingRef  = useRef<number | null>(null);
  const prevTileStyle   = useRef<string>(tileStyle);
  const prevZoomButtons = useRef<boolean>(showZoomButtons);
  const prevShowNearby = useRef<boolean>(showNearbyTerritories);
  const prevGoalCircle = useRef<number | null>(null);
  const prevAvatarIndex = useRef<number>(avatarIndex);
  const prevPathStyle   = useRef<string>(pathStyle);
  const prevPathColor   = useRef<string>(pathColor);
  const htmlRef         = useRef<string>('');

  // Preload MapLibre assets from bundle on first mount
  useEffect(() => {
    // Load last known location immediately so map pre-renders at the right place
    getLastLocation().then(loc => setPreRenderLoc(loc));

    if (assetsLoaded) return;
    loadMapLibreAssets().then(() => {
      setLocalAssetsReady(true);
      // Force HTML rebuild with local assets
      htmlRef.current = '';
    });
  }, []);

  useImperativeHandle(ref, () => ({
    flyTo: (lat: number, lng: number, zoom = 15) => {
      webRef.current?.postMessage(JSON.stringify({ type: 'FLY_TO', lat, lng, zoom }));
    },
    recenter: (lat: number, lng: number) => {
      webRef.current?.postMessage(JSON.stringify({ type: 'RECENTER', lat, lng }));
    },
  }));

  // Send initial zoom visibility + tile style after map loads
  useEffect(() => {
    if (!mapReady || !webRef.current) return;
    // Apply initial zoom visibility
    if (!showZoomButtons) {
      webRef.current.postMessage(JSON.stringify({ type: 'TOGGLE_ZOOM', show: false }));
    }
    prevZoomButtons.current = showZoomButtons;
  }, [mapReady]);

  // Send zoom toggle via postMessage when showZoomButtons changes
  useEffect(() => {
    if (!mapReady || !webRef.current) return;
    if (showZoomButtons === prevZoomButtons.current) return;
    prevZoomButtons.current = showZoomButtons;
    webRef.current.postMessage(JSON.stringify({ type: 'TOGGLE_ZOOM', show: showZoomButtons }));
  }, [showZoomButtons, mapReady]);

  // Send goal circle update when goalCircleKm changes or map reloads
  useEffect(() => {
    if (!mapReady || !webRef.current) return;
    if (goalCircleKm === prevGoalCircle.current) return;
    prevGoalCircle.current = goalCircleKm;
    if (region) {
      webRef.current.postMessage(JSON.stringify({
        type: 'GOAL_CIRCLE',
        lat: region.latitude,
        lng: region.longitude,
        radiusKm: goalCircleKm ?? 0,
      }));
    }
  }, [goalCircleKm, mapReady, region]);

  // Re-send goal circle after tile style change (mapReady flips false→true on reload)
  const prevMapReady = useRef(false);
  useEffect(() => {
    if (mapReady && !prevMapReady.current && goalCircleKm && goalCircleKm > 0 && region && webRef.current) {
      // Small delay to let styledata settle
      setTimeout(() => {
        webRef.current?.postMessage(JSON.stringify({
          type: 'GOAL_CIRCLE',
          lat: region.latitude,
          lng: region.longitude,
          radiusKm: goalCircleKm,
        }));
      }, 300);
    }
    prevMapReady.current = mapReady;
  }, [mapReady]);

  // Force full remount when avatar or path style/color changes — these are baked into HTML
  useEffect(() => {
    const avatarChanged = avatarIndex !== prevAvatarIndex.current;
    const styleChanged  = pathStyle   !== prevPathStyle.current;
    const colorChanged  = pathColor   !== prevPathColor.current;
    if (!avatarChanged && !styleChanged && !colorChanged) return;
    prevAvatarIndex.current = avatarIndex;
    prevPathStyle.current   = pathStyle;
    prevPathColor.current   = pathColor;
    // Clear cached HTML so it rebuilds with new values on next render
    setMapReady(false);
    htmlRef.current = '';
    prevRegionRef.current = null; // force recenter on reload
    setWebViewKey(k => k + 1);
  }, [avatarIndex, pathStyle, pathColor]);

  // Send tile style change via postMessage — no remount, preserves camera position
  useEffect(() => {
    if (!mapReady || !webRef.current) return;
    if (tileStyle === prevTileStyle.current) return;
    prevTileStyle.current = tileStyle;

    const MAPTILER_KEY = process.env.EXPO_PUBLIC_MAPTILER_KEY ?? '';

    const is3D = tileStyle === '3d';
    const tileUrl =
      tileStyle === 'satellite'
        ? 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'
        : tileStyle === 'dark'
          ? `https://api.maptiler.com/maps/dataviz-dark/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`
          : tileStyle === 'default'
            ? `https://api.maptiler.com/maps/dataviz/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`
            : `https://api.maptiler.com/maps/dataviz-dark/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`;

    webRef.current.postMessage(JSON.stringify({
      type: 'CHANGE_TILES',
      tileUrl,
      vectorStyle: is3D ? `https://api.maptiler.com/maps/streets-v2-dark/style.json?key=${MAPTILER_KEY}` : null,
    }));
  }, [tileStyle, mapReady]);

  useEffect(() => {
    if (!mapReady || !webRef.current || !region) return;

    const prev    = prevRegionRef.current;
    const isFirst = !prev;
    prevRegionRef.current = region;
    prevHeadingRef.current = headingDeg;

    const msg = {
      type:     'UPDATE',
      lat:      region.latitude,
      lng:      region.longitude,
      heading:  headingDeg ?? 0,
      recenter: isFirst,
      path:     showPath
        ? path.map(p => [p.latitude, p.longitude])
        : [],
      polygons: showPolygons
        ? polygons.map(p => ({
            points: p.points.map(pp => [pp.latitude, pp.longitude]),
            color: p.color,
            ownerName: p.ownerName || '',
            ownerPhotoURL: p.ownerPhotoURL || '',
            ownerId: p.ownerId || '',
          }))
        : [],
      showNearbyTerritories,
      liveUsers: showLiveUsers
        ? liveUsers.map(u => ({
            uid: u.uid,
            displayName: u.displayName,
            photoURL: u.photoURL || '',
            latitude: u.latitude,
            longitude: u.longitude,
            isRunning: u.isRunning,
            avatarIndex: u.avatarIndex ?? 0,
          }))
        : [],
      showLiveUsers,
      items,
    };
    webRef.current.postMessage(JSON.stringify(msg));
  }, [region, path, polygons, showPath, showPolygons, headingDeg, mapReady, liveUsers, showLiveUsers, items]);

  // Save location to cache whenever we get a real GPS fix
  useEffect(() => {
    if (region) {
      saveLastLocation(region.latitude, region.longitude);
    }
  }, [region?.latitude, region?.longitude]);

  // Use real region if available, otherwise use pre-render location, otherwise default
  const renderLat = region?.latitude ?? preRenderLoc?.lat ?? DEFAULT_LAT;
  const renderLng = region?.longitude ?? preRenderLoc?.lng ?? DEFAULT_LNG;

  // Build HTML only once on mount; all subsequent updates go via postMessage
  // Pre-render immediately with last-known/default location — don't wait for GPS
  if (!htmlRef.current && (preRenderLoc || region)) {
    htmlRef.current = buildLeafletHTML(
      renderLat, renderLng,
      tileStyle,
      path, polygons,
      showPath, showPolygons,
      accuracyMeters,
      headingDeg,
      showZoomButtons,
      showNearbyTerritories,
      goalCircleKm,
      liveUsers,
      showLiveUsers,
      avatarIndex,
      pathStyle,
      pathColor,
      items,
    );
  }

  // Show a thin loading bar while waiting for GPS (not a full placeholder)
  const showGpsWaiting = !region && mapReady;

  return (
    <View style={styles.container}>
      {htmlRef.current ? (
        <WebView
          key={webViewKey}
          ref={webRef}
          source={{ html: htmlRef.current }}
          style={styles.webview}
          originWhitelist={['*']}
          javaScriptEnabled
          domStorageEnabled
          mixedContentMode="always"
          allowFileAccess
          allowUniversalAccessFromFileURLs
          allowFileAccessFromFileURLs
          onLoadEnd={() => setMapReady(true)}
          onError={() => {
            setMapReady(false);
            htmlRef.current = '';
            setWebViewKey(k => k + 1);
          }}
          scrollEnabled={false}
          bounces={false}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          cacheEnabled={true}
          androidLayerType="hardware"
          setSupportMultipleWindows={false}
          thirdPartyCookiesEnabled={true}
          geolocationEnabled={false}
          allowsBackForwardNavigationGestures={false}
        />
      ) : (
        // Pre-render location not loaded yet — show dark background briefly
        <View style={[StyleSheet.absoluteFill, { backgroundColor: C.black }]} />
      )}

      {/* Map loading overlay — shown while WebView initializes */}
      {!mapReady && (
        <View style={styles.loadingOverlay}>
          <Ionicons name="map-outline" size={40} color={C.border} />
          <Text style={{ color: C.white, marginTop: 12, fontSize: 14 }}>Loading map…</Text>
          <Text style={{ color: C.border, marginTop: 6, fontSize: 11 }}>Caching map tiles for offline use</Text>
        </View>
      )}

      {/* GPS acquiring indicator — shown after map loads but before GPS fix */}
      {showGpsWaiting && (
        <View style={{
          position: 'absolute', top: 60, alignSelf: 'center',
          backgroundColor: 'rgba(10,12,16,0.9)', borderRadius: 20,
          paddingHorizontal: 14, paddingVertical: 8,
          flexDirection: 'row', alignItems: 'center', gap: 8,
          borderWidth: 1, borderColor: 'rgba(255,165,0,0.4)',
        }}>
          <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#FF9F0A' }} />
          <Text style={{ color: '#FF9F0A', fontSize: 11, fontWeight: '800' }}>Acquiring GPS…</Text>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: C.black },
  webview:        { flex: 1, backgroundColor: 'transparent' },
  placeholder:    { flex: 1, backgroundColor: C.black, alignItems: 'center', justifyContent: 'center' },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: C.black, alignItems: 'center', justifyContent: 'center' },
});

export default memo(MapRunViewInner);
