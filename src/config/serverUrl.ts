import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const KEY = 'runquest:serverUrl';

export async function getServerUrl(): Promise<string> {
  try {
    const saved = await AsyncStorage.getItem(KEY);
    if (saved) {
      return saved;
    }
  } catch {}
  const extra = (Constants?.expoConfig?.extra as any) || {};
  return extra.serverUrl || 'http://localhost:4000';
}

export async function setServerUrl(url: string): Promise<void> {
  await AsyncStorage.setItem(KEY, url);
}
