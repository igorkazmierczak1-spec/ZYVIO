import { useCreateReport, useCreateSocialComment, useGetSocialPost, useListSocialComments } from '@workspace/api-client-react';
import { useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { AppScreen, Avatar, BackButton, Card, ErrorState, LoadingState, PrimaryButton, uiStyles } from '@/components/ui';
import { useColors } from '@/hooks/useColors';

export default function PostScreen() {
  const colors = useColors(); const { id } = useLocalSearchParams<{ id: string }>(); const postId = String(id);
  const post = useGetSocialPost(postId); const comments = useListSocialComments(postId); const create = useCreateSocialComment(); const report = useCreateReport(); const [body, setBody] = useState('');
  const submit = () => { const value = body.trim(); if (!value) return; create.mutate({ postId, data: { body: value } }, { onSuccess: () => { setBody(''); void comments.refetch(); void post.refetch(); } }); };
  if (post.isLoading) return <AppScreen scroll={false}><LoadingState /></AppScreen>;
  if (post.isError || !post.data) return <AppScreen scroll={false}><ErrorState onRetry={() => void post.refetch()} /></AppScreen>;
  const item = post.data;
  return <AppScreen><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><BackButton /><Pressable onPress={() => Alert.prompt('Zgłoś wpis', 'Powód zgłoszenia', (reason) => { if (reason?.trim()) report.mutate({ data: { targetType: 'CONTENT', targetId: postId, reason: reason.trim() } }); })}><Text style={{ color: colors.destructive, padding: 12 }}>Zgłoś</Text></Pressable></View>
    <Card><View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}><Avatar name={item.author.displayName} /><View><Text style={{ color: colors.foreground, fontFamily: 'Inter_700Bold' }}>{item.author.displayName}</Text><Text style={{ color: colors.mutedForeground }}>@{item.author.username}</Text></View></View><Text style={{ color: colors.foreground, fontSize: 16, lineHeight: 24 }}>{item.body}</Text><Text style={{ color: colors.mutedForeground }}>♥ {item.likeCount} · {item.commentCount} komentarzy</Text></Card>
    <Text style={[uiStyles.title, { color: colors.foreground, fontSize: 21 }]}>Komentarze</Text>
    {comments.data?.map((comment) => <Card key={comment.id}><View style={{ flexDirection: 'row', gap: 9 }}><Avatar name={comment.author.displayName} size={34} /><View style={{ flex: 1 }}><Text style={{ color: colors.foreground, fontFamily: 'Inter_700Bold' }}>{comment.author.displayName}</Text><Text style={{ color: colors.foreground }}>{comment.body}</Text></View></View></Card>)}
    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}><TextInput value={body} onChangeText={setBody} placeholder="Dodaj komentarz…" placeholderTextColor={colors.mutedForeground} style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 13, color: colors.foreground }} /><PrimaryButton disabled={!body.trim()} onPress={submit}>Wyślij</PrimaryButton></View>
  </AppScreen>;
}