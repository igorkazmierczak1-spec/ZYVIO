import { getGetSocialFeedQueryKey, useCreateSocialPost, useGetSocialFeed, useLikeSocialPost, useUnlikeSocialPost } from '@workspace/api-client-react';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { AppScreen, Avatar, Card, EmptyState, ErrorState, Header, IconButton, LoadingState, PrimaryButton, uiStyles } from '@/components/ui';
import { useColors } from '@/hooks/useColors';

export default function FeedScreen() {
  const colors = useColors(); const [body, setBody] = useState(''); const [filter, setFilter] = useState<'for-you' | 'following' | 'trending'>('for-you');
  const feed = useGetSocialFeed({ filter }, { query: { queryKey: getGetSocialFeedQueryKey({ filter }) } });
  const create = useCreateSocialPost(); const like = useLikeSocialPost(); const unlike = useUnlikeSocialPost();
  const submit = () => { const value = body.trim(); if (!value || create.isPending) return; create.mutate({ data: { body: value } }, { onSuccess: () => { setBody(''); void feed.refetch(); } }); };
  return <AppScreen refreshing={feed.isFetching} onRefresh={() => void feed.refetch()}>
    <Header eyebrow="ZYVIO / SOCIAL" title="Twój feed." subtitle="Odkrywaj twórców, dziel się energią i buduj swój ZYVIO." right={<IconButton icon="send" label="Wiadomości" onPress={() => router.push('/messages')} />} />
    <Card accent={colors.accent}><TextInput value={body} onChangeText={setBody} multiline maxLength={2000} placeholder="Co dziś tworzysz?" placeholderTextColor={colors.mutedForeground} style={{ minHeight: 70, color: colors.foreground, fontFamily: 'Inter_400Regular', textAlignVertical: 'top' }} /><PrimaryButton disabled={!body.trim() || create.isPending} onPress={submit}>Opublikuj</PrimaryButton></Card>
    <View style={{ flexDirection: 'row', gap: 8 }}>{(['for-you', 'following', 'trending'] as const).map((item) => <Pressable key={item} onPress={() => setFilter(item)} style={{ padding: 10, borderRadius: 12, backgroundColor: filter === item ? colors.secondary : colors.card, borderWidth: 1, borderColor: colors.border }}><Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 12 }}>{item === 'for-you' ? 'Dla Ciebie' : item === 'following' ? 'Obserwowani' : 'Trenduje'}</Text></Pressable>)}</View>
    {feed.isLoading ? <LoadingState /> : feed.isError ? <ErrorState onRetry={() => void feed.refetch()} /> : !feed.data?.items.length ? <EmptyState title="Feed jest jeszcze cichy" body="Opublikuj pierwszy wpis i nadaj rozmowie kierunek." icon="chatbubble-ellipses-outline" /> : feed.data.items.map((post) => <Card key={post.id}>
      <Pressable onPress={() => router.push(`/feed/${post.id}`)}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Avatar name={post.author.displayName} size={42} /><View style={{ flex: 1 }}><Text style={{ color: colors.foreground, fontFamily: 'Inter_700Bold' }}>{post.author.displayName}</Text><Text style={{ color: colors.mutedForeground, fontSize: 12 }}>@{post.author.username} · {post.category}</Text></View></View><Text style={{ color: colors.foreground, fontSize: 15, lineHeight: 22, marginTop: 12 }}>{post.body}</Text></Pressable>
      <View style={{ flexDirection: 'row', gap: 22, marginTop: 12 }}><Pressable onPress={() => (post.liked ? unlike.mutate({ postId: post.id }) : like.mutate({ postId: post.id }))}><Text style={{ color: post.liked ? colors.destructive : colors.mutedForeground }}>♥ {post.likeCount}</Text></Pressable><Pressable onPress={() => router.push(`/feed/${post.id}`)}><Text style={{ color: colors.mutedForeground }}>▱ {post.commentCount}</Text></Pressable></View>
    </Card>)}
  </AppScreen>;
}