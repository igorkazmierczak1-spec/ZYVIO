import { getGetDashboardQueryKey, useGetDashboard } from '@workspace/api-client-react';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { AppScreen, Avatar, Card, EmptyState, ErrorState, Header, LoadingState, Stat, formatTimeLeft, uiStyles } from '@/components/ui';
import { useColors } from '@/hooks/useColors';

function HeroButton({ onPress, children }: React.PropsWithChildren<{ onPress: () => void }>) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 44,
        alignSelf: 'flex-start',
        paddingHorizontal: 15,
        borderRadius: 12,
        backgroundColor: colors.card,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Text style={{ color: colors.foreground, fontSize: 12, fontFamily: 'Inter_700Bold' }}>{children}</Text>
      <Ionicons name="arrow-up-right" size={16} color={colors.foreground} />
    </Pressable>
  );
}

function MomentumHero({ streak, xpForNextLevel, level, league, xp, progress, onPress }: {
  streak: number;
  xpForNextLevel: number;
  level: number;
  league: string;
  xp: number;
  progress: number;
  onPress: () => void;
}) {
  const colors = useColors();
  const safeProgress = Math.max(0, Math.min(100, progress));
  return (
    <LinearGradient
      colors={[colors.heroStart, colors.heroMid, colors.heroEnd]}
      start={{ x: 0, y: 0.1 }}
      end={{ x: 1, y: 1 }}
      style={{ minHeight: 318, overflow: 'hidden', borderRadius: 24, padding: 22, position: 'relative' }}
    >
      <View pointerEvents="none" style={{ position: 'absolute', width: 300, height: 300, borderRadius: 150, borderWidth: 1, borderColor: `${colors.accent}52`, right: -130, top: -130 }} />
      <View pointerEvents="none" style={{ position: 'absolute', width: 215, height: 215, borderRadius: 108, borderWidth: 1, borderColor: `${colors.cyan}47`, right: -35, top: -62 }} />
      <View pointerEvents="none" style={{ position: 'absolute', width: 128, height: 128, borderRadius: 64, borderWidth: 1, borderColor: `${colors.destructive}55`, right: 72, top: 8 }} />
      <View style={{ zIndex: 2, gap: 11 }}>
        <Text style={[uiStyles.eyebrow, { color: `${colors.heroMuted}dd` }]}>TWÓJ MOMENTUM</Text>
        <Text style={{ color: colors.card, fontSize: 36, lineHeight: 36, letterSpacing: -1.8, fontFamily: 'Inter_700Bold' }}>
          Utrzymaj streak{'\n'}<Text style={{ color: colors.accent }}>przy życiu.</Text>
        </Text>
        <Text style={{ color: colors.heroMuted, fontSize: 13, lineHeight: 19, maxWidth: 230 }}>
          {streak > 0 ? `${streak} dni z rzędu. ` : 'Zacznij dzisiaj. '}{xpForNextLevel.toLocaleString()} XP do kolejnego poziomu.
        </Text>
        <HeroButton onPress={onPress}>Znajdź następny Battle</HeroButton>
      </View>
      <View style={{ position: 'absolute', zIndex: 3, left: 18, right: 18, bottom: 18, minHeight: 82, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: '#ffffff25', backgroundColor: '#191429aa', flexDirection: 'row', alignItems: 'center', gap: 13 }}>
        <View style={{ width: 58, height: 58, borderRadius: 29, borderWidth: 4, borderColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: colors.card, fontSize: 20, lineHeight: 21, fontFamily: 'Inter_700Bold' }}>{level}</Text>
          <Text style={{ color: colors.heroMuted, fontSize: 8, fontFamily: 'Inter_500Medium' }}>LEVEL</Text>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[uiStyles.eyebrow, { color: colors.accent, fontSize: 9 }]}>{league} LEAGUE</Text>
          <Text style={{ color: colors.card, fontSize: 14, fontFamily: 'Inter_700Bold' }}>{xp.toLocaleString()} XP</Text>
          <View style={{ height: 5, overflow: 'hidden', borderRadius: 5, backgroundColor: '#ffffff25' }}>
            <View style={{ width: `${safeProgress}%`, height: '100%', borderRadius: 5, backgroundColor: colors.accent }} />
          </View>
        </View>
      </View>
    </LinearGradient>
  );
}

