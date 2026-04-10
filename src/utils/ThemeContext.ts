// theme context
import React, { createContext, useContext, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Theme definitions ───────────────────────────────────────────────────────

export type ThemeName = 'midnight' | 'aurora' | 'sunset' | 'light';

export interface ThemeTokens {
  black: string;
  surface: string;
  card: string;
  border: string;
  muted: string;
  white: string;
  text: string;
  green: string;
  greenDim: string;
  accent2: string;
  red: string;
  gold: string;
  orange: string;
}

export const THEMES: Record<ThemeName, ThemeTokens> = {
  midnight: {
    black:    '#000000',
    surface:  '#000000',
    card:     '#1C1C1E',
    border:   '#38383A',
    muted:    '#2C2C2E',
    white:    '#FFFFFF',
    text:     '#8E8E93',
    green:    '#32D74B',
    greenDim: '#32D74B20',
    accent2:  '#0A84FF',
    red:      '#FF453A',
    gold:     '#FFD60A',
    orange:   '#FF9F0A',
  },
  aurora: {
    black:    '#051114',
    surface:  '#051114',
    card:     '#0B1B20',
    border:   '#16323B',
    muted:    '#11252D',
    white:    '#E2F5FA',
    text:     '#7AA0AB',
    green:    '#64D2B2',
    greenDim: '#64D2B220',
    accent2:  '#00C6FF',
    red:      '#FF6B6B',
    gold:     '#F6D365',
    orange:   '#FDA085',
  },
  sunset: {
    black:    '#180F08',
    surface:  '#180F08',
    card:     '#24150D',
    border:   '#3C2214',
    muted:    '#2D1A0F',
    white:    '#F2E5DD',
    text:     '#B89986',
    green:    '#FFC247',
    greenDim: '#FFC24720',
    accent2:  '#FF6B52',
    red:      '#E63946',
    gold:     '#FFD700',
    orange:   '#FF8C00',
  },
  light: {
    black:    '#F2F2F7', // Main screen background (light gray)
    surface:  '#FFFFFF', // Card/Header background (pure white)
    card:     '#FFFFFF', // Input/Action background
    border:   '#D1D1D6', // Standard iOS light border
    muted:    '#E5E5EA', // Secondary background
    white:    '#000000', // Primary text color (inverted for light mode)
    text:     '#636366', // Secondary text color
    green:    '#248A3D', // Darker green for readability on white
    greenDim: '#248A3D15',
    accent2:  '#007AFF', // Standard iOS blue
    red:      '#FF3B30',
    gold:     '#A2845E',
    orange:   '#FF9500',
  },
};

// ─── Context types ────────────────────────────────────────────────────────────

interface ThemeContextValue {
  themeName: ThemeName;
  T: ThemeTokens;
  setTheme: (name: ThemeName) => void;
}

// Default/fallback value (used if no provider is found)
const defaultContextValue: ThemeContextValue = {
  themeName: 'midnight',
  T: THEMES.midnight,
  setTheme: () => {},
};

const ThemeContext = createContext<ThemeContextValue>(defaultContextValue);

// ─── Provider ─────────────────────────────────────────────────────────────────

interface ThemeProviderProps {
  children: React.ReactNode;
  initial?: ThemeName;
}

export function ThemeProvider({
  children,
  initial = 'midnight',
}: ThemeProviderProps) {
  const [themeName, setThemeName] = useState<ThemeName>(initial);

  const setTheme = useCallback(async (name: ThemeName) => {
    setThemeName(name);
    try {
      await AsyncStorage.setItem('runquest:uiTheme', name);
    } catch (e) {
      console.warn('Failed to save theme preference', e);
    }
  }, []);

  const value: ThemeContextValue = {
    themeName,
    T: THEMES[themeName],
    setTheme,
  };

  return React.createElement(ThemeContext.Provider, { value }, children);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  return context;
}
