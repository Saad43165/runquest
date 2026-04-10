# Requirements Document

## Introduction

RunQuest is a territory conquest fitness app built with React Native 0.81.5 + Expo 54 + TypeScript. Users run GPS-tracked loops to claim geographic territories on a map, competing with others on a global leaderboard. The app currently has 10 screens, 4 themes, Firebase Auth/Firestore, and basic animations using React Native's `Animated` API.

This document captures requirements for a major improvement pass: upgrading the animation system to `react-native-reanimated`, overhauling the UI/UX across all screens, fixing known bugs, adding missing navigation, and ensuring every feature is fully functional with no placeholder or dummy content.

---

## Glossary

- **App**: The RunQuest React Native/Expo application.
- **Run_Screen**: The primary screen where users track GPS runs and claim territories.
- **Run_Tracker**: The `useRunTracker` hook that manages GPS location, run state, and path recording.
- **Territory**: A geographic polygon claimed by a user after completing a closed GPS loop.
- **Closed_Loop**: A GPS path where the end point is within a threshold distance of the start point, forming a claimable polygon.
- **Dashboard**: The bottom overlay panel on the Run Screen showing distance, pace, and action buttons.
- **Animation_System**: The set of animation primitives used across the app (upgrading from `Animated` to `react-native-reanimated`).
- **Theme**: One of four visual color schemes: midnight, aurora, sunset, light.
- **Leaderboard**: A ranked list of users sorted by total claimed territory area.
- **Achievements**: A set of milestones unlocked by running distance, claiming territories, or maintaining streaks.
- **Profile**: The screen showing a user's stats, run history, level progress, and avatar.
- **Settings**: The screen for configuring theme, map options, GPS accuracy, units, and account actions.
- **Onboarding**: The first-run walkthrough shown to new users.
- **Summary_Modal**: The post-run modal displaying distance, duration, and pace after stopping a run.
- **Tab_Navigator**: The bottom tab bar providing navigation between Run, Territories, Settings, and Profile.
- **Owner_Name**: The display name shown for a territory's owner in the Territories and Leaderboard screens.

---

## Requirements

### Requirement 1: Animation System Upgrade

**User Story:** As a user, I want fluid, physics-based animations throughout the app, so that the experience feels premium and responsive.

#### Acceptance Criteria

1. THE App SHALL use `react-native-reanimated` (v3+) as the primary animation library for all new and refactored animations.
2. WHEN a screen mounts, THE App SHALL animate its content in using a spring-based entrance animation with configurable stiffness and damping.
3. WHEN a user presses any interactive button, THE App SHALL respond with a scale-down press animation (scale to 0.95) that springs back on release.
4. WHEN the run state changes from idle to running, THE App SHALL animate the Dashboard panel upward with a spring transition.
5. WHEN the run state is `running`, THE App SHALL display a continuously pulsing indicator using a looping animation that does not block the JS thread.
6. FOR ALL spring animations, THE Animation_System SHALL produce opacity and scale values that remain within the range [0, 1] throughout the animation lifecycle.
7. WHEN an animation completes, THE Animation_System SHALL return animated values to their target state without overshoot beyond defined bounds.

---

### Requirement 2: Run Screen Overhaul

**User Story:** As a runner, I want a clean, information-rich run screen that is easy to use while moving, so that I can focus on my run without fumbling with the UI.

#### Acceptance Criteria

1. WHEN the run state is `idle`, THE Run_Screen SHALL display a motivational quote, current weather (if available), and a prominent START RUN button.
2. WHEN the run state is `running`, THE Run_Screen SHALL display elapsed time, distance, pace, and current GPS accuracy in real time.
3. WHEN the run state is `running`, THE Run_Screen SHALL display an altitude gauge populated with real GPS altitude data from `expo-location` (not a placeholder `--` value).
4. WHEN the run state is `paused`, THE Run_Screen SHALL display a RESUME button and a STOP button with clear visual distinction between the two actions.
5. WHEN the run state is `finished` and a Closed_Loop is detected, THE Run_Screen SHALL highlight the CLAIM TERRITORY button with a distinct color and animation to draw the user's attention.
6. WHEN the run state is `finished` and no Closed_Loop is detected, THE Run_Screen SHALL display an explanatory message telling the user why the claim button is disabled.
7. WHEN a user taps the recenter button, THE Run_Screen SHALL animate the map camera to the user's current GPS position within 500ms.
8. THE Run_Screen SHALL display the user's current heading as a directional arrow on the map marker when heading data is available.
9. WHEN the GPS accuracy is worse than 20 meters, THE Run_Screen SHALL display a visual warning indicator to the user.

---

### Requirement 3: Altitude Tracking

**User Story:** As a runner, I want to see my real altitude during a run, so that I can understand the elevation profile of my route.

#### Acceptance Criteria

1. WHEN a GPS location update is received, THE Run_Tracker SHALL extract and store the altitude value from `loc.coords.altitude`.
2. WHEN altitude data is available, THE Run_Screen SHALL display the current altitude in meters (or feet if imperial units are selected).
3. IF altitude data is unavailable from the GPS provider, THEN THE Run_Screen SHALL display `N/A` instead of `--`.
4. THE Run_Tracker SHALL expose the current altitude value through its public interface.

