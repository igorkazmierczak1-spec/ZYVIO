import { useGetPremiumSubscription, useGetProfile } from '@workspace/api-client-react';
import { useClerk } from '@clerk/clerk-expo';
import React from 'react';
import { Text, View } from 'react-native';
import { AppScreen, Avatar, Card, ErrorState, Header, LoadingState, PrimaryButton, Stat, uiStyles } from '@/components/ui';
import { useColors } from '@/hooks/useColors';

export default function ProfileScreen() {
  const colors = useColors();
  const { signOut } = useClerk();
  const profile = useGetProfile();
  const sub = useGetPremiumSubscription();
  if (profile.isLoading) return <AppScreen scroll={false}><LoadingState /></AppScreen>;
  if (profile.isError || !profile.data) return <AppScreen scroll={false}><ErrorState onRetry={() => void profile.refetch()} /></AppScreen>;
  const data = profile.data;
  const plan = sub.data?.plan ?? 'FREE';
  return <AppScreen><Header eyebrow="VYBE / PROFILE" title="Twoja legenda." right={<Avatar name={data.displayName} size={54} />} />
    <Card accent={colors.accent}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}><Avatar name={data.displayName} size={62} /><View style={{ flex: 1 }}><Text style={[uiStyles.title, { color: colors.foreground, fontSize: 21 }]}>{data.displayName}</Text><Text style={[uiStyles.subtitle, { color: colors.mutedForeground }]}>@{data.username} · {data.country}</Text></View></View><Text style={[uiStyles.subtitle, { color: colors.foreground }]}>{data.bio || 'Tworzę swój VYBE krok po kroku.'}</Text></Card>
    <View style={{ flexDirection: 'row', gap: 10 }}><View style={{ flex: 1 }}><Stat label="Poziom" value={data.level} icon="trending-up" /></View><View style={{ flex: 1 }}><Stat label="Streak" value={`${data.streak} dni`} icon="flame-outline" /></View></View>
    <View style={{ flexDirection: 'row', gap: 10 }}><View style={{ flex: 1 }}><Stat label="Wygrane" value={data.wins} icon="trophy-outline" /></View><View style={{ flex: 1 }}><Stat label="Ranking" value={`#${data.rank}`} icon="podium-outline" /></View></View>
    <Card><Text style={[uiStyles.eyebrow, { color: colors.primary }]}>PLAN</Text><Text style={[uiStyles.title, { color: colors.foreground, fontSize: 23 }]}>{plan === 'PREMIUM_PRO' ? 'Premium Pro' : plan === 'PREMIUM' ? 'Premium' : 'Free'}</Text><Text style={[uiStyles.subtitle, { color: colors.mutedForeground }]}>Status konta i możliwości VYBE.</Text></Card>
    <PrimaryButton secondary onPress={() => void signOut(() => undefined)}>Wyloguj się</PrimaryButton>
  </AppScreen>;
}