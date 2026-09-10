import { getGetSocialProfileQueryKey, useBlockSocialProfile, useCreateReport, useFollowSocialProfile, useGetSocialProfile, useUnblockSocialProfile, useUnfollowSocialProfile } from '@workspace/api-client-react';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { AppScreen, Avatar, BackButton, Card, ErrorState, LoadingState, PrimaryButton, Stat, uiStyles } from '@/components/ui';
import { useColors } from '@/hooks/useColors';

export default function SocialProfileScreen() {
  const colors = useColors(); const { id } = useLocalSearchParams<{ id: string }>(); const profileId = String(id); const profile = useGetSocialProfile(profileId, { query: { queryKey: getGetSocialProfileQueryKey(profileId) } }); const [blocked, setBlocked] = useState(false);
  const follow = useFollowSocialProfile(); const unfollow = useUnfollowSocialProfile(); const block = useBlockSocialProfile(); const unblock = useUnblockSocialProfile(); const report = useCreateReport();
  if (profile.isLoading) return <AppScreen scroll={false}><LoadingState /></AppScreen>; if (profile.isError || !profile.data) return <AppScreen scroll={false}><ErrorState onRetry={() => void profile.refetch()} /></AppScreen>;
  const data = profile.data;
  return <AppScreen><BackButton /><Card accent={colors.primary}><View style={{ alignItems: 'center', gap: 8 }}><Avatar name={data.displayName} size={78} /><Text style={[uiStyles.title, { color: colors.foreground, fontSize: 23 }]}>{data.displayName}</Text><Text style={{ color: colors.mutedForeground }}>@{data.username} · {data.country}</Text><Text style={{ color: colors.foreground, textAlign: 'center' }}>{data.bio}</Text></View>
    <View style={{ flexDirection: 'row', gap: 10 }}><View style={{ flex: 1 }}><PrimaryButton onPress={() => { if (data.isFollowing) { unfollow.mutate({ profileId }, { onSuccess: () => void profile.refetch() }); } else { follow.mutate({ profileId }, { onSuccess: () => void profile.refetch() }); } }}>{data.isFollowing ? 'Przestań obserwować' : 'Obserwuj'}</PrimaryButton></View><View style={{ flex: 1 }}><PrimaryButton secondary onPress={() => router.push(`/messages?profileId=${profileId}`)}>Napisz</PrimaryButton></View></View></Card>
    <View style={{ flexDirection: 'row', gap: 10 }}><View style={{ flex: 1 }}><Stat label="Obserwujący" value={data.followerCount} icon="people-outline" /></View><View style={{ flex: 1 }}><Stat label="Wygrane" value={data.wins} icon="trophy-outline" /></View></View>
    <Pressable onPress={() => { const mutation = blocked ? unblock : block; mutation.mutate({ profileId }, { onSuccess: () => { setBlocked(!blocked); void profile.refetch(); } }); }}><Text style={{ color: colors.destructive, textAlign: 'center' }}>{blocked ? 'Odblokuj profil' : 'Zablokuj profil'}</Text></Pressable>
    <Pressable onPress={() => Alert.prompt('Zgłoś profil', 'Powód zgłoszenia', (reason) => { if (reason?.trim()) report.mutate({ data: { targetType: 'USER', targetId: profileId, reason: reason.trim() } }); })}><Text style={{ color: colors.mutedForeground, textAlign: 'center' }}>Zgłoś profil</Text></Pressable>
  </AppScreen>;
}