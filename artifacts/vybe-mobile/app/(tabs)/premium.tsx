import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { AppScreen, Card, ErrorState, Header, LoadingState, PrimaryButton, uiStyles } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { packageForPeriod, useSubscription } from '@/lib/revenuecat';

type Period = 'MONTHLY' | 'YEARLY';

export default function PremiumScreen() {
  const colors = useColors();
  const [period, setPeriod] = useState<Period>('MONTHLY');
  const [actionError, setActionError] = useState<string | null>(null);
  const {
    setupError,
    offerings,
    plan: currentPlan,
    isLoading,
    isError,
    isPurchasing,
    isRestoring,
    purchase,
    restore,
  } = useSubscription();

  if (isLoading) return <AppScreen scroll={false}><LoadingState /></AppScreen>;
  if (setupError) {
    return <AppScreen scroll={false}>
      <Header eyebrow="ZYVIO / MEMBERSHIP" title="Płatności mobilne." subtitle="Zakupy w aplikacji są dostępne przez Google Play." right={<Text onPress={() => router.back()} style={{ color: colors.primary, fontFamily: 'Inter_700Bold', marginTop: 8 }}>Wróć</Text>} />
      <Card accent={colors.accent}>
        <Text style={[uiStyles.title, { color: colors.foreground, fontSize: 21 }]}>Konfiguracja jest niegotowa</Text>
        <Text style={[uiStyles.subtitle, { color: colors.mutedForeground }]}>{setupError}</Text>
      </Card>
    </AppScreen>;
  }
  if (isError) {
    return <AppScreen scroll={false}><ErrorState onRetry={() => undefined} /></AppScreen>;
  }

  const premiumPackage = packageForPeriod(offerings, 'PREMIUM', period);
  const proPackage = packageForPeriod(offerings, 'PREMIUM_PRO', period);
  const active = currentPlan !== 'FREE';
  const run = async (action: () => Promise<unknown>) => {
    setActionError(null);
    try {
      await action();
    } catch (error: unknown) {
      if (error instanceof Error && /cancel/i.test(error.message)) return;
      setActionError(error instanceof Error ? error.message : 'Nie udało się ukończyć operacji.');
    }
  };

  return <AppScreen>
    <Header eyebrow="ZYVIO / MEMBERSHIP" title="Wybierz swój plan." subtitle="Więcej limitów, więcej możliwości i pełny dostęp do aktywnych funkcji Premium." right={<Text onPress={() => router.back()} style={{ color: colors.primary, fontFamily: 'Inter_700Bold', marginTop: 8 }}>Wróć</Text>} />
    <View style={{ flexDirection: 'row', backgroundColor: colors.muted, borderRadius: 13, padding: 4 }}>
      <Text onPress={() => setPeriod('MONTHLY')} style={[toggleStyle, { flex: 1, backgroundColor: period === 'MONTHLY' ? colors.card : 'transparent', color: period === 'MONTHLY' ? colors.foreground : colors.mutedForeground }]}>Miesięcznie</Text>
      <Text onPress={() => setPeriod('YEARLY')} style={[toggleStyle, { flex: 1, backgroundColor: period === 'YEARLY' ? colors.card : 'transparent', color: period === 'YEARLY' ? colors.foreground : colors.mutedForeground }]}>Rocznie</Text>
    </View>
    {actionError ? <Card accent="coral"><Text style={{ color: colors.destructive, fontFamily: 'Inter_600SemiBold' }}>{actionError}</Text></Card> : null}
    {active ? <Card accent={colors.accent}>
      <Text style={[uiStyles.eyebrow, { color: colors.primary }]}>AKTYWNY PLAN</Text>
      <Text style={[uiStyles.title, { color: colors.foreground, fontSize: 23 }]}>{currentPlan === 'PREMIUM_PRO' ? 'Premium Pro' : 'Premium'} działa.</Text>
      <Text style={[uiStyles.subtitle, { color: colors.mutedForeground }]}>Zarządzaj płatnością bezpośrednio w ustawieniach subskrypcji Google Play.</Text>
      <PrimaryButton secondary onPress={() => void Linking.openURL('https://play.google.com/store/account/subscriptions')}>Zarządzaj w Google Play</PrimaryButton>
    </Card> : null}
    <Card accent={colors.primary}>
      <Text style={[uiStyles.eyebrow, { color: colors.primary }]}>PREMIUM</Text>
      <Text style={[uiStyles.title, { color: colors.foreground, fontSize: 24 }]}>{premiumPackage?.product.title ?? 'Premium'}</Text>
      <Text style={[uiStyles.subtitle, { color: colors.mutedForeground }]}>{premiumPackage?.product.description ?? 'Więcej ZYVIO na co dzień.'}</Text>
      <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>{premiumPackage?.product.priceString ?? 'Niedostępne'}</Text>
      <PrimaryButton onPress={() => premiumPackage && void run(() => purchase(premiumPackage))} disabled={active || isPurchasing || !premiumPackage}>{isPurchasing ? 'Przetwarzanie…' : 'Kup Premium'}</PrimaryButton>
    </Card>
    <Card accent={colors.accent}>
      <Text style={[uiStyles.eyebrow, { color: colors.primary }]}>PREMIUM PRO</Text>
      <Text style={[uiStyles.title, { color: colors.foreground, fontSize: 24 }]}>{proPackage?.product.title ?? 'Premium Pro'}</Text>
      <Text style={[uiStyles.subtitle, { color: colors.mutedForeground }]}>{proPackage?.product.description ?? 'Wyższe limity AI i pełna kontrola uprawnień.'}</Text>
      <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>{proPackage?.product.priceString ?? 'Niedostępne'}</Text>
      <PrimaryButton onPress={() => proPackage && void run(() => purchase(proPackage))} disabled={active || isPurchasing || !proPackage}>{isPurchasing ? 'Przetwarzanie…' : 'Kup Premium Pro'}</PrimaryButton>
    </Card>
    <PrimaryButton secondary onPress={() => void run(restore)}>Przywróć zakupy{isRestoring ? '…' : ''}</PrimaryButton>
  </AppScreen>;
}

const toggleStyle = { textAlign: 'center', paddingVertical: 10, borderRadius: 10, fontFamily: 'Inter_700Bold', fontSize: 12 } as const;