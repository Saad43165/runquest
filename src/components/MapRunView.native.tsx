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
): string {
  const pathJSON = JSON.stringify(path.map(p => [p.latitude, p.longitude]));
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
  '<svg width="48" height="64" viewBox="0 0 48 64" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="12" r="9" fill="#C8956C"/><rect x="16" y="8" width="16" height="9" rx="2" fill="#1A1A2E"/><rect x="16" y="13" width="16" height="4" fill="#00FF87" rx="1"/><circle cx="20" cy="12" r="2" fill="#00FF87"/><circle cx="28" cy="12" r="2" fill="#00FF87"/><rect x="15" y="21" width="18" height="22" rx="4" fill="#1A1A2E"/><rect x="15" y="21" width="18" height="5" fill="#00FF87" rx="2"/><rect x="7" y="22" width="8" height="17" rx="4" fill="#1A1A2E"/><rect x="33" y="22" width="8" height="17" rx="4" fill="#1A1A2E"/><rect x="16" y="43" width="7" height="18" rx="3" fill="#1A1A2E"/><rect x="25" y="43" width="7" height="18" rx="3" fill="#1A1A2E"/></svg>',
  '<svg width="48" height="64" viewBox="0 0 48 64" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="12" r="9" fill="#E8C49A"/><rect x="14" y="7" width="20" height="11" rx="4" fill="#8A9BB0"/><rect x="16" y="9" width="16" height="6" rx="2" fill="#C0C0C0"/><circle cx="20" cy="12" r="1.5" fill="#1C2333"/><circle cx="28" cy="12" r="1.5" fill="#1C2333"/><rect x="14" y="21" width="20" height="23" rx="3" fill="#8A9BB0"/><rect x="14" y="21" width="20" height="5" fill="#C0C0C0" rx="2"/><line x1="24" y1="26" x2="24" y2="44" stroke="#C0C0C0" stroke-width="2"/><rect x="6" y="22" width="8" height="18" rx="4" fill="#8A9BB0"/><rect x="34" y="22" width="8" height="18" rx="4" fill="#8A9BB0"/><rect x="16" y="44" width="7" height="18" rx="3" fill="#6B7A8D"/><rect x="25" y="44" width="7" height="18" rx="3" fill="#6B7A8D"/></svg>',
  '<svg width="48" height="64" viewBox="0 0 48 64" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="14" r="8" fill="#D4A574"/><polygon points="24,1 16,15 32,15" fill="#6B2FA0"/><ellipse cx="24" cy="15" rx="11" ry="3" fill="#8B3FC0"/><circle cx="20" cy="14" r="1.5" fill="#BF5FFF"/><circle cx="28" cy="14" r="1.5" fill="#BF5FFF"/><path d="M14 22 Q24 19 34 22 L32 45 L16 45 Z" fill="#6B2FA0"/><rect x="14" y="22" width="20" height="5" fill="#BF5FFF" rx="2"/><rect x="6" y="23" width="8" height="18" rx="4" fill="#6B2FA0"/><rect x="34" y="23" width="8" height="18" rx="4" fill="#6B2FA0"/><rect x="17" y="45" width="6" height="17" rx="3" fill="#4A1A7A"/><rect x="25" y="45" width="6" height="17" rx="3" fill="#4A1A7A"/></svg>',
  '<svg width="48" height="64" viewBox="0 0 48 64" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="12" r="8" fill="#C8956C"/><ellipse cx="24" cy="9" rx="11" ry="5" fill="#2D5A27"/><rect x="13" y="9" width="22" height="5" fill="#1A3A15" rx="2"/><circle cx="20" cy="13" r="1.5" fill="#1A3A15"/><circle cx="28" cy="13" r="1.5" fill="#1A3A15"/><rect x="15" y="20" width="18" height="23" rx="3" fill="#2D5A27"/><rect x="15" y="20" width="18" height="5" fill="#32D74B" rx="2"/><rect x="7" y="21" width="8" height="17" rx="4" fill="#2D5A27"/><rect x="33" y="21" width="8" height="17" rx="4" fill="#2D5A27"/><rect x="16" y="43" width="7" height="19" rx="3" fill="#1A3A15"/><rect x="25" y="43" width="7" height="19" rx="3" fill="#1A3A15"/></svg>',
  '<svg width="48" height="64" viewBox="0 0 48 64" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="12" r="9" fill="#D4845A"/><rect x="14" y="7" width="20" height="11" rx="3" fill="#8B0000"/><circle cx="20" cy="12" r="2" fill="#FF453A"/><circle cx="28" cy="12" r="2" fill="#FF453A"/><path d="M20 16 L24 18 L28 16" stroke="#FF453A" stroke-width="1.5" fill="none"/><rect x="14" y="21" width="20" height="23" rx="3" fill="#8B0000"/><rect x="14" y="21" width="20" height="5" fill="#FF453A" rx="2"/><rect x="6" y="22" width="8" height="18" rx="4" fill="#8B0000"/><rect x="34" y="22" width="8" height="18" rx="4" fill="#8B0000"/><rect x="16" y="44" width="7" height="18" rx="3" fill="#6B0000"/><rect x="25" y="44" width="7" height="18" rx="3" fill="#6B0000"/></svg>',
  '<svg width="48" height="64" viewBox="0 0 48 64" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="12" r="9" fill="#1A2A3E"/><rect x="14" y="7" width="20" height="12" rx="4" fill="#0D1F35"/><rect x="15" y="9" width="18" height="7" rx="3" fill="#00C6FF" opacity="0.5"/><circle cx="20" cy="12" r="2" fill="#00C6FF"/><circle cx="28" cy="12" r="2" fill="#00C6FF"/><rect x="14" y="21" width="20" height="23" rx="3" fill="#0D1F35"/><line x1="14" y1="27" x2="34" y2="27" stroke="#00C6FF" stroke-width="1.5"/><line x1="14" y1="33" x2="34" y2="33" stroke="#00C6FF" stroke-width="1"/><rect x="6" y="22" width="8" height="18" rx="4" fill="#0D1F35"/><rect x="34" y="22" width="8" height="18" rx="4" fill="#0D1F35"/><rect x="16" y="44" width="7" height="18" rx="3" fill="#0A1828"/><rect x="25" y="44" width="7" height="18" rx="3" fill="#0A1828"/></svg>',
  '<svg width="48" height="64" viewBox="0 0 48 64" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="13" r="8" fill="#C8956C"/><path d="M13 9 L24 3 L35 9 L33 16 L15 16 Z" fill="#2A1800"/><rect x="20" y="10" width="8" height="3" rx="1" fill="#FFD60A"/><circle cx="20" cy="13" r="1.5" fill="#2A1800"/><rect x="22" y="11" width="7" height="5" rx="1" fill="#1A1000"/><rect x="14" y="21" width="20" height="23" rx="3" fill="#5C3A1E"/><rect x="14" y="21" width="20" height="5" fill="#8B5E3C" rx="2"/><rect x="6" y="22" width="8" height="18" rx="4" fill="#5C3A1E"/><rect x="34" y="22" width="8" height="18" rx="4" fill="#5C3A1E"/><rect x="16" y="44" width="7" height="18" rx="3" fill="#3A2010"/><rect x="25" y="44" width="7" height="18" rx="3" fill="#3A2010"/></svg>',
  '<svg width="48" height="64" viewBox="0 0 48 64" xmlns="http://www.w3.org/2000/svg"><ellipse cx="24" cy="13" rx="11" ry="12" fill="#D0D8F0" opacity="0.95"/><circle cx="19" cy="12" r="3" fill="#1A1A3E"/><circle cx="29" cy="12" r="3" fill="#1A1A3E"/><circle cx="19" cy="12" r="1.5" fill="#6080FF"/><circle cx="29" cy="12" r="1.5" fill="#6080FF"/><path d="M13 22 Q24 18 35 22 L35 52 Q31 48 24 52 Q17 48 13 52 Z" fill="#D0D8F0" opacity="0.9"/><path d="M13 22 Q24 18 35 22 L35 27 Q24 23 13 27 Z" fill="#A0B0D0" opacity="0.9"/></svg>',
  '<svg width="48" height="64" viewBox="0 0 48 64" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="13" r="8" fill="#C8956C"/><rect x="21" y="3" width="6" height="9" rx="3" fill="#1A0A0A"/><rect x="14" y="9" width="20" height="9" rx="2" fill="#1A0A0A"/><circle cx="20" cy="13" r="1.5" fill="#FF6B35"/><circle cx="28" cy="13" r="1.5" fill="#FF6B35"/><rect x="14" y="21" width="20" height="23" rx="3" fill="#1A0A0A"/><rect x="14" y="21" width="20" height="5" fill="#FF6B35" rx="2"/><line x1="24" y1="26" x2="24" y2="44" stroke="#FF6B35" stroke-width="2"/><rect x="6" y="22" width="8" height="18" rx="4" fill="#1A0A0A"/><rect x="34" y="22" width="8" height="18" rx="4" fill="#1A0A0A"/><rect x="16" y="44" width="7" height="18" rx="3" fill="#0A0505"/><rect x="25" y="44" width="7" height="18" rx="3" fill="#0A0505"/></svg>',
  '<svg width="48" height="64" viewBox="0 0 48 64" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="13" r="8" fill="#D4A574"/><rect x="14" y="7" width="20" height="11" rx="3" fill="#2A2A55"/><path d="M10 11 L14 7" stroke="#FFD60A" stroke-width="3" stroke-linecap="round"/><path d="M38 11 L34 7" stroke="#FFD60A" stroke-width="3" stroke-linecap="round"/><circle cx="20" cy="13" r="1.5" fill="#2A2A55"/><circle cx="28" cy="13" r="1.5" fill="#2A2A55"/><path d="M18 17 Q24 20 30 17" fill="#8B6914" stroke="#8B6914" stroke-width="1"/><rect x="14" y="21" width="20" height="23" rx="3" fill="#2A2A55"/><rect x="14" y="21" width="20" height="5" fill="#FFD60A" rx="2"/><rect x="6" y="22" width="8" height="18" rx="4" fill="#2A2A55"/><rect x="34" y="22" width="8" height="18" rx="4" fill="#2A2A55"/><rect x="16" y="44" width="7" height="18" rx="3" fill="#1A1A3A"/><rect x="25" y="44" width="7" height="18" rx="3" fill="#1A1A3A"/></svg>',
  '<svg width="48" height="64" viewBox="0 0 48 64" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="12" r="11" fill="#E8E8F0"/><circle cx="24" cy="12" r="8" fill="#1A1A3E"/><rect x="17" y="8" width="14" height="9" rx="4" fill="#00C6FF" opacity="0.5"/><circle cx="20" cy="12" r="1.5" fill="#00C6FF"/><circle cx="28" cy="12" r="1.5" fill="#00C6FF"/><rect x="13" y="23" width="22" height="22" rx="5" fill="#E8E8F0"/><rect x="18" y="28" width="12" height="8" rx="2" fill="#C0C8D8"/><rect x="5" y="24" width="8" height="18" rx="4" fill="#E8E8F0"/><rect x="35" y="24" width="8" height="18" rx="4" fill="#E8E8F0"/><rect x="16" y="45" width="7" height="17" rx="3" fill="#C0C8D8"/><rect x="25" y="45" width="7" height="17" rx="3" fill="#C0C8D8"/></svg>',
  '<svg width="48" height="64" viewBox="0 0 48 64" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="15" r="8" fill="#D4A574"/><polygon points="24,1 16,16 32,16" fill="#4A0080"/><ellipse cx="24" cy="16" rx="12" ry="3" fill="#6B00B0"/><circle cx="20" cy="15" r="2" fill="#BF5FFF"/><circle cx="28" cy="15" r="2" fill="#BF5FFF"/><path d="M14 23 Q24 20 34 23 L32 45 L16 45 Z" fill="#4A0080"/><rect x="14" y="23" width="20" height="5" fill="#BF5FFF" rx="2"/><rect x="6" y="24" width="8" height="18" rx="4" fill="#4A0080"/><rect x="34" y="24" width="8" height="18" rx="4" fill="#4A0080"/><rect x="17" y="45" width="6" height="17" rx="3" fill="#2A0050"/><rect x="25" y="45" width="6" height="17" rx="3" fill="#2A0050"/></svg>',
  '<svg width="48" height="64" viewBox="0 0 48 64" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="12" r="8" fill="#C8956C"/><path d="M13 8 Q24 3 35 8 L33 17 L15 17 Z" fill="#1A4A1A"/><circle cx="20" cy="13" r="1.5" fill="#32D74B"/><circle cx="28" cy="13" r="1.5" fill="#32D74B"/><rect x="15" y="20" width="18" height="23" rx="3" fill="#1A4A1A"/><rect x="15" y="20" width="18" height="5" fill="#32D74B" rx="2"/><rect x="7" y="21" width="8" height="17" rx="4" fill="#1A4A1A"/><rect x="33" y="21" width="8" height="17" rx="4" fill="#1A4A1A"/><path d="M40 8 Q46 16 40 24" stroke="#8B5E3C" stroke-width="2.5" fill="none"/><line x1="40" y1="8" x2="40" y2="24" stroke="#8B5E3C" stroke-width="1.5"/><rect x="17" y="43" width="6" height="19" rx="3" fill="#0A2A0A"/><rect x="25" y="43" width="6" height="19" rx="3" fill="#0A2A0A"/></svg>',
  '<svg width="48" height="64" viewBox="0 0 48 64" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="13" r="8" fill="#D4A574"/><rect x="15" y="9" width="18" height="9" rx="2" fill="#5C3A00"/><circle cx="19" cy="12" r="3.5" fill="#FF9F0A" opacity="0.7"/><circle cx="29" cy="12" r="3.5" fill="#FF9F0A" opacity="0.7"/><circle cx="19" cy="12" r="1.5" fill="#1A0A00"/><circle cx="29" cy="12" r="1.5" fill="#1A0A00"/><path d="M14 21 Q24 18 34 21 L32 44 L16 44 Z" fill="#8B4500"/><rect x="14" y="21" width="20" height="5" fill="#FF9F0A" rx="2"/><rect x="6" y="22" width="8" height="18" rx="4" fill="#8B4500"/><rect x="34" y="22" width="8" height="18" rx="4" fill="#8B4500"/><circle cx="40" cy="28" r="5" fill="#32D74B" opacity="0.9"/><rect x="17" y="44" width="6" height="18" rx="3" fill="#5C3A00"/><rect x="25" y="44" width="6" height="18" rx="3" fill="#5C3A00"/></svg>',
  '<svg width="48" height="64" viewBox="0 0 48 64" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="4" r="5" fill="none" stroke="#FFD60A" stroke-width="2.5" opacity="0.9"/><circle cx="24" cy="13" r="8" fill="#E8C49A"/><rect x="14" y="8" width="20" height="10" rx="3" fill="#B8860B"/><circle cx="20" cy="13" r="1.5" fill="#1A1400"/><circle cx="28" cy="13" r="1.5" fill="#1A1400"/><rect x="14" y="21" width="20" height="23" rx="3" fill="#B8860B"/><rect x="14" y="21" width="20" height="5" fill="#FFD60A" rx="2"/><line x1="24" y1="26" x2="24" y2="44" stroke="#FFD60A" stroke-width="2"/><rect x="6" y="22" width="8" height="18" rx="4" fill="#B8860B"/><rect x="34" y="22" width="8" height="18" rx="4" fill="#B8860B"/><rect x="16" y="44" width="7" height="18" rx="3" fill="#8B6500"/><rect x="25" y="44" width="7" height="18" rx="3" fill="#8B6500"/></svg>',
  '<svg width="48" height="64" viewBox="0 0 48 64" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="13" r="8" fill="#B07850"/><path d="M13 9 Q24 4 35 9 L33 18 L15 18 Z" fill="#1A1A1A"/><circle cx="20" cy="13" r="1.5" fill="#888"/><circle cx="28" cy="13" r="1.5" fill="#888"/><path d="M14 21 Q24 18 34 21 L34 44 L14 44 Z" fill="#1A1A1A"/><rect x="14" y="21" width="20" height="5" fill="#444" rx="2"/><rect x="6" y="22" width="8" height="18" rx="4" fill="#1A1A1A"/><rect x="34" y="22" width="8" height="18" rx="4" fill="#1A1A1A"/><line x1="8" y1="26" x2="12" y2="36" stroke="#AAA" stroke-width="2.5" stroke-linecap="round"/><line x1="40" y1="26" x2="36" y2="36" stroke="#AAA" stroke-width="2.5" stroke-linecap="round"/><rect x="17" y="44" width="6" height="18" rx="3" fill="#0A0A0A"/><rect x="25" y="44" width="6" height="18" rx="3" fill="#0A0A0A"/></svg>',
];

