import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Animated,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
  StyleSheet, Dimensions, StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/utils/ThemeContext';
import { loginUser } from '../services/authService';
import { getFriendlyErrorMessage } from '../utils/ErrorUtils';
import * as Haptics from 'expo-haptics';

const { width, height } = Dimensions.get('window');

export default function LoginScreen({ onGoSignUp, onGoForgot }: {
  onGoSignUp: () => void;
  onGoForgot: () => void;
}) {
  const { T } = useTheme();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passFocused, setPassFocused] = useState(false);

  const logoAnim = useRef(new Animated.Value(0)).current;
  const input1Anim = useRef(new Animated.Value(40)).current;
  const input2Anim = useRef(new Animated.Value(40)).current;
  const btnAnim = useRef(new Animated.Value(40)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const errorAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(logoAnim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 8 }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
    Animated.stagger(80, [
      Animated.spring(input1Anim, { toValue: 0, useNativeDriver: true, tension: 60, friction: 9 }),
      Animated.spring(input2Anim, { toValue: 0, useNativeDriver: true, tension: 60, friction: 9 }),
      Animated.spring(btnAnim, { toValue: 0, useNativeDriver: true, tension: 60, friction: 9 }),
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

  const onLogin = async () => {
    setError(null);
    if (!email.trim() || !password) {
      showError('Please enter your email and password.');
      triggerShake();
      return;
    }
    try {
      setLoading(true);
      await loginUser(email.trim().toLowerCase(), password);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo */}
          <Animated.View style={[styles.logoWrap, { opacity: fadeAnim, transform: [{ scale: logoAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }] }]}>
            <LinearGradient colors={[T.green, '#00C6A0']} style={styles.logoGrad}>
              <Ionicons name="globe" size={48} color="#000" />
            </LinearGradient>
            <View style={[styles.logoGlow, { borderColor: T.green + '30' }]} />
          </Animated.View>

          <Animated.View style={{ opacity: fadeAnim, alignItems: 'center', marginBottom: 48 }}>
            <Text style={[styles.appName, { color: T.white }]}>RunQuest</Text>
            <Text style={[styles.tagline, { color: T.text }]}>Conquer your territory</Text>
          </Animated.View>

          {/* Inputs */}
          <Animated.View style={[styles.inputWrap, { transform: [{ translateY: input1Anim }, { translateX: shakeAnim }] }]}>
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

          <Animated.View style={[styles.inputWrap, { transform: [{ translateY: input2Anim }, { translateX: shakeAnim }] }]}>
            <View style={[styles.inputPill, { backgroundColor: T.card, borderColor: passFocused ? T.green : T.border }]}>
              <Ionicons name="lock-closed-outline" size={18} color={passFocused ? T.green : T.text} />
              <TextInput
                style={[styles.inputText, { color: T.white, flex: 1 }]}
                placeholder="Password"
                placeholderTextColor={T.text + '70'}
                value={password}
                onChangeText={setPassword}
                onFocus={() => setPassFocused(true)}
                onBlur={() => setPassFocused(false)}
                secureTextEntry={!showPass}
              />
              <TouchableOpacity onPress={() => setShowPass(v => !v)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={T.text} />
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* Error */}
          {error && (
            <Animated.View style={[styles.errorPill, { backgroundColor: T.red + '18', borderColor: T.red + '40', opacity: errorAnim, transform: [{ scale: errorAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }] }]}>
              <Ionicons name="alert-circle" size={14} color={T.red} />
              <Text style={{ color: T.red, fontSize: 13, fontWeight: '600', flex: 1 }}>{error}</Text>
            </Animated.View>
          )}

          {/* Forgot */}
          <TouchableOpacity onPress={onGoForgot} style={styles.forgotWrap}>
            <Text style={{ color: T.green, fontSize: 13, fontWeight: '700' }}>Forgot password?</Text>
          </TouchableOpacity>

          {/* Login button */}
          <Animated.View style={{ transform: [{ translateY: btnAnim }] }}>
            <TouchableOpacity onPress={onLogin} disabled={loading} activeOpacity={0.85} style={styles.loginBtn}>
              <LinearGradient colors={[T.green, '#00C6A0']} style={styles.loginGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                {loading ? <ActivityIndicator color="#000" /> : (
                  <>
                    <Text style={styles.loginBtnText}>LOG IN</Text>
                    <Ionicons name="arrow-forward" size={20} color="#000" />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          {/* Sign up link */}
          <View style={styles.signupRow}>
            <Text style={{ color: T.text, fontSize: 15 }}>New to RunQuest?</Text>
            <TouchableOpacity onPress={onGoSignUp}>
              <Text style={{ color: T.green, fontWeight: '800', fontSize: 15 }}> Sign Up</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 28 },
  orb1: { position: 'absolute', top: -100, right: -80, width: 300, height: 300, borderRadius: 150 },
  orb2: { position: 'absolute', bottom: 100, left: -100, width: 250, height: 250, borderRadius: 125 },
  logoWrap: { alignSelf: 'center', marginBottom: 20, position: 'relative' },
  logoGrad: { width: 100, height: 100, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  logoGlow: { position: 'absolute', top: -8, left: -8, right: -8, bottom: -8, borderRadius: 40, borderWidth: 1.5 },
  appName: { fontSize: 36, fontWeight: '900', letterSpacing: -1 },
  tagline: { fontSize: 15, marginTop: 4, opacity: 0.7 },
  inputWrap: { marginBottom: 14 },
  inputPill: { flexDirection: 'row', alignItems: 'center', borderRadius: 18, borderWidth: 1.5, paddingHorizontal: 18, gap: 12, height: 58 },
  inputText: { flex: 1, fontSize: 16 },
  errorPill: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, borderWidth: 1, padding: 12, marginBottom: 12 },
  forgotWrap: { alignSelf: 'flex-end', marginBottom: 24, marginTop: 4 },
  loginBtn: { borderRadius: 18, overflow: 'hidden', marginBottom: 32 },
  loginGrad: { height: 62, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  loginBtnText: { color: '#000', fontWeight: '900', fontSize: 17, letterSpacing: 0.5 },
  signupRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
});
