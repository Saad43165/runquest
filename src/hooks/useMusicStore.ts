/**
 * Simple module-level music state shared between MusicPlayer and RunScreen dashboard.
 * No context needed — just a singleton with listeners.
 */

type MusicState = {
  isPlaying: boolean;
  trackName: string;
  positionMs: number;
  durationMs: number;
  onToggle: (() => void) | null;
  onNext: (() => void) | null;
  onPrev: (() => void) | null;
  onPickMusic: (() => void) | null;
  onSeek: ((positionSec: number) => void) | null;
};

let state: MusicState = {
  isPlaying: false,
  trackName: '',
  positionMs: 0,
  durationMs: 0,
  onToggle: null,
  onNext: null,
  onPrev: null,
  onPickMusic: null,
  onSeek: null,
};

const listeners: Set<() => void> = new Set();

export function getMusicState() { return state; }

export function setMusicState(patch: Partial<MusicState>) {
  state = { ...state, ...patch };
  listeners.forEach(l => l());
}

export function subscribeMusicState(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
