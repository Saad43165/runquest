import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Modal,
  TextInput, Alert, ActivityIndicator, Linking, AppState, PanResponder,
  ScrollView, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useIsFocused } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useTheme } from '@/utils/ThemeContext';
import { usePremium } from '@/context/PremiumContext';
import * as Speech from 'expo-speech';
import MapRunView, { MapRunViewRef } from '@/components/MapRunView';
import { useRunTracker } from '@/hooks/useRunTracker';
import { Territory } from '@/types';
import { subscribeTerritories, claimAndConquerRemote } from '@/services/territoriesRemote';
import { LiveUser, subscribeLiveUsers, updatePresence, stopPresence } from '@/services/presenceService';
import { getSettings, Settings } from '@/config/settings';
import { subscribeSettingsChange } from '@/config/settingsEvents';
import { fetchLocalWeather, WeatherData } from '@/services/weatherService';
import { fetchMotivationalQuote, QuoteData } from '@/services/quoteService';
import { getHistory, RunRecord, deleteRun } from '@/services/history';
import { emitAchievementsCheck, subscribeAchievementEvents } from '@/hooks/useAchievementEvents';
import { computeAchievements, Achievement } from '@/utils/computeAchievements';
import { getMusicState, subscribeMusicState } from '@/hooks/useMusicStore';
import { setRunStore } from '@/store/useRunStore';
import { pathDistance, distanceToStart, polygonAreaSqMeters } from '@/utils/geometry';
import { NotificationService } from '@/services/notificationService';
import { ItemSpawn, spawnNearbyItems, collectLootItems, updateQuestProgress } from '@/services/inventoryService';
import { playSound, preloadSounds, unloadAllSounds, setSoundEnabled } from '@/services/soundService';

// Modular Components
import ConfirmStop from '@/components/run/ConfirmStop';
import RunGauge from '@/components/run/RunGauge';
import LastRunBar from '@/components/run/LastRunBar';
import AchievementModal from '@/components/run/AchievementModal';
import RunSummaryModal from '@/components/run/RunSummaryModal';
import WeatherModal from '@/components/run/WeatherModal';
import BugReportModal from '@/components/run/BugReportModal';
import RunBotFAB from '@/components/run/RunBotFAB';
import RunBotHelpModal from '@/components/run/RunBotHelpModal';
import RunMusicControl from '@/components/run/RunMusicControl';
import { MusicPlayer, Marquee } from '@/components/MusicPlayer';
import CoachmarksOverlay from '@/components/run/CoachmarksOverlay';


