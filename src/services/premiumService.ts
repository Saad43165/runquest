/**
 * premiumService.ts
 * Manages premium subscription status via RevenueCat + Firestore backup.
 * Gracefully no-ops in Expo Go (no native module) — premium is false.
 */

import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

// ─── RevenueCat API Key ───────────────────────────────────────────────────────
const RC_KEY = process.env.EXPO_PUBLIC_REVENUECAT_KEY ?? '';

// ─── Product IDs (set these in App Store Connect & Play Console) ──────────────
export const PRODUCT_BASIC = 'runquest_premium_basic';
export const PRODUCT_PRO   = 'runquest_premium_pro';
export const PRODUCT_ELITE = 'runquest_premium_elite';
export const ENTITLEMENT_ID  = 'premium';

// ─── Types ────────────────────────────────────────────────────────────────────
export type PremiumStatus = {
  isPremium: boolean;
  productId: string | null;
  expiresAt: number | null;        // ms timestamp
  source: 'revenuecat' | 'firestore' | 'none';
  tier: 'free' | 'basic' | 'pro' | 'elite';
};

export function getPremiumTier(productId: string | null, isPremium: boolean): 'free' | 'basic' | 'pro' | 'elite' {
  if (!isPremium || !productId) return 'free';
  const id = productId.toLowerCase();
  if (id.includes('basic') || id.includes('monthly')) return 'basic';
  if (id.includes('pro')) return 'pro';
  if (id.includes('elite') || id.includes('annual')) return 'elite';
  return 'basic';
}

// ─── Developer unlock override ────────────────────────────────────────────────
// Set EXPO_PUBLIC_DEV_UNLOCK_PREMIUM=true in .env to bypass RevenueCat for testing.
// REMOVE this flag before releasing to production!
const DEV_UNLOCK = process.env.EXPO_PUBLIC_DEV_UNLOCK_PREMIUM === 'true';

// ─── In-memory cache ─────────────────────────────────────────────────────────
let _cachedStatus: PremiumStatus = DEV_UNLOCK
  ? { isPremium: true, productId: 'runquest_premium_elite', expiresAt: null, source: 'firestore', tier: 'elite' }
  : { isPremium: false, productId: null, expiresAt: null, source: 'none', tier: 'free' };
let _initialized = false;
let _rcConfigured = false;

export function setDeveloperOverrideTier(tier: 'free' | 'basic' | 'pro' | 'elite') {
  if (tier === 'free') {
    _cachedStatus = { isPremium: false, productId: null, expiresAt: null, source: 'none', tier: 'free' };
  } else {
    const prodId = tier === 'basic' ? PRODUCT_BASIC : tier === 'pro' ? PRODUCT_PRO : PRODUCT_ELITE;
    _cachedStatus = { isPremium: true, productId: prodId, expiresAt: null, source: 'firestore', tier };
  }
  emitPremiumChange();
}

// ─── RevenueCat lazy import ───────────────────────────────────────────────────
// Wrapped so it doesn't crash in Expo Go where native modules aren't available
async function getPurchases(): Promise<any | null> {
  try {
    const Purchases = require('react-native-purchases').default;
    return Purchases;
  } catch {
    return null;
  }
}

// ─── Sync premium status to Firestore ────────────────────────────────────────
async function syncToFirestore(status: PremiumStatus): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  try {
    await setDoc(
      doc(db, 'users', uid, 'meta', 'premium'),
      {
        isPremium: status.isPremium,
        productId: status.productId,
        expiresAt: status.expiresAt,
        updatedAt: Date.now(),
      },
      { merge: true }
    );
    // Sync premium flag to public profile for leaderboard badges
    await setDoc(
      doc(db, 'users', uid),
      { isPremium: status.isPremium },
      { merge: true }
    );
  } catch {}
}

