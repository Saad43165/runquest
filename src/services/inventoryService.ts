import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import * as Haptics from 'expo-haptics';

export type ItemType = 'gem' | 'shield' | 'boost' | 'chest';

export type ItemSpawn = {
  id: string;
  type: ItemType;
  latitude: number;
  longitude: number;
  collected: boolean;
  value: number;
};

export type UserInventory = {
  gems: number;
  shields: number;
  boosts: number;
  chests: number;
  unlockedColors: string[];
  unlockedAvatars: number[];
  activeXPBoostUntil: number; // timestamp
  shieldedTerritories: Record<string, number>; // territoryId -> expire timestamp
};

export type DailyQuest = {
  id: string;
  title: string;
  description: string;
  type: 'distance' | 'loop' | 'collect' | 'morning';
  target: number;
  current: number;
  gemsReward: number;
  xpReward: number;
  completed: boolean;
  claimed: boolean;
};

const INVENTORY_KEY = 'runquest:inventory';
const QUESTS_KEY = 'runquest:quests';
const LAST_QUEST_DATE_KEY = 'runquest:quest_date';

const DEFAULT_INVENTORY: UserInventory = {
  gems: 0,
  shields: 0,
  boosts: 0,
  chests: 0,
  unlockedColors: ['green'],
  unlockedAvatars: [0, 1, 2, 3], // start with a few basic ones
  activeXPBoostUntil: 0,
  shieldedTerritories: {},
};

function uid(): string | null {
  return auth.currentUser?.uid ?? null;
}

// ─── Inventory Management ────────────────────────────────────────────────────

export async function getInventory(): Promise<UserInventory> {
  try {
    const raw = await AsyncStorage.getItem(INVENTORY_KEY);
    let inv = DEFAULT_INVENTORY;
    if (raw) {
      inv = { ...DEFAULT_INVENTORY, ...JSON.parse(raw) };
    } else {
      // Try restoring from Firestore
      const cloud = await loadInventoryFromCloud();
      if (cloud) {
        inv = { ...DEFAULT_INVENTORY, ...cloud };
        await AsyncStorage.setItem(INVENTORY_KEY, JSON.stringify(inv));
      }
    }
    // Clean up expired shields
    let modified = false;
    const now = Date.now();
    const shielded = { ...inv.shieldedTerritories };
    for (const key in shielded) {
      if (shielded[key] < now) {
        delete shielded[key];
        modified = true;
      }
    }
    if (modified) {
      inv.shieldedTerritories = shielded;
      await saveInventory(inv);
    }
    return inv;
  } catch {
    return DEFAULT_INVENTORY;
  }
}

export async function saveInventory(inv: UserInventory): Promise<void> {
  try {
    await AsyncStorage.setItem(INVENTORY_KEY, JSON.stringify(inv));
    const userId = uid();
    if (userId) {
      await setDoc(doc(db, 'users', userId, 'meta', 'inventory'), inv, { merge: true });
    }
  } catch (e) {
    console.warn('Failed to save inventory:', e);
  }
}

async function loadInventoryFromCloud(): Promise<Partial<UserInventory> | null> {
  const userId = uid();
  if (!userId) return null;
  try {
    const snap = await getDoc(doc(db, 'users', userId, 'meta', 'inventory'));
    return snap.exists() ? (snap.data() as Partial<UserInventory>) : null;
  } catch {
    return null;
  }
}

export async function addGems(amount: number): Promise<UserInventory> {
  const inv = await getInventory();
  inv.gems += amount;
  await saveInventory(inv);
  return inv;
}

export async function useShield(territoryId: string): Promise<{ success: boolean; message: string; inventory: UserInventory }> {
  const inv = await getInventory();
  if (inv.shields <= 0) {
    return { success: false, message: 'No shields in inventory.', inventory: inv };
  }
  
  // Apply 3 days shield
  const expireTime = Date.now() + 3 * 24 * 60 * 60 * 1000;
  inv.shields -= 1;
  inv.shieldedTerritories[territoryId] = expireTime;
  await saveInventory(inv);
  
  return { success: true, message: 'Shield applied! Territory is protected for 3 days.', inventory: inv };
}

export async function checkTerritoryShield(territoryId: string): Promise<boolean> {
  const inv = await getInventory();
  const expire = inv.shieldedTerritories[territoryId];
  if (expire && expire > Date.now()) {
    return true;
  }
  return false;
}

export async function useXPBoost(): Promise<{ success: boolean; durationMin: number; inventory: UserInventory }> {
  const inv = await getInventory();
  if (inv.boosts <= 0) {
    return { success: false, durationMin: 0, inventory: inv };
  }
  
  const now = Date.now();
  // Extend or start 15 min double XP boost
  const base = inv.activeXPBoostUntil > now ? inv.activeXPBoostUntil : now;
  inv.activeXPBoostUntil = base + 15 * 60 * 1000;
  inv.boosts -= 1;
  await saveInventory(inv);
  
  return { success: true, durationMin: 15, inventory: inv };
}