---

### Requirement 4: Closed-Loop Detection & Visual Feedback

**User Story:** As a runner, I want clear visual feedback as I approach completing a loop, so that I know when I'm about to be able to claim a territory.

#### Acceptance Criteria

1. WHEN the GPS path has 4 or more points, THE Run_Tracker SHALL continuously evaluate whether the path forms a Closed_Loop.
2. WHEN the path end point is within 30 meters of the path start point, THE Run_Tracker SHALL set the `closedLoop` flag to `true`.
3. WHEN `closedLoop` becomes `true`, THE Run_Screen SHALL trigger a haptic success notification and display a visual "Loop Closed!" indicator.
4. WHEN `closedLoop` becomes `true`, THE Run_Screen SHALL animate the territory polygon preview on the map to show the area that will be claimed.
5. FOR ALL valid closed paths with 3 or more points, THE Run_Tracker's closed-loop detection SHALL return a consistent result regardless of the order in which points were recorded.
6. IF the path has fewer than 3 points, THEN THE Run_Tracker SHALL return `closedLoop = false` without throwing an error.

---

### Requirement 5: Territory Claim Flow

**User Story:** As a runner, I want a satisfying and clear territory claim experience, so that claiming a new area feels rewarding.

#### Acceptance Criteria

1. WHEN a user taps CLAIM TERRITORY, THE Run_Screen SHALL display a loading indicator while the claim is being saved to Firestore.
2. WHEN a territory is successfully claimed, THE Run_Screen SHALL display a success animation and notification showing the claimed area in square meters.
3. WHEN a territory claim fails due to a network error, THE Run_Screen SHALL display a user-friendly error message with a retry option.
4. WHEN a territory is claimed, THE Territory SHALL be assigned the owner's display name (not their UID) for display in the Territories and Leaderboard screens.
5. THE claimAndConquerRemote function SHALL store the `ownerDisplayName` field in Firestore alongside the territory document.

---

### Requirement 6: Run Summary

**User Story:** As a runner, I want a detailed post-run summary, so that I can review my performance after each run.

#### Acceptance Criteria

1. WHEN a run is stopped, THE Summary_Modal SHALL display distance, duration, average pace, and whether a territory was claimed.
2. WHEN the Summary_Modal is displayed, THE App SHALL animate it in with a spring entrance from below.
3. THE Summary_Modal SHALL display distance in the user's preferred unit (km or miles) as configured in Settings.
4. WHEN the user dismisses the Summary_Modal, THE Run_Screen SHALL return to the `idle` state and reset the timer to 0.
5. FOR ALL completed runs, THE Summary_Modal's displayed pace SHALL equal duration divided by distance, within a rounding tolerance of 0.1 min/km.

---

### Requirement 7: Owner Name Display

**User Story:** As a user, I want to see real player names in the Territories and Leaderboard screens, so that the social experience feels genuine.

#### Acceptance Criteria

1. THE Territories_Screen SHALL display the `ownerDisplayName` field from Firestore for each territory, not the raw `ownerId` UID.
2. THE Leaderboard_Screen SHALL display the `ownerDisplayName` field for each ranked player, not a truncated UID.
3. WHEN the `ownerDisplayName` field is absent from a territory document (legacy data), THE App SHALL display "Unknown Warrior" as a fallback.
4. WHEN the territory owner is the current user, THE App SHALL display "You" regardless of the stored display name.

---

### Requirement 8: Navigation — Achievements & Leaderboard

**User Story:** As a user, I want easy access to Achievements and Leaderboard, so that I can track my progress and compete with others.

#### Acceptance Criteria

1. THE Profile_Screen SHALL include navigation links to both the Achievements screen and the Leaderboard screen.
2. WHEN a user taps the Achievements link on the Profile screen, THE App SHALL navigate to the Achievements screen.
3. WHEN a user taps the Leaderboard link on the Profile screen, THE App SHALL navigate to the Leaderboard screen.
4. THE Achievements_Screen and Leaderboard_Screen SHALL be accessible via a stack navigator pushed from the Profile tab, preserving the bottom tab bar.
5. WHEN a user navigates back from Achievements or Leaderboard, THE App SHALL return to the Profile screen without resetting its scroll position.

---

### Requirement 9: Achievements Screen

**User Story:** As a user, I want to see my achievements with accurate progress, so that I feel motivated to keep running.

#### Acceptance Criteria

1. THE Achievements_Screen SHALL compute achievement progress from the user's actual run history stored in AsyncStorage.
2. WHEN an achievement is unlocked, THE Achievements_Screen SHALL display a distinct visual treatment (color, icon, shimmer) to differentiate it from locked achievements.
3. THE Achievements_Screen SHALL display a completion percentage based on the number of earned achievements divided by total achievements.
4. FOR ALL achievements, THE progress value SHALL be a number in the range [0.0, 1.0] where 1.0 means fully achieved.
5. WHEN the run history is empty, THE Achievements_Screen SHALL display all achievements in a locked state with 0% progress.

