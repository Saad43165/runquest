import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
  Modal, FlatList, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/utils/ThemeContext';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import { setMusicState } from '../hooks/useMusicStore';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, db } from '../services/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';

interface Track { uri: string; name: string; }
interface Props { visible?: boolean; topOffset?: number; }

const MUSIC_LOCAL_KEY = 'runquest:musicTracks';

// ─── Marquee — scrolling text for long song names ────────────────────────────
export function Marquee({ text, style, containerStyle }: {
  text: string;
  style?: any;
  containerStyle?: any;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [textWidth, setTextWidth] = useState(0);
  const needsScroll = textWidth > containerWidth && containerWidth > 0;

  useEffect(() => {
    if (animRef.current) { animRef.current.stop(); animRef.current = null; }
    translateX.setValue(0);

    if (!needsScroll) return;

    const gap = 40; // gap between end and restart
    const totalScroll = textWidth + gap;
    const speed = 40; // pixels per second
    const duration = (totalScroll / speed) * 1000;

    animRef.current = Animated.loop(
      Animated.sequence([
        Animated.delay(1200), // pause at start
        Animated.timing(translateX, {
          toValue: -totalScroll,
          duration,
          useNativeDriver: true,
        }),
        Animated.delay(400),
      ])
    );
    animRef.current.start();

    return () => { animRef.current?.stop(); };
  }, [needsScroll, textWidth, containerWidth, text]);

  // Reset when text changes
  useEffect(() => {
    if (animRef.current) { animRef.current.stop(); animRef.current = null; }
    translateX.setValue(0);
  }, [text]);

  return (
    <View
      style={[{ overflow: 'hidden' }, containerStyle]}
      onLayout={e => setContainerWidth(e.nativeEvent.layout.width)}
    >
      <Animated.View style={{ flexDirection: 'row', transform: [{ translateX }] }}>
        <Text
          style={style}
          numberOfLines={1}
          onLayout={e => setTextWidth(e.nativeEvent.layout.width)}
        >
          {text}
        </Text>
        {/* Ghost copy for seamless loop */}
        {needsScroll && (
          <Text style={[style, { marginLeft: 40 }]} numberOfLines={1}>
            {text}
          </Text>
        )}
      </Animated.View>
    </View>
  );
}

// Save tracks to both AsyncStorage (local) and Firestore (cloud)
async function saveTracks(tracks: Track[]): Promise<void> {
  try {
    const data = JSON.stringify(tracks);
    await AsyncStorage.setItem(MUSIC_LOCAL_KEY, data);
    const uid = auth.currentUser?.uid;
    if (uid) {
      await setDoc(doc(db, 'users', uid, 'meta', 'music'), { tracks }, { merge: true });
    }
  } catch {}
}

// Load tracks from Firestore first, fallback to AsyncStorage
async function loadTracks(): Promise<Track[]> {
  try {
    const uid = auth.currentUser?.uid;
    if (uid) {
      const snap = await getDoc(doc(db, 'users', uid, 'meta', 'music'));
      if (snap.exists()) {
        const data = snap.data();
        if (Array.isArray(data.tracks) && data.tracks.length > 0) {
          // Also update local cache
          await AsyncStorage.setItem(MUSIC_LOCAL_KEY, JSON.stringify(data.tracks));
          return data.tracks as Track[];
        }
      }
    }
    // Fallback to local
    const raw = await AsyncStorage.getItem(MUSIC_LOCAL_KEY);
    if (raw) return JSON.parse(raw) as Track[];
  } catch {}
  return [];
}

export function MusicPlayer({ visible = true, topOffset = 10 }: Props) {
  const { T, themeName } = useTheme();
  const isLight = themeName === 'light';

  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showLibrary, setShowLibrary] = useState(false);
  const [loadingTracks, setLoadingTracks] = useState(true);

  const player = useAudioPlayer('https://empty', { updateInterval: 500 });
  const status = useAudioPlayerStatus(player);

  const isPlaying = status?.playing ?? false;
  const positionSec = status?.currentTime ?? 0;
  const durationSec = status?.duration ?? 0;
  const isLoading = status?.isBuffering ?? false;

  const tracksRef = useRef<Track[]>([]);
  tracksRef.current = tracks;

  // Load saved tracks on mount — only load, don't auto-play
  useEffect(() => {
    loadTracks().then(async saved => {
      if (saved.length > 0) {
        setTracks(saved);
        // Do NOT auto-play — user must explicitly press play
      }
      setLoadingTracks(false);
    });
  }, []);

  // Slide-in anim (-250 starts completely off-screen top)
  const slideAnim = useRef(new Animated.Value(-250)).current;
  const seekBarLayout = useRef({ x: 0, width: 0 });

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'mixWithOthers',
    }).catch(() => { });
  }, []);

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 0 : -250,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
    // Stop music when player is hidden
    if (!visible && isPlaying) {
      try { player.pause(); } catch {}
    }
  }, [visible]);

  // Ensure initial state is correct
  useEffect(() => {
    if (!visible) slideAnim.setValue(-250);
  }, []);
  // Load track when index changes — only load, don't auto-play on mount
  const loadedIndexRef = useRef(-1);
  const hasUserInteracted = useRef(false); // only play after user explicitly taps play
  const [brokenTracks, setBrokenTracks] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (tracks.length === 0) return;
    if (loadedIndexRef.current === currentIndex) return;
    loadedIndexRef.current = currentIndex;
    const track = tracks[currentIndex];
    if (!track) return;
    setBrokenTracks(prev => { const n = new Set(prev); n.delete(currentIndex); return n; });
    try {
      player.replace({ uri: track.uri });
      // Only auto-play if user has already interacted (not on initial load)
      if (hasUserInteracted.current) {
        player.play();
      }
    } catch (e) {
      console.warn('Player error loading track:', e);
      setBrokenTracks(prev => new Set([...prev, currentIndex]));
    }
  }, [currentIndex, tracks]);

  // Auto-advance to next track
  const didFinishRef = useRef(false);
  useEffect(() => {
    if (status?.didJustFinish && !didFinishRef.current) {
      didFinishRef.current = true;
      loadedIndexRef.current = -1;
      setCurrentIndex(i => (i + 1) % Math.max(tracks.length, 1));
    } else if (!status?.didJustFinish) {
      didFinishRef.current = false;
    }
  }, [status?.didJustFinish, tracks.length]);

  // Sync music state to store for the RunScreen pill
  const fns = useRef({
    onToggle: () => { }, onNext: () => { }, onPrev: () => { }, onPickMusic: () => { }, onSeek: (_s: number) => { }
  });

  const togglePlay = useCallback(() => {
    if (tracksRef.current.length === 0) { pickMusic(); return; }
    hasUserInteracted.current = true;
    try {
      if (status?.playing) { player.pause(); } else { player.play(); }
    } catch { }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [status?.playing]);

  const playNext = useCallback(() => {
    if (!tracksRef.current.length) return;
    loadedIndexRef.current = -1;
    setCurrentIndex(i => (i + 1) % tracksRef.current.length);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const playPrev = useCallback(() => {
    if (!tracksRef.current.length) return;
    // If more than 3 seconds in, restart; else go to previous
    if (positionSec > 3 && durationSec > 0) {
      try { player.seekTo(0); } catch { }
    } else {
      loadedIndexRef.current = -1;
      setCurrentIndex(i => (i - 1 + tracksRef.current.length) % tracksRef.current.length);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [positionSec, durationSec]);

  const seekTo = useCallback((sec: number) => {
    try { player.seekTo(sec); } catch { }
  }, []);

  const pickMusic = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      if (result.assets && result.assets.length > 0) {
        addTracks(result.assets.map(a => ({
          uri: a.uri,
          name: (a.name || 'Unknown').replace(/\.[^.]+$/, ''),
        })));
      }
    } catch (err) {
      console.warn('Document picker error:', err);
    }
  };

  const addTracks = (newTracks: Track[]) => {
    const current = tracksRef.current;
    const wasEmpty = current.length === 0;
    const merged = [...current];
    for (const t of newTracks) {
      // Deduplicate by name (not URI, since URI changes between sessions)
      if (!merged.find(m => m.name === t.name)) merged.push(t);
    }
    setTracks(merged);
    saveTracks(merged); // persist
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (wasEmpty && merged.length > 0) {
      loadedIndexRef.current = -1;
      setCurrentIndex(0);
    }
  };

  // Update stable refs
  fns.current = { onToggle: togglePlay, onNext: playNext, onPrev: playPrev, onPickMusic: pickMusic, onSeek: seekTo };
  const stable = useRef({
    onToggle: () => fns.current.onToggle(),
    onNext: () => fns.current.onNext(),
    onPrev: () => fns.current.onPrev(),
    onPickMusic: () => fns.current.onPickMusic(),
    onSeek: (s: number) => fns.current.onSeek(s),
  }).current;

  useEffect(() => {
    setMusicState({ isPlaying: false, trackName: '', positionMs: 0, durationMs: 0, ...stable });
  }, []);

  useEffect(() => {
    setMusicState({
      isPlaying,
      trackName: tracks[currentIndex]?.name ?? '',
      positionMs: positionSec * 1000,
      durationMs: durationSec * 1000,
    });
  }, [isPlaying, currentIndex, tracks, positionSec, durationSec]);

  // Compute progress for seek bar
  const liveProgress = durationSec > 0 ? positionSec / durationSec : 0;
  const displayProgress = liveProgress;
  const displayPositionSec = displayProgress * durationSec;

  const fmt = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  const handleSeekPress = (e: any) => {
    const { locationX } = e.nativeEvent;
    const ratio = Math.max(0, Math.min(1, locationX / (seekBarLayout.current.width || 1)));
    if (durationSec > 0) {
      seekTo(ratio * durationSec);
    }
  };

  const trackName = tracks[currentIndex]?.name ?? '';
  const bg = isLight ? 'rgba(255,255,255,0.97)' : 'rgba(12,12,14,0.97)';
  const borderColor = isLight ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.10)';

  return (
    <>
      <Animated.View
        style={[
          styles.pill,
          {
            top: topOffset,
            backgroundColor: bg,
            borderColor,
            transform: [{ translateY: slideAnim }],
          },
        ]}
        pointerEvents={visible ? 'auto' : 'none'}
      >
        {/* ── Row 1: Album art + Track Info + Add button ── */}
        <TouchableOpacity
          onPress={() => setShowLibrary(true)}
          activeOpacity={0.85}
          style={styles.infoRow}
        >
          <View style={[styles.albumArt, { backgroundColor: T.green + '18', borderColor: T.green + '30', borderWidth: 1 }]}>
            {isPlaying ? (
              <View style={styles.barsContainer}>
                {[0.5, 1.0, 0.65, 0.85, 0.4].map((h, i) => (
                  <View key={i} style={[styles.bar, { height: 14 * h, backgroundColor: T.green }]} />
                ))}
              </View>
            ) : (
              <Ionicons name="musical-note" size={17} color={T.green} />
            )}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Marquee
              text={trackName || 'Tap here to open library'}
              style={[styles.trackName, { color: isLight ? '#111' : '#FFF' }]}
              containerStyle={{ flex: 1 }}
            />
            <Text style={[styles.trackSub, { color: isLight ? '#888' : 'rgba(255,255,255,0.5)' }]}>
              {tracks.length > 0 ? `Track ${currentIndex + 1} of ${tracks.length}` : 'No music loaded'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={pickMusic}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={[styles.addBtn, { backgroundColor: T.green + '18', borderColor: T.green + '30', borderWidth: 1 }]}
          >
            <Ionicons name="add" size={18} color={T.green} />
          </TouchableOpacity>
        </TouchableOpacity>

        {/* ── Row 2: Playback Controls ── */}
        <View style={styles.controlsRow}>
          <TouchableOpacity
            onPress={() => seekTo(Math.max(0, positionSec - 10))}
            disabled={!tracks.length}
            style={styles.ctrlBtn}
          >
            <Ionicons
              name="play-back"
              size={17}
              color={tracks.length ? (isLight ? '#444' : '#AAA') : (isLight ? '#CCC' : '#444')}
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={playPrev}
            disabled={tracks.length < 1}
            style={styles.ctrlBtn}
          >
            <Ionicons
              name="play-skip-back"
              size={21}
              color={tracks.length ? (isLight ? '#111' : '#FFF') : (isLight ? '#CCC' : '#444')}
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={togglePlay}
            style={[styles.playBtn, { backgroundColor: T.green, shadowColor: T.green }]}
          >
            {isLoading
              ? <ActivityIndicator size="small" color="#000" />
              : <Ionicons name={isPlaying ? 'pause' : 'play'} size={19} color="#000" />
            }
          </TouchableOpacity>

          <TouchableOpacity
            onPress={playNext}
            disabled={tracks.length < 2}
            style={styles.ctrlBtn}
          >
            <Ionicons
              name="play-skip-forward"
              size={21}
              color={tracks.length > 1 ? (isLight ? '#111' : '#FFF') : (isLight ? '#CCC' : '#444')}
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => seekTo(Math.min(durationSec, positionSec + 10))}
            disabled={!tracks.length}
            style={styles.ctrlBtn}
          >
            <Ionicons
              name="play-forward"
              size={17}
              color={tracks.length ? (isLight ? '#444' : '#AAA') : (isLight ? '#CCC' : '#444')}
            />
          </TouchableOpacity>
        </View>

        {/* ── Row 3: Seekbar at the bottom ── */}
        <View style={styles.seekContainer}>
          <Text style={[styles.timeLabel, { color: isLight ? '#888' : 'rgba(255,255,255,0.5)' }]}>
            {fmt(displayPositionSec)}
          </Text>
          <TouchableOpacity
            activeOpacity={1}
            onPress={handleSeekPress}
            onLayout={e => {
              seekBarLayout.current.width = e.nativeEvent.layout.width;
            }}
            style={styles.seekBar}
          >
            <View style={[styles.seekTrack, { backgroundColor: isLight ? '#E0E0E0' : 'rgba(255,255,255,0.12)' }]}>
              <View style={[styles.seekFill, { width: `${displayProgress * 100}%`, backgroundColor: T.green }]}>
                <View style={[styles.seekThumb, { backgroundColor: T.green, borderColor: isLight ? '#FFF' : '#0A0A0A' }]} />
              </View>
            </View>
          </TouchableOpacity>
          <Text style={[styles.timeLabel, { color: isLight ? '#888' : 'rgba(255,255,255,0.5)' }]}>
            {fmt(durationSec)}
          </Text>
        </View>
      </Animated.View>

      {/* ── Library Sheet Modal ── */}
      <Modal visible={showLibrary} transparent animationType="slide" onRequestClose={() => setShowLibrary(false)}>
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}
          activeOpacity={1}
          onPress={() => setShowLibrary(false)}
        />
        <View style={[styles.librarySheet, { backgroundColor: isLight ? '#FFF' : '#111', borderColor: isLight ? '#EEE' : 'rgba(255,255,255,0.08)' }]}>
          <View style={[styles.sheetHandle, { backgroundColor: isLight ? '#DDD' : '#444' }]} />

          <View style={styles.libraryHeader}>
            <Text style={{ color: isLight ? '#000' : '#FFF', fontSize: 20, fontWeight: '900' }}>
              Music Library
            </Text>
            <TouchableOpacity
              onPress={pickMusic}
              style={[styles.libraryAddBtn, { backgroundColor: T.green }]}
            >
              <Ionicons name="add" size={18} color="#000" />
              <Text style={{ color: '#000', fontWeight: '800', fontSize: 13 }}>Add Music</Text>
            </TouchableOpacity>
          </View>

          {tracks.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="musical-notes-outline" size={52} color={isLight ? '#CCC' : '#666'} />
              <Text style={{ color: isLight ? '#888' : '#AAA', fontSize: 16, fontWeight: '700', marginTop: 14 }}>
                No tracks yet
              </Text>
              <Text style={{ color: isLight ? '#AAA' : '#888', fontSize: 13, marginTop: 6, textAlign: 'center' }}>
                Tap "Add Music" to load from your device
              </Text>
              <TouchableOpacity
                onPress={pickMusic}
                style={[styles.emptyAddBtn, { backgroundColor: T.green }]}
              >
                <Ionicons name="add" size={20} color="#000" />
                <Text style={{ color: '#000', fontWeight: '900', fontSize: 15 }}>Pick Audio Files</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={tracks}
              keyExtractor={t => t.uri}
              showsVerticalScrollIndicator={false}
              renderItem={({ item, index }) => {
                const isActive = index === currentIndex;
                const isBroken = brokenTracks.has(index);
                return (
                  <TouchableOpacity
                    onPress={() => {
                      loadedIndexRef.current = -1;
                      hasUserInteracted.current = true;
                      setBrokenTracks(prev => { const n = new Set(prev); n.delete(index); return n; });
                      setCurrentIndex(index);
                      setShowLibrary(false);
                    }}
                    style={[styles.trackRow, {
                      borderBottomColor: isLight ? '#F0F0F0' : 'rgba(255,255,255,0.05)',
                      backgroundColor: isActive ? T.green + '10' : 'transparent',
                    }]}
                  >
                    <View style={[styles.trackNumBadge, { backgroundColor: isActive ? T.green + '25' : (isLight ? '#F5F5F5' : '#222') }]}>
                      {isActive && isPlaying
                        ? <Ionicons name="volume-high" size={13} color={T.green} />
                        : isBroken
                          ? <Ionicons name="warning-outline" size={13} color="#FF9F0A" />
                          : <Text style={{ color: isActive ? T.green : (isLight ? '#888' : '#AAA'), fontSize: 11, fontWeight: '700' }}>{index + 1}</Text>
                      }
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Marquee
                        text={item.name}
                        style={{ color: isBroken ? '#FF9F0A' : isActive ? T.green : (isLight ? '#111' : '#FFF'), fontSize: 14, fontWeight: isActive ? '800' : '600' }}
                        containerStyle={{ flex: 1 }}
                      />
                      {isBroken && (
                        <Text style={{ color: '#FF9F0A', fontSize: 10, marginTop: 1 }}>File unavailable — tap to retry or delete</Text>
                      )}
                    </View>
                    {/* Delete button */}
                    <TouchableOpacity
                      onPress={() => {
                        const newTracks = tracks.filter((_, i) => i !== index);
                        setTracks(newTracks);
                        saveTracks(newTracks);
                        setBrokenTracks(prev => {
                          const n = new Set<number>();
                          prev.forEach(bi => { if (bi < index) n.add(bi); else if (bi > index) n.add(bi - 1); });
                          return n;
                        });
                        if (index === currentIndex) {
                          try { player.pause(); } catch { }
                          loadedIndexRef.current = -1;
                          setCurrentIndex(newTracks.length > 0 ? 0 : 0);
                        } else if (index < currentIndex) {
                          setCurrentIndex(c => c - 1);
                        }
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      }}
                      hitSlop={{ top: 10, bottom: 10, left: 12, right: 10 }}
                      style={[styles.deleteTrackBtn, { backgroundColor: T.red + '15' }]}
                    >
                      <Ionicons name="trash-outline" size={15} color={T.red} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  pill: {
    position: 'absolute',
    left: 14,
    right: 14,
    borderRadius: 26,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 12,
    overflow: 'visible',
    paddingTop: 14,
    paddingBottom: 14,
    paddingHorizontal: 16,
    gap: 10,
    zIndex: 600,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  albumArt: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    height: 14,
  },
  bar: {
    width: 3,
    borderRadius: 2,
  },
  trackName: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  trackSub: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  ctrlBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  playBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
    marginHorizontal: 6,
  },
  seekContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeLabel: {
    fontSize: 10,
    fontWeight: '700',
    minWidth: 32,
    textAlign: 'center',
  },
  seekBar: {
    flex: 1,
    height: 28,
    justifyContent: 'center',
  },
  seekTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'visible',
  },
  seekFill: {
    height: '100%',
    borderRadius: 2,
    position: 'relative',
  },
  seekThumb: {
    position: 'absolute',
    right: -7,
    top: -5,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2.5,
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },

  // Library Sheet
  librarySheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: 20,
    paddingBottom: 48,
    maxHeight: '72%',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 18,
  },
  libraryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  libraryAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 22,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 4,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 22,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 22,
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  trackNumBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteTrackBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
});
