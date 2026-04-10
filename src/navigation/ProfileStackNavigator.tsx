import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import ProfileScreen from '../screens/ProfileScreen';
import AchievementsScreen from '../screens/AchievementsScreen';
import LeaderboardScreen from '../screens/LeaderboardScreen';
import FitnessScreen from '../screens/FitnessScreen';
import ChatBotScreen from '../screens/ChatBotScreen';
import HelpSupportScreen from '../screens/HelpSupportScreen';

export type ProfileStackParamList = {
  ProfileMain: undefined;
  Achievements: undefined;
  Leaderboard: undefined;
  Fitness: undefined;
  ChatBot: undefined;
  HelpSupport: undefined;
};

const Stack = createStackNavigator<ProfileStackParamList>();

export function ProfileStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, cardStyle: { backgroundColor: 'transparent' } }}>
      <Stack.Screen name="ProfileMain"  component={ProfileScreen} />
      {/* Sub-screens — tab bar hidden via tabBarStyle on parent Tab.Screen */}
      <Stack.Screen name="Achievements" component={AchievementsScreen} />
      <Stack.Screen name="Leaderboard"  component={LeaderboardScreen} />
      <Stack.Screen name="Fitness"      component={FitnessScreen} />
      <Stack.Screen name="ChatBot"      component={ChatBotScreen} />
      <Stack.Screen name="HelpSupport"  component={HelpSupportScreen} />
    </Stack.Navigator>
  );
}
