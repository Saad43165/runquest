import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, Linking, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/utils/ThemeContext';
import { OrbBackground } from '../components/OrbBackground';
import * as Haptics from 'expo-haptics';

// ─── FAQ Data — 4 focused categories ─────────────────────────────────────────
const FAQ_CATEGORIES = [
  {
    id: 'running', icon: 'fitness-outline', label: 'Running', color: '#32D74B',
    items: [
      { q: 'How do I start a run?', a: 'Tap START RUN on the Run screen. Your GPS path is tracked live. Tap PAUSE to pause or STOP to finish and see your stats.' },
      { q: 'How do I claim a territory?', a: 'Run a closed GPS loop — end within 30m of your start with at least 500m² area. When "Loop Closed! 🎉" appears, tap CLAIM TERRITORY and name it.' },
      { q: 'Why is GPS accuracy poor?', a: 'GPS works best outdoors with clear sky. Wait for ±Xm to drop below 20m before starting. Enable High Precision GPS in Settings → Run.' },
      { q: 'What is Auto-Lap?', a: 'Auto-Lap notifies you with a haptic buzz every km (or mile) during your run automatically.' },
      { q: 'What is Clean Map Mode?', a: 'Hides all overlays so you only see the map while running. Enable in Settings → Run. A small button appears to exit.' },
    ],
  },
  {
    id: 'territories', icon: 'map-outline', label: 'Territories', color: '#FF6B35',
    items: [
      { q: 'How does conquest work?', a: 'If your new territory overlaps 50%+ of another player\'s territory, you conquer it. Their territory is removed and yours replaces it.' },
      { q: 'Do territories expire?', a: 'Yes — after 7 days. Open the territory detail and tap "Defend Territory" to reset the 7-day timer. You\'ll see a warning badge 48h before expiry.' },
      { q: 'How do I delete my territory?', a: 'Tap your territory card → scroll down → tap "Release Territory". Only your own territories can be deleted.' },
      { q: 'What is territory history?', a: 'Every territory tracks its full conquest chain. Tap any territory and scroll down to see who owned it before.' },
    ],
  },
  {
    id: 'social', icon: 'people-outline', label: 'Social', color: '#BF5FFF',
    items: [
      { q: 'How do leaderboards work?', a: 'Ranked by total territory area. Switch between All Time, This Week, This Month, and Friends tabs. Follow warriors to see them in Friends.' },
      { q: 'What is the Activity Feed?', a: 'Real-time territory conquests. Global tab shows all worldwide. Friends tab shows only people you follow.' },
      { q: 'How do Teams work?', a: 'Go to Profile → Teams & Alliances. Create or join a team. Your territories show your team tag. Team area is combined on the leaderboard.' },
      { q: 'How do I follow players?', a: 'Open the Leaderboard and tap "Follow" next to any warrior. Their conquests appear in your Activity Feed → Friends tab.' },
    ],
  },
  {
    id: 'app', icon: 'apps-outline', label: 'App & Settings', color: '#00C6FF',
    items: [
      { q: 'How does the music player work?', a: 'Tap + in the Run screen music bar to load songs. Music plays in background and your playlist is saved to your account.' },
      { q: 'How do achievements work?', a: '7 tiers: Bronze → Silver → Gold → Diamond → Legendary → Mythic. Unlock automatically based on your stats. A celebration popup appears.' },
      { q: 'How do I change theme or navbar?', a: 'Settings → Map for themes. Settings → General for navbar styles. Or just ask RunBot — say "change theme" or "change navbar".' },
      { q: 'Is my data backed up?', a: 'Yes — everything syncs to Firebase: runs, territories, settings, music, profile. Reinstall and log in to restore everything.' },
      { q: 'What is RunBot AI?', a: 'Your AI assistant. Ask anything about the app, change settings, or navigate to any screen. Powered by Claude AI (Anthropic).' },
    ],
  },
  {
    id: 'quests', icon: 'sparkles-outline', label: 'Quests & Items', color: '#FF9F0A',
    items: [
      { q: 'How do I earn Gold & Gems?', a: 'You earn Gold by completing Daily, Weekly, and Monthly Quests. Gems are rare rewards found in Loot Drops while running.' },
      { q: 'What are Loot Drops?', a: 'While running, you may see glowing orbs on the map. Run near them to automatically collect them! They contain Gold, Gems, and XP.' },
      { q: 'What is the Shop Hub?', a: 'Use your Gold and Gems to buy exclusive Path Colors, Avatar Halos, and temporary Boosters. Access it from your Profile.' },
    ],
  },
  {
    id: 'premium', icon: 'crown-outline', label: 'Premium', color: '#FFD60A',
    items: [
      { q: 'What is RunQuest Premium?', a: 'Premium is an optional subscription that unlocks the Virtual Pacer, AI Voice Coach, exclusive Neon map themes, and extends territory expiry time.' },
      { q: 'How do I manage my subscription?', a: 'Go to Profile, tap the Premium banner to view the Premium Dashboard. From there, you can view, change, or downgrade your plan securely.' },
      { q: 'If I reinstall, do I lose Premium?', a: 'No! Just log into your account, go to the Premium Screen, and tap "Restore Purchases" at the bottom to re-link your subscription.' },
    ],
  },
];

