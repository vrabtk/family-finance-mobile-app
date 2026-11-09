import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { API_BASE_URL, HAS_API_CONFIG } from '../config';
import { errorMessage, useSession } from '../session';
import { colors, radius, space, type } from '../theme';
import { Button, Card, ErrorBanner, Field } from '../ui';

type Mode = 'login' | 'signup';

export function AuthScreen() {
  const { signIn, signUp } = useSession();
  const [mode, setMode] = useState<Mode>('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async () => {
    const email = form.email.trim();
    if (!email || !form.password || (mode === 'signup' && !form.name.trim())) { setError('Please fill in all fields.'); return; }
    if (mode === 'signup' && form.password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setBusy(true);
    setError('');
    try {
      if (mode === 'login') await signIn(email, form.password);
      else await signUp(form.name.trim(), email, form.password);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <View style={styles.logo}><Text style={styles.logoMark}>₹</Text></View>
            <Text style={type.title}>Family Finance</Text>
            <Text style={[type.small, { textAlign: 'center' }]}>Expenses, loans, savings and insurance for the whole household.</Text>
          </View>

          <Card>
            <View style={styles.toggle}>
              {(['login', 'signup'] as Mode[]).map((m) => (
                <Pressable key={m} onPress={() => { setMode(m); setError(''); }} style={[styles.toggleItem, mode === m && styles.toggleOn]} accessibilityRole="tab" accessibilityState={{ selected: mode === m }}>
                  <Text style={[styles.toggleLabel, mode === m && { color: colors.primary }]}>{m === 'login' ? 'Sign in' : 'Create account'}</Text>
                </Pressable>
              ))}
            </View>

            {mode === 'signup' && <Field label="Name" value={form.name} onChangeText={set('name')} placeholder="Your name" autoCapitalize="words" />}
            <Field label="Email" value={form.email} onChangeText={set('email')} placeholder="you@example.com" keyboardType="email-address" />
            <Field label="Password" value={form.password} onChangeText={set('password')} placeholder={mode === 'signup' ? 'At least 8 characters' : 'Your password'} secure />

            <ErrorBanner message={error} />
            <Button label={mode === 'login' ? 'Sign in' : 'Create account'} onPress={submit} loading={busy} style={{ marginTop: space.md }} />
          </Card>

          <View style={styles.secure}>
            <Feather name="lock" size={13} color={colors.muted} />
            <Text style={type.small}>Your session is kept in secure storage on this device.</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Shown when EXPO_PUBLIC_API_BASE_URL is missing: tells the developer exactly what to fix.
export function ConfigScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.brand}>
          <View style={[styles.logo, { backgroundColor: colors.warningSoft }]}><Feather name="settings" size={30} color={colors.warning} /></View>
          <Text style={type.title}>Backend not configured</Text>
        </View>
        <Card>
          <Text style={type.body}>Set the API address in <Text style={{ fontWeight: '700' }}>.env</Text> and restart Expo:</Text>
          <View style={styles.code}><Text style={styles.codeText}>EXPO_PUBLIC_API_BASE_URL=http://YOUR-LAN-IP:5051/api/v1</Text></View>
          <Text style={type.small}>Use your computer's LAN IP, not localhost, on a physical device.{HAS_API_CONFIG ? '' : ` Current value: ${API_BASE_URL || '(empty)'}`}</Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  body: { flexGrow: 1, justifyContent: 'center', padding: space.xl, gap: space.xl },
  brand: { alignItems: 'center', gap: space.sm },
  logo: { width: 64, height: 64, borderRadius: radius.xl, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: space.sm },
  logoMark: { color: colors.onPrimary, fontSize: 32, fontWeight: '800' },
  toggle: { flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: 4, marginBottom: space.lg },
  toggleItem: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.sm },
  toggleOn: { backgroundColor: colors.surface },
  toggleLabel: { fontSize: 14, fontWeight: '700', color: colors.textDim },
  secure: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  code: { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: space.md, marginVertical: space.md },
  codeText: { fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }), fontSize: 12, color: colors.text },
});
