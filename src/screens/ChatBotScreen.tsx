import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  TextInput, KeyboardAvoidingView, Platform, Animated,
  ActivityIndicator, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/utils/ThemeContext';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

interface Message {
  id: string;
  role: 'user' | 'bot';
  text: string;
  timestamp: Date;
}

// ─── Bot knowledge base ───────────────────────────────────────────────────────

const BOT_RESPONSES: { patterns: string[]; response: string }[] = [
  {
    patterns: ['hello', 'hi', 'hey', 'start', 'help'],
    response: "Hey there, warrior! 👋 I'm RunBot, your RunQuest assistant. I can help you with:\n\n• How to claim territories\n• Understanding your fitness stats\n• App features & navigation\n• Tips for better runs\n\nWhat would you like to know?",
  },
  {
    patterns: ['territory', 'claim', 'conquer', 'loop', 'polygon'],
    response: "🗺️ **Claiming Territories**\n\n1. Tap **START RUN** on the Run screen\n2. Run a closed loop — your path must end within 30m of where you started\n3. The loop must be at least 500m in perimeter\n4. When the loop closes, you'll see '🔒 Loop Closed!'\n5. Tap **CLAIM TERRITORY** to own that area!\n\nThe bigger your loop, the more land you own. Overlapping another player's territory by 50%+ conquers it!",
  },
  {
    patterns: ['calorie', 'calories', 'burn', 'fitness', 'health'],
    response: "🔥 **Calorie Tracking**\n\nRunQuest calculates calories using the MET formula:\n`Calories = 9.8 × weight(kg) × duration(hours)`\n\nCheck your **Fitness** screen (Profile → Fitness) for:\n• Total calories burned\n• Weekly calorie chart\n• Heart rate zones per run\n• Pace analysis\n\nTip: Running faster puts you in higher heart rate zones and burns more calories per minute!",
  },
  {
    patterns: ['leaderboard', 'rank', 'ranking', 'top', 'compete'],
    response: "🏆 **Leaderboard**\n\nThe global leaderboard ranks players by total territory area owned.\n\n• Go to **Profile → Leaderboard** to see rankings\n• Claim more territories to climb the ranks\n• Conquering others' territories boosts your area\n• Your rank updates in real-time as territories change\n\nTip: Focus on claiming large loops in open areas for maximum area gain!",
  },
  {
    patterns: ['achievement', 'badge', 'unlock', 'milestone'],
    response: "🎖️ **Achievements**\n\nEarn badges by hitting milestones:\n\n🥉 **Bronze** — First Step (1 run)\n🥈 **Silver** — 5K Warrior, Loop Builder, 3-Day Streak\n🥇 **Gold** — Half Hero (21km), Marathon Legend (42km), Conqueror (50k m²), Week Warrior\n\nCheck **Profile → Achievements** to see your progress. Achievements are computed from your run history automatically!",
  },
  {
    patterns: ['pace', 'speed', 'fast', 'slow', 'improve'],
    response: "⚡ **Improving Your Pace**\n\nHere are proven tips:\n\n1. **Interval training** — alternate fast/slow segments\n2. **Consistency** — run 3-4x per week\n3. **Build base** — most runs should be easy (Zone 1-2)\n4. **One hard run/week** — tempo or intervals\n5. **Rest days** — recovery is when you improve\n\nIn RunQuest, your pace determines your heart rate zone shown in the Fitness screen!",
  },
  {
    patterns: ['theme', 'dark', 'light', 'color', 'appearance'],
    response: "🎨 **Themes**\n\nRunQuest has 4 beautiful themes:\n\n🌑 **Midnight** — Classic dark mode\n🌊 **Aurora** — Teal/cyan dark theme\n🌅 **Sunset** — Warm orange dark theme\n☀️ **Light** — Clean light mode\n\nChange your theme in **Settings** (the gear icon in the tab bar). Your preference is saved automatically!",
  },
  {
    patterns: ['gps', 'location', 'accuracy', 'signal', 'tracking'],
    response: "📍 **GPS & Location Tips**\n\n• Go outside before starting — GPS needs open sky\n• Wait for the accuracy indicator (±Xm) to drop below 20m\n• The ⚠️ Poor GPS badge appears when accuracy > 20m\n• Use **High Accuracy** mode in Settings for better tracking\n• Tall buildings and trees can reduce GPS accuracy\n\nFor best results, start your run in an open area and wait 30 seconds for GPS to lock!",
  },
  {
    patterns: ['weather', 'temperature', 'forecast', 'rain'],
    response: "🌤️ **Weather Feature**\n\nRunQuest shows live weather on the Run screen!\n\n• Tap the temperature pill in the header to open the weather panel\n• See: temperature, humidity, wind speed, feels-like, UV index\n• 6-hour hourly forecast included\n• Data from Open-Meteo (free, no API key needed)\n\nWeather loads automatically when your GPS location is available!",
  },
  {
    patterns: ['profile', 'edit', 'photo', 'avatar', 'bio', 'username'],
    response: "👤 **Editing Your Profile**\n\n• Tap the **pencil icon** on your profile to edit name, username, and bio\n• Tap your **avatar photo** to change your profile picture\n• Your display name appears on territories you claim\n• Changes sync to Firebase instantly\n\nMake sure your display name is set — it shows on the leaderboard and territories!",
  },
  {
    patterns: ['notification', 'alert', 'push'],
    response: "🔔 **Notifications**\n\nRunQuest sends notifications when:\n• You successfully claim a territory\n• (More notification types coming soon!)\n\nNotification permissions are requested on first launch. You can manage them in your device Settings → RunQuest.",
  },
  {
    patterns: ['bug', 'error', 'crash', 'problem', 'issue', 'broken'],
    response: "🐛 **Reporting Issues**\n\nSorry you're having trouble! Here's what to try:\n\n1. **Restart the app** — fixes most temporary issues\n2. **Check your internet** — Firebase needs connectivity\n3. **GPS issues** — go outside and wait for lock\n4. **Clear cache** — in device Settings → Apps → RunQuest\n\nFor persistent issues, go to **Profile → Help & Support** to contact us. Include what you were doing when the issue occurred!",
  },
];

