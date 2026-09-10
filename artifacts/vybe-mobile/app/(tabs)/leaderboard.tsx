import { getGetLeaderboardQueryKey, useGetLeaderboard } from '@workspace/api-client-react';
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { AppScreen, Avatar, Card, EmptyState, ErrorState, Header, LoadingState, uiStyles } from '@/components/ui';
import { useColors } from '@/hooks/useColors';

type Scope = 'global' | 'country';
type Period = 'weekly' | 'monthly' | 'all-time';

export default function LeaderboardScreen() {
  const colors = useColors();
  const [scope, setScope] = useState<Scope>('global');
  const [period, setPeriod] = useState<Period>('weekly');
  const leaderboard = useGetLeaderboard({ scope, period }, { query: { queryKey: getGetLeaderboardQueryKey({ scope, period }) } });
  const entries = leaderboard.data?.entries ?? [];
  return (
    <AppScreen refreshing={leaderboard.isFetching} onRefresh={() => void leaderboard.refetch()}>
      <Header eyebrow="VYBE / RANKING" title="Najlepsi na arenie." subtitle="Punkty rankingowe za aktywność, wygrane i konsekwencję." />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['global', 'country'] as Scope[]).map((item) => <Pressable key={item} onPress={() => setScope(item)} style={{ flex: 1, padding: 11, borderRadius: 12, borderWidth: 1, borderColor: scope === item ? colors.primary : colors.border, backgroundColor: scope === item ? colors.secondary : colors.card }}><Text style={{ textAlign: 'center', color: scope === item ? colors.secondaryForeground : colors.mutedForeground, fontFamily: 'Inter_700Bold', fontSize: 12 }}>{item === 'global' ? 'Globalny' : 'Mój kraj'}</Text></Pressable>)}
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['weekly', 'monthly', 'all-time'] as Period[]).map((item) => <Pressable key={item} onPress={() => setPeriod(item)} style={{ flex: 1, paddingVertical: 9 }}><Text style={{ textAlign: 'center', color: period === item ? colors.primary : colors.mutedForeground, fontFamily: 'Inter_600SemiBold', fontSize: 12 }}>{item === 'weekly' ? 'Tydzień' : item === 'monthly' ? 'Miesiąc' : 'All-time'}</Text></Pressable>)}
      </View>
      {leaderboard.isLoading ? <LoadingState /> : leaderboard.isError ? <ErrorState onRetry={() => void leaderboard.refetch()} /> : entries.length === 0 ? <EmptyState title="Ranking jest jeszcze pusty" body="Weź udział w Battle, żeby pojawić się w tabeli." icon="podium-outline" /> : entries.map((entry) => (
        <Card key={entry.user.id} accent={entry.position <= 3 ? colors.accent : undefined}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Text style={{ width: 26, color: entry.position <= 3 ? colors.primary : colors.mutedForeground, fontFamily: 'Inter_700Bold', fontSize: 16 }}>#{entry.position}</Text>
            <Avatar name={entry.user.displayName} size={42} />
            <View style={{ flex: 1 }}><Text style={[uiStyles.emptyTitle, { color: colors.foreground, textAlign: 'left', fontSize: 16 }]}>{entry.user.displayName}</Text><Text style={[uiStyles.subtitle, { color: colors.mutedForeground }]}>Poziom {entry.user.level} · {entry.league}</Text></View>
            <View><Text style={{ color: colors.foreground, fontFamily: 'Inter_700Bold', textAlign: 'right' }}>{entry.rankingPoints}</Text><Text style={{ color: colors.mutedForeground, fontSize: 11 }}>punktów</Text></View>
          </View>
        </Card>
      ))}
      {leaderboard.data?.currentUser ? <Card accent={colors.primary}><Text style={[uiStyles.eyebrow, { color: colors.primary }]}>TWÓJ WYNIK</Text><Text style={{ color: colors.foreground, fontFamily: 'Inter_700Bold' }}>#{leaderboard.data.currentUser.position} · {leaderboard.data.currentUser.xp} XP</Text></Card> : null}
    </AppScreen>
  );
}