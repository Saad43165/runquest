import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Animated, Modal, TextInput, ActivityIndicator, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/utils/ThemeContext';
import { getHistory, deleteRun, RunRecord } from '../services/history';
import { getSettings } from '../config/settings';
import { OrbBackground } from '../components/OrbBackground';
import { useAuth } from '../context/AuthContext';
import { exportSingleRunAsPDF, exportAllRunsAsPDF } from '../utils/pdfExport';
import { ConfirmDialog } from '../components/ConfirmDialog';
import * as Haptics from 'expo-haptics';

function calcPaceStr(distanceMeters: number, durationSec: number): string {
  if (distanceMeters < 10) return '--';
  const minPerKm = (durationSec / 60) / (distanceMeters / 1000);
  const min = Math.floor(minPerKm);
  const sec = Math.round((minPerKm - min) * 60);
  return `${min}:${sec < 10 ? '0' : ''}${sec}`;
}

function formatDur(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// ─── Route Replay Modal — WebView canvas for pinpoint accuracy ───────────────
function RouteReplayModal({ run, visible, onClose }: { run: RunRecord | null; visible: boolean; onClose: () => void }) {
  const { T } = useTheme();
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(1); // 1x, 2x, 4x
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const webRef = useRef<any>(null);

  const points = run?.points ?? [];
  const total = points.length;

  useEffect(() => {
    if (!visible) {
      setPlaying(false);
      setProgress(0);
      progressAnim.setValue(0);
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
  }, [visible]);

  const togglePlay = () => {
    if (playing) {
      setPlaying(false);
      if (intervalRef.current) clearInterval(intervalRef.current);
    } else {
      if (progress >= total - 1) setProgress(0);
      setPlaying(true);
      const step = Math.max(1, Math.floor(total / 200)); // adaptive step for long routes
      intervalRef.current = setInterval(() => {
        setProgress(p => {
          const next = p + step;
          if (next >= total) { clearInterval(intervalRef.current!); setPlaying(false); return total - 1; }
          return next;
        });
      }, Math.max(16, 50 / speed));
    }
  };

  useEffect(() => {
    Animated.timing(progressAnim, { toValue: total > 0 ? progress / (total - 1) : 0, duration: 30, useNativeDriver: false }).start();
    // Send progress update to canvas
    if (webRef.current && total > 0) {
      webRef.current.postMessage(JSON.stringify({ type: 'PROGRESS', progress }));
    }
  }, [progress, total]);

  if (!run) return null;

  const distKm = (run.distanceMeters / 1000).toFixed(2);
  const mins = Math.round(run.durationSec / 60);
  const pace = run.durationSec > 0 && run.distanceMeters > 100
    ? (() => { const p = (run.durationSec / 60) / (run.distanceMeters / 1000); return `${Math.floor(p)}:${String(Math.round((p % 1) * 60)).padStart(2, '0')}`; })()
    : '--';

  // Build canvas HTML with all points baked in
  const allPoints = JSON.stringify(points.map(p => [p.longitude, p.latitude]));
  const MAP_W = Dimensions.get('window').width - 48;
  const MAP_H = 280;

  const canvasHtml = `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:100%;height:100%;background:#0D1B2A;overflow:hidden}canvas{display:block}</style>
</head><body>
<canvas id="c" width="${MAP_W}" height="${MAP_H}"></canvas>
<script>
var pts = ${allPoints};
var total = pts.length;
var progress = 0;
var c = document.getElementById('c');
var ctx = c.getContext('2d');
var W = ${MAP_W}, H = ${MAP_H};
var PAD = 28;

// Compute bounding box
var minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
pts.forEach(function(p) {
  if (p[0] < minLng) minLng = p[0]; if (p[0] > maxLng) maxLng = p[0];
  if (p[1] < minLat) minLat = p[1]; if (p[1] > maxLat) maxLat = p[1];
});
var lngRange = maxLng - minLng || 0.001;
var latRange = maxLat - minLat || 0.001;
var scaleX = (W - PAD * 2) / lngRange;
var scaleY = (H - PAD * 2) / latRange;
var scale = Math.min(scaleX, scaleY) * 0.88;
var offX = PAD + ((W - PAD * 2) - lngRange * scale) / 2;
var offY = PAD + ((H - PAD * 2) - latRange * scale) / 2;

function toXY(lng, lat) {
  return [offX + (lng - minLng) * scale, H - offY - (lat - minLat) * scale];
}

function draw() {
  ctx.clearRect(0, 0, W, H);

  // Background
  ctx.fillStyle = '#0D1B2A';
  ctx.fillRect(0, 0, W, H);

  // Grid
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  [0.25, 0.5, 0.75].forEach(function(f) {
    ctx.beginPath(); ctx.moveTo(0, H * f); ctx.lineTo(W, H * f); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(W * f, 0); ctx.lineTo(W * f, H); ctx.stroke();
  });

  if (total < 2) return;

  // Ghost path (full route, dim)
  ctx.beginPath();
  var s0 = toXY(pts[0][0], pts[0][1]);
  ctx.moveTo(s0[0], s0[1]);
  for (var i = 1; i < total; i++) {
    var p = toXY(pts[i][0], pts[i][1]);
    ctx.lineTo(p[0], p[1]);
  }
  ctx.strokeStyle = 'rgba(0,198,255,0.12)';
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();

  // Drawn path (up to progress)
  var end = Math.min(progress + 1, total);
  if (end >= 2) {
    ctx.beginPath();
    var p0 = toXY(pts[0][0], pts[0][1]);
    ctx.moveTo(p0[0], p0[1]);
    for (var j = 1; j < end; j++) {
      var pj = toXY(pts[j][0], pts[j][1]);
      ctx.lineTo(pj[0], pj[1]);
    }
    // Gradient stroke
    var grad = ctx.createLinearGradient(p0[0], p0[1], toXY(pts[end-1][0], pts[end-1][1])[0], toXY(pts[end-1][0], pts[end-1][1])[1]);
    grad.addColorStop(0, '#00C6FF');
    grad.addColorStop(1, '#00FF87');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 3.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  // Start marker
  var sp = toXY(pts[0][0], pts[0][1]);
  ctx.beginPath();
  ctx.arc(sp[0], sp[1], 6, 0, Math.PI * 2);
  ctx.fillStyle = '#00C6FF';
  ctx.fill();
  ctx.strokeStyle = '#FFF';
  ctx.lineWidth = 2;
  ctx.stroke();

  // End marker (if loop closed)
  if (progress >= total - 1) {
    var ep = toXY(pts[total-1][0], pts[total-1][1]);
    ctx.beginPath();
    ctx.arc(ep[0], ep[1], 7, 0, Math.PI * 2);
    ctx.fillStyle = '#00FF87';
    ctx.fill();
    ctx.strokeStyle = '#FFF';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Current position dot with glow
  if (progress > 0 && progress < total) {
    var cp = toXY(pts[progress][0], pts[progress][1]);
    // Glow
    var glow = ctx.createRadialGradient(cp[0], cp[1], 0, cp[0], cp[1], 14);
    glow.addColorStop(0, 'rgba(0,255,135,0.4)');
    glow.addColorStop(1, 'rgba(0,255,135,0)');
    ctx.beginPath();
    ctx.arc(cp[0], cp[1], 14, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();
    // Dot
    ctx.beginPath();
    ctx.arc(cp[0], cp[1], 6, 0, Math.PI * 2);
    ctx.fillStyle = '#00FF87';
    ctx.fill();
    ctx.strokeStyle = '#FFF';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }
}

draw();

function handleMsg(raw) {
  try {
    var msg = JSON.parse(raw);
    if (msg.type === 'PROGRESS') { progress = msg.progress; draw(); }
  } catch(e) {}
}
document.addEventListener('message', function(e) { handleMsg(e.data); });
window.addEventListener('message', function(e) { handleMsg(e.data); });
</script></body></html>`;

  const { WebView } = require('react-native-webview');

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.88)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
        <View style={{ backgroundColor: '#0E0E10', borderRadius: 28, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', width: '100%', overflow: 'hidden' }}>
          <LinearGradient colors={[T.green, '#00C6FF']} style={{ height: 3 }} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />

          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: T.green + '20', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="map-outline" size={20} color={T.green} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '900' }}>Route Replay</Text>
              <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 2 }}>
                {new Date(run.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                {' · '}{distKm} km · {mins} min · {pace}/km
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="close" size={16} color="#FFF" />
            </TouchableOpacity>
          </View>

          {/* Canvas map */}
          <View style={{ marginHorizontal: 16, marginBottom: 12, height: MAP_H, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: T.green + '30' }}>
            {total >= 2 ? (
              <WebView
                ref={webRef}
                source={{ html: canvasHtml }}
                style={{ width: MAP_W, height: MAP_H, backgroundColor: '#0D1B2A' }}
                originWhitelist={['*']}
                javaScriptEnabled
                scrollEnabled={false}
                bounces={false}
                showsHorizontalScrollIndicator={false}
                showsVerticalScrollIndicator={false}
                androidLayerType="hardware"
              />
            ) : (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0D1B2A' }}>
                <Ionicons name="map-outline" size={32} color="rgba(255,255,255,0.2)" />
                <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, marginTop: 8 }}>No GPS points recorded</Text>
              </View>
            )}
          </View>

          {/* Progress bar */}
          <View style={{ marginHorizontal: 16, marginBottom: 8, height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
            <Animated.View style={{ height: '100%', backgroundColor: T.green, borderRadius: 2, width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />
          </View>

          {/* Point counter */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 12 }}>
            <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10 }}>
              Point {progress + 1} of {total}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10 }}>
              {Math.round((progress / Math.max(total - 1, 1)) * 100)}% complete
            </Text>
          </View>

          {/* Controls */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingBottom: 20, gap: 12 }}>
            {/* Reset */}
            <TouchableOpacity
              onPress={() => { setProgress(0); setPlaying(false); if (intervalRef.current) clearInterval(intervalRef.current); }}
              style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="refresh" size={18} color="#FFF" />
            </TouchableOpacity>

            {/* Play/Pause */}
            <TouchableOpacity onPress={togglePlay} style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: T.green, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={playing ? 'pause' : 'play'} size={24} color="#000" />
            </TouchableOpacity>

            {/* Speed toggle */}
            <TouchableOpacity
              onPress={() => { setSpeed(s => s === 1 ? 2 : s === 2 ? 4 : 1); if (playing) { setPlaying(false); if (intervalRef.current) clearInterval(intervalRef.current); setTimeout(() => setPlaying(true), 50); } }}
              style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: speed > 1 ? T.green + '60' : 'transparent' }}
            >
              <Text style={{ color: speed > 1 ? T.green : '#FFF', fontSize: 12, fontWeight: '900' }}>{speed}×</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── PDF Rename Dialog ────────────────────────────────────────────────────────
