/**
 * PremiumContext.tsx
 * Global hook — usePremium() — available anywhere in the app.
 * Initializes RevenueCat on mount and exposes isPremium, purchase, restore.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  initPremium,
  isPremiumActive,
  getPremiumStatus,
  purchasePremium,
  restorePurchases,
  subscribePremiumStatus,
  emitPremiumChange,
  PremiumStatus,
  setDeveloperOverrideTier,
} from '../services/premiumService';

// ─── Context ──────────────────────────────────────────────────────────────────

type PremiumContextValue = {
  isPremium: boolean;
  status: PremiumStatus;
  loading: boolean;
  purchase: (productId: string, rcpkg?: any) => Promise<{ success: boolean; error?: string }>;
  restore:  () => Promise<{ restored: boolean; error?: string }>;
  refresh:  () => Promise<void>;
  setTier:  (tier: 'free' | 'basic' | 'pro' | 'elite') => void;
};

const PremiumContext = createContext<PremiumContextValue>({
  isPremium: false,
  status: { isPremium: false, productId: null, expiresAt: null, source: 'none', tier: 'free' },
  loading: true,
  purchase: async () => ({ success: false }),
  restore:  async () => ({ restored: false }),
  refresh:  async () => {},
  setTier:  () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function PremiumProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<PremiumStatus>(getPremiumStatus());

  const refresh = useCallback(async () => {
    await initPremium();
    setStatus({ ...getPremiumStatus() });
  }, []);

  useEffect(() => {
    (async () => {
      await initPremium();
      setStatus({ ...getPremiumStatus() });
      setLoading(false);
    })();

    const unsub = subscribePremiumStatus(() => {
      setStatus({ ...getPremiumStatus() });
    });
    return unsub;
  }, []);

  const purchase = useCallback(async (productId: string, rcpkg?: any) => {
    const result = await purchasePremium(productId, rcpkg);
    if (result.success) {
      setStatus({ ...getPremiumStatus() });
      emitPremiumChange();
    }
    return result;
  }, []);

  const restore = useCallback(async () => {
    const result = await restorePurchases();
    if (result.restored) {
      setStatus({ ...getPremiumStatus() });
      emitPremiumChange();
    }
    return result;
  }, []);

  const setTier = useCallback((tier: 'free' | 'basic' | 'pro' | 'elite') => {
    setDeveloperOverrideTier(tier);
    setStatus({ ...getPremiumStatus() });
  }, []);

  return (
    <PremiumContext.Provider
      value={{ isPremium: status.isPremium, status, loading, purchase, restore, refresh, setTier }}
    >
      {children}
    </PremiumContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePremium() {
  return useContext(PremiumContext);
}
