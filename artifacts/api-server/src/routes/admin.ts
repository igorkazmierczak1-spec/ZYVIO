import { Router, type IRouter } from "express";
import { and, asc, count, desc, eq, ilike, inArray, ne, or, sql } from "drizzle-orm";
import { db, profilesTable, battlesTable, battleParticipantsTable, moderationReportsTable, moderationReportHistoryTable, adminAuditLogsTable, appSettingsTable, activitiesTable, userActivityEventsTable } from "@workspace/db";
import {
  GetAdminOverviewQueryParams, GetAdminOverviewResponse, ListAdminUsersQueryParams, ListAdminUsersResponse,
  GetAdminUserParams, GetAdminUserResponse, UpdateAdminUserParams, UpdateAdminUserBody, UpdateAdminUserResponse,
  DeleteAdminUserParams, DeleteAdminUserBody, DeleteAdminUserResponse, ListAdminBattlesQueryParams, ListAdminBattlesResponse,
  UpdateAdminBattleParams, UpdateAdminBattleBody, UpdateAdminBattleResponse, ListAdminReportsQueryParams, ListAdminReportsResponse,
  UpdateAdminReportParams, UpdateAdminReportBody, UpdateAdminReportResponse, ListAdminAuditQueryParams, ListAdminAuditResponse,
  GetAdminAnalyticsQueryParams, GetAdminAnalyticsResponse, ListAdminNotificationsResponse, GetAdminSettingsResponse,
  UpdateAdminSettingsBody, UpdateAdminSettingsResponse, GetAdminMonetizationResponse,
} from "@workspace/api-zod";
import { currentUserFrom, requireAdmin, requireAuthenticatedUser } from "../middlewares/auth";

