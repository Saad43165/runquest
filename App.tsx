import React from 'react';
import { StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import RunScreen from './src/screens/RunScreen';
import TerritoriesScreen from './src/screens/TerritoriesScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import LeaderboardScreen from './src/screens/LeaderboardScreen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { ensureUserId } from './src/config/user';
import { palette } from './src/theme';

const Tab = createBottomTabNavigator();
function getIconName(routeName: string) {
  switch (routeName) {
    case 'Run':
      return 'fitness';
    case 'Territories':
      return 'map';
    case 'Leaderboard':
      return 'trophy';
    default:
      return 'person';
  }
}

export default function App() {
  useEffect(() => {
    ensureUserId();
  }, []);
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar barStyle="light-content" />
        <Tab.Navigator
          initialRouteName="Run"
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarActiveTintColor: palette.accent,
            tabBarInactiveTintColor: palette.text,
            tabBarStyle: { backgroundColor: palette.bg, borderTopColor: '#141a33' },
            tabBarIcon: ({ color, size }) => (
              <Ionicons name={getIconName(route.name) as any} size={size} color={color} />
            ),
          })}
        >
          <Tab.Screen name="Run" component={RunScreen} />
          <Tab.Screen name="Territories" component={TerritoriesScreen} />
          <Tab.Screen name="Leaderboard" component={LeaderboardScreen} />
          <Tab.Screen name="Profile" component={ProfileScreen} />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
