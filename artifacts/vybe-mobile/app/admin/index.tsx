import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import {
  AdminRangeParameter,
  AdminReportPriority,
  AdminReportUpdateStatus,
  AdminUserUpdateAction,
  useGetAdminAnalytics,
  useGetAdminBillingConfig,
  useGetAdminBillingOverview,
  useGetAdminMonetization,
  useGetAdminOverview,
  useGetAdminSettings,
  useGetProfile,
  useListAdminAudit,
  useListAdminBattles,
  useListAdminReports,
  useListAdminUsers,
  useUpdateAdminBattle,
  useUpdateAdminReport,
  useUpdateAdminSettings,
  useUpdateAdminUser,
  getGetAdminSettingsQueryKey,
  getListAdminAuditQueryKey,
  getListAdminBattlesQueryKey,
  getListAdminReportsQueryKey,
  getListAdminUsersQueryKey,
} from '@workspace/api-client-react';
import { AppScreen, Card, EmptyState, ErrorState, Header, LoadingState, PrimaryButton, Stat, uiStyles } from '@/components/ui';
import { useColors } from '@/hooks/useColors';

type Tab = 'overview' | 'users' | 'battles' | 'reports' | 'analytics' | 'settings' | 'billing' | 'audit';

const tabs: { key: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'overview', label: 'Overview', icon: 'grid-outline' },
  { key: 'users', label: 'Users', icon: 'people-outline' },
  { key: 'battles', label: 'Battles', icon: 'flash-outline' },
  { key: 'reports', label: 'Reports', icon: 'flag-outline' },
  { key: 'analytics', label: 'Analytics', icon: 'analytics-outline' },
  { key: 'settings', label: 'Settings', icon: 'settings-outline' },
  { key: 'billing', label: 'Billing', icon: 'card-outline' },
  { key: 'audit', label: 'Audit', icon: 'time-outline' },
];

function State({ loading, error, retry, children }: { loading: boolean; error: boolean; retry: () => void; children: React.ReactNode }) {
  if (loading) return <LoadingState />;
  if (error) return <ErrorState onRetry={retry} />;
  return <>{children}</>;
}

function Row({ label, value, action }: { label: string; value: string | number; action?: React.ReactNode }) {
  const colors = useColors();
  return <View style={styles.row}><View style={{ flex: 1 }}><Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text><Text style={[styles.value, { color: colors.foreground }]}>{String(value)}</Text></View>{action}</View>;
}

function Overview() {
  const colors = useColors();
  const [range, setRange] = useState<AdminRangeParameter>('7d');
  const q = useGetAdminOverview({ range });
  return <State loading={q.isLoading} error={q.isError} retry={() => q.refetch()}>{q.data ? <View style={styles.section}>
    <View style={styles.range}>{(['24h', '7d', '30d', '90d', 'all'] as AdminRangeParameter[]).map((item) => <Pressable key={item} onPress={() => setRange(item)} style={[styles.rangeButton, { backgroundColor: range === item ? colors.primary : colors.card }]}><Text style={{ color: range === item ? colors.primaryForeground : colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 12 }}>{item}</Text></Pressable>)}</View>
    <View style={styles.stats}><Stat label="Total users" value={q.data.kpis.totalUsers} icon="people-outline" /><Stat label="Active users" value={q.data.kpis.activeUsers} icon="pulse-outline" accent="cyan" /><Stat label="Battles" value={q.data.kpis.totalBattles} icon="flash-outline" accent="lime" /><Stat label="Open reports" value={q.data.kpis.openReports} icon="flag-outline" accent="coral" /></View>
    <Card><Text style={[styles.cardTitle, { color: colors.foreground }]}>Activity trend</Text>{q.data.trend.slice(-7).map((point) => <Row key={point.date} label={point.date} value={`${point.users} users · ${point.battles} battles`} />)}</Card>
  </View> : null}</State>;
}