const router: IRouter = Router();
router.use(requireAuthenticatedUser, requireAdmin);
const date = (range: string) => range === "all" ? new Date(0) : new Date(Date.now() - ({ "24h": 864e5, "7d": 7 * 864e5, "30d": 30 * 864e5, "90d": 90 * 864e5 }[range] ?? 30 * 864e5));
const bucketFor = (range: string) => range === "24h" ? "hour" : range === "all" ? "month" : "day";
const trendData = async (range: string, since: Date) => {
  const bucket = bucketFor(range);
  const [users, registrations, battles, submissions] = await Promise.all([
    db.select({ bucket: sql<Date>`date_trunc(${bucket}, ${userActivityEventsTable.occurredAt})`, value: sql<number>`count(distinct ${userActivityEventsTable.profileId})` })
      .from(userActivityEventsTable).where(sql`${userActivityEventsTable.occurredAt} >= ${since}`).groupBy(sql`date_trunc(${bucket}, ${userActivityEventsTable.occurredAt})`),
    db.select({ bucket: sql<Date>`date_trunc(${bucket}, ${profilesTable.createdAt})`, value: count() })
      .from(profilesTable).where(and(ne(profilesTable.status, "DELETED"), sql`${profilesTable.createdAt} >= ${since}`)).groupBy(sql`date_trunc(${bucket}, ${profilesTable.createdAt})`),
    db.select({ bucket: sql<Date>`date_trunc(${bucket}, ${battlesTable.createdAt})`, value: count() })
      .from(battlesTable).where(sql`${battlesTable.createdAt} >= ${since}`).groupBy(sql`date_trunc(${bucket}, ${battlesTable.createdAt})`),
    db.select({ bucket: sql<Date>`date_trunc(${bucket}, ${battleParticipantsTable.joinedAt})`, value: count() })
      .from(battleParticipantsTable).where(sql`${battleParticipantsTable.joinedAt} >= ${since}`).groupBy(sql`date_trunc(${bucket}, ${battleParticipantsTable.joinedAt})`),
  ]);
  const byDate = (rows: Array<{ bucket: Date; value: number }>) => new Map(rows.map(row => [new Date(row.bucket).toISOString().slice(0, bucket === "month" ? 7 : bucket === "hour" ? 13 : 10), Number(row.value)]));
  const maps = [byDate(users), byDate(registrations), byDate(battles), byDate(submissions)];
  const keys = new Set(maps.flatMap(map => [...map.keys()]));
  if (range !== "all") {
    const cursor = new Date(since);
    if (bucket === "hour") cursor.setUTCMinutes(0, 0, 0);
    else cursor.setUTCHours(0, 0, 0, 0);
    const end = new Date();
    while (cursor <= end) {
      keys.add(cursor.toISOString().slice(0, bucket === "hour" ? 13 : 10));
      if (bucket === "hour") cursor.setUTCHours(cursor.getUTCHours() + 1);
      else cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }
  return [...keys].sort().map(key => ({ date: key, users: maps[0].get(key) ?? 0, registrations: maps[1].get(key) ?? 0, battles: maps[2].get(key) ?? 0, submissions: maps[3].get(key) ?? 0 }));
};
const pageInfo = (page: number, pageSize: number, total: number) => ({ page, pageSize, total, totalPages: Math.ceil(total / pageSize) });
const userView = (u: any) => ({ ...u, subscriptionStatus: "NOT_CONNECTED" as const });
type DbExecutor = { insert: (table: typeof adminAuditLogsTable) => any };
const audit = async (executor: DbExecutor, actor: any, action: string, targetType: string, targetId: string | null, result: string, reason?: string, metadata: Record<string, unknown> = {}) =>
  executor.insert(adminAuditLogsTable).values({ id: `audit-${crypto.randomUUID()}`, actorProfileId: actor.id, action, targetType, targetId, result, reason, metadata });
const rejected = async (executor: DbExecutor, actor: any, action: string, targetType: string, targetId: string | null, reason?: string) => audit(executor, actor, action, targetType, targetId, "REJECTED", reason);
const fail = (res: any, message: string, status = 400) => { res.status(status).json({ error: message }); };
const confirmation = (res: any, value: string, expected: string) => value === expected || (fail(res, `Confirmation must be exactly ${expected}`), false);

router.get("/overview", async (req, res, next) => {
  try {
    const q = GetAdminOverviewQueryParams.parse(req.query); const since = date(q.range);
    const [users, active, registrations, battles, activeBattles, reports, topUsers, topBattles, submissions, trend] = await Promise.all([
      db.select({ n: count() }).from(profilesTable).where(ne(profilesTable.status, "DELETED")), db.select({ n: count() }).from(profilesTable).where(and(eq(profilesTable.status, "ACTIVE"), sql`${profilesTable.lastActiveAt} >= ${since}`)),
      db.select({ n: count() }).from(profilesTable).where(and(ne(profilesTable.status, "DELETED"), sql`${profilesTable.createdAt} >= ${since}`)), db.select({ n: count() }).from(battlesTable),
      db.select({ n: count() }).from(battlesTable).where(inArray(battlesTable.status, ["open", "live"])), db.select({ n: count() }).from(moderationReportsTable).where(inArray(moderationReportsTable.status, ["NEW", "IN_PROGRESS"])),
      db.select().from(profilesTable).where(ne(profilesTable.status, "DELETED")).orderBy(desc(profilesTable.xp)).limit(10), db.select().from(battlesTable),
      db.select({ n: count() }).from(battleParticipantsTable).where(sql`${battleParticipantsTable.joinedAt} >= ${since}`), trendData(q.range, since),
    ]);
    const battleIds = topBattles.map(b => b.id);
    const parts = battleIds.length ? await db.select({ battleId: battleParticipantsTable.battleId, participants: count(), votes: sql<number>`coalesce(sum(${battleParticipantsTable.votes}),0)` }).from(battleParticipantsTable).where(inArray(battleParticipantsTable.battleId, battleIds)).groupBy(battleParticipantsTable.battleId) : [];
    const pm = new Map(parts.map(p => [p.battleId, p]));
    const rankedBattles = topBattles.map(b => ({ ...b, participantCount: Number(pm.get(b.id)?.participants ?? 0), totalVotes: Number(pm.get(b.id)?.votes ?? 0) })).sort((a, b) => b.participantCount - a.participantCount || b.totalVotes - a.totalVotes).slice(0, 10);
    const response = { range: q.range, generatedAt: new Date(), kpis: { totalUsers: Number(users[0]?.n ?? 0), activeUsers: Number(active[0]?.n ?? 0), newRegistrations: Number(registrations[0]?.n ?? 0), onlineUsers: null, totalBattles: Number(battles[0]?.n ?? 0), activeBattles: Number(activeBattles[0]?.n ?? 0), submissions: Number(submissions[0]?.n ?? 0), openReports: Number(reports[0]?.n ?? 0) }, trend, topBattles: rankedBattles, topUsers: topUsers.map(userView), dataAvailability: { onlineUsers: false, subscriptions: false, revenue: false, retention: false } };
    res.json(GetAdminOverviewResponse.parse(response));
  } catch (e) { next(e); }
});

router.get("/users", async (req, res, next) => {
  try { const q = ListAdminUsersQueryParams.parse(req.query); const filters: any[] = [];
    if (q.role) filters.push(eq(profilesTable.role, q.role)); if (q.status) filters.push(eq(profilesTable.status, q.status));
    if (q.search) filters.push(or(ilike(profilesTable.username, `%${q.search}%`), ilike(profilesTable.displayName, `%${q.search}%`), ilike(profilesTable.email, `%${q.search}%`)));
    const [rows, total] = await Promise.all([db.select().from(profilesTable).where(filters.length ? and(...filters) : undefined).orderBy((q.order === "asc" ? asc : desc)(q.sort === "lastActiveAt" ? profilesTable.lastActiveAt : q.sort === "xp" ? profilesTable.xp : q.sort === "username" ? profilesTable.username : profilesTable.createdAt)).limit(q.pageSize).offset((q.page - 1) * q.pageSize), db.select({ n: count() }).from(profilesTable).where(filters.length ? and(...filters) : undefined)]);
    res.json(ListAdminUsersResponse.parse({ items: rows.map(userView), ...pageInfo(q.page, q.pageSize, Number(total[0]?.n ?? 0)) }));
  } catch (e) { next(e); }
});

router.get("/users/:userId", async (req, res, next) => {
  try { const p = GetAdminUserParams.parse(req.params); const [u] = await db.select().from(profilesTable).where(eq(profilesTable.id, p.userId)); if (!u) { fail(res, "User not found", 404); return; }
    const [acts, logs] = await Promise.all([db.select().from(activitiesTable).where(eq(activitiesTable.profileId, u.id)).orderBy(desc(activitiesTable.createdAt)).limit(20), db.select().from(adminAuditLogsTable).where(or(eq(adminAuditLogsTable.targetId, u.id), eq(adminAuditLogsTable.actorProfileId, u.id))).orderBy(desc(adminAuditLogsTable.createdAt)).limit(50)]);
    res.json(GetAdminUserResponse.parse({ ...userView(u), email: u.email, activity: acts, audit: logs }));
  } catch (e) { next(e); }
});

router.patch("/users/:userId", async (req, res, next) => {
  try { const p = UpdateAdminUserParams.parse(req.params); const b = UpdateAdminUserBody.parse(req.body); const actor = currentUserFrom(res); if (!confirmation(res, b.confirmation, b.action)) { await rejected(db, actor, b.action, "USER", p.userId, b.reason); return; }
    if (b.action === "CHANGE_ROLE" && !b.role) { await rejected(db, actor, b.action, "USER", p.userId, b.reason); fail(res, "A role is required"); return; }
    const values = b.action === "BLOCK" ? { status: "BLOCKED" as const, blockedAt: new Date(), blockReason: b.reason } : b.action === "UNBLOCK" ? { status: "ACTIVE" as const, blockedAt: null, blockReason: null } : b.action === "RESET_STATS" ? { xp: 0, wins: 0, losses: 0, rank: 0, streak: 0 } : { role: b.role! };
    const outcome = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(821734)`);
      const [[freshActor], [target]] = await Promise.all([
        tx.select().from(profilesTable).where(eq(profilesTable.id, actor.id)),
        tx.select().from(profilesTable).where(eq(profilesTable.id, p.userId)),
      ]);
      if (!freshActor || freshActor.role !== "ADMIN" || freshActor.status !== "ACTIVE") return { error: "Administrator access is no longer active", status: 403 as const };
      if (!target) return { error: "User not found", status: 404 as const };
      if (target.id === freshActor.id && (b.action === "BLOCK" || (b.action === "CHANGE_ROLE" && b.role !== "ADMIN"))) {
        await rejected(tx, freshActor, b.action, "USER", target.id, b.reason);
        return { error: "You cannot remove your own administrator access", status: 400 as const };
      }
      const removesActiveAdmin = target.role === "ADMIN" && target.status === "ACTIVE" &&
        (b.action === "BLOCK" || (b.action === "CHANGE_ROLE" && b.role === "USER"));
      if (removesActiveAdmin) {
        const [{ n }] = await tx.select({ n: count() }).from(profilesTable).where(and(eq(profilesTable.role, "ADMIN"), eq(profilesTable.status, "ACTIVE")));
        if (Number(n) <= 1) {
          await rejected(tx, freshActor, b.action, "USER", target.id, b.reason);
          return { error: "Cannot remove access from the last active administrator", status: 409 as const };
        }
      }
      const [row] = await tx.update(profilesTable).set(values).where(eq(profilesTable.id, target.id)).returning();
      await audit(tx, freshActor, b.action, "USER", target.id, "SUCCESS", b.reason);
      return { row };
    });
    if ("error" in outcome && outcome.error) { fail(res, outcome.error, outcome.status ?? 400); return; } const updated = outcome.row;
    res.json(UpdateAdminUserResponse.parse(userView(updated)));
  } catch (e) { next(e); }
});

router.delete("/users/:userId", async (req, res, next) => {
  try { const p = DeleteAdminUserParams.parse(req.params); const b = DeleteAdminUserBody.parse(req.body); const actor = currentUserFrom(res); if (!confirmation(res, b.confirmation, "DELETE")) { await rejected(db, actor, "DELETE", "USER", p.userId, b.reason); return; }
    const outcome = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(821734)`);
      const [[freshActor], [target]] = await Promise.all([
        tx.select().from(profilesTable).where(eq(profilesTable.id, actor.id)),
        tx.select().from(profilesTable).where(eq(profilesTable.id, p.userId)),
      ]);
      if (!freshActor || freshActor.role !== "ADMIN" || freshActor.status !== "ACTIVE") return { error: "Administrator access is no longer active", status: 403 as const };
      if (!target) return { error: "User not found", status: 404 as const };
      if (target.id === freshActor.id) {
        await rejected(tx, freshActor, "DELETE", "USER", target.id, b.reason);
        return { error: "You cannot delete yourself", status: 400 as const };
      }
      if (target.role === "ADMIN" && target.status === "ACTIVE") {
        const [{ n }] = await tx.select({ n: count() }).from(profilesTable).where(and(eq(profilesTable.role, "ADMIN"), eq(profilesTable.status, "ACTIVE")));
        if (Number(n) <= 1) {
          await rejected(tx, freshActor, "DELETE", "USER", target.id, b.reason);
          return { error: "Cannot delete the last active administrator", status: 409 as const };
        }
      }
      await tx.update(profilesTable).set({ status: "DELETED", deletedAt: new Date() }).where(eq(profilesTable.id, target.id));
      await audit(tx, freshActor, "DELETE", "USER", target.id, "SUCCESS", b.reason);
      return {};
    });
    if ("error" in outcome && outcome.error) { fail(res, outcome.error, outcome.status ?? 400); return; }
    res.json(DeleteAdminUserResponse.parse({ success: true, message: "User deleted" }));
  } catch (e) { next(e); }
});