// ─── FAQ Item ─────────────────────────────────────────────────────────────────
function FAQItem({ item, accentColor }: { item: { q: string; a: string }; accentColor: string }) {
  const { T } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const heightAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  const toggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const toValue = expanded ? 0 : 1;
    Animated.parallel([
      Animated.spring(heightAnim, { toValue, useNativeDriver: false, tension: 80, friction: 12 }),
      Animated.spring(rotateAnim, { toValue, useNativeDriver: true, tension: 80, friction: 12 }),
    ]).start();
    setExpanded(!expanded);
  };

  return (
    <TouchableOpacity onPress={toggle} activeOpacity={0.85} style={[styles.faqItem, {
      backgroundColor: T.card, borderColor: expanded ? accentColor + '50' : T.border,
      borderLeftWidth: expanded ? 3 : 1, borderLeftColor: expanded ? accentColor : T.border,
    }]}>
      <View style={styles.faqHeader}>
        <Text style={[styles.faqQ, { color: T.white, flex: 1 }]}>{item.q}</Text>
        <Animated.View style={{ transform: [{ rotate: rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) }] }}>
          <Ionicons name="chevron-down" size={16} color={expanded ? accentColor : T.text} />
        </Animated.View>
      </View>
      <Animated.View style={{ overflow: 'hidden', maxHeight: heightAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 300] }) }}>
        <Text style={[styles.faqA, { color: T.text }]}>{item.a}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

