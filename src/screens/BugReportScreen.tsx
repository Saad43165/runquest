import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Animated, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/utils/ThemeContext';
import { OrbBackground } from '../components/OrbBackground';
import * as Haptics from 'expo-haptics';

const FORMSPREE_ENDPOINT = 'https://formspree.io/f/mwvaenop';

async function submitReport(params: {
  bugType: string; severity: string; description: string; steps: string;
}): Promise<void> {
  const res = await fetch(FORMSPREE_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      _subject: `[RunQuest Bug] ${params.bugType} — ${params.severity}`,
      bug_type: params.bugType,
      severity: params.severity,
      description: params.description,
      steps: params.steps || 'Not provided',
      app_version: '1.0.4',
    }),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d?.error || `HTTP ${res.status}`);
  }
}

const BUG_TYPES = [
  { id: 'crash',       label: 'App Crash',         icon: 'warning-outline' as const },
  { id: 'gps',         label: 'GPS / Location',     icon: 'navigate-outline' as const },
  { id: 'territory',   label: 'Territory / Map',    icon: 'map-outline' as const },
  { id: 'ui',          label: 'UI / Display',       icon: 'phone-portrait-outline' as const },
  { id: 'login',       label: 'Login / Account',    icon: 'person-outline' as const },
  { id: 'performance', label: 'Slow / Performance', icon: 'speedometer-outline' as const },
  { id: 'music',       label: 'Music Player',       icon: 'musical-notes-outline' as const },
  { id: 'other',       label: 'Other',              icon: 'ellipsis-horizontal-outline' as const },
];

const SEVERITY = [
  { id: 'low',    label: 'Minor',    desc: 'Small visual glitch',     color: '#32D74B', icon: 'checkmark-circle-outline' as const },
  { id: 'medium', label: 'Moderate', desc: 'Feature not working',     color: '#FF9F0A', icon: 'alert-circle-outline' as const },
  { id: 'high',   label: 'Critical', desc: 'App crashes / data loss', color: '#FF453A', icon: 'warning-outline' as const },
];

