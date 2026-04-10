# Design Document — RunQuest Major Improvements

## Overview

This document describes the technical design for the RunQuest major improvement pass. The changes span the entire app: upgrading the animation system from `Animated` to `react-native-reanimated`, redesigning the bottom navigation bar as a floating pill, overhauling the Run Screen with real altitude tracking and closed-loop feedback, fixing owner name display throughout, adding stack navigation from the Profile tab, and ensuring settings round-trip correctly.

The guiding principle is **no placeholder content** — every gauge, name, and stat must reflect real data or a clearly labelled fallback.

---

## Architecture

### High-Level Component Relationships

```
App.tsx
├── ThemeProvider
├── AuthProvider
└── NavigationContainer
    └── AppContent
        └── MainTabs  (Tab.Navigator — FloatingPillTabBar)
            ├── Run          → RunScreen
            ├── Territories  → TerritoriesScreen
            ├── Settings     → SettingsScreen
            └── Profile      → ProfileStackNavigator
                                ├── ProfileScreen
                                ├── AchievementsScreen
                                └── LeaderboardScreen
```

The key structural change is that `AchievementsScreen` and `LeaderboardScreen` move from being standalone tabs to being screens inside a **stack navigator** rooted at the Profile tab. The bottom tab bar remains visible throughout (the stack navigator sits inside the tab, not above it).

### Data Flow

```
expo-location
    │  coords.altitude, coords.heading, coords.accuracy
    ▼
useRunTracker (hook)
    │  state, path, altitudeMeters, headingDeg, accuracyMeters, closedLoop
    ▼
RunScreen
    │  passes props to
    ├── MapRunView (WebView/Leaflet) — heading arrow, accuracy circle
    └── Dashboard overlay — altitude gauge, GPS warning, summary modal

Firestore (territories collection)
    │  ownerDisplayName stored on claim
    ▼
subscribeTerritories → Territory[] (with ownerDisplayName)
    ├── TerritoriesScreen — shows ownerDisplayName
    └── LeaderboardScreen — shows ownerDisplayName
```

### Animation Architecture

All new animations use `react-native-reanimated` v3. The existing `Animated` API calls in legacy screens are left in place and migrated incrementally. New shared primitives live in `src/components/animated/`.

```
src/components/animated/
├── AnimatedPressable.tsx   — scale-down press (0.95) with spring back
├── springConfigs.ts        — named spring presets (entrance, bounce, snappy)
└── useEntranceAnimation.ts — hook: opacity + translateY spring on mount
```

---

## Components and Interfaces

### New: `FloatingPillTabBar`

Replaces the default `tabBarBackground` + `tabBarStyle` approach with a fully custom tab bar component passed to `Tab.Navigator` via `tabBar` prop.

```tsx
// src/components/FloatingPillTabBar.tsx

type FloatingPillTabBarProps = BottomTabBarProps; // from @react-navigation/bottom-tabs

interface TabItem {
  key: string;
  name: string;
  icon: string;          // Ionicons name (outline)
  iconActive: string;    // Ionicons name (filled)
  isRunTab: boolean;
}
```

Key internal state:
- `indicatorX: SharedValue<number>` — Reanimated shared value tracking the X position of the sliding pill indicator
- `mountAnim: SharedValue<number>` — 0→1 on first mount, drives slide-up entrance
- `activeRunDot: boolean` — derived from run state context, shows pulsing green dot on Run tab

Layout: the bar is a `View` with `position: 'absolute'`, `bottom: safeAreaInsets.bottom + 12`, centered horizontally with a fixed width of `(numTabs * TAB_WIDTH)` plus horizontal padding. Border radius ≥ 28. Drop shadow via `shadowColor`, `shadowOpacity`, `shadowRadius`, `elevation`.

The sliding indicator is an `Animated.View` (reanimated) positioned absolutely inside the pill, driven by `indicatorX`. On tab press, `indicatorX` is updated with `withSpring(targetX, SPRING_CONFIGS.snappy)`.

### Modified: `App.tsx` — `MainTabs`

- Remove `tabBarStyle`, `tabBarBackground`, `tabBarIcon`, `tabBarLabelStyle` from `screenOptions`
- Add `tabBar={(props) => <FloatingPillTabBar {...props} />}`
- Replace `Tab.Screen name="Profile"` component with `ProfileStackNavigator`

### New: `ProfileStackNavigator`

