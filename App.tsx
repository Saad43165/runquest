import 'react-native-gesture-handler';
import React, { useEffect, useState, useRef } from 'react';
import { View, ActivityIndicator, StatusBar, Text, TouchableOpacity, Alert, Animated, Image, Dimensions, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import * as Font from 'expo-font';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

import { ThemeProvider, ThemeName, useTheme } from '@/utils/ThemeContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { TerritoriesProvider } from './src/context/TerritoriesContext';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { auth } from './src/services/firebase';


import RunScreen from './src/screens/RunScreen';
import TerritoriesScreen from './src/screens/TerritoriesScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { FloatingPillTabBar } from './src/components/FloatingPillTabBar';
import { MinimalTabBar } from './src/components/MinimalTabBar';
import { GlassTabBar } from './src/components/GlassTabBar';
import { CurvedTabBar } from './src/components/CurvedTabBar';
import { ProfileStackNavigator } from './src/navigation/ProfileStackNavigator';
import OnboardingScreen from './src/screens/OnboardingScreen';
import LoginScreen from './src/screens/LoginScreen';
import SignUpScreen from './src/screens/SignUpScreen';
import ForgotPasswordScreen from './src/screens/ForgotPasswordScreen';
import { getSettings } from './src/config/settings';
import { subscribeSettingsChange } from './src/config/settingsEvents';
import { getRunStore, subscribeRunStore } from './src/store/useRunStore';
import { ensureUserId } from './src/config/user';
import { reloadUser, logoutUser } from './src/services/authService';
import { confirmAction } from './src/utils/AlertUtils';
import { getFriendlyErrorMessage } from './src/utils/ErrorUtils';
import { NotificationService } from './src/services/notificationService';

// Map preloading is native-only (web uses Leaflet component)
const mapPreload =
  Platform.OS === 'web'
    ? null
    : require('./src/components/MapRunView.native');

const Tab = createBottomTabNavigator();

// ─── Animated Splash Screen ───────────────────────────────────────────────────
function SplashScreen({ onDone }: { onDone: () => void }) {
  const logoScale = useRef(new Animated.Value(0.7)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const dotAnim = useRef(new Animated.Value(0)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, { toValue: 1, useNativeDriver: true, tension: 60, friction: 8 }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
      Animated.timing(textOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(taglineOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();

    const dotLoop = Animated.loop(Animated.sequence([
      Animated.timing(dotAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(dotAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]));
    dotLoop.start();

    return () => { dotLoop.stop(); };
  }, []);

  const exitAndDone = () => {
    Animated.timing(screenOpacity, { toValue: 0, duration: 350, useNativeDriver: true }).start(() => onDone());
  };

  return (
    <Animated.View style={{ flex: 1, backgroundColor: '#0A0C10', alignItems: 'center', justifyContent: 'center', opacity: screenOpacity }}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0C10" />

      {/* Logo */}
      <Animated.View style={{
        transform: [{ scale: logoScale }],
        opacity: logoOpacity,
        marginBottom: 28,
        alignItems: 'center',
      }}>
        <Image
          source={require('./assets/icon.png')}
          style={{ width: 120, height: 120, borderRadius: 28 }}
          resizeMode="contain"
        />
      </Animated.View>

      {/* App name */}
      <Animated.Text style={{
        color: '#FFFFFF',
        fontSize: 36,
        fontWeight: '900',
        letterSpacing: -1,
        opacity: textOpacity,
        marginBottom: 8,
      }}>
        RunQuest
      </Animated.Text>

      {/* Tagline */}
      <Animated.Text style={{
        color: 'rgba(255,255,255,0.45)',
        fontSize: 14,
        fontWeight: '500',
        letterSpacing: 2,
        opacity: taglineOpacity,
        marginBottom: 60,
        textTransform: 'uppercase',
      }}>
        Run · Claim · Conquer
      </Animated.Text>

      {/* Loading indicator — thin bar using opacity pulse (width not supported by native driver) */}
      <View style={{ position: 'absolute', bottom: 60, left: 60, right: 60 }}>
        <View style={{ height: 2, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 1, overflow: 'hidden' }}>
          <Animated.View style={{
            height: '100%',
            width: '100%',
            backgroundColor: '#00C6FF',
            borderRadius: 1,
            opacity: dotAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.3, 1, 0.3] }),
          }} />
        </View>
      </View>

      {/* Hidden trigger — calls onDone after minimum display time */}
      <SplashTimer onDone={exitAndDone} />
    </Animated.View>
  );
}

function SplashTimer({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    // Show splash for minimum 1.2s — enough for branding, not annoying
    const t = setTimeout(onDone, 1200);
    return () => clearTimeout(t);
  }, []);
  return null;
}
// ─── Tab bar selector ─────────────────────────────────────────────────────────
function TabBarSelector(props: any) {
  const [navbarStyle, setNavbarStyle] = React.useState<string>('pill');

  React.useEffect(() => {
    // Load initial value
    getSettings().then(s => setNavbarStyle(s.navbarStyle || 'pill'));
    // Subscribe to instant updates (e.g. from ChatBot)
    const unsub = subscribeSettingsChange(() => {
      getSettings().then(s => setNavbarStyle(s.navbarStyle || 'pill'));
    });
    return unsub;
  }, []);

  if (navbarStyle === 'minimal') return <MinimalTabBar {...props} />;
  if (navbarStyle === 'glass')   return <GlassTabBar {...props} />;
  if (navbarStyle === 'curved')  return <CurvedTabBar {...props} />;
  return <FloatingPillTabBar {...props} />;
}

// ─── Main Tabs ────────────────────────────────────────────────────────────────

function MainTabs() {
  const { T, themeName } = useTheme();

  return (
    <TerritoriesProvider>
      <StatusBar barStyle={themeName === 'light' ? 'dark-content' : 'light-content'} backgroundColor={T.black} />
      <View style={{ flex: 1 }}>
        <Tab.Navigator
          initialRouteName="Run"
          tabBar={props => <TabBarSelector {...props} />}
          screenOptions={{ headerShown: false }}
        >
          <Tab.Screen name="Run"         component={RunScreen} />
          <Tab.Screen name="Territories" component={TerritoriesScreen} />
          <Tab.Screen name="Settings"    component={SettingsScreen} />
          <Tab.Screen name="Profile"     component={ProfileStackNavigator} />
        </Tab.Navigator>
      </View>
    </TerritoriesProvider>
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
        accessibilityLabel="I have verified my email, tap to continue"
        accessibilityRole="button"
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

      <TouchableOpacity
        onPress={onLogout}
        accessibilityLabel="Sign out of RunQuest"
        accessibilityRole="button"
      >
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
  const [forcedReady, setForcedReady] = useState(false);
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    const skipTimer = setTimeout(() => setForcedReady(true), 8000);
    (async () => {
      const flag = await AsyncStorage.getItem('runquest:onboardingDone');
      setOnboardingDone(!!flag);
    })();
    return () => clearTimeout(skipTimer);
  }, []);

  const appReady = (!loading || forcedReady) && onboardingDone !== null;

  // Exit splash as soon as BOTH conditions are met — no artificial extra wait
  const shouldShowSplash = !splashDone || !appReady;

  if (shouldShowSplash) {
    return (
      <SplashScreen onDone={() => setSplashDone(true)} />
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

const linking: any = {
  prefixes: ['runquest://', 'https://runquest-app-75bc8.firebaseapp.com'],
  config: {
    screens: {
      Run: 'run',
      Territories: 'territories',
      Settings: 'settings',
      Profile: {
        screens: {
          ProfileMain: 'profile',
          Achievements: 'achievements',
          Leaderboard: 'leaderboard',
          Fitness: 'fitness',
          ChatBot: 'chat',
          HelpSupport: 'help',
        },
      },
    },
  },
};

export default function App() {
  const [savedTheme, setSavedTheme] = useState<ThemeName>('midnight');
  const [themeReady, setThemeReady] = useState(false);
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    // Preload Ionicons font so icons never render as empty squares
    Font.loadAsync({
      ...Ionicons.font,
    }).catch(() => {}).finally(() => setFontsLoaded(true));

    // Preload MapLibre GL from bundle in background — map loads instantly when user opens Run screen
    // Also warm up the last-known location cache
    mapPreload?.loadMapLibreAssets?.().catch(() => {});
    mapPreload?.getLastLocation?.().catch(() => {}); // warm up AsyncStorage read
  }, []);

  useEffect(() => {
    (async () => {
      ensureUserId();
      const t = (await AsyncStorage.getItem('runquest:uiTheme')) as ThemeName | null;
      if (t && ['midnight', 'aurora', 'sunset', 'light'].includes(t)) {
        setSavedTheme(t);
      }
      setThemeReady(true);

      setTimeout(async () => {
        await NotificationService.requestPermissions();
      }, 3000);
    })();
  }, []);

  // Block render until both fonts AND theme are ready — prevents icon flash
  if (!themeReady || !fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider initial={savedTheme}>
        <AuthProvider>
          <ErrorBoundary fallbackMessage="RunQuest encountered an error. Please restart the app.">
            <NavigationContainer linking={linking}>
              <AppContent />
            </NavigationContainer>
          </ErrorBoundary>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
