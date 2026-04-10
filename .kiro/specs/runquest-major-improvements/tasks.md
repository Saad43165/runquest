# Implementation Plan: RunQuest Major Improvements

## Overview

Upgrade the animation system to `react-native-reanimated`, redesign the bottom tab bar as a floating pill, add altitude tracking, fix owner name display, wire up Profile stack navigation, and add property-based tests for all 9 correctness properties. Tasks are ordered so foundational primitives are built before the screens that consume them.

## Tasks

- [x] 1. Install dependencies
  - Run `npx expo install react-native-reanimated` to add reanimated v3 (Expo-managed install ensures correct babel plugin version)
  - Run `npm install --save-dev fast-check` to add the property-based testing library
  - Add `react-native-reanimated/plugin` to the plugins array in `babel.config.js` (required for worklet transforms)
  - Verify `import { useSharedValue } from 'react-native-reanimated'` resolves without error by running `npx tsc --noEmit`
  - _Requirements: 1.1_

- [x] 2. Create animation primitives
  - [x] 2.1 Create `src/components/animated/springConfigs.ts`
    - Export `SPRING_CONFIGS` object with four named presets: `entrance`, `bounce`, `snappy`, `press` using `satisfies WithSpringConfig` for compile-time validation
    - Values: `entrance { damping:18, stiffness:120, mass:1 }`, `bounce { damping:10, stiffness:180, mass:0.8 }`, `snappy { damping:22, stiffness:200, mass:1 }`, `press { damping:20, stiffness:300, mass:0.6 }`
    - _Requirements: 1.1, 1.6, 1.7_

  - [x] 2.2 Create `src/components/animated/useEntranceAnimation.ts`
    - Hook that returns `{ animatedStyle }` — a reanimated style with `opacity` and `translateY` driven by a shared value that springs from `{ opacity:0, translateY:30 }` to `{ opacity:1, translateY:0 }` on mount using `SPRING_CONFIGS.entrance`
    - _Requirements: 1.2_

  - [x] 2.3 Create `src/components/animated/AnimatedPressable.tsx`
    - Wraps children in a `Pressable` with a reanimated `useAnimatedStyle` that scales to `0.95` on `onPressIn` and springs back to `1.0` on `onPressOut` using `SPRING_CONFIGS.press`
    - Accepts all standard `PressableProps` plus `style` prop
    - _Requirements: 1.3_

- [x] 3. Add `ownerDisplayName` to the `Territory` type
  - In `src/types.ts`, add `ownerDisplayName: string | null` to the `Territory` type definition
  - This is a non-breaking addition — existing code that constructs `Territory` objects without the field will need the field added (handled in tasks 8 and 9)
  - _Requirements: 5.4, 7.1, 7.2_

- [x] 4. Update `useRunTracker` to track altitude
  - In `src/hooks/useRunTracker.ts`, add `altitudeMeters: number | null` to `RunStateInternal` (initial value `null`)
  - Add `altitude: number | null` to the `UPDATE_LOCATION` action type
  - In the `UPDATE_LOCATION` reducer case, set `altitudeMeters: action.altitude ?? null`
  - In both `startRun` and `resumeRun` location callbacks, pass `altitude: loc.coords.altitude ?? null` to the `UPDATE_LOCATION` dispatch
  - Add `altitudeMeters: number | null` to the `Tracker` return type and return `internal.altitudeMeters`
  - _Requirements: 3.1, 3.4_

