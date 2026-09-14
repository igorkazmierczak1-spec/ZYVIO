import { getGetBattleCreationUsageQueryKey, useCreateBattle, useGetBattleCreationUsage } from '@workspace/api-client-react';
import type { MediaAttachment } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { AppScreen, BackButton, Card, Header, PrimaryButton, uiStyles } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { MediaPickerUpload } from '@/components/media';

export default function NewBattleScreen() {
  const colors = useColors();
  const create = useCreateBattle();
  const usage = useGetBattleCreationUsage();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [prompt, setPrompt] = useState('');
  const [hours, setHours] = useState('24');
  const [attachment, setAttachment] = useState<MediaAttachment | null>(null);
  const [error, setError] = useState('');
  const submit = () => {
    const h = Number(hours);
    if (title.trim().length < 3) return setError('Tytuł musi mieć co najmniej 3 znaki.');
    if (category.trim().length < 2) return setError('Podaj kategorię.');
    if (prompt.trim().length < 5) return setError('Prompt musi mieć co najmniej 5 znaków.');
    if (!Number.isInteger(h) || h < 1 || h > 720) return setError('Czas trwania musi być liczbą od 1 do 720 godzin.');
    setError('');
    create.mutate({ data: { title: title.trim(), category: category.trim(), prompt: prompt.trim(), endsAt: new Date(Date.now() + h * 3600000).toISOString(), maxParticipants: 2, attachmentId: attachment?.id ?? null } }, {
      onSuccess: async (battle) => {
        await queryClient.invalidateQueries({ queryKey: getGetBattleCreationUsageQueryKey() });
        router.replace(`/battles/${battle.id}`);
      },
      onError: (requestError: unknown) => setError(isBattleQuotaError(requestError) ? 'Wykorzystałeś dzisiejszy limit Battle.' : 'Nie udało się utworzyć Battle. Spróbuj ponownie.'),
    });
  };
  const usageLabel = usage.data
    ? `Pozostało ${usage.data.remainingToday}/${usage.data.limitToday} Battle`
    : 'Pozostało —/— Battle';
  const inputStyle = { color: colors.foreground, backgroundColor: colors.input, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 13, fontFamily: 'Inter_400Regular' } as const;
  return <AppScreen><Header eyebrow="ZYVIO / NEW BATTLE" title="Otwórz własną arenę." subtitle={`${usageLabel} · Zaproponuj temat i zaproś społeczność do rywalizacji.`} right={<BackButton />} />
    <Card><Text style={[uiStyles.eyebrow, { color: colors.primary }]}>SZCZEGÓŁY</Text>
      <TextInput value={title} onChangeText={setTitle} placeholder="Tytuł Battle" placeholderTextColor={colors.mutedForeground} style={inputStyle} />
      <TextInput value={category} onChangeText={setCategory} placeholder="Kategoria, np. Photo" placeholderTextColor={colors.mutedForeground} style={inputStyle} />
      <TextInput value={prompt} onChangeText={setPrompt} placeholder="Prompt dla uczestników" placeholderTextColor={colors.mutedForeground} multiline style={[inputStyle, { minHeight: 92, textAlignVertical: 'top' }]} />
       <MediaPickerUpload mode="both" value={attachment} onChange={setAttachment} />
       <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}><TextInput value={hours} onChangeText={setHours} placeholder="Godziny" keyboardType="number-pad" placeholderTextColor={colors.mutedForeground} style={[inputStyle, { flex: 1 }]} /><Text style={{ flex: 1, color: colors.mutedForeground, fontFamily: 'Inter_600SemiBold' }}>Format 1v1{'\n'}Zawsze 2 uczestników</Text></View>
      {error ? <Text style={{ color: colors.destructive, fontFamily: 'Inter_600SemiBold' }}>{error}</Text> : null}
      <PrimaryButton onPress={submit} disabled={create.isPending}>{create.isPending ? 'Tworzenie…' : 'Utwórz Battle'}</PrimaryButton>
    </Card>
  </AppScreen>;
}

function isBattleQuotaError(error: unknown) {
  if (!error || typeof error !== 'object' || !('data' in error)) return false;
  const data = (error as { data?: unknown }).data;
  return Boolean(data && typeof data === 'object' && (data as { code?: unknown }).code === 'PLAN_DAILY_LIMIT');
}