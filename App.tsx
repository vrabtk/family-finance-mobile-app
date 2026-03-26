import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { ApiError, getAnalyticsAllTime, getPersons, getWorkspaces, getYears, login, refreshAuth, signup } from './src/api';
import { API_BASE_URL, HAS_API_CONFIG } from './src/config';
import { clearSessionStorage, loadSessionStorage, saveSessionStorage } from './src/storage';
import { MobileSession, Workspace } from './src/types';

type AuthMode = 'login' | 'signup';
type BootState = 'loading' | 'config' | 'auth' | 'app';

type DashboardData = {
  analytics: {
    totalExpenses: number;
    expenseCount: number;
    totalDebt: number;
    totalInvested: number;
    investmentGain: number;
  } | null;
  persons: Array<{ id: string; name: string; color?: string | null; hasPanel?: boolean | null }>;
  years: Array<{ id: string; label: string; status?: string | null }>;
};

const initialDashboard: DashboardData = {
  analytics: null,
  persons: [],
  years: [],
};

const currency = (value: number | null | undefined) => {
  const amount = Number(value || 0);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
};

function normalizeSession(session: MobileSession): MobileSession {
  const activeWorkspaceId = session.activeWorkspaceId || session.workspaces[0]?.id || null;
  return {
    ...session,
    activeWorkspaceId,
  };
}

function normalizeSignupResponse(data: any): MobileSession {
  const workspaces = data.workspaces || (data.workspace ? [{ ...data.workspace, role: 'admin' }] : []);
  return normalizeSession({
    user: data.user,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    workspaces,
    activeWorkspaceId: workspaces[0]?.id || null,
  });
}

