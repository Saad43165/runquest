import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/utils/ThemeContext';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';

type BugReportModalProps = {
  onClose: () => void;
};

export default function BugReportModal({ onClose }: BugReportModalProps) {
  const { T, themeName } = useTheme();
  const isLight = themeName === 'light';
  const [type, setType] = useState<'bug' | 'suggestion' | 'feedback'>('bug');
  const [description, setDescription] = useState('');
  const [sending, setSending] = useState(false);

  const handleSubmit = async () => {
    if (!description.trim()) {
      Alert.alert('Empty Report', 'Please describe the issue or suggestion.');
      return;
    }
    setSending(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    setSending(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Report Sent', 'Thank you for your feedback! Our team will look into it.');
    onClose();
  };

  const bg = isLight ? '#FFF' : '#111';
  const inputBg = isLight ? '#F2F2F7' : '#1C1C1E';
  const borderColor = isLight ? '#DDD' : 'rgba(255,255,255,0.1)';

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <View style={[styles.header, { borderBottomColor: borderColor }]}>
        <Text style={[styles.headerTitle, { color: isLight ? '#000' : '#FFF' }]}>Feedback & Bugs</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Ionicons name="close" size={24} color={T.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.sectionTitle, { color: T.text }]}>WHAT KIND OF FEEDBACK?</Text>
        <View style={styles.typeRow}>
          {[
            { id: 'bug', label: 'Bug', icon: 'bug-outline', color: '#FF453A' },
            { id: 'suggestion', label: 'Idea', icon: 'bulb-outline', color: '#FFD60A' },
            { id: 'feedback', label: 'General', icon: 'chatbubble-outline', color: '#007AFF' },
          ].map(item => (
            <TouchableOpacity
              key={item.id}
              onPress={() => { setType(item.id as any); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              style={[styles.typeBtn, {
                backgroundColor: type === item.id ? item.color + '20' : inputBg,
                borderColor: type === item.id ? item.color : borderColor,
              }]}
            >
              <Ionicons name={item.icon as any} size={20} color={type === item.id ? item.color : T.text} />
              <Text style={[styles.typeLabel, { color: type === item.id ? item.color : T.text }]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.sectionTitle, { color: T.text, marginTop: 24 }]}>DESCRIPTION</Text>
        <View style={[styles.inputWrapper, { backgroundColor: inputBg, borderColor }]}>
          <TextInput
            multiline
            numberOfLines={6}
            placeholder={type === 'bug' ? "What happened? How can we reproduce it?" : "Tell us more..."}
            placeholderTextColor={T.text + '80'}
            value={description}
            onChangeText={setDescription}
            style={[styles.input, { color: isLight ? '#000' : '#FFF' }]}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.tipBox}>
          <Ionicons name="information-circle-outline" size={16} color={T.text} />
          <Text style={[styles.tipText, { color: T.text }]}>
            Your device model, OS version, and current GPS state will be included automatically.
          </Text>
        </View>

        <TouchableOpacity onPress={handleSubmit} disabled={sending} activeOpacity={0.85} style={styles.submitBtnContainer}>
          <LinearGradient colors={['#FF453A', '#FF6B35']} style={styles.submitBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            {sending ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitBtnText}>SEND REPORT</Text>}
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
  headerTitle: { fontSize: 20, fontWeight: '900' },
  closeBtn: { padding: 4 },
  scrollContent: { padding: 20 },
  sectionTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: 12 },
  typeRow: { flexDirection: 'row', gap: 10 },
  typeBtn: { flex: 1, height: 80, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  typeLabel: { fontSize: 13, fontWeight: '800' },
  inputWrapper: { borderRadius: 16, borderWidth: 1, padding: 12, minHeight: 160 },
  input: { fontSize: 15, flex: 1 },
  tipBox: { flexDirection: 'row', gap: 10, marginTop: 16, opacity: 0.7 },
  tipText: { fontSize: 12, flex: 1, lineHeight: 18 },
  submitBtnContainer: { marginTop: 32, borderRadius: 18, overflow: 'hidden' },
  submitBtn: { height: 56, alignItems: 'center', justifyContent: 'center' },
  submitBtnText: { color: '#FFF', fontWeight: '900', fontSize: 16, letterSpacing: 0.5 },
});
