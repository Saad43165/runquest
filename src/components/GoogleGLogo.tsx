import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Clean flat standard Google logo.
 */
export function GoogleGLogo({ size = 20 }: { size?: number }) {
  return (
    <View style={{ width: size + 4, height: size + 4, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF', borderRadius: 99 }}>
      <Ionicons name="logo-google" size={size} color="#DB4437" />
    </View>
  );
}