function getBotResponse(input: string): string {
  const lower = input.toLowerCase();
  for (const entry of BOT_RESPONSES) {
    if (entry.patterns.some(p => lower.includes(p))) {
      return entry.response;
    }
  }
  return "🤔 I'm not sure about that one! Try asking about:\n\n• Claiming territories\n• Fitness & calories\n• Achievements\n• GPS tips\n• Themes & settings\n• Profile editing\n\nOr visit **Help & Support** for more detailed guides!";
}

// ─── Quick suggestions ────────────────────────────────────────────────────────

const SUGGESTIONS = [
  'How do I claim territory?',
  'How are calories calculated?',
  'How does the leaderboard work?',
  'GPS tips',
  'How to improve my pace?',
];

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg, isLight }: { msg: Message; isLight: boolean }) {
  const { T } = useTheme();
  const isUser = msg.role === 'user';
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 10 }).start();
  }, []);

  return (
    <Animated.View style={[
      styles.bubbleWrap,
      isUser ? styles.bubbleRight : styles.bubbleLeft,
      { opacity: anim, transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }] },
    ]}>
      {!isUser && (
        <View style={[styles.botAvatar, { backgroundColor: T.green + '20' }]}>
          <Ionicons name="hardware-chip" size={16} color={T.green} />
        </View>
      )}
      <View style={[
        styles.bubble,
        isUser
          ? { backgroundColor: T.green, borderBottomRightRadius: 4 }
          : { backgroundColor: isLight ? '#F0F0F5' : T.card, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: isLight ? '#E0E0E5' : T.border },
      ]}>
        <Text style={[
          styles.bubbleText,
          { color: isUser ? '#000' : (isLight ? '#000' : T.white) },
        ]}>
          {msg.text}
        </Text>
        <Text style={[styles.bubbleTime, { color: isUser ? 'rgba(0,0,0,0.5)' : T.text }]}>
          {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    </Animated.View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ChatBotScreen() {
  const { T, themeName } = useTheme();
  const isLight = themeName === 'light';
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const flatListRef = useRef<FlatList>(null);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'bot',
      text: "Hey there, warrior! 👋 I'm RunBot, your RunQuest assistant.\n\nAsk me anything about the app — territories, fitness, achievements, GPS tips, and more!",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const sendMessage = (text: string) => {
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

    // Simulate bot thinking delay
    setTimeout(() => {
      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'bot',
        text: getBotResponse(text),
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, botMsg]);
      setIsTyping(false);
    }, 800 + Math.random() * 600);
  };

  useEffect(() => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages, isTyping]);

  return (
    <View style={{ flex: 1, backgroundColor: T.black }}>
      <LinearGradient colors={[T.green + '10', 'transparent']} style={StyleSheet.absoluteFill} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { backgroundColor: T.card, borderColor: T.border }]}>
          <Ionicons name="arrow-back" size={20} color={T.white} />
        </TouchableOpacity>
        <View style={[styles.botAvatarLarge, { backgroundColor: T.green + '20', borderColor: T.green + '40' }]}>
          <Ionicons name="hardware-chip" size={22} color={T.green} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: T.white, fontSize: 18, fontWeight: '900' }}>RunBot</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: T.green }} />
            <Text style={{ color: T.green, fontSize: 11, fontWeight: '700' }}>Online</Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => setMessages([{
            id: Date.now().toString(),
            role: 'bot',
            text: "Chat cleared! How can I help you? 😊",
            timestamp: new Date(),
          }])}
          style={[styles.backBtn, { backgroundColor: T.card, borderColor: T.border }]}
        >
          <Ionicons name="trash-outline" size={18} color={T.text} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={m => m.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => <MessageBubble msg={item} isLight={isLight} />}
          ListFooterComponent={isTyping ? (
            <View style={[styles.bubbleWrap, styles.bubbleLeft]}>
              <View style={[styles.botAvatar, { backgroundColor: T.green + '20' }]}>
                <Ionicons name="hardware-chip" size={16} color={T.green} />
              </View>
              <View style={[styles.bubble, { backgroundColor: isLight ? '#F0F0F5' : T.card, borderWidth: 1, borderColor: isLight ? '#E0E0E5' : T.border }]}>
                <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center', paddingVertical: 4 }}>
                  {[0, 1, 2].map(i => (
                    <TypingDot key={i} delay={i * 200} color={T.text} />
                  ))}
                </View>
              </View>
            </View>
          ) : null}
        />

        {/* Suggestions */}
        {messages.length <= 2 && (
          <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
            <Text style={{ color: T.text, fontSize: 11, fontWeight: '700', marginBottom: 8, letterSpacing: 1 }}>QUICK QUESTIONS</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {SUGGESTIONS.map(s => (
                <TouchableOpacity
                  key={s}
                  onPress={() => sendMessage(s)}
                  style={[styles.suggestion, { backgroundColor: T.card, borderColor: T.border }]}
                >
                  <Text style={{ color: T.white, fontSize: 12, fontWeight: '600' }}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Input */}
        <View style={[styles.inputRow, { backgroundColor: isLight ? '#FFF' : T.card, borderColor: isLight ? '#EEE' : T.border, paddingBottom: insets.bottom + 8 }]}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask RunBot anything..."
            placeholderTextColor={T.text + '80'}
            style={[styles.textInput, { color: isLight ? '#000' : T.white, backgroundColor: isLight ? '#F5F5F5' : T.muted }]}
            onSubmitEditing={() => sendMessage(input)}
            returnKeyType="send"
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            onPress={() => sendMessage(input)}
            disabled={!input.trim()}
            style={[styles.sendBtn, { backgroundColor: input.trim() ? T.green : T.muted }]}
          >
            <Ionicons name="send" size={18} color={input.trim() ? '#000' : T.text} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function TypingDot({ delay, color }: { delay: number; color: string }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.delay(600 - delay),
      ])
    ).start();
  }, []);
  return (
    <Animated.View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color, opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }} />
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.1)' },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  botAvatar: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  botAvatarLarge: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  bubbleWrap: { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-end', gap: 8 },
  bubbleLeft: { justifyContent: 'flex-start' },
  bubbleRight: { justifyContent: 'flex-end' },
  bubble: { maxWidth: width * 0.72, borderRadius: 20, padding: 12, paddingBottom: 8 },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  bubbleTime: { fontSize: 10, marginTop: 4, textAlign: 'right' },
  suggestion: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, padding: 12, paddingTop: 10, borderTopWidth: 1 },
  textInput: { flex: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, maxHeight: 100 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
