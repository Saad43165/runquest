/**
 * soundService.ts
 * Centralized audio feedback for RunQuest using expo-av.
 * All sounds are generated procedurally via Web Audio API tones
 * encoded as base64 WAV data URIs so no asset files are needed.
 */

import { Audio } from 'expo-av';

// ─── Sound Event Types ─────────────────────────────────────────────────────────
export type SoundEvent =
  | 'countdown_tick'     // 3-2-1 beep
  | 'countdown_go'       // GO! fanfare
  | 'run_start'          // run started chime
  | 'run_pause'          // pause click
  | 'run_resume'         // resume chime
  | 'run_stop'           // run ended
  | 'loop_closed'        // GPS loop detected
  | 'territory_claimed'  // territory captured
  | 'territory_conquered'// enemy territory taken
  | 'milestone_1km'      // 1 km reached
  | 'milestone_5km'      // 5 km reached
  | 'milestone_10km'     // 10 km reached
  | 'loot_collected'     // item picked up
  | 'achievement'        // achievement unlocked
  | 'goal_reached'       // run goal completed
  | 'error';             // error / warning

// ─── Settings ─────────────────────────────────────────────────────────────────
let soundEnabled = true;
let soundVolume = 0.8;

export function setSoundEnabled(v: boolean) { soundEnabled = v; }
export function setSoundVolume(v: number) { soundVolume = Math.max(0, Math.min(1, v)); }

// ─── Sound Pool ───────────────────────────────────────────────────────────────
// We cache loaded sounds so they play instantly without re-loading
const soundPool: Partial<Record<SoundEvent, Audio.Sound>> = {};

// ─── Tone Generator ───────────────────────────────────────────────────────────
// Generates minimal PCM WAV buffers encoded as base64 for inline playback

function generateToneWav(freqHz: number, durationMs: number, type: 'sine' | 'sawtooth' | 'square' = 'sine'): string {
  const sampleRate = 22050;
  const numSamples = Math.floor((sampleRate * durationMs) / 1000);
  const byteRate = sampleRate * 2;
  const dataSize = numSamples * 2;
  const fileSize = 36 + dataSize;

  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF header
  view.setUint8(0, 0x52); view.setUint8(1, 0x49); view.setUint8(2, 0x46); view.setUint8(3, 0x46); // RIFF
  view.setUint32(4, fileSize, true);
  view.setUint8(8, 0x57); view.setUint8(9, 0x41); view.setUint8(10, 0x56); view.setUint8(11, 0x45); // WAVE
  view.setUint8(12, 0x66); view.setUint8(13, 0x6d); view.setUint8(14, 0x74); view.setUint8(15, 0x20); // fmt
  view.setUint32(16, 16, true);         // chunk size
  view.setUint16(20, 1, true);          // PCM
  view.setUint16(22, 1, true);          // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, 2, true);          // block align
  view.setUint16(34, 16, true);         // bits per sample
  view.setUint8(36, 0x64); view.setUint8(37, 0x61); view.setUint8(38, 0x74); view.setUint8(39, 0x61); // data
  view.setUint32(40, dataSize, true);

  const TWO_PI = 2 * Math.PI;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    // Envelope: fade in 5ms, fade out 30ms
    const fadeInSamples = Math.floor(sampleRate * 0.005);
    const fadeOutSamples = Math.floor(sampleRate * 0.03);
    let env = 1;
    if (i < fadeInSamples) env = i / fadeInSamples;
    if (i > numSamples - fadeOutSamples) env = (numSamples - i) / fadeOutSamples;

    let sample = 0;
    switch (type) {
      case 'sine':
        sample = Math.sin(TWO_PI * freqHz * t);
        break;
      case 'square':
        sample = Math.sin(TWO_PI * freqHz * t) > 0 ? 1 : -1;
        break;
      case 'sawtooth':
        sample = 2 * ((freqHz * t) % 1) - 1;
        break;
    }
    const pcm = Math.floor(sample * env * 28000);
    view.setInt16(44 + i * 2, pcm, true);
  }

  // Convert buffer to base64
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  // btoa is available in React Native JS context
  return 'data:audio/wav;base64,' + btoa(binary);
}

// ─── Sound Definitions ─────────────────────────────────────────────────────────
// Each event maps to a WAV data URI generated procedurally

function buildSoundDataUri(event: SoundEvent): string {
  switch (event) {
    case 'countdown_tick':
      return generateToneWav(800, 100, 'sine');
    case 'countdown_go':
      return generateToneWav(1200, 300, 'sine');
    case 'run_start':
      return generateToneWav(880, 250, 'sine');
    case 'run_pause':
      return generateToneWav(440, 150, 'sine');
    case 'run_resume':
      return generateToneWav(660, 200, 'sine');
    case 'run_stop':
      return generateToneWav(330, 400, 'sine');
    case 'loop_closed':
      return generateToneWav(1047, 350, 'sine');
    case 'territory_claimed':
      return generateToneWav(1175, 500, 'sine');
    case 'territory_conquered':
      return generateToneWav(987, 600, 'sawtooth');
    case 'milestone_1km':
      return generateToneWav(523, 250, 'sine');
    case 'milestone_5km':
      return generateToneWav(659, 350, 'sine');
    case 'milestone_10km':
      return generateToneWav(784, 500, 'sine');
    case 'loot_collected':
      return generateToneWav(1319, 200, 'sine');
    case 'achievement':
      return generateToneWav(1047, 600, 'sine');
    case 'goal_reached':
      return generateToneWav(1175, 700, 'sine');
    case 'error':
      return generateToneWav(220, 200, 'square');
    default:
      return generateToneWav(440, 100, 'sine');
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

let audioSessionConfigured = false;

async function ensureAudioSession() {
  if (audioSessionConfigured) return;
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: true,
      playsInSilentModeIOS: false, // Respect silent switch
      shouldDuckAndroid: true,
    });
    audioSessionConfigured = true;
  } catch {}
}

/**
 * Play a sound event. Loads on first call, then plays from pool.
 * Silently no-ops if sound is disabled or audio fails.
 */
export async function playSound(event: SoundEvent): Promise<void> {
  if (!soundEnabled) return;
  try {
    await ensureAudioSession();

    // Unload old instance if exists
    const existing = soundPool[event];
    if (existing) {
      try { await existing.stopAsync(); } catch {}
    }

    const dataUri = buildSoundDataUri(event);
    const { sound } = await Audio.Sound.createAsync(
      { uri: dataUri },
      { volume: soundVolume, shouldPlay: true }
    );
    soundPool[event] = sound;

    // Auto-unload after playback to free memory
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync().catch(() => {});
        delete soundPool[event];
      }
    });
  } catch {
    // Audio failure is non-critical — silently ignore
  }
}

/**
 * Preload sounds that should fire instantly (e.g. countdown ticks).
 */
export async function preloadSounds(events: SoundEvent[]): Promise<void> {
  await ensureAudioSession();
  for (const event of events) {
    try {
      const dataUri = buildSoundDataUri(event);
      const { sound } = await Audio.Sound.createAsync(
        { uri: dataUri },
        { volume: soundVolume, shouldPlay: false }
      );
      soundPool[event] = sound;
    } catch {}
  }
}

/**
 * Unload all cached sounds — call on screen unmount.
 */
export async function unloadAllSounds(): Promise<void> {
  for (const event of Object.keys(soundPool) as SoundEvent[]) {
    try {
      await soundPool[event]?.unloadAsync();
    } catch {}
    delete soundPool[event];
  }
}
