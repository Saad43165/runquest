import AsyncStorage from '@react-native-async-storage/async-storage';

export type RunRecord = {
  id: string;
  createdAt: number;
  distanceMeters: number;
  durationSec: number;
  perimeterMeters: number;
  areaSqMeters: number;
};

const KEY = 'runquest:history';

export async function addRun(rec: RunRecord): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const list: RunRecord[] = raw ? JSON.parse(raw) : [];
    await AsyncStorage.setItem(KEY, JSON.stringify([rec, ...list]));
  } catch {}
}

export async function getHistory(): Promise<RunRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as RunRecord[]) : [];
  } catch {
    return [];
  }
}

export async function getHistoryStats(): Promise<{ runs: number; totalDistanceMeters: number; totalDurationSec: number }> {
  const list = await getHistory();
  let dist = 0;
  let dur = 0;
  for (const r of list) {
    dist += r.distanceMeters || 0;
    dur += r.durationSec || 0;
  }
  return { runs: list.length, totalDistanceMeters: dist, totalDurationSec: dur };
}
