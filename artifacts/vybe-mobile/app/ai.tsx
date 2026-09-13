import { useGenerateIdeas, useGetAiUsage } from '@workspace/api-client-react';
import React, { useState } from 'react';
import { Text, TextInput } from 'react-native';
import { AppScreen, Card, EmptyState, Header, PrimaryButton, uiStyles } from '@/components/ui';
import { useColors } from '@/hooks/useColors';

export default function AiScreen() {
  const colors = useColors();
  const generate = useGenerateIdeas();
  const usage = useGetAiUsage();
  const [topic, setTopic] = useState('');
  const [category, setCategory] = useState('');
  const inputStyle = { color: colors.foreground, backgroundColor: colors.input, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 13, fontFamily: 'Inter_400Regular' } as const;
  const submit = () => { if (topic.trim().length >= 2) generate.mutate({ data: { topic: topic.trim(), category: category.trim() || undefined } }); };
  return <AppScreen><Header eyebrow="ZYVIO / AI LAB" title="Znajdź swój pomysł." subtitle="Opisz kierunek, a AI zaproponuje kreatywne prompty do Battle." />
    <Card accent={colors.primary}><Text style={[uiStyles.eyebrow, { color: colors.primary }]}>PLAN {usage.data?.plan ?? 'FREE'}</Text><Text style={[uiStyles.subtitle, { color: colors.mutedForeground }]}>Dzisiaj: {usage.data?.usedToday ?? 0} / {usage.data?.limitToday ?? '—'} użyć AI</Text><TextInput value={topic} onChangeText={setTopic} placeholder="O czym ma być Battle?" placeholderTextColor={colors.mutedForeground} style={inputStyle} /><TextInput value={category} onChangeText={setCategory} placeholder="Kategoria (opcjonalnie)" placeholderTextColor={colors.mutedForeground} style={inputStyle} /><PrimaryButton onPress={submit} disabled={generate.isPending || topic.trim().length < 2}>{generate.isPending ? 'Szukam pomysłów…' : 'Generuj pomysły'}</PrimaryButton>{topic.trim().length > 0 && topic.trim().length < 2 ? <Text style={{ color: colors.destructive }}>Wpisz co najmniej 2 znaki.</Text> : null}{generate.isError ? <Text style={{ color: colors.destructive }}>Nie udało się wygenerować pomysłów. Spróbuj ponownie.</Text> : null}</Card>
    {usage.data?.items?.length ? <Card><Text style={[uiStyles.eyebrow, { color: colors.primary }]}>HISTORIA AI</Text>{usage.data.items.slice(0, 8).map((item) => <Text key={item.id} style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 6 }}>{new Date(item.createdAt).toLocaleDateString('pl-PL')} · {item.feature} · {item.status === 'success' ? 'ukończone' : item.status === 'provider_error' ? 'błąd dostawcy' : 'w toku'}</Text>)}</Card> : null}
    {generate.data?.ideas?.length ? generate.data.ideas.map((idea, index) => <Card key={`${idea}-${index}`}><Text style={[uiStyles.eyebrow, { color: colors.primary }]}>POMYSŁ {index + 1}</Text><Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', lineHeight: 22 }}>{idea}</Text></Card>) : !generate.isPending && !generate.isError ? <EmptyState title="Twoja następna arena zaczyna się tutaj" body="Wpisz temat, aby otrzymać propozycje." icon="sparkles-outline" /> : null}
  </AppScreen>;
}