async function battleView(b: any) { const [p] = await db.select({ participants: count(), votes: sql<number>`coalesce(sum(${battleParticipantsTable.votes}),0)` }).from(battleParticipantsTable).where(eq(battleParticipantsTable.battleId, b.id)); return { id: b.id, title: b.title, category: b.category, status: b.status, contentStatus: b.contentStatus, createdAt: b.createdAt, endsAt: b.endsAt, participantCount: Number(p?.participants ?? 0), totalVotes: Number(p?.votes ?? 0) }; }
router.get("/battles", async (req, res, next) => { try { const q = ListAdminBattlesQueryParams.parse(req.query); const f: any[] = []; if (q.status) f.push(eq(battlesTable.status, q.status)); if (q.search) f.push(ilike(battlesTable.title, `%${q.search}%`)); const [rows, t] = await Promise.all([db.select().from(battlesTable).where(f.length ? and(...f) : undefined).orderBy(desc(battlesTable.createdAt)).limit(q.pageSize).offset((q.page - 1) * q.pageSize), db.select({ n: count() }).from(battlesTable).where(f.length ? and(...f) : undefined)]); res.json(ListAdminBattlesResponse.parse({ items: await Promise.all(rows.map(battleView)), ...pageInfo(q.page, q.pageSize, Number(t[0]?.n ?? 0)) })); } catch (e) { next(e); } });
router.patch("/battles/:battleId", async (req, res, next) => { try { const p = UpdateAdminBattleParams.parse(req.params); const b = UpdateAdminBattleBody.parse(req.body); const actor = currentUserFrom(res); if (!confirmation(res, b.confirmation, "MODERATE")) { await rejected(db, actor, "MODERATE", "BATTLE", p.battleId, b.reason); return; } const [battle] = await db.select().from(battlesTable).where(eq(battlesTable.id, p.battleId)); if (!battle) { fail(res, "Battle not found", 404); return; } const updated = await db.transaction(async (tx) => { const [row] = await tx.update(battlesTable).set({ contentStatus: b.contentStatus }).where(eq(battlesTable.id, p.battleId)).returning(); await audit(tx, actor, "MODERATE", "BATTLE", p.battleId, "SUCCESS", b.reason, { contentStatus: b.contentStatus }); return row; }); res.json(UpdateAdminBattleResponse.parse(await battleView(updated))); } catch (e) { next(e); } });

