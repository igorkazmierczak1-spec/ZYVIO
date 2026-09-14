import type { VybePlan } from "./premium";

export type PlanResource =
  | "battleCreate"
  | "postCreate"
  | "commentCreate";

export type PlanConfig = {
  plan: VybePlan;
  title: string;
  badge: string;
  limits: {
    aiDaily: number;
    battleCreateDaily: number;
    postCreateDaily: number;
    commentCreateDaily: number;
  };
  xpMultiplier: number;
  aiPriority: "standard" | "priority" | "highest";
  aiFeatures: string[];
  statsTier: "basic" | "advanced" | "pro";
  profileCustomization: string[];
  exclusiveChallenges: boolean;
};

export const PLAN_CONFIG: Record<VybePlan, PlanConfig> = {
  FREE: {
    plan: "FREE",
    title: "Free",
    badge: "Free",
    limits: {
      aiDaily: 3,
      battleCreateDaily: 3,
      postCreateDaily: 3,
      commentCreateDaily: 20,
    },
    xpMultiplier: 1,
    aiPriority: "standard",
    aiFeatures: ["Pomysły do Battle"],
    statsTier: "basic",
    profileCustomization: ["Avatar", "Bio"],
    exclusiveChallenges: false,
  },
  PREMIUM: {
    plan: "PREMIUM",
    title: "Premium",
    badge: "⭐ Premium",
    limits: {
      aiDaily: 30,
      battleCreateDaily: 15,
      postCreateDaily: 10,
      commentCreateDaily: 50,
    },
    xpMultiplier: 1.1,
    aiPriority: "priority",
    aiFeatures: ["Pomysły do Battle", "Lepsze sugestie tematów", "Podstawowy coaching profilu"],
    statsTier: "advanced",
    profileCustomization: ["Avatar", "Bio", "Kolor profilu", "Odznaka Premium"],
    exclusiveChallenges: false,
  },
  PREMIUM_PRO: {
    plan: "PREMIUM_PRO",
    title: "Premium Pro",
    badge: "👑 Premium Pro",
    limits: {
      aiDaily: 100,
      battleCreateDaily: 50,
      postCreateDaily: 30,
      commentCreateDaily: 150,
    },
    xpMultiplier: 1.25,
    aiPriority: "highest",
    aiFeatures: [
      "Pomysły do Battle",
      "Lepsze sugestie tematów",
      "Zaawansowany coaching profilu",
      "Strategia przygotowania do Battle",
    ],
    statsTier: "pro",
    profileCustomization: [
      "Avatar",
      "Bio",
      "Kolor profilu",
      "Odznaka Premium Pro",
      "Wyróżniony profil",
    ],
    exclusiveChallenges: true,
  },
};

export function planConfigFor(plan: VybePlan) {
  return PLAN_CONFIG[plan];
}

export function planLimitFor(plan: VybePlan, resource: PlanResource) {
  const key = `${resource}Daily` as keyof PlanConfig["limits"];
  return PLAN_CONFIG[plan].limits[key];
}