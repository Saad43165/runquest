import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';

// Root tab navigator
export type RootTabParamList = {
  Run: undefined;
  Territories: undefined;
  Settings: undefined;
  Profile: undefined;
};

// Profile stack
export type ProfileStackParamList = {
  ProfileMain: undefined;
  Achievements: undefined;
  Leaderboard: undefined;
  Fitness: undefined;
  ChatBot: undefined;
  HelpSupport: undefined;
};

// Composite type for screens inside Profile stack that also need tab navigation
export type ProfileScreenNavigationProp = CompositeNavigationProp<
  StackNavigationProp<ProfileStackParamList, 'ProfileMain'>,
  BottomTabNavigationProp<RootTabParamList>
>;

// Summary modal data shape (replaces data: any)
export interface RunSummaryData {
  distance: string;
  time: string;
  unit: 'KM' | 'MI';
  pace: number;
}
