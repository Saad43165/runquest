import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Territory } from '../../types';
import { useTheme } from '@/utils/ThemeContext';

// ─── Lat/Lng → tile XY ───────────────────────────────────────────────────────
function latLngToTile(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const n = Math.pow(2, zoom);
  const x = Math.floor((lng + 180) / 360 * n);
  const latRad = lat * Math.PI / 180;
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
  return { x, y };
}

// Fallback URL using Carto dark tiles (free, no key, no policy issues)
function buildTileFallbackUrl(polygon: { latitude: number; longitude: number }[]): string | null {
  if (!polygon || polygon.length < 3) return null;
  const lats = polygon.map(p => p.latitude);
  const lngs = polygon.map(p => p.longitude);
  const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
  const latSpan = Math.max(...lats) - Math.min(...lats);
  const lngSpan = Math.max(...lngs) - Math.min(...lngs);
  const span = Math.max(latSpan, lngSpan);
  const zoom = span < 0.001 ? 17 : span < 0.005 ? 16 : span < 0.01 ? 15 : span < 0.05 ? 14 : 13;
  const { x, y } = latLngToTile(centerLat, centerLng, zoom);
  return `https://cartodb-basemaps-a.global.ssl.fastly.net/light_all/${zoom}/${x}/${y}.png`;
}

// ─── Avatar styles ────────────────────────────────────────────────────────────
const AVATAR_STYLES = [
  'adventurer', 'adventurer-neutral', 'avataaars', 'avataaars-neutral',
  'big-ears', 'big-ears-neutral', 'big-smile', 'bottts', 'bottts-neutral',
  'croodles', 'croodles-neutral', 'fun-emoji', 'icons', 'identicon',
  'initials', 'lorelei', 'lorelei-neutral', 'micah', 'miniavs', 'notionists',
];

function getAvatarStyle(ownerId: string): string {
  let hash = 0;
  for (let i = 0; i < ownerId.length; i++) {
    hash = (hash * 31 + ownerId.charCodeAt(i)) & 0xffffffff;
  }
  return AVATAR_STYLES[Math.abs(hash) % AVATAR_STYLES.length];
}

function OwnerAvatar({ photoURL, ownerId, color, size = 40 }: {
  photoURL?: string | null;
  ownerId: string;
  color: string;
  size?: number;
}) {
  const [imgError, setImgError] = useState(false);
  const style = getAvatarStyle(ownerId);
  const avatarUrl = photoURL && !imgError
    ? photoURL
    : `https://api.dicebear.com/7.x/${style}/png?seed=${encodeURIComponent(ownerId)}&backgroundColor=transparent&size=128`;

  return (
    <View style={[styles.avatarContainer, {
      width: size, height: size, borderRadius: size / 2.5,
      borderColor: color + '60',
      backgroundColor: color + '20',
    }]}>
      <Image
        source={{ uri: avatarUrl }}
        style={{ width: size, height: size }}
        onError={() => setImgError(true)}
      />
    </View>
  );
}

type TerritoryCardProps = {
  item: Territory;
  uid: string;
  myName: string;
  myPhotoURL: string | null;
  index: number;
  onOpen: () => void;
};

