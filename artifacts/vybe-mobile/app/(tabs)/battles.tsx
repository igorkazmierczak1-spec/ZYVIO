import { getListBattlesQueryKey, useListBattles } from '@workspace/api-client-react';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { AppScreen, Card, EmptyState, ErrorState, Header, LoadingState, uiStyles } from '@/components/ui';
import { useColors } from '@/hooks/useColors';

const filters = ['All', 'Photo', 'Music', 'Creativity', 'AI'];
export default function BattlesScreen() {
  const colors = useColors();
  const [category, setCategory] = useState('All');
  const params: { category?: string } = category === 'All' ? {} : { category };
  const battles = useListBattles(params, { query: { staleTime: 15_000, queryKey: getListBattlesQueryKey(params) } });
  const list = battles.data ?? [];
  return (
    <AppScreen refreshing={battles.isFetching} onRefresh={() => void battles.refetch()}>
      <Header eyebrow="VYBE / ARENA" title="Znajdź swój Battle." subtitle="Wejdź w prompt, pokaż swój punkt widzenia i zdobądź XP." />
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {filters.map((item) => <Pressable key={item} onPress={() => setCategory(item)} style={{ paddingHorizontal: 13, paddingVertical: 9, borderRadius: 11, backgroundColor: category === item ? colors.secondary : colors.card, borderWidth: 1, borderColor: category === item ? colors.primary : colors.border }}><Text style={{ color: category === item ? colors.secondaryForeground : colors.mutedForeground, fontFamily: 'Inter_600SemiBold', fontSize: 12 }}>{item}</Text></Pressable>)}
      </View>
      {battles.isLoading ? <LoadingState /> : battles.isError ? <ErrorState onRetry={() => void battles.refetch()} /> : list.length === 0 ? <EmptyState title="Brak Battle w tej kategorii" body="Zacznij kolejną rywalizację i otwórz nowy kierunek." icon="flash-off-outline" /> : list.map((battle) => (
        <Card key={battle.id} accent={battle.status === 'live' ? colors.destructive : colors.primary}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={[uiStyles.eyebrow, { color: colors.primary }]}>{battle.category} · 1V1</Text><Text style={{ color: battle.status === 'live' ? colors.destructive : colors.mutedForeground, fontSize: 12, fontFamily: 'Inter_700Bold' }}>{battle.status === 'live' ? 'LIVE' : battle.status === 'completed' ? 'CLOSED' : formatStatus(battle.endsAt)}</Text></View>
          <Text style={[uiStyles.emptyTitle, { color: colors.foreground, textAlign: 'left' }]}>{battle.title}</Text>
          <Text style={[uiStyles.subtitle, { color: colors.mutedForeground }]} numberOfLines={3}>{battle.prompt}</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{battle.participantCount}/{battle.maxParticipants} uczestników · +{battle.rewardXp ?? 0} XP</Text><Text onPress={() => router.push(`/battles/${battle.id}`)} style={{ color: colors.primary, fontFamily: 'Inter_700Bold' }}>Wejdź →</Text></View>
        </Card>
      ))}
    </AppScreen>
  );
}

function formatStatus(value: string) {
  const diff = Math.max(0, new Date(value).getTime() - Date.now());
  return `${Math.floor(diff / 3_600_000)}h`;
}