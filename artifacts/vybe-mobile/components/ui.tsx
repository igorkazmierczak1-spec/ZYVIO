import { Feather, Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useAuth } from '@clerk/clerk-expo';
import { router } from 'expo-router';
import React, { PropsWithChildren } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { toAbsoluteMediaUrl } from '@/components/media';

export function BrandMark({ size = 44 }: { size?: number }) {
  const colors = useColors();
  return (
    <View style={[styles.brandMark, { width: size, height: size, borderRadius: size * 0.32, backgroundColor: colors.foreground }]}>
      <View style={[styles.brandCore, { width: size * 0.38, height: size * 0.38, borderRadius: size * 0.14, backgroundColor: colors.accent }]} />
    </View>
  );
}

export function AppScreen({
  children,
  refreshing = false,
  onRefresh,
  scroll = true,
}: PropsWithChildren<{ refreshing?: boolean; onRefresh?: () => void; scroll?: boolean }>) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const content = (
    <View style={[styles.screenContent, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 92 }]}>
      {children}
    </View>
  );
  if (!scroll) return <View style={[styles.screen, { backgroundColor: colors.background }]}>{content}</View>;
  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.scrollContent}
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined}
      showsVerticalScrollIndicator={false}
    >
      {content}
    </ScrollView>
  );
}

export function Header({ eyebrow, title, subtitle, right }: { eyebrow?: string; title: string; subtitle?: string; right?: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        {eyebrow ? <Text style={[styles.eyebrow, { color: colors.primary }]}>{eyebrow.toUpperCase()}</Text> : null}
        <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function IconButton({ icon, onPress, label }: { icon: keyof typeof Feather.glyphMap; onPress: () => void; label: string }) {
  const colors = useColors();
  return (
    <Pressable accessibilityLabel={label} testID={`icon-${label}`} onPress={onPress} style={({ pressed }) => [styles.iconButton, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}>
      <Feather name={icon} size={20} color={colors.foreground} />
    </Pressable>
  );
}

export function PrimaryButton({ children, onPress, disabled = false, secondary = false }: PropsWithChildren<{ onPress: () => void; disabled?: boolean; secondary?: boolean }>) {
  const colors = useColors();
  return (
    <Pressable testID="primary-action" accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [
      styles.button,
      { backgroundColor: secondary ? colors.secondary : colors.primary, opacity: disabled ? 0.5 : pressed ? 0.82 : 1 },
    ]}>
      <Text style={[styles.buttonText, { color: secondary ? colors.secondaryForeground : colors.primaryForeground }]}>{children}</Text>
    </Pressable>
  );
}

export function Card({ children, accent }: PropsWithChildren<{ accent?: string }>) {
  const colors = useColors();
  return <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, accent ? { borderLeftColor: accent, borderLeftWidth: 4 } : null]}>{children}</View>;
}

export function Stat({ label, value, icon, accent = 'violet' }: { label: string; value: string | number; icon: keyof typeof Ionicons.glyphMap; accent?: 'violet' | 'lime' | 'coral' | 'cyan' }) {
  const colors = useColors();
  const accentColor = accent === 'lime' ? colors.accent : accent === 'coral' ? colors.destructive : accent === 'cyan' ? colors.cyan : colors.primary;
  const iconBackground = accent === 'lime' ? `${colors.accent}35` : accent === 'coral' ? `${colors.destructive}20` : accent === 'cyan' ? `${colors.cyan}35` : `${colors.primary}18`;
  return (
    <Card>
      <View style={[styles.statIcon, { backgroundColor: iconBackground }]}><Ionicons name={icon} size={17} color={accentColor} /></View>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.statValue, { color: colors.foreground }]}>{value}</Text>
    </Card>
  );
}

export function LoadingState() {
  const colors = useColors();
  return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
}

export function ErrorState({ onRetry }: { onRetry: () => void }) {
  const colors = useColors();
  return <View style={styles.center}><Ionicons name="cloud-offline-outline" size={38} color={colors.primary} /><Text style={[styles.emptyTitle, { color: colors.foreground }]}>Nie udało się załadować</Text><Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Sprawdź połączenie i spróbuj ponownie.</Text><PrimaryButton onPress={onRetry} secondary>Spróbuj ponownie</PrimaryButton></View>;
}

export function EmptyState({ title, body, icon = 'compass-outline' }: { title: string; body: string; icon?: keyof typeof Ionicons.glyphMap }) {
  const colors = useColors();
  return <View style={styles.empty}><Ionicons name={icon} size={34} color={colors.primary} /><Text style={[styles.emptyTitle, { color: colors.foreground }]}>{title}</Text><Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{body}</Text></View>;
}

export function formatTimeLeft(value: string) {
  const diff = Math.max(0, new Date(value).getTime() - Date.now());
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(hours / 24);
  return days > 0 ? `${days} d` : `${hours} h`;
}

export function Avatar({ name, size = 46, uri }: { name: string; size?: number; uri?: string | null }) {
  const colors = useColors();
  const { getToken } = useAuth();
  const [token, setToken] = React.useState<string | null>(null);
  const initials = name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  React.useEffect(() => {
    let active = true;
    if (uri) void getToken().then((next) => { if (active) setToken(next); });
    return () => { active = false; };
  }, [getToken, uri]);
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 3, backgroundColor: colors.secondary, overflow: 'hidden' }]}>
      {uri ? <Image source={{ uri: toAbsoluteMediaUrl(uri), headers: token ? { Authorization: `Bearer ${token}` } : undefined }} contentFit="cover" style={{ width: size, height: size }} /> : <Text style={[styles.avatarText, { color: colors.secondaryForeground, fontSize: size * 0.3 }]}>{initials}</Text>}
    </View>
  );
}

export function BackButton() {
  return <IconButton icon="arrow-left" label="Wróć" onPress={() => router.back()} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  screenContent: { paddingHorizontal: 18, gap: 18 },
  brandMark: { alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '45deg' }] },
  brandCore: { transform: [{ rotate: '-45deg' }] },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  headerText: { flex: 1, gap: 5 },
  eyebrow: { fontSize: 10, letterSpacing: 1.5, fontFamily: 'Inter_700Bold' },
  title: { fontSize: 29, lineHeight: 35, letterSpacing: -0.8, fontFamily: 'Inter_700Bold' },
  subtitle: { fontSize: 14, lineHeight: 21, fontFamily: 'Inter_400Regular' },
  iconButton: { width: 42, height: 42, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  button: { minHeight: 48, paddingHorizontal: 18, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  card: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 8 },
  statIcon: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  statLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  statValue: { fontSize: 24, fontFamily: 'Inter_700Bold' },
  center: { flex: 1, minHeight: 300, alignItems: 'center', justifyContent: 'center', gap: 12 },
  empty: { alignItems: 'center', justifyContent: 'center', padding: 28, gap: 10 },
  emptyTitle: { fontSize: 19, textAlign: 'center', fontFamily: 'Inter_700Bold' },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: 'Inter_700Bold' },
});

export const uiStyles = styles;