const TerritoryCard = React.memo(function TerritoryCard({ item, uid, myName, myPhotoURL, index, onOpen }: TerritoryCardProps) {
  const { T } = useTheme();
  const anim = useRef(new Animated.Value(0)).current;
  const isMe = item.ownerId === uid;
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState(false);

  useEffect(() => {
    Animated.spring(anim, {
      toValue: 1,
      delay: (index % 8) * 45,
      useNativeDriver: true,
      tension: 60,
      friction: 9
    }).start();
  }, [anim, index]);

  const ownerName = isMe ? (myName || 'You') : (item.ownerUsername || item.ownerDisplayName || 'Unknown Warrior');
  const displayPhotoURL = isMe ? myPhotoURL : item.ownerPhotoURL;
  const tileUrl = buildTileFallbackUrl(item.polygon);
  const expiresSoon = item.expiresAt && (item.expiresAt - Date.now()) < 48 * 60 * 60 * 1000;

  return (
    <Animated.View style={{
      opacity: anim,
      transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
      marginBottom: 14,
    }}>
      <TouchableOpacity
        onPress={onOpen}
        activeOpacity={0.88}
        style={[styles.card, { backgroundColor: T.card, borderColor: isMe ? item.color + '60' : T.border }]}
      >
        <View style={styles.cardMapSection}>
          {tileUrl && !mapError ? (
            <>
              <Image
                source={{ uri: tileUrl }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
                onLoad={() => setMapLoaded(true)}
                onError={() => setMapError(true)}
              />
              {!mapLoaded && (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: item.color + '18', alignItems: 'center', justifyContent: 'center' }]}>
                  <Ionicons name="map-outline" size={28} color={item.color} />
                  <Text style={{ color: item.color, fontSize: 10, fontWeight: '700', marginTop: 6 }}>Loading map...</Text>
                </View>
              )}
            </>
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: item.color + '18', alignItems: 'center', justifyContent: 'center' }]}>
              <Ionicons name="map" size={32} color={item.color} />
            </View>
          )}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.55)']}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.nameOverlay}>
            <Text style={styles.nameText} numberOfLines={1}>
              {item.name}
            </Text>
          </View>
          <View style={[styles.expandIcon, { backgroundColor: 'rgba(0,0,0,0.45)' }]}>
            <Ionicons name="expand-outline" size={14} color="#FFF" />
          </View>
          <View style={[styles.colorStripe, { backgroundColor: item.color }]} />
        </View>

        <View style={styles.cardBody}>
          <View style={styles.bodyContent}>
            <OwnerAvatar photoURL={displayPhotoURL} ownerId={item.ownerId} color={item.color} size={42} />
            <View style={{ flex: 1 }}>
              <View style={styles.ownerHeader}>
                <Text style={[styles.ownerName, { color: isMe ? T.green : T.white }]} numberOfLines={1}>{ownerName}</Text>
                {isMe && (
                  <View style={[styles.meBadge, { backgroundColor: T.green + '20' }]}>
                    <Text style={{ color: T.green, fontSize: 7, fontWeight: '900' }}>YOU</Text>
                  </View>
                )}
                {item.teamId && (
                  <View style={[styles.teamBadge, { backgroundColor: (item.teamColor || '#888') + '30', borderColor: (item.teamColor || '#888') + '60' }]}>
                    <Text style={{ color: item.teamColor || '#888', fontSize: 7, fontWeight: '900' }}>TEAM</Text>
                  </View>
                )}
              </View>
              <View style={styles.statsRow}>
                <Text style={[styles.statArea, { color: T.accent2 }]}>{Math.round(item.areaSqMeters).toLocaleString()} m²</Text>
                <Text style={[styles.dot, { color: T.border }]}>·</Text>
                <Text style={[styles.statDate, { color: T.text }]}>{new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
                {expiresSoon && (
                  <>
                    <Text style={[styles.dot, { color: T.border }]}>·</Text>
                    <Text style={styles.expiryWarn}>⚠ Expires soon</Text>
                  </>
                )}
              </View>
            </View>
            <Ionicons name="chevron-forward" size={15} color={T.text + '60'} />
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  cardMapSection: {
    height: 120,
    position: 'relative',
  },
  nameOverlay: {
    position: 'absolute',
    bottom: 10,
    left: 12,
    right: 40,
  },
  nameText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: -0.2,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  expandIcon: {
    position: 'absolute',
    top: 10,
    right: 12,
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorStripe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  cardBody: {
    padding: 12,
  },
  bodyContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  ownerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ownerName: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  meBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 5,
  },
  teamBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
    alignItems: 'center',
  },
  statArea: {
    fontSize: 12,
    fontWeight: '700',
  },
  statDate: {
    fontSize: 10,
  },
  dot: {
    fontSize: 10,
  },
  expiryWarn: {
    color: '#FF9F0A',
    fontSize: 10,
    fontWeight: '700',
  },
  avatarContainer: {
    borderWidth: 1.5,
    overflow: 'hidden',
  },
});

export default TerritoryCard;