export async function openChest(): Promise<{ gemsEarned: number; shieldsEarned: number; boostsEarned: number; inventory: UserInventory }> {
  const inv = await getInventory();
  if (inv.chests <= 0) {
    return { gemsEarned: 0, shieldsEarned: 0, boostsEarned: 0, inventory: inv };
  }
  
  // Random rewards
  const gemsEarned = Math.floor(Math.random() * 6) + 5; // 5-10 gems
  const shieldsEarned = Math.random() < 0.4 ? 1 : 0; // 40% chance of shield
  const boostsEarned = Math.random() < 0.5 ? 1 : 0; // 50% chance of boost
  
  inv.chests -= 1;
  inv.gems += gemsEarned;
  inv.shields += shieldsEarned;
  inv.boosts += boostsEarned;
  await saveInventory(inv);
  
  return { gemsEarned, shieldsEarned, boostsEarned, inventory: inv };
}

// ─── Shop & Purchases ─────────────────────────────────────────────────────────

export type ShopItem = {
  id: string;
  name: string;
  description: string;
  cost: number;
  type: 'color' | 'avatar' | 'item';
  value: string | number; // e.g. color name or avatar index
};

export const SHOP_ITEMS: ShopItem[] = [
  { id: 'item-shield', name: 'Territory Shield', description: 'Protects a territory from invasion for 3 days.', cost: 10, type: 'item', value: 'shield' },
  { id: 'item-boost', name: 'XP Booster', description: 'Gives double XP rewards on runs for 15 minutes.', cost: 12, type: 'item', value: 'boost' },
  { id: 'item-chest', name: 'Mystery Gold Chest', description: 'Contains 5-10 gems and random item rewards.', cost: 20, type: 'item', value: 'chest' },
  
  // Custom colors
  { id: 'color-purple', name: 'Void Purple Path', description: 'Unlock a mysterious glowing purple run trail.', cost: 25, type: 'color', value: 'purple' },
  { id: 'color-orange', name: 'Solar Flare Orange Path', description: 'Unlock a blazing orange run trail.', cost: 25, type: 'color', value: 'orange' },
  { id: 'color-red', name: 'Crimson Fury Red Path', description: 'Unlock an aggressive neon red run trail.', cost: 35, type: 'color', value: 'red' },
  { id: 'color-white', name: 'Ghost White Path', description: 'Unlock a clean, minimalist white run trail.', cost: 35, type: 'color', value: 'white' },
  { id: 'color-blue', name: 'Cyberpunk Blue Path', description: 'Unlock a stunning futuristic cyan trail.', cost: 40, type: 'color', value: 'blue' },
  
  // Custom avatar skins (representing indexes 4-15)
  { id: 'avatar-4', name: 'Berserker Red Skin', description: 'Avatar: Crimson warlord helmet.', cost: 30, type: 'avatar', value: 4 },
  { id: 'avatar-5', name: 'Neon Spectre Skin', description: 'Avatar: Cybernetic glowing face shield.', cost: 45, type: 'avatar', value: 5 },
  { id: 'avatar-6', name: 'High Priest Skin', description: 'Avatar: Mystic hood with golden crown.', cost: 45, type: 'avatar', value: 6 },
  { id: 'avatar-9', name: 'Golden Champion Skin', description: 'Avatar: Warrior helmet covered in solid gold.', cost: 60, type: 'avatar', value: 9 },
  { id: 'avatar-14', name: 'Astral Voyager Skin', description: 'Avatar: Astronaut helmet with golden visor.', cost: 75, type: 'avatar', value: 14 },
];

export async function buyShopItem(itemId: string): Promise<{ success: boolean; message: string; inventory: UserInventory }> {
  const shopItem = SHOP_ITEMS.find(i => i.id === itemId);
  if (!shopItem) {
    return { success: false, message: 'Item not found in shop.', inventory: await getInventory() };
  }
  
  const inv = await getInventory();
  if (inv.gems < shopItem.cost) {
    return { success: false, message: `Insufficient gems. Need ${shopItem.cost - inv.gems} more.`, inventory: inv };
  }
  
  // Check if color or avatar is already purchased
  if (shopItem.type === 'color' && inv.unlockedColors.includes(shopItem.value as string)) {
    return { success: false, message: 'You already unlocked this path color.', inventory: inv };
  }
  if (shopItem.type === 'avatar' && inv.unlockedAvatars.includes(shopItem.value as number)) {
    return { success: false, message: 'You already unlocked this avatar skin.', inventory: inv };
  }
  
  // Deduct gems
  inv.gems -= shopItem.cost;
  
  // Grant item
  if (shopItem.type === 'item') {
    if (shopItem.value === 'shield') inv.shields += 1;
    else if (shopItem.value === 'boost') inv.boosts += 1;
    else if (shopItem.value === 'chest') inv.chests += 1;
  } else if (shopItem.type === 'color') {
    inv.unlockedColors.push(shopItem.value as string);
  } else if (shopItem.type === 'avatar') {
    inv.unlockedAvatars.push(shopItem.value as number);
  }
  
  await saveInventory(inv);
  return { success: true, message: `Successfully purchased ${shopItem.name}!`, inventory: inv };
}