// ─── Load premium status from Firestore ──────────────────────────────────────
async function loadFromFirestore(): Promise<PremiumStatus | null> {
  const uid = auth.currentUser?.uid;
  if (!uid) return null;
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'meta', 'premium'));
    if (!snap.exists()) return null;
    const d = snap.data();
    // Treat as expired if expiresAt is in the past
    const expired = d.expiresAt && d.expiresAt < Date.now();
    const isPremium = d.isPremium === true && !expired;
    return {
      isPremium,
      productId: d.productId ?? null,
      expiresAt: d.expiresAt ?? null,
      source: 'firestore',
      tier: getPremiumTier(d.productId ?? null, isPremium),
    };
  } catch {
    return null;
  }
}

// ─── Initialize RevenueCat ────────────────────────────────────────────────────
export async function initPremium(): Promise<void> {
  if (_initialized) return;
  _initialized = true;

  // ── Dev override: skip RevenueCat entirely ──
  if (DEV_UNLOCK) {
    _cachedStatus = {
      isPremium: true,
      productId: PRODUCT_ELITE,
      expiresAt: null,
      source: 'firestore',
      tier: 'elite',
    };
    return;
  }

  const Purchases = await getPurchases();
  if (!Purchases || !RC_KEY) {
    // Expo Go or no key — load from Firestore as fallback
    const fs = await loadFromFirestore();
    if (fs) _cachedStatus = fs;
    return;
  }

  try {
    await Purchases.configure({ apiKey: RC_KEY });
    _rcConfigured = true;

    const uid = auth.currentUser?.uid;
    if (uid) {
      await Purchases.logIn(uid);
    }

    const customerInfo = await Purchases.getCustomerInfo();
    const entitlement = customerInfo.entitlements.active[ENTITLEMENT_ID];
    const isPremium = !!entitlement;

    _cachedStatus = {
      isPremium,
      productId: entitlement?.productIdentifier ?? null,
      expiresAt: entitlement?.expirationDate
        ? new Date(entitlement.expirationDate).getTime()
        : null,
      source: 'revenuecat',
      tier: getPremiumTier(entitlement?.productIdentifier ?? null, isPremium),
    };

    // Sync verified status to Firestore
    await syncToFirestore(_cachedStatus);
  } catch {
    _rcConfigured = false;
    // Fall back to Firestore if RevenueCat fails
    const fs = await loadFromFirestore();
    if (fs) _cachedStatus = fs;
  }
}

// ─── Get current premium status ───────────────────────────────────────────────
export function getPremiumStatus(): PremiumStatus {
  return _cachedStatus;
}

export function isPremiumActive(): boolean {
  return _cachedStatus.isPremium;
}

// ─── Fetch latest offerings ───────────────────────────────────────────────────
export async function getOfferings(): Promise<{
  basic: { price: string; productId: string } | null;
  pro:   { price: string; productId: string } | null;
  elite: { price: string; productId: string } | null;
}> {
  const Purchases = await getPurchases();
  if (!Purchases || !RC_KEY || !_rcConfigured) {
    return {
      basic: { price: '$2.99', productId: PRODUCT_BASIC },
      pro:   { price: '$5.99', productId: PRODUCT_PRO },
      elite: { price: '$9.99', productId: PRODUCT_ELITE },
    };
  }
  try {
    const offerings = await Purchases.getOfferings();
    const current = offerings.current;
    if (!current) {
      return {
        basic: { price: '$2.99', productId: PRODUCT_BASIC },
        pro:   { price: '$5.99', productId: PRODUCT_PRO },
        elite: { price: '$9.99', productId: PRODUCT_ELITE },
      };
    }

    const findPkg = (id: string) =>
      current.availablePackages.find((p: any) =>
        p.product.productIdentifier === id ||
        p.packageType === id
      );

    const basic = findPkg(PRODUCT_BASIC) ?? findPkg('$rc_monthly') ?? current.monthly;
    const pro   = findPkg(PRODUCT_PRO);
    const elite = findPkg(PRODUCT_ELITE) ?? findPkg('$rc_annual') ?? current.annual;

    return {
      basic: basic
        ? { price: basic.product.priceString, productId: basic.product.productIdentifier }
        : { price: '$2.99', productId: PRODUCT_BASIC },
      pro: pro
        ? { price: pro.product.priceString, productId: pro.product.productIdentifier }
        : { price: '$5.99', productId: PRODUCT_PRO },
      elite: elite
        ? { price: elite.product.priceString, productId: elite.product.productIdentifier }
        : { price: '$9.99', productId: PRODUCT_ELITE },
    };
  } catch {
    return {
      basic: { price: '$2.99', productId: PRODUCT_BASIC },
      pro:   { price: '$5.99', productId: PRODUCT_PRO },
      elite: { price: '$9.99', productId: PRODUCT_ELITE },
    };
  }
}

