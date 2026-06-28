import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  TextInput, KeyboardAvoidingView, Platform, Animated,
  ActivityIndicator, Dimensions, ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/utils/ThemeContext';
import { updateSettings } from '../config/settings';
import * as Haptics from 'expo-haptics';
import { getAIResponse, AIMessage, AIError } from '../services/chatAIService';
import { getRunStore, subscribeRunStore } from '../store/useRunStore';

const { width } = Dimensions.get('window');

interface Message {
  id: string;
  role: 'user' | 'bot';
  text: string;
  timestamp: Date;
  navAction?: NavAction;
  actionChips?: ActionChip[];
  isAI?: boolean;
}

type NavAction = { label: string; icon: string; screen: string; color: string };
type ActionChip = { label: string; icon: string; color: string; action: string };

// ─── Bot knowledge base (local fallback) ─────────────────────────────────────
interface BotEntry {
  patterns: string[];
  response: string;
  navAction?: NavAction;
  actionChips?: ActionChip[];
}

const BOT_RESPONSES: BotEntry[] = [
  {
    patterns: ['hello', 'hi', 'hey', 'start', 'what can you do', 'what do you do'],
    response: "Hey warrior! I'm RunBot 🤖\n\nI can answer questions AND perform actions for you:\n- 'Change theme to dark'\n- 'Switch navbar style'\n- 'How do I claim territory?'\n- 'Take me to achievements'",
    navAction: { label: 'Open Help & Support', icon: 'help-buoy', screen: 'HelpSupport', color: '#5E5CE6' },
  },
  {
    patterns: ['how are you', 'how r u', 'how are u', 'whats up', "what's up", 'sup', 'wassup'],
    response: "Fully charged and ready to help! 💪\n\nWhat can I do for you today, warrior?",
  },
  {
    patterns: ['who are you', 'who r u', 'what are you', 'tell me about yourself', 'introduce yourself'],
    response: "I'm RunBot — the AI assistant built into RunQuest!\n\nI can change your theme, switch navbar styles, toggle settings, navigate to any screen, and answer anything about the app. What do you need?",
  },
  {
    patterns: ['who made this', 'who created this', 'who built this', 'who made runquest', 'developer', 'creator'],
    response: "RunQuest was built by **Saad Ikram** — a passionate developer who combined GPS territory claiming, fitness tracking, global leaderboards, and a music player into one app. 🏃",
  },
  {
    patterns: ['thank', 'thanks', 'thank you', 'thx', 'ty', 'appreciate', 'great', 'awesome', 'nice', 'cool', 'perfect'],
    response: "You're welcome, warrior! Happy to help anytime. 🙌",
  },
  {
    patterns: ['bye', 'goodbye', 'see you', 'later', 'cya'],
    response: "See you on the battlefield! Go claim some territories! 🗺️",
  },
  {
    patterns: ['good morning', 'good afternoon', 'good evening', 'good night'],
    response: "Hey! Great time to go for a run and claim some territory! What can I help you with? 🌟",
  },
  {
    patterns: ['joke', 'tell me a joke', 'make me laugh', 'funny'],
    response: "Why did the runner bring a map?\n\nBecause they wanted to **claim territory** — not just run in circles! 😄\n\n(Okay I'll stick to helping with the app)",
  },
  {
    patterns: ['motivate me', 'motivation', 'inspire me', 'i dont want to run', "i don't want to run", 'lazy'],
    response: "Every territory you claim started with a single step. 🔥\n\nYour rivals are out there right now taking your land. Get out there and show them who owns this city!\n\nYou've got this, warrior. Let's go!",
    navAction: { label: 'Start Running', icon: 'play-circle', screen: 'Run', color: '#0A84FF' },
  },
  // ── Theme changes ──────────────────────────────────────────────────────────
  {
    patterns: ['change theme', 'switch theme', 'set theme', 'theme options', 'what themes'],
    response: "I can change your theme right now! Pick one:",
    actionChips: [
      { label: 'Midnight (Dark)', icon: 'moon', color: '#5E5CE6', action: 'theme:midnight' },
      { label: 'Aurora (Blue)', icon: 'water', color: '#00C6FF', action: 'theme:aurora' },
      { label: 'Sunset (Orange)', icon: 'sunny', color: '#FFC247', action: 'theme:sunset' },
      { label: 'Light', icon: 'sunny-outline', color: '#007AFF', action: 'theme:light' },
    ],
  },
  { patterns: ['dark theme', 'dark mode', 'midnight theme', 'set dark'], response: "Switching to Midnight theme!", actionChips: [{ label: 'Apply Midnight', icon: 'moon', color: '#5E5CE6', action: 'theme:midnight' }] },
  { patterns: ['light theme', 'light mode', 'set light', 'white theme'], response: "Switching to Light theme!", actionChips: [{ label: 'Apply Light', icon: 'sunny-outline', color: '#007AFF', action: 'theme:light' }] },
  { patterns: ['aurora theme', 'blue theme', 'teal theme'], response: "Switching to Aurora theme!", actionChips: [{ label: 'Apply Aurora', icon: 'water', color: '#00C6FF', action: 'theme:aurora' }] },
  { patterns: ['sunset theme', 'orange theme', 'warm theme'], response: "Switching to Sunset theme!", actionChips: [{ label: 'Apply Sunset', icon: 'partly-sunny', color: '#FFC247', action: 'theme:sunset' }] },
  // ── Navbar changes ─────────────────────────────────────────────────────────
  {
    patterns: ['change navbar', 'switch navbar', 'navbar options', 'change navigation bar', 'navbar style'],
    response: "I can change your navbar style right now! Pick one:",
    actionChips: [
      { label: 'Floating Pill', icon: 'ellipse-outline', color: '#5E5CE6', action: 'navbar:pill' },
      { label: 'Neon Dot', icon: 'radio-button-on', color: '#00C6FF', action: 'navbar:minimal' },
      { label: 'Side Accent', icon: 'reorder-four', color: '#BF5FFF', action: 'navbar:glass' },
      { label: 'Bubble Slide', icon: 'albums', color: '#FFD60A', action: 'navbar:curved' },
    ],
  },
  { patterns: ['pill navbar', 'floating pill', 'default navbar'], response: "Switching to Floating Pill navbar!", actionChips: [{ label: 'Floating Pill', icon: 'ellipse-outline', color: '#5E5CE6', action: 'navbar:pill' }] },
  { patterns: ['minimal navbar', 'neon dot', 'neon navbar'], response: "Switching to Neon Dot navbar!", actionChips: [{ label: 'Neon Dot', icon: 'radio-button-on', color: '#00C6FF', action: 'navbar:minimal' }] },
  { patterns: ['glass navbar', 'side accent', 'accent navbar'], response: "Switching to Side Accent navbar!", actionChips: [{ label: 'Side Accent', icon: 'reorder-four', color: '#BF5FFF', action: 'navbar:glass' }] },
  { patterns: ['curved navbar', 'bubble navbar', 'bubble slide'], response: "Switching to Bubble Slide navbar!", actionChips: [{ label: 'Bubble Slide', icon: 'albums', color: '#FFD60A', action: 'navbar:curved' }] },
  // ── Settings toggles ───────────────────────────────────────────────────────
  { patterns: ['turn on nearby', 'show nearby', 'enable nearby warriors', 'show warriors on map'], response: "Turning on Nearby Warriors! You'll see owner badges on territories within 10km.", actionChips: [{ label: 'Enable Nearby Warriors', icon: 'people', color: '#00C6FF', action: 'setting:showNearbyTerritories:true' }] },
  { patterns: ['turn off nearby', 'hide nearby', 'disable nearby warriors'], response: "Turning off Nearby Warriors.", actionChips: [{ label: 'Disable Nearby Warriors', icon: 'people-outline', color: '#666', action: 'setting:showNearbyTerritories:false' }] },
  { patterns: ['turn on music', 'enable music player', 'show music player'], response: "Enabling the music player!", actionChips: [{ label: 'Enable Music Player', icon: 'musical-notes', color: '#FF2D55', action: 'setting:showMusicPlayer:true' }] },
  { patterns: ['turn off music', 'disable music player', 'hide music player'], response: "Disabling the music player.", actionChips: [{ label: 'Disable Music Player', icon: 'musical-notes-outline', color: '#666', action: 'setting:showMusicPlayer:false' }] },
  { patterns: ['metric', 'use km', 'switch to km', 'kilometers'], response: "Switching to Metric (KM)!", actionChips: [{ label: 'Use Metric (KM)', icon: 'speedometer', color: '#5E5CE6', action: 'setting:units:metric' }] },
  { patterns: ['imperial', 'use miles', 'switch to miles', 'miles'], response: "Switching to Imperial (MI)!", actionChips: [{ label: 'Use Imperial (MI)', icon: 'speedometer-outline', color: '#0A84FF', action: 'setting:units:imperial' }] },
  {
    patterns: ['change map', 'map style options', 'switch map', 'map mode'],
    response: "Pick a map style:",
    actionChips: [
      { label: 'Light Map', icon: 'sunny-outline', color: '#007AFF', action: 'setting:tileStyle:default' },
      { label: 'Dark Map', icon: 'moon', color: '#5E5CE6', action: 'setting:tileStyle:dark' },
      { label: 'Satellite', icon: 'earth', color: '#FFD60A', action: 'setting:tileStyle:satellite' },
      { label: '3D Map', icon: 'cube-outline', color: '#FF6B35', action: 'setting:tileStyle:3d' },
    ],
  },
  // ── App knowledge ──────────────────────────────────────────────────────────
  {
    patterns: ['territory', 'claim', 'conquer', 'loop', 'how to claim', 'closed loop', 'claim territory'],
    response: "How to Claim a Territory 🗺️\n\n1. Tap START RUN on the Run screen\n2. Run a closed GPS loop outside\n3. End within 30m of your start point\n4. Need at least 100m perimeter\n5. Tap CLAIM TERRITORY in the run summary\n\nPro tip: Bigger loops = more land!",
    navAction: { label: 'Go to Run Screen', icon: 'play-circle', screen: 'Run', color: '#0A84FF' },
  },
  {
    patterns: ['invasion', 'invade', 'attack', 'steal territory', 'overlap', 'take over'],
    response: "Invading Enemy Territories ⚔️\n\n- Run a loop that overlaps 50%+ of an enemy territory\n- Tap CLAIM TERRITORY after your run\n- Their territory is deleted, yours replaces it\n\nStrategy: One large loop can conquer multiple territories at once!",
    navAction: { label: 'Go to Run Screen', icon: 'play-circle', screen: 'Run', color: '#FF453A' },
  },
  {
    patterns: ['calorie', 'calories', 'burn', 'kcal', 'energy'],
    response: "Calorie Calculation 🔥\n\nFormula: 9.8 × weight(kg) × hours\n\nFor a 70kg person:\n- 30 min = ~343 kcal\n- 1 hour = ~686 kcal\n\nView your full history in the Fitness screen!",
    navAction: { label: 'Open Fitness Screen', icon: 'fitness', screen: 'Fitness', color: '#FF6B35' },
  },
  {
    patterns: ['leaderboard', 'rank', 'ranking', 'top', 'compete', 'global', 'standings'],
    response: "Global Leaderboard 🏆\n\nRanked by total territory area worldwide. Updates in real-time from Firebase.\n\nStrategy: Claim open parks and large blocks for maximum area per run!",
    navAction: { label: 'Open Leaderboard', icon: 'podium', screen: 'Leaderboard', color: '#FFD60A' },
  },
  {
    patterns: ['achievement', 'badge', 'unlock', 'milestone', 'trophy', 'xp', 'tier'],
    response: "Achievements — 7 Tiers 🏅\n\nBronze → Silver → Gold → Diamond → Legendary → Mythic\n\nUnlock automatically based on your stats. XP reward pops up after each run!",
    navAction: { label: 'View Achievements', icon: 'trophy', screen: 'Achievements', color: '#FFD60A' },
  },
  {
    patterns: ['music', 'song', 'playlist', 'audio', 'player', 'add music'],
    response: "Music Player 🎵\n\n- Tap + to load songs from your device\n- Controls: play/pause, skip, previous, seek 10s\n- Keeps playing when screen is off\n- Playlist saved to your account\n\nEnable/disable in Settings → Run",
    navAction: { label: 'Go to Run Screen', icon: 'musical-notes', screen: 'Run', color: '#FF2D55' },
  },
  {
    patterns: ['gps', 'location', 'accuracy', 'signal', 'tracking', 'poor gps'],
    response: "GPS Tips 📍\n\n- Go outside before starting\n- Wait for accuracy < 20m (shown in header)\n- Avoid tall buildings and tunnels\n- Wait 30s after opening app for GPS lock\n- Enable High Precision GPS in Settings → Run",
    navAction: { label: 'Go to Run Screen', icon: 'navigate', screen: 'Run', color: '#0A84FF' },
  },
  {
    patterns: ['nearby warriors', 'show territories on map', 'territory markers', 'owner on map'],
    response: "Nearby Warriors 👥\n\nShows owner name and profile pic on territories within 10km on the run map.\n\nToggle it in Settings → Run, or tap below:",
    actionChips: [
      { label: 'Turn On', icon: 'people', color: '#00C6FF', action: 'setting:showNearbyTerritories:true' },
      { label: 'Turn Off', icon: 'people-outline', color: '#666', action: 'setting:showNearbyTerritories:false' },
    ],
  },
  {
    patterns: ['settings', 'setting', 'configure', 'options', 'preferences'],
    response: "Settings — 4 Tabs ⚙️\n\nMap — Tile style, theme, zoom buttons\nRun — Units, GPS, music player, clean mode\nGeneral — Navbar style, notifications\nAccount — Sign out, clear history",
    navAction: { label: 'Open Settings', icon: 'settings', screen: 'Settings', color: '#FF9F0A' },
  },
  {
    patterns: ['data', 'history', 'lost', 'reinstall', 'backup', 'sync', 'cloud'],
    response: "Cloud Sync ☁️\n\nEverything saves to Firebase:\n- Run history & territories\n- Settings per account\n- Music playlist per account\n\nReinstall or switch phones — just log in to restore everything!",
  },
  {
    patterns: ['bug', 'error', 'crash', 'problem', 'issue', 'not working', 'fix'],
    response: "Troubleshooting 🔧\n\n1. Restart the app\n2. Check internet connection\n3. GPS not locking — go outside, wait 30s\n4. Music not playing — re-add tracks\n5. Data missing — log out and back in",
    navAction: { label: 'Open Help & Support', icon: 'help-buoy', screen: 'HelpSupport', color: '#FF453A' },
  },
  // ── Navigation shortcuts ───────────────────────────────────────────────────
  { patterns: ['open achievements', 'go to achievements', 'take me to achievements'], response: "Taking you to Achievements! 🏆", navAction: { label: 'Open Achievements', icon: 'trophy', screen: 'Achievements', color: '#FFD60A' } },
  { patterns: ['open leaderboard', 'go to leaderboard', 'take me to leaderboard'], response: "Opening the Leaderboard! 🏅", navAction: { label: 'Open Leaderboard', icon: 'podium', screen: 'Leaderboard', color: '#FFD60A' } },
  { patterns: ['open fitness', 'go to fitness', 'take me to fitness'], response: "Opening Fitness stats! 💪", navAction: { label: 'Open Fitness', icon: 'fitness', screen: 'Fitness', color: '#FF6B35' } },
  { patterns: ['open settings', 'go to settings', 'take me to settings'], response: "Opening Settings! ⚙️", navAction: { label: 'Open Settings', icon: 'settings', screen: 'Settings', color: '#FF9F0A' } },
  { patterns: ['open run', 'go to run', 'start running', 'take me to run'], response: "Taking you to the Run screen! 🏃", navAction: { label: 'Go to Run Screen', icon: 'play-circle', screen: 'Run', color: '#0A84FF' } },
  { patterns: ['open help', 'go to help', 'help support', 'take me to help'], response: "Opening Help and Support! 🆘", navAction: { label: 'Open Help & Support', icon: 'help-buoy', screen: 'HelpSupport', color: '#0A84FF' } },
  { patterns: ['open territories', 'go to territories', 'show kingdoms', 'take me to kingdoms'], response: "Opening the Kingdoms screen! 🗺️", navAction: { label: 'Open Kingdoms', icon: 'map', screen: 'Territories', color: '#30B0C7' } },
  { patterns: ['open teams', 'go to teams', 'show teams', 'take me to teams', 'alliances', 'my team', 'join team', 'create team'], response: "Opening Teams & Alliances! ⚔️", navAction: { label: 'Open Teams', icon: 'people', screen: 'Teams', color: '#BF5FFF' } },
  { patterns: ['open activity', 'go to activity', 'activity feed', 'show feed', 'take me to feed', 'recent conquests'], response: "Opening the Activity Feed! 🌍", navAction: { label: 'Open Activity Feed', icon: 'flash', screen: 'ActivityFeed', color: '#FF453A' } },
  { patterns: ['report bug', 'report a bug', 'bug report', 'found a bug', 'submit bug', 'report issue', 'report problem'], response: "Opening the Bug Report screen! 🐛\n\nYou can select the issue type, severity, describe what happened, and submit directly to the developer.", navAction: { label: 'Report a Bug', icon: 'bug-outline', screen: 'BugReport', color: '#FF453A' } },
  {
    patterns: ['what is activity feed', 'what is the feed', 'how does feed work', 'feed feature'],
    response: "Activity Feed 🌍\n\nSee every territory conquest happening in real-time!\n\n- Global tab: all conquests worldwide\n- Friends tab: only people you follow\n- Follow warriors on the Leaderboard to populate your Friends feed\n- You get notified when someone invades YOUR territory\n\nGo to Profile → Activity Feed",
    navAction: { label: 'Open Activity Feed', icon: 'flash', screen: 'ActivityFeed', color: '#FF453A' },
  },
  {
    patterns: ['what is teams', 'what are teams', 'how do teams work', 'team feature', 'alliance'],
    response: "Teams & Alliances ⚔️\n\nForm alliances with other warriors!\n\n- Create a team with a name, 2-4 char tag, and color\n- Invite others to join your team\n- Your territories show your team tag\n- Team area is combined on the leaderboard\n\nGo to Profile → Teams to get started!",
    navAction: { label: 'Open Teams', icon: 'people', screen: 'Teams', color: '#BF5FFF' },
  },
  {
    patterns: ['territory expiry', 'expire', 'defend territory', 'territory expire', 'how long territory last'],
    response: "Territory Expiry ⏰\n\nTerritories expire after 7 days!\n\n- Expired territories disappear from the map\n- Defend your territory to reset the 7-day timer\n- Go to Territories → tap your territory → Defend\n- You'll see a warning badge when expiry is within 24h",
    navAction: { label: 'Open Territories', icon: 'map', screen: 'Territories', color: '#30B0C7' },
  },
  {
    patterns: ['territory history', 'who owned', 'previous owner', 'conquest history'],
    response: "Territory History 📜\n\nEvery territory tracks its conquest history!\n\n- When you conquer a territory, the previous owner is recorded\n- History is inherited — conquer a territory that was itself conquered and you get the full chain\n- View history in Territories → tap any territory → scroll down",
    navAction: { label: 'Open Territories', icon: 'map', screen: 'Territories', color: '#30B0C7' },
  },
  {
    patterns: ['history', 'run history', 'past runs', 'my runs', 'activities', 'stats history', 'open history', 'go to history', 'history screen', 'take me to history', 'view history'],
    response: "Run History Dashboard 📊\n\nI can take you to your Run History! It has been modernized with:\n- **7-Day Distance Bar Chart**: see your daily mileage.\n- **35-Day Contribution Heatmap**: GitHub-style activity grid.\n- **Personal Bests Panel**: track your longest run, fastest pace, and largest claimed area.\n- **Run Streaks**: keep your daily running streak alive!",
    navAction: { label: 'Open Run History', icon: 'time-outline', screen: 'RunHistory', color: '#32D74B' },
  },
  {
    patterns: ['shop', 'quest shop', 'quests', 'loot', 'buy', 'gold', 'spend', 'open shop', 'go to shop', 'quests shop', 'shop screen', 'take me to shop', 'quests screen', 'view quests'],
    response: "Quests & Loot Shop 🪙\n\n- Complete daily and weekly quests while running to earn gold.\n- Find and collect spawned loot items on the live map.\n- Spend your gold in the shop to unlock premium features and custom map styling!",
    navAction: { label: 'Open Quests & Shop', icon: 'cart-outline', screen: 'QuestsShop', color: '#FFD60A' },
  },
  {
    patterns: ['premium', 'upgrade', 'subscribe', 'pro', 'elite', 'buy premium', 'open premium', 'go to premium', 'get premium', 'elite tier', 'pricing', 'plans', 'cost'],
    response: "Premium Membership Plans 👑\n\nUpgrade to unlock premium combat stats and tools:\n- **Basic ($2.99/mo)**: custom path colors and special avatar skins.\n- **Pro ($5.99/mo)**: audio voice coach, custom goals, and route replay animations.\n- **Elite ($9.99/mo)**: unlimited map styles (Satellite/3D), virtual pacer, and advanced stats.\n\n*Sandbox Bypass: Dev Mode lets you test these tiers for free in unconfigured environments!*",
    navAction: { label: 'View Premium Tiers', icon: 'sparkles', screen: 'Premium', color: '#BF5FFF' },
  },
  {
    patterns: ['saad', 'developer', 'creator', 'who made this', 'open creator', 'go to creator', 'saad profile', 'creator screen'],
    response: "Saad Ikram 💻\n\nRunQuest was created by Saad Ikram. You can check out the Creator profile to see achievements, credits, developer info, and support options!",
    navAction: { label: 'Open Creator Screen', icon: 'code-working-outline', screen: 'Creator', color: '#0A84FF' },
  },
  {
    patterns: ['profile', 'my account', 'avatar', 'user stats', 'open profile', 'go to profile', 'profile screen', 'my profile'],
    response: "User Profile 👤\n\nYour main dashboard containing your team alliances, total gold, current running streak, recent achievements, and quick navigation shortcuts.",
    navAction: { label: 'Open Profile Dashboard', icon: 'person-outline', screen: 'ProfileMain', color: '#5E5CE6' },
  },
];

