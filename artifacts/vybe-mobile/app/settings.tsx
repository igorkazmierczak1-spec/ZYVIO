import { useClerk } from '@clerk/clerk-expo';
import { router } from 'expo-router';
import React from 'react';
import { Alert, Appearance, Pressable, Text, View } from 'react-native';
import { AppScreen, BackButton, Card, Header } from '@/components/ui';
import { useColors } from '@/hooks/useColors';

export default function SettingsScreen() {
  const colors = useColors();
  const { signOut } = useClerk();
  const scheme = Appearance.getColorScheme();
  const action = (label: string, onPress: () => void, icon: string) => <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}><View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}><Text style={{ fontSize: 18 }}>{icon}</Text><Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>{label}</Text></View><Text style={{ color: colors.mutedForeground, fontSize: 20 }}>›</Text></Pressable>;
  return <AppScreen><Header eyebrow="VYBE / ACCOUNT" title="Ustawienia." subtitle="Dostosuj aplikację i zarządzaj swoim kontem." right={<BackButton />} />
    <Card><Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_700Bold', fontSize: 11 }}>PREFERENCJE</Text>
      {action(`Tryb ${scheme === 'dark' ? 'jasny' : 'ciemny'}`, () => Appearance.setColorScheme(scheme === 'dark' ? 'light' : 'dark'), '◐')}
      {action('Powiadomienia', () => router.push('/(tabs)/notifications'), '🔔')}
      {action('Premium', () => router.push('/(tabs)/premium'), '★')}
    </Card>
    <Card accent={colors.destructive}>{action('Wyloguj się', () => Alert.alert('Wylogować?', 'Sesja zostanie zakończona na tym urządzeniu.', [{ text: 'Anuluj', style: 'cancel' }, { text: 'Wyloguj', style: 'destructive', onPress: () => void signOut() }]), '↪')}</Card>
  </AppScreen>;
}