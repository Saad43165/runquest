import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, Linking, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/utils/ThemeContext';

const { width } = Dimensions.get('window');

// ─── FAQ Data ─────────────────────────────────────────────────────────────────

const FAQ_ITEMS = [
  {
    q: 'How do I claim a territory?',
    a: 'Start a run, trace a closed GPS loop (end within 30m of your start point with at least 500m perimeter), and tap CLAIM TERRITORY when the "Loop Closed!" toast appears.',
  },
  {
    q: 'Why is my GPS accuracy poor?',
    a: 'GPS works best outdoors with clear sky view. Tall buildings, trees, and indoor environments reduce accuracy. Wait for the ±Xm indicator to drop below 20m before starting your run.',
  },
  {
    q: 'How are calories calculated?',
    a: 'We use the MET (Metabolic Equivalent of Task) formula: Calories = 9.8 × weight(kg) × duration(hours). This is a standard estimate for moderate-pace running.',
  },
  {
    q: 'Can I edit my profile information?',
    a: 'Yes! Go to Profile and tap the pencil icon to edit your display name, username, and bio. Tap your avatar photo to change your profile picture.',
  },
  {
    q: 'How does territory conquest work?',
    a: 'If your new territory overlaps 50% or more of another player\'s territory, you conquer it. The conquered territory is removed from their kingdom and added to yours.',
  },
  {
    q: 'Why does the app need location permission?',
    a: 'Location access is required to track your GPS path during runs and to calculate the territory polygon you\'re claiming. We only use location when you actively start a run.',
  },
  {
    q: 'How do I change the app theme?',
    a: 'Go to Settings (gear icon in the tab bar) and select from 4 themes: Midnight, Aurora, Sunset, or Light. Your preference is saved automatically.',
  },
  {
    q: 'My run didn\'t save. What happened?',
    a: 'Runs are saved to local storage first, then synced to Firebase. If you had no internet connection, the run data may not have synced. Check your connection and try again.',
  },
  {
    q: 'How do I delete a territory?',
    a: 'Go to the Territories screen, find your territory card, and tap the trash icon in the top-right corner of the card. Confirm the deletion in the dialog.',
  },
  {
    q: 'What are heart rate zones?',
    a: 'Heart rate zones are intensity levels based on your running pace. Zone 1 (easy) to Zone 5 (max effort). Check the Fitness screen for a full breakdown of your runs by zone.',
  },
];

// ─── FAQ Item ─────────────────────────────────────────────────────────────────

function FAQItem({ item, index }: { item: typeof FAQ_ITEMS[0]; index: number }) {
  const { T, themeName } = useTheme();
  const isLight = themeName === 'light';
  const [expanded, setExpanded] = useState(false);
  const heightAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const mountAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.spring(mountAnim, { toValue: 1, delay: index * 50, useNativeDriver: true, tension: 60, friction: 9 }).start();
  }, []);

  const toggle = () => {
    const toValue = expanded ? 0 : 1;
    Animated.parallel([
      Animated.spring(heightAnim, { toValue, useNativeDriver: false, tension: 80, friction: 12 }),
      Animated.spring(rotateAnim, { toValue, useNativeDriver: true, tension: 80, friction: 12 }),
    ]).start();
    setExpanded(!expanded);
  };

  return (
    <Animated.View style={[{ opacity: mountAnim, transform: [{ translateY: mountAnim.interpolate({ inputRange: [0, 1], outputRange: [15, 0] }) }] }]}>
      <TouchableOpacity
        onPress={toggle}
        activeOpacity={0.8}
        style={[styles.faqItem, { backgroundColor: isLight ? '#FFF' : T.card, borderColor: expanded ? T.green + '40' : (isLight ? '#EEE' : T.border) }]}
      >
        <View style={styles.faqHeader}>
          <Text style={[styles.faqQ, { color: isLight ? '#000' : T.white, flex: 1 }]}>{item.q}</Text>
          <Animated.View style={{ transform: [{ rotate: rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) }] }}>
            <Ionicons name="chevron-down" size={18} color={T.text} />
          </Animated.View>
        </View>
        <Animated.View style={{ overflow: 'hidden', maxHeight: heightAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 200] }) }}>
          <Text style={[styles.faqA, { color: T.text }]}>{item.a}</Text>
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Contact Card ─────────────────────────────────────────────────────────────

