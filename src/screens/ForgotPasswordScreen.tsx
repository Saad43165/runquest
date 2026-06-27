import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Animated,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
  StyleSheet, StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/utils/ThemeContext';
import { resetPassword } from '../services/authService';
import { getFriendlyErrorMessage } from '../utils/ErrorUtils';
import * as Haptics from 'expo-haptics';

export default function ForgotPasswordScreen({ onGoBack }: { onGoBack: () => void }) {
  const { T } = useTheme();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailFocused, setEmailFocused] = useState(false);

  const logoAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const errorAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(logoAnim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 8 }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 60, friction: 9 }),
    ]).start();
  }, []);

  const triggerShake = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 14, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -14, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const showError = (msg: string) => {
    setError(msg);
    errorAnim.setValue(0);
    Animated.spring(errorAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 10 }).start();
  };

  const onSendLink = async () => {
    setError(null);
    if (!email.trim()) {
      showError('Please enter your email address.');
      triggerShake();
      return;
    }
    try {
      setLoading(true);
      await resetPassword(email.trim().toLowerCase());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSent(true);
    } catch (e: any) {
      setLoading(false);
      triggerShake();
      showError(getFriendlyErrorMessage(e));
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.black }}>
      <StatusBar barStyle="light-content" />
      {/* Decorative orbs */}
      <View style={[styles.orb1, { backgroundColor: T.green + '18' }]} />
      <View style={[styles.orb2, { backgroundColor: T.accent2 + '12' }]} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back button */}
          <TouchableOpacity onPress={onGoBack} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={26} color={T.white} />
          </TouchableOpacity>

          {/* Icon — shield with lock, matches security context + app theme */}
          <Animated.View style={[styles.iconWrap, { opacity: fadeAnim, transform: [{ scale: logoAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }] }]}>
            <LinearGradient colors={['#00C6FF', '#0A84FF']} style={styles.iconGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Ionicons name="shield-checkmark" size={44} color="#FFF" />
            </LinearGradient>
            <View style={[styles.iconGlow, { borderColor: '#00C6FF40' }]} />
            {/* Small lock badge */}
            <View style={{ position: 'absolute', bottom: -4, right: -4, width: 28, height: 28, borderRadius: 14, backgroundColor: '#0A0C10', borderWidth: 2, borderColor: '#00C6FF40', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="key" size={14} color="#00C6FF" />
            </View>
          </Animated.View>

          <Animated.View style={{ opacity: fadeAnim, alignItems: 'center', marginBottom: 48, transform: [{ translateY: slideAnim }] }}>
            <Text style={[styles.title, { color: T.white }]}>Reset Password</Text>
            <Text style={[styles.subtitle, { color: T.text }]}>Enter your email to receive a reset link</Text>
          </Animated.View>

          {sent ? (
            <Animated.View style={{ opacity: fadeAnim, alignItems: 'center', paddingHorizontal: 4 }}>
              <View style={[styles.successPill, { backgroundColor: T.green + '18', borderColor: T.green + '40' }]}>
                <Ionicons name="mail-unread-outline" size={32} color={T.green} />
                <Text style={{ color: T.white, fontSize: 20, fontWeight: '900', marginTop: 12, marginBottom: 8 }}>Check Your Email</Text>
                <Text style={{ color: T.text, fontSize: 14, textAlign: 'center', lineHeight: 20 }}>
                  We sent a reset link to{' '}
                  <Text style={{ color: T.white, fontWeight: '700' }}>{email}</Text>
                </Text>
              </View>
              <TouchableOpacity onPress={onGoBack} style={styles.backToLoginBtn}>
                <LinearGradient colors={[T.green, '#0A84FF']} style={styles.backToLoginGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  <Text style={styles.backToLoginText}>BACK TO LOGIN</Text>
                  <Ionicons name="arrow-forward" size={18} color="#000" />
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          ) : (
            <Animated.View style={{ transform: [{ translateY: slideAnim }] }}>
              {/* Email input */}
              <Animated.View style={[styles.inputWrap, { transform: [{ translateX: shakeAnim }] }]}>
                <View style={[styles.inputPill, { backgroundColor: T.card, borderColor: emailFocused ? T.green : T.border }]}>
                  <Ionicons name="mail-outline" size={18} color={emailFocused ? T.green : T.text} />
                  <TextInput
                    style={[styles.inputText, { color: T.white }]}
                    placeholder="Email address"
                    placeholderTextColor={T.text + '70'}
                    value={email}
                    onChangeText={setEmail}
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => setEmailFocused(false)}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    autoCorrect={false}
                  />
                </View>
              </Animated.View>

              {/* Error */}
              {error && (
                <Animated.View style={[styles.errorPill, { backgroundColor: T.red + '18', borderColor: T.red + '40', opacity: errorAnim, transform: [{ scale: errorAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }] }]}>
                  <Ionicons name="alert-circle" size={14} color={T.red} />
                  <Text style={{ color: T.red, fontSize: 13, fontWeight: '600', flex: 1 }}>{error}</Text>
                </Animated.View>
              )}

              {/* Send button */}
              <TouchableOpacity onPress={onSendLink} disabled={loading} activeOpacity={0.85} style={styles.sendBtn}>
                <LinearGradient colors={[T.green, '#0A84FF']} style={styles.sendGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  {loading ? <ActivityIndicator color="#000" /> : (
                    <>
                      <Text style={styles.sendBtnText}>SEND RESET LINK</Text>
                      <Ionicons name="arrow-forward" size={20} color="#000" />
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 28 },
  orb1: { position: 'absolute', top: -100, right: -80, width: 300, height: 300, borderRadius: 150 },
  orb2: { position: 'absolute', bottom: 100, left: -100, width: 250, height: 250, borderRadius: 125 },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -8, marginBottom: 16 },
  iconWrap: { alignSelf: 'center', marginBottom: 20, position: 'relative' },
  iconGrad: { width: 96, height: 96, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  iconGlow: { position: 'absolute', top: -8, left: -8, right: -8, bottom: -8, borderRadius: 38, borderWidth: 1.5 },
  title: { fontSize: 32, fontWeight: '900', letterSpacing: -0.5 },
  subtitle: { fontSize: 15, marginTop: 6, opacity: 0.7, textAlign: 'center' },
  inputWrap: { marginBottom: 14 },
  inputPill: { flexDirection: 'row', alignItems: 'center', borderRadius: 18, borderWidth: 1.5, paddingHorizontal: 18, gap: 12, height: 58 },
  inputText: { flex: 1, fontSize: 16 },
  errorPill: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, borderWidth: 1, padding: 12, marginBottom: 12 },
  sendBtn: { borderRadius: 18, overflow: 'hidden', marginTop: 8 },
  sendGrad: { height: 62, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  sendBtnText: { color: '#000', fontWeight: '900', fontSize: 17, letterSpacing: 0.5 },
  successPill: { borderRadius: 24, borderWidth: 1, padding: 28, alignItems: 'center', width: '100%', marginBottom: 28 },
  backToLoginBtn: { borderRadius: 18, overflow: 'hidden', width: '100%' },
  backToLoginGrad: { height: 62, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  backToLoginText: { color: '#000', fontWeight: '900', fontSize: 17, letterSpacing: 0.5 },
});