type TabId = 'faq' | 'contact' | 'about';

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function HelpSupportScreen() {
  const { T } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [tab, setTab] = useState<TabId>('faq');
  const [faqCat, setFaqCat] = useState(0);
  const headerAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.spring(headerAnim, { toValue: 1, useNativeDriver: true, tension: 50, friction: 8 }).start();
  }, []);

  const switchTab = (t: TabId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTab(t);
  };

  const cat = FAQ_CATEGORIES[faqCat];

  return (
    <View style={{ flex: 1, backgroundColor: T.black }}>
      <OrbBackground />
      <LinearGradient colors={[T.accent2 + '10', 'transparent']} style={StyleSheet.absoluteFill} pointerEvents="none" />

      {/* ── Header ── */}
      <Animated.View style={[styles.header, {
        paddingTop: insets.top + 16,
        opacity: headerAnim,
        transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }],
      }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.iconBtn, { backgroundColor: T.card, borderColor: T.border }]}>
          <Ionicons name="arrow-back" size={20} color={T.white} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: T.white }]}>Help & Support</Text>
          <Text style={{ color: T.text, fontSize: 12, marginTop: 2 }}>RunQuest v1.0.4</Text>
        </View>
      </Animated.View>

      {/* ── Tab bar ── */}
      <View style={[styles.tabBar, { backgroundColor: T.card, borderColor: T.border, marginHorizontal: 16 }]}>
        {([
          { id: 'faq' as TabId, label: 'FAQ', icon: 'help-circle-outline' },
          { id: 'contact' as TabId, label: 'Contact', icon: 'mail-outline' },
          { id: 'about' as TabId, label: 'About & Legal', icon: 'information-circle-outline' },
        ] as const).map(t => (
          <TouchableOpacity
            key={t.id}
            onPress={() => switchTab(t.id)}
            style={[styles.tabBtn, tab === t.id && { backgroundColor: T.green + '20' }]}
          >
            <Ionicons name={t.icon as any} size={16} color={tab === t.id ? T.green : T.text} />
            <Text style={{ color: tab === t.id ? T.green : T.text, fontSize: 11, fontWeight: tab === t.id ? '800' : '600' }}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120, paddingTop: 16 }}>

        {/* ══ FAQ TAB ══ */}
        {tab === 'faq' && (
          <>
            {/* Category pills */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 14 }}>
              {FAQ_CATEGORIES.map((c, i) => (
                <TouchableOpacity
                  key={c.id}
                  onPress={() => { setFaqCat(i); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                  style={[styles.catPill, {
                    backgroundColor: faqCat === i ? c.color + '20' : T.card,
                    borderColor: faqCat === i ? c.color : T.border,
                  }]}
                >
                  <Ionicons name={c.icon as any} size={13} color={faqCat === i ? c.color : T.text} />
                  <Text style={{ color: faqCat === i ? c.color : T.text, fontSize: 12, fontWeight: faqCat === i ? '800' : '600' }}>{c.label}</Text>
                  <View style={[styles.catCount, { backgroundColor: c.color + '20' }]}>
                    <Text style={{ color: c.color, fontSize: 9, fontWeight: '800' }}>{c.items.length}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* FAQ items for selected category */}
            <View style={{ gap: 8 }}>
              {cat.items.map((item, i) => (
                <FAQItem key={i} item={item} accentColor={cat.color} />
              ))}
            </View>
          </>
        )}

        {/* ══ CONTACT TAB ══ */}
        {tab === 'contact' && (
          <View style={{ gap: 10 }}>
            {[
              {
                icon: 'hardware-chip-outline',
                title: 'Ask RunBot AI',
                sub: 'Instant answers — available 24/7',
                badge: 'RECOMMENDED',
                iconBg: T.green + '25',
                iconColor: T.green,
                onPress: () => navigation.navigate('ChatBot'),
              },
              {
                icon: 'mail-outline',
                title: 'Email Support',
                sub: 'Get help from the developer',
                iconBg: T.accent2 + '25',
                iconColor: T.accent2,
                onPress: () => Linking.openURL('mailto:saadnaz43165@gmail.com?subject=RunQuest Support'),
              },
              {
                icon: 'bug-outline',
                title: 'Report a Bug',
                sub: 'Submit a detailed bug report',
                iconBg: '#FF453A30',
                iconColor: '#FF453A',
                onPress: () => navigation.navigate('GlobalBugReport'),
              },
              {
                icon: 'person-outline',
                title: 'Meet the Creator',
                sub: 'Saad Ikram — Developer of RunQuest',
                photo: true,
                iconBg: T.border,
                iconColor: T.white,
                onPress: () => navigation.navigate('Creator'),
              },
            ].map((item, i) => (
              <TouchableOpacity
                key={i}
                onPress={item.onPress}
                activeOpacity={0.82}
                style={[styles.contactCard, { backgroundColor: T.card, borderColor: T.border }]}
              >
                {(item as any).photo ? (
                  <View style={[styles.contactIconWrap, { overflow: 'hidden' }]}>
                    <Image source={require('../../assets/saad.png')} style={{ width: 44, height: 44 }} resizeMode="cover" />
                  </View>
                ) : (
                  <View style={[styles.contactIconWrap, { backgroundColor: (item as any).iconBg, alignItems: 'center', justifyContent: 'center' }]}>
                    <Ionicons name={(item as any).icon} size={20} color={(item as any).iconColor} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={{ color: T.white, fontSize: 15, fontWeight: '800' }}>{item.title}</Text>
                  <Text style={{ color: T.text, fontSize: 12, marginTop: 2 }}>{item.sub}</Text>
                  {(item as any).badge && (
                    <View style={[styles.badge, { backgroundColor: T.green + '25' }]}>
                      <Text style={{ color: T.green, fontSize: 9, fontWeight: '900' }}>{(item as any).badge}</Text>
                    </View>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={16} color={T.text} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ══ ABOUT TAB ══ */}
        {tab === 'about' && (
          <View style={{ gap: 12 }}>
            {/* App info card */}
            <View style={[styles.aboutCard, { backgroundColor: T.card, borderColor: T.border }]}>
              <LinearGradient colors={[T.accent2 + '15', 'transparent']} style={StyleSheet.absoluteFill} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: T.accent2 + '20', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="globe-outline" size={26} color={T.accent2} />
                </View>
                <View>
                  <Text style={{ color: T.white, fontSize: 20, fontWeight: '900' }}>RunQuest</Text>
                  <Text style={{ color: T.text, fontSize: 12 }}>Version 1.0.4 · GPS Territory Conquest</Text>
                </View>
              </View>
              <Text style={{ color: T.text, fontSize: 13, lineHeight: 20 }}>
                Turn every run into a real-world territory battle. Claim land by running GPS loops, invade enemy territories, form alliances, and dominate the global leaderboard.
              </Text>
            </View>

            {/* Features list */}
            <View style={[styles.aboutCard, { backgroundColor: T.card, borderColor: T.border }]}>
              <Text style={{ color: T.text, fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 12 }}>FEATURES</Text>
              {[
                { icon: 'map', text: 'Real-world GPS territory claiming & invasion', color: '#00C6FF' },
                { icon: 'podium', text: 'Global & Friends real-time leaderboards', color: '#FFD60A' },
                { icon: 'sparkles', text: 'Daily Quests, Loot Drops & Shop Hub', color: '#FF9F0A' },
                { icon: 'people', text: 'Create Teams & forge Alliances', color: '#BF5FFF' },
                { icon: 'hardware-chip', text: 'RunBot AI, Virtual Pacer & Voice Coach', color: '#32D74B' },
                { icon: 'color-palette', text: 'Custom avatars, path styles & map themes', color: '#FF2D55' },
                { icon: 'trophy', text: '7-tier dynamic achievement system', color: '#CD7F32' },
                { icon: 'musical-notes', text: 'Built-in local music player', color: '#FF453A' },
                { icon: 'fitness', text: 'Advanced fitness stats & run history', color: '#0A84FF' },
                { icon: 'flash', text: 'Live global activity feed', color: '#FF6B35' },
              ].map((f, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}>
                  <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: f.color + '18', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={f.icon as any} size={14} color={f.color} />
                  </View>
                  <Text style={{ color: T.text, fontSize: 13, flex: 1 }}>{f.text}</Text>
                </View>
              ))}
            </View>

            {/* Privacy Policy */}
            <View style={[styles.aboutCard, { backgroundColor: T.card, borderColor: T.border }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <Ionicons name="shield-checkmark-outline" size={18} color={T.green} />
                <Text style={{ color: T.white, fontSize: 15, fontWeight: '900' }}>Privacy Policy</Text>
              </View>
              {[
                { title: 'Location Data', body: 'RunQuest uses GPS to track your runs and territory. Location data is stored on your device and synced to your account. We never sell your location data to third parties.' },
                { title: 'Account Data', body: 'Your display name, email, and profile photo are stored securely. Your run history and territories are linked to your account and visible only to you (runs) or all users (territories on the map).' },
                { title: 'Data Deletion', body: 'You can delete your run history from the Run History screen. To delete your account and all data, contact support at saadnaz43165@gmail.com.' },
                { title: 'Third-Party Services', body: 'RunQuest uses secure cloud services for data storage and authentication. No personal data is shared with advertisers.' },
              ].map((item, i) => (
                <View key={i} style={{ marginBottom: i < 3 ? 12 : 0 }}>
                  <Text style={{ color: T.white, fontSize: 13, fontWeight: '800', marginBottom: 4 }}>{item.title}</Text>
                  <Text style={{ color: T.text, fontSize: 12, lineHeight: 18 }}>{item.body}</Text>
                </View>
              ))}
            </View>

            {/* Terms of Service */}
            <View style={[styles.aboutCard, { backgroundColor: T.card, borderColor: T.border }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <Ionicons name="document-text-outline" size={18} color={T.accent2} />
                <Text style={{ color: T.white, fontSize: 15, fontWeight: '900' }}>Terms of Service</Text>
              </View>
              {[
                { title: 'Acceptable Use', body: 'RunQuest is for personal fitness and entertainment. Do not use the app while driving or in unsafe conditions. Always be aware of your surroundings while running.' },
                { title: 'User Content', body: 'Territory names and profile content must not contain offensive, hateful, or illegal material. We reserve the right to remove content that violates these terms.' },
                { title: 'Fair Play', body: 'GPS spoofing, fake runs, or any form of cheating is prohibited and may result in account suspension.' },
                { title: 'Liability', body: 'RunQuest is provided as-is. We are not responsible for injuries, accidents, or damages that occur while using the app. Run safely and follow local laws.' },
                { title: 'Changes', body: 'We may update these terms. Continued use of the app after changes constitutes acceptance of the new terms.' },
              ].map((item, i) => (
                <View key={i} style={{ marginBottom: i < 4 ? 12 : 0 }}>
                  <Text style={{ color: T.white, fontSize: 13, fontWeight: '800', marginBottom: 4 }}>{item.title}</Text>
                  <Text style={{ color: T.text, fontSize: 12, lineHeight: 18 }}>{item.body}</Text>
                </View>
              ))}
            </View>

            {/* Contact for legal */}
            <TouchableOpacity
              onPress={() => Linking.openURL('mailto:saadnaz43165@gmail.com?subject=RunQuest Legal Inquiry')}
              style={[styles.aboutCard, { backgroundColor: T.card, borderColor: T.border, flexDirection: 'row', alignItems: 'center', gap: 12 }]}
            >
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: T.accent2 + '20', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="mail-outline" size={18} color={T.accent2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: T.white, fontSize: 13, fontWeight: '800' }}>Legal Inquiries</Text>
                <Text style={{ color: T.text, fontSize: 11, marginTop: 2 }}>saadnaz43165@gmail.com</Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color={T.text} />
            </TouchableOpacity>

            <Text style={{ color: T.text, fontSize: 11, textAlign: 'center', opacity: 0.5, paddingBottom: 8 }}>
              © 2026 RunQuest · All rights reserved
            </Text>
          </View>
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingBottom: 12 },
  title: { fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  tabBar: { flexDirection: 'row', borderRadius: 16, borderWidth: 1, padding: 4, marginBottom: 4, gap: 2 },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, borderRadius: 12 },
  catPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  catCount: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  faqItem: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  faqHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  faqQ: { fontSize: 13, fontWeight: '700', lineHeight: 19 },
  faqA: { fontSize: 13, lineHeight: 20, paddingHorizontal: 14, paddingBottom: 14, opacity: 0.8 },
  contactCard: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 16, borderWidth: 1, padding: 14 },
  contactIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  contactIconWrap: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden', flexShrink: 0 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, marginTop: 5 },
  recommendedBadge: { alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, marginTop: 6 },
  aboutCard: { borderRadius: 20, borderWidth: 1, overflow: 'hidden', padding: 18 },
  statChip: { flex: 1, borderRadius: 16, borderWidth: 1, padding: 14, alignItems: 'center', gap: 4, minWidth: '45%' },
  creatorBtn: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 18, borderWidth: 1.5, padding: 14 },
});