router.get("/reports", async (req, res, next) => { try { const q = ListAdminReportsQueryParams.parse(req.query); const f: any[] = []; const statuses = ["NEW", "IN_PROGRESS", "RESOLVED", "REJECTED"] as const; const priorities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const; if (q.status && statuses.includes(q.status as typeof statuses[number])) f.push(eq(moderationReportsTable.status, q.status as typeof statuses[number])); else if (q.status) { fail(res, "Invalid report status"); return; } if (q.priority && priorities.includes(q.priority as typeof priorities[number])) f.push(eq(moderationReportsTable.priority, q.priority as typeof priorities[number])); else if (q.priority) { fail(res, "Invalid report priority"); return; } const [rows, t] = await Promise.all([db.select().from(moderationReportsTable).where(f.length ? and(...f) : undefined).orderBy(desc(moderationReportsTable.createdAt)).limit(q.pageSize).offset((q.page - 1) * q.pageSize), db.select({ n: count() }).from(moderationReportsTable).where(f.length ? and(...f) : undefined)]); res.json(ListAdminReportsResponse.parse({ items: rows, ...pageInfo(q.page, q.pageSize, Number(t[0]?.n ?? 0)) })); } catch (e) { next(e); } });
router.patch("/reports/:reportId", async (req, res, next) => { try { const p = UpdateAdminReportParams.parse(req.params); const b = UpdateAdminReportBody.parse(req.body); const actor = currentUserFrom(res); const [old] = await db.select().from(moderationReportsTable).where(eq(moderationReportsTable.id, p.reportId)); if (!old) { fail(res, "Report not found", 404); return; } const updated = await db.transaction(async (tx) => { const [row] = await tx.update(moderationReportsTable).set({ status: b.status, priority: b.priority, assignedAdminId: b.assignToSelf ? actor.id : old.assignedAdminId, resolutionNote: b.resolutionNote, updatedAt: new Date() }).where(eq(moderationReportsTable.id, p.reportId)).returning(); await tx.insert(moderationReportHistoryTable).values({ id: `history-${crypto.randomUUID()}`, reportId: old.id, actorProfileId: actor.id, fromStatus: old.status, toStatus: b.status, note: b.resolutionNote }); await audit(tx, actor, "UPDATE_REPORT", "REPORT", old.id, "SUCCESS", b.resolutionNote); return row; }); res.json(UpdateAdminReportResponse.parse(updated)); } catch (e) { next(e); } });

