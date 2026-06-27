/**
 * Lightweight event emitter for settings changes.
 * Allows components (like TabBarSelector) to react instantly
 * when settings are updated from anywhere in the app (e.g. ChatBot).
 */

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeSettingsChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emitSettingsChange(): void {
  listeners.forEach(fn => fn());
}
