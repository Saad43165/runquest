import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  ScrollView, Image, Modal, ActivityIndicator, Linking, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Territory } from '../../types';
import { useTheme } from '@/utils/ThemeContext';
import * as Haptics from 'expo-haptics';
import { removeTerritoryRemote, defendTerritoryRemote } from '../../services/territoriesRemote';
import { confirmAction } from '../../utils/AlertUtils';

// ─── Lat/Lng → tile XY ───────────────────────────────────────────────────────
function latLngToTile(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const n = Math.pow(2, zoom);
  const x = Math.floor((lng + 180) / 360 * n);
  const latRad = lat * Math.PI / 180;
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
  return { x, y };
}

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

type TerritoryDetailModalProps = {
  visible: boolean;
  item: Territory | null;
  uid: string;
  myName: string;
  myPhotoURL: string | null;
  onClose: () => void;
  navigation: any;
  insets: any;
};

export default function TerritoryDetailModal({
  visible, item, uid, myName, myPhotoURL, onClose, navigation, insets
}: TerritoryDetailModalProps) {
  const { T } = useTheme();
  const slideAnim = useRef(new Animated.Value(900)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [showDefendModal, setShowDefendModal] = useState(false);
  const [defending, setDefending] = useState(false);

  useEffect(() => {
    if (visible) {
      setMapLoaded(false);
      setMapError(false);
      Animated.parallel([
        Animated.timing(opacityAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 65, friction: 13 }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacityAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 900, duration: 240, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, opacityAnim, slideAnim]);

  if (!item) return null;

  const isMe = item.ownerId === uid;
  const ownerName = isMe ? (myName || 'You') : (item.ownerUsername || item.ownerDisplayName || 'Unknown Warrior');
  const tileUrl = buildTileFallbackUrl(item.polygon);
  const areaKm2 = (item.areaSqMeters / 1_000_000).toFixed(4);
  const bottomPad = insets.bottom + 100;
  const displayPhotoURL = isMe ? myPhotoURL : item.ownerPhotoURL;

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, { opacity: opacityAnim, zIndex: 999 }]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <TouchableOpacity
        style={[StyleSheet.absoluteFill, styles.backdrop]}
        activeOpacity={1}
        onPress={onClose}
      />

      <Animated.View style={[
        styles.detailSheet,
        { backgroundColor: T.black, transform: [{ translateY: slideAnim }] },
      ]}>
        <View style={styles.detailMapWrap}>
          {tileUrl && !mapError ? (
            <Image
              source={{ uri: tileUrl }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
              onLoad={() => setMapLoaded(true)}
              onError={() => setMapError(true)}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: item.color + '20' }, styles.mapFallback]}>
              <Ionicons name="map" size={48} color={item.color} />
            </View>
          )}
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.6)']} style={StyleSheet.absoluteFill} />
          <View style={[styles.bottomStripe, { backgroundColor: item.color }]} />
          <TouchableOpacity onPress={onClose} style={styles.detailClose}>
            <Ionicons name="close" size={20} color="#FFF" />
          </TouchableOpacity>
          
          <View style={styles.headerContent}>
            <Text style={styles.territoryName}>
              {item.name}
            </Text>
            <View style={styles.ownerBadge}>
              <OwnerAvatar photoURL={displayPhotoURL} ownerId={item.ownerId} color={item.color} size={44} />
              <View style={{ flex: 1 }}>
                <Text style={styles.ownerNameText}>
                  {ownerName}
                </Text>
                <Text style={styles.claimedText}>
                  Claimed {new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
              </View>
              {isMe && (
                <View style={[styles.yoursBadge, { backgroundColor: item.color + 'DD' }]}>
                  <Text style={styles.yoursText}>YOURS</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 18, paddingBottom: bottomPad }}
          bounces={true}
        >
          <View style={styles.statsRow}>
            {[
              { label: 'AREA', value: Math.round(item.areaSqMeters).toLocaleString(), unit: 'm²', icon: 'expand-outline', color: T.accent2 },
              { label: 'PERIMETER', value: Math.round(item.perimeterMeters).toLocaleString(), unit: 'm', icon: 'git-commit-outline', color: T.gold },
              { label: 'CLAIMED', value: new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), unit: '', icon: 'calendar-outline', color: T.green },
            ].map(s => (
              <View key={s.label} style={[styles.detailStat, { backgroundColor: T.card, borderColor: T.border }]}>
                <View style={[styles.statIconWrap, { backgroundColor: s.color + '22' }]}>
                  <Ionicons name={s.icon as any} size={14} color={s.color} />
                </View>
                <Text style={[styles.statValue, { color: T.white }]}>{s.value}</Text>
                {s.unit ? <Text style={[styles.statUnit, { color: s.color }]}>{s.unit}</Text> : null}
                <Text style={[styles.statLabel, { color: T.text }]}>{s.label}</Text>
              </View>
            ))}
          </View>

          {item.polygon && item.polygon.length > 0 && (() => {
            const centLat = item.polygon.reduce((s, p) => s + p.latitude, 0) / item.polygon.length;
            const centLng = item.polygon.reduce((s, p) => s + p.longitude, 0) / item.polygon.length;
            return (
              <TouchableOpacity
                onPress={() => {
                  onClose();
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setTimeout(() => {
                    try {
                      const tabNav = navigation.getParent?.() ?? navigation;
                      tabNav.navigate('Run', { flyTo: { lat: centLat, lng: centLng, zoom: 16 } });
                    } catch {
                      Linking.openURL(`https://maps.google.com/?q=${centLat},${centLng}`);
                    }
                  }, 350);
                }}
                activeOpacity={0.85}
                style={styles.viewOnMapBtn}
              >
                <View style={styles.viewOnMapIconWrap}>
                  <Ionicons name="navigate" size={18} color="#0A84FF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.viewOnMapText}>View on Map</Text>
                  <Text style={[styles.viewOnMapCoords, { color: T.text }]}>
                    {centLat.toFixed(4)}°, {centLng.toFixed(4)}°
                  </Text>
                </View>
                <Ionicons name="arrow-forward-circle" size={20} color="#0A84FF" />
              </TouchableOpacity>
            );
          })()}

          {item.expiresAt && (
            <View style={[styles.detailInfoRow, { backgroundColor: T.card, borderColor: T.border }]}>
              <View style={[styles.infoIconWrap, { backgroundColor: '#FF9F0A22' }]}>
                <Ionicons name="time-outline" size={16} color="#FF9F0A" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.infoMainText, { color: T.white }]}>
                  Expires: {new Date(item.expiresAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
                <Text style={[styles.infoSubText, { color: T.text }]}>
                  {item.expiresAt - Date.now() < 48 * 60 * 60 * 1000 ? '⚠ Expires within 48 hours!' : `${Math.ceil((item.expiresAt - Date.now()) / (24 * 60 * 60 * 1000))} days remaining`}
                </Text>
              </View>
            </View>
          )}

          <View style={[styles.detailInfoRow, { backgroundColor: T.card, borderColor: T.border }]}>
            <View style={[styles.infoIconWrap, { backgroundColor: item.color + '22' }]}>
              <Ionicons name="globe-outline" size={16} color={item.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.infoMainText, { color: T.white }]}>{areaKm2} km²</Text>
              <Text style={[styles.infoSubText, { color: T.text }]}>{item.polygon?.length || 0} GPS boundary points</Text>
            </View>
            <View style={[styles.colorDot, { backgroundColor: item.color }]} />
          </View>

          {item.polygon && item.polygon.length > 0 && (
            <View style={[styles.detailInfoRow, { backgroundColor: T.card, borderColor: T.border }]}>
              <View style={[styles.infoIconWrap, { backgroundColor: T.accent2 + '22' }]}>
                <Ionicons name="location-outline" size={16} color={T.accent2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.infoMainText, { color: T.white }]}>
                  {item.polygon[0].latitude.toFixed(4)}°, {item.polygon[0].longitude.toFixed(4)}°
                </Text>
                <Text style={[styles.infoSubText, { color: T.text }]}>Territory center coordinates</Text>
              </View>
            </View>
          )}

          {item.history && item.history.length > 0 && (
            <View style={styles.historySection}>
              <Text style={[styles.sectionTitle, { color: T.text }]}>CONQUEST HISTORY</Text>
              {item.history.map((entry, i) => (
                <View key={i} style={styles.historyRow}>
                  <View style={[styles.historyIconWrap, { backgroundColor: T.card, borderColor: T.border }]}>
                    <Ionicons name="person-outline" size={14} color={T.text} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.historyName, { color: T.white }]}>{entry.ownerName}</Text>
                    <Text style={[styles.historyDate, { color: T.text }]}>
                      conquered on {new Date(entry.conqueredAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </Text>
                  </View>
                  <Ionicons name="skull-outline" size={14} color={T.text + '60'} />
                </View>
              ))}
            </View>
          )}

          {isMe && (
            <>
              {item.expiresAt && (
                <Text style={[styles.expiryStatus, { color: T.text }]}>
                  {item.expiresAt - Date.now() < 0
                    ? '⚠ This territory has expired'
                    : `${Math.ceil((item.expiresAt - Date.now()) / 86400000)} days remaining`}
                </Text>
              )}
              <TouchableOpacity
                onPress={() => setShowDefendModal(true)}
                style={[styles.detailDeleteBtn, { backgroundColor: T.green + '14', borderColor: T.green + '40', marginBottom: 10 }]}
              >
                <Ionicons name="shield-checkmark-outline" size={18} color={T.green} />
                <Text style={{ color: T.green, fontSize: 15, fontWeight: '800' }}>Defend Territory</Text>
              </TouchableOpacity>

              <Modal visible={showDefendModal} transparent animationType="fade" onRequestClose={() => setShowDefendModal(false)}>
                <View style={styles.modalBackdrop}>
                  <View style={styles.modalCard}>
                    <View style={[styles.modalIconWrap, { backgroundColor: T.green + '18' }]}>
                      <Ionicons name="shield-checkmark" size={28} color={T.green} />
                    </View>
                    <Text style={styles.modalTitle}>Defend Territory</Text>
                    <Text style={styles.modalDesc}>
                      Territories expire after 7 days. Defending resets the timer to 7 more days.
                    </Text>
                    <Text style={[styles.modalActionText, { color: T.green }]}>
                      "{item.name}" will be protected for 7 more days.
                    </Text>
                    <View style={styles.modalActions}>
                      <TouchableOpacity
                        onPress={() => setShowDefendModal(false)}
                        style={styles.modalCancelBtn}
                      >
                        <Text style={styles.modalCancelText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={async () => {
                          setDefending(true);
                          const ok = await defendTerritoryRemote(item.id);
                          setDefending(false);
                          setShowDefendModal(false);
                          if (ok) {
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            Alert.alert('🛡️ Territory Defended!', `"${item.name}" is now protected for 7 more days.`);
                          } else {
                            Alert.alert('Failed', 'Could not defend territory. Please try again.');
                          }
                        }}
                        disabled={defending}
                        style={[styles.modalConfirmBtn, { backgroundColor: T.green }]}
                      >
                        {defending ? <ActivityIndicator color="#000" size="small" /> : <Text style={styles.modalConfirmText}>Defend!</Text>}
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </Modal>
            </>
          )}

          {isMe && (
            <TouchableOpacity
              onPress={() => {
                onClose();
                setTimeout(() => {
                  confirmAction({
                    title: 'Release Territory',
                    message: `Remove "${item.name}" from your kingdom? This cannot be undone.`,
                    confirmText: 'Release',
                    style: 'destructive',
                    onConfirm: async () => { await removeTerritoryRemote(item.id); },
                  });
                }, 350);
              }}
              style={[styles.detailDeleteBtn, { backgroundColor: T.red + '14', borderColor: T.red + '40' }]}
            >
              <Ionicons name="trash-outline" size={18} color={T.red} />
              <Text style={{ color: T.red, fontSize: 15, fontWeight: '800' }}>Release Territory</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  detailSheet: {
    flex: 1,
    marginTop: 60,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
  },
  detailMapWrap: {
    height: 220,
    position: 'relative',
  },
  mapFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomStripe: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  detailClose: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContent: {
    position: 'absolute',
    bottom: 14,
    left: 16,
    right: 56,
  },
  territoryName: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  ownerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  ownerNameText: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.4,
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  claimedText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    marginTop: 2,
  },
  yoursBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  yoursText: {
    color: '#000',
    fontSize: 10,
    fontWeight: '900',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  detailStat: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
  },
  statIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 7,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '900',
  },
  statUnit: {
    fontSize: 9,
    fontWeight: '800',
    marginTop: 1,
  },
  statLabel: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 3,
  },
  viewOnMapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#0A84FF18',
    borderWidth: 1.5,
    borderColor: '#0A84FF50',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  viewOnMapIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#0A84FF25',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewOnMapText: {
    color: '#0A84FF',
    fontSize: 14,
    fontWeight: '900',
  },
  viewOnMapCoords: {
    fontSize: 11,
    marginTop: 1,
  },
  detailInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  infoIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoMainText: {
    fontSize: 14,
    fontWeight: '700',
  },
  infoSubText: {
    fontSize: 11,
    marginTop: 1,
  },
  colorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  historySection: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 10,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  historyIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyName: {
    fontSize: 13,
    fontWeight: '700',
  },
  historyDate: {
    fontSize: 11,
  },
  expiryStatus: {
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 8,
  },
  detailDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 16,
    borderWidth: 1.5,
    paddingVertical: 14,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  modalCard: {
    backgroundColor: '#111',
    borderRadius: 28,
    padding: 28,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalDesc: {
    color: '#8E8E93',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
  modalActionText: {
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '700',
    marginBottom: 24,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#1C1C1E',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#8E8E93',
    fontWeight: '700',
    fontSize: 15,
  },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
  },
  modalConfirmText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 15,
  },
  avatarContainer: {
    borderWidth: 1.5,
    overflow: 'hidden',
  },
});