const getPacerOptions = (isMetric: boolean) => [
  { label: 'No Pacer', pace: 0 },
  { label: isMetric ? '4:30 /km' : '7:00 /mi', pace: isMetric ? 4.5 : 7.0 },
  { label: isMetric ? '5:00 /km' : '8:00 /mi', pace: isMetric ? 5.0 : 8.0 },
  { label: isMetric ? '5:30 /km' : '9:00 /mi', pace: isMetric ? 5.5 : 9.0 },
  { label: isMetric ? '6:00 /km' : '10:00 /mi', pace: isMetric ? 6.0 : 10.0 },
  { label: isMetric ? '7:00 /km' : '11:00 /mi', pace: isMetric ? 7.0 : 11.0 },
];

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function RunScreen() {
  const { T, themeName } = useTheme();
  const isLight = themeName === 'light';
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const isFocused = useIsFocused();
  const { status } = usePremium();
  const userTier = status.tier || 'free';
  const { state, path, region, accuracyMeters, headingDeg, altitudeMeters, startRun, pauseRun, resumeRun, stopRun, reset, recenter, closedLoop, isSaving, startedAt, totalPausedMs, pausedAt } = useRunTracker();
  const prevClosedLoop = useRef<boolean>(false);
  const [showLoopToast, setShowLoopToast] = useState(false);

  // Spawning and collecting loot items
  const [spawnedItems, setSpawnedItems] = useState<ItemSpawn[]>([]);
  const [collectedNotification, setCollectedNotification] = useState<string | null>(null);

  // Spawn items once when state transitions to 'running'
  const prevRunState = useRef<string>('idle');
  useEffect(() => {
    if (state === 'running' && prevRunState.current !== 'running' && region) {
      setSpawnedItems(spawnNearbyItems(region.latitude, region.longitude));
    } else if (state === 'idle') {
      setSpawnedItems([]);
    }
    prevRunState.current = state;
  }, [state, region]);

  // Check for item collection when user location (region) updates
  useEffect(() => {
    if (state === 'running' && region && spawnedItems.length > 0) {
      collectLootItems(region.latitude, region.longitude, spawnedItems).then(({ collectedItems, updatedItemsList, rewardSummary }) => {
        if (collectedItems.length > 0) {
          setSpawnedItems(updatedItemsList);
          setCollectedNotification(rewardSummary);
          playSound('loot_collected');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          const timer = setTimeout(() => {
            setCollectedNotification(prev => prev === rewardSummary ? null : prev);
          }, 3500);
        }
      });
    }
  }, [region, state, spawnedItems]);

  const [territories, setTerritories] = useState<Territory[]>([]);
  const [liveUsers, setLiveUsers] = useState<LiveUser[]>([]);
  const [showPolygons, setShowPolygons] = useState(true);
  const [showPath, setShowPath] = useState(true);
  const [tileStyle, setTileStyle] = useState<'default' | 'dark' | 'satellite' | '3d'>('dark');
  const [elapsed, setElapsed] = useState(0);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [quoteIndex, setQuoteIndex] = useState(0);
  const quotesRef = useRef<QuoteData[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [locationName, setLocationName] = useState<string | null>(null);

  const [summary, setSummary] = useState<any | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [showWeatherModal, setShowWeatherModal] = useState(false);
  const [showBotHelp, setShowBotHelp] = useState(false);
  const [showBugReport, setShowBugReport] = useState(false);
  const [showShortRunDialog, setShowShortRunDialog] = useState(false);
  const [shortRunMessage, setShortRunMessage] = useState('');
  const [showPauseWarning, setShowPauseWarning] = useState(false);
  const pausePositionRef = useRef<{ lat: number; lng: number } | null>(null);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [showHub, setShowHub] = useState(false);
  const [showCoachmarks, setShowCoachmarks] = useState(false);

  // ── Countdown before run ──────────────────────────────────────────────────
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownAnim = useRef(new Animated.Value(0)).current;

  // ── Milestone tracking (distance) ─────────────────────────────────────────
  const lastMilestoneKm = useRef(0);
  const lastVoiceTimeRef = useRef<number>(0);

  const speakStatus = (sec: number) => {
    if (userTier !== 'elite' && userTier !== 'pro') return;
    if (settings?.voiceCoachEnabled === false) return;

    const mins = Math.floor(sec / 60);
    // Speak at each minute mark (1min, 2min, etc.)
    if (mins > 0 && sec % 60 === 0 && lastVoiceTimeRef.current !== sec) {
      lastVoiceTimeRef.current = sec;
      const isMetric = settings?.units !== 'imperial';
      const dist = pathDistance(path);
      const distKm = dist / (isMetric ? 1000 : 1609.34);
      const distStr = distKm.toFixed(2) + (isMetric ? ' kilometers' : ' miles');

      // Pace
      const currentPaceMinPerKm = dist > 50 ? (sec / 60) / distKm : 0;
      let paceMsg = '';
      if (currentPaceMinPerKm > 0) {
        const pMin = Math.floor(currentPaceMinPerKm);
        const pSec = Math.round((currentPaceMinPerKm - pMin) * 60);
        paceMsg = ` Pace: ${pMin} minutes ${pSec} seconds per ${isMetric ? 'kilometer' : 'mile'}.`;

        // Zone coaching
        if (currentPaceMinPerKm > 8) paceMsg += ' Easy zone. Great for recovery.';
        else if (currentPaceMinPerKm > 6) paceMsg += ' Aerobic zone. Keep it up!';
        else if (currentPaceMinPerKm > 5) paceMsg += ' Tempo zone. Strong effort!';
        else if (currentPaceMinPerKm > 4) paceMsg += ' High intensity zone. Push through!';
        else paceMsg += ' Maximum effort. Outstanding!';
      }

      let message = `${mins} minute${mins === 1 ? '' : 's'}. ${distStr}.${paceMsg}`;

      // Pacer delta
      if (settings?.pacerEnabled && (userTier === 'elite' || userTier === 'pro')) {
        const pPace = settings.pacerPaceMinPerKm || 5.5;
        const pDist = ((sec / 60) / pPace) * (isMetric ? 1000 : 1609.34);
        const diff = dist - pDist;
        const absDiff = Math.round(Math.abs(diff));
        if (absDiff > 5) {
          message += diff >= 0
            ? ` ${absDiff} meters ahead of pacer.`
            : ` ${absDiff} meters behind pacer. Pick it up!`;
        } else {
          message += ' On pace. Perfect.';
        }
      }

      // Motivational nudge at key minutes
      if (mins === 5) message += ' Five minutes done. Great start!';
      else if (mins === 10) message += ' Ten minutes. Keep the momentum!';
      else if (mins === 20) message += ' Twenty minutes. You are doing amazing!';
      else if (mins === 30) message += ' Half hour! Incredible effort!';

      Speech.speak(message, { rate: 0.92, pitch: 1.0 });
    }
  };

  const startBtnPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let anim: Animated.CompositeAnimation | null = null;
    if (state === 'idle') {
      startBtnPulse.setValue(1);
      anim = Animated.loop(
        Animated.sequence([
          Animated.timing(startBtnPulse, { toValue: 1.04, duration: 1100, useNativeDriver: true }),
          Animated.timing(startBtnPulse, { toValue: 1, duration: 1100, useNativeDriver: true }),
        ])
      );
      anim.start();
    } else {
      startBtnPulse.setValue(1);
    }
    return () => {
      if (anim) anim.stop();
    };
  }, [state]);

  const startWithCountdown = () => {
    setCountdown(3);
    countdownAnim.setValue(0);
    lastMilestoneKm.current = 0;
  };

  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      // Show GO! for 600ms then actually start
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      playSound('countdown_go');
      countdownAnim.setValue(0);
      Animated.timing(countdownAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
      const t = setTimeout(() => {
        setCountdown(null);
        startRun();
        playSound('run_start');
        if (settings?.voiceCoachEnabled !== false && (userTier === 'elite' || userTier === 'pro')) {
          let startupText = 'Run started.';
          if (settings?.pacerEnabled) {
            const isMetric = settings.units !== 'imperial';
            startupText += ` Virtual pacer target set to ${settings.pacerPaceMinPerKm} minutes per ${isMetric ? 'kilometer' : 'mile'}.`;
          }
          startupText += ' Have a great workout!';
          Speech.speak(startupText, { rate: 0.95 });
        }
      }, 700);
      return () => clearTimeout(t);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    playSound('countdown_tick');
    countdownAnim.setValue(0);
    Animated.timing(countdownAnim, { toValue: 1, duration: 900, useNativeDriver: true }).start();
    const t = setTimeout(() => setCountdown(c => (c !== null ? c - 1 : null)), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // ── Run goal ──────────────────────────────────────────────────────────────
  type GoalType = 'none' | 'distance' | 'time';
  const GOAL_OPTIONS: { type: GoalType; label: string; valueKm: number; valueSec: number }[] = [
    { type: 'none',     label: 'No Goal', valueKm: 0,    valueSec: 0    },
    { type: 'distance', label: '1 km',    valueKm: 1,    valueSec: 0    },
    { type: 'distance', label: '3 km',    valueKm: 3,    valueSec: 0    },
    { type: 'distance', label: '5 km',    valueKm: 5,    valueSec: 0    },
    { type: 'distance', label: '10 km',   valueKm: 10,   valueSec: 0    },
    { type: 'time',     label: '15 min',  valueKm: 0,    valueSec: 900  },
    { type: 'time',     label: '30 min',  valueKm: 0,    valueSec: 1800 },
    { type: 'time',     label: '60 min',  valueKm: 0,    valueSec: 3600 },
  ];
  const [goalIndex, setGoalIndex] = useState(0);
  const goal = GOAL_OPTIONS[goalIndex];

  // Reset goal when run resets to idle
  useEffect(() => {
    if (state === 'idle') setGoalIndex(0);
  }, [state]);
  const dashAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const dashHeightAnim = useRef(new Animated.Value(1)).current;
  const [mapFocusMode, setMapFocusMode] = useState(false);

  const [showMusicPill, setShowMusicPill] = useState(false);
  const headerHideAnim = useRef(new Animated.Value(1)).current; // 1=visible 0=hidden
  const [musicState, setMusicStateLocal] = useState(getMusicState());
  const [locationPermission, setLocationPermission] = useState<'granted' | 'denied' | 'checking'>('checking');

  // Close pill and restore header
  const closeMusicPill = () => {
    setShowMusicPill(false);
    Animated.spring(headerHideAnim, { toValue: 1, useNativeDriver: true, tension: 70, friction: 10 }).start();
  };

  // Open pill and hide header
  const openMusicPill = () => {
    setShowMusicPill(true);
    setShowMapPicker(false); // close map picker if open
    Animated.timing(headerHideAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
  };

  useEffect(() => {
    const unsub = subscribeMusicState(() => setMusicStateLocal({ ...getMusicState() }));
    return unsub;
  }, []);

  // Re-check location permission when app comes back to foreground
  // (user may have enabled it in device Settings)
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (nextState) => {
      if (nextState === 'active') {
        const { status } = await Location.getForegroundPermissionsAsync();
        setLocationPermission(status === 'granted' ? 'granted' : 'denied');
      }
    });
    return () => sub.remove();
  }, []);

  // Close music pill if music player is disabled in settings
  useEffect(() => {
    if (settings?.showMusicPlayer === false && showMusicPill) {
      closeMusicPill();
    }
  }, [settings?.showMusicPlayer]);
  // Achievement popup after run completes
  const [runAchievementPopup, setRunAchievementPopup] = useState<{ title: string; description: string; icon: string; tier: string; color: string; xp: number } | null>(null);
  const [achievementQueue, setAchievementQueue] = useState<typeof runAchievementPopup[]>([]);
  const prevAchievementIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Load previously seen achievement IDs on mount
    AsyncStorage.getItem('runquest:seenAchievements').then(raw => {
      if (raw) {
        try { prevAchievementIds.current = new Set(JSON.parse(raw)); } catch { }
      }
    });
  }, []);

  useEffect(() => {
    const unsub = subscribeAchievementEvents(async (history: RunRecord[]) => {
      try {
        const all = computeAchievements(history);
        const earned = all.filter((a: Achievement) => a.achieved);
        const newOnes = earned.filter((a: Achievement) => !prevAchievementIds.current.has(a.id));
        if (newOnes.length > 0) {
          const newIds = new Set([...prevAchievementIds.current, ...newOnes.map((a: Achievement) => a.id)]);
          prevAchievementIds.current = newIds;
          AsyncStorage.setItem('runquest:seenAchievements', JSON.stringify([...newIds]));
          const TIER_COLORS: Record<string, string> = {
            bronze: '#CD7F32', silver: '#C0C0C0', gold: '#FFD60A',
            diamond: '#00C6FF', legendary: '#FF6B35', mythic: '#BF5FFF', locked: '#555',
          };
          const popups = newOnes.map((a: Achievement) => ({
            title: a.title, description: a.description, icon: a.icon,
            tier: a.tier, color: TIER_COLORS[a.tier] || '#FFD60A', xp: a.xp,
          }));
          setAchievementQueue(popups);
          setRunAchievementPopup(popups[0]);
        }
      } catch { }
    });
    return unsub;
  }, []);
  const mapRef = useRef<MapRunViewRef>(null);

  // Handle flyTo param from Territories screen — fly map to a territory location
  useEffect(() => {
    const flyTo = route?.params?.flyTo;
    if (flyTo && mapRef.current) {
      setTimeout(() => {
        mapRef.current?.flyTo(flyTo.lat, flyTo.lng, flyTo.zoom ?? 16);
      }, 600); // wait for map to be ready
    }
  }, [route?.params?.flyTo]);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ name: string; fullName?: string; lat: number; lng: number; type?: string }[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchAnim = useRef(new Animated.Value(0)).current;
  const botPosition = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const botPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 5 || Math.abs(gs.dy) > 5,
      onPanResponderGrant: () => {
        botPosition.setOffset({ x: (botPosition.x as any)._value, y: (botPosition.y as any)._value });
        botPosition.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event([null, { dx: botPosition.x, dy: botPosition.y }], { useNativeDriver: false }),
      onPanResponderRelease: (_, gs) => {
        botPosition.flattenOffset();
        if (Math.abs(gs.dx) < 5 && Math.abs(gs.dy) < 5) {
          setShowBotHelp(true);
        }
      },
    })
  ).current;

  // Pulse animation for running state
  useEffect(() => {
    if (state === 'running') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.1, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [state]);

  // Map focus mode — compact dashboard when running
  // Also animate the top tracker pill
  const trackerPillAnim = useRef(new Animated.Value(-100)).current;
  useEffect(() => {
    if (state === 'running') {
      setMapFocusMode(true);
      Animated.spring(dashHeightAnim, { toValue: 0, useNativeDriver: false, tension: 60, friction: 12 }).start();
      Animated.spring(trackerPillAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }).start();
    } else {
      setMapFocusMode(false);
      Animated.spring(dashHeightAnim, { toValue: 1, useNativeDriver: false, tension: 60, friction: 12 }).start();
      Animated.spring(trackerPillAnim, { toValue: -120, useNativeDriver: true, tension: 80, friction: 10 }).start();
    }
  }, [state]);

  // Dashboard entrance — only on first mount
  useEffect(() => {
    Animated.spring(dashAnim, { toValue: 1, useNativeDriver: true, tension: 40, friction: 8 }).start();
  }, []);

  // Track if we've done the initial settings load
  const initialSettingsLoaded = useRef(false);

  // Reload settings when screen comes into focus — always reload tileStyle so Settings changes apply
  useEffect(() => {
    if (isFocused) {
      getSettings().then(s => {
        setSettings(s);
        setShowPolygons(s.defaultShowPolygons);
        setShowPath(s.defaultShowPath);
        // Always apply tileStyle from settings so map style changes in Settings take effect
        setTileStyle(s.tileStyle as 'default' | 'dark' | 'satellite' | '3d');
        initialSettingsLoaded.current = true;
      });
    }
  }, [isFocused]);

  // Subscribe to instant settings changes (e.g. pathColor, pathStyle, avatarIndex changed in Settings)
  // This fires immediately without needing to navigate away and back
  useEffect(() => {
    return subscribeSettingsChange(() => {
      getSettings().then(s => {
        setSettings(s);
        setTileStyle(s.tileStyle as 'default' | 'dark' | 'satellite' | '3d');
      });
    });
  }, []);

  // Timer logic — subtracts totalPausedMs so pause truly stops the clock
  useEffect(() => {
    let timer: any;
    if (state === 'running') {
      timer = setInterval(() => {
        if (startedAt) {
          const nextElapsed = Math.floor((Date.now() - startedAt - totalPausedMs) / 1000);
          setElapsed(nextElapsed);
          speakStatus(nextElapsed);
        } else {
          setElapsed(e => {
            const next = e + 1;
            speakStatus(next);
            return next;
          });
        }
      }, 1000);
    }
    // When paused, freeze elapsed at current value — don't clear it
    return () => clearInterval(timer);
  }, [state, startedAt, totalPausedMs]);

  // When app comes back to foreground, immediately sync elapsed time
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && state === 'running' && startedAt) {
        setElapsed(Math.floor((Date.now() - startedAt - totalPausedMs) / 1000));
      }
    });
    return () => sub.remove();
  }, [state, startedAt, totalPausedMs]);

  // Publish run state to global store for cross-screen indicator
  // (placed after distVal/isMetric declarations below)
  useEffect(() => {
    if (state === 'paused' && region) {
      pausePositionRef.current = { lat: region.latitude, lng: region.longitude };
    }
    if (state === 'running') {
      pausePositionRef.current = null;
      setShowPauseWarning(false);
    }
  }, [state]);

  useEffect(() => {
    if (state !== 'paused' || !region || !pausePositionRef.current) return;
    const dLat = (region.latitude - pausePositionRef.current.lat) * 111000;
    const dLng = (region.longitude - pausePositionRef.current.lng) * 111000 * Math.cos(region.latitude * Math.PI / 180);
    const dist = Math.sqrt(dLat * dLat + dLng * dLng);
    if (dist > 50) {
      setShowPauseWarning(true);
    }
  }, [region, state]);

  // Initial setup — territories subscription only (settings loaded by isFocused effect)
  useEffect(() => {
    let unsubTerritories: any;
    let unsubLiveUsers: (() => void) | null = null;
    (async () => {
      // Check/request location permission and track state
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status === 'granted' ? 'granted' : 'denied');

      const s = await getSettings();
      setSettings(s);
      setShowPolygons(s.defaultShowPolygons);
      setShowPath(s.defaultShowPath);
      // Auto-switch map style based on app theme if user hasn't set a preference
      const autoTile = s.tileStyle === 'default' || s.tileStyle === 'dark'
        ? (themeName === 'light' ? 'default' : 'dark')
        : s.tileStyle;
      setTileStyle(autoTile as 'default' | 'dark' | 'satellite' | '3d');
      initialSettingsLoaded.current = true;
      NotificationService.requestPermissions();

      // Subscribe to territories — global or local based on setting
      const globalMode = s.showGlobalTerritories !== false;
      unsubTerritories = await subscribeTerritories(
        list => setTerritories(list),
        undefined,
        globalMode,
      );

      // Subscribe to live users
      if (s.showLiveUsers !== false) {
        unsubLiveUsers = subscribeLiveUsers(users => setLiveUsers(users));
      }
    })();
    return () => {
      unsubTerritories && unsubTerritories();
      unsubLiveUsers && unsubLiveUsers();
    };
  }, []);

  // Fetch weather when region is available (only once)
  useEffect(() => {
    if (region && !weather) {
      fetchLocalWeather(region.latitude, region.longitude).then(data => {
        if (data) setWeather(data);
      });
    }
    // Reverse geocode for human-readable location name
    if (region && !locationName) {
      fetch(`https://nominatim.openstreetmap.org/reverse?lat=${region.latitude}&lon=${region.longitude}&format=json`, {
        headers: { 'User-Agent': 'RunQuestApp/1.0' }
      })
        .then(r => r.json())
        .then(d => {
          const addr = d?.address;
          if (addr) {
            const name = addr.suburb || addr.neighbourhood || addr.city_district || addr.town || addr.village || addr.city || addr.county || addr.state;
            if (name) setLocationName(name);
          }
        })
        .catch(() => { });
    }
  }, [region]);

  // Fetch multiple quotes when idle, rotate every 20s
  useEffect(() => {
    if (state === 'idle' && quotesRef.current.length === 0) {
      Promise.all(Array.from({ length: 5 }, () => fetchMotivationalQuote()))
        .then(results => {
          const valid = results.filter(Boolean) as QuoteData[];
          if (valid.length > 0) {
            quotesRef.current = valid;
            setQuote(valid[0]);
          }
        });
    }
  }, [state]);

  useEffect(() => {
    if (state !== 'idle' || quotesRef.current.length === 0) return;
    const timer = setInterval(() => {
      setQuoteIndex(i => {
        const next = (i + 1) % quotesRef.current.length;
        setQuote(quotesRef.current[next]);
        return next;
      });
    }, 20000);
    return () => clearInterval(timer);
  }, [state]);

  // Closed loop haptic + toast + sound
  useEffect(() => {
    if (closedLoop && !prevClosedLoop.current) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      playSound('loop_closed');
      setShowLoopToast(true);
      setTimeout(() => setShowLoopToast(false), 4000);
    }
    prevClosedLoop.current = closedLoop;
  }, [closedLoop]);

  // ── Per-km milestone sounds ────────────────────────────────────────────────
  // Uses path directly to avoid referencing displayDist before its declaration
  useEffect(() => {
    if (state !== 'running') return;
    const dist = pathDistance(path);
    const km = dist / 1000;
    const crossed = Math.floor(km);
    if (crossed > 0 && crossed > lastMilestoneKm.current) {
      lastMilestoneKm.current = crossed;
      if (crossed >= 10 && crossed % 10 === 0) {
        playSound('milestone_10km');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (crossed >= 5 && crossed % 5 === 0) {
        playSound('milestone_5km');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        playSound('milestone_1km');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    }
  }, [path, state]);

  // Map search via Nominatim — debounced, with better params for global city search
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onSearch = async (q: string) => {
    if (!q.trim()) { setSearchResults([]); return; }

    // Debounce — wait 400ms after user stops typing before firing
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        // Use structured search with better params:
        // - addressdetails=1: get structured address components
        // - featuretype=city,town,village,suburb: prioritize populated places
        // - limit=8: more results
        // - accept-language=en: English names
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=8&addressdetails=1&accept-language=en`;
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'RunQuestApp/1.0 (saadnaz43165@gmail.com)',
            'Accept-Language': 'en',
          },
        });
        const data = await res.json();

        // Build clean result names — prefer city/town/village over full address
        const results = data.map((d: any) => {
          const addr = d.address || {};
          // Build a clean short name: "City, Country" or "City, State, Country"
          const city = addr.city || addr.town || addr.village || addr.suburb || addr.county || addr.state_district || d.name;
          const state = addr.state || addr.region;
          const country = addr.country;
          let shortName = city || d.display_name.split(',')[0];
          if (state && state !== city) shortName += `, ${state}`;
          if (country) shortName += `, ${country}`;

          return {
            name: shortName,
            fullName: d.display_name,
            lat: parseFloat(d.lat),
            lng: parseFloat(d.lon),
            type: d.type || d.class,
          };
        });

        // Sort: cities/towns first, then other types
        const cityTypes = new Set(['city', 'town', 'village', 'suburb', 'administrative', 'municipality']);
        results.sort((a: any, b: any) => {
          const aIsCity = cityTypes.has(a.type) ? 0 : 1;
          const bIsCity = cityTypes.has(b.type) ? 0 : 1;
          return aIsCity - bIsCity;
        });

        setSearchResults(results);
      } catch {
        setSearchResults([]);
      }
      setSearchLoading(false);
    }, 400);
  };

  const openSearch = () => {
    setShowSearch(true);
    Animated.spring(searchAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 10 }).start();
  };

  const closeSearch = () => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    Animated.timing(searchAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setShowSearch(false);
      setSearchQuery('');
      setSearchResults([]);
    });
  };

  const [showNameModal, setShowNameModal] = useState(false);
  const [pendingTerritoryName, setPendingTerritoryName] = useState('');

  const openClaimModal = () => {
    // Keep UI aligned with server rules (min area) to prevent "loop closed" but claim fails.
    const areaSqM = polygonAreaSqMeters(path);
    if (!closedLoop || areaSqM < 100) return;
    const now = new Date();
    const defaultName = `Territory - ${now.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
    setPendingTerritoryName(defaultName);
    setShowNameModal(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const onClaim = async () => {
    playSound('territory_claimed');
    // Snapshot path and closedLoop at claim time — don't rely on hook state
    // which may have been reset by stopRun()
    const claimPath = path.length >= 3 ? path : null;
    const canClaim = closedLoop || (claimPath && claimPath.length >= 3);
    if (!canClaim || !claimPath) return;

    const sanitizedName = pendingTerritoryName.replace(/<[^>]*>/g, '').trim().slice(0, 40) || `Territory - ${new Date().toLocaleDateString()}`;
    setShowNameModal(false);
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const res = await claimAndConquerRemote(
        sanitizedName,
        claimPath,
        territories,
      );
      if (res) {
        // Build a clear in-app success message
        let title = '🏆 Territory Claimed!';
        let message = `"${sanitizedName}" secured — ${Math.round(res.claimed.areaSqMeters)}m²`;

        if (res.conquered.length > 0) {
          const names = res.conquered.map(c => c.ownerDisplayName).join(', ');
          const totalConquered = res.conquered.reduce((s, c) => s + c.areaSqMeters, 0);
          title = '⚔️ Territory Conquered!';
          message = `Conquered ${res.conquered.length} territor${res.conquered.length === 1 ? 'y' : 'ies'} from ${names} — ${Math.round(totalConquered)}m² seized!`;
          playSound('territory_conquered');
          NotificationService.notify(title, message);
        }
        if (res.partialConquests && res.partialConquests.length > 0) {
          const totalStolen = res.partialConquests.reduce((s, p) => s + p.stolenAreaSqM, 0);
          title = '⚔️ Territory Carved!';
          message = `Seized ${Math.round(totalStolen)}m² from ${res.partialConquests.length} opponent${res.partialConquests.length === 1 ? '' : 's'}!`;
          NotificationService.notify(title, message);
        }
        if (res.expanded && res.conquered.length === 0 && (!res.partialConquests || res.partialConquests.length === 0)) {
          title = '🗺️ Territory Expanded!';
          message = `Your territory grew to ${Math.round(res.claimed.areaSqMeters)}m²!`;
          NotificationService.notify(title, message);
        }
        if (!res.expanded && res.conquered.length === 0 && (!res.partialConquests || res.partialConquests.length === 0)) {
          NotificationService.notify('🏆 Territory Claimed!', message);
        }

        // Show in-app alert so user sees it immediately (notifications may not show in foreground)
        Alert.alert(title, message, [{ text: 'Awesome!', style: 'default' }]);
        updateQuestProgress('loop', 1).catch(() => {});
        reset();
      }
    } catch (e: any) {
      console.error('Claim failed:', e.message);
      Alert.alert(
        'Claim Failed',
        e.message || 'Could not claim territory. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const isMetric = settings?.units !== 'imperial';
  const cleanMode = settings?.mapCleanMode === true;
  const displayDist = pathDistance(path);
  const loopAreaSqM = polygonAreaSqMeters(path);
  const distVal = isMetric ? (displayDist / 1000).toFixed(2) : (displayDist / 1609.34).toFixed(2);
  const pace = displayDist > 0 && elapsed > 0 ? (elapsed / 60) / (displayDist / (isMetric ? 1000 : 1609.34)) : 0;

  // Publish run state to global store for cross-screen indicator
  useEffect(() => {
    setRunStore({
      isActive: state === 'running' || state === 'paused',
      isPaused: state === 'paused',
      elapsed,
      distVal,
      unit: isMetric ? 'KM' : 'MI',
    });
  }, [state, elapsed, distVal, isMetric]);

  // Sync sound enabled from settings.vibrateOnAction
  useEffect(() => {
    setSoundEnabled(settings?.vibrateOnAction !== false);
  }, [settings?.vibrateOnAction]);

  // Preload key sounds on mount, unload on unmount
  useEffect(() => {
    preloadSounds(['countdown_tick', 'countdown_go', 'run_start', 'run_stop', 'loop_closed']);
    return () => { unloadAllSounds(); };
  }, []);

  // Publish live presence — respects showMyLocation privacy setting
  // Publishes whenever region is known and user has location sharing on
  useEffect(() => {
    if (!region) return;
    const showMyLoc = (settings as any)?.showMyLocation !== false;
    if (!showMyLoc) {
      stopPresence().catch(() => {});
      return;
    }
    if (state === 'running') {
      updatePresence(region.latitude, region.longitude, true).catch(() => {});
    } else if (state === 'paused') {
      updatePresence(region.latitude, region.longitude, false).catch(() => {});
    } else if (state === 'idle' || state === 'finished') {
      // Still publish location when idle so others can see you on the global map
      // (like Snapchat — you're visible even when not running)
      updatePresence(region.latitude, region.longitude, false).catch(() => {});
    }
  }, [state, region, settings]);

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const min = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${min < 10 ? '0' : ''}${min}:${sec < 10 ? '0' : ''}${sec}`;
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  };

  const handleStop = async () => {
    const isTinyRun = elapsed < 10 && displayDist < 10;
    playSound('run_stop');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

    // Truly accidental tap — discard silently, no summary
    if (isTinyRun) {
      await stopRun();
      setElapsed(0);
      reset();
      return;
    }

    // Loop not closed and user is far from start — offer to keep running
    if (!closedLoop && path.length > 1) {
      const distToStart = distanceToStart(path);
      if (distToStart > 30) {
        const perimeter = pathDistance(path);
        const perimOk = perimeter >= 50;
        let msg = `You are ${Math.round(distToStart)}m from your start point.\n\nReturn within 30m to close the loop and claim a territory.`;
        if (!perimOk) {
          msg += `\n\nYou also need ${Math.round(50 - perimeter)}m more distance (currently ${Math.round(perimeter)}m / 50m minimum).`;
        }
        setShortRunMessage(msg);
        setShowShortRunDialog(true);
        return;
      }
    }

    await doStop();
  };

  const doStop = async () => {
    // Capture all values BEFORE stopRun() resets state
    const dist = distVal;
    const time = formatTime(elapsed);
    const unit = isMetric ? 'KM' : 'MI';
    const paceVal = elapsed > 0 && parseFloat(distVal) > 0 ? (elapsed / 60) / parseFloat(distVal) : 0;
    const calories = Math.round(parseFloat(distVal) * 9.8 * 70 / 60);
    const elapsedSnap = elapsed;
    const distSnap = displayDist;
    const goalSnap = { ...goal };

    let savedId: string | null = null;
    try {
      savedId = await stopRun();
      if (settings?.voiceCoachEnabled !== false && (userTier === 'elite' || userTier === 'pro')) {
        const isMetric = settings?.units !== 'imperial';
        const distFormatted = parseFloat(dist).toFixed(2) + (isMetric ? ' kilometers' : ' miles');
        const speechText = `Workout completed. You ran ${distFormatted} in ${time}. Great job today!`;
        Speech.speak(speechText, { rate: 0.95 });
      }
      updateQuestProgress('distance', distSnap).catch(() => {});
    } catch (err) {
      console.error('stopRun failed:', err);
      // Don't block summary on save error
    }

    setSummary({
      id: savedId,
      distance: dist,
      time,
      unit,
      pace: paceVal,
      calories,
      elapsed: elapsedSnap,
      goalLabel: goalSnap.type !== 'none' ? goalSnap.label : null,
      goalMet: goalSnap.type === 'distance'
        ? distSnap >= goalSnap.valueKm * 1000
        : goalSnap.type === 'time'
        ? elapsedSnap >= goalSnap.valueSec
        : false,
      goalValueKm: goalSnap.type === 'distance' ? goalSnap.valueKm : null,
      goalValueSec: goalSnap.type === 'time' ? goalSnap.valueSec : null,
    });
    setShowSummary(true);

    try {
      const history = await getHistory();
      emitAchievementsCheck(history);
    } catch { }
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.black }}>
      {/* Map Background */}
      <View style={StyleSheet.absoluteFill}>
        <MapRunView
          ref={mapRef}
          region={region} path={path}
          polygons={territories.map(t => ({
              points: t.polygon,
              // Team color takes priority — territories show team identity on the map
              color: t.teamColor || t.color,
              ownerName: t.ownerUsername || t.ownerDisplayName || '',
              ownerPhotoURL: t.ownerPhotoURL || null,
              ownerId: t.ownerId,
            }))}
          showPolygons={showPolygons} showPath={showPath} tileStyle={tileStyle}
          showNearbyTerritories={settings?.showNearbyTerritories !== false}
          accuracyMeters={accuracyMeters} headingDeg={headingDeg}
          showZoomButtons={settings?.showZoomButtons !== false}
          goalCircleKm={goal.type === 'distance' ? goal.valueKm : null}
          liveUsers={liveUsers}
          showLiveUsers={settings?.showLiveUsers !== false}
          avatarIndex={(settings as any)?.avatarIndex ?? 0}
          pathStyle={(settings as any)?.pathStyle ?? 'solid'}
          pathColor={(() => {
            const c = (settings as any)?.pathColor ?? 'green';
            const map: Record<string, string> = { green: '#00FF87', blue: '#00C6FF', orange: '#FF9F0A', purple: '#BF5FFF', red: '#FF453A', white: '#FFFFFF' };
            return map[c] ?? '#00FF87';
          })()}
          items={spawnedItems}
        />
      </View>

      {/* Loot Collected Toast */}
      {collectedNotification && (
        <View style={{
          position: 'absolute',
          top: insets.top + 70,
          alignSelf: 'center',
          backgroundColor: 'rgba(10,12,16,0.95)',
          borderWidth: 1.5,
          borderColor: T.gold,
          borderRadius: 24,
          paddingHorizontal: 16,
          paddingVertical: 10,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          zIndex: 9999,
          shadowColor: T.gold,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 6,
        }}>
          <Ionicons name="gift" size={16} color={T.gold} />
          <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '900', fontFamily: 'Arial' }}>
            LOOT COLLECTED:
          </Text>
          <Text style={{ color: T.gold, fontSize: 13, fontWeight: '900', fontFamily: 'Arial' }}>
            {collectedNotification}
          </Text>
        </View>
      )}

      {/* ── Location permission denied overlay ── */}
      {locationPermission === 'denied' && (
        <View style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.88)',
          alignItems: 'center', justifyContent: 'center',
          padding: 32, zIndex: 9999,
        }}>
          <View style={{
            backgroundColor: '#111', borderRadius: 28, padding: 28,
            alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
            width: '100%',
          }}>
            <View style={{
              width: 72, height: 72, borderRadius: 22,
              backgroundColor: '#FF453A18', borderWidth: 1, borderColor: '#FF453A30',
              alignItems: 'center', justifyContent: 'center', marginBottom: 20,
            }}>
              <Ionicons name="location-outline" size={36} color="#FF453A" />
            </View>
            <Text style={{ color: '#FFF', fontSize: 22, fontWeight: '900', textAlign: 'center', marginBottom: 10 }}>
              Location Required
            </Text>
            <Text style={{ color: '#8E8E93', fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 28 }}>
              RunQuest needs location access to track your runs and claim territories. Please allow location in your device settings.
            </Text>
            <TouchableOpacity
              onPress={() => Linking.openSettings()}
              activeOpacity={0.85}
              style={{ width: '100%', borderRadius: 16, overflow: 'hidden', marginBottom: 12 }}
            >
              <LinearGradient
                colors={[T.green, '#00C6A0']}
                style={{ paddingVertical: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              >
                <Ionicons name="settings-outline" size={18} color="#000" />
                <Text style={{ color: '#000', fontWeight: '900', fontSize: 16 }}>Open Settings</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={async () => {
                const { status } = await Location.requestForegroundPermissionsAsync();
                setLocationPermission(status === 'granted' ? 'granted' : 'denied');
              }}
              style={{ paddingVertical: 12 }}
            >
              <Text style={{ color: T.text, fontSize: 14, fontWeight: '600' }}>Try Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <RunSummaryModal
        visible={showSummary}
        data={summary}
        isLight={isLight}
        closedLoop={closedLoop}
        onClaim={openClaimModal}
        loopAreaSqM={loopAreaSqM}
        onClose={() => { setShowSummary(false); setElapsed(0); reset(); }}
        onDiscard={async () => {
          if (summary?.id) {
            try {
              await deleteRun(summary.id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (err) {
              console.error('Discard run failed:', err);
            }
          }
          setShowSummary(false);
          setSummary(null);
          setElapsed(0);
          reset();
        }}
      />

      {/* ════ COUNTDOWN OVERLAY ════ */}
      {countdown !== null && (
        <View style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.72)',
          alignItems: 'center', justifyContent: 'center',
          zIndex: 9000, elevation: 9000,
        }}>
          <Animated.View style={{
            opacity: countdownAnim.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 1, 1, 0] }),
            transform: [{ scale: countdownAnim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [1.6, 1, 0.7] }) }],
            alignItems: 'center',
          }}>
            <Text style={{
              fontSize: countdown === 0 ? 52 : 96,
              fontWeight: '900',
              color: countdown === 0 ? T.green : '#FFF',
              letterSpacing: -4,
            }}>
              {countdown === 0 ? 'GO!' : countdown}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: '700', letterSpacing: 2, marginTop: 8 }}>
              {countdown === 3 ? 'GET READY' : countdown === 2 ? 'STEADY' : countdown === 1 ? 'SET' : ''}
            </Text>
          </Animated.View>
          {/* Cancel */}
          <TouchableOpacity
            onPress={() => setCountdown(null)}
            style={{ position: 'absolute', top: insets.top + 20, right: 20, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 20 }}
          >
            <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '700' }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      <WeatherModal visible={showWeatherModal} onClose={() => setShowWeatherModal(false)} weather={weather} isLight={isLight} />

      {/* ════ BUG REPORT MODAL — inline, no navigation stack ════ */}
      <Modal visible={showBugReport} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowBugReport(false)}>
        <BugReportModal onClose={() => setShowBugReport(false)} />
      </Modal>

      {/* ════ TERRITORY NAMING MODAL (Feature 1) ════ */}
      <Modal visible={showNameModal} transparent animationType="fade" onRequestClose={() => setShowNameModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }}>
          <View style={{ backgroundColor: '#111', borderRadius: 24, padding: 24, width: '100%', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: T.green + '20', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="flag" size={20} color={T.green} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: T.white, fontSize: 18, fontWeight: '900' }}>Name Your Territory</Text>
                <Text style={{ color: T.text, fontSize: 12, marginTop: 2 }}>Max 40 characters</Text>
              </View>
              <TouchableOpacity onPress={() => setShowNameModal(false)}>
                <Ionicons name="close" size={22} color={T.text} />
              </TouchableOpacity>
            </View>
            {/* Input */}
            <View style={{ backgroundColor: '#1C1C1E', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 4, marginBottom: 8, borderWidth: 1, borderColor: T.green + '40' }}>
              <TextInput
                value={pendingTerritoryName}
                onChangeText={t => setPendingTerritoryName(t.slice(0, 40))}
                style={{ color: T.white, fontSize: 16, paddingVertical: 12 }}
                placeholderTextColor={T.text + '80'}
                placeholder="Territory name..."
                autoFocus
                maxLength={40}
                selectTextOnFocus
              />
            </View>
            <Text style={{ color: T.text, fontSize: 11, marginBottom: 20, textAlign: 'right' }}>{pendingTerritoryName.length}/40</Text>
            {/* Buttons */}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                onPress={() => setShowNameModal(false)}
                style={{ flex: 1, paddingVertical: 14, borderRadius: 16, backgroundColor: '#1C1C1E', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center' }}
              >
                <Text style={{ color: T.text, fontWeight: '700', fontSize: 15 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onClaim}
                style={{ flex: 2, paddingVertical: 14, borderRadius: 16, backgroundColor: T.green, alignItems: 'center' }}
              >
                <Text style={{ color: '#000', fontWeight: '900', fontSize: 15 }}>Claim Territory</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ════ LIVE TRACKER PILL — always visible when running (even in clean mode) ════ */}
      {state === 'running' && (
        <Animated.View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            top: insets.top + 8,
            left: 16, right: 16,
            zIndex: 600,
            elevation: 20,
            transform: [{ translateY: trackerPillAnim }],
          }}
        >
          {/* Single unified card — no separate strips */}
          <View style={{
            backgroundColor: '#0A0C10',
            borderRadius: 22,
            borderWidth: 1.5,
            borderColor: T.green + '55',
            overflow: 'hidden',
          }}>
            {/* Stats row */}
            <View style={{
              paddingVertical: 11,
              paddingHorizontal: 14,
              flexDirection: 'row',
              alignItems: 'center',
            }}>
              {/* TIME */}
              <View style={{ alignItems: 'center', flex: 1 }}>
                <Text style={{ color: T.green, fontSize: 19, fontWeight: '900', fontVariant: ['tabular-nums'] }}>{formatTime(elapsed)}</Text>
                <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 8, fontWeight: '800', letterSpacing: 1 }}>TIME</Text>
              </View>
              <View style={{ width: 1, height: 26, backgroundColor: 'rgba(255,255,255,0.1)' }} />
              {/* KM */}
              <View style={{ alignItems: 'center', flex: 1 }}>
                <Text style={{ color: '#FFF', fontSize: 17, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{distVal}</Text>
                <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 8, fontWeight: '800', letterSpacing: 1 }}>{isMetric ? 'KM' : 'MI'}</Text>
              </View>
              <View style={{ width: 1, height: 26, backgroundColor: 'rgba(255,255,255,0.1)' }} />
              {/* M² */}
              <View style={{ alignItems: 'center', flex: 1 }}>
                <Text style={{ color: '#FFF', fontSize: 17, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{Math.round(polygonAreaSqMeters(path))}</Text>
                <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 8, fontWeight: '800', letterSpacing: 1 }}>M²</Text>
              </View>
              {/* Weather */}
              {weather && (
                <>
                  <View style={{ width: 1, height: 26, backgroundColor: 'rgba(255,255,255,0.1)' }} />
                  <TouchableOpacity onPress={() => setShowWeatherModal(true)} style={{ alignItems: 'center', flex: 0.8 }}>
                    <Ionicons name={weather.icon as any} size={15} color={T.accent2} />
                    <Text style={{ color: T.accent2, fontSize: 12, fontWeight: '900' }}>{weather.temperature}°</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>

            {/* Divider */}
            <View style={{ height: 1, backgroundColor: T.green + '20', marginHorizontal: 14 }} />

            {/* Loop progress — always shown while running */}
            {(() => {
              const distToStart = path.length >= 2 ? distanceToStart(path) : null;
              const perimeter = pathDistance(path);
              const minPerim = 50;
              const perimOk = perimeter >= minPerim;
              const closeEnough = distToStart !== null && distToStart <= 30;

              if (closedLoop) {
                return (
                  <View style={{ paddingHorizontal: 14, paddingTop: 7, paddingBottom: 6, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: T.green }} />
                    <Text style={{ color: T.green, fontSize: 10, fontWeight: '900', letterSpacing: 0.5 }}>🔒 LOOP CLOSED — Ready to claim!</Text>
                  </View>
                );
              }

              if (path.length < 2) {
                return (
                  <View style={{ paddingHorizontal: 14, paddingTop: 7, paddingBottom: 6 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '700' }}>Run a loop — return to start to claim territory</Text>
                  </View>
                );
              }

              // Show distance to start + perimeter progress
              const perimProgress = Math.min(perimeter / minPerim, 1);
              return (
                <View style={{ paddingHorizontal: 14, paddingTop: 7, paddingBottom: 8, gap: 5 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ color: closeEnough ? '#FFD60A' : 'rgba(255,255,255,0.55)', fontSize: 9, fontWeight: '800', letterSpacing: 0.8 }}>
                      {closeEnough
                        ? `⚡ ${Math.round(distToStart!)}m to start — almost there!`
                        : distToStart !== null
                          ? `↩ ${Math.round(distToStart)}m back to start`
                          : 'Head back to start to close loop'}
                    </Text>
                    {!perimOk && (
                      <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: '700' }}>
                        {Math.round(perimeter)}m / {minPerim}m min
                      </Text>
                    )}
                  </View>
                  {!perimOk && (
                    <View style={{ height: 3, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
                      <View style={{ height: '100%', width: `${Math.round(perimProgress * 100)}%`, backgroundColor: '#00C6FF', borderRadius: 2 }} />
                    </View>
                  )}
                </View>
              );
            })()}

            {/* Goal progress bar — shown when a goal is set */}
            {goal.type !== 'none' && (
              <>
                {(() => {
                  const goalProgress = goal.type === 'distance'
                    ? Math.min(displayDist / (goal.valueKm * 1000), 1)
                    : Math.min(elapsed / goal.valueSec, 1);
                  const goalDone = goalProgress >= 1;
                  return (
                    <View style={{ paddingHorizontal: 14, paddingTop: 7, paddingBottom: 4 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={{ color: goalDone ? T.green : 'rgba(255,255,255,0.5)', fontSize: 9, fontWeight: '800', letterSpacing: 1 }}>
                          {goalDone ? '✓ GOAL REACHED!' : `GOAL: ${goal.label}`}
                        </Text>
                        <Text style={{ color: goalDone ? T.green : 'rgba(255,255,255,0.5)', fontSize: 9, fontWeight: '700' }}>
                          {Math.round(goalProgress * 100)}%
                        </Text>
                      </View>
                      <View style={{ height: 3, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
                        <View style={{ height: '100%', width: `${Math.round(goalProgress * 100)}%`, backgroundColor: goalDone ? T.green : '#00C6FF', borderRadius: 2 }} />
                      </View>
                    </View>
                  );
                })()}
              </>
            )}

            {settings?.pacerEnabled && (userTier === 'elite' || userTier === 'pro') && (
              <>
                <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.08)' }} />
                {(() => {
                  const pPace = settings.pacerPaceMinPerKm || 5.5;
                  const targetDistM = ((elapsed / 60) / pPace) * (isMetric ? 1000 : 1609.34);
                  const diff = displayDist - targetDistM;
                  const ahead = diff >= 0;
                  const absDiff = Math.abs(diff);
                  return (
                    <View style={{
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: ahead ? 'rgba(76,217,100,0.06)' : 'rgba(255,159,10,0.06)',
                    }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="speedometer-outline" size={13} color={ahead ? T.green : '#FF9F0A'} />
                        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '700' }}>
                          Pacer: {pPace.toFixed(1)} min/{isMetric ? 'km' : 'mi'}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Ionicons name={ahead ? 'flash' : 'trending-down'} size={12} color={ahead ? T.green : '#FF9F0A'} />
                        <Text style={{ color: ahead ? T.green : '#FF9F0A', fontSize: 11, fontWeight: '900', letterSpacing: 0.5 }}>
                          {ahead ? `${Math.round(absDiff)}m AHEAD` : `${Math.round(absDiff)}m BEHIND`}
                        </Text>
                      </View>
                    </View>
                  );
                })()}
              </>
            )}

            {/* Location row — hidden in clean mode */}
            {!cleanMode && (
            <View style={{
              paddingHorizontal: 14, paddingVertical: 7,
              flexDirection: 'row', alignItems: 'center', gap: 6,
            }}>
              <Ionicons name="location-sharp" size={11} color={T.green} />
              <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: '500', flex: 1 }} numberOfLines={1} ellipsizeMode="tail">
                {locationName || (region ? `${region.latitude.toFixed(4)}, ${region.longitude.toFixed(4)}` : 'Acquiring GPS...')}
              </Text>
              {accuracyMeters !== null && (
                <Text style={{ color: accuracyMeters > 20 ? '#FF9F0A' : T.green + '99', fontSize: 10, fontWeight: '700' }}>
                  {accuracyMeters > 20 ? '⚠ ' : ''}±{Math.round(accuracyMeters)}m
                </Text>
              )}
            </View>
            )}
          </View>
        </Animated.View>
      )}

      {/* ════ TOP OVERLAY: idle state pills ════ */}
      {!cleanMode && !showSearch && state === 'idle' && (
        <>
          {/* LEFT: GPS status pill — replaces useless READY pill */}
          <View style={{
            position: 'absolute', top: insets.top + 10, left: 16, zIndex: 500,
            flexDirection: 'row', alignItems: 'center', gap: 6,
            backgroundColor: '#0A0C10',
            borderRadius: 22, paddingHorizontal: 12, paddingVertical: 8,
            borderWidth: 1.5,
            borderColor: accuracyMeters === null
              ? 'rgba(255,165,0,0.5)'
              : accuracyMeters > 20
                ? '#FF9F0A80'
                : T.green + '80',
          }}>
            <View style={{
              width: 7, height: 7, borderRadius: 3.5,
              backgroundColor: accuracyMeters === null
                ? '#FF9F0A'
                : accuracyMeters > 20
                  ? '#FF9F0A'
                  : T.green,
            }} />
            <Text style={{
              color: accuracyMeters === null
                ? '#FF9F0A'
                : accuracyMeters > 20
                  ? '#FF9F0A'
                  : T.green,
              fontSize: 11, fontWeight: '800', letterSpacing: 0.3,
            }}>
              {accuracyMeters === null
                ? 'Acquiring GPS'
                : accuracyMeters > 20
                  ? `Weak ±${Math.round(accuracyMeters)}m`
                  : `GPS ±${Math.round(accuracyMeters)}m`}
            </Text>
            {accuracyMeters !== null && accuracyMeters <= 20 && (
              <Ionicons name="checkmark-circle" size={11} color={T.green} />
            )}
            {(accuracyMeters === null || accuracyMeters > 20) && (
              <Ionicons name="warning-outline" size={11} color="#FF9F0A" />
            )}
          </View>

          {/* CENTER: Location pill — sits between GPS pill and weather pill */}
          {/* REMOVED — merged into weather pill on the right */}

          {/* RIGHT: Location + Weather merged pill */}
          <TouchableOpacity
            onPress={weather ? () => setShowWeatherModal(true) : undefined}
            activeOpacity={weather ? 0.8 : 1}
            style={{
              position: 'absolute', top: insets.top + 10, right: 16, zIndex: 500,
              flexDirection: 'row', alignItems: 'center', gap: 0,
              backgroundColor: '#0A0C10',
              borderRadius: 22,
              borderWidth: 1.5, borderColor: weather ? T.accent2 + '70' : 'rgba(255,255,255,0.22)',
              overflow: 'hidden',
              maxWidth: 200,
            }}
          >
            {/* Location section */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 9, flexShrink: 1, minWidth: 0 }}>
              <Ionicons name="location-sharp" size={11} color={T.green} style={{ flexShrink: 0 }} />
              <Text style={{ color: '#DDD', fontSize: 11, fontWeight: '600', flexShrink: 1 }} numberOfLines={1} ellipsizeMode="tail">
                {locationName
                  ? locationName.length > 14 ? locationName.slice(0, 13) + '…' : locationName
                  : region ? `${region.latitude.toFixed(2)},${region.longitude.toFixed(2)}` : '...'}
              </Text>
            </View>
            {/* Divider + weather section — only when weather loaded */}
            {weather && (
              <>
                <View style={{ width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.15)' }} />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 9, flexShrink: 0 }}>
                  <Ionicons name={weather.icon as any} size={14} color={T.accent2} />
                  <Text style={{ fontSize: 12, fontWeight: '900', color: '#FFF' }}>{weather.temperature}°</Text>
                </View>
              </>
            )}
          </TouchableOpacity>

          {/* GPS accuracy pill below weather removed — shown in left GPS pill instead */}
        </>
      )}

      {/* ════ FLOATING MUSIC CONTROL — visible during run, just above navbar ════ */}
      <RunMusicControl
        musicState={musicState}
        insets={insets}
        isVisible={state === 'running' && settings?.showMusicPlayer !== false && !cleanMode}
      />

      {/* Pause Movement Warning */}
      {showPauseWarning && state === 'paused' && (
        <View style={{
          position: 'absolute', bottom: insets.bottom + 260, left: 16, right: 16, zIndex: 700,
        }}>
          <View style={{
            backgroundColor: '#FF9F0A',
            borderRadius: 20, padding: 16,
            flexDirection: 'row', alignItems: 'center', gap: 12,
          }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.2)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="warning" size={20} color="#000" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#000', fontSize: 13, fontWeight: '900' }}>You moved while paused!</Text>
              <Text style={{ color: 'rgba(0,0,0,0.7)', fontSize: 11, marginTop: 2 }}>
                Moving while paused won't count toward your territory. Resume to continue tracking.
              </Text>
            </View>
            <TouchableOpacity onPress={() => setShowPauseWarning(false)}>
              <Ionicons name="close" size={18} color="#000" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Paused overlay indicator — always visible when paused */}
      {state === 'paused' && (
        <View style={{
          position: 'absolute', top: insets.top + 8, left: 16, right: 16, zIndex: 600,
        }}>
          <View style={{
            backgroundColor: '#FF9F0A',
            borderRadius: 24, paddingVertical: 10, paddingHorizontal: 16,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
          }}>
            <Ionicons name="pause-circle" size={20} color="#000" />
            <Text style={{ color: '#000', fontSize: 15, fontWeight: '900', letterSpacing: 0.5 }}>RUN PAUSED</Text>
            <Text style={{ color: 'rgba(0,0,0,0.6)', fontSize: 12, fontWeight: '600' }}>— {formatTime(elapsed)}</Text>
          </View>
        </View>
      )}
      {/* Loop closed toast — prominent banner */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {showLoopToast && (
          <View style={{
            position: 'absolute',
            top: insets.top + (state === 'running' ? 120 : 70),
            left: 16, right: 16,
            backgroundColor: T.green,
            borderRadius: 20,
            paddingVertical: 14,
            paddingHorizontal: 18,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            shadowColor: T.green,
            shadowOpacity: 0.6,
            shadowRadius: 16,
            elevation: 20,
          }}>
            <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.2)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="checkmark-circle" size={22} color="#000" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#000', fontSize: 15, fontWeight: '900' }}>🔒 Loop Closed!</Text>
              <Text style={{ color: 'rgba(0,0,0,0.65)', fontSize: 11, marginTop: 1 }}>Stop your run to claim this territory</Text>
            </View>
            <Ionicons name="flag" size={20} color="rgba(0,0,0,0.5)" />
          </View>
        )}
      </View>

      {/* Toolbar — right side buttons, positioned below all top pills */}
      {!cleanMode && (
        <View style={[styles.toolBar, {
          top: state === 'running' ? insets.top + 160 : insets.top + 100,
          right: 16,
        }]}>
          {/* Feature Hub button */}
          <TouchableOpacity
            onPress={() => { setShowHub(true); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }}
            style={[styles.toolBtn, {
              backgroundColor: '#0A0C10',
              borderColor: '#FFD60A',
              borderWidth: 1.5,
            }]}
          >
            <Ionicons name="apps" size={22} color="#FFD60A" />
          </TouchableOpacity>

          {settings?.showTerritoryBtn !== false && (
            <TouchableOpacity
              onPress={() => { setShowPolygons(v => !v); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              style={[styles.toolBtn, {
                backgroundColor: showPolygons ? T.green : '#0A0C10',
                borderColor: showPolygons ? T.green : 'rgba(255,255,255,0.4)',
              }]}
            >
              <Ionicons name={showPolygons ? 'map' : 'map-outline'} size={22} color={showPolygons ? '#000' : '#FFF'} />
            </TouchableOpacity>
          )}

          {/* Map type button */}
          <TouchableOpacity
            onPress={() => { setShowMapPicker(true); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
            style={[styles.toolBtn, {
              backgroundColor: '#0A0C10',
              borderColor: 'rgba(255,255,255,0.4)',
            }]}
          >
            <Ionicons
              name="layers-outline"
              size={22}
              color="#FFF"
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => { if (region) { mapRef.current?.recenter(region.latitude, region.longitude); recenter(); } Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
            style={[styles.toolBtn, { backgroundColor: '#0A0C10', borderColor: 'rgba(255,255,255,0.4)' }]}
          >
            <Ionicons name="locate" size={22} color="#FFF" />
          </TouchableOpacity>

          {settings?.showMapSearch !== false && (
            <TouchableOpacity
              onPress={() => { openSearch(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              style={[styles.toolBtn, { backgroundColor: '#0A0C10', borderColor: 'rgba(255,255,255,0.4)' }]}
            >
              <Ionicons name="search" size={22} color="#FFF" />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Bug report button — always visible, even in clean mode — REMOVED, now in dashboard */}

      {/* Map Type Picker — Google Maps style bottom sheet */}
      {showMapPicker && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setShowMapPicker(false)}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowMapPicker(false)} />
          <View style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            backgroundColor: isLight ? '#FFF' : '#111',
            borderTopLeftRadius: 28, borderTopRightRadius: 28,
            padding: 24, paddingBottom: 40,
            borderWidth: 1, borderColor: isLight ? '#EEE' : 'rgba(255,255,255,0.1)',
          }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: isLight ? '#DDD' : '#444', alignSelf: 'center', marginBottom: 20 }} />
            <Text style={{ color: isLight ? '#000' : '#FFF', fontSize: 18, fontWeight: '900', marginBottom: 20 }}>Map Type</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {([
                { id: 'default', label: 'Default', icon: 'sunny-outline', preview: '#e8f4f8', color: '#007AFF' },
                { id: 'dark', label: 'Dark', icon: 'moon-outline', preview: '#0d1117', color: '#5E5CE6' },
                { id: 'satellite', label: 'Satellite', icon: 'earth', preview: '#1a3a1a', color: '#FFD60A' },
                { id: '3d', label: '3D', icon: 'cube-outline', preview: '#1a2a3a', color: '#FF6B35' },
              ] as const).map(opt => {
                const isActive = tileStyle === opt.id;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    onPress={() => {
                      setTileStyle(opt.id as any);
                      // Persist the user's map style choice
                      import('../config/settings').then(({ updateSettings }) => updateSettings({ tileStyle: opt.id as any })).catch(() => {});
                      setShowMapPicker(false);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    activeOpacity={0.8}
                    style={{ flex: 1, alignItems: 'center', gap: 8 }}
                  >
                    {/* Map preview thumbnail */}
                    <LinearGradient
                      colors={
                        opt.id === 'default' ? ['#E8F4F8', '#C5E0EC'] :
                        opt.id === 'dark' ? ['#1A1F2C', '#0D1117'] :
                        opt.id === 'satellite' ? ['#1B3A1B', '#0A1A0A'] :
                        ['#2D3748', '#1A202C']
                      }
                      style={{
                        width: '100%', aspectRatio: 1, borderRadius: 16,
                        borderWidth: isActive ? 2.5 : 1,
                        borderColor: isActive ? opt.color : (isLight ? '#E2E8F0' : 'rgba(255,255,255,0.15)'),
                        alignItems: 'center', justifyContent: 'center',
                        overflow: 'hidden',
                        shadowColor: '#000',
                        shadowOpacity: isActive ? 0.3 : 0.1,
                        shadowRadius: 6,
                        elevation: isActive ? 4 : 1,
                      }}
                    >
                      <Ionicons
                        name={opt.icon as any}
                        size={26}
                        color={isActive ? opt.color : (isLight ? '#4A5568' : '#A0AEC0')}
                      />
                      {isActive && (
                        <View style={{
                          position: 'absolute', top: 6, right: 6,
                          width: 18, height: 18, borderRadius: 9,
                          backgroundColor: opt.color, alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Ionicons name="checkmark" size={10} color="#000" />
                        </View>
                      )}
                    </LinearGradient>
                    <Text style={{
                      color: isActive ? opt.color : (isLight ? '#333' : '#CCC'),
                      fontSize: 12, fontWeight: isActive ? '900' : '600',
                    }}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </Modal>
      )}

      {/* Map Search Overlay — full screen, replaces header */}
      {!cleanMode && showSearch && (
        <Animated.View style={[styles.searchOverlay, { top: insets.top + 10, opacity: searchAnim, transform: [{ scale: searchAnim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) }] }]}>
          <View style={[styles.searchBar, { backgroundColor: isLight ? '#FFF' : '#111', borderColor: isLight ? '#DDD' : 'rgba(255,255,255,0.15)' }]}>
            <Ionicons name="search" size={18} color={T.green} />
            <TextInput
              style={[styles.searchInput, { color: isLight ? '#000' : '#FFF' }]}
              placeholder="Search location..."
              placeholderTextColor={T.text + '80'}
              value={searchQuery}
              onChangeText={(t) => { setSearchQuery(t); onSearch(t); }}
              autoFocus
              returnKeyType="search"
              onSubmitEditing={() => onSearch(searchQuery)}
            />
            {searchLoading
              ? <ActivityIndicator size="small" color={T.green} />
              : <TouchableOpacity onPress={closeSearch} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={20} color={T.text} />
              </TouchableOpacity>
            }
          </View>
          {searchResults.length > 0 && (
            <View style={[styles.searchResults, { backgroundColor: isLight ? '#FFF' : '#111', borderColor: isLight ? '#DDD' : 'rgba(255,255,255,0.1)' }]}>
              {searchResults.map((r, i) => {
                const cityTypes = new Set(['city', 'town', 'village', 'suburb', 'administrative', 'municipality']);
                const isCity = r.type && cityTypes.has(r.type);
                const typeLabel = r.type ? r.type.charAt(0).toUpperCase() + r.type.slice(1) : null;
                return (
                  <TouchableOpacity
                    key={i}
                    onPress={() => {
                      mapRef.current?.flyTo(r.lat, r.lng, 14);
                      closeSearch();
                    }}
                    style={[styles.searchResultRow, i < searchResults.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: isLight ? '#EEE' : 'rgba(255,255,255,0.08)' }]}
                  >
                    <View style={{
                      width: 34, height: 34, borderRadius: 10,
                      backgroundColor: isCity ? '#0A84FF18' : T.card,
                      alignItems: 'center', justifyContent: 'center',
                      marginRight: 10, flexShrink: 0,
                    }}>
                      <Ionicons
                        name={isCity ? 'business-outline' : 'location-outline'}
                        size={16}
                        color={isCity ? '#0A84FF' : T.text}
                      />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ color: isLight ? '#000' : '#FFF', fontSize: 13, fontWeight: '700' }} numberOfLines={1}>
                        {r.name}
                      </Text>
                      {typeLabel && (
                        <Text style={{ color: T.text, fontSize: 10, marginTop: 1 }}>{typeLabel}</Text>
                      )}
                    </View>
                    <Ionicons name="arrow-forward" size={14} color={T.text + '60'} style={{ marginLeft: 8 }} />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </Animated.View>
      )}

      {/* Dashboard — compact when running (non-clean), full when idle */}
      {mapFocusMode && !cleanMode ? (
        /* Compact running bar — PAUSE/RESUME + STOP only */
        <Animated.View style={[styles.compactBar, {
          bottom: (settings?.showMusicPlayer !== false)
            ? insets.bottom + 148
            : insets.bottom + 90,
          opacity: dashAnim,
        }]}>
          <View style={[styles.compactBarInner, { backgroundColor: 'rgba(10,10,10,0.96)', borderColor: 'rgba(255,255,255,0.18)' }]}>
            {/* PACE */}
            <View style={{ flex: 1, alignItems: 'center', minWidth: 0 }}>
              <Text style={{ color: '#00C6FF', fontSize: 20, fontWeight: '900' }} numberOfLines={1}>{pace > 0 ? pace.toFixed(1) : '--'}</Text>
              <Text style={{ color: '#AAAAAA', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 }}>PACE</Text>
            </View>

            <View style={{ width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.15)' }} />

            {/* ALTITUDE */}
            <View style={{ flex: 1, alignItems: 'center', minWidth: 0 }}>
              <Text style={{ color: T.gold || '#FFD700', fontSize: 20, fontWeight: '900' }} numberOfLines={1}>
                {altitudeMeters !== null ? Math.round(altitudeMeters) : '--'}
              </Text>
              <Text style={{ color: '#AAAAAA', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 }}>ALT m</Text>
            </View>

            {/* PAUSE / RESUME button */}
            <TouchableOpacity
              onPress={() => {
                if (state === 'running') {
                  pauseRun();
                  playSound('run_pause');
                } else {
                  resumeRun();
                  playSound('run_resume');
                }
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }}
              disabled={isSaving}
              style={{
                backgroundColor: state === 'running' ? '#FF9F0A' : T.green,
                borderRadius: 14,
                paddingHorizontal: 12,
                paddingVertical: 11,
                marginLeft: 8,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                flexShrink: 0,
              }}
            >
              <Ionicons name={state === 'running' ? 'pause' : 'play'} size={15} color="#000" />
              <Text style={{ color: '#000', fontWeight: '900', fontSize: 11 }}>
                {state === 'running' ? 'PAUSE' : 'RESUME'}
              </Text>
            </TouchableOpacity>

            {/* STOP button — double-tap to confirm (prevents pocket press) */}
            <ConfirmStop onConfirm={handleStop} disabled={isSaving} compact />
          </View>
        </Animated.View>
      ) : !cleanMode || state === 'idle' ? (
        /* Full dashboard — fixed height */
        <Animated.View style={[styles.dashboard, { transform: [{ translateY: dashAnim.interpolate({ inputRange: [0, 1], outputRange: [200, 0] }) }] }]}>
          <View style={[styles.dashBlur, {
            backgroundColor: isLight ? 'rgba(255,255,255,0.97)' : 'rgba(12,12,12,0.94)',
            borderColor: isLight ? '#DDD' : 'rgba(255,255,255,0.12)',
            borderWidth: 1,
            paddingBottom: insets.bottom + 90,
          }]}>
            {/* Quote removed — takes space, not useful in dashboard */}

            {/* Music pill trigger — compact */}
            {settings?.showMusicPlayer !== false && !cleanMode && (
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10,
                backgroundColor: showMusicPill ? (isLight ? T.green + '18' : T.green + '22') : (isLight ? '#F0F0F5' : 'rgba(255,255,255,0.07)'),
                borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7,
                borderWidth: 1,
                borderColor: showMusicPill ? T.green + '50' : (isLight ? '#E0E0E0' : 'rgba(255,255,255,0.1)'),
              }}>
                <TouchableOpacity onPress={() => { if (showMusicPill) { closeMusicPill(); } else { openMusicPill(); } }} activeOpacity={0.85} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                  <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: T.green + '25', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={musicState.isPlaying ? 'musical-notes' : 'musical-note'} size={11} color={T.green} />
                  </View>
                  <Marquee
                    text={musicState.trackName || 'Tap to add music'}
                    style={{ color: isLight ? '#333' : '#CCC', fontSize: 11, fontWeight: '600' }}
                    containerStyle={{ flex: 1 }}
                  />
                  {musicState.isPlaying && (
                    <View style={{ flexDirection: 'row', gap: 2, alignItems: 'flex-end', height: 12, marginRight: 2 }}>
                      {[0.4, 0.8, 0.6, 1.0, 0.5].map((h, i) => (<View key={i} style={{ width: 2, height: 12 * h, borderRadius: 1, backgroundColor: T.green }} />))}
                    </View>
                  )}
                  <Ionicons name={showMusicPill ? 'chevron-down' : 'chevron-up'} size={12} color={showMusicPill ? T.green : T.text} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { if (!musicState.trackName) { openMusicPill(); } else { getMusicState().onToggle?.(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: T.green, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={musicState.isPlaying ? 'pause' : 'play'} size={12} color="#000" />
                </TouchableOpacity>
              </View>
            )}
            {/* Gauges — only meaningful during/after a run */}
            {state !== 'idle' ? (
              <View style={styles.gaugesRow}>
                <RunGauge label="DISTANCE" value={distVal} unit={isMetric ? 'KM' : 'MI'} icon="walk-outline" color={T.green} />
                <View style={[styles.vLine, { backgroundColor: isLight ? '#DDD' : 'rgba(255,255,255,0.1)' }]} />
                <RunGauge label="PACE" value={pace > 0 ? pace.toFixed(1) : '--'} unit="MIN" icon="speedometer-outline" color={T.accent2} />
                <View style={[styles.vLine, { backgroundColor: isLight ? '#DDD' : 'rgba(255,255,255,0.1)' }]} />
                <RunGauge label="ALTITUDE" value={altitudeMeters !== null ? String(Math.round(altitudeMeters)) : 'N/A'} unit="M" icon="analytics-outline" color={T.gold || '#FFD700'} />
              </View>
            ) : (
              /* Idle — last run + goal in one compact area */
              <>
                <LastRunBar isMetric={isMetric} isLight={isLight} />
                {/* Goal selector — horizontal scroll, single row, no wrap */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingRight: 4, marginBottom: 10 }}>
                  {GOAL_OPTIONS.map((g, i) => (
                    <TouchableOpacity
                      key={i}
                      onPress={() => { setGoalIndex(i); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                      style={{
                        paddingHorizontal: 11, paddingVertical: 6, borderRadius: 10,
                        flexDirection: 'row', alignItems: 'center', gap: 4,
                        backgroundColor: goalIndex === i
                          ? (g.type === 'none' ? (isLight ? '#E0E0E0' : 'rgba(255,255,255,0.14)') : '#00C6FF22')
                          : (isLight ? '#F0F0F5' : 'rgba(255,255,255,0.05)'),
                        borderWidth: 1,
                        borderColor: goalIndex === i
                          ? (g.type === 'none' ? (isLight ? '#CCC' : 'rgba(255,255,255,0.25)') : '#00C6FF70')
                          : (isLight ? '#E0E0E0' : 'rgba(255,255,255,0.07)'),
                      }}
                    >
                      {goalIndex === i && g.type !== 'none' && <Ionicons name="flag" size={9} color="#00C6FF" />}
                      <Text style={{
                        fontSize: 11, fontWeight: goalIndex === i ? '800' : '500',
                        color: goalIndex === i ? (g.type === 'none' ? (isLight ? '#333' : '#FFF') : '#00C6FF') : T.text,
                      }}>{g.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Virtual Pacer Selector */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={{ color: T.text, fontSize: 10, fontWeight: '800', letterSpacing: 0.8 }}>VIRTUAL PACER (PRO/ELITE)</Text>
                  {settings?.pacerEnabled && (
                    <Text style={{ color: '#BF5FFF', fontSize: 10, fontWeight: '800' }}>
                      Target: {settings?.pacerPaceMinPerKm} min/{isMetric ? 'km' : 'mi'}
                    </Text>
                  )}
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingRight: 4, marginBottom: 10 }}>
                  {getPacerOptions(isMetric).map((opt, i) => {
                    const isSelected = settings?.pacerEnabled ? (settings?.pacerPaceMinPerKm === opt.pace) : (opt.pace === 0);
                    const isLocked = opt.pace !== 0 && userTier !== 'pro' && userTier !== 'elite';
                    return (
                      <TouchableOpacity
                        key={i}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          if (isLocked) {
                            Alert.alert(
                              'Unlock Required',
                              'The Virtual Pacer is exclusive to RunQuest PRO and ELITE members. Upgrade now to race against your target pace!',
                              [
                                { text: 'Cancel', style: 'cancel' },
                                { text: 'View Plans', onPress: () => navigation.navigate('Profile', { screen: 'Premium' }) }
                              ]
                            );
                            return;
                          }
                          import('../config/settings').then(({ updateSettings }) => {
                            updateSettings({
                              pacerEnabled: opt.pace !== 0,
                              pacerPaceMinPerKm: opt.pace,
                            });
                          }).catch(() => {});
                        }}
                        style={{
                          paddingHorizontal: 11, paddingVertical: 6, borderRadius: 10,
                          flexDirection: 'row', alignItems: 'center', gap: 4,
                          backgroundColor: isSelected
                            ? '#BF5FFF22'
                            : (isLight ? '#F0F0F5' : 'rgba(255,255,255,0.05)'),
                          borderWidth: 1,
                          borderColor: isSelected
                            ? '#BF5FFF70'
                            : (isLight ? '#E0E0E0' : 'rgba(255,255,255,0.07)'),
                        }}
                      >
                        {isLocked && <Ionicons name="lock-closed" size={10} color={T.text} />}
                        <Text style={{
                          fontSize: 11, fontWeight: isSelected ? '800' : '500',
                          color: isSelected ? '#BF5FFF' : T.text,
                        }}>{opt.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Voice Coach Toggle */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, backgroundColor: isLight ? '#F9F9FB' : 'rgba(255,255,255,0.02)', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: isLight ? '#EEE' : 'rgba(255,255,255,0.05)' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="mic-outline" size={14} color={settings?.voiceCoachEnabled !== false ? T.green : T.text} />
                    <Text style={{ color: T.text, fontSize: 12, fontWeight: '700' }}>AI Voice Coach</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      const isLocked = userTier !== 'pro' && userTier !== 'elite';
                      if (isLocked) {
                        Alert.alert(
                          'Unlock Required',
                          'The AI Voice Coach is exclusive to RunQuest PRO and ELITE members. Upgrade now to get real-time audio pace alerts!',
                          [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'View Plans', onPress: () => navigation.navigate('Profile', { screen: 'Premium' }) }
                          ]
                        );
                        return;
                      }
                      const curVal = settings?.voiceCoachEnabled !== false;
                      import('../config/settings').then(({ updateSettings }) => {
                        updateSettings({ voiceCoachEnabled: !curVal });
                      }).catch(() => {});
                    }}
                    style={{
                      paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
                      backgroundColor: settings?.voiceCoachEnabled !== false
                        ? T.green + '22'
                        : (isLight ? '#F0F0F5' : 'rgba(255,255,255,0.08)'),
                      borderWidth: 1,
                      borderColor: settings?.voiceCoachEnabled !== false
                        ? T.green + '50'
                        : (isLight ? '#DDD' : 'rgba(255,255,255,0.1)'),
                    }}
                  >
                    <Text style={{ color: settings?.voiceCoachEnabled !== false ? T.green : T.text, fontSize: 10, fontWeight: '900' }}>
                      {settings?.voiceCoachEnabled !== false ? 'ENABLED' : 'DISABLED'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            <View style={styles.actionRow}>
              {/* Feature Hub button — quick shortcut to compete & train features */}
              {state === 'idle' && (
                <TouchableOpacity
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowHub(true); }}
                  style={[styles.secondaryBtn, { backgroundColor: isLight ? '#FFF9E6' : 'rgba(255,214,10,0.12)', borderColor: isLight ? '#FFE0B2' : 'rgba(255,214,10,0.3)', width: 48, marginRight: 2 }]}
                >
                  <Ionicons name="apps" size={20} color="#FFD60A" />
                </TouchableOpacity>
              )}

              {/* Bug report icon — always in dashboard */}
              <TouchableOpacity
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowBugReport(true); }}
                style={[styles.secondaryBtn, { backgroundColor: isLight ? '#FFF0F0' : 'rgba(255,69,58,0.12)', borderColor: isLight ? '#FFCDD2' : 'rgba(255,69,58,0.3)', width: 48 }]}
              >
                <Ionicons name="bug-outline" size={20} color="#FF453A" />
              </TouchableOpacity>

              {state === 'idle' ? (
                <Animated.View style={{ flex: 1, transform: [{ scale: startBtnPulse }] }}>
                  <TouchableOpacity activeOpacity={0.8} onPress={startWithCountdown} style={[styles.primaryBtn, { backgroundColor: T.green, width: '100%' }]}>
                    <View style={styles.btnGrad}>
                      <Ionicons name="play" size={20} color="#000" />
                      <Text style={styles.btnText}>START RUN</Text>
                    </View>
                  </TouchableOpacity>
                </Animated.View>
              ) : state === 'paused' ? (
                <>
                  <TouchableOpacity onPress={resumeRun} disabled={isSaving} style={[styles.primaryBtn, { backgroundColor: T.green }]}>
                    <View style={styles.btnGrad}>
                      <Ionicons name="play" size={24} color="#000" />
                      <Text style={styles.btnText}>RESUME</Text>
                    </View>
                  </TouchableOpacity>
                  {/* Hold to stop — prevents accidental stop */}
                  <ConfirmStop onConfirm={handleStop} disabled={isSaving} />
                </>
              ) : (
                <>
                  <TouchableOpacity onPress={reset} style={[styles.secondaryBtn, { backgroundColor: isLight ? '#F2F2F7' : 'rgba(255,255,255,0.1)', borderColor: isLight ? '#DDD' : 'rgba(255,255,255,0.1)' }]}>
                    <Ionicons name="refresh" size={24} color={isLight ? '#000' : '#FFF'} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={openClaimModal}
                    disabled={!closedLoop || loopAreaSqM < 100}
                    style={[styles.primaryBtn, { opacity: (closedLoop && loopAreaSqM >= 100) ? 1 : 0.5, backgroundColor: (closedLoop && loopAreaSqM >= 100) ? T.green : T.muted }]}
                  >
                    <View style={styles.btnGrad}>
                      <Ionicons name="flag-outline" size={22} color={(closedLoop && loopAreaSqM >= 100) ? '#000' : T.text} />
                      <Text style={[styles.btnText, { color: (closedLoop && loopAreaSqM >= 100) ? '#000' : T.text }]}>
                        {closedLoop ? (loopAreaSqM >= 100 ? 'CLAIM TERRITORY' : 'LOOP TOO SMALL') : 'NO LOOP'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </Animated.View>
      ) : null}

      {/* RunBot FAB — direct child of root, draggable */}
      <RunBotFAB
        visible={settings?.showRunBotFab !== false && !cleanMode}
        onPress={() => setShowBotHelp(true)}
        botPosition={botPosition}
        botPanResponder={botPanResponder}
        pulseAnim={pulseAnim}
        insets={insets}
      />

      <RunBotHelpModal
        visible={showBotHelp}
        onClose={() => setShowBotHelp(false)}
        onAskAnything={() => {
          setShowBotHelp(false);
          setTimeout(() => {
            try {
              const parent = navigation.getParent?.();
              if (parent) {
                parent.navigate('Profile', { screen: 'ChatBot' });
              } else {
                navigation.navigate('ChatBot' as any);
              }
            } catch { }
          }, 300);
        }}
        isLight={isLight}
        insets={insets}
      />

      {/* Music Player Pill — always rendered so animation works, visibility controlled by visible prop */}
      <View style={[StyleSheet.absoluteFill, { zIndex: 700, elevation: 700, overflow: 'visible' }]} pointerEvents="box-none">
        {/* Backdrop — tap anywhere to close pill */}
        {showMusicPill && (
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={closeMusicPill}
          />
        )}
        <MusicPlayer
          visible={showMusicPill}
          topOffset={insets.top + (cleanMode ? 6 : 10)}
        />
      </View>

      {/* Loop Not Closed Dialog */}
      <Modal visible={showShortRunDialog} transparent animationType="fade" onRequestClose={() => setShowShortRunDialog(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <View style={{
            backgroundColor: isLight ? '#FFF' : '#1C1C1E',
            borderRadius: 24, padding: 28, width: '100%',
            borderWidth: 1, borderColor: isLight ? '#E0E0E0' : 'rgba(255,255,255,0.1)',
          }}>
            {/* Icon */}
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#FF9F0A20', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 16 }}>
              <Ionicons name="navigate" size={28} color="#FF9F0A" />
            </View>

            {/* Title */}
            <Text style={{ color: isLight ? '#1C1C1E' : '#FFF', fontSize: 20, fontWeight: '900', textAlign: 'center', marginBottom: 10 }}>
              Loop Not Closed Yet
            </Text>

            {/* Message */}
            <Text style={{ color: isLight ? '#6C6C70' : '#8E8E93', fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 12 }}>
              {shortRunMessage}
            </Text>

            {/* Tip */}
            <View style={{ backgroundColor: T.green + '15', borderRadius: 12, padding: 12, marginBottom: 24, borderWidth: 1, borderColor: T.green + '30' }}>
              <Text style={{ color: T.green, fontSize: 12, fontWeight: '700', textAlign: 'center' }}>
                💡 Head back the way you came to close the loop faster
              </Text>
            </View>

            {/* Keep Running */}
            <TouchableOpacity
              onPress={() => setShowShortRunDialog(false)}
              activeOpacity={0.85}
              style={{ borderRadius: 16, overflow: 'hidden', marginBottom: 10 }}
            >
              <LinearGradient colors={['#32D74B', '#00C6A0']} style={{ paddingVertical: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Ionicons name="play" size={16} color="#000" />
                <Text style={{ color: '#000', fontWeight: '900', fontSize: 16 }}>Keep Running</Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Stop & show summary */}
            <TouchableOpacity
              onPress={async () => {
                setShowShortRunDialog(false);
                await doStop();
              }}
              activeOpacity={0.85}
              style={{
                paddingVertical: 16, alignItems: 'center', justifyContent: 'center',
                borderRadius: 16, flexDirection: 'row', gap: 8,
                backgroundColor: '#FF3B3015',
                borderWidth: 1.5, borderColor: '#FF3B3040',
              }}
            >
              <Ionicons name="stop-circle-outline" size={18} color="#FF3B30" />
              <Text style={{ color: '#FF3B30', fontWeight: '800', fontSize: 15 }}>Stop & See Summary</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Achievement unlock toast — auto-advancing, non-blocking */}
      <AchievementModal
        popup={runAchievementPopup}
        queueCount={achievementQueue.length}
        onDismiss={() => {
          const remaining = achievementQueue.slice(1);
          setAchievementQueue(remaining);
          setRunAchievementPopup(remaining[0] ?? null);
        }}
        onDismissAll={() => {
          setAchievementQueue([]);
          setRunAchievementPopup(null);
        }}
      />

      {/* ════ FEATURE HUB MODAL ════ */}
      <Modal visible={showHub} transparent animationType="slide" onRequestClose={() => setShowHub(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.78)', justifyContent: 'flex-end' }}>
          {/* Tap backdrop to close */}
          <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={() => setShowHub(false)} />
          
          <View style={{
            backgroundColor: isLight ? '#FFF' : '#0E0E12',
            borderTopLeftRadius: 32, borderTopRightRadius: 32,
            padding: 24, paddingBottom: insets.bottom + 24,
            borderWidth: 1, borderColor: isLight ? '#E5E5EA' : 'rgba(255,255,255,0.08)',
          }}>
            {/* Drag Handle */}
            <View style={{ width: 42, height: 5, borderRadius: 2.5, backgroundColor: isLight ? '#E5E5EA' : '#2C2C2E', alignSelf: 'center', marginBottom: 20 }} />

            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <View>
                <Text style={{ color: isLight ? '#000' : '#FFF', fontSize: 20, fontWeight: '900', letterSpacing: -0.5 }}>RunQuest Hub</Text>
                <Text style={{ color: isLight ? '#666' : '#8E8E93', fontSize: 12, marginTop: 2 }}>COMPETE, TRAIN & REWARDS</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowHub(false)}
                style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isLight ? '#F2F2F7' : 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons name="close" size={20} color={isLight ? '#000' : '#FFF'} />
              </TouchableOpacity>
            </View>

            {/* Grid of features */}
            <View style={{ gap: 12 }}>
              {[
                [
                  { id: 'QuestsShop',   label: 'Quests & Shop', desc: 'Daily quests & trail rewards', icon: 'sparkles',  color: T.gold || '#FFD60A', bg: 'rgba(255,214,10,0.1)' },
                  { id: 'Leaderboard', label: 'Leaderboard',  desc: 'See global rankings',     icon: 'podium',    color: '#0A84FF', bg: 'rgba(10,132,255,0.1)' },
                ],
                [
                  { id: 'Achievements',label: 'Achievements', desc: 'Badges & XP milestones',       icon: 'trophy',    color: '#FFD60A', bg: 'rgba(255,214,10,0.1)' },
                  { id: 'Teams',       label: 'Teams & Guilds',desc: 'Form alliances to conquer',   icon: 'people',    color: '#BF5FFF', bg: 'rgba(191,95,255,0.1)' },
                ],
                [
                  { id: 'Fitness',     label: 'Fitness Stats', desc: 'HR zones & run calories',     icon: 'flame',     color: '#FF453A', bg: 'rgba(255,69,58,0.1)' },
                  { id: 'ChatBot',     label: 'RunBot Coach',  desc: 'Talk with your AI coach',    icon: 'hardware-chip', color: T.green || '#32D74B', bg: 'rgba(50,215,75,0.1)' },
                ]
              ].map((row, rowIndex) => (
                <View key={rowIndex} style={{ flexDirection: 'row', gap: 12 }}>
                  {row.map(item => (
                    <TouchableOpacity
                      key={item.id}
                      activeOpacity={0.8}
                      onPress={() => {
                        setShowHub(false);
                        setTimeout(() => {
                          // From the Run tab, navigation.getParent() = Tab Navigator
                          // We must tell the Tab Navigator to switch to 'Profile'
                          // AND pass the nested screen as a param
                          try {
                            const tabNav = navigation.getParent?.();
                            if (tabNav) {
                              tabNav.navigate('Profile', {
                                screen: item.id,
                                initial: false,
                              });
                            } else {
                              // Fallback: try direct navigation (works if already in Profile tab)
                              navigation.navigate('Profile' as any, {
                                screen: item.id,
                                initial: false,
                              });
                            }
                          } catch (err) {
                            console.warn('Hub navigation failed:', err);
                          }
                        }, 250);
                      }}
                      style={{
                        flex: 1,
                        backgroundColor: isLight ? '#F9F9FC' : 'rgba(255,255,255,0.03)',
                        borderRadius: 20,
                        padding: 16,
                        borderWidth: 1,
                        borderColor: isLight ? '#E5E5EA' : 'rgba(255,255,255,0.05)',
                        gap: 12,
                      }}
                    >
                      <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: item.bg, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name={item.icon as any} size={20} color={item.color} />
                      </View>
                      <View>
                        <Text style={{ color: isLight ? '#000' : '#FFF', fontSize: 13, fontWeight: '900' }}>{item.label}</Text>
                        <Text style={{ color: isLight ? '#666' : '#8E8E93', fontSize: 10, marginTop: 3, lineHeight: 14 }} numberOfLines={2}>{item.desc}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {/* Clean Mode exit — round button on left side of screen, in clear map area */}
      {cleanMode && (
        <>
          {/* Clean mode bottom bar — only PACE + M² (TIME & KM already in top pill) + pause/stop */}
          {(state === 'running' || state === 'paused') && (
            <View style={{
              position: 'absolute',
              bottom: insets.bottom + 90,
              left: 16, right: 16,
              zIndex: 400, elevation: 400,
              alignItems: 'center',
            }}>
              <View style={{
                backgroundColor: state === 'paused' ? '#FF9F0A' : 'rgba(10,10,10,0.94)',
                borderRadius: 18,
                borderWidth: 1.5,
                borderColor: state === 'paused' ? '#FF9F0A' : T.green + '50',
                paddingVertical: 10,
                paddingHorizontal: 14,
                flexDirection: 'row',
                alignItems: 'center',
                alignSelf: 'center',
                minWidth: 260,
              }}>
                {state === 'paused' && (
                  <Ionicons name="pause-circle" size={18} color="#000" style={{ marginRight: 8 }} />
                )}
                {/* PACE */}
                <View style={{ alignItems: 'center', flex: 1 }}>
                  <Text style={{ color: state === 'paused' ? '#000' : '#00C6FF', fontSize: 16, fontWeight: '900' }}>{pace > 0 ? pace.toFixed(1) : '--'}</Text>
                  <Text style={{ color: state === 'paused' ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.4)', fontSize: 8, fontWeight: '700' }}>PACE</Text>
                </View>
                <View style={{ width: 1, height: 22, backgroundColor: state === 'paused' ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.15)' }} />
                {/* M² */}
                <View style={{ alignItems: 'center', flex: 1 }}>
                  <Text style={{ color: state === 'paused' ? '#000' : '#FFF', fontSize: 16, fontWeight: '800' }}>{Math.round(polygonAreaSqMeters(path))}</Text>
                  <Text style={{ color: state === 'paused' ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.4)', fontSize: 8, fontWeight: '700' }}>M²</Text>
                </View>
                <View style={{ width: 1, height: 22, backgroundColor: state === 'paused' ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.15)' }} />
                {/* ALT */}
                <View style={{ alignItems: 'center', flex: 1 }}>
                  <Text style={{ color: state === 'paused' ? '#000' : T.gold || '#FFD700', fontSize: 16, fontWeight: '800' }}>{altitudeMeters !== null ? Math.round(altitudeMeters) : '--'}</Text>
                  <Text style={{ color: state === 'paused' ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.4)', fontSize: 8, fontWeight: '700' }}>ALT m</Text>
                </View>
                {/* Pause/Resume */}
                <TouchableOpacity
                  onPress={() => { state === 'running' ? pauseRun() : resumeRun(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }}
                  style={{
                    marginLeft: 10,
                    width: 34, height: 34, borderRadius: 17,
                    backgroundColor: state === 'paused' ? 'rgba(0,0,0,0.2)' : '#FF9F0A',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Ionicons name={state === 'running' ? 'pause' : 'play'} size={16} color="#000" />
                </TouchableOpacity>
                {/* Stop — double-tap to confirm */}
                <View style={{ marginLeft: 6 }}>
                  <ConfirmStop onConfirm={handleStop} disabled={isSaving} compact />
                </View>
              </View>
            </View>
          )}

          {/* Eye button — disabled during active run, shows lock hint */}
          <TouchableOpacity
            onPress={async () => {
              // Block toggling clean mode while a run is active — would break the UI
              if (state === 'running' || state === 'paused') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                return;
              }
              const { updateSettings: upd } = await import('../config/settings');
              const next = await upd({ mapCleanMode: false });
              setSettings(next);
            }}
            style={{
              position: 'absolute',
              right: 15,
              top: '40%',
              width: 52,
              height: 52,
              borderRadius: 26,
              backgroundColor: (state === 'running' || state === 'paused')
                ? 'rgba(100,100,100,0.6)'
                : 'rgba(255,107,53,0.92)',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 400,
              elevation: 400,
              shadowColor: (state === 'running' || state === 'paused') ? '#000' : '#FF6B35',
              shadowOpacity: 0.7,
              shadowRadius: 10,
              borderWidth: 1.5,
              borderColor: (state === 'running' || state === 'paused')
                ? 'rgba(255,255,255,0.15)'
                : 'rgba(255,255,255,0.3)',
            }}
          >
            <Ionicons
              name={(state === 'running' || state === 'paused') ? 'lock-closed-outline' : 'eye-outline'}
              size={22}
              color={(state === 'running' || state === 'paused') ? 'rgba(255,255,255,0.4)' : '#FFF'}
            />
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { position: 'absolute', top: 0, left: 16, right: 16, zIndex: 100, elevation: 100 },
  headerBlur: { borderRadius: 24, overflow: 'hidden', padding: 16 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusBlock: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  timer: { fontSize: 34, fontWeight: '900', fontVariant: ['tabular-nums'] },
  headerBottom: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  locationText: { flex: 1, fontSize: 13, fontWeight: '600', opacity: 0.8 },
  accuracyText: { fontSize: 11, fontWeight: '800' },
  toolBar: { position: 'absolute', right: 16, gap: 10, zIndex: 200, elevation: 200 },
  toolBtn: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 8, elevation: 6 },
  dashboard: { position: 'absolute', bottom: 0, left: 16, right: 16, zIndex: 100, elevation: 100 },
  dashBlur: { borderRadius: 28, padding: 20 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 30 },
  summaryCard: { borderRadius: 32, padding: 30, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  summaryTitle: { fontSize: 24, fontWeight: '900', textAlign: 'center', marginBottom: 30, letterSpacing: -0.5 },
  summaryGrid: { flexDirection: 'row', justifyContent: 'space-around', gap: 20 },
  summaryItem: { alignItems: 'center' },
  summaryLabel: { fontSize: 10, fontWeight: '800', opacity: 0.6, letterSpacing: 1, marginBottom: 4 },
  summaryValue: { fontSize: 22, fontWeight: '900' },
  gaugesRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  gauge: { flex: 1, alignItems: 'center', gap: 6 },
  gaugeIconBox: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  gaugeLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  gaugeValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  gaugeValue: { fontSize: 22, fontWeight: '900' },
  gaugeUnit: { fontSize: 10, fontWeight: '700' },
  vLine: { width: 1, height: '50%', alignSelf: 'center' },
  actionRow: { flexDirection: 'row', gap: 12, minHeight: 54 },
  primaryBtn: { height: 54, borderRadius: 18, flex: 1 },
  secondaryBtn: { width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  btnGrad: { height: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnText: { color: '#000', fontWeight: '900', fontSize: 15 },
  loopToast: { position: 'absolute', bottom: 180, alignSelf: 'center', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, borderWidth: 1 },
  loopToastText: { fontSize: 15, fontWeight: '800' },
  noLoopHint: { fontSize: 11, textAlign: 'center', marginTop: 8, opacity: 0.7 },
  botFab: { position: 'absolute', zIndex: 200, elevation: 200 },
  botFabHalo: { position: 'absolute', width: 80, height: 50, borderRadius: 25, backgroundColor: '#00FF8715', top: -5, left: -5 },
  botFabBtn: { borderRadius: 22, overflow: 'hidden' },
  botFabInner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 22, borderWidth: 1, borderColor: '#00FF8740' },
  botFabIconRow: { position: 'relative' },
  botFabOnlineDot: { position: 'absolute', width: 7, height: 7, borderRadius: 4, backgroundColor: '#00FF87', top: -1, right: -2, borderWidth: 1, borderColor: '#16213E' },
  botFabTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '900', letterSpacing: 0.2 },
  botFabSub: { color: '#00FF87', fontSize: 9, fontWeight: '700', letterSpacing: 0.3 },
  compactBar: { position: 'absolute', left: 16, right: 16, zIndex: 100, elevation: 100 },
  compactBarInner: { borderRadius: 20, borderWidth: 1, padding: 14, flexDirection: 'row', alignItems: 'center' },
  searchOverlay: { position: 'absolute', top: 0, left: 16, right: 16, zIndex: 300, elevation: 300, paddingTop: 0 },
  searchBar: { flexDirection: 'row', alignItems: 'center', borderRadius: 18, borderWidth: 1, paddingHorizontal: 14, height: 52, gap: 10, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 },
  searchInput: { flex: 1, fontSize: 15 },
  searchResults: { borderRadius: 18, borderWidth: 1, marginTop: 8, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 },
  searchResultRow: { flexDirection: 'row', alignItems: 'center', padding: 14 },
});
