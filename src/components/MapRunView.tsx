import React, { forwardRef } from 'react';
import { Platform } from 'react-native';
import { LatLng } from '../types';

export type MapRunViewProps = {
  region: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number } | null;
  path: LatLng[];
  polygons: { points: LatLng[]; color: string; ownerName?: string; ownerPhotoURL?: string | null; ownerId?: string }[];
  showPolygons?: boolean;
  showPath?: boolean;
  tileStyle?: 'default' | 'dark' | 'satellite' | '3d';
  accuracyMeters?: number | null;
  headingDeg?: number | null;
  showZoomButtons?: boolean;
  showNearbyTerritories?: boolean;
  goalCircleKm?: number | null;
  liveUsers?: { uid: string; displayName: string; photoURL: string | null; latitude: number; longitude: number; isRunning: boolean; avatarIndex?: number }[];
  showLiveUsers?: boolean;
  avatarIndex?: number;
  pathStyle?: 'solid' | 'dashed' | 'glow';
  pathColor?: string;
};

export type MapRunViewRef = {
  flyTo: (lat: number, lng: number, zoom?: number) => void;
  recenter: (lat: number, lng: number) => void;
};

const NativeMap = Platform.OS !== 'web' ? require('./MapRunView.native').default : null;
const WebMap    = Platform.OS === 'web'  ? require('./MapRunView.web').default  : null;

const MapRunView = forwardRef<MapRunViewRef, MapRunViewProps>((props, ref) => {
  if (Platform.OS === 'web') return WebMap ? <WebMap {...props} /> : null;
  return NativeMap ? <NativeMap ref={ref} {...props} /> : null;
});

export default MapRunView;