```tsx
// src/navigation/ProfileStackNavigator.tsx
import { createNativeStackNavigator } from '@react-navigation/native-stack';

const Stack = createNativeStackNavigator();

export function ProfileStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileMain" component={ProfileScreen} />
      <Stack.Screen name="Achievements" component={AchievementsScreen} />
      <Stack.Screen name="Leaderboard"  component={LeaderboardScreen} />
    </Stack.Navigator>
  );
}
```

`@react-navigation/native-stack` is already a transitive dependency via `@react-navigation/native`. No new package needed.

### Modified: `ProfileScreen`

Add two tappable navigation cards below the stats grid:

```tsx
// Navigation row — taps call navigation.navigate('Achievements') / 'Leaderboard'
<NavCard icon="trophy-outline"  label="Achievements" onPress={...} />
<NavCard icon="podium-outline"  label="Leaderboard"  onPress={...} />
```

`useNavigation()` from `@react-navigation/native` provides the `navigation` object inside the stack.

### Modified: `useRunTracker`

New fields added to `RunStateInternal`:

```ts
altitudeMeters: number | null;   // from loc.coords.altitude
```

New action:

```ts
| { type: 'UPDATE_LOCATION'; point: LatLng; accuracy: number | null; heading: number | null; altitude: number | null }
```

New public return field:

```ts
altitudeMeters: number | null;
```

The `UPDATE_LOCATION` handler stores `altitudeMeters: action.altitude ?? null`.

### Modified: `RunScreen`

- Altitude `Gauge` now reads `altitudeMeters` from `useRunTracker`; displays `altitudeMeters !== null ? String(Math.round(altitudeMeters)) : 'N/A'`
- GPS accuracy warning: when `accuracyMeters !== null && accuracyMeters > 20`, render a small amber badge `⚠ Poor GPS` near the accuracy readout
- `SummaryModal` receives `pace` prop (computed as `durationSec / 60 / distanceKm`) and displays it
- `SummaryModal` entrance: replace `animationType="fade"` with a reanimated spring from `translateY: 300` → `0`
- Closed-loop feedback: when `closedLoop` transitions to `true`, trigger `Haptics.notificationAsync(Success)` and show a brief "Loop Closed!" toast overlay

### Modified: `MapRunView.native.tsx`

The Leaflet HTML is updated to support a heading arrow on the user marker:

```js
// In buildLeafletHTML — user marker HTML becomes:
var headingDeg = ${headingDeg ?? 0};
var hasHeading = ${headingDeg !== null ? 'true' : 'false'};
// Arrow SVG rotated by headingDeg, shown only when hasHeading is true
```

The `Props` type already includes `headingDeg?: number | null` — this just needs to be wired into the HTML template.

### Modified: `territoriesRemote.ts` — `subscribeTerritories`

Map `ownerDisplayName` from Firestore document:

```ts
list.push({
  ...
  ownerDisplayName: data.ownerDisplayName ?? null,
});
```

### Modified: `TerritoriesScreen` + `LeaderboardScreen`

Both screens use `territory.ownerDisplayName` (with `'Unknown Warrior'` fallback) instead of truncated UIDs. The current user always shows as `'You'`.

---

## Data Models

### `Territory` type — `src/types.ts`

```ts
export type Territory = {
  id: string;
  name: string;
  ownerId: string;
  ownerDisplayName: string | null;   // NEW — stored in Firestore, null for legacy docs
  color: string;
  createdAt: number;
  polygon: LatLng[];
  perimeterMeters: number;
  areaSqMeters: number;
};
```

### Firestore `territories` document schema

| Field              | Type      | Notes                                      |
|--------------------|-----------|--------------------------------------------|
| `name`             | string    | Territory name                             |
| `ownerId`          | string    | Firebase Auth UID                          |
| `ownerDisplayName` | string    | `user.displayName \|\| 'Hero'` at claim time |
| `polygon`          | LatLng[]  | Array of `{latitude, longitude}`           |
| `perimeterMeters`  | number    | Rounded integer                            |
| `areaSqMeters`     | number    | Rounded integer                            |
| `color`            | string    | HSL string derived from UID                |
| `createdAt`        | Timestamp | Firestore server timestamp                 |

`ownerDisplayName` is already written by `claimAndConquerRemote` — the change is reading it back in `subscribeTerritories` and surfacing it in the `Territory` type.

### `RunRecord` type — `src/services/history.ts`

No changes needed. Pace is computed on-the-fly in `RunScreen` and `SummaryModal` from `durationSec` and `distanceMeters`.

### Animation Spring Configs — `src/components/animated/springConfigs.ts`