export default function BugReportScreen() {
  const { T } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [severity, setSeverity] = useState('medium');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState('');
  const [sending, setSending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [descFocused, setDescFocused] = useState(false);
  const [stepsFocused, setStepsFocused] = useState(false);
  const successAnim = useRef(new Animated.Value(0)).current;

  const toggleType = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedTypes(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
  };

  const canSubmit = selectedTypes.length > 0 && description.trim().length > 10 && !sending;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSending(true);
    const typeLabels = selectedTypes.map(id => BUG_TYPES.find(b => b.id === id)?.label ?? id).join(', ');
    const severityLabel = SEVERITY.find(s => s.id === severity)?.label ?? severity;
    try {
      await submitReport({ bugType: typeLabels, severity: severityLabel, description: description.trim(), steps: steps.trim() });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSubmitted(true);
      Animated.spring(successAnim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 8 }).start();
    } catch {
      setSending(false);
      Alert.alert('Send Failed', 'Could not send the report. Please check your connection and try again.', [{ text: 'OK' }]);
    }
  };

  // ── Success ──────────────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <View style={{ flex: 1, backgroundColor: T.black }}>
        <OrbBackground />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <Animated.View style={{ alignItems: 'center', width: '100%', opacity: successAnim, transform: [{ scale: successAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }] }}>
            <View style={{ width: 88, height: 88, borderRadius: 28, backgroundColor: T.green + '20', borderWidth: 1.5, borderColor: T.green + '50', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
              <Ionicons name="checkmark-circle" size={48} color={T.green} />
            </View>
            <Text style={{ color: T.white, fontSize: 26, fontWeight: '900', textAlign: 'center', marginBottom: 12 }}>Report Submitted</Text>
            <Text style={{ color: T.text, fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 36 }}>
              Thank you for helping improve RunQuest.{'\n'}We'll look into this as soon as possible.
            </Text>
            <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.85} style={{ width: '100%', borderRadius: 16, overflow: 'hidden' }}>
              <LinearGradient colors={[T.green, T.green]} style={{ paddingVertical: 16, alignItems: 'center' }}>
                <Text style={{ color: '#000', fontWeight: '900', fontSize: 16 }}>Done</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>
    );
  }

  // ── Form ─────────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: T.black }}>
      <OrbBackground />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }} keyboardShouldPersistTaps="handled">

          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingTop: insets.top + 16, paddingHorizontal: 16, paddingBottom: 20 }}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.iconBtn, { backgroundColor: T.card, borderColor: T.border }]}>
              <Ionicons name="arrow-back" size={20} color={T.white} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={{ color: T.white, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 }}>Report a Bug</Text>
              <Text style={{ color: T.text, fontSize: 12, marginTop: 2 }}>Help us improve RunQuest</Text>
            </View>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: T.red + '18', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="bug-outline" size={20} color={T.red} />
            </View>
          </View>

          <View style={{ paddingHorizontal: 16, gap: 20 }}>

            {/* Instructions */}
            <View style={{ backgroundColor: T.card, borderRadius: 14, borderWidth: 1, borderColor: T.border, padding: 14, flexDirection: 'row', gap: 10 }}>
              <Ionicons name="information-circle-outline" size={18} color={T.accent2} style={{ marginTop: 1 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: T.white, fontSize: 13, fontWeight: '700', marginBottom: 4 }}>How to submit a report</Text>
                <Text style={{ color: T.text, fontSize: 12, lineHeight: 18 }}>
                  1. Select the issue type{'\n'}
                  2. Choose severity level{'\n'}
                  3. Describe what happened{'\n'}
                  4. Tap Submit — we'll fix it!
                </Text>
              </View>
            </View>

            {/* Bug type — grid layout */}
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={[styles.label, { color: T.white }]}>STEP 1 — ISSUE TYPE <Text style={{ color: T.red }}>*</Text></Text>
                {selectedTypes.length === 0
                  ? <Text style={{ color: T.red, fontSize: 11, fontWeight: '600' }}>Select at least one</Text>
                  : <Text style={{ color: T.green, fontSize: 11, fontWeight: '600' }}>✓ {selectedTypes.length} selected</Text>
                }
              </View>
              <Text style={{ color: T.text, fontSize: 12, marginBottom: 12 }}>Tap all that apply to your issue</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {BUG_TYPES.map(type => {
                  const sel = selectedTypes.includes(type.id);
                  return (
                    <TouchableOpacity
                      key={type.id}
                      onPress={() => toggleType(type.id)}
                      activeOpacity={0.8}
                      style={[styles.typeChip, {
                        backgroundColor: sel ? T.green + '22' : T.card,
                        borderColor: sel ? T.green : T.border,
                        borderWidth: sel ? 1.5 : 1,
                      }]}
                    >
                      <View style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: sel ? T.green + '25' : T.border, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name={type.icon} size={13} color={sel ? T.green : T.text} />
                      </View>
                      <Text style={{ color: sel ? T.white : T.text, fontSize: 12, fontWeight: sel ? '700' : '500', flex: 1 }}>{type.label}</Text>
                      {sel && <Ionicons name="checkmark-circle" size={16} color={T.green} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Severity */}
            <View>
              <Text style={[styles.label, { color: T.white }]}>STEP 2 — SEVERITY <Text style={{ color: T.red }}>*</Text></Text>
              <Text style={{ color: T.text, fontSize: 12, marginBottom: 10 }}>How much does this affect your experience?</Text>
              <View style={{ gap: 8 }}>
                {SEVERITY.map(s => {
                  const sel = severity === s.id;
                  return (
                    <TouchableOpacity
                      key={s.id}
                      onPress={() => { setSeverity(s.id); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                      activeOpacity={0.85}
                      style={[styles.severityRow, {
                        backgroundColor: sel ? s.color + '18' : T.card,
                        borderColor: sel ? s.color : T.border,
                        borderWidth: sel ? 1.5 : 1,
                      }]}
                    >
                      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: s.color + (sel ? '25' : '15'), alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name={s.icon} size={20} color={s.color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: sel ? T.white : T.text, fontSize: 15, fontWeight: '800' }}>{s.label}</Text>
                        <Text style={{ color: sel ? 'rgba(255,255,255,0.6)' : T.text, fontSize: 12, marginTop: 2 }}>{s.desc}</Text>
                      </View>
                      <View style={[styles.radio, { borderColor: sel ? s.color : T.border }]}>
                        {sel && <View style={[styles.radioDot, { backgroundColor: s.color }]} />}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Description */}
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={[styles.label, { color: T.white }]}>STEP 3 — DESCRIBE THE ISSUE <Text style={{ color: T.red }}>*</Text></Text>
                {description.trim().length === 0
                  ? <Text style={{ color: T.red, fontSize: 11, fontWeight: '600' }}>Required</Text>
                  : description.trim().length < 10
                  ? <Text style={{ color: '#FF9F0A', fontSize: 11, fontWeight: '600' }}>Too short</Text>
                  : <Text style={{ color: T.green, fontSize: 11, fontWeight: '600' }}>✓ Good</Text>
                }
              </View>
              <View style={[styles.textArea, { backgroundColor: T.card, borderColor: descFocused ? T.green : T.border }]}>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  onFocus={() => setDescFocused(true)}
                  onBlur={() => setDescFocused(false)}
                  style={{ color: T.white, fontSize: 14, minHeight: 110, textAlignVertical: 'top', lineHeight: 22 }}
                  placeholder="What happened? What did you expect to happen?"
                  placeholderTextColor={T.text}
                  multiline
                  maxLength={1000}
                />
                <Text style={{ color: description.length > 900 ? T.red : T.text, fontSize: 10, textAlign: 'right', marginTop: 6 }}>{description.length}/1000</Text>
              </View>
            </View>

            {/* Steps */}
            <View>
              <Text style={[styles.label, { color: T.white }]}>STEP 4 — STEPS TO REPRODUCE <Text style={{ color: T.text, fontWeight: '500', letterSpacing: 0 }}>(optional but helpful)</Text></Text>
              <Text style={{ color: T.text, fontSize: 12, marginBottom: 10 }}>e.g. "1. Open Run screen 2. Tap Start 3. App crashes"</Text>
              <View style={[styles.textArea, { backgroundColor: T.card, borderColor: stepsFocused ? T.green : T.border }]}>
                <TextInput
                  value={steps}
                  onChangeText={setSteps}
                  onFocus={() => setStepsFocused(true)}
                  onBlur={() => setStepsFocused(false)}
                  style={{ color: T.white, fontSize: 14, minHeight: 80, textAlignVertical: 'top', lineHeight: 22 }}
                  placeholder={'1. Open the app\n2. Go to...\n3. Tap...'}
                  placeholderTextColor={T.text}
                  multiline
                  maxLength={500}
                />
              </View>
            </View>

            {/* What's needed hint */}
            {!canSubmit && !sending && (
              <View style={{ backgroundColor: '#FF453A12', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#FF453A30', flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                <Ionicons name="alert-circle-outline" size={16} color="#FF453A" style={{ marginTop: 1 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#FF453A', fontSize: 12, fontWeight: '700', marginBottom: 3 }}>To submit, you need:</Text>
                  {selectedTypes.length === 0 && <Text style={{ color: '#FF453A', fontSize: 12 }}>• Select at least one issue type</Text>}
                  {description.trim().length < 10 && <Text style={{ color: '#FF453A', fontSize: 12 }}>• Write a description (min 10 characters)</Text>}
                </View>
              </View>
            )}

            {/* Submit */}
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={!canSubmit}
              activeOpacity={0.85}
              style={{ borderRadius: 16, overflow: 'hidden', opacity: canSubmit ? 1 : 0.45 }}
            >
              <LinearGradient
                colors={[T.green, T.green]}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 17 }}
              >
                {sending
                  ? <Text style={{ color: '#000', fontWeight: '900', fontSize: 16 }}>Sending...</Text>
                  : <><Ionicons name="send-outline" size={18} color="#000" /><Text style={{ color: '#000', fontWeight: '900', fontSize: 16 }}>Submit Report</Text></>
                }
              </LinearGradient>
            </TouchableOpacity>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 2, marginBottom: 8 },
  typeChip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 10, borderRadius: 14, width: '48%' },
  severityRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, padding: 14 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  textArea: { borderRadius: 16, borderWidth: 1.5, padding: 14 },
});
