import { useGetDashboard } from '@workspace/api-client-react';
import { router } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';
import { AppScreen, Avatar, Card, EmptyState, ErrorState, Header, LoadingState, PrimaryButton, Stat, formatTimeLeft, uiStyles } from '@/components/ui';
import { useColors } from '@/hooks/useColors';

export default function HomeScreen() {
  const colors = useColors();
  const dashboard = useGetDashboard({ query: { staleTime: 15_000 } });
  if (dashboard.isLoading) return <AppScreen scroll={false}><LoadingState /></AppScreen>;
  if (dashboard.isError || !dashboard.data) return <AppScreen scroll={false}><ErrorState onRetry={() => void dashboard.refetch()} /></AppScreen>;
  const data = dashboard.data;
  const profile = data.profile;
  return (
    <AppScreen refreshing={dashboard.isFetching} onRefresh={() => void dashboard.refetch()}>
      <Header eyebrow="VYBE / TODAY" title={`Cześć, ${profile.displayName.split(' ')[0]}.`} subtitle="Twój kolejny mocny ruch jest bliżej, niż myślisz." right={<Avatar name={profile.displayName} />} />
      <Card accent={colors.primary}>
        <Text style={[uiStyles.eyebrow, { color: colors.primary }]}>TWÓJ MOMENTUM</Text>
        <Text style={[uiStyles.title, { color: colors.foreground, fontSize: 27 }]}>Utrzymaj streak{'\n'}przy życiu.</Text>
        <Text style={[uiStyles.subtitle, { color: colors.mutedForeground }]}>{profile.streak > 0 ? `${profile.streak} dni z rzędu. ` : 'Zacznij dzisiaj. '}{profile.xpForNextLevel.toLocaleString()} XP do kolejnego poziomu.</Text>
        <PrimaryButton onPress={() => router.push('/battles')} secondary>Znajdź następny Battle</PrimaryButton>
      </Card>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}><Stat label="Poziom" value={profile.level} icon="trending-up" /></View>
        <View style={{ flex: 1 }}><Stat label="XP" value={profile.xp.toLocaleString()} icon="flash-outline" /></View>
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}><Stat label="Win rate" value={`${data.stats.winRate}%`} icon="target-outline" /></View>
        <View style={{ flex: 1 }}><Stat label="Globalnie" value={`#${data.stats.globalRank}`} icon="trophy-outline" /></View>
      </View>
      <Header eyebrow="PICKED FOR YOU" title="Featured Battle" right={<Text onPress={() => router.push('/battles')} style={{ color: colors.primary, fontFamily: 'Inter_700Bold', marginTop: 8 }}>Wszystkie</Text>} />
      {data.featuredBattles.length === 0 ? <EmptyState title="Brak aktywnych Battle" body="Wróć później albo rozpocznij nową rywalizację." /> : data.featuredBattles.slice(0, 3).map((battle) => (
        <Card key={battle.id} accent={battle.coverTone === 'coral' ? colors.destructive : colors.primary}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}><Text style={[uiStyles.eyebrow, { color: colors.primary }]}>{battle.category}</Text><Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{formatTimeLeft(battle.endsAt)}</Text></View>
          <Text style={[uiStyles.emptyTitle, { color: colors.foreground, textAlign: 'left' }]}>{battle.title}</Text>
          <Text style={[uiStyles.subtitle, { color: colors.mutedForeground }]} numberOfLines={2}>{battle.prompt}</Text>
          <Text onPress={() => router.push(`/battles/${battle.id}`)} style={{ color: colors.primary, fontFamily: 'Inter_700Bold' }}>Otwórz Battle →</Text>
        </Card>
      ))}
    </AppScreen>
  );
}