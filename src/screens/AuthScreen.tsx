import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { API_BASE_URL, HAS_API_CONFIG } from '../config';
import { forgotPassword, resetPassword } from '../api';
import { FadeIn, easeNextLayout, useReduceMotion } from '../motion';
import { useKeyboardHeight } from '../hooks';
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
  const reduceMotion = useReduceMotion();
  const keyboard = useKeyboardHeight();
  const [forgot, setForgot] = useState(false);
  const [notice, setNotice] = useState('');

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
      <View style={{ flex: 1, paddingBottom: keyboard }}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <View style={styles.logo}><Text style={styles.logoMark}>₹</Text></View>
            <Text style={type.title}>Family Finance</Text>
            <Text style={[type.small, { textAlign: 'center' }]}>Expenses, loans, savings and insurance for the whole household.</Text>
          </View>

          {forgot ? (
            <FadeIn key="forgot"><Card>
              <ForgotFlow initialEmail={form.email} onDone={(message) => { setForgot(false); setMode('login'); setNotice(message); }} onCancel={() => setForgot(false)} />
            </Card></FadeIn>
          ) : (
          <FadeIn key="form"><Card>
            <View style={styles.toggle}>
              {(['login', 'signup'] as Mode[]).map((m) => (
                <Pressable key={m} onPress={() => { easeNextLayout(reduceMotion); setMode(m); setError(''); }} style={[styles.toggleItem, mode === m && styles.toggleOn]} accessibilityRole="tab" accessibilityState={{ selected: mode === m }}>
                  <Text style={[styles.toggleLabel, mode === m && { color: colors.primary }]}>{m === 'login' ? 'Sign in' : 'Create account'}</Text>
                </Pressable>
              ))}
            </View>

            {mode === 'signup' && <FadeIn key="name" from={8}><Field label="Name" value={form.name} onChangeText={set('name')} placeholder="Your name" autoCapitalize="words" /></FadeIn>}
            <Field label="Email" value={form.email} onChangeText={set('email')} placeholder="you@example.com" keyboardType="email-address" />
            <Field label="Password" value={form.password} onChangeText={set('password')} placeholder={mode === 'signup' ? 'At least 8 characters' : 'Your password'} secure />

            {!!notice && mode === 'login' && <Text style={[type.small, { color: colors.positive, marginBottom: space.sm }]}>{notice}</Text>}
            <ErrorBanner message={error} />
            <Button label={mode === 'login' ? 'Sign in' : 'Create account'} onPress={submit} loading={busy} style={{ marginTop: space.md }} />
            {mode === 'login' && (
              <Pressable onPress={() => { setForgot(true); setError(''); setNotice(''); }} hitSlop={8} accessibilityRole="button" style={{ alignSelf: 'center', marginTop: space.md }}>
                <Text style={[type.small, { color: colors.primary, fontWeight: '700' }]}>Forgot password?</Text>
              </Pressable>
            )}
          </Card></FadeIn>
          )}

          <View style={styles.secure}>
            <Feather name="lock" size={13} color={colors.muted} />
            <Text style={type.small}>Your session is kept in secure storage on this device.</Text>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

// Forgot password: ask for a one-time code by email, then enter it with a new password.
function ForgotFlow({ initialEmail, onDone, onCancel }: { initialEmail: string; onDone: (message: string) => void; onCancel: () => void }) {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const sendCode = async () => {
    if (!email.trim()) { setError('Enter your email.'); return; }
    setBusy(true);
    setError('');
    try {
      const res = await forgotPassword(email.trim());
      setInfo(res.message);
      setStep('code');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (!/^\d{6}$/.test(code.trim())) { setError('Enter the 6-digit code from the email.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setBusy(true);
    setError('');
    try {
      const res = await resetPassword(email.trim(), code.trim(), password);
      onDone(res.message);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <>
      <Text style={[type.heading, { marginBottom: space.sm }]}>Reset your password</Text>
      {step === 'email' ? (
        <>
          <Text style={[type.small, { marginBottom: space.md }]}>We will email a 6-digit code to your account address.</Text>
          <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" placeholder="you@example.com" />
          <ErrorBanner message={error} />
          <Button label="Send code" onPress={sendCode} loading={busy} />
        </>
      ) : (
        <>
          <Text style={[type.small, { marginBottom: space.md }]}>{info} The code works for 10 minutes.</Text>
          <Field label="6-digit code" value={code} onChangeText={setCode} keyboardType="number-pad" placeholder="123456" />
          <Field label="New password" value={password} onChangeText={setPassword} secure placeholder="At least 8 characters" />
          <ErrorBanner message={error} />
          <Button label="Change password" onPress={reset} loading={busy} />
          <Pressable onPress={sendCode} hitSlop={8} accessibilityRole="button" style={{ alignSelf: 'center', marginTop: space.md }}>
            <Text style={[type.small, { color: colors.primary, fontWeight: '700' }]}>Send a new code</Text>
          </Pressable>
        </>
      )}
      <Pressable onPress={onCancel} hitSlop={8} accessibilityRole="button" style={{ alignSelf: 'center', marginTop: space.md }}>
        <Text style={type.small}>Back to sign in</Text>
      </Pressable>
    </>
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
