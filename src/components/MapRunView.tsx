import React from 'react';
import { Platform } from 'react-native';
import NativeImpl from './MapRunView.native';
import WebImpl from './MapRunView.web';
import { LatLng } from '../types';
import type { Region } from 'react-native-maps';

type Props = {
  region: Region | null;
  path: LatLng[];
  polygons: { points: LatLng[]; color: string }[];
};

export default function MapRunView(props: Props) {
  if (Platform.OS === 'web') {
    return <WebImpl {...props} />;
  }
  return <NativeImpl {...props} />;
}
