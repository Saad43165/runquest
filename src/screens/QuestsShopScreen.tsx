import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Modal,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { useTheme } from '@/utils/ThemeContext';
import {
  getInventory,
  buyShopItem,
  getDailyQuests,
  claimQuestReward,
  openChest,
  useXPBoost,
  UserInventory,
  DailyQuest,
  SHOP_ITEMS,
  ShopItem,
} from '@/services/inventoryService';
import { getSettings, updateSettings, Settings } from '@/config/settings';

const { width } = Dimensions.get('window');

function PremiumIcon({ type, size = 20 }: { type: 'gem' | 'shield' | 'boost' | 'chest'; size?: number }) {
  const configs = {
    gem: {
      colors: ['rgba(0,240,255,0.22)', 'rgba(112,0,255,0.08)'] as const,
      border: 'rgba(0,240,255,0.45)',
      icon: 'sparkles' as const,
      color: '#00F0FF',
    },
    shield: {
      colors: ['rgba(0,255,135,0.22)', 'rgba(96,239,255,0.08)'] as const,
      border: 'rgba(0,255,135,0.45)',
      icon: 'shield-checkmark' as const,
      color: '#00FF87',
    },
    boost: {
      colors: ['rgba(255,159,10,0.22)', 'rgba(255,55,95,0.08)'] as const,
      border: 'rgba(255,159,10,0.45)',
      icon: 'flash' as const,
      color: '#FF9F0A',
    },
    chest: {
      colors: ['rgba(255,214,10,0.22)', 'rgba(255,159,10,0.08)'] as const,
      border: 'rgba(255,214,10,0.45)',
      icon: 'gift' as const,
      color: '#FFD60A',
    },
  };

  const conf = configs[type] || configs.gem;

  return (
    <LinearGradient
      colors={conf.colors}
      style={{
        width: size * 1.8,
        height: size * 1.8,
        borderRadius: size * 0.6,
        borderWidth: 1,
        borderColor: conf.border,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name={conf.icon} size={size} color={conf.color} />
    </LinearGradient>
  );
}

export default function QuestsShopScreen() {
  const { T } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  // Navigation tabs: 'quests' | 'shop'
  const [activeTab, setActiveTab] = useState<'quests' | 'shop'>('quests');

  // Core State
  const [inventory, setInventory] = useState<UserInventory | null>(null);
  const [quests, setQuests] = useState<DailyQuest[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Chest Reveal Modal State
  const [chestModalVisible, setChestModalVisible] = useState(false);
  const [openingChest, setOpeningChest] = useState(false);
  const [chestRewards, setChestRewards] = useState<{
    gems: number;
    shields: number;
    boosts: number;
  } | null>(null);

  // Animated values
  const tabSlide = useRef(new Animated.Value(0)).current;
  const chestScale = useRef(new Animated.Value(1)).current;
  const chestRotate = useRef(new Animated.Value(0)).current;

  // Load state on mount
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [inv, qList, setts] = await Promise.all([
        getInventory(),
        getDailyQuests(),
        getSettings(),
      ]);
      setInventory(inv);
      setQuests(qList);
      setSettings(setts);
    } catch (err) {
      console.warn('Error loading quests/shop data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Switch tabs with slide animation
  const switchTab = (tab: 'quests' | 'shop') => {
    setActiveTab(tab);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.spring(tabSlide, {
      toValue: tab === 'quests' ? 0 : 1,
      useNativeDriver: true,
      tension: 90,
      friction: 12,
    }).start();
  };

  // Claim Quest Reward
  const handleClaimQuest = async (questId: string) => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const res = await claimQuestReward(questId);
      if (res.success) {
        setQuests(res.quests);
        // Refresh inventory to show updated gems
        const updatedInv = await getInventory();
        setInventory(updatedInv);
        Alert.alert(
          '🎉 Reward Claimed!',
          `You earned +${res.gemsEarned} Gems 💎 and +${res.xpEarned} XP!`,
          [{ text: 'Awesome' }]
        );
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to claim reward. Please try again.');
    }
  };

  // Purchase Shop Item
  const handlePurchase = async (item: ShopItem) => {
    if (!inventory) return;

    if (inventory.gems < item.cost) {
      Alert.alert(
        'Insufficient Gems',
        `You need ${item.cost - inventory.gems} more gems to purchase this.`
      );
      return;
    }

    Alert.alert(
      'Confirm Purchase',
      `Buy "${item.name}" for ${item.cost} Gems?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Buy',
          onPress: async () => {
            try {
              const res = await buyShopItem(item.id);
              if (res.success) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setInventory(res.inventory);
                Alert.alert('Success', res.message);
              } else {
                Alert.alert('Purchase Failed', res.message);
              }
            } catch (err) {
              Alert.alert('Error', 'Failed to complete purchase.');
            }
          },
        },
      ]
    );
  };

  // Equip custom trails or skins
  const handleEquip = async (item: ShopItem) => {
    if (!settings) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      if (item.type === 'color') {
        const updated = await updateSettings({
          pathColor: item.value as any,
        });
        setSettings(updated);
      } else if (item.type === 'avatar') {
        const updated = await updateSettings({
          avatarIndex: item.value as number,
        });
        setSettings(updated);
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to equip item.');
    }
  };

  // Activate XP Booster
  const handleActivateBoost = async () => {
    if (!inventory || inventory.boosts <= 0) return;

    Alert.alert(
      'Activate Booster',
      'Use 1 XP Booster to get Double XP for 15 minutes?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Activate',
          onPress: async () => {
            try {
              const res = await useXPBoost();
              if (res.success) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setInventory(res.inventory);
                Alert.alert(
                  'Booster Activated! ⚡',
                  'You now have 15 minutes of Double XP. Let\'s run!'
                );
              }
            } catch (err) {
              Alert.alert('Error', 'Failed to activate booster.');
            }
          },
        },
      ]
    );
  };

  // Open Mystery Chest Animation Flow
  const handleOpenChest = async () => {
    if (!inventory || inventory.chests <= 0) return;

    setChestModalVisible(true);
    setOpeningChest(true);
    setChestRewards(null);

    // Spin and Scale Animation
    chestScale.setValue(1);
    chestRotate.setValue(0);

    Animated.parallel([
      Animated.sequence([
        Animated.timing(chestScale, { toValue: 1.3, duration: 800, useNativeDriver: true }),
        Animated.timing(chestScale, { toValue: 0.9, duration: 150, useNativeDriver: true }),
        Animated.timing(chestScale, { toValue: 1.1, duration: 150, useNativeDriver: true }),
      ]),
      Animated.timing(chestRotate, {
        toValue: 1,
        duration: 1100,
        useNativeDriver: true,
      }),
    ]).start(async () => {
      try {
        const res = await openChest();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setChestRewards({
          gems: res.gemsEarned,
          shields: res.shieldsEarned,
          boosts: res.boostsEarned,
        });
        setInventory(res.inventory);
      } catch (err) {
        Alert.alert('Error', 'Failed to open chest.');
        setChestModalVisible(false);
      } finally {
        setOpeningChest(false);
      }
    });
  };

  const spin = chestRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '720deg'],
  });

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: T.black, justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={T.gold} />
        <Text style={[styles.loadingText, { color: T.text }]}>Synchronizing Vault...</Text>
      </View>
    );
  }

  // Format countdown time for booster if active
  const renderBoosterStatus = () => {
    if (!inventory) return null;
    const now = Date.now();
    if (inventory.activeXPBoostUntil > now) {
      const remainingMin = Math.ceil((inventory.activeXPBoostUntil - now) / 60000);
      return (
        <View style={[styles.activeBoostBadge, { borderColor: T.gold }]}>
          <Text style={[styles.activeBoostText, { color: T.gold }]}>
            ⚡ DOUBLE XP ACTIVE: {remainingMin}m
          </Text>
        </View>
      );
    }
    return null;
  };

  return (
    <View style={[styles.container, { backgroundColor: T.black }]}>
      {/* HEADER */}
      <View style={[styles.header, { paddingTop: insets.top + 16, borderBottomColor: T.border }]}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.goBack();
            }}
            style={[styles.backButton, { backgroundColor: T.card, borderColor: T.border }]}
          >
            <Ionicons name="arrow-back" size={20} color={T.white} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: T.white }]}>RunQuest Hub</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Currency Panel */}
        <View style={[styles.currencyCard, { backgroundColor: T.card, borderColor: T.border }]}>
          <View style={styles.currencyItem}>
            <PremiumIcon type="gem" size={16} />
            <View style={{ marginLeft: 4 }}>
              <Text style={[styles.currencyValue, { color: T.white }]}>
                {inventory?.gems ?? 0}
              </Text>
              <Text style={[styles.currencyLabel, { color: T.text }]}>Gems</Text>
            </View>
          </View>
          <View style={styles.currencyDivider} />
          <View style={styles.currencyItem}>
            <PremiumIcon type="shield" size={16} />
            <View style={{ marginLeft: 4 }}>
              <Text style={[styles.currencyValue, { color: T.white }]}>
                {inventory?.shields ?? 0}
              </Text>
              <Text style={[styles.currencyLabel, { color: T.text }]}>Shields</Text>
            </View>
          </View>
          <View style={styles.currencyDivider} />
          <View style={styles.currencyItem}>
            <PremiumIcon type="boost" size={16} />
            <View style={{ marginLeft: 4 }}>
              <Text style={[styles.currencyValue, { color: T.white }]}>
                {inventory?.boosts ?? 0}
              </Text>
              <Text style={[styles.currencyLabel, { color: T.text }]}>Boosts</Text>
            </View>
          </View>
        </View>

        {renderBoosterStatus()}

        {/* Navigation Tabs */}
        <View style={styles.tabsWrapper}>
          <View style={[styles.tabsBg, { backgroundColor: T.card, borderColor: T.border }]}>
            <Animated.View
              style={[
                styles.tabIndicator,
                {
                  backgroundColor: T.gold,
                  transform: [
                    {
                      translateX: tabSlide.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, (width - 48) / 2],
                      }),
                    },
                  ],
                },
              ]}
            />
            <TouchableOpacity style={styles.tabButton} onPress={() => switchTab('quests')}>
              <Text
                style={[
                  styles.tabText,
                  { color: activeTab === 'quests' ? T.black : T.text },
                  activeTab === 'quests' && styles.tabTextActive,
                ]}
              >
                Daily Quests
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.tabButton} onPress={() => switchTab('shop')}>
              <Text
                style={[
                  styles.tabText,
                  { color: activeTab === 'shop' ? T.black : T.text },
                  activeTab === 'shop' && styles.tabTextActive,
                ]}
              >
                Loot Shop
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {activeTab === 'quests' ? (
          /* DAILY QUESTS TAB */
          <View style={styles.tabContent}>
            <View style={styles.sectionHeaderRow}>
              <Ionicons name="calendar-outline" size={18} color={T.gold} />
              <Text style={[styles.sectionTitle, { color: T.white }]}>Today's Challenges</Text>
            </View>

            {quests.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: T.card, borderColor: T.border }]}>
                <Ionicons name="checkmark-done-circle-outline" size={48} color={T.green} />
                <Text style={[styles.emptyText, { color: T.white }]}>All quests cleared!</Text>
                <Text style={[styles.emptySub, { color: T.text }]}>Check back tomorrow for fresh rewards.</Text>
              </View>
            ) : (
              quests.map(quest => {
                const progressPct = Math.min(quest.current / quest.target, 1);
                return (
                  <View
                    key={quest.id}
                    style={[
                      styles.questCard,
                      { backgroundColor: T.card, borderColor: T.border },
                      quest.completed && !quest.claimed && { borderColor: T.gold + '60' },
                      quest.claimed && { opacity: 0.6 },
                    ]}
                  >
                    <View style={styles.questTop}>
                      <View style={styles.questDetails}>
                        <Text style={[styles.questTitle, { color: T.white }]}>{quest.title}</Text>
                        <Text style={[styles.questDesc, { color: T.text }]}>
                          {quest.description}
                        </Text>
                      </View>
                      <View style={styles.rewardContainer}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,240,255,0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                          <Ionicons name="sparkles" size={10} color="#00F0FF" />
                          <Text style={{ color: '#00F0FF', fontSize: 11, fontWeight: '900' }}>+{quest.gemsReward}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,159,10,0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginTop: 4 }}>
                          <Ionicons name="flash" size={10} color="#FF9F0A" />
                          <Text style={{ color: '#FF9F0A', fontSize: 10, fontWeight: '900' }}>+{quest.xpReward} XP</Text>
                        </View>
                      </View>
                    </View>

                    {/* Progress Bar */}
                    <View style={styles.progressRow}>
                      <View style={[styles.progressBarBg, { backgroundColor: T.muted }]}>
                        <View
                          style={[
                            styles.progressBarFill,
                            {
                              backgroundColor: quest.completed ? T.green : T.gold,
                              width: `${progressPct * 100}%`,
                            },
                          ]}
                        />
                      </View>
                      <Text style={[styles.progressText, { color: T.white }]}>
                        {quest.type === 'distance'
                          ? `${(quest.current / 1000).toFixed(1)} / ${(quest.target / 1000).toFixed(1)} km`
                          : `${quest.current} / ${quest.target}`}
                      </Text>
                    </View>

                    {/* Claim/Completed Button */}
                    {quest.completed && !quest.claimed && (
                      <TouchableOpacity
                        onPress={() => handleClaimQuest(quest.id)}
                        style={styles.claimButton}
                      >
                        <LinearGradient
                          colors={[T.gold, '#FFD60A']}
                          style={styles.claimButtonGradient}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                        >
                          <Text style={styles.claimButtonText}>CLAIM REWARD</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    )}

                    {quest.claimed && (
                      <View style={[styles.claimedBadge, { backgroundColor: T.muted }]}>
                        <Ionicons name="checkmark-circle" size={16} color={T.green} />
                        <Text style={[styles.claimedText, { color: T.green }]}>REWARD CLAIMED</Text>
                      </View>
                    )}
                  </View>
                );
              })
            )}

            {/* Quick Actions Panel */}
            <View style={styles.sectionHeaderRow}>
              <Ionicons name="briefcase-outline" size={18} color={T.gold} />
              <Text style={[styles.sectionTitle, { color: T.white }]}>Active Inventory</Text>
            </View>

            <View style={styles.inventoryRow}>
              {/* Mystery Chest Card */}
              <View
                style={[styles.inventoryCard, { backgroundColor: T.card, borderColor: T.border }]}
              >
                <PremiumIcon type="chest" size={28} />
                <Text style={[styles.invCardName, { color: T.white, marginTop: 8 }]}>Treasure Chest</Text>
                <Text style={[styles.invCardCount, { color: T.text }]}>
                  {inventory?.chests ?? 0} Owned
                </Text>
                <TouchableOpacity
                  disabled={!inventory || inventory.chests <= 0}
                  onPress={handleOpenChest}
                  style={[
                    styles.invCardBtn,
                    {
                      backgroundColor:
                        inventory && inventory.chests > 0 ? T.gold : 'rgba(255,255,255,0.05)',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.invCardBtnText,
                      { color: inventory && inventory.chests > 0 ? T.black : '#555' },
                    ]}
                  >
                    Open Chest
                  </Text>
                </TouchableOpacity>
              </View>

              {/* XP Booster Card */}
              <View
                style={[styles.inventoryCard, { backgroundColor: T.card, borderColor: T.border }]}
              >
                <PremiumIcon type="boost" size={28} />
                <Text style={[styles.invCardName, { color: T.white, marginTop: 8 }]}>XP Booster</Text>
                <Text style={[styles.invCardCount, { color: T.text }]}>
                  {inventory?.boosts ?? 0} Owned
                </Text>
                <TouchableOpacity
                  disabled={!inventory || inventory.boosts <= 0}
                  onPress={handleActivateBoost}
                  style={[
                    styles.invCardBtn,
                    {
                      backgroundColor:
                        inventory && inventory.boosts > 0 ? T.gold : 'rgba(255,255,255,0.05)',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.invCardBtnText,
                      { color: inventory && inventory.boosts > 0 ? T.black : '#555' },
                    ]}
                  >
                    Activate
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : (
          /* LOOT SHOP TAB */
          <View style={styles.tabContent}>
            {/* TRAIL COLOR COSMETICS */}
            <View style={styles.sectionHeaderRow}>
              <Ionicons name="color-palette-outline" size={18} color={T.gold} />
              <Text style={[styles.sectionTitle, { color: T.white }]}>Trail Customization</Text>
            </View>

            {SHOP_ITEMS.filter(i => i.type === 'color').map(item => {
              const isUnlocked = inventory?.unlockedColors.includes(item.value as string);
              const isEquipped = settings?.pathColor === item.value;
              return (
                <View
                  key={item.id}
                  style={[styles.shopItemCard, { backgroundColor: T.card, borderColor: T.border }]}
                >
                  <View style={styles.shopItemLeft}>
                    <View
                      style={[
                        styles.colorPreviewBubble,
                        {
                          backgroundColor:
                            item.value === 'purple'
                              ? '#BF5FFF'
                              : item.value === 'orange'
                              ? '#FF9F0A'
                              : item.value === 'red'
                              ? '#FF453A'
                              : item.value === 'white'
                              ? '#FFFFFF'
                              : item.value === 'blue'
                              ? '#00C6FF'
                              : '#00FF87',
                        },
                      ]}
                    />
                    <View style={styles.shopItemDetails}>
                      <Text style={[styles.shopItemName, { color: T.white }]}>{item.name}</Text>
                      <Text style={[styles.shopItemDesc, { color: T.text }]}>
                        {item.description}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.shopItemRight}>
                    {isEquipped ? (
                      <View style={[styles.equippedBadge, { borderColor: T.green }]}>
                        <Text style={{ color: T.green, fontSize: 11, fontWeight: '900' }}>
                          EQUIPPED
                        </Text>
                      </View>
                    ) : isUnlocked ? (
                      <TouchableOpacity
                        onPress={() => handleEquip(item)}
                        style={[styles.equipButton, { borderColor: T.gold }]}
                      >
                        <Text style={[styles.equipButtonText, { color: T.gold }]}>EQUIP Trail</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        onPress={() => handlePurchase(item)}
                        style={[styles.purchaseBtn, { backgroundColor: T.gold }]}
                      >
                        <Text style={styles.purchaseBtnText}>💎 {item.cost}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}

            {/* AVATAR SKINS COSMETICS */}
            <View style={styles.sectionHeaderRow}>
              <Ionicons name="person-circle-outline" size={18} color={T.gold} />
              <Text style={[styles.sectionTitle, { color: T.white }]}>Avatar Customization</Text>
            </View>

            {SHOP_ITEMS.filter(i => i.type === 'avatar').map(item => {
              const isUnlocked = inventory?.unlockedAvatars.includes(item.value as number);
              const isEquipped = settings?.avatarIndex === item.value;
              return (
                <View
                  key={item.id}
                  style={[styles.shopItemCard, { backgroundColor: T.card, borderColor: T.border }]}
                >
                  <View style={styles.shopItemLeft}>
                    <View
                      style={[
                        styles.avatarPreviewBubble,
                        { backgroundColor: 'rgba(255,214,10,0.1)', borderColor: T.gold },
                      ]}
                    >
                      <Ionicons name="person" size={20} color={T.gold} />
                    </View>
                    <View style={styles.shopItemDetails}>
                      <Text style={[styles.shopItemName, { color: T.white }]}>{item.name}</Text>
                      <Text style={[styles.shopItemDesc, { color: T.text }]}>
                        {item.description}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.shopItemRight}>
                    {isEquipped ? (
                      <View style={[styles.equippedBadge, { borderColor: T.green }]}>
                        <Text style={{ color: T.green, fontSize: 11, fontWeight: '900' }}>
                          EQUIPPED
                        </Text>
                      </View>
                    ) : isUnlocked ? (
                      <TouchableOpacity
                        onPress={() => handleEquip(item)}
                        style={[styles.equipButton, { borderColor: T.gold }]}
                      >
                        <Text style={[styles.equipButtonText, { color: T.gold }]}>EQUIP Skin</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        onPress={() => handlePurchase(item)}
                        style={[styles.purchaseBtn, { backgroundColor: T.gold }]}
                      >
                        <Text style={styles.purchaseBtnText}>💎 {item.cost}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}

            {/* CONSUMABLE ITEMS */}
            <View style={styles.sectionHeaderRow}>
              <Ionicons name="shield-checkmark-outline" size={18} color={T.gold} />
              <Text style={[styles.sectionTitle, { color: T.white }]}>Consumables & Boosts</Text>
            </View>

            {SHOP_ITEMS.filter(i => i.type === 'item').map(item => (
              <View
                key={item.id}
                style={[styles.shopItemCard, { backgroundColor: T.card, borderColor: T.border }]}
              >
                <View style={styles.shopItemLeft}>
                  <PremiumIcon type={item.value === 'shield' ? 'shield' : item.value === 'boost' ? 'boost' : 'chest'} size={20} />
                  <View style={[styles.shopItemDetails, { marginLeft: 12 }]}>
                    <Text style={[styles.shopItemName, { color: T.white }]}>{item.name}</Text>
                    <Text style={[styles.shopItemDesc, { color: T.text }]}>
                      {item.description}
                    </Text>
                  </View>
                </View>
                <View style={styles.shopItemRight}>
                  <TouchableOpacity
                    onPress={() => handlePurchase(item)}
                    style={[styles.purchaseBtn, { backgroundColor: T.gold }]}
                  >
                    <Text style={styles.purchaseBtnText}>💎 {item.cost}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* CHEST OPENING MODAL */}
      <Modal visible={chestModalVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { backgroundColor: T.card, borderColor: T.border }]}>
            {openingChest ? (
              <View style={styles.openingChestContainer}>
                <Animated.View
                  style={{
                    transform: [{ scale: chestScale }, { rotate: spin }],
                    marginBottom: 24,
                  }}
                >
                  <PremiumIcon type="chest" size={56} />
                </Animated.View>
                <Text style={[styles.openingChestTitle, { color: T.white }]}>
                  Unlocking Mystery Chest...
                </Text>
                <ActivityIndicator size="small" color={T.gold} style={{ marginTop: 16 }} />
              </View>
            ) : (
              <View style={styles.rewardsRevealContainer}>
                <View style={{ marginBottom: 16 }}>
                  <PremiumIcon type="chest" size={48} />
                </View>
                <Text style={[styles.revealedChestTitle, { color: T.white }]}>
                  Chest Unlocked!
                </Text>

                <View style={styles.rewardsRow}>
                  {chestRewards && chestRewards.gems > 0 && (
                    <View style={[styles.rewardRevealCard, { backgroundColor: T.black }]}>
                      <PremiumIcon type="gem" size={24} />
                      <Text style={[styles.rewardRevealValue, { color: T.white, marginTop: 8 }]}>
                        +{chestRewards.gems}
                      </Text>
                      <Text style={[styles.rewardRevealLabel, { color: T.text }]}>Gems</Text>
                    </View>
                  )}
                  {chestRewards && chestRewards.shields > 0 && (
                    <View style={[styles.rewardRevealCard, { backgroundColor: T.black }]}>
                      <PremiumIcon type="shield" size={24} />
                      <Text style={[styles.rewardRevealValue, { color: T.white, marginTop: 8 }]}>
                        +{chestRewards.shields}
                      </Text>
                      <Text style={[styles.rewardRevealLabel, { color: T.text }]}>Shield</Text>
                    </View>
                  )}
                  {chestRewards && chestRewards.boosts > 0 && (
                    <View style={[styles.rewardRevealCard, { backgroundColor: T.black }]}>
                      <PremiumIcon type="boost" size={24} />
                      <Text style={[styles.rewardRevealValue, { color: T.white, marginTop: 8 }]}>
                        +{chestRewards.boosts}
                      </Text>
                      <Text style={[styles.rewardRevealLabel, { color: T.text }]}>XP Boost</Text>
                    </View>
                  )}
                  {chestRewards &&
                    chestRewards.shields === 0 &&
                    chestRewards.boosts === 0 && (
                      <Text style={[styles.noItemsRewardText, { color: T.text }]}>
                        (No extra consumables found)
                      </Text>
                    )}
                </View>

                <TouchableOpacity
                  onPress={() => setChestModalVisible(false)}
                  style={styles.closeChestBtn}
                >
                  <LinearGradient
                    colors={[T.gold, '#FFD60A']}
                    style={styles.closeChestGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Text style={styles.closeChestText}>AWESOME</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingText: {
    fontSize: 14,
    marginTop: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  header: {
    paddingHorizontal: 24,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  currencyCard: {
    flexDirection: 'row',
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 14,
  },
  currencyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  currencyIcon: {
    fontSize: 24,
  },
  currencyValue: {
    fontSize: 16,
    fontWeight: '900',
  },
  currencyLabel: {
    fontSize: 10,
    fontWeight: '700',
  },
  currencyDivider: {
    width: StyleSheet.hairlineWidth,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  activeBoostBadge: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignSelf: 'center',
    marginBottom: 14,
    backgroundColor: 'rgba(255,214,10,0.06)',
  },
  activeBoostText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  tabsWrapper: {
    marginBottom: 16,
  },
  tabsBg: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    padding: 4,
    position: 'relative',
    height: 48,
  },
  tabIndicator: {
    position: 'absolute',
    left: 4,
    top: 4,
    bottom: 4,
    width: '50%',
    borderRadius: 12,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '800',
  },
  tabTextActive: {
    fontWeight: '900',
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 60,
  },
  tabContent: {
    gap: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  emptyCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 12,
  },
  emptySub: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  questCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  questTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  questDetails: {
    flex: 1,
    paddingRight: 12,
  },
  questTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  questDesc: {
    fontSize: 12,
    marginTop: 3,
    lineHeight: 16,
  },
  rewardContainer: {
    alignItems: 'flex-end',
    gap: 4,
  },
  rewardPill: {
    backgroundColor: 'rgba(255,214,10,0.1)',
    color: '#FFD60A',
    fontSize: 11,
    fontWeight: '900',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  rewardPillXp: {
    backgroundColor: 'rgba(0,198,255,0.1)',
    color: '#00C6FF',
    fontSize: 10,
    fontWeight: '900',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  progressBarBg: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 11,
    fontWeight: '800',
    width: 80,
    textAlign: 'right',
  },
  claimButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 4,
  },
  claimButtonGradient: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  claimButtonText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  claimedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 4,
  },
  claimedText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  inventoryRow: {
    flexDirection: 'row',
    gap: 12,
  },
  inventoryCard: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
  },
  invCardIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  invCardName: {
    fontSize: 13,
    fontWeight: '900',
  },
  invCardCount: {
    fontSize: 11,
    marginTop: 2,
    marginBottom: 12,
  },
  invCardBtn: {
    width: '100%',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  invCardBtnText: {
    fontSize: 11,
    fontWeight: '900',
  },
  shopItemCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  shopItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    paddingRight: 10,
  },
  colorPreviewBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#FFF',
  },
  avatarPreviewBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemIconBubble: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shopItemDetails: {
    flex: 1,
  },
  shopItemName: {
    fontSize: 14,
    fontWeight: '900',
  },
  shopItemDesc: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 14,
  },
  shopItemRight: {
    alignItems: 'flex-end',
  },
  purchaseBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    minWidth: 70,
    alignItems: 'center',
  },
  purchaseBtnText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 12,
  },
  equippedBadge: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  equipButton: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  equipButtonText: {
    fontSize: 11,
    fontWeight: '800',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  modalContent: {
    width: '100%',
    borderRadius: 28,
    borderWidth: 1,
    padding: 32,
    alignItems: 'center',
  },
  openingChestContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  chestEmojiAnim: {
    fontSize: 72,
    marginBottom: 24,
  },
  openingChestTitle: {
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  rewardsRevealContainer: {
    alignItems: 'center',
    width: '100%',
  },
  revealedChestIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  revealedChestTitle: {
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 20,
  },
  rewardsRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    marginBottom: 28,
    width: '100%',
  },
  rewardRevealCard: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    maxWidth: 90,
  },
  rewardRevealIcon: {
    fontSize: 24,
    marginBottom: 6,
  },
  rewardRevealValue: {
    fontSize: 16,
    fontWeight: '900',
  },
  rewardRevealLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  noItemsRewardText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  closeChestBtn: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
  },
  closeChestGradient: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  closeChestText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 0.5,
  },
});
