import AsyncStorage from '@react-native-async-storage/async-storage';
import { ensureAnonymousAuth } from './firebase';

const KEY = 'runquest:userId';
const NAME_KEY = 'runquest:displayName';

export async function ensureUserId(): Promise<string> {
  const uid = await ensureAnonymousAuth();
  if (uid) return uid;
  const existing = await AsyncStorage.getItem(KEY);
  if (existing) return existing;
  const gen = `local-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
  await AsyncStorage.setItem(KEY, gen);
  return gen;
}

export async function getDisplayName(): Promise<string> {
  const name = await AsyncStorage.getItem(NAME_KEY);
  if (name) return name;
  const uid = await AsyncStorage.getItem(KEY);
  const short = uid ? uid.slice(-6) : 'runner';
  return `Runner ${short}`;
}

export async function setDisplayName(name: string): Promise<void> {
  await AsyncStorage.setItem(NAME_KEY, name);
}
