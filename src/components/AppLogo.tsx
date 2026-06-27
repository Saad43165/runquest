import React from 'react';
import { Image, View, StyleSheet } from 'react-native';

const APP_ICON = require('../../assets/icon.png');

interface Props {
  size?: number;
  style?: object;
}

export function AppLogo({ size = 80, style }: Props) {
  // icon.png is a perfect square
  const W = size;
  const H = size;
  return (
    <View style={[{ width: W, height: H, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' }, style]}>
      <Image
        source={APP_ICON}
        style={{ width: W, height: H }}
        resizeMode="cover"
      />
    </View>
  );
}

const styles = StyleSheet.create({});
