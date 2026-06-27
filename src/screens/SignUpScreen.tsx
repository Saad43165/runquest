import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  StatusBar,
  Dimensions,
  Modal,
  Linking,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/utils/ThemeContext';
import { registerUser } from '../services/authService';
import { getFriendlyErrorMessage } from '../utils/ErrorUtils';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { WebView } from 'react-native-webview';
import { sendEmailVerification } from 'firebase/auth';
import { auth } from '../services/firebase';
import { TERMS_HTML, PRIVACY_HTML } from '../constants/LegalContent';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Password strength ────────────────────────────────────────────────────────

function getPasswordStrength(p: string): { score: number; label: string; color: string } {
  let score = 0;
  if (p.length >= 8) score++;
  if (/[A-Z]/.test(p)) score++;
  if (/[0-9]/.test(p)) score++;
  if (/[^A-Za-z0-9]/.test(p)) score++;
  const labels = ['Weak', 'Fair', 'Good', 'Strong'];
  const colors = ['#FF453A', '#FF9F0A', '#FFD60A', '#32D74B'];
  return { score, label: score > 0 ? labels[score - 1] : '', color: score > 0 ? colors[score - 1] : 'transparent' };
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  onGoLogin: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SignUpScreen({ onGoLogin }: Props) {
  const { T } = useTheme();
  const insets = useSafeAreaInsets();

  // Step state
  const [step, setStep] = useState(0);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const errorAnim = useRef(new Animated.Value(0)).current;
  const envelopeAnim = useRef(new Animated.Value(0)).current;

  // Step 1 — Identity
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [displayNameFocused, setDisplayNameFocused] = useState(false);
  const [usernameFocused, setUsernameFocused] = useState(false);

  // Step 2 — Account
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [confirmFocused, setConfirmFocused] = useState(false);

  // Step 3 — Legal
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [legalModal, setLegalModal] = useState<'terms' | 'privacy' | null>(null);

  // Step 4 — Verification
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Error
  const [error, setError] = useState<string | null>(null);

  // ── Envelope bounce on step 4 ──────────────────────────────────────────────
  useEffect(() => {
    if (step === 3) {
      envelopeAnim.setValue(0);
      Animated.spring(envelopeAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 5,
      }).start();
    }
  }, [step]);

  // ── Cleanup cooldown on unmount ────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  // ── Helpers ────────────────────────────────────────────────────────────────

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

  const animateToStep = (nextStep: number, direction: 'forward' | 'back') => {
    const outTo = direction === 'forward' ? -SCREEN_WIDTH : SCREEN_WIDTH;
    const inFrom = direction === 'forward' ? SCREEN_WIDTH : -SCREEN_WIDTH;

    Animated.spring(slideAnim, {
      toValue: outTo,
      useNativeDriver: true,
      tension: 80,
      friction: 14,
    }).start(() => {
      setStep(nextStep);
      setError(null);
      slideAnim.setValue(inFrom);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 14,
      }).start();
    });
  };

  // ── Avatar picker ──────────────────────────────────────────────────────────

  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showError('Gallery permission is required to pick a photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  // ── Step 1 → 2 ─────────────────────────────────────────────────────────────

  const goStep2 = () => {
    if (!displayName.trim() || !username.trim()) {
      showError('Please fill in your display name and username.');
      triggerShake();
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    animateToStep(1, 'forward');
  };

  // ── Step 2 → 3 ─────────────────────────────────────────────────────────────

  const isEmailValid = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  const strength = getPasswordStrength(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const step2Valid = isEmailValid(email) && strength.score >= 2 && passwordsMatch;

  const goStep3 = () => {
    if (!isEmailValid(email)) {
      showError('Please enter a valid email address.');
      triggerShake();
      return;
    }
    if (strength.score < 2) {
      showError('Password is too weak. Try adding uppercase, numbers, or symbols.');
      triggerShake();
      return;
    }
    if (!passwordsMatch) {
      showError('Passwords do not match.');
      triggerShake();
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    animateToStep(2, 'forward');
  };

  // ── Step 3 — Register ──────────────────────────────────────────────────────

  const handleRegister = async () => {
    if (!agreed) {
      showError('Please agree to the Terms & Privacy Policy.');
      triggerShake();
      return;
    }
    try {
      setLoading(true);
      setError(null);
      await registerUser(
        email.trim().toLowerCase(),
        password,
        displayName.trim(),
        username.trim(),
        '',
        avatarUri ?? undefined,
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      animateToStep(3, 'forward');
    } catch (e: any) {
      setLoading(false);
      triggerShake();
      showError(getFriendlyErrorMessage(e));
    }
  };

  // ── Resend verification ────────────────────────────────────────────────────

  const handleResend = async () => {
    if (resendCooldown > 0 || !auth.currentUser) return;
    try {
      await sendEmailVerification(auth.currentUser);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setResendCooldown(60);
      cooldownRef.current = setInterval(() => {
        setResendCooldown(prev => {
          if (prev <= 1) {
            if (cooldownRef.current) clearInterval(cooldownRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (e: any) {
      showError(getFriendlyErrorMessage(e));
    }
  };

  // ── Step dots ──────────────────────────────────────────────────────────────

  const StepDots = () => (
    <View style={styles.dotsRow}>
      {[0, 1, 2, 3].map(i => (
        <View
          key={i}
          style={[
            styles.dot,
            i === step
              ? { width: 24, height: 8, backgroundColor: T.green, borderRadius: 4 }
              : { width: 8, height: 8, backgroundColor: T.border, borderRadius: 4 },
          ]}
        />
      ))}
    </View>
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.root, { backgroundColor: T.black }]}>
      <StatusBar barStyle="light-content" />

      {/* Decorative orbs */}
      <View style={[styles.orb1, { backgroundColor: T.green + '18' }]} />
      <View style={[styles.orb2, { backgroundColor: T.accent2 + '12' }]} />

      <Animated.View style={[styles.slideContainer, { transform: [{ translateX: slideAnim }] }]}>
        {step === 0 && <Step1Identity
          T={T} insets={insets}
          avatarUri={avatarUri} onPickAvatar={pickAvatar}
          displayName={displayName} setDisplayName={setDisplayName}
          username={username} setUsername={setUsername}
          displayNameFocused={displayNameFocused} setDisplayNameFocused={setDisplayNameFocused}
          usernameFocused={usernameFocused} setUsernameFocused={setUsernameFocused}
          shakeAnim={shakeAnim} error={error} errorAnim={errorAnim}
          onContinue={goStep2}
          onGoLogin={onGoLogin}
          StepDots={StepDots}
        />}

        {step === 1 && <Step2Account
          T={T} insets={insets}
          email={email} setEmail={setEmail}
          password={password} setPassword={setPassword}
          confirmPassword={confirmPassword} setConfirmPassword={setConfirmPassword}
          showPassword={showPassword} setShowPassword={setShowPassword}
          showConfirm={showConfirm} setShowConfirm={setShowConfirm}
          emailFocused={emailFocused} setEmailFocused={setEmailFocused}
          passwordFocused={passwordFocused} setPasswordFocused={setPasswordFocused}
          confirmFocused={confirmFocused} setConfirmFocused={setConfirmFocused}
          strength={strength} passwordsMatch={passwordsMatch} step2Valid={step2Valid}
          shakeAnim={shakeAnim} error={error} errorAnim={errorAnim}
          onContinue={goStep3}
          onBack={() => animateToStep(0, 'back')}
          StepDots={StepDots}
        />}

        {step === 2 && <Step3Legal
          T={T} insets={insets}
          agreed={agreed} setAgreed={setAgreed}
          loading={loading}
          legalModal={legalModal} setLegalModal={setLegalModal}
          shakeAnim={shakeAnim} error={error} errorAnim={errorAnim}
          onRegister={handleRegister}
          onBack={() => animateToStep(1, 'back')}
          StepDots={StepDots}
        />}

        {step === 3 && <Step4Verify
          T={T} insets={insets}
          email={email}
          envelopeAnim={envelopeAnim}
          resendCooldown={resendCooldown}
          onResend={handleResend}
          onGoLogin={onGoLogin}
          error={error} errorAnim={errorAnim}
        />}
      </Animated.View>
    </View>
  );
}

// ─── Step 1: Identity ─────────────────────────────────────────────────────────

function Step1Identity({
  T, insets, avatarUri, onPickAvatar,
  displayName, setDisplayName, username, setUsername,
  displayNameFocused, setDisplayNameFocused,
  usernameFocused, setUsernameFocused,
  shakeAnim, error, errorAnim, onContinue, onGoLogin, StepDots,
}: any) {
  const canContinue = displayName.trim().length > 0 && username.trim().length > 0;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Back to login + dots */}
        <View style={styles.topRow}>
          <TouchableOpacity onPress={onGoLogin} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={26} color={T.white} />
          </TouchableOpacity>
          <StepDots />
          <View style={{ width: 44 }} />
        </View>

        <Text style={[styles.stepTitle, { color: T.white }]}>Create Profile</Text>
        <Text style={[styles.stepSubtitle, { color: T.text }]}>How should we know you?</Text>

        {/* Avatar picker */}
        <TouchableOpacity onPress={onPickAvatar} style={styles.avatarWrap} activeOpacity={0.8}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
          ) : (
            <View style={[styles.avatarPlaceholder, { borderColor: T.green, backgroundColor: T.card }]}>
              <Ionicons name="camera-outline" size={32} color={T.green} />
              <Text style={[styles.avatarHint, { color: T.text }]}>Add Photo</Text>
            </View>
          )}
          <View style={[styles.avatarBadge, { backgroundColor: T.green }]}>
            <Ionicons name="camera" size={14} color="#000" />
          </View>
        </TouchableOpacity>

        <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
          {/* Display name */}
          <View style={[styles.inputPill, { backgroundColor: T.card, borderColor: displayNameFocused ? T.green : T.border }]}>
            <Ionicons name="person-outline" size={18} color={displayNameFocused ? T.green : T.text} />
            <TextInput
              style={[styles.inputText, { color: T.white }]}
              placeholder="Display name"
              placeholderTextColor={T.text + '70'}
              value={displayName}
              onChangeText={setDisplayName}
              onFocus={() => setDisplayNameFocused(true)}
              onBlur={() => setDisplayNameFocused(false)}
              autoCorrect={false}
              maxLength={40}
            />
          </View>

          {/* Username */}
          <View style={[styles.inputPill, { backgroundColor: T.card, borderColor: usernameFocused ? T.green : T.border, marginTop: 14 }]}>
            <Text style={{ color: usernameFocused ? T.green : T.text, fontSize: 16, fontWeight: '600' }}>@</Text>
            <TextInput
              style={[styles.inputText, { color: T.white }]}
              placeholder="username"
              placeholderTextColor={T.text + '70'}
              value={username}
              onChangeText={t => setUsername(t.replace(/\s/g, '').toLowerCase())}
              onFocus={() => setUsernameFocused(true)}
              onBlur={() => setUsernameFocused(false)}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={30}
            />
          </View>

          {/* Error */}
          {error && (
            <Animated.View style={[styles.errorPill, { backgroundColor: T.red + '18', borderColor: T.red + '40', opacity: errorAnim, transform: [{ scale: errorAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }] }]}>
              <Ionicons name="alert-circle" size={14} color={T.red} />
              <Text style={{ color: T.red, fontSize: 13, fontWeight: '600', flex: 1 }}>{error}</Text>
            </Animated.View>
          )}

          {/* Continue */}
          <TouchableOpacity onPress={onContinue} disabled={!canContinue} activeOpacity={0.85} style={[styles.btn, { marginTop: 24, opacity: canContinue ? 1 : 0.4 }]}>
            <LinearGradient colors={[T.green, '#0A84FF']} style={styles.btnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Text style={styles.btnText}>CONTINUE</Text>
              <Ionicons name="arrow-forward" size={20} color="#000" />
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Step 2: Account ──────────────────────────────────────────────────────────

function Step2Account({
  T, insets,
  email, setEmail, password, setPassword, confirmPassword, setConfirmPassword,
  showPassword, setShowPassword, showConfirm, setShowConfirm,
  emailFocused, setEmailFocused, passwordFocused, setPasswordFocused,
  confirmFocused, setConfirmFocused,
  strength, passwordsMatch, step2Valid,
  shakeAnim, error, errorAnim, onContinue, onBack, StepDots,
}: any) {
  const criteria = [
    { label: '8+ characters', met: password.length >= 8 },
    { label: 'Uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'Number', met: /[0-9]/.test(password) },
    { label: 'Special character', met: /[^A-Za-z0-9]/.test(password) },
  ];

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Back + dots */}
        <View style={styles.topRow}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={26} color={T.white} />
          </TouchableOpacity>
          <StepDots />
          <View style={{ width: 44 }} />
        </View>

        <Text style={[styles.stepTitle, { color: T.white }]}>Your Account</Text>
        <Text style={[styles.stepSubtitle, { color: T.text }]}>Secure your RunQuest account</Text>

        <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
          {/* Email */}
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

          {/* Password */}
          <View style={[styles.inputPill, { backgroundColor: T.card, borderColor: passwordFocused ? T.green : T.border, marginTop: 14 }]}>
            <Ionicons name="lock-closed-outline" size={18} color={passwordFocused ? T.green : T.text} />
            <TextInput
              style={[styles.inputText, { color: T.white }]}
              placeholder="Password"
              placeholderTextColor={T.text + '70'}
              value={password}
              onChangeText={setPassword}
              onFocus={() => setPasswordFocused(true)}
              onBlur={() => setPasswordFocused(false)}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={T.text} />
            </TouchableOpacity>
          </View>

          {/* Strength bar */}
          {password.length > 0 && (
            <View style={styles.strengthWrap}>
              <View style={styles.strengthBar}>
                {[0, 1, 2, 3].map(i => (
                  <View
                    key={i}
                    style={[
                      styles.strengthSegment,
                      { backgroundColor: i < strength.score ? strength.color : T.border },
                    ]}
                  />
                ))}
              </View>
              {strength.label ? (
                <Text style={[styles.strengthLabel, { color: strength.color }]}>{strength.label}</Text>
              ) : null}
            </View>
          )}

          {/* Criteria checklist */}
          {password.length > 0 && (
            <View style={[styles.criteriaBox, { backgroundColor: T.card, borderColor: T.border }]}>
              {criteria.map(c => (
                <View key={c.label} style={styles.criteriaRow}>
                  <Ionicons
                    name={c.met ? 'checkmark-circle' : 'ellipse-outline'}
                    size={16}
                    color={c.met ? T.green : T.text}
                  />
                  <Text style={[styles.criteriaText, { color: c.met ? T.white : T.text }]}>{c.label}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Confirm password */}
          <View style={[styles.inputPill, { backgroundColor: T.card, borderColor: confirmFocused ? T.green : T.border, marginTop: 14 }]}>
            <Ionicons name="lock-closed-outline" size={18} color={confirmFocused ? T.green : T.text} />
            <TextInput
              style={[styles.inputText, { color: T.white }]}
              placeholder="Confirm password"
              placeholderTextColor={T.text + '70'}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              onFocus={() => setConfirmFocused(true)}
              onBlur={() => setConfirmFocused(false)}
              secureTextEntry={!showConfirm}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {confirmPassword.length > 0 && (
              <Ionicons
                name={passwordsMatch ? 'checkmark-circle' : 'close-circle'}
                size={20}
                color={passwordsMatch ? T.green : T.red}
              />
            )}
            <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={20} color={T.text} />
            </TouchableOpacity>
          </View>

          {/* Error */}
          {error && (
            <Animated.View style={[styles.errorPill, { backgroundColor: T.red + '18', borderColor: T.red + '40', opacity: errorAnim, transform: [{ scale: errorAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }] }]}>
              <Ionicons name="alert-circle" size={14} color={T.red} />
              <Text style={{ color: T.red, fontSize: 13, fontWeight: '600', flex: 1 }}>{error}</Text>
            </Animated.View>
          )}

          {/* Continue */}
          <TouchableOpacity onPress={onContinue} disabled={!step2Valid} activeOpacity={0.85} style={[styles.btn, { marginTop: 24, opacity: step2Valid ? 1 : 0.4 }]}>
            <LinearGradient colors={[T.green, '#0A84FF']} style={styles.btnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Text style={styles.btnText}>CONTINUE</Text>
              <Ionicons name="arrow-forward" size={20} color="#000" />
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Step 3: Legal ────────────────────────────────────────────────────────────

function Step3Legal({
  T, insets, agreed, setAgreed, loading,
  legalModal, setLegalModal,
  shakeAnim, error, errorAnim, onRegister, onBack, StepDots,
}: any) {
  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Back + dots */}
        <View style={styles.topRow}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn} disabled={loading}>
            <Ionicons name="chevron-back" size={26} color={T.white} />
          </TouchableOpacity>
          <StepDots />
          <View style={{ width: 44 }} />
        </View>

        {/* Shield icon */}
        <View style={styles.shieldWrap}>
          <LinearGradient colors={[T.green, '#0A84FF']} style={styles.shieldGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <Ionicons name="shield-checkmark" size={52} color="#000" />
          </LinearGradient>
          <View style={[styles.shieldGlow, { borderColor: T.green + '30' }]} />
        </View>

        <Text style={[styles.stepTitle, { color: T.white, textAlign: 'center' }]}>Almost there!</Text>
        <Text style={[styles.stepSubtitle, { color: T.text, textAlign: 'center', marginBottom: 32 }]}>
          Review our terms before joining
        </Text>

        <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
          {/* Terms card */}
          <TouchableOpacity
            onPress={() => setLegalModal('terms')}
            style={[styles.legalCard, { backgroundColor: T.card, borderColor: T.border }]}
            activeOpacity={0.75}
          >
            <View style={[styles.legalIconWrap, { backgroundColor: T.green + '18' }]}>
              <Ionicons name="document-text-outline" size={22} color={T.green} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.legalCardTitle, { color: T.white }]}>Terms of Service</Text>
              <Text style={[styles.legalCardSub, { color: T.text }]}>Tap to read</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={T.text} />
          </TouchableOpacity>

          {/* Privacy card */}
          <TouchableOpacity
            onPress={() => setLegalModal('privacy')}
            style={[styles.legalCard, { backgroundColor: T.card, borderColor: T.border, marginTop: 12 }]}
            activeOpacity={0.75}
          >
            <View style={[styles.legalIconWrap, { backgroundColor: T.accent2 + '18' }]}>
              <Ionicons name="lock-closed-outline" size={22} color={T.accent2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.legalCardTitle, { color: T.white }]}>Privacy Policy</Text>
              <Text style={[styles.legalCardSub, { color: T.text }]}>Tap to read</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={T.text} />
          </TouchableOpacity>

          {/* Agree checkbox */}
          <TouchableOpacity
            onPress={() => { setAgreed(!agreed); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
            style={styles.checkRow}
            activeOpacity={0.8}
          >
            <View style={[styles.checkbox, { borderColor: agreed ? T.green : T.border, backgroundColor: agreed ? T.green : 'transparent' }]}>
              {agreed && <Ionicons name="checkmark" size={14} color="#000" />}
            </View>
            <Text style={[styles.checkLabel, { color: T.text }]}>
              I agree to the{' '}
              <Text style={{ color: T.white, fontWeight: '700' }}>Terms & Privacy Policy</Text>
            </Text>
          </TouchableOpacity>

          {/* Error */}
          {error && (
            <Animated.View style={[styles.errorPill, { backgroundColor: T.red + '18', borderColor: T.red + '40', opacity: errorAnim, transform: [{ scale: errorAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }] }]}>
              <Ionicons name="alert-circle" size={14} color={T.red} />
              <Text style={{ color: T.red, fontSize: 13, fontWeight: '600', flex: 1 }}>{error}</Text>
            </Animated.View>
          )}

          {/* Create account */}
          <TouchableOpacity onPress={onRegister} disabled={!agreed || loading} activeOpacity={0.85} style={[styles.btn, { marginTop: 24, opacity: agreed && !loading ? 1 : 0.4 }]}>
            <LinearGradient colors={[T.green, '#0A84FF']} style={styles.btnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              {loading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <>
                  <Text style={styles.btnText}>CREATE ACCOUNT</Text>
                  <Ionicons name="rocket-outline" size={20} color="#000" />
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>

      {/* Legal WebView modal */}
      <Modal visible={legalModal !== null} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modalRoot, { backgroundColor: T.black }]}>
          <View style={[styles.modalHeader, { borderBottomColor: T.border }]}>
            <Text style={[styles.modalTitle, { color: T.white }]}>
              {legalModal === 'terms' ? 'Terms of Service' : 'Privacy Policy'}
            </Text>
            <TouchableOpacity onPress={() => setLegalModal(null)} style={styles.modalClose}>
              <Ionicons name="close" size={24} color={T.white} />
            </TouchableOpacity>
          </View>
          <WebView
            source={{ html: legalModal === 'terms' ? TERMS_HTML : PRIVACY_HTML }}
            style={{ flex: 1, backgroundColor: T.black }}
          />
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ─── Step 4: Email Verification ───────────────────────────────────────────────

function Step4Verify({
  T, insets, email, envelopeAnim, resendCooldown, onResend, onGoLogin, error, errorAnim,
}: any) {
  return (
    <View style={[styles.flex, styles.verifyRoot, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 }]}>
      {/* Animated envelope */}
      <Animated.View style={[styles.envelopeWrap, {
        transform: [
          { scale: envelopeAnim.interpolate({ inputRange: [0, 0.6, 0.8, 1], outputRange: [0.3, 1.15, 0.95, 1] }) },
          { translateY: envelopeAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) },
        ],
        opacity: envelopeAnim,
      }]}>
        <LinearGradient colors={[T.green, '#0A84FF']} style={styles.envelopeGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <Ionicons name="mail-unread" size={56} color="#000" />
        </LinearGradient>
        <View style={[styles.envelopeGlow, { borderColor: T.green + '30' }]} />
      </Animated.View>

      <Text style={[styles.verifyTitle, { color: T.white }]}>Verify Your Email</Text>
      <Text style={[styles.verifySubtitle, { color: T.text }]}>
        We sent a verification link to
      </Text>
      <Text style={[styles.verifyEmail, { color: T.white }]}>{email}</Text>

      <Text style={[styles.verifyHint, { color: T.text }]}>
        Click the link in the email to activate your account. Check your spam folder if you don't see it.
      </Text>

      {/* Error */}
      {error && (
        <Animated.View style={[styles.errorPill, { backgroundColor: T.red + '18', borderColor: T.red + '40', marginHorizontal: 28, opacity: errorAnim, transform: [{ scale: errorAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }] }]}>
          <Ionicons name="alert-circle" size={14} color={T.red} />
          <Text style={{ color: T.red, fontSize: 13, fontWeight: '600', flex: 1 }}>{error}</Text>
        </Animated.View>
      )}

      {/* Open email app */}
      <TouchableOpacity
        onPress={() => Linking.openURL('mailto:')}
        activeOpacity={0.85}
        style={[styles.btn, { marginHorizontal: 28, marginTop: 32 }]}
      >
        <LinearGradient colors={[T.green, '#0A84FF']} style={styles.btnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
          <Ionicons name="mail-open-outline" size={20} color="#000" />
          <Text style={styles.btnText}>OPEN EMAIL APP</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* Resend */}
      <TouchableOpacity
        onPress={onResend}
        disabled={resendCooldown > 0}
        activeOpacity={0.75}
        style={[styles.resendBtn, { borderColor: T.border, opacity: resendCooldown > 0 ? 0.5 : 1, marginHorizontal: 28 }]}
      >
        <Ionicons name="refresh-outline" size={18} color={T.text} />
        <Text style={[styles.resendText, { color: T.text }]}>
          {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Email'}
        </Text>
      </TouchableOpacity>

      {/* Back to login */}
      <TouchableOpacity onPress={onGoLogin} style={styles.backToLoginLink} activeOpacity={0.7}>
        <Text style={[styles.backToLoginLinkText, { color: T.text }]}>
          Back to{' '}
          <Text style={{ color: T.green, fontWeight: '700' }}>Login</Text>
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  slideContainer: { flex: 1 },
  scroll: { paddingHorizontal: 28 },

  // Orbs
  orb1: { position: 'absolute', top: -100, right: -80, width: 300, height: 300, borderRadius: 150 },
  orb2: { position: 'absolute', bottom: 100, left: -100, width: 250, height: 250, borderRadius: 125 },

  // Step dots
  dotsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 32 },
  dot: {},

  // Top row (back + dots)
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -8 },

  // Typography
  stepTitle: { fontSize: 30, fontWeight: '900', letterSpacing: -0.5, marginBottom: 6 },
  stepSubtitle: { fontSize: 15, opacity: 0.7, marginBottom: 28 },

  // Avatar
  avatarWrap: { alignSelf: 'center', marginBottom: 32, position: 'relative' },
  avatarImage: { width: 110, height: 110, borderRadius: 55 },
  avatarPlaceholder: {
    width: 110, height: 110, borderRadius: 55,
    borderWidth: 2, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  avatarHint: { fontSize: 12, fontWeight: '600' },
  avatarBadge: {
    position: 'absolute', bottom: 2, right: 2,
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },

  // Inputs
  inputPill: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 18, borderWidth: 1.5,
    paddingHorizontal: 18, gap: 12, height: 58,
  },
  inputText: { flex: 1, fontSize: 16 },

  // Password strength
  strengthWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, marginBottom: 4 },
  strengthBar: { flex: 1, flexDirection: 'row', gap: 4 },
  strengthSegment: { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel: { fontSize: 12, fontWeight: '700', minWidth: 40, textAlign: 'right' },

  // Criteria
  criteriaBox: {
    borderRadius: 14, borderWidth: 1,
    padding: 14, gap: 8, marginBottom: 4,
  },
  criteriaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  criteriaText: { fontSize: 13 },

  // Error pill
  errorPill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 14, borderWidth: 1, padding: 12, marginTop: 12,
  },

  // Button
  btn: { borderRadius: 18, overflow: 'hidden' },
  btnGrad: { height: 62, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  btnText: { color: '#000', fontWeight: '900', fontSize: 17, letterSpacing: 0.5 },

  // Legal cards
  legalCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 18, borderWidth: 1.5, padding: 18,
  },
  legalIconWrap: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  legalCardTitle: { fontSize: 16, fontWeight: '700' },
  legalCardSub: { fontSize: 13, marginTop: 2 },

  // Checkbox
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 20 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  checkLabel: { flex: 1, fontSize: 14, lineHeight: 20 },

  // Shield
  shieldWrap: { alignSelf: 'center', marginBottom: 20, position: 'relative' },
  shieldGrad: { width: 100, height: 100, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  shieldGlow: { position: 'absolute', top: -8, left: -8, right: -8, bottom: -8, borderRadius: 40, borderWidth: 1.5 },

  // Legal modal
  modalRoot: { flex: 1 },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  modalClose: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

  // Step 4 — Verify
  verifyRoot: { alignItems: 'center', paddingHorizontal: 28 },
  envelopeWrap: { marginBottom: 28, position: 'relative' },
  envelopeGrad: { width: 120, height: 120, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  envelopeGlow: { position: 'absolute', top: -10, left: -10, right: -10, bottom: -10, borderRadius: 46, borderWidth: 1.5 },
  verifyTitle: { fontSize: 30, fontWeight: '900', letterSpacing: -0.5, marginBottom: 10 },
  verifySubtitle: { fontSize: 15, opacity: 0.7 },
  verifyEmail: { fontSize: 16, fontWeight: '700', marginTop: 4, marginBottom: 16, textAlign: 'center' },
  verifyHint: { fontSize: 14, textAlign: 'center', lineHeight: 20, opacity: 0.7, marginBottom: 8 },
  resendBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 18, borderWidth: 1.5, height: 54, marginTop: 12, width: '100%',
  },
  resendText: { fontSize: 15, fontWeight: '600' },
  backToLoginLink: { marginTop: 24 },
  backToLoginLinkText: { fontSize: 15 },
});
