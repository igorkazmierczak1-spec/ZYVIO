import { useSignUp } from '@clerk/clerk-expo';
import { Link, router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { GoogleAuthButton } from '@/components/GoogleAuthButton';
import { BrandMark, PrimaryButton, uiStyles } from '@/components/ui';
import { useColors } from '@/hooks/useColors';

export default function SignUpScreen() {
  const colors = useColors();
  const { isLoaded, signUp, setActive } = useSignUp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const finish = async () => {
    if (signUp?.createdSessionId) {
      await setActive?.({ session: signUp.createdSessionId });
      router.replace('/');
    }
  };

  const submit = async () => {
    if (!isLoaded || !signUp) return;
    setMessage('');
    setBusy(true);
    try {
      await signUp.create({ emailAddress: email.trim(), password });
      await signUp.prepareEmailAddressVerification();
      setMessage('Kod weryfikacyjny został wysłany na Twój e-mail.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nie udało się utworzyć konta.');
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (!signUp) return;
    setBusy(true);
    try {
      await signUp.attemptEmailAddressVerification({ code });
      if (signUp.status === 'complete') await finish();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nieprawidłowy kod.');
    } finally {
      setBusy(false);
    }
  };

  if (!isLoaded || !signUp) return null;
  const verificationStep = signUp.status === 'missing_requirements' && signUp.unverifiedFields.includes('email_address');
  return (
    <KeyboardAwareScrollViewCompat style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={[uiStyles.screenContent, { paddingTop: 70, paddingBottom: 36 }]} bottomOffset={30}>
      <BrandMark size={54} />
      <View style={{ gap: 7, marginTop: 14 }}>
        <Text style={[uiStyles.eyebrow, { color: colors.primary }]}>ZYVIO / JOIN THE LOOP</Text>
        <Text style={[uiStyles.title, { color: colors.foreground, fontSize: 34 }]}>Zbuduj swoją pozycję.</Text>
        <Text style={[uiStyles.subtitle, { color: colors.mutedForeground }]}>Jedno konto do Battle, profilu, rankingu i społeczności ZYVIO.</Text>
      </View>
      <GoogleAuthButton />
      <View style={{ gap: 13 }}>
        {verificationStep ? <TextInput value={code} onChangeText={setCode} placeholder="Kod z e-maila" placeholderTextColor={colors.mutedForeground} keyboardType="number-pad" style={[inputStyle, { color: colors.foreground, backgroundColor: colors.input, borderColor: colors.border }]} /> : <>
          <TextInput testID="sign-up-email" value={email} onChangeText={setEmail} placeholder="Adres e-mail" placeholderTextColor={colors.mutedForeground} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" style={[inputStyle, { color: colors.foreground, backgroundColor: colors.input, borderColor: colors.border }]} />
          <TextInput testID="sign-up-password" value={password} onChangeText={setPassword} placeholder="Hasło" placeholderTextColor={colors.mutedForeground} secureTextEntry style={[inputStyle, { color: colors.foreground, backgroundColor: colors.input, borderColor: colors.border }]} />
        </>}
        <PrimaryButton onPress={verificationStep ? verify : submit} disabled={(verificationStep ? !code : !email || !password) || busy}>{busy ? 'Chwila…' : verificationStep ? 'Potwierdź e-mail' : 'Utwórz konto'}</PrimaryButton>
        {message ? <Text style={{ color: message.includes('wysłany') ? colors.primary : colors.destructive }}>{message}</Text> : null}
      </View>
      <View nativeID="clerk-captcha" />
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 8 }}>
        <Text style={{ color: colors.mutedForeground }}>Masz już konto?</Text>
        <Link href="/(auth)/sign-in" asChild><Pressable><Text style={{ color: colors.primary, fontFamily: 'Inter_700Bold' }}>Zaloguj się</Text></Pressable></Link>
      </View>
    </KeyboardAwareScrollViewCompat>
  );
}

const inputStyle = { minHeight: 52, borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, fontSize: 15, fontFamily: 'Inter_400Regular' } as const;