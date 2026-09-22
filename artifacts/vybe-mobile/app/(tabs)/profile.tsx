import { useGetPremiumSubscription, useGetProfile, useUpdateProfile } from '@workspace/api-client-react';
import type { MediaAttachment } from '@workspace/api-client-react';
import { useClerk } from '@clerk/clerk-expo';
import { router } from 'expo-router';
import React from 'react';
import { Pressable } from 'react-native';
import { Text, View } from 'react-native';
import { AppScreen, Avatar, Card, ErrorState, Header, LoadingState, PrimaryButton, Stat, uiStyles } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { MediaPickerUpload } from '@/components/media';

export default function ProfileScreen() {
  const colors = useColors();
  const { signOut } = useClerk();
  const profile = useGetProfile();
  const sub = useGetPremiumSubscription();
  const updateProfile = useUpdateProfile();
  const [avatarAttachment, setAvatarAttachment] = React.useState<MediaAttachment | null>(null);
  const [claimedAvatarId, setClaimedAvatarId] = React.useState<string | null>(null);
  if (profile.isLoading) return <AppScreen scroll={false}><LoadingState /></AppScreen>;
  if (profile.isError || !profile.data) return <AppScreen scroll={false}><ErrorState onRetry={() => void profile.refetch()} /></AppScreen>;
  const data = profile.data;
  const plan = sub.data?.plan ?? 'FREE';
  const link = (label: string, icon: string, onPress: () => void) => <Pressable onPress={onPress} style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.border }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Text style={{ color: colors.primary, fontSize: 17 }}>{icon}</Text><Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>{label}</Text></View><Text style={{ color: colors.mutedForeground, fontSize: 20 }}>›</Text></Pressable>;
  return <AppScreen><Header eyebrow="ZYVIO / PROFILE" title="Twoja legenda." right={<Avatar name={data.displayName} size={54} />} />
     <Card accent={colors.accent}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}><Avatar name={data.displayName} uri={avatarAttachment?.url || data.avatarAttachment?.url || data.avatarUrl} size={62} /><View style={{ flex: 1, gap: 4 }}><Text style={[uiStyles.title, { color: colors.foreground, fontSize: 21 }]}>{data.displayName}</Text><Text style={[uiStyles.subtitle, { color: colors.mutedForeground }]}>@{data.username} · {data.country}</Text>{data.role === 'ADMIN' ? <Text style={{ color: colors.destructive, fontSize: 10, letterSpacing: 1.2, fontFamily: 'Inter_700Bold' }}>ADMIN</Text> : null}</View></View><Text style={[uiStyles.subtitle, { color: colors.foreground }]}>{data.bio || 'Tworzę swój ZYVIO krok po kroku.'}</Text><MediaPickerUpload mode="image" value={avatarAttachment || data.avatarAttachment} claimedAttachmentId={claimedAvatarId} onChange={(attachment) => { setAvatarAttachment(attachment); updateProfile.mutate({ data: { avatarAttachmentId: attachment?.id ?? null } }, { onSuccess: () => { setClaimedAvatarId(attachment?.id ?? null); void profile.refetch(); } }); }} /></Card>
    <View style={{ flexDirection: 'row', gap: 10 }}><View style={{ flex: 1 }}><Stat label="Poziom" value={data.level} icon="trending-up" /></View><View style={{ flex: 1 }}><Stat label="Streak" value={`${data.streak} dni`} icon="flame-outline" /></View></View>
    <View style={{ flexDirection: 'row', gap: 10 }}><View style={{ flex: 1 }}><Stat label="Wygrane" value={data.wins} icon="trophy-outline" /></View><View style={{ flex: 1 }}><Stat label="Ranking" value={`#${data.rank}`} icon="podium-outline" /></View></View>
    <Card><Text style={[uiStyles.eyebrow, { color: colors.primary }]}>PLAN</Text><Text style={[uiStyles.title, { color: colors.foreground, fontSize: 23 }]}>{plan === 'PREMIUM_PRO' ? 'Premium Pro' : plan === 'PREMIUM' ? 'Premium' : 'Free'}</Text><Text style={[uiStyles.subtitle, { color: colors.mutedForeground }]}>Status konta i możliwości ZYVIO.</Text></Card>
     <Card><Text style={[uiStyles.eyebrow, { color: colors.primary }]}>CENTRUM ZYVIO</Text>
       {link('Wiadomości prywatne', '✉', () => router.push('/messages'))}
        {link('Powiadomienia', '◉', () => router.push('/(tabs)/notifications'))}
        {link('ZYVIO AI', '✦', () => router.push('/ai'))}
       {link('Utwórz Battle', '+', () => router.push('/battles/new'))}
        {link('Premium', '★', () => router.push('/(tabs)/premium'))}
       {link('Ustawienia', '⚙', () => router.push('/settings'))}
       {data.role === 'ADMIN' ? link('Panel administratora', '◆', () => router.push('/admin')) : null}
     </Card>
    <PrimaryButton secondary onPress={() => void signOut(() => undefined)}>Wyloguj się</PrimaryButton>
  </AppScreen>;
}