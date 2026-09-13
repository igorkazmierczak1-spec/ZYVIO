import { revenueCatRequest } from "./revenueCatClient";

const PROJECT_NAME = "ZYVIO";
const PLAY_STORE_APP_NAME = "ZYVIO Android";
const PLAY_STORE_PACKAGE_NAME = "com.zyvio.app";
const TEST_STORE_APP_NAME = "ZYVIO Test Store";
const ENTITLEMENTS = [
  { lookup_key: "premium", display_name: "Premium Access" },
  { lookup_key: "premium_pro", display_name: "Premium Pro Access" },
] as const;

const PRODUCTS = [
  {
    plan: "PREMIUM",
    period: "MONTHLY",
    testIdentifier: "premium_monthly",
    playIdentifier: "premium_monthly:monthly",
    displayName: "Premium Monthly",
    duration: "P1M",
    priceMicros: 19_990_000,
    packageLookupKey: "premium_monthly",
  },
  {
    plan: "PREMIUM",
    period: "YEARLY",
    testIdentifier: "premium_yearly",
    playIdentifier: "premium_yearly:yearly",
    displayName: "Premium Yearly",
    duration: "P1Y",
    priceMicros: 199_990_000,
    packageLookupKey: "premium_yearly",
  },
  {
    plan: "PREMIUM_PRO",
    period: "MONTHLY",
    testIdentifier: "premium_pro_monthly",
    playIdentifier: "premium_pro_monthly:monthly",
    displayName: "Premium Pro Monthly",
    duration: "P1M",
    priceMicros: 39_990_000,
    packageLookupKey: "premium_pro_monthly",
  },
  {
    plan: "PREMIUM_PRO",
    period: "YEARLY",
    testIdentifier: "premium_pro_yearly",
    playIdentifier: "premium_pro_yearly:yearly",
    displayName: "Premium Pro Yearly",
    duration: "P1Y",
    priceMicros: 399_990_000,
    packageLookupKey: "premium_pro_yearly",
  },
] as const;

type Collection<T> = { items?: T[] };
type Project = { id: string; name: string };
type App = { id: string; name: string; type: string; play_store?: { package_name?: string } };
type Product = { id: string; app_id: string; store_identifier: string };
type Entitlement = { id: string; lookup_key: string };
type Offering = { id: string; lookup_key: string; is_current?: boolean };
type Package = { id: string; lookup_key: string };

async function findOrCreate<T extends { id: string }>(
  existing: T | undefined,
  create: () => Promise<T>,
): Promise<T> {
  return existing ?? create();
}

async function createProject(): Promise<Project> {
  const projects = await revenueCatRequest<Collection<Project>>("/projects?limit=100");
  return findOrCreate(
    projects.items?.find((item) => item.name === PROJECT_NAME),
    async () => revenueCatRequest<Project>("/projects", "POST", { name: PROJECT_NAME }),
  );
}

async function createApp(projectId: string, type: "test_store" | "play_store", name: string): Promise<App> {
  const apps = await revenueCatRequest<Collection<App>>(`/projects/${projectId}/apps?limit=100`);
  const existing = apps.items?.find((item) => item.type === type);
  if (existing && type === "play_store" && existing.play_store?.package_name !== PLAY_STORE_PACKAGE_NAME) {
    return revenueCatRequest<App>(`/projects/${projectId}/apps/${existing.id}`, "POST", {
      name,
      play_store: { package_name: PLAY_STORE_PACKAGE_NAME },
    });
  }
  if (existing) return existing;
  const body = type === "play_store"
    ? { name, type, play_store: { package_name: PLAY_STORE_PACKAGE_NAME } }
    : { name, type };
  return revenueCatRequest<App>(`/projects/${projectId}/apps`, "POST", body);
}

async function createProduct(
  projectId: string,
  app: App,
  identifier: string,
  displayName: string,
  duration: string,
): Promise<Product> {
  const products = await revenueCatRequest<Collection<Product>>(`/projects/${projectId}/products?limit=100`);
  const existing = products.items?.find((item) => item.app_id === app.id && item.store_identifier === identifier);
  if (existing) return existing;
  const body: Record<string, unknown> = {
    app_id: app.id,
    store_identifier: identifier,
    type: "subscription",
    display_name: displayName,
  };
  if (app.type === "test_store") {
    body.title = displayName;
    body.subscription = { duration };
  }
  return revenueCatRequest<Product>(`/projects/${projectId}/products`, "POST", body);
}

async function ensureTestPrice(projectId: string, productId: string, amountMicros: number) {
  try {
    await revenueCatRequest(`/projects/${projectId}/products/${productId}/test_store_prices`, "POST", {
      prices: [{ amount_micros: amountMicros, currency: "PLN" }],
    });
  } catch (error) {
    if (!String(error).includes("resource_already_exists")) throw error;
  }
}

