import { getListSocialConversationsQueryKey, useCreateSocialConversation, useListSocialConversations } from '@workspace/api-client-react';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import { AppScreen, Avatar, BackButton, Card, EmptyState, ErrorState, Header, LoadingState, uiStyles } from '@/components/ui';
import { useColors } from '@/hooks/useColors';

export default function MessagesScreen() {
  const colors = useColors(); const params = useLocalSearchParams<{ profileId?: string }>(); const conversations = useListSocialConversations({ query: { queryKey: getListSocialConversationsQueryKey() } }); const create = useCreateSocialConversation(); const started = useRef(false);
  useEffect(() => { if (params.profileId && !started.current) { started.current = true; create.mutate({ data: { profileId: String(params.profileId) } }, { onSuccess: (conversation) => router.replace(`/messages/${conversation.id}`) }); } }, [params.profileId, create]);
  return <AppScreen refreshing={conversations.isFetching} onRefresh={() => void conversations.refetch()}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><BackButton /><Header eyebrow="ZYVIO / PRIVATE" title="Wiadomości." /></View>
     {conversations.isLoading ? <LoadingState /> : conversations.isError ? <ErrorState onRetry={() => void conversations.refetch()} /> : !conversations.data?.length ? <EmptyState title="Brak rozmów" body="Otwórz profil twórcy, aby rozpocząć prywatną rozmowę." icon="paper-plane-outline" /> : conversations.data.map((conversation) => <Pressable key={conversation.id} onPress={() => router.push(`/messages/${conversation.id}`)}><Card><View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><Avatar name={conversation.otherParticipant.displayName} uri={conversation.otherParticipant.avatarUrl} /><View style={{ flex: 1 }}><Text style={{ color: colors.foreground, fontFamily: 'Inter_700Bold' }}>{conversation.otherParticipant.displayName}</Text><Text style={{ color: colors.mutedForeground }} numberOfLines={1}>{conversation.lastMessage?.body || (conversation.lastMessage?.attachments?.length ? '📎 Załącznik' : 'Nowa rozmowa')}</Text></View><Text style={{ color: colors.primary }}>›</Text></View></Card></Pressable>)}
  </AppScreen>;
}