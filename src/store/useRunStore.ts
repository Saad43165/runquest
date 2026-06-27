/**
 * Global run state store — allows other screens to show a live run indicator.
 * Updated by RunScreen whenever run state changes.
 */

type RunStoreState = {
  isActive: boolean;   // true when running or paused
  isPaused: boolean;
  elapsed: number;     // seconds
  distVal: string;     // formatted distance string
  unit: string;        // 'KM' or 'MI'
};

let state: RunStoreState = {
  isActive: false,
  isPaused: false,
  elapsed: 0,
  distVal: '0.00',
  unit: 'KM',
};

const listeners = new Set<() => void>();

export function getRunStore() { return state; }

export function setRunStore(patch: Partial<RunStoreState>) {
  state = { ...state, ...patch };
  listeners.forEach(l => l());
}

export function subscribeRunStore(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
