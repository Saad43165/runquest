import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Animated,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
  StyleSheet, Dimensions, StatusBar, Modal, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/utils/ThemeContext';
import { registerUser } from '../services/authService';
import { getFriendlyErrorMessage } from '../utils/ErrorUtils';
import * as Haptics from 'expo-haptics';
import { TERMS_HTML, PRIVACY_HTML } from '../constants/LegalContent';

const { width } = Dimensions.get('window');

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

export default function SignUpScreen({ onGoLogin }: { onGoLogin: () => void }) {
  const { T } = useTheme();
  const insets = useSafeAreaInsets();

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [image, setImage] = useState<string | null>(null);

  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [nameFocused, setNameFocused] = useState(false);
  const [usernameFocused, setUsernameFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passFocused, setPassFocused] = useState(false);
  const [confirmFocused, setConfirmFocused] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'terms' | 'privacy'>('terms');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const errorAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
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

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const onSignUp = async () => {
    setError(null);
    if (!email || !password || !displayName || !username) {
      showError('Please fill in all fields.');
      triggerShake();
      return;
    }
    if (password !== confirmPassword) {
      showError('Passwords do not match.');
      triggerShake();
      return;
    }
    if (!agreed) {
      showError('You must agree to the Terms & Privacy Policy.');
      triggerShake();
      return;
    }
    try {
      setLoading(true);
      await registerUser(email.trim().toLowerCase(), password, displayName, username, '', image || undefined);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      setLoading(false);
      triggerShake();
      showError(getFriendlyErrorMessage(e));
    }
  };

  const openLegal = (type: 'terms' | 'privacy') => {
    setModalType(type);
    setModalVisible(true);
  };

  const strength = getPasswordStrength(password);
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  return (
    <View style={{ flex: 1, backgroundColor: T.black }}>
      <StatusBar barStyle="light-content" />
      {/* Decorative orbs */}
      <View style={[styles.orb1, { backgroundColor: T.green + '18' }]} />
      <View style={[styles.orb2, { backgroundColor: T.accent2 + '12' }]} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back button */}
          <TouchableOpacity onPress={onGoLogin} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={26} color={T.white} />
          </TouchableOpacity>

          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            {/* Header */}
            <View style={{ alignItems: 'center', marginBottom: 28 }}>
              <Text style={[styles.title, { color: T.white }]}>Create Account</Text>
              <Text style={[styles.subtitle, { color: T.text }]}>Join the quest and start mapping</Text>
            </View>

            {/* Avatar Picker */}
            <TouchableOpacity onPress={pickImage} style={styles.avatarWrap} activeOpacity={0.8}>
              {image ? (
                <Image source={{ uri: image }} style={styles.avatarImage} />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: T.card, borderColor: T.border }]}>
                  <Ionicons name="camera-outline" size={28} color={T.text} />
                  <Text style={{ color: T.text, fontSize: 11, fontWeight: '700', marginTop: 4 }}>Add Photo</Text>
                </View>
              )}
              <View style={[styles.avatarBadge, { backgroundColor: T.green }]}>
                <Ionicons name="add" size={14} color="#000" />
              </View>
            </TouchableOpacity>

            {/* Name */}
            <Animated.View style={[styles.inputWrap, { transform: [{ translateX: shakeAnim }] }]}>
              <View style={[styles.inputPill, { backgroundColor: T.card, borderColor: nameFocused ? T.green : T.border }]}>
                <Ionicons name="person-outline" size={18} color={nameFocused ? T.green : T.text} />
                <TextInput
                  style={[styles.inputText, { color: T.white }]}
                  placeholder="Full name"
                  placeholderTextColor={T.text + '70'}
                  value={displayName}
                  onChangeText={setDisplayName}
                  onFocus={() => setNameFocused(true)}
                  onBlur={() => setNameFocused(false)}
                />
              </View>
            </Animated.View>

            {/* Username */}
            <Animated.View style={[styles.inputWrap, { transform: [{ translateX: shakeAnim }] }]}>
              <View style={[styles.inputPill, { backgroundColor: T.card, borderColor: usernameFocused ? T.green : T.border }]}>
                <Ionicons name="at-outline" size={18} color={usernameFocused ? T.green : T.text} />
                <TextInput
                  style={[styles.inputText, { color: T.white }]}
                  placeholder="Username"
                  placeholderTextColor={T.text + '70'}
                  value={username}
                  onChangeText={setUsername}
                  onFocus={() => setUsernameFocused(true)}
                  onBlur={() => setUsernameFocused(false)}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </Animated.View>

            {/* Email */}
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

            {/* Password */}
            <Animated.View style={[styles.inputWrap, { transform: [{ translateX: shakeAnim }] }]}>
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

            {/* Password strength */}
            {password.length > 0 && (
              <View style={styles.strengthWrap}>
                {/* Strength bar */}
                <View style={styles.strengthBarRow}>
                  {[0, 1, 2, 3].map(i => (
                    <View
                      key={i}
                      style={[styles.strengthSegment, { backgroundColor: i < strength.score ? strength.color : T.border }]}
                    />
                  ))}
                  {strength.label ? (
                    <Text style={[styles.strengthLabel, { color: strength.color }]}>{strength.label}</Text>
                  ) : null}
                </View>
                {/* Criteria */}
                <View style={styles.criteriaWrap}>
                  {[
                    { label: 'At least 8 characters', met: password.length >= 8 },
                    { label: 'One uppercase letter', met: /[A-Z]/.test(password) },
                    { label: 'One number', met: /[0-9]/.test(password) },
                    { label: 'One special character (!@#$...)', met: /[^A-Za-z0-9]/.test(password) },
                  ].map((c, i) => (
                    <View key={i} style={styles.criteriaRow}>
                      <Ionicons name={c.met ? 'checkmark-circle' : 'close-circle'} size={13} color={c.met ? '#32D74B' : T.text + '60'} />
                      <Text style={{ color: c.met ? '#32D74B' : T.text + '80', fontSize: 12 }}>{c.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Confirm Password */}
            <Animated.View style={[styles.inputWrap, { transform: [{ translateX: shakeAnim }] }]}>
              <View style={[styles.inputPill, { backgroundColor: T.card, borderColor: confirmFocused ? T.green : (passwordsMismatch ? T.red : T.border) }]}>
                <Ionicons name="lock-closed-outline" size={18} color={confirmFocused ? T.green : T.text} />
                <TextInput
                  style={[styles.inputText, { color: T.white, flex: 1 }]}
                  placeholder="Confirm password"
                  placeholderTextColor={T.text + '70'}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  onFocus={() => setConfirmFocused(true)}
                  onBlur={() => setConfirmFocused(false)}
                  secureTextEntry={!showConfirmPass}
                />
                {confirmPassword.length > 0 ? (
                  <Ionicons
                    name={passwordsMatch ? 'checkmark-circle' : 'close-circle'}
                    size={18}
                    color={passwordsMatch ? '#32D74B' : T.red}
                  />
                ) : (
                  <TouchableOpacity onPress={() => setShowConfirmPass(v => !v)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name={showConfirmPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={T.text} />
                  </TouchableOpacity>
                )}
              </View>
            </Animated.View>

            {/* Error */}
            {error && (
              <Animated.View style={[styles.errorPill, { backgroundColor: T.red + '18', borderColor: T.red + '40', opacity: errorAnim, transform: [{ scale: errorAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }] }]}>
                <Ionicons name="alert-circle" size={14} color={T.red} />
                <Text style={{ color: T.red, fontSize: 13, fontWeight: '600', flex: 1 }}>{error}</Text>
              </Animated.View>
            )}

            {/* Terms checkbox */}
            <TouchableOpacity style={styles.checkRow} onPress={() => setAgreed(!agreed)} activeOpacity={0.8}>
              <View style={[styles.checkbox, { borderColor: agreed ? T.green : T.border, backgroundColor: agreed ? T.green : 'transparent' }]}>
                {agreed && <Ionicons name="checkmark" size={13} color="#000" />}
              </View>
              <Text style={{ color: T.text, fontSize: 13, flex: 1 }}>
                I agree to the{' '}
                <Text style={{ color: T.green, fontWeight: '700' }} onPress={() => openLegal('terms')}>Terms</Text>
                {' '}and{' '}
                <Text style={{ color: T.green, fontWeight: '700' }} onPress={() => openLegal('privacy')}>Privacy Policy</Text>
              </Text>
            </TouchableOpacity>

            {/* Sign up button */}
            <TouchableOpacity onPress={onSignUp} disabled={loading} activeOpacity={0.85} style={styles.signupBtn}>
              <LinearGradient colors={[T.green, '#00C6A0']} style={styles.signupGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                {loading ? <ActivityIndicator color="#000" /> : (
                  <>
                    <Text style={styles.signupBtnText}>CREATE ACCOUNT</Text>
                    <Ionicons name="arrow-forward" size={20} color="#000" />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Login link */}
            <View style={styles.loginRow}>
              <Text style={{ color: T.text, fontSize: 15 }}>Already have an account?</Text>
              <TouchableOpacity onPress={onGoLogin}>
                <Text style={{ color: T.green, fontWeight: '800', fontSize: 15 }}> Log In</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Legal Modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="overFullScreen">
        <View style={{ flex: 1, backgroundColor: '#FFF', paddingTop: Platform.OS === 'ios' ? 60 : 20 }}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{modalType === 'terms' ? 'Terms of Service' : 'Privacy Policy'}</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#000" />
            </TouchableOpacity>
          </View>
          <WebView
            source={{ html: modalType === 'terms' ? TERMS_HTML : PRIVACY_HTML }}
            style={{ flex: 1 }}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 28 },
  orb1: { position: 'absolute', top: -100, right: -80, width: 300, height: 300, borderRadius: 150 },
  orb2: { position: 'absolute', bottom: 100, left: -100, width: 250, height: 250, borderRadius: 125 },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -8, marginBottom: 8 },
  title: { fontSize: 32, fontWeight: '900', letterSpacing: -0.5 },
  subtitle: { fontSize: 15, marginTop: 4, opacity: 0.7 },
  avatarWrap: { alignSelf: 'center', marginBottom: 28, position: 'relative' },
  avatarPlaceholder: { width: 96, height: 96, borderRadius: 48, borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: 96, height: 96, borderRadius: 48 },
  avatarBadge: { position: 'absolute', bottom: 2, right: 2, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  inputWrap: { marginBottom: 12 },
  inputPill: { flexDirection: 'row', alignItems: 'center', borderRadius: 18, borderWidth: 1.5, paddingHorizontal: 18, gap: 12, height: 58 },
  inputText: { flex: 1, fontSize: 16 },
  strengthWrap: { marginBottom: 14, paddingHorizontal: 4 },
  strengthBarRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  strengthSegment: { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel: { fontSize: 12, fontWeight: '800', marginLeft: 4 },
  criteriaWrap: { gap: 4 },
  criteriaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  errorPill: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, borderWidth: 1, padding: 12, marginBottom: 12 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20, marginTop: 4 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  signupBtn: { borderRadius: 18, overflow: 'hidden', marginBottom: 28 },
  signupGrad: { height: 62, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  signupBtnText: { color: '#000', fontWeight: '900', fontSize: 17, letterSpacing: 0.5 },
  loginRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  closeBtn: { padding: 4 },
});