function getBotEntry(input: string): BotEntry {
  const lower = input.toLowerCase();
  let best: BotEntry | null = null;
  let bestScore = 0;
  for (const entry of BOT_RESPONSES) {
    for (const p of entry.patterns) {
      if (lower.includes(p) && p.length > bestScore) {
        bestScore = p.length;
        best = entry;
      }
    }
  }
  if (best) return best;
  return {
    patterns: [],
    response: "I'm not sure about that one!\n\nTry:\n- 'Change theme'\n- 'How do I claim territory?'\n- 'GPS tips'\n- 'Take me to achievements'\n- 'Change navbar'",
    navAction: { label: 'Open Help & Support', icon: 'help-buoy', screen: 'HelpSupport', color: '#0A84FF' },
  };
}

const SUGGESTIONS = [
  { text: 'Change theme', icon: 'color-palette', color: '#BF5FFF' },
  { text: 'How do I claim territory?', icon: 'map', color: '#5E5CE6' },
  { text: 'Change navbar style', icon: 'apps', color: '#00C6FF' },
  { text: 'Take me to achievements', icon: 'trophy', color: '#FFD60A' },
  { text: 'GPS tips', icon: 'navigate', color: '#0A84FF' },
  { text: 'Motivate me', icon: 'flash', color: '#FF6B35' },
];