- [x] 5. Create `FloatingPillTabBar` component
  - Create `src/components/FloatingPillTabBar.tsx`
  - Accept `BottomTabBarProps` from `@react-navigation/bottom-tabs`
  - Define four tab items: Run (`fitness` / `fitness-outline`), Territories (`map` / `map-outline`), Settings (`settings` / `settings-outline`), Profile (`person` / `person-outline`)
  - Use `useSharedValue` for `indicatorX` (tracks sliding pill X position) and `mountAnim` (0→1 on mount for slide-up entrance)
  - On mount, animate `mountAnim` from 0 to 1 with `withSpring(1, SPRING_CONFIGS.entrance)` driving `translateY` from `100` to `0` and `opacity` from `0` to `1`
  - On tab press, update `indicatorX` with `withSpring(targetX, SPRING_CONFIGS.snappy)` to slide the active indicator
  - Layout: `position:'absolute'`, `bottom: safeAreaInsets.bottom + 12`, centered horizontally, fixed width `numTabs * TAB_WIDTH + 32`, `borderRadius: 32`
  - Active indicator: absolutely-positioned `Animated.View` behind icons, width `TAB_WIDTH`, height `48`, `borderRadius: 24`, background `T.green + '25'`
  - Display icons only (no labels), Run tab icon size `28`, others `22`
  - Drop shadow: `shadowColor:'#000'`, `shadowOpacity:0.25`, `shadowRadius:16`, `elevation:12`; border: `borderWidth:1`, `borderColor: T.border`
  - Background: `BlurView` from `expo-blur` filling the pill, tint adapts to theme
  - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.8_

- [x] 6. Create `ProfileStackNavigator`
  - Create `src/navigation/ProfileStackNavigator.tsx`
  - Use `createNativeStackNavigator` from `@react-navigation/native-stack` (already a transitive dependency)
  - Define three screens: `ProfileMain` → `ProfileScreen`, `Achievements` → `AchievementsScreen`, `Leaderboard` → `LeaderboardScreen`
  - All screens use `headerShown: false`
  - _Requirements: 8.4_

- [x] 7. Update `App.tsx` to use `FloatingPillTabBar` and `ProfileStackNavigator`
  - In `MainTabs`, replace the `screenOptions` tab bar styling (remove `tabBarStyle`, `tabBarBackground`, `tabBarIcon`, `tabBarLabelStyle`) with `tabBar={(props) => <FloatingPillTabBar {...props} />}`
  - Replace `<Tab.Screen name="Profile" component={ProfileScreen} />` with `<Tab.Screen name="Profile" component={ProfileStackNavigator} />`
  - Import `FloatingPillTabBar` from `src/components/FloatingPillTabBar`
  - Import `ProfileStackNavigator` from `src/navigation/ProfileStackNavigator`
  - Remove the now-unused direct `ProfileScreen` import from `App.tsx`
  - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 15.1_

- [x] 8. Update `territoriesRemote.ts` to read `ownerDisplayName`
  - In `subscribeTerritories`, add `ownerDisplayName: data.ownerDisplayName ?? null` to each `Territory` object pushed to `list`
  - In `claimAndConquerRemote`, add `ownerDisplayName: user.displayName || 'Hero'` to the returned `claimed` Territory object (the Firestore write already includes this field)
  - _Requirements: 5.5, 7.1, 7.2_

- [x] 9. Update `RunScreen` — altitude gauge, GPS warning, closed-loop feedback, and summary modal
  - [x] 9.1 Wire altitude gauge to real data
    - Destructure `altitudeMeters` from `useRunTracker()`
    - Change the `ALTITUDE` `Gauge` value prop from the hardcoded `"--"` to `altitudeMeters !== null ? String(Math.round(altitudeMeters)) : 'N/A'`
    - _Requirements: 2.3, 3.2, 3.3, 12.4_

  - [x] 9.2 Add GPS accuracy warning badge
    - Below the accuracy text in the header panel, conditionally render an amber `⚠ Poor GPS` badge when `accuracyMeters !== null && accuracyMeters > 20`
    - Style: small pill with amber background, white text, positioned inline with the accuracy readout
    - _Requirements: 2.9_

  - [x] 9.3 Add closed-loop haptic and "Loop Closed!" toast
    - Add a `useRef<boolean>(false)` to track the previous `closedLoop` value
    - In a `useEffect` watching `closedLoop`, when it transitions from `false` to `true`: call `Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)` and set a local `showLoopToast` state to `true` for 2500ms
    - Render a brief overlay toast `"🔒 Loop Closed!"` when `showLoopToast` is true, positioned above the dashboard panel
    - _Requirements: 4.3, 13.2_

  - [x] 9.4 Add pace to `SummaryModal` and spring entrance animation
    - Compute `pace` in `handleStop` as `(elapsed / 60) / (parseFloat(distVal))` and include it in the `summary` object
    - Add a `PACE` row to `SummaryModal`'s `summaryGrid` displaying `data.pace.toFixed(2)` with unit `MIN/KM` (or `MIN/MI`)
    - Replace `animationType="fade"` on the `Modal` with `animationType="none"` and add a reanimated `useAnimatedStyle` inside `SummaryModal` that springs `translateY` from `300` to `0` and `opacity` from `0` to `1` when `visible` becomes `true`, using `SPRING_CONFIGS.entrance`
    - _Requirements: 6.1, 6.2, 6.5_

  - [x] 9.5 Add "no closed loop" explanatory message in finished state
    - In the `finished` state action row, when `!closedLoop`, render a small text below the disabled claim button: `"Run a loop — end within 30m of your start point"`
    - _Requirements: 2.6_