// ─── Daily Quests ────────────────────────────────────────────────────────────

const QUEST_TEMPLATES = [
  { id: 'q-dist-2', title: 'Daily Explorer', description: 'Run 2.0 km in total today', type: 'distance', target: 2000, gemsReward: 8, xpReward: 100 },
  { id: 'q-dist-5', title: 'Distance Champ', description: 'Run 5.0 km in total today', type: 'distance', target: 5000, gemsReward: 15, xpReward: 250 },
  { id: 'q-loop-1', title: 'Zone Expansion', description: 'Claim 1 new territory today', type: 'loop', target: 1, gemsReward: 10, xpReward: 150 },
  { id: 'q-loop-3', title: 'Spatial Conquest', description: 'Claim 3 new territories today', type: 'loop', target: 3, gemsReward: 25, xpReward: 350 },
  { id: 'q-collect-3', title: 'Treasure Scavenger', description: 'Collect 3 items on the map today', type: 'collect', target: 3, gemsReward: 6, xpReward: 80 },
  { id: 'q-collect-6', title: 'Map Sweeper', description: 'Collect 6 items on the map today', type: 'collect', target: 6, gemsReward: 12, xpReward: 180 },
  { id: 'q-morning-1', title: 'Early Sunrise Warrior', description: 'Claim a territory before 9:00 AM', type: 'morning', target: 1, gemsReward: 12, xpReward: 150 },
];

export async function getDailyQuests(): Promise<DailyQuest[]> {
  const todayStr = new Date().toDateString();
  const lastDate = await AsyncStorage.getItem(LAST_QUEST_DATE_KEY);
  
  if (lastDate === todayStr) {
    const rawQuests = await AsyncStorage.getItem(QUESTS_KEY);
    if (rawQuests) {
      return JSON.parse(rawQuests) as DailyQuest[];
    }
  }
  
  // Need to generate new daily quests for today
  // Deterministic daily selection using Date string hash
  let hash = 0;
  for (let i = 0; i < todayStr.length; i++) hash = (hash * 31 + todayStr.charCodeAt(i)) & 0xffffffff;
  
  const selectedTemplates = [];
  const indices = new Set<number>();
  
  // Select 3 unique quests based on hash
  let attempt = 0;
  while (selectedTemplates.length < 3 && attempt < 20) {
    const idx = Math.abs(hash + attempt * 7) % QUEST_TEMPLATES.length;
    if (!indices.has(idx)) {
      indices.add(idx);
      selectedTemplates.push(QUEST_TEMPLATES[idx]);
    }
    attempt++;
  }
  
  const dailyQuests: DailyQuest[] = selectedTemplates.map(t => ({
    ...t,
    current: 0,
    completed: false,
    claimed: false,
  })) as DailyQuest[];
  
  await AsyncStorage.setItem(LAST_QUEST_DATE_KEY, todayStr);
  await AsyncStorage.setItem(QUESTS_KEY, JSON.stringify(dailyQuests));
  
  return dailyQuests;
}

export async function updateQuestProgress(type: 'distance' | 'loop' | 'collect' | 'morning', increment: number): Promise<DailyQuest[]> {
  const quests = await getDailyQuests();
  let modified = false;
  
  const isMorning = type === 'morning' && new Date().getHours() < 9;
  
  const updated = quests.map(q => {
    if (q.claimed) return q;
    
    let isMatch = q.type === type;
    if (q.type === 'morning' && type === 'loop' && isMorning) {
      isMatch = true; // Loop claim in morning counts as morning quest progress
    }
    
    if (isMatch && q.current < q.target) {
      const nextVal = Math.min(q.current + increment, q.target);
      const isCompleted = nextVal >= q.target;
      if (isCompleted && !q.completed) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      modified = true;
      return {
        ...q,
        current: nextVal,
        completed: isCompleted,
      };
    }
    return q;
  });
  
  if (modified) {
    await AsyncStorage.setItem(QUESTS_KEY, JSON.stringify(updated));
  }
  return updated;
}

