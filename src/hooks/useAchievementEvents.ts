/**
 * Simple event bus for achievement unlocks.
 * RunScreen fires `emitAchievementsCheck` after a run completes with the full history.
 * Any subscriber (e.g. RunScreen overlay) can compute newly earned achievements.
 */
import { RunRecord } from '../services/history';

type Listener = (history: RunRecord[]) => void;

const listeners: Set<Listener> = new Set();

export function emitAchievementsCheck(history: RunRecord[]) {
  listeners.forEach(l => l(history));
}

export function subscribeAchievementEvents(listener: Listener) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