async function createEntitlement(projectId: string, lookupKey: string, displayName: string): Promise<Entitlement> {
  const entitlements = await revenueCatRequest<Collection<Entitlement>>(`/projects/${projectId}/entitlements?limit=100`);
  const existing = entitlements.items?.find((item) => item.lookup_key === lookupKey);
  if (existing) return existing;
  return revenueCatRequest<Entitlement>(`/projects/${projectId}/entitlements`, "POST", {
    lookup_key: lookupKey,
    display_name: displayName,
  });
}

async function attachProductsToEntitlement(projectId: string, entitlementId: string, productIds: string[]) {
  try {
    await revenueCatRequest(`/projects/${projectId}/entitlements/${entitlementId}/actions/attach_products`, "POST", {
      product_ids: productIds,
    });
  } catch (error) {
    if (!String(error).includes("unprocessable_entity_error")) throw error;
  }
}

async function createOffering(projectId: string): Promise<Offering> {
  const offerings = await revenueCatRequest<Collection<Offering>>(`/projects/${projectId}/offerings?limit=100`);
  const existing = offerings.items?.find((item) => item.lookup_key === "default");
  if (existing) {
    if (!existing.is_current) {
        await revenueCatRequest(`/projects/${projectId}/offerings/${existing.id}`, "POST", { is_current: true });
    }
    return existing;
  }
  return revenueCatRequest<Offering>(`/projects/${projectId}/offerings`, "POST", {
    lookup_key: "default",
    display_name: "ZYVIO Plans",
  });
}

async function createPackage(projectId: string, offeringId: string, lookupKey: string, displayName: string): Promise<Package> {
  const packages = await revenueCatRequest<Collection<Package>>(`/projects/${projectId}/offerings/${offeringId}/packages?limit=100`);
  const existing = packages.items?.find((item) => item.lookup_key === lookupKey);
  if (existing) return existing;
  return revenueCatRequest<Package>(`/projects/${projectId}/offerings/${offeringId}/packages`, "POST", {
    lookup_key: lookupKey,
    display_name: displayName,
  });
}

async function attachProductToPackage(projectId: string, packageId: string, productIds: string[]) {
  try {
    await revenueCatRequest(`/projects/${projectId}/packages/${packageId}/actions/attach_products`, "POST", {
      products: productIds.map((product_id) => ({ product_id, eligibility_criteria: "all" })),
    });
  } catch (error) {
    if (!String(error).includes("unprocessable_entity_error")) throw error;
  }
}

async function publicApiKey(projectId: string, appId: string): Promise<string> {
  const keys = await revenueCatRequest<Collection<{ key: string }>>(`/projects/${projectId}/apps/${appId}/public_api_keys`);
  const key = keys.items?.[0]?.key;
  if (!key) throw new Error(`No public API key found for RevenueCat app ${appId}`);
  return key;
}

async function main() {
  const project = await createProject();
  const testStore = await createApp(project.id, "test_store", TEST_STORE_APP_NAME);
  const playStore = await createApp(project.id, "play_store", PLAY_STORE_APP_NAME);
  const entitlements = new Map<string, Entitlement>();
  for (const entitlement of ENTITLEMENTS) {
    entitlements.set(
      entitlement.lookup_key,
      await createEntitlement(project.id, entitlement.lookup_key, entitlement.display_name),
    );
  }

  const packages = new Map<string, { packageId: string; productIds: string[] }>();
  const productsByPlan = new Map<string, string[]>();
  for (const item of PRODUCTS) {
    const testProduct = await createProduct(project.id, testStore, item.testIdentifier, item.displayName, item.duration);
    await ensureTestPrice(project.id, testProduct.id, item.priceMicros);
    const playProduct = await createProduct(project.id, playStore, item.playIdentifier, item.displayName, item.duration);
    const productIds = [testProduct.id, playProduct.id];
    const entitlement = entitlements.get(item.plan === "PREMIUM_PRO" ? "premium_pro" : "premium");
    if (!entitlement) throw new Error(`Missing entitlement for ${item.plan}`);
    await attachProductsToEntitlement(project.id, entitlement.id, productIds);
    productsByPlan.set(item.plan, [...(productsByPlan.get(item.plan) ?? []), ...productIds]);
    const offering = await createOffering(project.id);
    const pkg = await createPackage(project.id, offering.id, item.packageLookupKey, item.displayName);
    await attachProductToPackage(project.id, pkg.id, productIds);
    packages.set(item.packageLookupKey, { packageId: pkg.id, productIds });
  }

  console.log(JSON.stringify({
    projectId: project.id,
    testStoreAppId: testStore.id,
    playStoreAppId: playStore.id,
    testStoreApiKey: await publicApiKey(project.id, testStore.id),
    playStoreApiKey: await publicApiKey(project.id, playStore.id),
    entitlementIds: Object.fromEntries([...entitlements.entries()].map(([key, value]) => [key, value.id])),
    packages: Object.fromEntries(packages.entries()),
    productsByPlan: Object.fromEntries(productsByPlan.entries()),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});