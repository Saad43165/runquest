import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { getServerUrl, setServerUrl } from '../config/serverUrl';
import { palette, spacing } from '../theme';

export default function ProfileScreen() {
  const [url, setUrl] = useState<string>('');
  const [saved, setSaved] = useState<boolean>(false);
  useEffect(() => {
    (async () => {
      setUrl(await getServerUrl());
    })();
  }, []);
  const onSave = async () => {
    setSaved(false);
    await setServerUrl(url.trim());
    setSaved(true);
  };
  return (
    <View style={styles.root}>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.text}>Welcome to RunQuest.</Text>
      <Text style={styles.text}>Configure global server URL below.</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Server URL</Text>
        <TextInput
          value={url}
          onChangeText={setUrl}
          placeholder="https://your-server.example.com"
          placeholderTextColor={palette.text}
          autoCapitalize="none"
          style={styles.input}
        />
        <TouchableOpacity style={styles.save} onPress={onSave}>
          <Text style={styles.saveText}>Save</Text>
        </TouchableOpacity>
        {saved && <Text style={styles.saved}>Saved</Text>}
      </View>
      <Text style={styles.text}>Future: Connect Google Fit / Apple Health, avatars, alliances.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg, padding: spacing.md },
  title: { color: palette.white, fontSize: 20, fontWeight: '700', marginBottom: spacing.sm },
  text: { color: palette.text, marginBottom: spacing.xs },
  card: { backgroundColor: palette.card, padding: spacing.sm, borderRadius: 10, marginVertical: spacing.sm },
  label: { color: palette.white, marginBottom: spacing.xs, fontWeight: '600' },
  input: { color: palette.white, borderColor: palette.muted, borderWidth: 1, borderRadius: 8, padding: spacing.xs },
  save: { marginTop: spacing.sm, backgroundColor: palette.accent, borderRadius: 8, paddingVertical: spacing.xs, alignItems: 'center' },
  saveText: { color: palette.darkText, fontWeight: '700' },
  saved: { color: palette.text, marginTop: spacing.xs }
});