function Users() {
  const colors = useColors();
  const client = useQueryClient();
  const q = useListAdminUsers({ page: 1, pageSize: 25 });
  const mutation = useUpdateAdminUser({ mutation: { onSuccess: () => { client.invalidateQueries({ queryKey: getListAdminUsersQueryKey() }); } } });
  const update = (id: string, action: typeof AdminUserUpdateAction[keyof typeof AdminUserUpdateAction], confirmation: string) => {
    Alert.alert('Confirm admin action', `Apply ${action.toLowerCase()} to this user?`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Confirm', onPress: () => mutation.mutate({ userId: id, data: { action, reason: 'Admin console moderation', confirmation } }) }]);
  };
  return <State loading={q.isLoading} error={q.isError} retry={() => q.refetch()}><View style={styles.section}>{q.data?.items.map((user) => <Card key={user.id} accent={user.status === 'BLOCKED' ? colors.destructive : undefined}><View style={styles.row}><View style={{ flex: 1 }}><Text style={[styles.value, { color: colors.foreground }]}>{user.displayName}</Text><Text style={[styles.label, { color: colors.mutedForeground }]}>@{user.username} · {user.role}</Text></View><Text style={[styles.badge, { color: user.status === 'ACTIVE' ? colors.accent : colors.destructive }]}>{user.status}</Text></View><View style={styles.actions}>{user.status === 'ACTIVE' ? <PrimaryButton disabled={mutation.isPending} secondary onPress={() => update(user.id, AdminUserUpdateAction.BLOCK, 'BLOCK')}>Block</PrimaryButton> : user.status === 'BLOCKED' ? <PrimaryButton disabled={mutation.isPending} secondary onPress={() => update(user.id, AdminUserUpdateAction.UNBLOCK, 'UNBLOCK')}>Unblock</PrimaryButton> : null}{user.role === 'ADMIN' ? <PrimaryButton disabled={mutation.isPending} secondary onPress={() => update(user.id, AdminUserUpdateAction.CHANGE_ROLE, 'CHANGE_ROLE')}>Revoke admin</PrimaryButton> : null}</View></Card>)}{q.data?.items.length === 0 ? <EmptyState title="No users" body="No users match the current list." /> : null}</View></State>;
}

function Battles() {
  const colors = useColors();
  const client = useQueryClient();
  const q = useListAdminBattles({ page: 1, pageSize: 25 });
  const mutation = useUpdateAdminBattle({ mutation: { onSuccess: () => client.invalidateQueries({ queryKey: getListAdminBattlesQueryKey() }) } });
  const update = (id: string, contentStatus: 'ACTIVE' | 'HIDDEN' | 'REMOVED') => Alert.alert('Update battle', `Mark this battle ${contentStatus.toLowerCase()}?`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Confirm', onPress: () => mutation.mutate({ battleId: id, data: { contentStatus, reason: 'Admin console moderation', confirmation: contentStatus } }) }]);
  return <State loading={q.isLoading} error={q.isError} retry={() => q.refetch()}><View style={styles.section}>{q.data?.items.map((battle) => <Card key={battle.id}><Text style={[styles.value, { color: colors.foreground }]}>{battle.title}</Text><Text style={[styles.label, { color: colors.mutedForeground }]}>{battle.category} · {battle.participantCount} participants · {battle.contentStatus}</Text><View style={styles.actions}><PrimaryButton secondary onPress={() => update(battle.id, battle.contentStatus === 'ACTIVE' ? 'HIDDEN' : 'ACTIVE')}>{battle.contentStatus === 'ACTIVE' ? 'Hide' : 'Show'}</PrimaryButton>{battle.contentStatus !== 'REMOVED' ? <PrimaryButton secondary onPress={() => update(battle.id, 'REMOVED')}>Remove</PrimaryButton> : null}</View></Card>)}</View></State>;
}

function Reports() {
  const colors = useColors();
  const client = useQueryClient();
  const q = useListAdminReports({ page: 1, pageSize: 25 });
  const mutation = useUpdateAdminReport({ mutation: { onSuccess: () => client.invalidateQueries({ queryKey: getListAdminReportsQueryKey() }) } });
  const update = (id: string, status: typeof AdminReportUpdateStatus[keyof typeof AdminReportUpdateStatus]) => Alert.alert('Update report', `Set report to ${status.toLowerCase()}?`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Confirm', onPress: () => mutation.mutate({ reportId: id, data: { status, priority: AdminReportPriority.MEDIUM, resolutionNote: 'Reviewed in admin console' } }) }]);
  return <State loading={q.isLoading} error={q.isError} retry={() => q.refetch()}><View style={styles.section}>{q.data?.items.map((report) => <Card key={report.id} accent={report.priority === 'CRITICAL' ? colors.destructive : undefined}><Text style={[styles.value, { color: colors.foreground }]}>{report.reason}</Text><Text style={[styles.label, { color: colors.mutedForeground }]}>{report.targetType} · {report.targetId} · {report.priority}</Text><Text style={[styles.label, { color: colors.mutedForeground }]}>{report.description}</Text><View style={styles.actions}>{report.status !== 'IN_PROGRESS' ? <PrimaryButton secondary onPress={() => update(report.id, AdminReportUpdateStatus.IN_PROGRESS)}>Review</PrimaryButton> : null}{report.status !== 'RESOLVED' ? <PrimaryButton secondary onPress={() => update(report.id, AdminReportUpdateStatus.RESOLVED)}>Resolve</PrimaryButton> : null}</View></Card>)}</View></State>;
}

function Analytics() {
  const [range] = useState<AdminRangeParameter>('30d');
  const q = useGetAdminAnalytics({ range });
  return <State loading={q.isLoading} error={q.isError} retry={() => q.refetch()}>{q.data ? <View style={styles.section}><View style={styles.stats}><Stat label="DAU" value={q.data.dau} icon="pulse-outline" /><Stat label="MAU" value={q.data.mau} icon="people-outline" accent="cyan" /><Stat label="Registrations" value={q.data.registrations} icon="person-add-outline" accent="lime" /><Stat label="Retention" value={q.data.retention == null ? 'N/A' : `${q.data.retention}%`} icon="repeat-outline" accent="coral" /></View><Card>{q.data.trend.map((point) => <Row key={point.date} label={point.date} value={`${point.users} users · ${point.submissions} submissions`} />)}</Card></View> : null}</State>;
}

function Settings() {
  const colors = useColors();
  const client = useQueryClient();
  const q = useGetAdminSettings();
  const mutation = useUpdateAdminSettings({ mutation: { onSuccess: () => client.invalidateQueries({ queryKey: getGetAdminSettingsQueryKey() }) } });
  const toggle = (key: 'maintenanceMode' | 'registrationsEnabled' | 'moderationAutoAssign' | 'adminNotificationsEnabled', value: boolean) => mutation.mutate({ data: { [key]: value, confirmation: 'SETTINGS_UPDATE' } });
  return <State loading={q.isLoading} error={q.isError} retry={() => q.refetch()}>{q.data ? <View style={styles.section}><Card><Text style={[styles.cardTitle, { color: colors.foreground }]}>Platform controls</Text>{(['maintenanceMode', 'registrationsEnabled', 'moderationAutoAssign', 'adminNotificationsEnabled'] as const).map((key) => <Row key={key} label={key.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`)} value={q.data[key] ? 'Enabled' : 'Disabled'} action={<Switch value={q.data[key]} onValueChange={(value) => toggle(key, value)} disabled={mutation.isPending} trackColor={{ true: colors.primary }} />} />)}</Card><Text style={[styles.label, { color: colors.mutedForeground }]}>Changes are recorded in the administrator audit log.</Text></View> : null}</State>;
}

function Billing() {
  const overview = useGetAdminBillingOverview({ range: '30d' });
  const monetization = useGetAdminMonetization();
  const config = useGetAdminBillingConfig();
  const loading = overview.isLoading || monetization.isLoading || config.isLoading;
  const error = overview.isError || monetization.isError || config.isError;
  return <State loading={loading} error={error} retry={() => { overview.refetch(); monetization.refetch(); config.refetch(); }}>{overview.data && monetization.data && config.data ? <View style={styles.section}><View style={styles.stats}><Stat label="Revenue (30d)" value={overview.data.revenue == null ? 'N/A' : `${overview.data.revenue}`} icon="cash-outline" accent="lime" /><Stat label="MRR" value={overview.data.mrr == null ? 'N/A' : `${overview.data.mrr}`} icon="trending-up-outline" /><Stat label="Subscriptions" value={overview.data.activeSubscriptions ?? 'N/A'} icon="people-outline" accent="cyan" /></View><Card><Row label="Provider" value={config.data.connected ? config.data.provider : 'Not connected'} /><Row label="Webhook" value={config.data.webhookConfigured ? 'Configured' : 'Not configured'} /><Row label="Status" value={monetization.data.message} /></Card></View> : null}</State>;
}

function Audit() {
  const q = useListAdminAudit({ page: 1, pageSize: 30 });
  const colors = useColors();
  return <State loading={q.isLoading} error={q.isError} retry={() => q.refetch()}><View style={styles.section}>{q.data?.items.map((entry) => <Card key={entry.id}><Text style={[styles.value, { color: colors.foreground }]}>{entry.action}</Text><Text style={[styles.label, { color: colors.mutedForeground }]}>{entry.targetType} · {entry.targetId ?? '—'} · {new Date(entry.createdAt).toLocaleString()}</Text><Text style={[styles.label, { color: colors.mutedForeground }]}>{entry.result}{entry.reason ? ` · ${entry.reason}` : ''}</Text></Card>)}</View></State>;
}

export default function AdminConsole() {
  const colors = useColors();
  const profile = useGetProfile();
  const [tab, setTab] = useState<Tab>('overview');
  useEffect(() => {
    if (profile.data && profile.data.role !== 'ADMIN') router.replace('/(tabs)');
  }, [profile.data]);
  if (profile.isLoading) return <AppScreen scroll={false}><LoadingState /></AppScreen>;
  if (profile.isError) return <AppScreen scroll={false}><ErrorState onRetry={() => profile.refetch()} /></AppScreen>;
  if (!profile.data || profile.data.role !== 'ADMIN') return <AppScreen scroll={false}><LoadingState /></AppScreen>;
  const content = { overview: <Overview />, users: <Users />, battles: <Battles />, reports: <Reports />, analytics: <Analytics />, settings: <Settings />, billing: <Billing />, audit: <Audit /> }[tab];
  return <AppScreen refreshing={profile.isFetching} onRefresh={() => profile.refetch()}><Header eyebrow="ZYVIO ADMIN" title="Admin console" subtitle={`Signed in as ${profile.data.displayName}`} right={<Pressable accessibilityLabel="Exit admin" onPress={() => router.replace('/(tabs)')}><Ionicons name="log-out-outline" size={24} color={colors.foreground} /></Pressable>} /><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>{tabs.map((item) => <Pressable key={item.key} testID={`admin-tab-${item.key}`} onPress={() => setTab(item.key)} style={[styles.tab, { backgroundColor: tab === item.key ? colors.primary : colors.card, borderColor: colors.border }]}><Ionicons name={item.icon} size={15} color={tab === item.key ? colors.primaryForeground : colors.foreground} /><Text style={{ color: tab === item.key ? colors.primaryForeground : colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 12 }}>{item.label}</Text></Pressable>)}</ScrollView><Text style={[uiStyles.eyebrow, { color: colors.primary }]}>{tab.toUpperCase()}</Text>{content}</AppScreen>;
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  stats: { gap: 10 },
  tabs: { gap: 8, paddingVertical: 2 },
  tab: { minHeight: 40, paddingHorizontal: 12, borderRadius: 13, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  range: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  rangeButton: { paddingHorizontal: 11, paddingVertical: 9, borderRadius: 10 },
  cardTitle: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  row: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#00000018' },
  label: { fontSize: 12, lineHeight: 18, fontFamily: 'Inter_400Regular' },
  value: { fontSize: 15, lineHeight: 20, fontFamily: 'Inter_700Bold' },
  badge: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
});