// ─── Bot Avatar ───────────────────────────────────────────────────────────────
function BotAvatar({ size = 32, color = '#5E5CE6' }: { size?: number; color?: string }) {
  const s = size;
  return (
    <View style={{
      width: s, height: s, borderRadius: s / 2,
      backgroundColor: color + '22', borderWidth: 1.5, borderColor: color + '55',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <View style={{
        width: s * 0.52, height: s * 0.38, borderRadius: 4,
        backgroundColor: color, alignItems: 'center', justifyContent: 'center',
        position: 'relative',
      }}>
        <View style={{ position: 'absolute', top: -s * 0.14, width: 2, height: s * 0.12, backgroundColor: color, borderRadius: 1 }} />
        <View style={{ position: 'absolute', top: -s * 0.18, width: s * 0.08, height: s * 0.08, borderRadius: s * 0.04, backgroundColor: color + 'CC' }} />
        <View style={{ flexDirection: 'row', gap: s * 0.08 }}>
          <View style={{ width: s * 0.1, height: s * 0.1, borderRadius: s * 0.05, backgroundColor: '#000' }} />
          <View style={{ width: s * 0.1, height: s * 0.1, borderRadius: s * 0.05, backgroundColor: '#000' }} />
        </View>
        <View style={{ width: s * 0.24, height: 2, backgroundColor: '#000', marginTop: s * 0.04, borderRadius: 1 }} />
      </View>
    </View>
  );
}

// ─── Typing dots ──────────────────────────────────────────────────────────────
function TypingDot({ delay, color }: { delay: number; color: string }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.timing(anim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0, duration: 300, useNativeDriver: true }),
      Animated.delay(600 - delay),
    ])).start();
  }, []);
  return (
    <Animated.View style={{
      width: 6, height: 6, borderRadius: 3, backgroundColor: color,
      opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
    }} />
  );
}

