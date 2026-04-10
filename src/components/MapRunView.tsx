import React from 'react';
import { Platform } from 'react-native';
import { LatLng } from '../types';

export type MapRunViewProps = {
  region: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number } | null;
  path: LatLng[];
  polygons: { points: LatLng[]; color: string }[];
  showPolygons?: boolean;
  showPath?: boolean;
  /** 'default' = light 2D, 'dark' = dark 2D, '3d' = pitched satellite view */
  tileStyle?: 'default' | 'dark' | '3d';
  accuracyMeters?: number | null;
  headingDeg?: number | null;
};

const NativeMap = Platform.OS !== 'web' ? require('./MapRunView.native').default : null;
const WebMap    = Platform.OS === 'web'  ? require('./MapRunView.web').default  : null;

export default function MapRunView(props: MapRunViewProps) {
  if (Platform.OS === 'web') return WebMap ? <WebMap {...props} /> : null;
  return NativeMap ? <NativeMap {...props} /> : null;
}