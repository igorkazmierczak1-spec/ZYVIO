import { useSignIn } from '@clerk/clerk-expo';
import { Link, router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { BrandMark, PrimaryButton, uiStyles } from '@/components/ui';
import { useColors } from '@/hooks/useColors';

export default function SignInScreen() {
  const colors = useColors();
  const { isLoaded, signIn, setActive } = useSignIn();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const finish = async () => {
    if (signIn?.createdSessionId) {
      await setActive?.({ session: signIn.createdSessionId });
      router.replace('/');
    }
  };

  const submit = async () => {
    if (!isLoaded || !signIn) return;
    setMessage('');
    setBusy(true);
    try {
      await signIn.create({ strategy: 'password', identifier: email.trim(), password });
      if (signIn.status === 'complete') await finish();
      else {
        const emailFactor = signIn.supportedSecondFactors?.find((factor) => factor.strategy === 'email_code');
        if (emailFactor) await signIn.prepareSecondFactor({ strategy: 'email_code' });
        setMessage('Wpisz kod wysłany na adres e-mail.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nie udało się zalogować.');
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (!signIn) return;
    setBusy(true);
    try {
      await signIn.attemptSecondFactor({ strategy: 'email_code', code });
      if (signIn.status === 'complete') await finish();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nieprawidłowy kod.');
    } finally {
      setBusy(false);
    }
  };

  if (!isLoaded || !signIn) return null;
  return (
    <KeyboardAwareScrollViewCompat style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={[uiStyles.screenContent, { paddingTop: 70, paddingBottom: 36 }]} bottomOffset={30}>
      <BrandMark size={54} />
      <View style={{ gap: 7, marginTop: 14 }}>
        <Text style={[uiStyles.eyebrow, { color: colors.primary }]}>VYBE / WELCOME BACK</Text>
        <Text style={[uiStyles.title, { color: colors.foreground, fontSize: 34 }]}>Wróć do swojego rytmu.</Text>
        <Text style={[uiStyles.subtitle, { color: colors.mutedForeground }]}>Zaloguj się, żeby głosować, walczyć i budować swoją pozycję.</Text>
      </View>
      {signIn.status === 'needs_second_factor' || signIn.status === 'needs_client_trust' ? (
        <View style={{ gap: 12 }}>
          <TextInput value={code} onChangeText={setCode} placeholder="Kod weryfikacyjny" placeholderTextColor={colors.mutedForeground} keyboardType="number-pad" style={[inputStyle, { color: colors.foreground, backgroundColor: colors.input, borderColor: colors.border }]} />
          <PrimaryButton onPress={verify} disabled={!code || busy}>{busy ? 'Sprawdzanie…' : 'Potwierdź kod'}</PrimaryButton>
          {message ? <Text style={{ color: colors.destructive }}>{message}</Text> : null}
        </View>
      ) : (
        <View style={{ gap: 13 }}>
          <TextInput testID="sign-in-email" value={email} onChangeText={setEmail} placeholder="Adres e-mail" placeholderTextColor={colors.mutedForeground} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" style={[inputStyle, { color: colors.foreground, backgroundColor: colors.input, borderColor: colors.border }]} />
          <TextInput testID="sign-in-password" value={password} onChangeText={setPassword} placeholder="Hasło" placeholderTextColor={colors.mutedForeground} secureTextEntry style={[inputStyle, { color: colors.foreground, backgroundColor: colors.input, borderColor: colors.border }]} />
          <PrimaryButton onPress={submit} disabled={!email || !password || busy}>{busy ? 'Logowanie…' : 'Zaloguj się'}</PrimaryButton>
          {message ? <Text style={{ color: colors.destructive }}>{message}</Text> : null}
        </View>
      )}
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 8 }}>
        <Text style={{ color: colors.mutedForeground }}>Nie masz jeszcze konta?</Text>
        <Link href="/(auth)/sign-up" asChild><Pressable><Text style={{ color: colors.primary, fontFamily: 'Inter_700Bold' }}>Załóż konto</Text></Pressable></Link>
      </View>
    </KeyboardAwareScrollViewCompat>
  );
}

const inputStyle = { minHeight: 52, borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, fontSize: 15, fontFamily: 'Inter_400Regular' } as const;