// ─── Message Bubble ───────────────────────────────────────────────────────────
function MessageBubble({ msg, isLight, onNavAction, onChipAction }: {
  msg: Message; isLight: boolean;
  onNavAction: (a: NavAction) => void;
  onChipAction: (a: string) => void;
}) {
  const { T } = useTheme();
  const isUser = msg.role === 'user';
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, tension: 90, friction: 11 }).start();
  }, []);

  const renderText = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <Text key={i} style={{ fontWeight: '900', color: isUser ? '#FFF' : T.white }}>{part.slice(2, -2)}</Text>;
      }
      return <Text key={i}>{part}</Text>;
    });
  };

  return (
    <Animated.View style={[
      styles.bubbleWrap,
      isUser ? styles.bubbleRight : styles.bubbleLeft,
      {
        opacity: anim,
        transform: [
          { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }) },
          { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
        ],
      },
    ]}>
      {!isUser && <BotAvatar size={32} color="#5E5CE6" />}
      <View style={{ maxWidth: width * 0.76, gap: 8 }}>
        <View style={[
          styles.bubble,
          isUser
            ? { backgroundColor: '#4A4A8A', borderBottomRightRadius: 6 }
            : {
                backgroundColor: isLight ? '#F0F0F5' : '#1C1C1E',
                borderBottomLeftRadius: 6,
                borderWidth: 1,
                borderColor: isLight ? '#B0B0BA' : 'rgba(255,255,255,0.08)',
              },
        ]}>
          {msg.isAI && !isUser && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#5E5CE6' }} />
              <Text style={{ color: '#8E8ECC', fontSize: 9, fontWeight: '800', letterSpacing: 1 }}>AI RESPONSE</Text>
            </View>
          )}
          <Text style={[styles.bubbleText, { color: isUser ? '#FFF' : (isLight ? '#1C1C1E' : T.white) }]}>
            {renderText(msg.text)}
          </Text>
          <Text style={[styles.bubbleTime, { color: isUser ? 'rgba(255,255,255,0.5)' : T.text + '80' }]}>
            {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>

        {!isUser && msg.actionChips && msg.actionChips.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {msg.actionChips.map((chip, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => onChipAction(chip.action)}
                activeOpacity={0.75}
                style={[styles.actionChip, {
                  backgroundColor: chip.color,
                  borderColor: chip.color,
                  borderWidth: 0,
                }]}
              >
                <View style={{ width: 22, height: 22, borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.18)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={chip.icon as any} size={12} color="#FFF" />
                </View>
                <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '800' }}>{chip.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {!isUser && msg.navAction && (
          <TouchableOpacity
            onPress={() => onNavAction(msg.navAction!)}
            activeOpacity={0.75}
            style={[styles.navBtn, {
              backgroundColor: msg.navAction.color,
              borderColor: msg.navAction.color,
              borderWidth: 0,
            }]}
          >
            <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: 'rgba(0,0,0,0.18)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={msg.navAction.icon as any} size={15} color="#FFF" />
            </View>
            <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '800', flex: 1 }}>{msg.navAction.label}</Text>
            <Ionicons name="arrow-forward-circle" size={18} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
}

const CHAT_STORAGE_KEY = 'runquest:chatHistory';
const MAX_SAVED_MESSAGES = 50;

const INITIAL_MESSAGE: Message = {
  id: '0',
  role: 'bot',
  text: "Hey warrior! I'm RunBot 🤖\n\nI can answer questions AND perform actions for you:\n- 'Change theme to dark'\n- 'Switch navbar to minimal'\n- 'How do I claim territory?'\n- 'Take me to achievements'",
  timestamp: new Date(),
};
export default function ChatBotScreen() {
  const { T, themeName, setTheme } = useTheme();
  const isLight = themeName === 'light';
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const flatListRef = useRef<FlatList>(null);
  const [runState, setRunState] = useState(getRunStore());

  useEffect(() => subscribeRunStore(() => setRunState({ ...getRunStore() })), []);

  const fmtTime = (s: number) => { const m = Math.floor(s / 60); const sec = s % 60; return `${m}:${sec < 10 ? '0' : ''}${sec}`; };

  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const aiHistory = useRef<AIMessage[]>([]);

  // Load persisted chat on mount
  useEffect(() => {
    AsyncStorage.getItem(CHAT_STORAGE_KEY).then(raw => {
      if (!raw) return;
      try {
        const parsed: Message[] = JSON.parse(raw).map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp),
        }));
        if (parsed.length > 0) {
          setMessages(parsed);
          // Rebuild AI history from saved messages
          aiHistory.current = parsed
            .filter(m => m.role === 'user' || (m.role === 'bot' && m.isAI))
            .map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text } as AIMessage));
        }
      } catch {}
    });
  }, []);

  // Save chat whenever messages change (debounced via useEffect)
  useEffect(() => {
    if (messages.length === 1 && messages[0].id === '0') return; // skip initial
    const toSave = messages.slice(-MAX_SAVED_MESSAGES);
    AsyncStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(toSave)).catch(() => {});
  }, [messages]);

  const handleChipAction = useCallback(async (action: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const parts = action.split(':');
    const type = parts[0];
    const key = parts[1];
    const value = parts[2];
    let confirmText = '';
    if (type === 'theme') {
      setTheme(key as any);
      await updateSettings({ uiTheme: key as any });
      confirmText = `Theme changed to ${key}!`;
    } else if (type === 'navbar') {
      await updateSettings({ navbarStyle: key as any });
      confirmText = `Navbar changed to ${key}!`;
    } else if (type === 'setting') {
      const val = value === 'true' ? true : value === 'false' ? false : value;
      await updateSettings({ [key]: val } as any);
      confirmText = 'Setting updated!';
    }
    if (confirmText) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'bot',
        text: `✅ Done! ${confirmText}`,
        timestamp: new Date(),
      }]);
    }
  }, [setTheme]);

  const handleNavAction = useCallback((action: NavAction) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Tab screens live in the bottom tab navigator (parent of ProfileStack)
    const tabScreens = ['Run', 'Territories', 'Settings'];
    // Profile-stack screens are siblings in the same stack
    const profileStackScreens = [
      'ProfileMain', 'Achievements', 'Leaderboard', 'Fitness', 'ChatBot',
      'HelpSupport', 'Teams', 'ActivityFeed', 'BugReport', 'Creator',
      'RunHistory', 'QuestsShop', 'Premium'
    ];

    if (tabScreens.includes(action.screen)) {
      // Must navigate via the tab navigator (parent of this stack)
      try {
        const tabNav = navigation.getParent();
        if (tabNav) {
          tabNav.navigate(action.screen as any);
        } else {
          navigation.navigate(action.screen as any);
        }
      } catch {
        try { navigation.navigate(action.screen as any); } catch {}
      }
    } else if (profileStackScreens.includes(action.screen)) {
      // Navigate within the profile stack
      try { navigation.navigate(action.screen as any); } catch {
        try { navigation.push(action.screen as any); } catch {}
      }
    } else {
      // Try tab parent first, then stack
      try {
        const tabNav = navigation.getParent();
        if (tabNav) tabNav.navigate(action.screen as any);
        else navigation.navigate(action.screen as any);
      } catch {
        try { navigation.navigate(action.screen as any); } catch {}
      }
    }
  }, [navigation]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: text.trim(),
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    // Add to AI history
    aiHistory.current.push({ role: 'user', content: text.trim() });

    // Check for direct nav commands first
    const lower = text.toLowerCase();
    const directNavPatterns = [
      'open achievements', 'go to achievements', 'take me to achievements',
      'open leaderboard', 'go to leaderboard', 'take me to leaderboard',
      'open fitness', 'go to fitness', 'take me to fitness',
      'open settings', 'go to settings', 'take me to settings',
      'open run', 'go to run', 'take me to run',
      'open help', 'go to help', 'take me to help',
      'open territories', 'go to territories', 'take me to kingdoms',
      'open teams', 'go to teams', 'take me to teams',
      'open activity', 'go to activity', 'take me to feed',
      'report bug', 'report a bug', 'bug report', 'found a bug',
      'open history', 'go to history', 'run history', 'history screen', 'take me to history', 'view history',
      'open shop', 'go to shop', 'quests shop', 'shop screen', 'take me to shop', 'quests screen', 'view quests',
      'open premium', 'go to premium', 'get premium', 'subscribe', 'upgrade', 'elite tier',
      'open creator', 'go to creator', 'saad profile', 'creator screen',
      'open profile', 'go to profile', 'profile screen', 'my profile'
    ];
    const isDirectNav = directNavPatterns.some(p => lower.includes(p));

    // Try AI first, fall back to local patterns
    try {
      const aiResponse = await getAIResponse(text.trim(), aiHistory.current.slice(0, -1));
      aiHistory.current.push({ role: 'assistant', content: aiResponse });

      const localEntry = getBotEntry(text);
      const hasLocalActions = localEntry.actionChips || (localEntry.navAction && isDirectNav);

      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'bot',
        text: aiResponse,
        timestamp: new Date(),
        isAI: true,
        actionChips: localEntry.actionChips,
        navAction: hasLocalActions ? localEntry.navAction : undefined,
      };
      setMessages(prev => [...prev, botMsg]);
      setIsTyping(false);

      if (isDirectNav && localEntry.navAction) {
        setTimeout(() => handleNavAction(localEntry.navAction!), 1200);
      }
    } catch (err: any) {
      // Typed error handling
      const isRateLimit = err instanceof AIError && err.type === 'RATE_LIMITED';
      const isTimeout   = err instanceof AIError && err.type === 'TIMEOUT';
      const isNoKey     = err instanceof AIError && err.type === 'NO_API_KEY';

      if (isRateLimit || isTimeout) {
        // Show error message, don't fall back silently
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'bot',
          text: isRateLimit
            ? "I'm getting too many requests right now. Please wait a moment and try again! ⏳"
            : "That took too long to respond. Check your connection and try again. 🌐",
          timestamp: new Date(),
        }]);
        setIsTyping(false);
        return;
      }

      // NO_API_KEY or network error → fall back to local patterns silently
      const useDelay = !isNoKey; // add delay only for network errors (simulate thinking)
      const respond = () => {
        const entry = getBotEntry(text);
        const botMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'bot',
          text: entry.response,
          timestamp: new Date(),
          navAction: entry.navAction,
          actionChips: entry.actionChips,
        };
        aiHistory.current.push({ role: 'assistant', content: entry.response });
        setMessages(prev => [...prev, botMsg]);
        setIsTyping(false);
        if (isDirectNav && entry.navAction) {
          setTimeout(() => handleNavAction(entry.navAction!), 1200);
        }
      };

      if (useDelay) {
        setTimeout(respond, 400 + Math.random() * 300);
      } else {
        respond();
      }
    }
  }, [handleNavAction]);

  useEffect(() => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages, isTyping]);

  return (
    <View style={{ flex: 1, backgroundColor: T.black }}>
      <LinearGradient
        colors={['#5E5CE620', T.black]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 200 }}
      />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.iconBtn, { backgroundColor: T.card, borderColor: T.border }]}
        >
          <Ionicons name="arrow-back" size={20} color={T.white} />
        </TouchableOpacity>

        <BotAvatar size={46} color="#5E5CE6" />

        <View style={{ flex: 1 }}>
          <Text style={{ color: T.white, fontSize: 18, fontWeight: '900', letterSpacing: -0.3 }}>RunBot AI</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
            <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#5E5CE6' }} />
            <Text style={{ color: '#8E8ECC', fontSize: 11, fontWeight: '700' }}>
              {process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ? 'Claude AI · Powered by Anthropic' : 'Smart Bot · Local responses'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            aiHistory.current = []; // reset AI conversation context
            const cleared: Message[] = [{
              id: Date.now().toString(),
              role: 'bot',
              text: "Chat cleared! Ask me anything or say 'change theme' to get started. 🤖",
              timestamp: new Date(),
            }];
            setMessages(cleared);
            AsyncStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(cleared)).catch(() => {});
          }}
          style={[styles.iconBtn, { backgroundColor: T.card, borderColor: T.border }]}
        >
          <Ionicons name="refresh-outline" size={18} color={T.text} />
        </TouchableOpacity>

        {/* Compact run pill — only when running */}
        {runState.isActive && (
          <TouchableOpacity
            onPress={() => { try { (navigation.getParent() ?? navigation).navigate('Run'); } catch {} }}
            activeOpacity={0.85}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 4,
              backgroundColor: runState.isPaused ? '#FF9F0A' : 'rgba(10,12,16,0.95)',
              borderRadius: 16, borderWidth: 1,
              borderColor: runState.isPaused ? 'rgba(0,0,0,0.12)' : '#5E5CE650',
              paddingHorizontal: 9, paddingVertical: 5,
            }}
          >
            <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: runState.isPaused ? '#000' : '#5E5CE6' }} />
            <Text style={{ color: runState.isPaused ? '#000' : '#8E8ECC', fontSize: 10, fontWeight: '900' }}>
              {fmtTime(runState.elapsed)}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={m => m.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 12 }}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
          maxToRenderPerBatch={10}
          windowSize={10}
          renderItem={({ item }) => (
            <MessageBubble
              msg={item}
              isLight={isLight}
              onNavAction={handleNavAction}
              onChipAction={handleChipAction}
            />
          )}
          ListFooterComponent={isTyping ? (
            <View style={[styles.bubbleWrap, styles.bubbleLeft]}>
              <BotAvatar size={32} color="#5E5CE6" />
              <View style={[styles.bubble, {
                backgroundColor: isLight ? '#F0F0F5' : '#1C1C1E',
                borderBottomLeftRadius: 6,
                borderWidth: 1,
                borderColor: isLight ? '#B0B0BA' : 'rgba(255,255,255,0.08)',
              }]}>
                <View style={{ flexDirection: 'row', gap: 5, alignItems: 'center', paddingVertical: 3 }}>
                  {[0, 1, 2].map(i => <TypingDot key={i} delay={i * 180} color="#5E5CE6" />)}
                </View>
              </View>
            </View>
          ) : null}
        />

        {/* Quick suggestions — only show at start */}
        {messages.length <= 2 && (
          <View style={{ paddingHorizontal: 16, paddingBottom: 10 }}>
            <Text style={{ color: T.text, fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 10 }}>
              QUICK ACTIONS
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
              {SUGGESTIONS.map(s => (
                <TouchableOpacity
                  key={s.text}
                  onPress={() => sendMessage(s.text)}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 8,
                    paddingHorizontal: 13, paddingVertical: 10, borderRadius: 14,
                    backgroundColor: T.card,
                    borderWidth: 1, borderTopWidth: 3,
                    borderColor: T.border, borderTopColor: s.color,
                  }}
                  activeOpacity={0.8}
                >
                  <View style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: s.color + '25', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={s.icon as any} size={13} color={s.color} />
                  </View>
                  <Text style={{ color: T.white, fontSize: 12, fontWeight: '700' }}>{s.text}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Input row */}
        <View style={[styles.inputRow, {
          backgroundColor: isLight ? '#FFF' : '#111',
          borderColor: isLight ? '#E8E8E8' : 'rgba(255,255,255,0.1)',
          paddingBottom: insets.bottom + 10,
        }]}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask anything or say 'change theme'..."
            placeholderTextColor={T.text + '70'}
            style={[styles.textInput, {
              color: isLight ? '#1C1C1E' : T.white,
              backgroundColor: isLight ? '#F0F0F5' : 'rgba(255,255,255,0.07)',
            }]}
            onSubmitEditing={() => sendMessage(input)}
            returnKeyType="send"
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            onPress={() => sendMessage(input)}
            disabled={!input.trim() || isTyping}
            activeOpacity={0.85}
            style={[styles.sendBtn, { backgroundColor: input.trim() && !isTyping ? '#5E5CE6' : T.muted }]}
          >
            {isTyping
              ? <ActivityIndicator size="small" color={T.text} />
              : <Ionicons name="send" size={17} color={input.trim() ? '#FFF' : T.text} />
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  bubbleWrap: { flexDirection: 'row', marginBottom: 14, alignItems: 'flex-end', gap: 8 },
  bubbleLeft: { justifyContent: 'flex-start' },
  bubbleRight: { justifyContent: 'flex-end' },
  bubble: { borderRadius: 20, padding: 13, paddingBottom: 9 },
  bubbleText: { fontSize: 14, lineHeight: 21 },
  bubbleTime: { fontSize: 10, marginTop: 5, textAlign: 'right' },
  navBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 14, borderWidth: 1, borderTopWidth: 3,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  actionChip: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    borderRadius: 14, borderWidth: 1, borderTopWidth: 3,
    paddingHorizontal: 12, paddingVertical: 9,
  },
  suggestion: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 13, paddingVertical: 9, borderRadius: 22, borderWidth: 1,
  },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 14, paddingTop: 12, borderTopWidth: 1,
  },
  textInput: {
    flex: 1, borderRadius: 22, paddingHorizontal: 16,
    paddingVertical: 11, fontSize: 15, maxHeight: 110,
  },
  sendBtn: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
});