function FeaturedBattleCard({ battle }: { battle: { id: string; category: string; title: string; prompt: string; endsAt: string; rewardXp?: number; coverTone?: string } }) {
  const colors = useColors();
  const tone = battle.coverTone === 'coral'
    ? [colors.destructive, colors.heroStart]
    : battle.coverTone === 'cyan'
      ? [colors.cyan, colors.heroStart]
      : [colors.heroEnd, colors.heroStart];
  const lightTone = battle.coverTone === 'cyan';
  return (
    <Pressable onPress={() => router.push(`/battles/${battle.id}`)} style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}>
      <LinearGradient colors={tone as [string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ minHeight: 190, overflow: 'hidden', borderRadius: 19, padding: 18 }}>
        <View style={{ position: 'absolute', width: 150, height: 150, borderRadius: 75, backgroundColor: '#ffffff18', right: -35, top: -54 }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <Text style={{ color: lightTone ? colors.heroStart : colors.card, fontSize: 10, letterSpacing: 1.2, fontFamily: 'Inter_700Bold' }}>{battle.category.toUpperCase()}</Text>
          <Text style={{ color: lightTone ? `${colors.heroStart}bb` : `${colors.card}bb`, fontSize: 11, fontFamily: 'Inter_600SemiBold' }}>{formatTimeLeft(battle.endsAt)}</Text>
        </View>
        <View style={{ flex: 1, justifyContent: 'flex-end', gap: 7 }}>
          <Text style={{ color: lightTone ? colors.heroStart : colors.card, fontSize: 21, lineHeight: 24, letterSpacing: -0.6, fontFamily: 'Inter_700Bold' }}>{battle.title}</Text>
          <Text numberOfLines={2} style={{ color: lightTone ? `${colors.heroStart}b8` : `${colors.card}b8`, fontSize: 12, lineHeight: 17 }}>{battle.prompt}</Text>
        </View>
        <View style={{ borderTopWidth: 1, borderTopColor: '#ffffff28', marginTop: 15, paddingTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: lightTone ? colors.heroStart : colors.accent, fontSize: 11, fontFamily: 'Inter_700Bold' }}>+{battle.rewardXp ?? 250} XP</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Text style={{ color: lightTone ? colors.heroStart : colors.card, fontSize: 11, fontFamily: 'Inter_700Bold' }}>Otwórz Battle</Text>
            <Ionicons name="arrow-up-right" size={15} color={lightTone ? colors.heroStart : colors.card} />
          </View>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

export default function HomeScreen() {
  const colors = useColors();
  const dashboard = useGetDashboard({ query: { staleTime: 15_000, queryKey: getGetDashboardQueryKey() } });
  if (dashboard.isLoading) return <AppScreen scroll={false}><LoadingState /></AppScreen>;
  if (dashboard.isError || !dashboard.data) return <AppScreen scroll={false}><ErrorState onRetry={() => void dashboard.refetch()} /></AppScreen>;

  const data = dashboard.data;
  const profile = data.profile;
  return (
    <AppScreen refreshing={dashboard.isFetching} onRefresh={() => void dashboard.refetch()}>
      <Header
        eyebrow="VYBE / TODAY"
        title={`Cześć, ${profile.displayName.split(' ')[0]}.`}
        subtitle="Twój kolejny mocny ruch jest bliżej, niż myślisz."
        right={<Avatar name={profile.displayName} size={48} />}
      />
      <MomentumHero
        streak={profile.streak}
        xpForNextLevel={profile.xpForNextLevel}
        level={profile.level}
        league={profile.league}
        xp={profile.xp}
        progress={profile.progress}
        onPress={() => router.push('/battles')}
      />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}><Stat label="Aktywne Battle" value={data.stats.activeBattles} icon="flash-outline" accent="violet" /></View>
        <View style={{ flex: 1 }}><Stat label="Tygodniowe XP" value={data.stats.weeklyXp.toLocaleString()} icon="zap-outline" accent="lime" /></View>
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}><Stat label="Win rate" value={`${data.stats.winRate}%`} icon="radio-button-on-outline" accent="coral" /></View>
        <View style={{ flex: 1 }}><Stat label="Globalnie" value={`#${data.stats.globalRank}`} icon="trophy-outline" accent="cyan" /></View>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 3 }}>
        <View style={{ gap: 5 }}>
          <Text style={[uiStyles.eyebrow, { color: colors.mutedForeground }]}>PICKED FOR YOU</Text>
          <Text style={[uiStyles.title, { color: colors.foreground, fontSize: 23 }]}>Featured Battle</Text>
        </View>
        <Pressable onPress={() => router.push('/battles')} accessibilityRole="button">
          <Text style={{ color: colors.secondaryForeground, fontSize: 11, fontFamily: 'Inter_700Bold' }}>Wszystkie →</Text>
        </Pressable>
      </View>
      {data.featuredBattles.length === 0
        ? <Card><EmptyState title="Brak aktywnych Battle" body="Wróć później albo rozpocznij nową rywalizację." /></Card>
        : data.featuredBattles.slice(0, 3).map((battle) => <FeaturedBattleCard key={battle.id} battle={battle} />)}
    </AppScreen>
  );
}