import { getGetBattleQueryKey, useGetBattle, useJoinBattle, useVoteBattle } from '@workspace/api-client-react';
import { useLocalSearchParams, router } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';
import { AppScreen, Avatar, Card, EmptyState, ErrorState, Header, LoadingState, PrimaryButton, uiStyles } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { MediaAttachmentView } from '@/components/media';

export default function BattleDetailScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const battle = useGetBattle(id ?? '', { query: { enabled: Boolean(id), queryKey: getGetBattleQueryKey(id ?? '') } });
  const join = useJoinBattle();
  const vote = useVoteBattle();
  if (battle.isLoading) return <AppScreen scroll={false}><LoadingState /></AppScreen>;
  if (battle.isError || !battle.data) return <AppScreen scroll={false}><ErrorState onRetry={() => void battle.refetch()} /></AppScreen>;
  const data = battle.data;
  const canJoin = !data.isJoined && data.status !== 'completed' && data.participantCount < data.maxParticipants;
  return <AppScreen><Header eyebrow={`${data.category} · 1V1`} title={data.title} subtitle={data.prompt} right={<Text onPress={() => router.back()} style={{ color: colors.primary, fontFamily: 'Inter_700Bold', marginTop: 8 }}>Zamknij</Text>} />
     <Card accent={colors.primary}><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={[uiStyles.eyebrow, { color: colors.primary }]}>{data.status === 'live' ? 'LIVE NOW' : data.status.toUpperCase()}</Text><Text style={{ color: colors.mutedForeground }}>{data.participantCount}/{data.maxParticipants} · +{data.rewardXp ?? 0} XP</Text></View><Text style={[uiStyles.title, { color: colors.foreground, fontSize: 24 }]}>Dwa punkty widzenia. Jeden wynik.</Text>{data.attachments?.map((media) => <MediaAttachmentView key={media.id} attachment={media} />)}{canJoin ? <PrimaryButton onPress={() => join.mutate({ battleId: data.id })} disabled={join.isPending}>{join.isPending ? 'Dołączanie…' : 'Dołącz do Battle'}</PrimaryButton> : null}</Card>
     {data.participants.length === 0 ? <EmptyState title="Arena czeka na pierwszego twórcę" body="Dołącz, żeby zająć pierwszy slot." /> : data.participants.map((participant) => <Card key={participant.id}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><Avatar name={participant.user.displayName} uri={participant.user.avatarUrl} size={44} /><View style={{ flex: 1 }}><Text style={[uiStyles.emptyTitle, { color: colors.foreground, textAlign: 'left' }]}>{participant.user.displayName}</Text><Text style={[uiStyles.subtitle, { color: colors.mutedForeground }]}>{participant.submissionLabel}</Text></View><Text style={{ color: colors.foreground, fontFamily: 'Inter_700Bold' }}>{participant.score}</Text></View><PrimaryButton secondary disabled={vote.isPending || data.status === 'completed'} onPress={() => vote.mutate({ battleId: data.id, data: { participantId: participant.id } })}>{vote.isPending ? 'Głosowanie…' : 'Głosuj na tę pracę'}</PrimaryButton></Card>)}
  </AppScreen>;
}