import { getListNotificationsQueryKey, useListNotifications, useMarkAllNotificationsRead, useMarkNotificationRead } from '@workspace/api-client-react';
import { router } from 'expo-router';
import React from 'react';
import { Pressable } from 'react-native';
import { Text, View } from 'react-native';
import { AppScreen, Card, EmptyState, ErrorState, Header, LoadingState, uiStyles } from '@/components/ui';
import { useColors } from '@/hooks/useColors';

export default function NotificationsScreen() {
  const colors = useColors();
  const notifications = useListNotifications();
  const markRead = useMarkNotificationRead({ mutation: { onSuccess: () => void notifications.refetch() } });
  const markAllRead = useMarkAllNotificationsRead({ mutation: { onSuccess: () => void notifications.refetch() } });
  if (notifications.isLoading) return <AppScreen scroll={false}><LoadingState /></AppScreen>;
  if (notifications.isError) return <AppScreen scroll={false}><ErrorState onRetry={() => void notifications.refetch()} /></AppScreen>;
  const list = notifications.data ?? [];
  const openTarget = (item: (typeof list)[number]) => {
    const destination = item.targetType === 'MESSAGE' ? `/messages/${item.targetId}` :
      item.targetType === 'POST' ? `/feed/${item.targetId}` :
        item.targetType === 'BATTLE' ? `/battles/${item.targetId}` :
          item.targetType === 'PROFILE' ? `/profile/${item.targetId}` : null;
    const go = () => { if (destination && item.targetId) router.push(destination as never); };
    if (item.read) { go(); return; }
    markRead.mutate({ notificationId: item.id }, { onSuccess: go });
  };
  return <AppScreen refreshing={notifications.isFetching} onRefresh={() => void notifications.refetch()}><Header eyebrow="ZYVIO / INBOX" title="Twoje alerty." subtitle="Nowe głosy, Battle i aktywność na Twoim koncie." right={list.some((item) => !item.read) ? <Pressable disabled={markAllRead.isPending} onPress={() => markAllRead.mutate(undefined)}><Text style={{ color: colors.primary, fontFamily: 'Inter_700Bold', fontSize: 11 }}>Oznacz wszystko</Text></Pressable> : null} />{list.length === 0 ? <EmptyState title="Cisza w eterze" body="Gdy coś ważnego się wydarzy, zobaczysz to tutaj." icon="notifications-off-outline" /> : list.map((item) => <Pressable key={item.id} disabled={markRead.isPending} onPress={() => openTarget(item)}><Card accent={item.read ? undefined : colors.primary}><View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}><Text style={[uiStyles.emptyTitle, { color: colors.foreground, textAlign: 'left', flex: 1 }]}>{item.title}</Text>{!item.read ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.destructive, marginTop: 6 }} /> : null}</View><Text style={[uiStyles.subtitle, { color: colors.mutedForeground }]}>{item.body}</Text><Text style={{ color: colors.mutedForeground, fontSize: 11 }}>{new Date(item.createdAt).toLocaleDateString('pl-PL')}</Text></Card></Pressable>)}</AppScreen>;
}