```ts
import { WithSpringConfig } from 'react-native-reanimated';

export const SPRING_CONFIGS = {
  entrance: { damping: 18, stiffness: 120, mass: 1 } satisfies WithSpringConfig,
  bounce:   { damping: 10, stiffness: 180, mass: 0.8 } satisfies WithSpringConfig,
  snappy:   { damping: 22, stiffness: 200, mass: 1 } satisfies WithSpringConfig,
  press:    { damping: 20, stiffness: 300, mass: 0.6 } satisfies WithSpringConfig,
} as const;
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Spring animation values stay in bounds

*For any* spring animation configuration (stiffness, damping, mass) applied to a value animating from 0 to 1, all sampled intermediate and final values SHALL remain within the range [0, 1].

**Validates: Requirements 1.6, 1.7**

---

### Property 2: Altitude round-trip through tracker

*For any* GPS location update containing a non-null altitude value, the altitude exposed by `useRunTracker`'s public interface SHALL equal the altitude from the location update (within floating-point rounding).

**Validates: Requirements 3.1, 3.4**

---

### Property 3: Closed-loop detection correctness

*For any* GPS path where the straight-line distance between the first and last point is ≤ 30 meters and the path has ≥ 4 points, `isClosedLoop` SHALL return `true`.

**Validates: Requirements 4.1, 4.2**

---

### Property 4: Closed-loop detection is order-independent for intermediate points

*For any* closed GPS path (start and end within 30 m), permuting the intermediate points SHALL not change the result of `isClosedLoop`.

**Validates: Requirements 4.5**

---

### Property 5: Pace calculation accuracy

*For any* completed run with `distanceMeters > 0` and `durationSec > 0`, the pace displayed in the Summary Modal SHALL equal `(durationSec / 60) / (distanceMeters / 1000)` within a tolerance of 0.1 min/km.

**Validates: Requirements 6.5**

---

### Property 6: Owner display name shown for all territories

*For any* territory where `ownerId` does not match the current user's UID and `ownerDisplayName` is non-null, the Territories Screen SHALL display `ownerDisplayName` — not a truncated UID.

**Validates: Requirements 7.1, 7.2**

---

### Property 7: Achievement progress invariant

*For any* run history (including empty), all computed achievement `progress` values SHALL be numbers in the range [0.0, 1.0].

**Validates: Requirements 9.4**

---

### Property 8: Level and progress invariant

*For any* non-negative `totalDistanceMeters` value, `getLevelInfo` SHALL return a `level` that is a positive integer ≥ 1 and a `progress` value in the range [0.0, 1.0].

**Validates: Requirements 10.4**

---

### Property 9: Settings round-trip

*For any* valid `Settings` object, serializing it to AsyncStorage with `setSettings` and then deserializing it with `getSettings` SHALL return an object that is deeply equal to the original.

**Validates: Requirements 11.3**

---

## Error Handling

### GPS / Location Errors

- `startRun` already catches `watchPositionAsync` failures and shows an alert. No change needed.
- If altitude is `null` from the GPS provider (common on some Android devices), `altitudeMeters` stays `null` and the gauge shows `N/A`.
- If accuracy is `null`, the accuracy badge is hidden rather than showing a stale value.

### Firestore Errors

- `claimAndConquerRemote` already catches and returns `null` on failure. `RunScreen.onClaim` shows an alert. A retry button is added to the alert action sheet.
- `subscribeTerritories` already has an `onError` handler that logs the warning. No UI change needed for subscription errors (the list simply stays at its last known state).

### Navigation Errors

- `ProfileStackNavigator` uses `headerShown: false` on all screens. If `useNavigation()` is called outside the navigator, React Navigation throws a clear error in development. No special handling needed.

### Settings Load Errors

- `getSettings` already returns `DEFAULTS` on any parse or storage error. This satisfies Requirement 11.4.

### Animation Errors

- Reanimated worklets run on the UI thread. If a worklet throws, it is caught by Reanimated's error boundary and logged — it does not crash the JS thread. Spring configs are validated at compile time via `satisfies WithSpringConfig`.

---

## Testing Strategy

### Unit Tests

Focus on pure functions and data transformations:

- `isClosedLoop(path)` — edge cases: empty path, 1-point, 2-point, 3-point, exactly 30 m apart, 31 m apart
- `getLevelInfo(totalDistanceMeters)` — edge cases: 0 m, exactly on a level boundary, very large values
- `computeAchievements(history)` — edge cases: empty history, single run, all achievements unlocked
- Pace formula: `(durationSec / 60) / (distanceMeters / 1000)` — verify against known values
- `ownerDisplayName` fallback logic: null → "Unknown Warrior", own UID → "You"

### Property-Based Tests

Use **fast-check** (TypeScript-native, works with Jest/Vitest, no native dependencies).

Install: `npm install --save-dev fast-check`

Each property test runs a minimum of **100 iterations**.

Tag format: `// Feature: runquest-major-improvements, Property N: <property text>`

