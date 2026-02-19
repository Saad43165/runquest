import React from 'react';
import MapView, { Marker, Polyline, Polygon, Region } from 'react-native-maps';
import { View, StyleSheet } from 'react-native';
import { palette } from '../theme';
import { LatLng } from '../types';

type Props = {
  region: Region | null;
  path: LatLng[];
  polygons: { points: LatLng[]; color: string }[];
};

export default function MapRunView({ region, path, polygons }: Props) {
  return (
    <View style={styles.container}>
      {region && (
        <MapView
          style={StyleSheet.absoluteFill}
          initialRegion={region}
          region={region}
          showsUserLocation
          showsMyLocationButton
          mapPadding={{ top: 32, right: 12, bottom: 32, left: 12 }}
        >
          {path.length > 0 && (
            <>
              <Marker coordinate={path[0]} />
              <Polyline coordinates={path} strokeColor={palette.accent} strokeWidth={4} />
            </>
          )}
          {polygons.map((p, idx) => (
            <Polygon
              key={idx}
              coordinates={p.points}
              strokeColor={p.color}
              fillColor={`${p.color.replace('hsl', 'hsla').replace(')', ', 0.25)')}`}
              strokeWidth={2}
            />
          ))}
        </MapView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.bg,
  }
});
