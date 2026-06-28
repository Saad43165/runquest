import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { CardStyleInterpolators } from '@react-navigation/stack';
import ProfileScreen from '../screens/ProfileScreen';
import AchievementsScreen from '../screens/AchievementsScreen';
import LeaderboardScreen from '../screens/LeaderboardScreen';
import FitnessScreen from '../screens/FitnessScreen';
import ChatBotScreen from '../screens/ChatBotScreen';
import HelpSupportScreen from '../screens/HelpSupportScreen';
import TeamsScreen from '../screens/TeamsScreen';
import ActivityFeedScreen from '../screens/ActivityFeedScreen';
import RunHistoryScreen from '../screens/RunHistoryScreen';
import CreatorScreen from '../screens/CreatorScreen';
import QuestsShopScreen from '../screens/QuestsShopScreen';
import PremiumScreen from '../screens/PremiumScreen';
import { withErrorBoundary } from '../components/ErrorBoundary';

const SafeProfile      = withErrorBoundary(ProfileScreen,      'Profile');
const SafeAchievements = withErrorBoundary(AchievementsScreen, 'Achievements');
const SafeLeaderboard  = withErrorBoundary(LeaderboardScreen,  'Leaderboard');
const SafeFitness      = withErrorBoundary(FitnessScreen,      'Fitness');
const SafeChatBot      = withErrorBoundary(ChatBotScreen,      'ChatBot');
const SafeHelpSupport  = withErrorBoundary(HelpSupportScreen,  'HelpSupport');
const SafeTeams        = withErrorBoundary(TeamsScreen,        'Teams');
const SafeActivityFeed = withErrorBoundary(ActivityFeedScreen, 'ActivityFeed');
const SafeRunHistory   = withErrorBoundary(RunHistoryScreen,   'RunHistory');
const SafeCreator      = withErrorBoundary(CreatorScreen,      'Creator');
const SafeQuestsShop   = withErrorBoundary(QuestsShopScreen,   'QuestsShop');
const SafePremium      = withErrorBoundary(PremiumScreen,      'Premium');

export type ProfileStackParamList = {
  ProfileMain: undefined;
  Achievements: undefined;
  Leaderboard: undefined;
  Fitness: undefined;
  ChatBot: undefined;
  HelpSupport: undefined;
  Teams: undefined;
  ActivityFeed: undefined;
  RunHistory: undefined;
  Creator: undefined;
  QuestsShop: undefined;
  Premium: undefined;
};

const Stack = createStackNavigator<ProfileStackParamList>();

export function ProfileStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: '#000' },
        cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
        transitionSpec: {
          open: { animation: 'timing', config: { duration: 220 } },
          close: { animation: 'timing', config: { duration: 200 } },
        },
      }}
    >
      <Stack.Screen name="ProfileMain"  component={SafeProfile} />
      <Stack.Screen name="Achievements" component={SafeAchievements} />
      <Stack.Screen name="Leaderboard"  component={SafeLeaderboard} />
      <Stack.Screen name="Fitness"      component={SafeFitness} />
      <Stack.Screen name="ChatBot"      component={SafeChatBot} />
      <Stack.Screen name="HelpSupport"  component={SafeHelpSupport} />
      <Stack.Screen name="Teams"        component={SafeTeams} />
      <Stack.Screen name="ActivityFeed" component={SafeActivityFeed} />
      <Stack.Screen name="RunHistory"   component={SafeRunHistory} />
      <Stack.Screen name="Creator"      component={SafeCreator} />
      <Stack.Screen name="QuestsShop"   component={SafeQuestsShop} />
      <Stack.Screen name="Premium"      component={SafePremium} />
    </Stack.Navigator>
  );
}