// ─── Purchase a product ───────────────────────────────────────────────────────
export async function purchasePremium(productId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const Purchases = await getPurchases();
  if (!Purchases || !RC_KEY || !_rcConfigured) {
    // ─── Developer Sandbox Mock Purchase for Web/Expo Go/Non-configured RC ───
    _cachedStatus = {
      isPremium: true,
      productId: productId,
      expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year expiry
      source: 'firestore',
      tier: getPremiumTier(productId, true),
    };
    await syncToFirestore(_cachedStatus);
    emitPremiumChange();
    return { success: true };
  }
  try {
    const { customerInfo } = await Purchases.purchaseStoreProduct(
      { productIdentifier: productId } as any
    );
    const entitlement = customerInfo.entitlements.active[ENTITLEMENT_ID];
    const isPremium = !!entitlement;
    _cachedStatus = {
      isPremium,
      productId: entitlement?.productIdentifier ?? productId,
      expiresAt: entitlement?.expirationDate
        ? new Date(entitlement.expirationDate).getTime()
        : null,
      source: 'revenuecat',
      tier: getPremiumTier(entitlement?.productIdentifier ?? productId, isPremium),
    };
    await syncToFirestore(_cachedStatus);
    return { success: isPremium };
  } catch (e: any) {
    if (e.userCancelled) return { success: false };
    return { success: false, error: e.message ?? 'Purchase failed' };
  }
}

// ─── Restore purchases ────────────────────────────────────────────────────────
export async function restorePurchases(): Promise<{ restored: boolean; error?: string }> {
  const Purchases = await getPurchases();
  if (!Purchases || !RC_KEY || !_rcConfigured) {
    // ─── Developer Sandbox Mock Restore ───────────
    const fs = await loadFromFirestore();
    if (fs && fs.isPremium) {
      _cachedStatus = fs;
      emitPremiumChange();
      return { restored: true };
    }
    // Auto-unlock Elite if restoring empty dev sandbox
    _cachedStatus = {
      isPremium: true,
      productId: PRODUCT_ELITE,
      expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000,
      source: 'firestore',
      tier: 'elite',
    };
    await syncToFirestore(_cachedStatus);
    emitPremiumChange();
    return { restored: true };
  }
  try {
    const customerInfo = await Purchases.restorePurchases();
    const entitlement = customerInfo.entitlements.active[ENTITLEMENT_ID];
    const isPremium = !!entitlement;
    _cachedStatus = {
      isPremium,
      productId: entitlement?.productIdentifier ?? null,
      expiresAt: entitlement?.expirationDate
        ? new Date(entitlement.expirationDate).getTime()
        : null,
      source: 'revenuecat',
      tier: getPremiumTier(entitlement?.productIdentifier ?? null, isPremium),
    };
    await syncToFirestore(_cachedStatus);
    return { restored: isPremium };
  } catch (e: any) {
    return { restored: false, error: e.message ?? 'Restore failed' };
  }
}

// ─── Listeners ───────────────────────────────────────────────────────────────
type Listener = () => void;
const listeners: Set<Listener> = new Set();

export function subscribePremiumStatus(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emitPremiumChange(): void {
  listeners.forEach(fn => fn());
}
