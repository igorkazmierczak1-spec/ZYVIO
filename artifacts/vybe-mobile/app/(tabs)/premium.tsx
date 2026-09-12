import { useCreatePremiumCheckout, useCreatePremiumPortal, useGetPremiumSubscription, useListPremiumPlans } from '@workspace/api-client-react';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { AppScreen, Card, ErrorState, Header, LoadingState, PrimaryButton, uiStyles } from '@/components/ui';
import { useColors } from '@/hooks/useColors';

type Plan = 'PREMIUM' | 'PREMIUM_PRO';
type Period = 'MONTHLY' | 'YEARLY';

export default function PremiumScreen() {
  const colors = useColors();
  const [period, setPeriod] = useState<Period>('MONTHLY');
  const plans = useListPremiumPlans();
  const subscription = useGetPremiumSubscription();
  const checkout = useCreatePremiumCheckout();
  const portal = useCreatePremiumPortal();
  if (plans.isLoading || subscription.isLoading) return <AppScreen scroll={false}><LoadingState /></AppScreen>;
  if (plans.isError || subscription.isError) return <AppScreen scroll={false}><ErrorState onRetry={() => { void plans.refetch(); void subscription.refetch(); }} /></AppScreen>;
  const currentPlan = subscription.data?.plan ?? 'FREE';
  const active = Boolean(subscription.data?.subscription && ['active', 'trialing', 'past_due'].includes(String((subscription.data.subscription as Record<string, unknown>).status)));
  const open = async (url: string | null) => { if (url) await WebBrowser.openBrowserAsync(url); };
  const buy = (plan: Plan) => checkout.mutate({ data: { plan, billingPeriod: period } }, { onSuccess: (result) => void open(result.url) });
  const price = (plan: Plan) => plans.data?.plans.find((item) => item.plan === plan && ((item.recurring?.interval === 'year') === (period === 'YEARLY')));
  return <AppScreen><Header eyebrow="ZYVIO / MEMBERSHIP" title="Wybierz swój plan." subtitle="Więcej limitów, więcej możliwości i pełny dostęp do aktywnych funkcji Premium." right={<Text onPress={() => router.back()} style={{ color: colors.primary, fontFamily: 'Inter_700Bold', marginTop: 8 }}>Wróć</Text>} />
    <View style={{ flexDirection: 'row', backgroundColor: colors.muted, borderRadius: 13, padding: 4 }}><Text onPress={() => setPeriod('MONTHLY')} style={[toggleStyle, { flex: 1, backgroundColor: period === 'MONTHLY' ? colors.card : 'transparent', color: period === 'MONTHLY' ? colors.foreground : colors.mutedForeground }]}>Miesięcznie</Text><Text onPress={() => setPeriod('YEARLY')} style={[toggleStyle, { flex: 1, backgroundColor: period === 'YEARLY' ? colors.card : 'transparent', color: period === 'YEARLY' ? colors.foreground : colors.mutedForeground }]}>Rocznie</Text></View>
    {active ? <Card accent={colors.accent}><Text style={[uiStyles.eyebrow, { color: colors.primary }]}>AKTYWNY PLAN</Text><Text style={[uiStyles.title, { color: colors.foreground, fontSize: 23 }]}>{currentPlan === 'PREMIUM_PRO' ? 'Premium Pro' : 'Premium'} działa.</Text><Text style={[uiStyles.subtitle, { color: colors.mutedForeground }]}>Zarządzaj płatnością i zmianą planu w Stripe.</Text><PrimaryButton secondary onPress={() => portal.mutate(undefined, { onSuccess: (result) => void open(result.url) })}>{portal.isPending ? 'Otwieranie…' : 'Zarządzaj subskrypcją'}</PrimaryButton></Card> : null}
     <Card accent={colors.primary}><Text style={[uiStyles.eyebrow, { color: colors.primary }]}>PREMIUM</Text><Text style={[uiStyles.title, { color: colors.foreground, fontSize: 24 }]}>Więcej ZYVIO na co dzień.</Text><Text style={[uiStyles.subtitle, { color: colors.mutedForeground }]}>Status Premium na profilu, aktywne funkcje płatne i obsługa przez Stripe.</Text><Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>{formatPrice(price('PREMIUM'))} / {period === 'YEARLY' ? 'rok' : 'miesiąc'}</Text><PrimaryButton onPress={() => buy('PREMIUM')} disabled={active || checkout.isPending || !price('PREMIUM')}>{checkout.isPending ? 'Otwieranie…' : 'Kup Premium'}</PrimaryButton></Card>
    <Card accent={colors.accent}><Text style={[uiStyles.eyebrow, { color: colors.primary }]}>PREMIUM PRO</Text><Text style={[uiStyles.title, { color: colors.foreground, fontSize: 24 }]}>Dla najbardziej aktywnych.</Text><Text style={[uiStyles.subtitle, { color: colors.mutedForeground }]}>Wyższe limity AI, wyróżnienie Pro i pełna kontrola uprawnień po stronie backendu.</Text><Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>{formatPrice(price('PREMIUM_PRO'))} / {period === 'YEARLY' ? 'rok' : 'miesiąc'}</Text><PrimaryButton onPress={() => buy('PREMIUM_PRO')} disabled={active || checkout.isPending || !price('PREMIUM_PRO')}>{checkout.isPending ? 'Otwieranie…' : 'Kup Premium Pro'}</PrimaryButton></Card>
  </AppScreen>;
}

function formatPrice(price: { unit_amount: number | null; currency: string } | undefined) {
  if (!price || price.unit_amount == null) return 'Niedostępne';
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: price.currency.toUpperCase() }).format(price.unit_amount / 100);
}

const toggleStyle = { textAlign: 'center', paddingVertical: 10, borderRadius: 10, fontFamily: 'Inter_700Bold', fontSize: 12 } as const;