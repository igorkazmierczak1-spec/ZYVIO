import { useCreateBattle } from '@workspace/api-client-react';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { AppScreen, BackButton, Card, Header, PrimaryButton, uiStyles } from '@/components/ui';
import { useColors } from '@/hooks/useColors';

export default function NewBattleScreen() {
  const colors = useColors();
  const create = useCreateBattle();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [prompt, setPrompt] = useState('');
  const [hours, setHours] = useState('24');
  const [maxParticipants, setMaxParticipants] = useState('2');
  const [error, setError] = useState('');
  const submit = () => {
    const h = Number(hours);
    const max = Number(maxParticipants);
    if (title.trim().length < 3) return setError('Tytuł musi mieć co najmniej 3 znaki.');
    if (category.trim().length < 2) return setError('Podaj kategorię.');
    if (prompt.trim().length < 5) return setError('Prompt musi mieć co najmniej 5 znaków.');
    if (!Number.isInteger(h) || h < 1 || h > 720) return setError('Czas trwania musi być liczbą od 1 do 720 godzin.');
    if (!Number.isInteger(max) || max < 2 || max > 64) return setError('Liczba uczestników musi wynosić od 2 do 64.');
    setError('');
    create.mutate({ data: { title: title.trim(), category: category.trim(), prompt: prompt.trim(), endsAt: new Date(Date.now() + h * 3600000).toISOString(), maxParticipants: max } }, { onSuccess: (battle) => router.replace(`/battles/${battle.id}`), onError: () => setError('Nie udało się utworzyć Battle. Spróbuj ponownie.') });
  };
  const inputStyle = { color: colors.foreground, backgroundColor: colors.input, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 13, fontFamily: 'Inter_400Regular' } as const;
  return <AppScreen><Header eyebrow="VYBE / NEW BATTLE" title="Otwórz własną arenę." subtitle="Zaproponuj temat i zaproś społeczność do rywalizacji." right={<BackButton />} />
    <Card><Text style={[uiStyles.eyebrow, { color: colors.primary }]}>SZCZEGÓŁY</Text>
      <TextInput value={title} onChangeText={setTitle} placeholder="Tytuł Battle" placeholderTextColor={colors.mutedForeground} style={inputStyle} />
      <TextInput value={category} onChangeText={setCategory} placeholder="Kategoria, np. Photo" placeholderTextColor={colors.mutedForeground} style={inputStyle} />
      <TextInput value={prompt} onChangeText={setPrompt} placeholder="Prompt dla uczestników" placeholderTextColor={colors.mutedForeground} multiline style={[inputStyle, { minHeight: 92, textAlignVertical: 'top' }]} />
      <View style={{ flexDirection: 'row', gap: 10 }}><TextInput value={hours} onChangeText={setHours} placeholder="Godziny" keyboardType="number-pad" placeholderTextColor={colors.mutedForeground} style={[inputStyle, { flex: 1 }]} /><TextInput value={maxParticipants} onChangeText={setMaxParticipants} placeholder="Uczestnicy" keyboardType="number-pad" placeholderTextColor={colors.mutedForeground} style={[inputStyle, { flex: 1 }]} /></View>
      {error ? <Text style={{ color: colors.destructive, fontFamily: 'Inter_600SemiBold' }}>{error}</Text> : null}
      <PrimaryButton onPress={submit} disabled={create.isPending}>{create.isPending ? 'Tworzenie…' : 'Utwórz Battle'}</PrimaryButton>
    </Card>
  </AppScreen>;
}