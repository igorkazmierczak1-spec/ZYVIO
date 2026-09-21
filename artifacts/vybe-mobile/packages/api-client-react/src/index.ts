import { useMutation, useQuery } from "@tanstack/react-query";

type AnyRecord = Record<string, any>;
type QueryOptions = { query?: AnyRecord };
type MutationOptions = { mutation?: AnyRecord };

export type MediaAttachment = AnyRecord;
export type AuthTokenGetter = () => Promise<string | null> | string | null;

let baseUrl = "";
let authTokenGetter: AuthTokenGetter | null = null;

export function setBaseUrl(url: string | null) {
  baseUrl = url ? url.replace(/\/+$/, "") : "";
}

export function setAuthTokenGetter(getter: AuthTokenGetter | null) {
  authTokenGetter = getter;
}

async function request<T>(path: string, method = "GET", body?: unknown, query?: AnyRecord): Promise<T> {
  const search = query
    ? Object.entries(query).filter(([, value]) => value !== undefined && value !== null && value !== "").map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`).join("&")
    : "";
  const url = `${baseUrl}${path}${search ? `?${search}` : ""}`;
  const token = await authTokenGetter?.();
  const response = await fetch(url, {
    method,
    headers: {
      Accept: "application/json",
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) throw new Error(data?.error || data?.message || `HTTP ${response.status}`);
  return data as T;
}

function query<T>(key: unknown[], fn: () => Promise<T>, options?: QueryOptions) {
  const config = options?.query ?? {};
  return useQuery({ queryKey: config.queryKey ?? key, queryFn: fn, ...config });
}

function mutation<T>(fn: (variables: any) => Promise<T>, options?: MutationOptions) {
  return useMutation({ mutationFn: fn, ...(options?.mutation ?? {}) });
}

const key = (name: string, value?: unknown) => value === undefined ? [name] : [name, value];
const body = (variables: any) => variables?.data ?? variables;

export const getGetDashboardQueryKey = () => key("dashboard");
export const useGetDashboard = (options?: QueryOptions) => query(getGetDashboardQueryKey(), () => request("/api/dashboard"), options);

export const getListBattlesQueryKey = (params?: AnyRecord) => key("battles", params);
export const useListBattles = (params?: AnyRecord, options?: QueryOptions) => query(getListBattlesQueryKey(params), () => request("/api/battles", "GET", undefined, params), options);
export const useCreateBattle = (options?: MutationOptions) => mutation((variables) => request("/api/battles", "POST", body(variables)), options);
export const getGetBattleCreationUsageQueryKey = () => key("battle-creation-usage");
export const useGetBattleCreationUsage = (options?: QueryOptions) => query(getGetBattleCreationUsageQueryKey(), () => request("/api/battles/usage"), options);
export const getGetBattleQueryKey = (battleId: string) => key("battle", battleId);
export const useGetBattle = (battleId: string, options?: QueryOptions) => query(getGetBattleQueryKey(battleId), () => request(`/api/battles/${encodeURIComponent(battleId)}`), options);
export const useJoinBattle = (options?: MutationOptions) => mutation((variables) => request(`/api/battles/${encodeURIComponent(variables.battleId)}/join`, "POST"), options);
export const useVoteBattle = (options?: MutationOptions) => mutation((variables) => request(`/api/battles/${encodeURIComponent(variables.battleId)}/vote`, "POST", body(variables)), options);
export const getGetLeaderboardQueryKey = (params?: AnyRecord) => key("leaderboard", params);
export const useGetLeaderboard = (params?: AnyRecord, options?: QueryOptions) => query(getGetLeaderboardQueryKey(params), () => request("/api/leaderboard", "GET", undefined, params), options);

export const getGetProfileQueryKey = () => key("profile");
export const useGetProfile = (options?: QueryOptions) => query(getGetProfileQueryKey(), () => request("/api/profile"), options);
export const useUpdateProfile = (options?: MutationOptions) => mutation((variables) => request("/api/profile", "PATCH", body(variables)), options);

export const getListNotificationsQueryKey = () => key("notifications");
export const useListNotifications = (options?: QueryOptions) => query(getListNotificationsQueryKey(), () => request("/api/notifications"), options);
export const useMarkNotificationRead = (options?: MutationOptions) => mutation((variables) => request(`/api/notifications/${encodeURIComponent(variables.notificationId)}/read`, "PATCH"), options);
export const useMarkAllNotificationsRead = (options?: MutationOptions) => mutation(() => request("/api/notifications/read-all", "POST"), options);

export const getGetSocialFeedQueryKey = (params?: AnyRecord) => key("social-feed", params);
export const useGetSocialFeed = (params?: AnyRecord, options?: QueryOptions) => query(getGetSocialFeedQueryKey(params), () => request("/api/social/feed", "GET", undefined, params), options);
export const useCreateSocialPost = (options?: MutationOptions) => mutation((variables) => request("/api/social/posts", "POST", body(variables)), options);
export const getGetSocialPostQueryKey = (postId: string) => key("social-post", postId);
export const useGetSocialPost = (postId: string, options?: QueryOptions) => query(getGetSocialPostQueryKey(postId), () => request(`/api/social/posts/${encodeURIComponent(postId)}`), options);
export const useLikeSocialPost = (options?: MutationOptions) => mutation((variables) => request(`/api/social/posts/${encodeURIComponent(variables.postId)}/like`, "POST"), options);
export const useUnlikeSocialPost = (options?: MutationOptions) => mutation((variables) => request(`/api/social/posts/${encodeURIComponent(variables.postId)}/like`, "DELETE"), options);
export const getListSocialCommentsQueryKey = (postId: string) => key("social-comments", postId);
export const useListSocialComments = (postId: string, options?: QueryOptions) => query(getListSocialCommentsQueryKey(postId), () => request(`/api/social/posts/${encodeURIComponent(postId)}/comments`), options);
export const useCreateSocialComment = (options?: MutationOptions) => mutation((variables) => request(`/api/social/posts/${encodeURIComponent(variables.postId)}/comments`, "POST", body(variables)), options);
export const getGetSocialProfileQueryKey = (profileId: string) => key("social-profile", profileId);
export const useGetSocialProfile = (profileId: string, options?: QueryOptions) => query(getGetSocialProfileQueryKey(profileId), () => request(`/api/social/users/${encodeURIComponent(profileId)}`), options);
export const useFollowSocialProfile = (options?: MutationOptions) => mutation((variables) => request(`/api/social/users/${encodeURIComponent(variables.profileId)}/follow`, "POST"), options);
export const useUnfollowSocialProfile = (options?: MutationOptions) => mutation((variables) => request(`/api/social/users/${encodeURIComponent(variables.profileId)}/follow`, "DELETE"), options);
export const useBlockSocialProfile = (options?: MutationOptions) => mutation((variables) => request(`/api/social/users/${encodeURIComponent(variables.profileId)}/block`, "POST"), options);
export const useUnblockSocialProfile = (options?: MutationOptions) => mutation((variables) => request(`/api/social/users/${encodeURIComponent(variables.profileId)}/block`, "DELETE"), options);

export const getListSocialConversationsQueryKey = () => key("social-conversations");
export const useListSocialConversations = (options?: QueryOptions) => query(getListSocialConversationsQueryKey(), () => request("/api/social/conversations"), options);
export const useCreateSocialConversation = (options?: MutationOptions) => mutation((variables) => request("/api/social/conversations", "POST", body(variables)), options);
export const getListSocialMessagesQueryKey = (conversationId: string) => key("social-messages", conversationId);
export const useListSocialMessages = (conversationId: string, options?: QueryOptions) => query(getListSocialMessagesQueryKey(conversationId), () => request(`/api/social/conversations/${encodeURIComponent(conversationId)}/messages`), options);
export const useCreateSocialMessage = (options?: MutationOptions) => mutation((variables) => request(`/api/social/conversations/${encodeURIComponent(variables.conversationId)}/messages`, "POST", body(variables)), options);

export const useGenerateIdeas = (options?: MutationOptions) => mutation((variables) => request("/api/ai/ideas", "POST", body(variables)), options);
export const getGetAiUsageQueryKey = () => key("ai-usage");
export const useGetAiUsage = (options?: QueryOptions) => query(getGetAiUsageQueryKey(), () => request("/api/ai/usage"), options);
export const useCreateReport = (options?: MutationOptions) => mutation((variables) => request("/api/reports", "POST", body(variables)), options);

export const useRequestMediaUploadUrl = (options?: MutationOptions) => mutation((variables) => request("/api/storage/uploads/request-url", "POST", body(variables)), options);
export const useCompleteMediaUpload = (options?: MutationOptions) => mutation((variables) => request("/api/storage/uploads/complete", "POST", body(variables)), options);
export const useCancelMediaUpload = (options?: MutationOptions) => mutation((variables) => request(`/api/storage/uploads/${encodeURIComponent(variables.attachmentId ?? variables)}`, "DELETE"), options);

export const useGetPremiumBenefits = (options?: QueryOptions) => query(key("premium-benefits"), () => request("/api/premium/benefits"), options);
export const useGetPremiumSubscription = (options?: QueryOptions) => query(key("premium-subscription"), () => request("/api/premium/subscription"), options);
export const useSyncPremiumRevenueCat = (options?: MutationOptions) => mutation((variables) => request("/api/premium/revenuecat/sync", "POST", body(variables)), options);

const adminKey = (name: string, params?: AnyRecord) => key(`admin-${name}`, params);
export const getGetAdminSettingsQueryKey = () => adminKey("settings");
export const useGetAdminSettings = (options?: QueryOptions) => query(getGetAdminSettingsQueryKey(), () => request("/api/admin/settings"), options);
export const useUpdateAdminSettings = (options?: MutationOptions) => mutation((variables) => request("/api/admin/settings", "PATCH", body(variables)), options);
export const useGetAdminOverview = (options?: QueryOptions) => query(adminKey("overview"), () => request("/api/admin/overview"), options);
export const useGetAdminAnalytics = (params?: AnyRecord, options?: QueryOptions) => query(adminKey("analytics", params), () => request("/api/admin/analytics", "GET", undefined, params), options);
export const useGetAdminBillingConfig = (options?: QueryOptions) => query(adminKey("billing-config"), () => request("/api/admin/billing/config"), options);
export const useGetAdminBillingOverview = (params?: AnyRecord, options?: QueryOptions) => query(adminKey("billing-overview", params), () => request("/api/admin/billing/overview", "GET", undefined, params), options);
export const useGetAdminMonetization = (options?: QueryOptions) => query(adminKey("monetization"), () => request("/api/admin/monetization"), options);
export const getListAdminUsersQueryKey = (params?: AnyRecord) => adminKey("users", params);
export const useListAdminUsers = (params?: AnyRecord, options?: QueryOptions) => query(getListAdminUsersQueryKey(params), () => request("/api/admin/users", "GET", undefined, params), options);
export const useUpdateAdminUser = (options?: MutationOptions) => mutation((variables) => request(`/api/admin/users/${encodeURIComponent(variables.userId)}`, "PATCH", body(variables)), options);
export const getListAdminBattlesQueryKey = (params?: AnyRecord) => adminKey("battles", params);
export const useListAdminBattles = (params?: AnyRecord, options?: QueryOptions) => query(getListAdminBattlesQueryKey(params), () => request("/api/admin/battles", "GET", undefined, params), options);
export const useUpdateAdminBattle = (options?: MutationOptions) => mutation((variables) => request(`/api/admin/battles/${encodeURIComponent(variables.battleId)}`, "PATCH", body(variables)), options);
export const getListAdminReportsQueryKey = (params?: AnyRecord) => adminKey("reports", params);
export const useListAdminReports = (params?: AnyRecord, options?: QueryOptions) => query(getListAdminReportsQueryKey(params), () => request("/api/admin/reports", "GET", undefined, params), options);
export const useUpdateAdminReport = (options?: MutationOptions) => mutation((variables) => request(`/api/admin/reports/${encodeURIComponent(variables.reportId)}`, "PATCH", body(variables)), options);
export const getListAdminAuditQueryKey = (params?: AnyRecord) => adminKey("audit", params);
export const useListAdminAudit = (params?: AnyRecord, options?: QueryOptions) => query(getListAdminAuditQueryKey(params), () => request("/api/admin/audit", "GET", undefined, params), options);

export const AdminUserUpdateAction = { BLOCK: "BLOCK", UNBLOCK: "UNBLOCK", CHANGE_ROLE: "CHANGE_ROLE" } as const;
export const AdminReportUpdateStatus = { IN_PROGRESS: "IN_PROGRESS", RESOLVED: "RESOLVED" } as const;
export const AdminReportPriority = { LOW: "LOW", MEDIUM: "MEDIUM", HIGH: "HIGH", CRITICAL: "CRITICAL" } as const;
export type AdminRangeParameter = "24h" | "7d" | "30d" | "90d" | "all";
export type AdminReportPriority = typeof AdminReportPriority[keyof typeof AdminReportPriority];
export type AdminReportUpdateStatus = typeof AdminReportUpdateStatus[keyof typeof AdminReportUpdateStatus];
export type AdminUserUpdateAction = typeof AdminUserUpdateAction[keyof typeof AdminUserUpdateAction];