- [x] 10. Update `TerritoriesScreen` to show `ownerDisplayName`
  - In `TerritoryProCard`, replace `item.ownerId.slice(0, 4)` in the owner name display with `item.ownerDisplayName ?? 'Unknown Warrior'`
  - The `initials` computation should use `item.ownerDisplayName ?? 'Unknown Warrior'` for non-owner territories instead of `item.ownerId`
  - In the inline leaderboard (`LeaderboardItem` calls inside `ListHeaderComponent`), replace `Warrior ${id.slice(0, 4)}` with the display name looked up from the territories list: `territories.find(t => t.ownerId === id)?.ownerDisplayName ?? 'Unknown Warrior'`
  - _Requirements: 7.1, 7.3, 7.4, 12.1, 12.5_

- [x] 11. Update `LeaderboardScreen` to show `ownerDisplayName`
  - In the `subscribeTerritories` callback inside `LeaderboardScreen`, change the `ownerName` mapping from `ownerId.slice(0, 8)` to `territories.find(t => t.ownerId === ownerId)?.ownerDisplayName ?? 'Unknown Warrior'`
  - To do this cleanly, store the raw `Territory[]` list in a ref and use it when building the `Rank[]` array
  - The current user still shows their own `name` (from `getDisplayName()`) as before
  - _Requirements: 7.2, 7.3, 7.4, 12.1_

- [x] 12. Update `ProfileScreen` with navigation cards to Achievements and Leaderboard
  - Import `useNavigation` from `@react-navigation/native`
  - Create a `NavCard` sub-component: a `TouchableOpacity` row with an icon, label, and chevron, styled consistently with the existing card style
  - Add two `NavCard` instances below the stats grid section: one for `Achievements` (icon `trophy-outline`) and one for `Leaderboard` (icon `podium-outline`)
  - Wire `onPress` to `navigation.navigate('Achievements')` and `navigation.navigate('Leaderboard')` respectively
  - _Requirements: 8.1, 8.2, 8.3_

