import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StatusBar, Text, TouchableOpacity, Alert } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';

import { ThemeProvider, ThemeName, useTheme } from '@/utils/ThemeContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';

import RunScreen from './src/screens/RunScreen';
import TerritoriesScreen from './src/screens/TerritoriesScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { FloatingPillTabBar } from './src/components/FloatingPillTabBar';
import { ProfileStackNavigator } from './src/navigation/ProfileStackNavigator';
import OnboardingScreen from './src/screens/OnboardingScreen';
import LoginScreen from './src/screens/LoginScreen';
import SignUpScreen from './src/screens/SignUpScreen';
import ForgotPasswordScreen from './src/screens/ForgotPasswordScreen';
import { ensureUserId } from './src/config/user';
import { reloadUser, logoutUser, configureGoogleSignin } from './src/services/authService';
import { confirmAction } from './src/utils/AlertUtils';
import { getFriendlyErrorMessage } from './src/utils/ErrorUtils';
import { auth } from './src/services/firebase';
import { NotificationService } from './src/services/notificationService';

const Tab = createBottomTabNavigator();

// ─── Main Tabs ────────────────────────────────────────────────────────────────

function MainTabs() {
  const { T, themeName } = useTheme();
  return (
    <>
      <StatusBar barStyle={themeName === 'light' ? 'dark-content' : 'light-content'} backgroundColor={T.black} />
      <Tab.Navigator
        initialRouteName="Run"
        tabBar={(props) => <FloatingPillTabBar {...props} />}
        screenOptions={{ headerShown: false }}
      >
        <Tab.Screen name="Run"         component={RunScreen} />
        <Tab.Screen name="Territories" component={TerritoriesScreen} />
        <Tab.Screen name="Settings"    component={SettingsScreen} />
        <Tab.Screen name="Profile"     component={ProfileStackNavigator} />
      </Tab.Navigator>
    </>
  );
}

// ─── Auth Gate ────────────────────────────────────────────────────────────────

type AuthView = 'login' | 'signup' | 'forgot';

function AuthStack() {
  const [view, setView] = useState<AuthView>('login');
  const { T } = useTheme();
  if (view === 'signup') {
    return <SignUpScreen onGoLogin={() => setView('login')} />;
  }
  if (view === 'forgot') {
    return <ForgotPasswordScreen onGoBack={() => setView('login')} />;
  }
  return (
    <LoginScreen
      onGoSignUp={() => setView('signup')}
      onGoForgot={() => setView('forgot')}
    />
  );
}

// ─── Verify Email Screen ──────────────────────────────────────────────────────

function VerifyEmailScreen() {
  const { T, themeName } = useTheme();
  const { reload } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    try {
      setRefreshing(true);
      await reload();
      if (auth.currentUser?.emailVerified === false) {
        Alert.alert('Still Waiting', 'We haven’t detected the verification yet. Please click the link in your email first.');
      }
    } catch (e) {
      Alert.alert('Refresh Failed', getFriendlyErrorMessage(e));
    } finally {
      setRefreshing(false);
    }
  };

  const onLogout = () => {
    confirmAction({
      title: 'Sign Out',
      message: 'Are you sure you want to sign out?',
      confirmText: 'Sign Out',
      style: 'destructive',
      onConfirm: async () => {
        try {
          await logoutUser();
        } catch (e) {
          Alert.alert('Error', getFriendlyErrorMessage(e));
        }
      }
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.black, alignItems: 'center', justifyContent: 'center', padding: 28 }}>
      <LinearGradient
        colors={themeName === 'light' ? ['#007AFF10', '#007AFF05', T.black] : [T.green + '15', T.black]}
        style={StyleSheet.absoluteFill}
      />
      <View style={{
        width: 80, height: 80, borderRadius: 24,
        backgroundColor: T.card, borderWidth: 1, borderColor: T.border,
        alignItems: 'center', justifyContent: 'center', marginBottom: 24,
      }}>
        <Ionicons name="mail-unread-outline" size={38} color={T.green} />
      </View>

      <Text style={{ fontSize: 28, fontWeight: '900', color: T.white, textAlign: 'center', marginBottom: 12 }}>
        Verify Your Email
      </Text>
      <Text style={{ color: T.text, fontSize: 16, textAlign: 'center', lineHeight: 24, marginBottom: 32 }}>
        We've sent a link to your email.{'\n'}Please verify your account to start conquest.
      </Text>

      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onRefresh}
        disabled={refreshing}
        style={{
          width: '100%', paddingVertical: 16, borderRadius: 14,
          backgroundColor: T.green, alignItems: 'center', marginBottom: 16,
        }}
      >
        {refreshing 
          ? <ActivityIndicator color="#000" />
          : <Text style={{ color: '#000', fontWeight: '800', fontSize: 16 }}>I've Verified My Email</Text>
        }
      </TouchableOpacity>

      <TouchableOpacity onPress={onLogout}>
        <Text style={{ color: T.text, fontWeight: '600', fontSize: 14 }}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── App Content ─────────────────────────────────────────────────────────────