---

### Requirement 10: Profile Screen Improvements

**User Story:** As a user, I want my profile to accurately reflect my running stats and level, so that I feel a sense of progression.

#### Acceptance Criteria

1. THE Profile_Screen SHALL display the user's total runs, total distance, and best single-run distance.
2. THE Profile_Screen SHALL display a level and XP progress bar computed from total distance run.
3. WHEN the user's total distance increases, THE Profile_Screen SHALL reflect the updated level and progress on next load.
4. FOR ALL users, THE level SHALL be a positive integer >= 1, and the progress value SHALL be in the range [0.0, 1.0].
5. THE Profile_Screen SHALL display the user's actual Firebase Auth display name and email, not placeholder text.
6. WHEN the user has no run history, THE Profile_Screen SHALL display a friendly empty state with a call-to-action to start their first run.

---

### Requirement 11: Settings Persistence

**User Story:** As a user, I want my settings to be saved and restored correctly, so that I don't have to reconfigure the app every time I open it.

#### Acceptance Criteria

1. WHEN a user changes any setting, THE Settings_Screen SHALL persist the change to AsyncStorage immediately.
2. WHEN the App restarts, THE App SHALL restore all settings from AsyncStorage before rendering the main UI.
3. FOR ALL settings values, saving a value and then loading it SHALL return an equivalent value (round-trip property).
4. WHEN a setting has never been saved, THE App SHALL use the defined default value for that setting.
5. THE theme setting SHALL be restored before the first render to prevent a flash of the wrong theme.

---

### Requirement 12: No Placeholder or Dummy Content

**User Story:** As a user, I want every piece of information displayed in the app to be real and meaningful, so that I trust the app's data.

#### Acceptance Criteria

1. THE App SHALL NOT display any hardcoded placeholder strings such as `--`, `N/A` (except where data is genuinely unavailable), or truncated UIDs as user-facing names.
2. WHEN data is loading, THE App SHALL display a loading skeleton or spinner rather than empty or placeholder text.
3. WHEN data fails to load, THE App SHALL display a descriptive error message explaining what went wrong.
4. THE Run_Screen's altitude gauge SHALL display real GPS altitude data or `N/A` — never the string `--`.
5. THE Territories_Screen's owner names SHALL be real display names or "Unknown Warrior" — never raw Firebase UIDs.

---

### Requirement 13: Haptics & Feedback

**User Story:** As a user, I want tactile feedback for key interactions, so that the app feels responsive and satisfying to use.

#### Acceptance Criteria

1. WHEN a user starts a run, THE App SHALL trigger a medium impact haptic.
2. WHEN a closed loop is detected, THE App SHALL trigger a success notification haptic.
3. WHEN a territory is successfully claimed, THE App SHALL trigger a success notification haptic.
4. WHEN a destructive action is confirmed (delete territory, clear history, sign out), THE App SHALL trigger a warning notification haptic.
5. WHEN a user changes a setting toggle, THE App SHALL trigger a selection haptic.

---

### Requirement 14: Tab Bar & Navigation Polish

**User Story:** As a user, I want a polished navigation experience, so that moving between screens feels smooth and intentional.

#### Acceptance Criteria

1. THE Tab_Navigator SHALL display icons and labels for Run, Territories, Settings, and Profile tabs.
2. WHEN a tab is active, THE Tab_Navigator SHALL highlight the active tab icon and label with the current theme's primary color.
3. THE Tab_Navigator background SHALL use a blur effect (expo-blur) that adapts to the current theme (dark blur for dark themes, light blur for the light theme).
4. WHEN the app first loads, THE Tab_Navigator SHALL default to the Run tab.
5. THE Tab_Navigator SHALL respect safe area insets on all devices including those with home indicators.

---

### Requirement 15: Navbar Redesign

**User Story:** As a user, I want a visually distinctive and modern bottom navigation bar, so that navigating the app feels premium and unique.

#### Acceptance Criteria

1. THE Tab_Navigator SHALL use a floating pill/capsule design that is horizontally centered and does not span the full screen width, with rounded corners (border radius >= 28).
2. THE active tab SHALL display a filled pill indicator behind the icon and label, using the current theme's primary color with reduced opacity as the background.
3. WHEN a user taps a tab, THE Tab_Navigator SHALL animate the active indicator sliding to the new tab using a spring animation (not an instant jump).
4. THE Tab_Navigator SHALL display only icons (no labels) when in the floating pill style, keeping the bar compact and uncluttered.
5. THE Tab_Navigator SHALL have a subtle drop shadow and border to visually separate it from the screen content below.
6. THE Run tab icon SHALL be visually emphasized (larger size or distinct shape) as the primary action of the app.
7. WHEN the run state is `running`, THE Run tab icon SHALL display a small animated green dot indicator to signal an active run session.
8. THE Tab_Navigator SHALL animate in on first mount with a slide-up spring entrance from below the screen.