- [ ] 13. Write property-based tests with fast-check
  - Create `src/__tests__/properties.test.ts`
  - Import `fc` from `fast-check` and all pure functions under test: `isClosedLoop` from `../utils/geometry`, `getLevelInfo` from `../screens/ProfileScreen` (extract to a shared util if needed), `computeAchievements` from `../screens/AchievementsScreen` (extract if needed), `getSettings`/`setSettings` from `../config/settings`, `runReducer`/`initialInternalState` from `../hooks/useRunTracker` (export them)

  - [ ]* 13.1 Property 1 — Spring animation values stay in [0, 1]
    - Implement a pure `simulateSpring(from, to, damping, stiffness, steps)` helper that numerically integrates the spring ODE
    - Assert that for any `damping ∈ [5,50]` and `stiffness ∈ [50,500]`, all 200 sampled values are within `[-0.001, 1.001]`
    - Tag: `// Feature: runquest-major-improvements, Property 1`
    - _Requirements: 1.6, 1.7_

  - [ ]* 13.2 Property 2 — Altitude round-trip through tracker reducer
    - Export `runReducer` and `initialInternalState` from `useRunTracker.ts`
    - Assert that for any `altitude ∈ [-500, 9000]`, dispatching `UPDATE_LOCATION` with that altitude produces `altitudeMeters === altitude` in the new state
    - Tag: `// Feature: runquest-major-improvements, Property 2`
    - _Requirements: 3.1, 3.4_

  - [ ]* 13.3 Property 3 — Closed-loop detection correctness
    - Build a `closedPathArbitrary()` that generates paths of length ≥ 4 where the last point is within 30 m of the first
    - Assert `isClosedLoop(path) === true` for all generated paths
    - Tag: `// Feature: runquest-major-improvements, Property 3`
    - _Requirements: 4.1, 4.2_

  - [ ]* 13.4 Property 4 — Closed-loop detection is order-independent for intermediate points
    - Reuse `closedPathArbitrary()`; shuffle intermediate points (keep first and last fixed)
    - Assert `isClosedLoop(original) === isClosedLoop(shuffled)`
    - Tag: `// Feature: runquest-major-improvements, Property 4`
    - _Requirements: 4.5_

  - [ ]* 13.5 Property 5 — Pace calculation accuracy
    - Extract a pure `computePace(distanceMeters, durationSec)` function from `RunScreen` (or inline the formula)
    - Assert `|computePace(d, s) - (s/60)/(d/1000)| <= 0.1` for any `distanceMeters ∈ [100, 100000]` and `durationSec ∈ [10, 36000]`
    - Tag: `// Feature: runquest-major-improvements, Property 5`
    - _Requirements: 6.5_

  - [ ]* 13.6 Property 6 — Owner display name shown for all territories
    - Extract a pure `resolveOwnerName(ownerId, ownerDisplayName, currentUid)` function
    - Assert that when `ownerId !== currentUid` and `ownerDisplayName` is a non-empty string, the result equals `ownerDisplayName`
    - Tag: `// Feature: runquest-major-improvements, Property 6`
    - _Requirements: 7.1, 7.2_

  - [ ]* 13.7 Property 7 — Achievement progress invariant
    - Build a `runHistoryArbitrary()` that generates arrays of `RunRecord`-shaped objects
    - Export `computeAchievements` from `AchievementsScreen.tsx` (or move to `src/utils/achievements.ts`)
    - Assert all `progress` values are in `[0.0, 1.0]`
    - Tag: `// Feature: runquest-major-improvements, Property 7`
    - _Requirements: 9.4_

  - [ ]* 13.8 Property 8 — Level and progress invariant
    - Export `getLevelInfo` from `ProfileScreen.tsx` (or move to `src/utils/levelInfo.ts`)
    - Assert `level >= 1 && progress >= 0 && progress <= 1` for any `totalDistanceMeters ∈ [0, 1_000_000]`
    - Tag: `// Feature: runquest-major-improvements, Property 8`
    - _Requirements: 10.4_

  - [ ]* 13.9 Property 9 — Settings round-trip
    - Build a `settingsArbitrary()` that generates valid `Settings` objects
    - Assert that `setSettings(s)` followed by `getSettings()` returns a deeply equal object
    - Tag: `// Feature: runquest-major-improvements, Property 9`
    - _Requirements: 11.3_

- [x] 14. Final typecheck and smoke test pass
  - Run `npx tsc --noEmit` and fix any TypeScript errors introduced by the new `ownerDisplayName` field on `Territory` (any place that constructs a `Territory` literal without the field)
  - Verify `react-native-reanimated` imports resolve: add a temporary `import { useSharedValue } from 'react-native-reanimated'` to a test file and confirm no module-not-found error
  - Verify `@react-navigation/native-stack` resolves (it is a transitive dep; confirm with `npx tsc --noEmit` on `ProfileStackNavigator.tsx`)
  - Ensure all tasks pass `npx tsc --noEmit` with zero errors
  - _Requirements: 12.1, 12.2_

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Tasks 2–4 are foundational and must be completed before tasks 5–12
- Task 3 (`Territory` type change) will cause TypeScript errors in `territoriesRemote.ts` and `RunScreen.tsx` until task 8 is also complete — do both in the same session
- Property tests in task 13 require exporting internal functions (`runReducer`, `computeAchievements`, `getLevelInfo`) — prefer moving them to dedicated utility files rather than exporting from screen components
- `react-native-reanimated` requires a full native rebuild after installation (`expo run:android` / `expo run:ios`); Expo Go will not work after this change