function PdfDialog({ visible, defaultName, title, subtitle, onCancel, onExport }: {
  visible: boolean; defaultName: string; title: string; subtitle: string;
  onCancel: () => void; onExport: (name: string) => void;
}) {
  const { T } = useTheme();
  const [name, setName] = useState(defaultName);
  const [exporting, setExporting] = useState(false);

  useEffect(() => { if (visible) setName(defaultName); }, [visible, defaultName]);

  const handle = async () => {
    setExporting(true);
    try { await onExport(name.trim() || defaultName); } finally { setExporting(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <View style={{ backgroundColor: '#111', borderRadius: 24, padding: 24, width: '100%', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
          {/* Icon */}
          <View style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: T.green + '20', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 14 }}>
            <Ionicons name="document-text-outline" size={24} color={T.green} />
          </View>
          <Text style={{ color: '#FFF', fontSize: 17, fontWeight: '900', textAlign: 'center', marginBottom: 4 }}>{title}</Text>
          <Text style={{ color: '#8E8E93', fontSize: 12, textAlign: 'center', lineHeight: 18, marginBottom: 18 }}>{subtitle}</Text>

          {/* File name input */}
          <Text style={{ color: '#8E8E93', fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 7 }}>FILE NAME</Text>
          <View style={{ backgroundColor: '#1C1C1E', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 2, marginBottom: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
            <TextInput
              value={name}
              onChangeText={setName}
              style={{ color: '#FFF', fontSize: 14, paddingVertical: 11 }}
              placeholderTextColor="#555"
              placeholder="Enter file name..."
              autoCapitalize="none"
            />
          </View>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity onPress={onCancel} style={{ flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: '#1C1C1E', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center' }}>
              <Text style={{ color: '#8E8E93', fontWeight: '700', fontSize: 14 }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handle} disabled={exporting} style={{ flex: 1.4, borderRadius: 14, overflow: 'hidden' }}>
              <LinearGradient colors={[T.green, T.green]} style={{ paddingVertical: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, minHeight: 50 }}>
                {exporting
                  ? <ActivityIndicator color="#000" size="small" />
                  : <>
                      <Ionicons name="share-outline" size={16} color="#000" />
                      <Text style={{ color: '#000', fontWeight: '900', fontSize: 14 }}>Export & Share</Text>
                    </>
                }
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Run Row ──────────────────────────────────────────────────────────────────
function RunRow({ run, index, isMetric, displayName, onDelete, onReplay }: {
  run: RunRecord; index: number; isMetric: boolean; displayName: string; onDelete: () => void; onReplay: () => void;
}) {
  const { T, themeName } = useTheme();
  const isLight = themeName === 'light';
  const anim = useRef(new Animated.Value(0)).current;
  const distMult = isMetric ? 1000 : 1609.34;
  const unitLabel = isMetric ? 'km' : 'mi';
  const dist = (run.distanceMeters / distMult).toFixed(2);
  const mins = Math.round(run.durationSec / 60);
  const pace = calcPaceStr(run.distanceMeters, run.durationSec);
  const dateStr = new Date(run.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const [showPdfDialog, setShowPdfDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const isLoop = run.areaSqMeters > 500 && run.perimeterMeters > 200;
  const runColor = isLoop ? T.green : '#00C6FF';

  useEffect(() => {
    Animated.spring(anim, { toValue: 1, delay: Math.min(index * 40, 300), useNativeDriver: true, tension: 60, friction: 9 }).start();
  }, []);

  return (
    <>
      <ConfirmDialog
        visible={showDeleteDialog}
        title="Delete Run"
        message={`Remove your ${dist} ${unitLabel} run on ${dateStr}? This cannot be undone.`}
        confirmText="Delete"
        cancelText="Keep"
        destructive
        icon="trash-outline"
        onCancel={() => setShowDeleteDialog(false)}
        onConfirm={() => {
          setShowDeleteDialog(false);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onDelete();
        }}
      />

      <Animated.View style={{ opacity: anim, transform: [{ translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }}>
        <View style={[styles.row, {
          backgroundColor: T.card,
          borderColor: isLoop ? T.green + '35' : T.border,
          borderLeftWidth: 3,
          borderLeftColor: runColor,
        }]}>
          {/* Top row: icon + date + badge */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <View style={[styles.iconWrap, { backgroundColor: runColor + '18' }]}>
              <Ionicons name={isLoop ? 'flag' : 'walk-outline'} size={18} color={runColor} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: T.white, fontSize: 14, fontWeight: '800' }}>
                {new Date(run.createdAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
              </Text>
              <Text style={{ color: T.text, fontSize: 11, marginTop: 1 }}>
                {new Date(run.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
            <View style={{ backgroundColor: runColor + '18', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: runColor + '35' }}>
              <Text style={{ color: runColor, fontSize: 10, fontWeight: '900', letterSpacing: 0.5 }}>
                {isLoop ? '⬡ LOOP' : '→ OPEN'}
              </Text>
            </View>
          </View>

          {/* Stats grid */}
          <View style={{ flexDirection: 'row', marginBottom: 10, backgroundColor: isLight ? '#E8E8EE' : 'rgba(255,255,255,0.06)', borderRadius: 12, overflow: 'hidden' }}>
            {[
              { label: 'DISTANCE', value: `${dist} ${unitLabel}`, color: runColor },
              { label: 'DURATION', value: `${mins} min`, color: T.text },
              ...(pace !== '--' ? [{ label: 'PACE', value: `${pace}/km`, color: T.text }] : []),
              ...(isLoop && run.areaSqMeters > 0 ? [{ label: 'AREA', value: `${Math.round(run.areaSqMeters).toLocaleString()}m²`, color: T.green }] : []),
            ].map((s, i, arr) => (
              <View key={i} style={{ flex: 1, alignItems: 'center', paddingVertical: 8, borderRightWidth: i < arr.length - 1 ? 1 : 0, borderRightColor: isLight ? '#B0B0BA' : 'rgba(255,255,255,0.07)' }}>
                <Text style={{ color: s.color, fontSize: 13, fontWeight: '900' }} numberOfLines={1}>{s.value}</Text>
                <Text style={{ color: T.text, fontSize: 8, fontWeight: '700', letterSpacing: 0.5, marginTop: 2 }}>{s.label}</Text>
              </View>
            ))}
          </View>

          {/* Action buttons */}
          <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
            {run.points && run.points.length > 1 && (
              <TouchableOpacity onPress={onReplay} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: '#00C6FF25', borderWidth: 1.5, borderColor: '#00C6FF60' }}>
                <Ionicons name="play" size={13} color="#00C6FF" />
                <Text style={{ color: '#00C6FF', fontSize: 11, fontWeight: '800' }}>Replay</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => setShowPdfDialog(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: T.green + '25', borderWidth: 1.5, borderColor: T.green + '60' }}>
              <Ionicons name="document-text-outline" size={13} color={T.green} />
              <Text style={{ color: T.green, fontSize: 11, fontWeight: '800' }}>Export</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowDeleteDialog(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: T.red + '20', borderWidth: 1.5, borderColor: T.red + '50' }}>
              <Ionicons name="trash-outline" size={13} color={T.red} />
              <Text style={{ color: T.red, fontSize: 11, fontWeight: '800' }}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>

      <PdfDialog
        visible={showPdfDialog}
        defaultName={`RunQuest_Run_${dateStr.replace(/\s+/g, '_')}.pdf`}
        title="Export Run Report"
        subtitle={`Export your ${dist} ${unitLabel} run on ${dateStr} as a PDF report`}
        onCancel={() => setShowPdfDialog(false)}
        onExport={async (name) => {
          setShowPdfDialog(false);
          await exportSingleRunAsPDF(run, isMetric, displayName, name);
        }}
      />
    </>
  );
}

// ─── Weekly Activity Bar Chart ────────────────────────────────────────────────
function WeeklyBarChart({ history, isMetric }: { history: RunRecord[]; isMetric: boolean }) {
  const { T } = useTheme();
  const days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d;
  }).reverse();

  const distMult = isMetric ? 1000 : 1609.34;

  const data = days.map(day => {
    const dayStr = day.toDateString();
    const dayRuns = history.filter(r => new Date(r.createdAt).toDateString() === dayStr);
    const distance = dayRuns.reduce((sum, r) => sum + r.distanceMeters, 0) / distMult;
    return {
      label: day.toLocaleDateString(undefined, { weekday: 'narrow' }),
      distance,
      fullDate: day.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    };
  });

  const maxVal = Math.max(...data.map(d => d.distance), 1);

  return (
    <View style={{ backgroundColor: T.card, borderRadius: 24, borderWidth: 1, borderColor: T.border, padding: 16, marginBottom: 16 }}>
      <Text style={{ color: T.white, fontSize: 13, fontWeight: '900', letterSpacing: 0.8, marginBottom: 12 }}>WEEKLY ACTIVITY</Text>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 100, paddingTop: 10 }}>
        {data.map((d, idx) => {
          const pct = (d.distance / maxVal) * 100;
          return (
            <View key={idx} style={{ alignItems: 'center', flex: 1 }}>
              <Text style={{ color: d.distance > 0 ? T.green : 'transparent', fontSize: 9, fontWeight: '900', marginBottom: 4 }}>
                {d.distance > 0 ? d.distance.toFixed(1) : ''}
              </Text>
              <View style={{ height: 60, width: 12, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 6, justifyContent: 'flex-end', overflow: 'hidden' }}>
                <View style={{ height: `${pct}%`, width: '100%', backgroundColor: d.distance > 0 ? T.green : 'rgba(255,255,255,0.08)', borderRadius: 6 }} />
              </View>
              <Text style={{ color: d.distance > 0 ? T.white : T.text, fontSize: 10, fontWeight: '800', marginTop: 6 }}>{d.label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ─── Monthly Heatmap Calendar ─────────────────────────────────────────────────
function HeatmapCalendar({ history }: { history: RunRecord[] }) {
  const { T } = useTheme();
  const totalDays = 35;
  const days = Array.from({ length: totalDays }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (totalDays - 1 - i));
    return d;
  });

  const gridData = days.map(day => {
    const dayStr = day.toDateString();
    const dayRuns = history.filter(r => new Date(r.createdAt).toDateString() === dayStr);
    const totalDist = dayRuns.reduce((sum, r) => sum + r.distanceMeters, 0);
    let level: 0 | 1 | 2 | 3 = 0;
    if (totalDist > 0) {
      if (totalDist < 1000) level = 1;
      else if (totalDist < 5000) level = 2;
      else level = 3;
    }
    return { day, level, totalDist };
  });

  const levelColors = {
    0: 'rgba(255,255,255,0.03)',
    1: T.green + '30',
    2: T.green + '85',
    3: T.green,
  };

  return (
    <View style={{ backgroundColor: T.card, borderRadius: 24, borderWidth: 1, borderColor: T.border, padding: 16, marginBottom: 16 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text style={{ color: T.white, fontSize: 13, fontWeight: '900', letterSpacing: 0.8 }}>MONTHLY HEATMAP</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={{ color: T.text, fontSize: 8, fontWeight: '700' }}>LESS</Text>
          {[0, 1, 2, 3].map(lvl => (
            <View key={lvl} style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: levelColors[lvl as 0|1|2|3] }} />
          ))}
          <Text style={{ color: T.text, fontSize: 8, fontWeight: '700' }}>MORE</Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
        {gridData.map((d, idx) => (
          <View
            key={idx}
            style={{
              width: 22, height: 22, borderRadius: 5,
              backgroundColor: levelColors[d.level],
              borderWidth: d.level > 0 ? 0 : 1,
              borderColor: 'rgba(255,255,255,0.05)',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Text style={{ color: d.level > 0 ? '#000' : T.text + '80', fontSize: 8, fontWeight: '900' }}>
              {d.day.getDate()}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Personal Records Highlight Panel ─────────────────────────────────────────
function PersonalRecordsPanel({ history, isMetric }: { history: RunRecord[]; isMetric: boolean }) {
  const { T } = useTheme();
  
  if (history.length === 0) return null;

  const distMult = isMetric ? 1000 : 1609.34;
  const unit = isMetric ? 'km' : 'mi';

  const longestDist = Math.max(...history.map(r => r.distanceMeters), 0) / distMult;
  const largestArea = Math.max(...history.map(r => r.areaSqMeters), 0);
  const validPaceRuns = history.filter(r => r.distanceMeters >= 500);
  const bestPaceRaw = validPaceRuns.length > 0
    ? Math.min(...validPaceRuns.map(r => r.durationSec / (r.distanceMeters / 1000)))
    : null;
  const bestPaceStr = bestPaceRaw
    ? `${Math.floor(bestPaceRaw / 60)}:${String(Math.round(bestPaceRaw % 60)).padStart(2, '0')}/km`
    : '--';

  const streak = (function() {
    const dates = new Set(history.map(r => new Date(r.createdAt).toDateString()));
    let strk = 0;
    let check = new Date();
    if (!dates.has(check.toDateString())) {
      check.setDate(check.getDate() - 1);
    }
    while (dates.has(check.toDateString())) {
      strk++;
      check.setDate(check.getDate() - 1);
    }
    return strk;
  })();

  return (
    <View style={{ backgroundColor: T.card, borderRadius: 24, borderWidth: 1, borderColor: T.border, padding: 16, marginBottom: 16 }}>
      <Text style={{ color: T.white, fontSize: 13, fontWeight: '900', letterSpacing: 0.8, marginBottom: 12 }}>PERSONAL BESTS & STREAK</Text>
      
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {[
          { label: 'RUN STREAK', value: `${streak} days`, icon: 'flame', color: '#FF9F0A' },
          { label: 'LONGEST RUN', value: `${longestDist.toFixed(2)} ${unit}`, icon: 'trophy', color: T.gold },
          { label: 'BEST PACE', value: bestPaceStr, icon: 'speedometer', color: '#00C6FF' },
          { label: 'LARGEST AREA', value: largestArea > 0 ? `${Math.round(largestArea).toLocaleString()} m²` : '--', icon: 'map', color: T.green },
        ].map((item, idx) => (
          <View key={idx} style={{ flex: 1, minWidth: '45%', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 16, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)' }}>
            <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: item.color + '20', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={item.icon as any} size={16} color={item.color} />
            </View>
            <View>
              <Text style={{ color: T.white, fontSize: 13, fontWeight: '900' }}>{item.value}</Text>
              <Text style={{ color: T.text, fontSize: 8, fontWeight: '800', letterSpacing: 0.5, marginTop: 2 }}>{item.label}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function RunHistoryScreen() {
  const { T } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user, profile } = useAuth();
  const [history, setHistory] = useState<RunRecord[]>([]);
  const [isMetric, setIsMetric] = useState(true);
  const [loading, setLoading] = useState(true);
  const [showAllPdfDialog, setShowAllPdfDialog] = useState(false);
  const [replayRun, setReplayRun] = useState<RunRecord | null>(null);
  const headerAnim = useRef(new Animated.Value(0)).current;

  const displayName = profile?.displayName || user?.displayName || 'Runner';

  useEffect(() => {
    (async () => {
      const [h, s] = await Promise.all([getHistory(), getSettings()]);
      setHistory(h);
      setIsMetric(s.units !== 'imperial');
      setLoading(false);
      Animated.spring(headerAnim, { toValue: 1, useNativeDriver: true, tension: 50, friction: 8 }).start();
    })();
  }, []);

  const handleDelete = async (id: string) => {
    await deleteRun(id);
    setHistory(h => h.filter(r => r.id !== id));
  };

  const distMult = isMetric ? 1000 : 1609.34;
  const unitLabel = isMetric ? 'KM' : 'MI';
  const totalDist = history.reduce((s, r) => s + r.distanceMeters, 0);
  const totalTime = history.reduce((s, r) => s + r.durationSec, 0);

  const loops = history.filter(r => r.areaSqMeters > 500 && r.perimeterMeters > 200);
  const opens = history.filter(r => !(r.areaSqMeters > 500 && r.perimeterMeters > 200));

  type FilterTab = 'all' | 'loops' | 'open';
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  const filteredLoops = activeTab === 'open' ? [] : loops;
  const filteredOpens = activeTab === 'loops' ? [] : opens;

  // Section header component
  const SectionHeader = ({ label, count, color, desc }: { label: string; count: number; color: string; desc: string }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8, marginBottom: 10 }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
      <Text style={{ color: T.white, fontSize: 14, fontWeight: '900', flex: 1 }}>{label}</Text>
      <View style={{ backgroundColor: color + '20', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: color + '40' }}>
        <Text style={{ color, fontSize: 10, fontWeight: '900' }}>{count} · {desc}</Text>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: T.black }}>
      <OrbBackground />
      <LinearGradient colors={[T.green + '12', 'transparent']} style={StyleSheet.absoluteFill} pointerEvents="none" />

      <RouteReplayModal run={replayRun} visible={replayRun !== null} onClose={() => setReplayRun(null)} />

      <FlatList
        data={[]}
        keyExtractor={() => ''}
        renderItem={null}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}
        ListHeaderComponent={
          <Animated.View style={{ opacity: headerAnim, transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: insets.top + 16, paddingBottom: 16 }}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { backgroundColor: T.card, borderColor: T.border }]}>
                <Ionicons name="arrow-back" size={20} color={T.white} />
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={{ color: T.white, fontSize: 26, fontWeight: '900', letterSpacing: -0.5 }}>Run History</Text>
                <Text style={{ color: T.text, fontSize: 12, marginTop: 2 }}>
                  {loading ? 'Loading...' : `${history.length} runs · ${loops.length} loops · ${opens.length} open`}
                </Text>
              </View>
            </View>

            {/* Stats */}
            {history.length > 0 && (
              <>
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                  {[
                    { label: 'LOOPS', value: String(loops.length), color: T.green },
                    { label: 'OPEN RUNS', value: String(opens.length), color: '#00C6FF' },
                    { label: unitLabel, value: (totalDist / distMult).toFixed(1), color: T.accent2 },
                    { label: 'HOURS', value: (totalTime / 3600).toFixed(1), color: T.gold },
                  ].map((s, i) => (
                    <View key={i} style={[styles.statCard, { backgroundColor: T.card, borderColor: T.border }]}>
                      <Text style={{ color: s.color, fontSize: 16, fontWeight: '900' }}>{s.value}</Text>
                      <Text style={{ color: T.text, fontSize: 8, fontWeight: '800', letterSpacing: 0.6, marginTop: 2 }}>{s.label}</Text>
                    </View>
                  ))}
                </View>

                {/* Export All */}
                <TouchableOpacity onPress={() => setShowAllPdfDialog(true)} activeOpacity={0.85} style={[styles.exportAllBtn, { backgroundColor: T.card, borderColor: T.border }]}>
                  <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: T.green + '20', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="document-text-outline" size={18} color={T.green} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: T.white, fontSize: 14, fontWeight: '800' }}>Export All as PDF</Text>
                    <Text style={{ color: T.text, fontSize: 11, marginTop: 2 }}>Complete report of all {history.length} runs</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={T.text} />
                </TouchableOpacity>

                {/* Data Visualizations and Streaks */}
                <PersonalRecordsPanel history={history} isMetric={isMetric} />
                <WeeklyBarChart history={history} isMetric={isMetric} />
                <HeatmapCalendar history={history} />
              </>
            )}

            {/* ── Filter tabs ── */}
            {history.length > 0 && (
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                {([
                  { id: 'all',   label: 'All',        count: history.length, color: T.text },
                  { id: 'loops', label: '⬡ Loop Runs', count: loops.length,   color: T.green },
                  { id: 'open',  label: '→ Open Runs', count: opens.length,   color: '#00C6FF' },
                ] as const).map(tab => {
                  const active = activeTab === tab.id;
                  const activeColor = tab.id === 'loops' ? T.green : tab.id === 'open' ? '#00C6FF' : T.white;
                  return (
                    <TouchableOpacity
                      key={tab.id}
                      onPress={() => setActiveTab(tab.id)}
                      style={{
                        flex: 1, paddingVertical: 10, borderRadius: 14, alignItems: 'center',
                        backgroundColor: active ? activeColor + '18' : T.card,
                        borderWidth: 1.5,
                        borderColor: active ? activeColor + '60' : T.border,
                      }}
                    >
                      <Text style={{ color: active ? activeColor : T.text, fontSize: 11, fontWeight: active ? '900' : '600' }}>{tab.label}</Text>
                      <Text style={{ color: active ? activeColor : T.text, fontSize: 10, fontWeight: '700', marginTop: 1, opacity: 0.7 }}>{tab.count}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* ── LOOP RUNS section ── */}
            {filteredLoops.length > 0 && (
              <>
                {activeTab === 'all' && <SectionHeader label="Loop Runs" count={filteredLoops.length} color={T.green} desc="Territory eligible" />}
                {filteredLoops.map((run, i) => (
                  <RunRow key={run.id} run={run} index={i} isMetric={isMetric} displayName={displayName} onDelete={() => handleDelete(run.id)} onReplay={() => setReplayRun(run)} />
                ))}
              </>
            )}

            {/* ── OPEN RUNS section ── */}
            {filteredOpens.length > 0 && (
              <>
                {activeTab === 'all' && <SectionHeader label="Open Runs" count={filteredOpens.length} color="#00C6FF" desc="Fitness only" />}
                {filteredOpens.map((run, i) => (
                  <RunRow key={run.id} run={run} index={i} isMetric={isMetric} displayName={displayName} onDelete={() => handleDelete(run.id)} onReplay={() => setReplayRun(run)} />
                ))}
              </>
            )}

            {/* Empty state */}
            {!loading && history.length === 0 && (
              <View style={{ alignItems: 'center', paddingVertical: 60 }}>
                <View style={[styles.emptyIcon, { backgroundColor: T.card, borderColor: T.border }]}>
                  <Ionicons name="fitness-outline" size={40} color={T.text} />
                </View>
                <Text style={{ color: T.white, fontSize: 18, fontWeight: '800', marginTop: 16 }}>No runs yet</Text>
                <Text style={{ color: T.text, fontSize: 13, marginTop: 8, textAlign: 'center' }}>Start running to build your history</Text>
              </View>
            )}
          </Animated.View>
        }
        ListEmptyComponent={null}
      />

      <PdfDialog
        visible={showAllPdfDialog}
        defaultName={`RunQuest_AllRuns_${displayName.replace(/\s+/g, '_')}.pdf`}
        title="Export All Runs"
        subtitle={`Complete PDF report of all ${history.length} runs`}
        onCancel={() => setShowAllPdfDialog(false)}
        onExport={async (name) => {
          setShowAllPdfDialog(false);
          await exportAllRunsAsPDF(history, isMetric, displayName, name);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  statCard: { flex: 1, borderRadius: 16, borderWidth: 1, padding: 14, alignItems: 'center' },
  exportAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 16 },
  row: { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 10, overflow: 'hidden' },
  iconWrap: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10 },
  emptyIcon: { width: 80, height: 80, borderRadius: 24, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
