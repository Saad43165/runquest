import AsyncStorage from '@react-native-async-storage/async-storage';
import { OfflineOperation } from '../store/useAppStore';
import { claimAndConquerRemote, removeTerritoryRemote } from './territoriesRemote';
import { updateUserProfile } from './authService';
import { LatLng } from '../types';

const QUEUE_KEY = 'runquest:offlineQueue';

export async function persistQueue(queue: OfflineOperation[]): Promise<void> {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {}
}

export async function loadQueue(): Promise<OfflineOperation[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function processQueue(queue: OfflineOperation[]): Promise<OfflineOperation[]> {
  const remaining: OfflineOperation[] = [];

  for (const op of queue) {
    try {
      if (op.type === 'claim_territory') {
        await claimAndConquerRemote(
          op.payload.name as string,
          op.payload.path as LatLng[],
          [],
        );
      } else if (op.type === 'delete_territory') {
        await removeTerritoryRemote(op.payload.id as string);
      } else if (op.type === 'update_profile') {
        await updateUserProfile(
          op.payload.uid as string,
          op.payload.patch as Record<string, unknown>
        );
      }
    } catch {
      if (op.retries < 3) {
        remaining.push({ ...op, retries: op.retries + 1 });
      }
    }
  }

  await persistQueue(remaining);
  return remaining;
}

export function generateOpId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
