import { ReplitConnectors } from "@replit/connectors-sdk";

type JsonRecord = Record<string, unknown>;

export type RevenueCatAccess = {
  found: boolean;
  appUserId: string;
  plan: "FREE" | "PREMIUM" | "PREMIUM_PRO";
  status: "active" | "inactive";
  entitlements: Array<Record<string, unknown>>;
};

async function revenueCatRequest<T = JsonRecord>(path: string): Promise<{ status: number; data: T }> {
  const response = await new ReplitConnectors().proxy("revenuecat", `/v2${path}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  const text = await response.text();
  let data: JsonRecord = {};
  try {
    data = text ? JSON.parse(text) as JsonRecord : {};
  } catch {
    data = { raw: text };
  }
  if (!response.ok && response.status !== 404) {
    throw new Error(`RevenueCat request failed (${response.status})`);
  }
  return { status: response.status, data: data as T };
}

function isMatchingEntitlement(item: Record<string, unknown>, lookupKey: string) {
  return [item.lookup_key, item.identifier, item.entitlement_identifier, item.id]
    .some((value) => value === lookupKey);
}

export function hasRevenueCatConfig() {
  return Boolean(process.env.REVENUECAT_PROJECT_ID);
}

export async function getRevenueCatAccess(appUserId: string): Promise<RevenueCatAccess | null> {
  const projectId = process.env.REVENUECAT_PROJECT_ID;
  if (!projectId) return null;

  const result = await revenueCatRequest<{ items?: Array<Record<string, unknown>> }>(
    `/projects/${encodeURIComponent(projectId)}/customers/${encodeURIComponent(appUserId)}/active_entitlements`,
  );
  if (result.status === 404) return null;

  const entitlements = Array.isArray(result.data.items) ? result.data.items : [];
  const hasPro = entitlements.some((item) => isMatchingEntitlement(item, "premium_pro"));
  const hasPremium = entitlements.some((item) => isMatchingEntitlement(item, "premium"));
  return {
    found: true,
    appUserId,
    plan: hasPro ? "PREMIUM_PRO" : hasPremium ? "PREMIUM" : "FREE",
    status: hasPro || hasPremium ? "active" : "inactive",
    entitlements,
  };
}