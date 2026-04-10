import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export function AppLogo({ size = 80, color = '#32D74B' }: { size?: number; color?: string }) {
  const borderRadius = size * 0.3;
  const iconSize = size * 0.55;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
       <LinearGradient
         colors={[color, color + 'CC']}
         style={[styles.gradient, { borderRadius }]}
         start={{ x: 0, y: 0 }}
         end={{ x: 1, y: 1 }}
       >
          <Ionicons name="location" size={iconSize} color="#000" />
          <View style={[styles.path, { width: size * 0.4, height: size * 0.08, backgroundColor: '#000', borderRadius: 99, position: 'absolute', bottom: size * 0.25 }]} />
       </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  gradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  path: {
     // Stylized run path under the location pin
  }
});