**Property 1 — Spring animation values stay in bounds**
```ts
// Feature: runquest-major-improvements, Property 1: spring animation values stay in [0,1]
fc.assert(fc.property(
  fc.record({ damping: fc.float({ min: 5, max: 50 }), stiffness: fc.float({ min: 50, max: 500 }) }),
  ({ damping, stiffness }) => {
    const samples = simulateSpring({ from: 0, to: 1, damping, stiffness, steps: 200 });
    return samples.every(v => v >= -0.001 && v <= 1.001); // small float tolerance
  }
), { numRuns: 100 });
```

**Property 2 — Altitude round-trip through tracker**
```ts
// Feature: runquest-major-improvements, Property 2: altitude round-trip
fc.assert(fc.property(
  fc.float({ min: -500, max: 9000 }),
  (altitude) => {
    const result = runReducer(initialState, { type: 'UPDATE_LOCATION', point: mockPoint, accuracy: 5, heading: null, altitude });
    return result.altitudeMeters === altitude;
  }
), { numRuns: 100 });
```

**Property 3 — Closed-loop detection correctness**
```ts
// Feature: runquest-major-improvements, Property 3: closed-loop detection
fc.assert(fc.property(
  closedPathArbitrary(), // generates paths where end is within 30m of start, length >= 4
  (path) => isClosedLoop(path) === true
), { numRuns: 100 });
```

**Property 4 — Closed-loop detection is order-independent**
```ts
// Feature: runquest-major-improvements, Property 4: closed-loop order independence
fc.assert(fc.property(
  closedPathArbitrary(),
  (path) => {
    const shuffled = [path[0], ...shuffle(path.slice(1, -1)), path[path.length - 1]];
    return isClosedLoop(path) === isClosedLoop(shuffled);
  }
), { numRuns: 100 });
```

**Property 5 — Pace calculation accuracy**
```ts
// Feature: runquest-major-improvements, Property 5: pace calculation accuracy
fc.assert(fc.property(
  fc.integer({ min: 100, max: 100000 }),  // distanceMeters
  fc.integer({ min: 10, max: 36000 }),    // durationSec
  (distanceMeters, durationSec) => {
    const expected = (durationSec / 60) / (distanceMeters / 1000);
    const displayed = computePace(distanceMeters, durationSec);
    return Math.abs(displayed - expected) <= 0.1;
  }
), { numRuns: 100 });
```

**Property 6 — Owner display name shown for all territories**
```ts
// Feature: runquest-major-improvements, Property 6: owner display name
fc.assert(fc.property(
  fc.record({ ownerId: fc.string(), ownerDisplayName: fc.string({ minLength: 1 }) }),
  ({ ownerId, ownerDisplayName }) => {
    const displayed = resolveOwnerName(ownerId, ownerDisplayName, 'different-uid');
    return displayed === ownerDisplayName;
  }
), { numRuns: 100 });
```

**Property 7 — Achievement progress invariant**
```ts
// Feature: runquest-major-improvements, Property 7: achievement progress in [0,1]
fc.assert(fc.property(
  runHistoryArbitrary(),
  (history) => {
    const achievements = computeAchievements(history);
    return achievements.every(a => a.progress >= 0 && a.progress <= 1);
  }
), { numRuns: 100 });
```

**Property 8 — Level and progress invariant**
```ts
// Feature: runquest-major-improvements, Property 8: level and progress invariant
fc.assert(fc.property(
  fc.float({ min: 0, max: 1_000_000 }),
  (totalDistanceMeters) => {
    const { level, progress } = getLevelInfo(totalDistanceMeters);
    return level >= 1 && progress >= 0 && progress <= 1;
  }
), { numRuns: 100 });
```

**Property 9 — Settings round-trip**
```ts
// Feature: runquest-major-improvements, Property 9: settings round-trip
fc.assert(fc.property(
  settingsArbitrary(),
  async (settings) => {
    await setSettings(settings);
    const loaded = await getSettings();
    return deepEqual(settings, loaded);
  }
), { numRuns: 100 });
```

### Integration Tests

- Firestore claim: verify `ownerDisplayName` field is present in the written document (1 example with a test Firestore emulator)
- `subscribeTerritories`: verify returned `Territory` objects include `ownerDisplayName` field

### Smoke Tests

- `react-native-reanimated` is installed and `useSharedValue` can be imported without error
- `@react-navigation/native-stack` is importable (already a transitive dep)