var PATH_COLORS = { green: '#00FF87', blue: '#00C6FF', orange: '#FF9F0A', purple: '#BF5FFF', red: '#FF453A', white: '#FFFFFF' };
var currentPathColor = '${pathColor}';
var currentPathStyle = '${pathStyle}';
var currentAvatarIndex = ${avatarIndex};

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
var userMarker = new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([${lng}, ${lat}]).addTo(map);

// ── Path & polygons ───────────────────────────────────────────────────────────
var pathCoords = ${pathJSON};
var polygonsData = ${polygonsJSON};
var liveUsersData = ${liveUsersJSON};
var showLiveUsersFlag = ${showLiveUsers};
var pathAdded = false;
var addedPolyIds = [];
var labelMarkers = [];
var liveUserMarkers = {};
var showNearbyTerritories = ${showNearbyTerritories};

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

var labelMarkers = [];

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
  if (!${showPolygons} || polygonsData.length === 0) return;
  polygonsData.forEach(function(poly, i) {
    var coords = poly.points.map(function(p) { return [p[1], p[0]]; });
    if (coords.length < 3) return;
    coords.push(coords[0]);
    var srcId = 'poly-' + Date.now() + '-' + i;
    try {
      map.addSource(srcId, { type: 'geojson', data: { type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] } } });
      // Outer glow
      map.addLayer({ id: 'glow-' + srcId, type: 'line', source: srcId, paint: { 'line-color': poly.color, 'line-width': 10, 'line-opacity': 0.15, 'line-blur': 6 } });
      // Fill
      map.addLayer({ id: 'fill-' + srcId, type: 'fill', source: srcId, paint: { 'fill-color': poly.color, 'fill-opacity': 0.28 } });
      // Sharp border
      map.addLayer({ id: 'line-' + srcId, type: 'line', source: srcId, paint: { 'line-color': poly.color, 'line-width': 2.5, 'line-opacity': 1 } });
      addedPolyIds.push(srcId);

      // Owner name label — ALWAYS shown on all territories so users know who owns what
      // showNearbyTerritories controls whether the label is shown at all
      if (poly.ownerName) {
        var centLng = 0, centLat = 0;
        for (var ci = 0; ci < coords.length - 1; ci++) { centLng += coords[ci][0]; centLat += coords[ci][1]; }
        centLng /= (coords.length - 1); centLat /= (coords.length - 1);
        var name = poly.ownerName.length > 10 ? poly.ownerName.slice(0,9)+'\u2026' : poly.ownerName;
        var labelEl = document.createElement('div');
        // Dark pill with colored left accent — readable on ALL map themes
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
        // Colored dot + white name
        labelEl.innerHTML = '<div style="width:6px;height:6px;border-radius:3px;background:' + poly.color + ';flex-shrink:0;"></div>' +
          '<span style="color:#FFFFFF;font-size:10px;font-weight:800;font-family:Arial,sans-serif;letter-spacing:0.3px;">' + name + '</span>';
        var lm = new maplibregl.Marker({ element: labelEl, anchor: 'center' }).setLngLat([centLng, centLat]).addTo(map);
        labelMarkers.push(lm);
      }
    } catch(e) {}
  });
}

