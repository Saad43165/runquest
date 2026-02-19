import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import MapRunView from '../components/MapRunView';
import { useRunTracker } from '../hooks/useRunTracker';
import { Territory } from '../types';
import { subscribeTerritories, claimAndConquerRemote } from '../services/territoriesRemote';
import { pathPerimeter, polygonAreaSqMeters, pathDistance } from '../utils/geometry';
import { palette, spacing } from '../theme';

export default function RunScreen() {
  const { state, path, region, startedAt, startRun, stopRun, reset, closedLoop } = useRunTracker();
  const [territories, setTerritories] = useState<Territory[]>([]);

  useEffect(() => {
    let unsub: any = null;
    (async () => {
      unsub = await subscribeTerritories((list) => setTerritories(list));
    })();
    return () => {
      if (typeof unsub === 'function') {
        unsub();
      }
    };
  }, []);

  const onClaim = async () => {
    if (!closedLoop || path.length < 3) {
      Alert.alert('Loop not detected', 'Complete a loop to claim territory.');
      return;
    }
    const name = `Territory ${new Date().toLocaleTimeString()}`;
    const res = await claimAndConquerRemote(name, path);
    if (!res) {
      Alert.alert('Service not configured', 'Please set Firebase config to enable global territories.');
    } else {
      const msg = res.conquered.length > 0 ? `Claimed and conquered ${res.conquered.length} territory` : 'Territory claimed';
      Alert.alert(msg, `Perimeter: ${res.claimed.perimeterMeters}m, Area: ${res.claimed.areaSqMeters}m²`);
    }
    reset();
  };

  const perimeter = pathPerimeter(path);
  const area = polygonAreaSqMeters(path);
  const distance = pathDistance(path);
  const elapsed = startedAt ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : 0;
  const pace = distance > 0 && elapsed > 0 ? Math.round((elapsed / 60) / (distance / 1000) * 100) / 100 : 0;

  return (
    <View style={styles.root}>
      <MapRunView
        region={region}
        path={path}
        polygons={territories.map((t) => ({ points: t.polygon, color: t.color }))}
      />
      <View style={styles.overlay}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>RunQuest</Text>
          <View style={styles.loopBadge}>
            <Text style={styles.loopText}>{closedLoop ? 'Loop Closed' : 'Tracking'}</Text>
          </View>
        </View>
        <View style={styles.card}>
          <View style={styles.statsRow}>
            <Stat label="Distance" value={`${Math.round(distance)} m`} />
            <Stat label="Pace" value={pace ? `${pace} min/km` : '-'} />
            <Stat label="Perimeter" value={`${Math.round(perimeter)} m`} />
            <Stat label="Area" value={`${Math.round(area)} m²`} />
          </View>
        </View>
        <View style={styles.controls}>
          {state === 'idle' && (
            <PrimaryButton onPress={startRun} text="Start Run" />
          )}
          {state === 'running' && (
            <PrimaryButton onPress={stopRun} text="Finish" />
          )}
          {state === 'finished' && (
            <>
              <PrimaryButton onPress={onClaim} text={closedLoop ? 'Claim Territory' : 'Loop Not Closed'} disabled={!closedLoop} />
              <SecondaryButton onPress={reset} text="Reset" />
            </>
          )}
        </View>
      </View>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function PrimaryButton({ text, onPress, disabled }: { text: string; onPress: () => void; disabled?: boolean }) {
  return (
    <TouchableOpacity style={[styles.button, disabled && styles.buttonDisabled]} onPress={onPress} disabled={disabled}>
      <Text style={styles.buttonText}>{text}</Text>
    </TouchableOpacity>
  );
}

function SecondaryButton({ text, onPress }: { text: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.button, styles.buttonSecondary]} onPress={onPress}>
      <Text style={styles.buttonText}>{text}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.md,
    backgroundColor: 'rgba(11, 16, 38, 0.9)',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16
  },
  title: {
    color: palette.white,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: spacing.sm
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm
  },
  loopBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    backgroundColor: palette.muted
  },
  loopText: {
    color: palette.white,
    fontSize: 12,
    fontWeight: '600'
  },
  card: {
    backgroundColor: palette.card,
    borderRadius: 12,
    padding: spacing.sm,
    marginBottom: spacing.sm
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm
  },
  stat: {
    alignItems: 'center',
    flex: 1
  },
  statLabel: {
    color: palette.text,
    fontSize: 12
  },
  statValue: {
    color: palette.white,
    fontSize: 14,
    fontWeight: '600'
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm
  },
  button: {
    flex: 1,
    paddingVertical: spacing.sm,
    backgroundColor: palette.accent,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonSecondary: {
    backgroundColor: palette.muted,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: palette.darkText,
    fontSize: 15,
    fontWeight: '700',
  }
});
