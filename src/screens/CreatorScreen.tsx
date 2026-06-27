import React, { useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, Linking, Dimensions, Image, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/utils/ThemeContext';
import { OrbBackground } from '../components/OrbBackground';

const { width } = Dimensions.get('window');

// Use the app icon as the developer photo placeholder
// Replace with actual photo: require('../../assets/saad.jpg')
const PHOTO = require('../../assets/saad.png');

const SKILLS = [
  { label: 'React Native', level: 95 },
  { label: 'Flutter', level: 85 },
  { label: 'TypeScript', level: 90 },
  { label: 'Firebase', level: 88 },
  { label: 'UI/UX Design', level: 82 },
  { label: 'GPS & Maps', level: 80 },
];

const APP_STATS = [
  { label: 'Screens', value: '15+', icon: 'layers-outline' },
  { label: 'Features', value: '40+', icon: 'flash-outline' },
  { label: 'Dev Time', value: '3 mo', icon: 'time-outline' },
];

function SkillBar({ skill, index }: { skill: typeof SKILLS[0]; index: number }) {
  const { T } = useTheme();
  const barAnim = useRef(new Animated.Value(0)).current;
  const mountAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(index * 70),
      Animated.parallel([
        Animated.spring(mountAnim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 9 }),
        Animated.timing(barAnim, { toValue: skill.level / 100, duration: 700, useNativeDriver: false }),
      ]),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ opacity: mountAnim, marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
        <Text style={{ color: T.white, fontSize: 13, fontWeight: '600' }}>{skill.label}</Text>
        <Text style={{ color: T.text, fontSize: 12 }}>{skill.level}%</Text>
      </View>
      <View style={{ height: 4, backgroundColor: T.border, borderRadius: 2, overflow: 'hidden' }}>
        <Animated.View style={{
          height: '100%', borderRadius: 2, backgroundColor: T.green,
          width: barAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
        }} />
      </View>
    </Animated.View>
  );
}