export default function App() {
  const [bootState, setBootState] = useState<BootState>('loading');
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [authError, setAuthError] = useState('');
  const [session, setSession] = useState<MobileSession | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData>(initialDashboard);
  const [dashboardError, setDashboardError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '' });

  const activeWorkspace = useMemo<Workspace | null>(() => {
    if (!session?.workspaces?.length) return null;
    return session.workspaces.find((workspace) => workspace.id === session.activeWorkspaceId) || session.workspaces[0] || null;
  }, [session]);

  useEffect(() => {
    let mounted = true;

    const boot = async () => {
      if (!HAS_API_CONFIG) {
        if (mounted) setBootState('config');
        return;
      }

      const stored = await loadSessionStorage();
      if (!stored) {
        if (mounted) setBootState('auth');
        return;
      }

      const restored = await restoreSession(stored);
      if (!mounted) return;

      if (!restored) {
        setBootState('auth');
        return;
      }

      setSession(restored);
      setBootState('app');
    };

    boot();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (bootState !== 'app' || !session || !activeWorkspace) return;
    hydrateDashboard(session, activeWorkspace.id);
  }, [bootState, session, activeWorkspace?.id]);

  const restoreSession = async (candidate: MobileSession): Promise<MobileSession | null> => {
    try {
      const workspaces = await getWorkspaces(candidate.accessToken);
      const nextSession = normalizeSession({
        ...candidate,
        workspaces,
        activeWorkspaceId: candidate.activeWorkspaceId || workspaces[0]?.id || null,
      });
      await saveSessionStorage(nextSession);
      return nextSession;
    } catch (error) {
      if (error instanceof ApiError && error.code === 'TOKEN_EXPIRED') {
        try {
          const refreshed = await refreshAuth(candidate.refreshToken);
          const workspaces = await getWorkspaces(refreshed.accessToken);
          const nextSession = normalizeSession({
            ...candidate,
            accessToken: refreshed.accessToken,
            refreshToken: refreshed.refreshToken,
            workspaces,
            activeWorkspaceId: candidate.activeWorkspaceId || workspaces[0]?.id || null,
          });
          await saveSessionStorage(nextSession);
          return nextSession;
        } catch {
          await clearSessionStorage();
          return null;
        }
      }

      await clearSessionStorage();
      return null;
    }
  };

  const hydrateDashboard = async (currentSession: MobileSession, workspaceId: string, isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    setDashboardError('');

    try {
      const [analyticsRes, personsRes, yearsRes] = await Promise.allSettled([
        getAnalyticsAllTime(workspaceId, currentSession.accessToken),
        getPersons(workspaceId, currentSession.accessToken),
        getYears(workspaceId, currentSession.accessToken),
      ]);

      setDashboard({
        analytics: analyticsRes.status === 'fulfilled' ? analyticsRes.value : null,
        persons: personsRes.status === 'fulfilled' ? personsRes.value : [],
        years: yearsRes.status === 'fulfilled' ? yearsRes.value : [],
      });

      const failed = [analyticsRes, personsRes, yearsRes].some((result) => result.status === 'rejected');
      if (failed) setDashboardError('Some dashboard sections could not be loaded right now.');
    } catch {
      setDashboardError('Unable to load dashboard right now.');
    } finally {
      if (isManualRefresh) setRefreshing(false);
    }
  };

  const handleAuth = async () => {
    if (!form.email.trim() || !form.password.trim() || (authMode === 'signup' && !form.name.trim())) {
      setAuthError('Please fill the required fields.');
      return;
    }
    if (authMode === 'signup' && form.password.length < 8) {
      setAuthError('Password must be at least 8 characters.');
      return;
    }

    setSubmitting(true);
    setAuthError('');

    try {
      const data = authMode === 'login'
        ? await login(form.email.trim(), form.password)
        : await signup(form.name.trim(), form.email.trim(), form.password);

      const nextSession = normalizeSignupResponse(data);
      await saveSessionStorage(nextSession);
      setSession(nextSession);
      setBootState('app');
      setForm((current) => ({ ...current, password: '' }));
    } catch (error) {
      setAuthError(error instanceof ApiError ? error.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleWorkspaceChange = async (workspaceId: string) => {
    if (!session) return;
    const nextSession = normalizeSession({ ...session, activeWorkspaceId: workspaceId });
    setSession(nextSession);
    await saveSessionStorage(nextSession);
  };

  const handleLogout = async () => {
    await clearSessionStorage();
    setSession(null);
    setDashboard(initialDashboard);
    setBootState('auth');
    setAuthMode('login');
    setForm({ name: '', email: '', password: '' });
    setAuthError('');
  };

  if (bootState === 'loading') {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar style="light" />
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={palette.gold} size="large" />
          <Text style={styles.loadingTitle}>Preparing Family Finance Mobile</Text>
          <Text style={styles.loadingCopy}>Restoring your secure session and workspace context.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (bootState === 'config') {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar style="light" />
        <ScrollView contentContainerStyle={styles.authScroll}>
          <View style={styles.configCard}>
            <Text style={styles.brandLine}>FamilyFinance Mobile</Text>
            <Text style={styles.configTitle}>Set the backend URL before launching the app.</Text>
            <Text style={styles.configCopy}>
              Add `EXPO_PUBLIC_API_BASE_URL` to your mobile environment so the app can reach the shared backend API.
            </Text>
            <View style={styles.codeBlock}>
              <Text style={styles.codeLine}>EXPO_PUBLIC_API_BASE_URL=http://YOUR-IP:5000/api/v1</Text>
            </View>
            <Text style={styles.configCopy}>
              Current value: <Text style={styles.configValue}>{API_BASE_URL || 'Not configured'}</Text>
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (bootState === 'auth') {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar style="light" />
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 24}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <ScrollView
              contentContainerStyle={styles.authScroll}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.authContent}>
                <View style={styles.authCard}>
                  <View style={styles.modeTabs}>
                    {(['login', 'signup'] as AuthMode[]).map((mode) => (
                      <Pressable
                        key={mode}
                        onPress={() => {
                          setAuthMode(mode);
                          setAuthError('');
                        }}
                        style={[styles.modeTab, authMode === mode && styles.modeTabActive]}
                      >
                        <Text style={[styles.modeTabText, authMode === mode && styles.modeTabTextActive]}>
                          {mode === 'login' ? 'Sign In' : 'Create Account'}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={styles.authTitle}>{authMode === 'login' ? 'Access your workspace' : 'Create your first mobile workspace session'}</Text>
                  <Text style={styles.authCopy}>
                    {authMode === 'login'
                      ? 'Sign in with the same account you use on the web app.'
                      : 'Signup creates your account and personal workspace automatically.'}
                  </Text>

                  {authMode === 'signup' && (
                    <Field
                      label="Full Name"
                      value={form.name}
                      onChangeText={(value) => setForm((current) => ({ ...current, name: value }))}
                      placeholder="Hari"
                    />
                  )}
                  <Field
                    label="Email"
                    value={form.email}
                    onChangeText={(value) => setForm((current) => ({ ...current, email: value }))}
                    placeholder="you@example.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                  <Field
                    label="Password"
                    value={form.password}
                    onChangeText={(value) => setForm((current) => ({ ...current, password: value }))}
                    placeholder="Minimum 8 characters"
                    secureTextEntry
                  />

                  {authError ? (
                    <View style={styles.errorCard}>
                      <Text style={styles.errorText}>{authError}</Text>
                    </View>
                  ) : null}

                  <Pressable disabled={submitting} onPress={handleAuth} style={[styles.primaryButton, submitting && styles.primaryButtonDisabled]}>
                    {submitting ? <ActivityIndicator color={palette.bg} /> : <Text style={styles.primaryButtonText}>{authMode === 'login' ? 'Sign In' : 'Create Account'}</Text>}
                  </Pressable>

                  <Text style={styles.helperText}>
                    {authMode === 'login' ? 'Need an account? Switch to Create Account.' : 'Already registered? Switch to Sign In.'}
                  </Text>
                </View>

                <View style={styles.authHero}>
                  <View style={styles.heroBadge}>
                    <Text style={styles.heroBadgeIcon}>₹</Text>
                    <View style={styles.heroBadgeTextWrap}>
                      <Text style={styles.heroBadgeTitle}>FamilyFinance</Text>
                      <Text style={styles.heroBadgeSub}>Shared backend, separate mobile client</Text>
                    </View>
                  </View>
                  <Text style={styles.heroTitle}>Bring your household money flow into your pocket.</Text>
                  <Text style={styles.heroCopy}>
                    Start with secure auth, workspace switching, and a live summary dashboard built on the same API as the web app.
                  </Text>
                </View>
              </View>
            </ScrollView>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={styles.appScroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => session && activeWorkspace && hydrateDashboard(session, activeWorkspace.id, true)} tintColor={palette.gold} />}
      >
        <View style={styles.topCard}>
          <View style={styles.topCardHeader}>
            <View>
              <Text style={styles.brandLine}>FamilyFinance Mobile</Text>
              <Text style={styles.topCardTitle}>{activeWorkspace?.name || 'No workspace selected'}</Text>
              <Text style={styles.topCardCopy}>
                Signed in as {session?.user.name}. Same backend, separate mobile client.
              </Text>
            </View>
            <Pressable onPress={handleLogout} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Logout</Text>
            </Pressable>
          </View>

          <View style={styles.workspaceGrid}>
            {session?.workspaces.map((workspace) => {
              const active = workspace.id === activeWorkspace?.id;
              return (
                <Pressable
                  key={workspace.id}
                  onPress={() => handleWorkspaceChange(workspace.id)}
                  style={[styles.workspaceChip, active && styles.workspaceChipActive]}
                >
                  <Text style={[styles.workspaceChipTitle, active && styles.workspaceChipTitleActive]}>{workspace.name}</Text>
                  <Text style={[styles.workspaceChipMeta, active && styles.workspaceChipMetaActive]}>
                    {(workspace.role || 'member').toUpperCase()} · {workspace.type}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Section title="Quick Snapshot" subtitle="Live backend totals for the selected workspace.">
          <View style={styles.statGrid}>
            <StatCard label="All-Time Spend" value={currency(dashboard.analytics?.totalExpenses)} accent={palette.red} />
            <StatCard label="Entries" value={String(dashboard.analytics?.expenseCount || 0)} accent={palette.text} />
            <StatCard label="Outstanding Debt" value={currency(dashboard.analytics?.totalDebt)} accent={palette.amber} />
            <StatCard label="Invested" value={currency(dashboard.analytics?.totalInvested)} accent={palette.blue} />
          </View>
        </Section>

        <Section title="People" subtitle="The people currently available in this workspace.">
          {dashboard.persons.length ? (
            <View style={styles.listCard}>
              {dashboard.persons.slice(0, 6).map((person) => (
                <View key={person.id} style={styles.listRow}>
                  <View style={styles.personRowLeft}>
                    <View style={[styles.personDot, { backgroundColor: person.color || palette.gold }]} />
                    <View style={styles.personTextWrap}>
                      <Text style={styles.listTitle}>{person.name}</Text>
                      <Text style={styles.listMeta}>{person.hasPanel ? 'Expense panel enabled' : 'Income only'}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <EmptyCard message="No workspace people found yet." />
          )}
        </Section>

        <Section title="Years & Months" subtitle="Your current year structures from the shared expense backend.">
          {dashboard.years.length ? (
            <View style={styles.listCard}>
              {dashboard.years.slice(0, 6).map((year) => (
                <View key={year.id} style={styles.listRow}>
                  <View style={styles.personTextWrap}>
                    <Text style={styles.listTitle}>{year.label}</Text>
                    <Text style={styles.listMeta}>{year.status === 'archived' ? 'Archived' : 'Active structure'}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <EmptyCard message="No year structures found yet." />
          )}
        </Section>

        <Section title="Next Mobile Modules" subtitle="Suggested order for the next mobile build steps.">
          <View style={styles.moduleGrid}>
            {['Expenses', 'Analytics', 'Loans', 'Investments', 'Insurance', 'Banks'].map((item) => (
              <View key={item} style={styles.moduleCard}>
                <Text style={styles.moduleTitle}>{item}</Text>
                <Text style={styles.moduleMeta}>Planned next</Text>
              </View>
            ))}
          </View>
        </Section>

        {dashboardError ? (
          <View style={styles.warningCard}>
            <Text style={styles.warningText}>{dashboardError}</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={palette.muted}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        style={styles.input}
      />
    </View>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionCopy}>{subtitle}</Text>
      {children}
    </View>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color: accent }]}>{value}</Text>
    </View>
  );
}

function EmptyCard({ message }: { message: string }) {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  );
}

const palette = {
  bg: '#060a12',
  surface: '#0d1422',
  surface2: '#131d30',
  surface3: '#1a2640',
  border: '#1e2d48',
  border2: '#253650',
  gold: '#f0b429',
  text: '#dde6f5',
  textDim: '#91a7c7',
  muted: '#5e7698',
  red: '#f87171',
  amber: '#fbbf24',
  blue: '#38bdf8',
  green: '#34d399',
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  loadingTitle: {
    color: palette.text,
    fontSize: 22,
    fontWeight: '800',
  },
  loadingCopy: {
    color: palette.textDim,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
  authScroll: {
    flexGrow: 1,
    padding: 16,
    paddingBottom: 32,
  },
  authContent: {
    gap: 16,
  },
  authHero: {
    backgroundColor: palette.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 20,
    gap: 14,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    alignSelf: 'flex-start',
    backgroundColor: palette.surface2,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#6f5311',
  },
  heroBadgeIcon: {
    backgroundColor: palette.gold,
    color: palette.bg,
    width: 32,
    height: 32,
    textAlign: 'center',
    textAlignVertical: 'center',
    borderRadius: 12,
    overflow: 'hidden',
    fontWeight: '800',
    fontSize: 18,
    lineHeight: 32,
  },
  heroBadgeTextWrap: {
    gap: 2,
  },
  heroBadgeTitle: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '800',
  },
  heroBadgeSub: {
    color: palette.muted,
    fontSize: 11,
  },
  heroTitle: {
    color: palette.text,
    fontSize: 31,
    lineHeight: 34,
    fontWeight: '900',
    letterSpacing: -1,
  },
  heroCopy: {
    color: palette.textDim,
    fontSize: 15,
    lineHeight: 23,
  },
  authCard: {
    backgroundColor: palette.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 20,
    gap: 14,
  },
  modeTabs: {
    flexDirection: 'row',
    backgroundColor: palette.surface2,
    borderRadius: 16,
    padding: 4,
    gap: 4,
  },
  modeTab: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
  },
  modeTabActive: {
    backgroundColor: 'rgba(240,180,41,.12)',
    borderWidth: 1,
    borderColor: '#6f5311',
  },
  modeTabText: {
    color: palette.textDim,
    fontWeight: '700',
  },
  modeTabTextActive: {
    color: palette.gold,
  },
  authTitle: {
    color: palette.text,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '800',
  },
  authCopy: {
    color: palette.textDim,
    fontSize: 14,
    lineHeight: 22,
    marginTop: -2,
  },
  fieldWrap: {
    gap: 8,
  },
  fieldLabel: {
    color: palette.textDim,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  input: {
    backgroundColor: palette.surface2,
    borderWidth: 1,
    borderColor: palette.border2,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 16,
    color: palette.text,
  },
  errorCard: {
    backgroundColor: 'rgba(74,16,16,.55)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,.35)',
    borderRadius: 16,
    padding: 12,
  },
  errorText: {
    color: palette.red,
    fontSize: 13,
    lineHeight: 20,
  },
  primaryButton: {
    backgroundColor: palette.gold,
    borderRadius: 16,
    minHeight: 54,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.65,
  },
  primaryButtonText: {
    color: palette.bg,
    fontWeight: '900',
    fontSize: 16,
  },
  helperText: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 19,
    textAlign: 'center',
  },
  appScroll: {
    padding: 16,
    gap: 16,
  },
  topCard: {
    backgroundColor: palette.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 18,
    gap: 16,
  },
  brandLine: {
    color: palette.gold,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  topCardHeader: {
    gap: 16,
  },
  topCardTitle: {
    color: palette.text,
    fontSize: 26,
    lineHeight: 30,
    fontWeight: '900',
    marginTop: 4,
  },
  topCardCopy: {
    color: palette.textDim,
    fontSize: 14,
    lineHeight: 22,
    marginTop: 6,
  },
  secondaryButton: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border2,
    backgroundColor: palette.surface2,
  },
  secondaryButtonText: {
    color: palette.textDim,
    fontWeight: '800',
    fontSize: 13,
  },
  workspaceGrid: {
    gap: 10,
  },
  workspaceChip: {
    backgroundColor: palette.surface2,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border2,
    padding: 14,
  },
  workspaceChipActive: {
    borderColor: '#6f5311',
    backgroundColor: 'rgba(240,180,41,.12)',
  },
  workspaceChipTitle: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '800',
  },
  workspaceChipTitleActive: {
    color: '#f6cf70',
  },
  workspaceChipMeta: {
    color: palette.muted,
    fontSize: 11,
    marginTop: 4,
  },
  workspaceChipMetaActive: {
    color: '#cfb270',
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    color: palette.text,
    fontSize: 20,
    fontWeight: '800',
  },
  sectionCopy: {
    color: palette.textDim,
    fontSize: 13,
    lineHeight: 20,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    backgroundColor: palette.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 14,
    width: '48.5%',
    minWidth: 150,
    gap: 6,
  },
  statLabel: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  statValue: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '900',
  },
  listCard: {
    backgroundColor: palette.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    overflow: 'hidden',
  },
  listRow: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  personRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  personDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
  },
  personTextWrap: {
    flex: 1,
    gap: 3,
  },
  listTitle: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '800',
  },
  listMeta: {
    color: palette.textDim,
    fontSize: 12,
  },
  moduleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  moduleCard: {
    width: '48.5%',
    minWidth: 150,
    backgroundColor: palette.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 14,
    gap: 6,
  },
  moduleTitle: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '800',
  },
  moduleMeta: {
    color: palette.gold,
    fontSize: 12,
    fontWeight: '700',
  },
  emptyCard: {
    backgroundColor: palette.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 18,
  },
  emptyText: {
    color: palette.textDim,
    fontSize: 13,
    lineHeight: 20,
  },
  warningCard: {
    backgroundColor: 'rgba(74,48,0,.45)',
    borderWidth: 1,
    borderColor: '#5a3a00',
    borderRadius: 16,
    padding: 12,
  },
  warningText: {
    color: palette.amber,
    fontSize: 13,
    lineHeight: 20,
  },
  configCard: {
    backgroundColor: palette.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 20,
    gap: 14,
  },
  configTitle: {
    color: palette.text,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '900',
  },
  configCopy: {
    color: palette.textDim,
    fontSize: 14,
    lineHeight: 22,
  },
  configValue: {
    color: palette.gold,
    fontWeight: '800',
  },
  codeBlock: {
    backgroundColor: palette.surface2,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border2,
    padding: 14,
  },
  codeLine: {
    color: palette.text,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontSize: 13,
    lineHeight: 20,
  },
});
