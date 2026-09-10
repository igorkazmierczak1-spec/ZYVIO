import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { router } from 'expo-router';
import { useSSO } from '@clerk/clerk-expo';
import React, { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

WebBrowser.maybeCompleteAuthSession();

function useWarmUpBrowser() {
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);
}

export function GoogleAuthButton() {
  const colors = useColors();
  const { startSSOFlow } = useSSO();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useWarmUpBrowser();

  const continueWithGoogle = useCallback(async () => {
    setMessage('');
    setBusy(true);

    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: 'oauth_google',
        redirectUrl: AuthSession.makeRedirectUri({
          scheme: 'vybe',
          path: 'oauth-native-callback',
        }),
      });

      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        router.replace('/');
      } else {
        setMessage('Google wymaga jeszcze kilku informacji. Spróbuj ponownie.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nie udało się połączyć z Google.');
    } finally {
      setBusy(false);
    }
  }, [startSSOFlow]);

  return (
    <View style={{ gap: 9 }}>
      <Pressable
        testID="google-auth-button"
        accessibilityRole="button"
        accessibilityLabel="Kontynuuj z Google"
        disabled={busy}
        onPress={continueWithGoogle}
        style={({ pressed }) => ({
          minHeight: 52,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: busy ? 0.55 : pressed ? 0.78 : 1,
          flexDirection: 'row',
          gap: 10,
        })}
      >
        <Text style={{ color: colors.foreground, fontSize: 18, fontFamily: 'Inter_700Bold' }}>G</Text>
        <Text style={{ color: colors.foreground, fontSize: 14, fontFamily: 'Inter_700Bold' }}>
          {busy ? 'Łączenie…' : 'Kontynuuj z Google'}
        </Text>
      </Pressable>
      {message ? <Text style={{ color: colors.destructive, fontSize: 13, lineHeight: 19 }}>{message}</Text> : null}
    </View>
  );
}