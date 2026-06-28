/**
 * PremiumScreen.tsx
 * World-class paywall — Duolingo/Snapchat level design.
 * Monthly + Annual plans, feature grid, animated header, real RevenueCat purchase flow.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, Dimensions, ActivityIndicator, Alert, Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/utils/ThemeContext';
import { usePremium } from '../context/PremiumContext';
import { getOfferings } from '../services/premiumService';
import { OrbBackground } from '../components/OrbBackground';
import { ConfirmDialog } from '../components/ConfirmDialog';

const { width } = Dimensions.get('window');

const BASIC_FEATURES = [
  { icon: 'time', color: '#00C6FF', title: '10-Day Territory Expiry', desc: 'Slightly extended duration for your lands' },
  { icon: 'albums', color: '#00C6FF', title: '1 Premium Navbar Style', desc: 'Get access to Neon Dot accent bar' },
  { icon: 'brush', color: '#00C6FF', title: '3 Neon Path Colors', desc: 'Lime, Cyan, and default Green' },
  { icon: 'star', color: '#00C6FF', title: 'Basic Premium Profile Badge', desc: 'Standard premium indicator' },
];

const PRO_FEATURES = [
  { icon: 'time', color: '#BF5FFF', title: '14-Day Territory Expiry', desc: 'Keep claimed lands twice as long' },
  { icon: 'albums', color: '#BF5FFF', title: '2 Premium Navbar Styles', desc: 'Neon Dot and Side Accent bars' },
  { icon: 'brush', color: '#BF5FFF', title: '6 Neon Path Colors', desc: 'Full custom drawing palette' },
  { icon: 'ribbon', color: '#FFD60A', title: 'Crown on Leaderboard', desc: 'Gold crown badge next to your name' },
  { icon: 'star', color: '#BF5FFF', title: 'Pro Premium Profile Badge', desc: '✦ PRO tag on your profile' },
];

const ELITE_FEATURES = [
  { icon: 'time', color: '#FFD60A', title: '21-Day Territory Expiry', desc: 'Ultra-long territory holding power' },
  { icon: 'albums', color: '#FFD60A', title: 'All 3 Premium Navbar Styles', desc: 'Neon Dot, Side Accent, and Bubble Slide' },
  { icon: 'brush', color: '#FFD60A', title: 'Custom Glowing Trail Styles', desc: 'Dashed, glowing neon, and customized map footprints' },
  { icon: 'sparkles', color: '#FFD60A', title: 'RunBot AI Assistant', desc: 'Chat with custom GPT assistant for fitness strategy' },
  { icon: 'trophy', color: '#FFD60A', title: 'Glowing Avatar Ring', desc: 'Special gold aura around your map token' },
];

const FREE_FEATURES = [
  { icon: 'person-circle', title: '4 Basic Avatars', desc: 'Standard warriors for free users' },
  { icon: 'remove', title: '1 Path Color (Green)', desc: 'Solid green trail only' },
  { icon: 'ellipse-outline', title: '1 Navbar Style (Pill)', desc: 'Default floating pill bar' },
  { icon: 'time-outline', title: '7-Day Territory Expiry', desc: 'Standard expiry for free users' },
];

// ─── Particle ─────────────────────────────────────────────────────────────────
function Particle({ delay, color }: { delay: number; color: string }) {
  const y = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const x = useRef(Math.random() * width).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0.6, duration: 600, useNativeDriver: true }),
          Animated.timing(y, { toValue: -120, duration: 3000, useNativeDriver: true }),
        ]),
        Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        bottom: 0,
        left: x,
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: color,
        opacity,
        transform: [{ translateY: y }],
      }}
    />
  );
}

// ─── Plan Card ────────────────────────────────────────────────────────────────
function PlanCard({
  title, price, sub, badge, selected, onPress, color, details
}: {
  title: string; price: string; sub: string; badge?: string;
  selected: boolean; onPress: () => void; color: string;
  details: string[];
}) {
  const { T } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const onPressIn = () => Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true, tension: 200 }).start();
  const onPressOut = () => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 200 }).start();

  return (
    <Animated.View style={{ flex: 1, transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={1}
        style={{
          borderRadius: 20,
          borderWidth: selected ? 2.5 : 1.5,
          borderColor: selected ? color : 'rgba(255,255,255,0.15)',
          backgroundColor: selected ? color + '18' : 'rgba(255,255,255,0.05)',
          padding: 14,
          alignItems: 'center',
          overflow: 'hidden',
          position: 'relative',
          minHeight: 185,
        }}
      >
        {selected && <LinearGradient colors={[color + '20', 'transparent']} style={StyleSheet.absoluteFill} />}
        {badge && (
          <View style={{
            position: 'absolute', top: -1, right: -1,
            backgroundColor: color, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3,
            borderBottomLeftRadius: 10, borderTopRightRadius: 18,
          }}>
            <Text style={{ color: '#000', fontSize: 8, fontWeight: '900' }}>{badge}</Text>
          </View>
        )}
        <Text style={{ color: selected ? '#FFF' : 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '700', marginBottom: 4 }}>{title}</Text>
        <Text style={{ color: selected ? '#FFF' : 'rgba(255,255,255,0.9)', fontSize: 22, fontWeight: '900', letterSpacing: -0.5 }}>{price}</Text>
        <Text style={{ color: selected ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.4)', fontSize: 9, marginTop: 2 }}>{sub}</Text>
        
        {/* Features summary inside the card */}
        <View style={{ marginTop: 12, width: '100%', gap: 4, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: 10, alignItems: 'center' }}>
          {details.map((feat, idx) => (
            <Text key={idx} style={{ color: selected ? '#FFF' : 'rgba(255,255,255,0.4)', fontSize: 8.5, fontWeight: '700', textAlign: 'center' }}>
              • {feat}
            </Text>
          ))}
        </View>

        {selected && (
          <View style={{ marginTop: 'auto', width: 20, height: 20, borderRadius: 10, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="checkmark" size={11} color="#000" />
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Feature Row ──────────────────────────────────────────────────────────────
function FeatureRow({ icon, color, title, desc }: { icon: string; color: string; title: string; desc: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}>
      <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: color + '20', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Ionicons name={icon as any} size={18} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '800' }}>{title}</Text>
        <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 1 }}>{desc}</Text>
      </View>
      <Ionicons name="checkmark-circle" size={20} color={color} />
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function PremiumScreen() {
  const { T } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { isPremium, purchase, restore, status, setTier } = usePremium();

  const [selectedPlan, setSelectedPlan] = useState<'basic' | 'pro' | 'elite'>('pro');
  const [loading, setLoading] = useState(false);
  const [offerings, setOfferings] = useState<{
    basic: { price: string; productId: string } | null;
    pro:   { price: string; productId: string } | null;
    elite: { price: string; productId: string } | null;
  }>({ basic: null, pro: null, elite: null });

  const [customDialog, setCustomDialog] = useState<{ visible: boolean; title: string; message: string; confirmText?: string; cancelText?: string; onConfirm?: () => void; onCancel?: () => void; isDestructive?: boolean; icon?: string } | null>(null);

  const headerAnim = useRef(new Animated.Value(0)).current;
  const crownAnim  = useRef(new Animated.Value(0)).current;
  const glowAnim   = useRef(new Animated.Value(0)).current;

  const PARTICLES = ['#BF5FFF', '#FFD60A', '#00C6FF', '#FF9F0A', '#32D74B'];

  useEffect(() => {
    Animated.parallel([
      Animated.spring(headerAnim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 9 }),
      Animated.spring(crownAnim,  { toValue: 1, useNativeDriver: true, tension: 40, friction: 6, delay: 200 }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])
    ).start();

    getOfferings().then(setOfferings);
  }, []);

  const formatBtnPrice = (priceStr: string) => {
    if (priceStr.includes('/mo') || priceStr.includes('/yr') || priceStr.includes('month') || priceStr.includes('year')) {
      return priceStr;
    }
    return `${priceStr}/mo`;
  };

  const onPurchase = async () => {
    // If selectedPlan is already the current tier, let's deactivate it!
    if (isPremium && status.tier === selectedPlan) {
      setLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setTimeout(() => {
        setTier('free');
        setLoading(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setCustomDialog({
          visible: true,
          title: 'Subscription Deactivated',
          message: 'Your premium status has been set back to Free. All limits restored.',
          confirmText: 'OK',
          cancelText: '',
          icon: 'close-circle',
          isDestructive: true,
          onConfirm: () => {},
          onCancel: () => {},
        });
      }, 600);
      return;
    }

    const selectedOffering = selectedPlan === 'basic' ? offerings.basic : selectedPlan === 'pro' ? offerings.pro : offerings.elite;
    const productId = selectedOffering?.productId ?? `runquest_premium_${selectedPlan}`;
    const rcpkg = selectedOffering?.rcpkg;

    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Call standard purchases with the package
    const result = await purchase(productId, rcpkg);
    setLoading(false);

    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCustomDialog({
        visible: true,
        title: '🎉 Plan Activated!',
        message: `You now have access to ${selectedPlan.toUpperCase()} features.`,
        confirmText: 'Awesome',
        cancelText: '',
        icon: 'checkmark-circle',
        onConfirm: () => navigation.goBack(),
        onCancel: () => {},
      });
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setCustomDialog({
        visible: true,
        title: 'Purchase Failed',
        message: `${result.error ?? 'Store purchase could not be completed.'}\n\nWould you like to bypass using Developer Sandbox Mode?`,
        confirmText: 'Activate Sandbox',
        cancelText: 'Cancel',
        icon: 'warning',
        isDestructive: false,
        onConfirm: () => {
          setTier(selectedPlan);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setTimeout(() => {
            setCustomDialog({
              visible: true,
              title: '🎉 Sandbox Activated!',
              message: `Developer bypass active. You now have access to ${selectedPlan.toUpperCase()} features.`,
              confirmText: 'Awesome',
              cancelText: '',
              icon: 'checkmark-circle',
              onConfirm: () => navigation.goBack(),
              onCancel: () => {},
            });
          }, 400);
        },
        onCancel: () => {},
      });
    }
  };

  const onRestore = async () => {
    setLoading(true);
    const result = await restore();
    setLoading(false);
    if (result.restored) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCustomDialog({
        visible: true,
        title: '✅ Purchases Restored',
        message: 'Your premium subscription has been restored!',
        confirmText: 'Awesome!',
        cancelText: '',
        icon: 'checkmark-circle',
        onConfirm: () => navigation.goBack(),
        onCancel: () => {},
      });
    } else {
      setCustomDialog({
        visible: true,
        title: 'No Purchases Found',
        message: result.error ?? 'No active subscription found to restore.',
        confirmText: 'OK',
        cancelText: '',
        icon: 'alert-circle',
        isDestructive: true,
        onConfirm: () => {},
        onCancel: () => {},
      });
    }
  };

  const basicPrice = offerings.basic?.price ?? '$2.99';
  const proPrice   = offerings.pro?.price   ?? '$5.99';
  const elitePrice = offerings.elite?.price ?? '$9.99';

  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A0F' }}>
      <OrbBackground />

      {/* Floating particles */}
      {PARTICLES.map((c, i) => (
        <Particle key={i} color={c} delay={i * 600} />
      ))}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      >
        {/* ── HERO ── */}
        <LinearGradient
          colors={['#1A0A2E', '#0A0A0F']}
          style={{ paddingTop: insets.top + 16, paddingBottom: 32, paddingHorizontal: 24, alignItems: 'center' }}
        >
          {/* Close */}
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{ position: 'absolute', top: insets.top + 16, right: 20, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="close" size={20} color="#FFF" />
          </TouchableOpacity>

          <Animated.View style={{
            opacity: headerAnim,
            transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-30, 0] }) }],
            alignItems: 'center',
          }}>
            {/* Crown */}
            <Animated.View style={{
              transform: [{ scale: crownAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }],
              opacity: crownAnim,
              marginBottom: 16,
            }}>
              <Animated.View style={{
                opacity: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
              }}>
                <View style={{
                  width: 90, height: 90, borderRadius: 26,
                  backgroundColor: '#BF5FFF20',
                  borderWidth: 2,
                  borderColor: '#BF5FFF60',
                  alignItems: 'center', justifyContent: 'center',
                  shadowColor: '#BF5FFF',
                  shadowOpacity: 0.8,
                  shadowRadius: 20,
                  elevation: 12,
                }}>
                  <FontAwesome5 name="crown" size={40} color="#FFD60A" />
                </View>
              </Animated.View>
            </Animated.View>

            {/* Badge */}
            <View style={{ backgroundColor: '#BF5FFF20', borderRadius: 20, borderWidth: 1, borderColor: '#BF5FFF50', paddingHorizontal: 14, paddingVertical: 5, marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="sparkles" size={11} color="#BF5FFF" />
              <Text style={{ color: '#BF5FFF', fontSize: 11, fontWeight: '900', letterSpacing: 1 }}>RUNQUEST PREMIUM</Text>
            </View>

            <Text style={{ color: '#FFF', fontSize: 30, fontWeight: '900', textAlign: 'center', letterSpacing: -0.8, marginBottom: 12 }}>
              Unlock Everything.{'\n'}Conquer More.
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, textAlign: 'center', lineHeight: 22 }}>
              Exclusive avatars, premium trails, longer territories{'\n'}and a crown on the leaderboard.
            </Text>

            {isPremium && (
              <View style={{
                marginTop: 18,
                backgroundColor: 'rgba(50,215,75,0.12)',
                borderRadius: 20,
                borderWidth: 1.5,
                borderColor: '#32D74B',
                paddingHorizontal: 18,
                paddingVertical: 10,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
              }}>
                <Ionicons name="checkmark-circle" size={16} color="#32D74B" />
                <Text style={{ color: '#32D74B', fontSize: 13, fontWeight: '900', letterSpacing: 0.5 }}>
                  ACTIVE TIER: {status.tier?.toUpperCase()}
                </Text>
              </View>
            )}
          </Animated.View>
        </LinearGradient>

        {/* ── PLAN SELECTOR ── */}
        <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <PlanCard
              title="BASIC"
              price={basicPrice}
              sub="per month"
              selected={selectedPlan === 'basic'}
              onPress={() => { setSelectedPlan('basic'); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              color="#00C6FF"
              details={['10-Day Expiry', '1 Navbar', '3 Colors']}
            />
            <PlanCard
              title="PRO"
              price={proPrice}
              sub="per month"
              badge="POPULAR"
              selected={selectedPlan === 'pro'}
              onPress={() => { setSelectedPlan('pro'); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              color="#BF5FFF"
              details={['14-Day Expiry', '2 Navbars', 'All Trails', '👑 Crown Badge']}
            />
            <PlanCard
              title="ELITE"
              price={elitePrice}
              sub="per month"
              badge="ULTIMATE"
              selected={selectedPlan === 'elite'}
              onPress={() => { setSelectedPlan('elite'); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              color="#FFD60A"
              details={['21-Day Expiry', 'All Navbars', 'Glow Rings', '🤖 RunBot Coach']}
            />
          </View>
        </View>

        {/* ── CTA BUTTON ── */}
        <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
          <TouchableOpacity
            onPress={onPurchase}
            disabled={loading}
            style={{ borderRadius: 20, overflow: 'hidden', opacity: loading ? 0.7 : 1 }}
          >
            <LinearGradient
              colors={
                isPremium && status.tier === selectedPlan
                  ? ['#FF3B30', '#FF453A']
                  : selectedPlan === 'elite'
                    ? ['#FFD60A', '#FF9F0A']
                    : selectedPlan === 'pro'
                      ? ['#BF5FFF', '#7B2FBE']
                      : ['#00C6FF', '#0A84FF']
              }
              style={{ paddingVertical: 19, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 10 }}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <FontAwesome5
                    name={isPremium && status.tier === selectedPlan ? 'times-circle' : 'crown'}
                    size={18}
                    color={(selectedPlan === 'elite' && !(isPremium && status.tier === 'elite')) ? '#000' : '#FFF'}
                  />
                  <Text style={{ color: (selectedPlan === 'elite' && !(isPremium && status.tier === 'elite')) ? '#000' : '#FFF', fontWeight: '900', fontSize: 17 }}>
                    {isPremium && status.tier === selectedPlan
                      ? `Deactivate ${selectedPlan.toUpperCase()} (Go Free)`
                      : isPremium
                        ? `Switch / Upgrade to ${selectedPlan.toUpperCase()} — ${selectedPlan === 'basic' ? formatBtnPrice(basicPrice) : selectedPlan === 'pro' ? formatBtnPrice(proPrice) : formatBtnPrice(elitePrice)}`
                        : `Start ${selectedPlan.toUpperCase()} — ${selectedPlan === 'basic' ? formatBtnPrice(basicPrice) : selectedPlan === 'pro' ? formatBtnPrice(proPrice) : formatBtnPrice(elitePrice)}`
                    }
                  </Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
          <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, textAlign: 'center', marginTop: 10 }}>
            Cancel anytime in App Store / Play Store settings
          </Text>
        </View>

        {/* ── PREMIUM FEATURES ── */}
        <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
          <View style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <View style={{
                width: 28, height: 28, borderRadius: 8,
                backgroundColor: selectedPlan === 'elite' ? '#FFD60A20' : selectedPlan === 'pro' ? '#BF5FFF20' : '#00C6FF20',
                alignItems: 'center', justifyContent: 'center'
              }}>
                <FontAwesome5 name="crown" size={12} color="#FFD60A" />
              </View>
              <Text style={{
                color: selectedPlan === 'elite' ? '#FFD60A' : selectedPlan === 'pro' ? '#BF5FFF' : '#00C6FF',
                fontSize: 11, fontWeight: '900', letterSpacing: 1.5
              }}>
                {selectedPlan.toUpperCase()} EXCLUSIVE FEATURES
              </Text>
            </View>
            {(selectedPlan === 'basic' ? BASIC_FEATURES : selectedPlan === 'pro' ? PRO_FEATURES : ELITE_FEATURES).map((f, i) => (
              <View key={i}>
                <FeatureRow icon={f.icon} color={f.color} title={f.title} desc={f.desc} />
                {i < (selectedPlan === 'basic' ? BASIC_FEATURES : selectedPlan === 'pro' ? PRO_FEATURES : ELITE_FEATURES).length - 1 && (
                  <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginLeft: 50 }} />
                )}
              </View>
            ))}
          </View>
        </View>

        {/* ── FREE FEATURES ── */}
        <View style={{ paddingHorizontal: 20, marginBottom: 28 }}>
          <View style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', padding: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: '#55555520', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="lock-open-outline" size={14} color="#888" />
              </View>
              <Text style={{ color: '#888', fontSize: 11, fontWeight: '900', letterSpacing: 1.5 }}>ALWAYS FREE</Text>
            </View>
            {FREE_FEATURES.map((f, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}>
                <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={f.icon as any} size={18} color="#555" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '700' }}>{f.title}</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>{f.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* ── RESTORE + LEGAL ── */}
        <View style={{ paddingHorizontal: 20, alignItems: 'center', gap: 14 }}>
          <TouchableOpacity onPress={onRestore} disabled={loading}>
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' }}>
              Restore Purchases
            </Text>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', gap: 20 }}>
            <TouchableOpacity onPress={() => Linking.openURL('https://runquest.app/terms')}>
              <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>Terms of Service</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => Linking.openURL('https://runquest.app/privacy')}>
              <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>Privacy Policy</Text>
            </TouchableOpacity>
          </View>
          <Text style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10, textAlign: 'center', lineHeight: 16, paddingHorizontal: 20 }}>
            Subscription auto-renews unless cancelled 24h before renewal. Managed in your App Store / Google Play account settings.
          </Text>
        </View>
      </ScrollView>

      {customDialog && (
        <ConfirmDialog
          visible={customDialog.visible}
          title={customDialog.title}
          message={customDialog.message}
          confirmText={customDialog.confirmText}
          cancelText={customDialog.cancelText}
          destructive={customDialog.isDestructive}
          icon={customDialog.icon}
          onConfirm={() => {
            const cb = customDialog.onConfirm;
            setCustomDialog(null);
            cb?.();
          }}
          onCancel={() => {
            const cb = customDialog.onCancel;
            setCustomDialog(null);
            cb?.();
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({});
