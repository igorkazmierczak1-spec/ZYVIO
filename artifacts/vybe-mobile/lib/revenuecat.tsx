import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/clerk-expo";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import Purchases, {
  type CustomerInfo,
  type PurchasesOfferings,
  type PurchasesPackage,
} from "react-native-purchases";
import { useSyncPremiumRevenueCat } from "@workspace/api-client-react";

export const REVENUECAT_PREMIUM_ENTITLEMENT = "premium";
export const REVENUECAT_PREMIUM_PRO_ENTITLEMENT = "premium_pro";

type SetupState = {
  ready: boolean;
  error: string | null;
};

function getApiKey() {
  if (Platform.OS === "android") return process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;
  return process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY;
}

async function configureRevenueCat(appUserId: string) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("Brak publicznego klucza RevenueCat dla tej platformy.");
  }

  if (await Purchases.isConfigured()) {
    const currentUserId = await Purchases.getAppUserID();
    if (currentUserId !== appUserId) await Purchases.logIn(appUserId);
    return;
  }

  await Purchases.setLogLevel(__DEV__ ? Purchases.LOG_LEVEL.DEBUG : Purchases.LOG_LEVEL.INFO);
  Purchases.configure({ apiKey, appUserID: appUserId });
}

function activePlan(customerInfo: CustomerInfo | undefined) {
  if (customerInfo?.entitlements.active[REVENUECAT_PREMIUM_PRO_ENTITLEMENT]) return "PREMIUM_PRO" as const;
  if (customerInfo?.entitlements.active[REVENUECAT_PREMIUM_ENTITLEMENT]) return "PREMIUM" as const;
  return "FREE" as const;
}

function useSubscriptionContext() {
  const { isSignedIn, userId } = useAuth();
  const queryClient = useQueryClient();
  const sync = useSyncPremiumRevenueCat();
  const [setup, setSetup] = useState<SetupState>({ ready: false, error: null });

  useEffect(() => {
    let cancelled = false;
    setSetup({ ready: false, error: null });
    if (!isSignedIn || !userId) return () => { cancelled = true; };

    void configureRevenueCat(userId)
      .then(() => {
        if (!cancelled) setSetup({ ready: true, error: null });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setSetup({
            ready: false,
            error: error instanceof Error ? error.message : "Nie udało się uruchomić płatności mobilnych.",
          });
        }
      });
    return () => { cancelled = true; };
  }, [isSignedIn, userId]);

  const customerInfoQuery = useQuery({
    queryKey: ["revenuecat", "customer-info", userId],
    enabled: setup.ready,
    queryFn: () => Purchases.getCustomerInfo(),
    staleTime: 60_000,
  });
  const offeringsQuery = useQuery({
    queryKey: ["revenuecat", "offerings", userId],
    enabled: setup.ready,
    queryFn: () => Purchases.getOfferings(),
    staleTime: 300_000,
  });
  const purchaseMutation = useMutation({
    mutationFn: async (packageToPurchase: PurchasesPackage) => Purchases.purchasePackage(packageToPurchase),
    onSuccess: async ({ customerInfo }) => {
      await queryClient.invalidateQueries({ queryKey: ["revenuecat", "customer-info", userId] });
      await sync.mutateAsync();
      return customerInfo;
    },
  });
  const restoreMutation = useMutation({
    mutationFn: () => Purchases.restorePurchases(),
    onSuccess: async (customerInfo) => {
      await queryClient.setQueryData(["revenuecat", "customer-info", userId], customerInfo);
      await sync.mutateAsync();
      return customerInfo;
    },
  });

  const value = useMemo(() => ({
    ready: setup.ready,
    setupError: setup.error,
    customerInfo: customerInfoQuery.data,
    offerings: offeringsQuery.data,
    plan: activePlan(customerInfoQuery.data),
    isLoading: !setup.error && (!setup.ready || customerInfoQuery.isLoading || offeringsQuery.isLoading),
    isError: Boolean(setup.error || customerInfoQuery.isError || offeringsQuery.isError),
    purchase: purchaseMutation.mutateAsync,
    restore: restoreMutation.mutateAsync,
    isPurchasing: purchaseMutation.isPending || sync.isPending,
    isRestoring: restoreMutation.isPending || sync.isPending,
  }), [
    customerInfoQuery.data,
    customerInfoQuery.isError,
    customerInfoQuery.isLoading,
    offeringsQuery.data,
    offeringsQuery.isError,
    offeringsQuery.isLoading,
    purchaseMutation.isPending,
    purchaseMutation.mutateAsync,
    restoreMutation.isPending,
    restoreMutation.mutateAsync,
    setup.error,
    setup.ready,
    sync.isPending,
  ]);

  return value;
}

type SubscriptionContextValue = ReturnType<typeof useSubscriptionContext>;
const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const value = useSubscriptionContext();
  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (!context) throw new Error("useSubscription must be used within SubscriptionProvider");
  return context;
}

export function packageForPeriod(
  offerings: PurchasesOfferings | undefined,
  plan: "PREMIUM" | "PREMIUM_PRO",
  period: "MONTHLY" | "YEARLY",
) {
  const identifier = `${plan === "PREMIUM_PRO" ? "premium_pro" : "premium"}_${period === "YEARLY" ? "yearly" : "monthly"}`;
  return offerings?.current?.availablePackages.find(
    (item) => item.identifier === identifier || item.product.identifier === identifier,
  );
}