export async function claimQuestReward(questId: string): Promise<{ success: boolean; gemsEarned: number; xpEarned: number; quests: DailyQuest[] }> {
  const quests = await getDailyQuests();
  const quest = quests.find(q => q.id === questId);
  
  if (!quest || !quest.completed || quest.claimed) {
    return { success: false, gemsEarned: 0, xpEarned: 0, quests };
  }
  
  quest.claimed = true;
  await AsyncStorage.setItem(QUESTS_KEY, JSON.stringify(quests));
  
  // Add gems to inventory
  await addGems(quest.gemsReward);
  
  // Add XP to user profile (we'll also award this to user history / stats if needed, or simply return it)
  // We can let the calling view display a congratulatory UI and update their local level state!
  
  return {
    success: true,
    gemsEarned: quest.gemsReward,
    xpEarned: quest.xpReward,
    quests,
  };
}

// ─── Map Loot Spawning & Collection ──────────────────────────────────────────

/**
 * Spawns 3-4 items in the vicinity of the player's coordinate.
 */
export function spawnNearbyItems(lat: number, lng: number): ItemSpawn[] {
  const itemsCount = Math.floor(Math.random() * 2) + 3; // 3 or 4 items
  const spawns: ItemSpawn[] = [];
  const types: ItemType[] = ['gem', 'gem', 'gem', 'shield', 'boost', 'chest']; // weighted
  
  for (let i = 0; i < itemsCount; i++) {
    // Offset by roughly 40-150 meters
    // 1 degree lat is ~111,000 meters. 0.0004 to 0.0015 offset
    const latOffset = (Math.random() * 0.0011 + 0.0004) * (Math.random() < 0.5 ? 1 : -1);
    const lngOffset = (Math.random() * 0.0011 + 0.0004) * (Math.random() < 0.5 ? 1 : -1) / Math.cos(lat * Math.PI / 180);
    
    const type = types[Math.floor(Math.random() * types.length)];
    const val = type === 'gem' ? (Math.random() < 0.3 ? 2 : 1) : 1;
    
    spawns.push({
      id: `loot-${Date.now()}-${i}-${Math.round(Math.random()*1000)}`,
      type,
      latitude: lat + latOffset,
      longitude: lng + lngOffset,
      collected: false,
      value: val,
    });
  }
  
  return spawns;
}

/**
 * Calculate distance in meters between two lat/lngs.
 */
export function calculateGeodesicDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const deltaPhi = (lat2 - lat1) * Math.PI / 180;
  const deltaLambda = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // meters
}

/**
 * Evaluates user's location against items and collects eligible ones.
 * Returns the list of collected item events.
 */
export async function collectLootItems(
  userLat: number,
  userLng: number,
  items: ItemSpawn[]
): Promise<{ collectedItems: ItemSpawn[]; updatedItemsList: ItemSpawn[]; rewardSummary: string }> {
  const collectedItems: ItemSpawn[] = [];
  const updatedItemsList = items.map(item => {
    if (item.collected) return item;
    
    const dist = calculateGeodesicDistance(userLat, userLng, item.latitude, item.longitude);
    if (dist <= 25) { // 25 meters proximity radius
      collectedItems.push(item);
      return { ...item, collected: true };
    }
    return item;
  });
  
  if (collectedItems.length === 0) {
    return { collectedItems, updatedItemsList, rewardSummary: '' };
  }
  
  // Award items to inventory
  const inv = await getInventory();
  let gemSum = 0;
  let shieldSum = 0;
  let boostSum = 0;
  let chestSum = 0;
  
  for (const item of collectedItems) {
    if (item.type === 'gem') {
      inv.gems += item.value;
      gemSum += item.value;
    } else if (item.type === 'shield') {
      inv.shields += 1;
      shieldSum += 1;
    } else if (item.type === 'boost') {
      inv.boosts += 1;
      boostSum += 1;
    } else if (item.type === 'chest') {
      inv.chests += 1;
      chestSum += 1;
    }
  }
  
  await saveInventory(inv);
  
  // Progress daily quest
  await updateQuestProgress('collect', collectedItems.length);
  
  // Trigger medium impact haptic
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  
  // Build a summary text
  const parts = [];
  if (gemSum > 0) parts.push(`+${gemSum} GEM${gemSum > 1 ? 'S' : ''}`);
  if (shieldSum > 0) parts.push(`+${shieldSum} SHIELD${shieldSum > 1 ? 'S' : ''}`);
  if (boostSum > 0) parts.push(`+${boostSum} BOOST${boostSum > 1 ? 'S' : ''}`);
  if (chestSum > 0) parts.push(`+${chestSum} CHEST${chestSum > 1 ? 'S' : ''}`);
  
  return {
    collectedItems,
    updatedItemsList,
    rewardSummary: parts.join(', '),
  };
}