export default function CreatorScreen() {
  const { T } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const headerAnim = useRef(new Animated.Value(0)).current;
  const avatarAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(headerAnim, { toValue: 1, useNativeDriver: true, tension: 50, friction: 8 }),
      Animated.spring(avatarAnim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 8, delay: 150 }),
    ]).start();
  }, []);

  const openLink = (url: string) => {
    Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open link.'));
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.black }}>
      <OrbBackground />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

        {/* ── Header ── */}
        <Animated.View style={{
          flexDirection: 'row', alignItems: 'center', gap: 14,
          paddingTop: insets.top + 16, paddingHorizontal: 16, paddingBottom: 8,
          opacity: headerAnim,
          transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }],
        }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.iconBtn, { backgroundColor: T.card, borderColor: T.border }]}>
            <Ionicons name="arrow-back" size={20} color={T.white} />
          </TouchableOpacity>
          <Text style={{ color: T.white, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 }}>About the Creator</Text>
        </Animated.View>

        {/* ── Profile card ── */}
        <View style={{ paddingHorizontal: 16, marginTop: 8, marginBottom: 20 }}>
          <View style={[styles.profileCard, { backgroundColor: T.card, borderColor: T.border }]}>

            {/* Avatar */}
            <Animated.View style={{
              alignSelf: 'center', marginBottom: 16,
              opacity: avatarAnim,
              transform: [{ scale: avatarAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }],
            }}>
              <View style={styles.avatarWrap}>
                <Image source={PHOTO} style={styles.avatarImg} resizeMode="cover" />
              </View>
            </Animated.View>

            {/* Name & title */}
            <Text style={{ color: T.white, fontSize: 24, fontWeight: '900', textAlign: 'center', letterSpacing: -0.5 }}>
              Saad Ikram
            </Text>
            <Text style={{ color: T.green, fontSize: 13, fontWeight: '700', textAlign: 'center', marginTop: 4 }}>
              Mobile App Developer
            </Text>
            <Text style={{ color: T.text, fontSize: 12, textAlign: 'center', marginTop: 3 }}>
              Chakwal, Punjab, Pakistan
            </Text>

            {/* Bio */}
            <View style={[styles.bio, { borderColor: T.border }]}>
              <Text style={{ color: T.text, fontSize: 13, lineHeight: 20, textAlign: 'center' }}>
                Passionate mobile developer specializing in React Native and Flutter. Built RunQuest from scratch — GPS tracking, real-time databases, AI integration, and game mechanics in one app.
              </Text>
            </View>

            {/* Contact buttons */}
            <View style={{ gap: 10 }}>
              <TouchableOpacity
                onPress={() => openLink('https://github.com/saad43165')}
                activeOpacity={0.85}
                style={[styles.contactBtn, { backgroundColor: T.card, borderColor: T.border }]}
              >
                <View style={[styles.contactBtnIcon, { backgroundColor: T.border }]}>
                  <Ionicons name="logo-github" size={18} color={T.white} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: T.white, fontSize: 13, fontWeight: '700' }}>GitHub</Text>
                  <Text style={{ color: T.text, fontSize: 11 }} numberOfLines={1}>github.com/saad43165</Text>
                </View>
                <Ionicons name="open-outline" size={16} color={T.text} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => openLink('mailto:saadnaz43165@gmail.com?subject=RunQuest - Hello')}
                activeOpacity={0.85}
                style={[styles.contactBtn, { backgroundColor: T.card, borderColor: T.border }]}
              >
                <View style={[styles.contactBtnIcon, { backgroundColor: T.green + '20' }]}>
                  <Ionicons name="mail-outline" size={18} color={T.green} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: T.white, fontSize: 13, fontWeight: '700' }}>Email</Text>
                  <Text style={{ color: T.text, fontSize: 11 }} numberOfLines={1}>saadnaz43165@gmail.com</Text>
                </View>
                <Ionicons name="open-outline" size={16} color={T.text} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => openLink('mailto:saadnaz43165@gmail.com?subject=RunQuest Bug Report&body=Describe the issue:')}
                activeOpacity={0.85}
                style={[styles.contactBtn, { backgroundColor: T.card, borderColor: T.border }]}
              >
                <View style={[styles.contactBtnIcon, { backgroundColor: T.red + '18' }]}>
                  <Ionicons name="bug-outline" size={18} color={T.red} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: T.white, fontSize: 13, fontWeight: '700' }}>Report an Issue</Text>
                  <Text style={{ color: T.text, fontSize: 11 }}>Send a bug report via email</Text>
                </View>
                <Ionicons name="open-outline" size={16} color={T.text} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── Project stats ── */}
        <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
          <Text style={[styles.sectionLabel, { color: T.text }]}>PROJECT STATS</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {APP_STATS.map(s => (
              <View key={s.label} style={[styles.statCard, { backgroundColor: T.card, borderColor: T.border }]}>
                <Ionicons name={s.icon as any} size={18} color={T.green} />
                <Text style={{ color: T.white, fontSize: 20, fontWeight: '900', marginTop: 6 }}>{s.value}</Text>
                <Text style={{ color: T.text, fontSize: 10, fontWeight: '600', marginTop: 2 }}>{s.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Skills ── */}
        <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
          <Text style={[styles.sectionLabel, { color: T.text }]}>SKILLS</Text>
          <View style={[styles.card, { backgroundColor: T.card, borderColor: T.border }]}>
            {SKILLS.map((skill, i) => (
              <SkillBar key={skill.label} skill={skill} index={i} />
            ))}
          </View>
        </View>

        {/* ── Technologies ── */}
        <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
          <Text style={[styles.sectionLabel, { color: T.text }]}>TECHNOLOGIES</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {['React Native', 'Flutter', 'Expo', 'TypeScript', 'Firebase', 'Firestore',
              'MapLibre GL', 'Turf.js', 'Claude AI', 'Expo Audio', 'React Navigation', 'AsyncStorage',
            ].map(tech => (
              <View key={tech} style={[styles.techChip, { backgroundColor: T.card, borderColor: T.border }]}>
                <Text style={{ color: T.text, fontSize: 12, fontWeight: '600' }}>{tech}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Background ── */}
        <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
          <Text style={[styles.sectionLabel, { color: T.text }]}>BACKGROUND</Text>
          <View style={[styles.card, { backgroundColor: T.card, borderColor: T.border }]}>
            {[
              { icon: 'school-outline', title: 'Computer Science', sub: 'Software Engineering background' },
              { icon: 'phone-portrait-outline', title: 'Primary: Mobile App Development', sub: 'React Native & Flutter since 2022' },
              { icon: 'globe-outline', title: 'Open Source', sub: 'github.com/saad43165' },
              { icon: 'construct-outline', title: 'Full-Stack Capable', sub: 'Firebase, Node.js, REST APIs' },
            ].map((item, i, arr) => (
              <View key={item.title}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13 }}>
                  <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: T.border, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={item.icon as any} size={17} color={T.text} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: T.white, fontSize: 13, fontWeight: '700' }}>{item.title}</Text>
                    <Text style={{ color: T.text, fontSize: 11, marginTop: 2 }}>{item.sub}</Text>
                  </View>
                </View>
                {i < arr.length - 1 && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: T.border, marginLeft: 52 }} />}
              </View>
            ))}
          </View>
        </View>

        {/* ── About RunQuest ── */}
        <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
          <Text style={[styles.sectionLabel, { color: T.text }]}>ABOUT RUNQUEST</Text>
          <View style={[styles.card, { backgroundColor: T.card, borderColor: T.border }]}>
            <Text style={{ color: T.text, fontSize: 13, lineHeight: 21 }}>
              RunQuest is a real-world GPS territory claiming game. Players run physical routes to claim land on a global map, invade enemy territories, form alliances, and compete on worldwide leaderboards.{'\n\n'}Designed and developed entirely by Saad Ikram — from UI/UX to backend architecture, real-time database, AI assistant, and GPS algorithms.
            </Text>
          </View>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  sectionLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 2, marginBottom: 12 },
  profileCard: { borderRadius: 24, borderWidth: 1, overflow: 'hidden', padding: 20 },
  avatarWrap: { width: 96, height: 96, borderRadius: 48, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.15)' },
  avatarImg: { width: 96, height: 96 },
  bio: { borderRadius: 14, borderWidth: 1, padding: 14, marginTop: 14, marginBottom: 16 },
  contactBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 14, borderWidth: 1, padding: 14,
  },
  contactBtnIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  card: { borderRadius: 18, borderWidth: 1, overflow: 'hidden', padding: 16 },
  statCard: { flex: 1, borderRadius: 16, borderWidth: 1, padding: 14, alignItems: 'center' },
  techChip: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 18, borderWidth: 1 },
});