router.get("/audit", async (req, res, next) => { try { const q = ListAdminAuditQueryParams.parse(req.query); const [rows, t] = await Promise.all([db.select().from(adminAuditLogsTable).orderBy(desc(adminAuditLogsTable.createdAt)).limit(q.pageSize).offset((q.page - 1) * q.pageSize), db.select({ n: count() }).from(adminAuditLogsTable)]); res.json(ListAdminAuditResponse.parse({ items: rows, ...pageInfo(q.page, q.pageSize, Number(t[0]?.n ?? 0)) })); } catch (e) { next(e); } });
router.get("/analytics", async (req, res, next) => { try { const q = GetAdminAnalyticsQueryParams.parse(req.query); const since = date(q.range); const [dau, mau, eventTotal, registrations, battles, submissions, trend] = await Promise.all([db.select({ n: sql<number>`count(distinct ${userActivityEventsTable.profileId})` }).from(userActivityEventsTable).where(sql`${userActivityEventsTable.occurredAt} >= ${new Date(Date.now() - 864e5)}`), db.select({ n: sql<number>`count(distinct ${userActivityEventsTable.profileId})` }).from(userActivityEventsTable).where(sql`${userActivityEventsTable.occurredAt} >= ${new Date(Date.now() - 30 * 864e5)}`), db.select({ n: count() }).from(userActivityEventsTable), db.select({ n: count() }).from(profilesTable).where(and(ne(profilesTable.status, "DELETED"), sql`${profilesTable.createdAt} >= ${since}`)), db.select({ n: count() }).from(battlesTable).where(sql`${battlesTable.createdAt} >= ${since}`), db.select({ n: count() }).from(battleParticipantsTable).where(sql`${battleParticipantsTable.joinedAt} >= ${since}`), trendData(q.range, since)]); const fallback = Number(eventTotal[0]?.n ?? 0) === 0; const dauValue = fallback ? Number((await db.select({ n: count() }).from(profilesTable).where(and(ne(profilesTable.status, "DELETED"), sql`${profilesTable.lastActiveAt} >= ${new Date(Date.now() - 864e5)}`)))[0]?.n ?? 0) : Number(dau[0]?.n ?? 0); const mauValue = fallback ? Number((await db.select({ n: count() }).from(profilesTable).where(and(ne(profilesTable.status, "DELETED"), sql`${profilesTable.lastActiveAt} >= ${new Date(Date.now() - 30 * 864e5)}`)))[0]?.n ?? 0) : Number(mau[0]?.n ?? 0); res.json(GetAdminAnalyticsResponse.parse({ range: q.range, dau: dauValue, mau: mauValue, registrations: Number(registrations[0]?.n ?? 0), battles: Number(battles[0]?.n ?? 0), submissions: Number(submissions[0]?.n ?? 0), retention: null, trend })); } catch (e) { next(e); } });
router.get("/notifications", async (_req, res, next) => { try {
  const [settings] = await db.select().from(appSettingsTable).where(eq(appSettingsTable.id, "global"));
  if (settings && !settings.adminNotificationsEnabled) { res.json(ListAdminNotificationsResponse.parse([])); return; }
  const since = new Date(Date.now() - 7 * 864e5);
  const [reports, registrations, rejectedActions] = await Promise.all([
    db.select().from(moderationReportsTable).where(inArray(moderationReportsTable.status, ["NEW", "IN_PROGRESS"])).orderBy(desc(moderationReportsTable.createdAt)).limit(30),
    db.select().from(profilesTable).where(and(ne(profilesTable.status, "DELETED"), sql`${profilesTable.createdAt} >= ${since}`)).orderBy(desc(profilesTable.createdAt)).limit(20),
    db.select().from(adminAuditLogsTable).where(and(eq(adminAuditLogsTable.result, "REJECTED"), sql`${adminAuditLogsTable.createdAt} >= ${since}`)).orderBy(desc(adminAuditLogsTable.createdAt)).limit(20),
  ]);
  const items = [
    ...reports.map(r => ({ id: `report-${r.id}`, kind: "MODERATION", title: "Open moderation report", body: r.reason, createdAt: r.createdAt, severity: r.priority === "CRITICAL" ? "CRITICAL" as const : r.priority === "HIGH" ? "WARNING" as const : "INFO" as const })),
    ...registrations.map(u => ({ id: `registration-${u.id}`, kind: "REGISTRATION", title: "New registration", body: u.displayName, createdAt: u.createdAt, severity: "INFO" as const })),
    ...rejectedActions.map(a => ({ id: `audit-${a.id}`, kind: "SECURITY", title: "Rejected administrator action", body: `${a.action} · ${a.targetType}`, createdAt: a.createdAt, severity: "WARNING" as const })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 50);
  res.json(ListAdminNotificationsResponse.parse(items));
} catch (e) { next(e); } });
router.get("/settings", async (_req, res, next) => { try { let [s] = await db.select().from(appSettingsTable).where(eq(appSettingsTable.id, "global")); if (!s) [s] = await db.insert(appSettingsTable).values({ id: "global" }).returning(); res.json(GetAdminSettingsResponse.parse(s)); } catch (e) { next(e); } });
router.patch("/settings", async (req, res, next) => { try { const b = UpdateAdminSettingsBody.parse(req.body); const actor = currentUserFrom(res); if (!confirmation(res, b.confirmation, "UPDATE_SETTINGS")) { await rejected(db, actor, "UPDATE_SETTINGS", "SETTINGS", "global"); return; } const { confirmation: _confirmation, ...changes } = b; const s = await db.transaction(async (tx) => { const [row] = await tx.update(appSettingsTable).set({ ...changes, updatedBy: actor.id, updatedAt: new Date() }).where(eq(appSettingsTable.id, "global")).returning(); if (row) await audit(tx, actor, "UPDATE_SETTINGS", "SETTINGS", "global", "SUCCESS"); return row; }); if (!s) { fail(res, "Settings not found", 404); return; } res.json(UpdateAdminSettingsResponse.parse(s)); } catch (e) { next(e); } });
router.get("/monetization", (_req, res) => res.json(GetAdminMonetizationResponse.parse({ connected: false, provider: null, activeSubscriptions: null, cancelledSubscriptions: null, revenue: null, mrr: null, topPlan: null, message: "Monetization provider is not connected" })));
export default router;