function AppContent() {
  const { T, themeName } = useTheme();
  const { user, loading } = useAuth();
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  const [slowConnection, setSlowConnection] = useState(false);
  const [forcedReady, setForcedReady] = useState(false);

  useEffect(() => {
    // Safety timers
    const slowTimer = setTimeout(() => setSlowConnection(true), 4000);
    const skipTimer = setTimeout(() => setForcedReady(true), 8000);
    
    (async () => {
      const flag = await AsyncStorage.getItem('runquest:onboardingDone');
      setOnboardingDone(!!flag);
    })();

    return () => {
      clearTimeout(slowTimer);
      clearTimeout(skipTimer);
    };
  }, []);

  if ((loading && !forcedReady) || onboardingDone === null) {
    return (
      <View style={{ flex: 1, backgroundColor: T.black, alignItems: 'center', justifyContent: 'center' }}>
        <StatusBar barStyle="light-content" />
        <LinearGradient
          colors={themeName === 'light' ? ['#007AFF10', '#007AFF05', T.black] : [T.green + '15', T.black]}
          style={StyleSheet.absoluteFill}
        />
        <View style={{ alignItems: 'center', gap: 20 }}>
          <View style={{
            width: 90, height: 90, borderRadius: 24,
            backgroundColor: T.card, borderWidth: 1, borderColor: T.border,
            alignItems: 'center', justifyContent: 'center',
            shadowColor: T.green, shadowOpacity: 0.15, shadowRadius: 20,
          }}>
            <Ionicons name="globe" size={44} color={T.green} />
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ color: T.white, fontSize: 28, fontWeight: '900', letterSpacing: -0.5 }}>RunQuest</Text>
            {slowConnection ? (
              <View style={{ marginTop: 24, alignItems: 'center' }}>
                <Text style={{ color: T.text, fontSize: 13, marginBottom: 8, opacity: 0.8 }}>Connecting to servers...</Text>
                <TouchableOpacity onPress={() => {
                  confirmAction({
                    title: 'Skip Loading',
                    message: 'Connection is taking longer than expected. Continue to dashboard?',
                    confirmText: 'Continue',
                    onConfirm: () => setForcedReady(true)
                  });
                }}>
                  <Text style={{ color: T.green, fontSize: 13, fontWeight: '800' }}>Skip to Dashboard</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ActivityIndicator size="small" color={T.green} style={{ marginTop: 24 }} />
            )}
          </View>
        </View>
      </View>
    );
  }

  if (onboardingDone === false) {
    return <OnboardingScreen onDone={() => setOnboardingDone(true)} />;
  }

  if (!user) return <AuthStack />;
  if (!user.emailVerified) return <VerifyEmailScreen />;

  return <MainTabs />;
}

// ─── Root App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [savedTheme, setSavedTheme] = useState<ThemeName>('midnight');
  const [themeReady, setThemeReady] = useState(false);

  useEffect(() => {
    (async () => {
      ensureUserId();
      configureGoogleSignin(); // Configure once at startup
      const t = (await AsyncStorage.getItem('runquest:uiTheme')) as ThemeName | null;
      if (t && ['midnight', 'aurora', 'sunset', 'light'].includes(t)) {
        setSavedTheme(t);
      }
      setThemeReady(true);
      
      // Request permissions silently on startup
      setTimeout(async () => {
        await NotificationService.requestPermissions();
      }, 3000);
    })();
  }, []);

  if (!themeReady) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider initial={savedTheme}>
        <AuthProvider>
          <NavigationContainer>
            <AppContent />
          </NavigationContainer>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