// ── Live user markers ─────────────────────────────────────────────────────────
function removeLiveUserMarkers() {
  Object.values(liveUserMarkers).forEach(function(m) { try { m.remove(); } catch(e) {} });
  liveUserMarkers = {};
}

function drawLiveUsers() {
  if (!showLiveUsersFlag) { removeLiveUserMarkers(); return; }
  var currentUids = {};
  liveUsersData.forEach(function(u) {
    currentUids[u.uid] = true;
    // Update position if marker already exists
    if (liveUserMarkers[u.uid]) {
      liveUserMarkers[u.uid].setLngLat([u.longitude, u.latitude]);
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
      try { liveUserMarkers[uid].remove(); } catch(e) {}
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

map.on('load', function() { drawPolygons(); drawLiveUsers(); if (${showPath}) drawPath(); });

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
      userMarker.setLngLat([msg.lng, msg.lat]);
      if (msg.recenter === true) map.easeTo({ center: [msg.lng, msg.lat], duration: 500 });
      if (msg.path !== undefined) { pathCoords = msg.path; drawPath(); }
      if (msg.polygons !== undefined) { polygonsData = msg.polygons; drawPolygons(); }
      if (msg.showNearbyTerritories !== undefined) { showNearbyTerritories = msg.showNearbyTerritories; drawPolygons(); }
      if (msg.liveUsers !== undefined) { liveUsersData = msg.liveUsers; drawLiveUsers(); }
      if (msg.showLiveUsers !== undefined) { showLiveUsersFlag = msg.showLiveUsers; drawLiveUsers(); }
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
    };
    webRef.current.postMessage(JSON.stringify(msg));
  }, [region, path, polygons, showPath, showPolygons, headingDeg, mapReady, liveUsers, showLiveUsers]);

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
