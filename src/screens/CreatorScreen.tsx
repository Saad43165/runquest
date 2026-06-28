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

// Developer photo
const PHOTO = require('../../assets/saad.png');

const APP_STATS = [
  { label: 'Screens', value: '15+', icon: 'layers-outline' },
  { label: 'Features', value: '40+', icon: 'flash-outline' },
  { label: 'Dev Time', value: '3 mo', icon: 'time-outline' },
];

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
                onPress={() => openLink('https://www.linkedin.com/in/saad-i-786123406?utm_source=share_via&utm_content=profile&utm_medium=member_android')}
                activeOpacity={0.85}
                style={[styles.contactBtn, { backgroundColor: T.card, borderColor: T.border }]}
              >
                <View style={[styles.contactBtnIcon, { backgroundColor: '#0077b5' + '30' }]}>
                  <Ionicons name="logo-linkedin" size={18} color="#0077b5" />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: T.white, fontSize: 13, fontWeight: '700' }}>LinkedIn</Text>
                  <Text style={{ color: T.text, fontSize: 11 }} numberOfLines={1}>Connect with me</Text>
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