function ContactCard({ icon, title, subtitle, color, onPress }: {
  icon: string; title: string; subtitle: string; color: string; onPress: () => void;
}) {
  const { T, themeName } = useTheme();
  const isLight = themeName === 'light';
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[styles.contactCard, { backgroundColor: isLight ? '#FFF' : T.card, borderColor: isLight ? '#EEE' : T.border }]}
    >
      <View style={[styles.contactIcon, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon as any} size={22} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: isLight ? '#000' : T.white, fontSize: 15, fontWeight: '800' }}>{title}</Text>
        <Text style={{ color: T.text, fontSize: 12, marginTop: 2 }}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={T.text} />
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function HelpSupportScreen() {
  const { T, themeName } = useTheme();
  const isLight = themeName === 'light';
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const headerAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.spring(headerAnim, { toValue: 1, useNativeDriver: true, tension: 50, friction: 8 }).start();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: T.black }}>
      <LinearGradient colors={[T.accent2 + '12', 'transparent']} style={StyleSheet.absoluteFill} />

      {/* Header */}
      <Animated.View style={[styles.header, { paddingTop: insets.top + 16, opacity: headerAnim, transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { backgroundColor: T.card, borderColor: T.border }]}>
          <Ionicons name="arrow-back" size={20} color={T.white} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ color: T.white, fontSize: 26, fontWeight: '900', letterSpacing: -0.5 }}>Help & Support</Text>
          <Text style={{ color: T.text, fontSize: 13, marginTop: 2 }}>We're here to help</Text>
        </View>
      </Animated.View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Hero card */}
        <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
          <View style={[styles.heroCard, { backgroundColor: isLight ? '#FFF' : T.card, borderColor: isLight ? '#EEE' : T.border }]}>
            <LinearGradient colors={[T.accent2 + '20', T.accent2 + '05']} style={StyleSheet.absoluteFill} />
            <Ionicons name="help-buoy" size={40} color={T.accent2} style={{ marginBottom: 12 }} />
            <Text style={{ color: isLight ? '#000' : T.white, fontSize: 18, fontWeight: '900', marginBottom: 6 }}>How can we help?</Text>
            <Text style={{ color: T.text, fontSize: 13, lineHeight: 20, textAlign: 'center' }}>
              Browse the FAQ below or use RunBot for instant answers. For complex issues, contact our support team.
            </Text>
          </View>
        </View>

        {/* Quick actions */}
        <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
          <Text style={[styles.sectionTitle, { color: T.text }]}>GET HELP</Text>
          <ContactCard
            icon="hardware-chip-outline"
            title="Ask RunBot"
            subtitle="Instant AI-powered answers"
            color={T.green}
            onPress={() => (navigation as any).navigate('ChatBot')}
          />
          <ContactCard
            icon="mail-outline"
            title="Email Support"
            subtitle="support@runquest.app"
            color={T.accent2}
            onPress={() => Linking.openURL('mailto:support@runquest.app?subject=RunQuest Support')}
          />
          <ContactCard
            icon="logo-github"
            title="Report a Bug"
            subtitle="github.com/runquest/issues"
            color={T.orange}
            onPress={() => Linking.openURL('https://github.com')}
          />
        </View>

        {/* App info */}
        <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
          <Text style={[styles.sectionTitle, { color: T.text }]}>APP INFO</Text>
          <View style={[styles.infoCard, { backgroundColor: isLight ? '#FFF' : T.card, borderColor: isLight ? '#EEE' : T.border }]}>
            {[
              { label: 'Version', value: '0.1.0' },
              { label: 'Platform', value: 'React Native + Expo' },
              { label: 'Backend', value: 'Firebase' },
              { label: 'Maps', value: 'OpenStreetMap / Leaflet' },
              { label: 'Weather', value: 'Open-Meteo (free)' },
            ].map((item, i, arr) => (
              <View key={item.label} style={[styles.infoRow, { borderBottomWidth: i < arr.length - 1 ? StyleSheet.hairlineWidth : 0, borderBottomColor: T.border }]}>
                <Text style={{ color: T.text, fontSize: 13 }}>{item.label}</Text>
                <Text style={{ color: isLight ? '#000' : T.white, fontSize: 13, fontWeight: '700' }}>{item.value}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* FAQ */}
        <View style={{ paddingHorizontal: 20 }}>
          <Text style={[styles.sectionTitle, { color: T.text, marginBottom: 12 }]}>FREQUENTLY ASKED QUESTIONS</Text>
          {FAQ_ITEMS.map((item, i) => (
            <FAQItem key={i} item={item} index={i} />
          ))}
        </View>

        {/* Footer */}
        <View style={{ alignItems: 'center', paddingTop: 32, paddingBottom: 8 }}>
          <Text style={{ color: T.text, fontSize: 12, opacity: 0.5 }}>RunQuest v0.1.0 • Made with ❤️</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingBottom: 20 },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  sectionTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 2, marginBottom: 12 },
  heroCard: { borderRadius: 24, padding: 24, alignItems: 'center', borderWidth: 1, overflow: 'hidden' },
  contactCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 16, marginBottom: 10, borderWidth: 1 },
  contactIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  infoCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  faqItem: { borderRadius: 16, borderWidth: 1, marginBottom: 10, overflow: 'hidden' },
  faqHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  faqQ: { fontSize: 14, fontWeight: '700', lineHeight: 20 },
  faqA: { fontSize: 13, lineHeight: 20, paddingHorizontal: 16, paddingBottom: 16 },
});
