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
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, Ionicons } from '@expo/vector-icons';
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
          <ActivityIndicator color={palette.primary} size="large" />
          <Text style={styles.loadingTitle}>Preparing Workspace</Text>
          <Text style={styles.loadingCopy}>Restoring your secure session and context...</Text>
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
            <View style={styles.iconCircle}>
              <Feather name="settings" size={24} color={palette.cyan} />
            </View>
            <Text style={styles.configTitle}>Backend Missing</Text>
            <Text style={styles.configCopy}>
              Configure `EXPO_PUBLIC_API_BASE_URL` in your `.env` so the app can connect to the core backend API.
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
                
                {/* Hero Section */}
                <View style={styles.authHero}>
                  <LinearGradient
                    colors={['rgba(139, 92, 246, 0.25)', 'transparent']}
                    style={StyleSheet.absoluteFillObject}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  />
                  <View style={styles.heroBadge}>
                    <Ionicons name="layers" size={18} color={palette.primary} />
                    <Text style={styles.heroBadgeTitle}>FamilyFinance</Text>
                  </View>
                  <Text style={styles.heroTitle}>Smart household{"\n"}money flow.</Text>
                  <Text style={styles.heroCopy}>
                    Your finances in your pocket, powered by a shared backend workspace.
                  </Text>
                </View>

                {/* Auth Form Card */}
                <View style={[styles.authCard, styles.cardShadow]}>
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

                  <Text style={styles.authTitle}>
                    {authMode === 'login' ? 'Access Workspace' : 'Setup Workspace'}
                  </Text>

                  {authMode === 'signup' && (
                    <Field
                      icon="user"
                      label="Full Name"
                      value={form.name}
                      onChangeText={(value) => setForm((current) => ({ ...current, name: value }))}
                      placeholder="e.g. Hari"
                    />
                  )}
                  <Field
                    icon="mail"
                    label="Email Address"
                    value={form.email}
                    onChangeText={(value) => setForm((current) => ({ ...current, email: value }))}
                    placeholder="you@example.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                  <Field
                    icon="lock"
                    label="Password"
                    value={form.password}
                    onChangeText={(value) => setForm((current) => ({ ...current, password: value }))}
                    placeholder="Minimum 8 characters"
                    secureTextEntry
                  />

                  {authError ? (
                    <View style={styles.errorCard}>
                      <Feather name="alert-circle" size={16} color={palette.red} />
                      <Text style={styles.errorText}>{authError}</Text>
                    </View>
                  ) : null}

                  <Pressable disabled={submitting} onPress={handleAuth} style={({ pressed }) => [styles.primaryButton, submitting && styles.primaryButtonDisabled, pressed && { opacity: 0.8 }]}>
                    <LinearGradient
                      colors={[palette.primary, palette.primaryDark]}
                      style={styles.primaryButtonGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      {submitting ? (
                        <ActivityIndicator color={palette.text} />
                      ) : (
                        <Text style={styles.primaryButtonText}>{authMode === 'login' ? 'Sign In to Proceed' : 'Create & Continue'}</Text>
                      )}
                    </LinearGradient>
                  </Pressable>
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
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => session && activeWorkspace && hydrateDashboard(session, activeWorkspace.id, true)} tintColor={palette.primary} />}
      >
        {/* Top Floating Header */}
        <View style={[styles.topCard, styles.cardShadow]}>
          <LinearGradient
            colors={['rgba(6, 182, 212, 0.15)', 'transparent']}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 1, y: 0 }}
            end={{ x: 0, y: 1 }}
          />
          <View style={styles.topCardHeader}>
            <View style={styles.flex}>
              <View style={styles.workspacePill}>
                 <Feather name="globe" size={12} color={palette.cyan} />
                 <Text style={styles.workspacePillText}>Workspace Context</Text>
              </View>
              <Text style={styles.topCardTitle}>{activeWorkspace?.name || 'No workspace selected'}</Text>
              <Text style={styles.topCardCopy}>
                Signed in as <Text style={styles.highlightText}>{session?.user.name}</Text>
              </Text>
            </View>
            <Pressable onPress={handleLogout} style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.7 }]}>
              <Feather name="log-out" size={18} color={palette.textDim} />
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
                  <View style={styles.workspaceChipMetaRow}>
                    <Text style={[styles.workspaceChipMeta, active && styles.workspaceChipMetaActive]}>
                      {(workspace.role || 'member').toUpperCase()}
                    </Text>
                    <View style={[styles.dot, active && styles.dotActive]} />
                    <Text style={[styles.workspaceChipMeta, active && styles.workspaceChipMetaActive]}>
                      {workspace.type}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Snapshot Section */}
        <Section title="Quick Snapshot" subtitle="Live backend overview" icon="pie-chart">
          <View style={styles.statGrid}>
            <StatCard label="Total Spent" value={currency(dashboard.analytics?.totalExpenses)} gradient={['rgba(239, 68, 68, 0.15)', 'rgba(239, 68, 68, 0.05)']} accentColor={palette.red} icon="trending-down" />
            <StatCard label="Transactions" value={String(dashboard.analytics?.expenseCount || 0)} gradient={['rgba(139, 92, 246, 0.15)', 'rgba(139, 92, 246, 0.05)']} accentColor={palette.primary} icon="hash" />
            <StatCard label="Total Debt" value={currency(dashboard.analytics?.totalDebt)} gradient={['rgba(245, 158, 11, 0.15)', 'rgba(245, 158, 11, 0.05)']} accentColor={palette.amber} icon="credit-card" />
            <StatCard label="Investments" value={currency(dashboard.analytics?.totalInvested)} gradient={['rgba(6, 182, 212, 0.15)', 'rgba(6, 182, 212, 0.05)']} accentColor={palette.cyan} icon="trending-up" />
          </View>
        </Section>

        {/* People Section */}
        <Section title="Active People" subtitle="Participants in this workspace" icon="users">
          {dashboard.persons.length ? (
            <View style={[styles.listCard, styles.cardShadow]}>
               {dashboard.persons.slice(0, 6).map((person, i) => {
                 const isLast = i === Math.min(dashboard.persons.length, 6) - 1;
                 return (
                  <View key={person.id} style={[styles.listRow, !isLast && styles.listRowBorder]}>
                    <View style={styles.personRowLeft}>
                      <View style={[styles.avatarStyle, { backgroundColor: person.color || palette.primary }]}>
                        <Text style={styles.avatarText}>{person.name.substring(0, 2).toUpperCase()}</Text>
                      </View>
                      <View style={styles.personTextWrap}>
                        <Text style={styles.listTitle}>{person.name}</Text>
                        <Text style={styles.listMeta}>{person.hasPanel ? 'Expense Panel Active' : 'Income Only'}</Text>
                      </View>
                    </View>
                    <Feather name="chevron-right" size={16} color={palette.border} />
                  </View>
                 );
               })}
            </View>
          ) : (
            <EmptyCard message="No people linked to this workspace." icon="user-x" />
          )}
        </Section>

        {/* Structures Section */}
        <Section title="Financial Structures" subtitle="Configured years from Web" icon="calendar">
          {dashboard.years.length ? (
            <View style={[styles.listCard, styles.cardShadow]}>
              {dashboard.years.slice(0, 6).map((year, i) => {
                const isLast = i === Math.min(dashboard.years.length, 6) - 1;
                return (
                 <View key={year.id} style={[styles.listRow, !isLast && styles.listRowBorder]}>
                   <View style={styles.personRowLeft}>
                     <View style={[styles.iconCircle, { padding: 10, marginRight: 4, backgroundColor: palette.surface2 }]}>
                       <Feather name={year.status === 'archived' ? 'archive' : 'layers'} size={14} color={palette.cyan} />
                     </View>
                     <View style={styles.personTextWrap}>
                       <Text style={styles.listTitle}>{year.label}</Text>
                       <Text style={styles.listMeta}>{year.status === 'archived' ? 'Archived structure' : 'Active structure'}</Text>
                     </View>
                   </View>
                 </View>
                );
              })}
            </View>
          ) : (
            <EmptyCard message="No financial years found yet." icon="inbox" />
          )}
        </Section>

        {/* Up Next Modules */}
        <Section title="Upcoming Modules" subtitle="What's planned next for Mobile" icon="compass">
          <View style={styles.moduleGrid}>
            {['Expenses', 'Analytics', 'Loans', 'Investments', 'Insurance', 'Banks'].map((item) => (
              <View key={item} style={styles.moduleCard}>
                <Text style={styles.moduleTitle}>{item}</Text>
                <Ionicons name="sparkles" size={14} color={palette.border} style={{ marginTop: 2 }} />
              </View>
            ))}
          </View>
        </Section>

        <View style={{ height: 40 }} />

        {dashboardError ? (
          <View style={styles.warningCard}>
            <Feather name="wifi-off" size={16} color={palette.amber} />
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
  icon,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  icon: keyof typeof Feather.glyphMap;
}) {
  const [isFocused, setIsFocused] = useState(false);
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.inputContainer, isFocused && styles.inputContainerFocused]}>
        <Feather name={icon} size={18} color={isFocused ? palette.primary : palette.muted} style={styles.inputIcon} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={palette.muted}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          style={styles.input}
        />
      </View>
    </View>
  );
}

function Section({ title, subtitle, icon, children }: { title: string; subtitle: string; icon: keyof typeof Feather.glyphMap; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Feather name={icon} size={20} color={palette.text} />
        <View>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.sectionCopy}>{subtitle}</Text>
        </View>
      </View>
      {children}
    </View>
  );
}

function StatCard({ label, value, gradient, accentColor, icon }: { label: string; value: string; gradient: [string, string]; accentColor: string; icon: keyof typeof Feather.glyphMap; }) {
  return (
    <View style={[styles.statCardOuter, styles.cardShadow]}>
      <LinearGradient colors={gradient} style={StyleSheet.absoluteFillObject} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
      <View style={styles.statCardInner}>
        <View style={styles.statHeaderRow}>
          <Text style={styles.statLabel}>{label}</Text>
          <Feather name={icon} size={14} color={accentColor} />
        </View>
        <Text style={[styles.statValue, { color: accentColor }]}>{value}</Text>
      </View>
    </View>
  );
}

function EmptyCard({ message, icon }: { message: string; icon: keyof typeof Feather.glyphMap; }) {
  return (
    <View style={[styles.emptyCard, styles.cardShadow]}>
      <View style={[styles.iconCircle, { backgroundColor: palette.surface2 }]}>
        <Feather name={icon} size={24} color={palette.textDim} />
      </View>
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  );
}

// PREMIUM MIDNIGHT GLASS THEME
const palette = {
  bg: '#0B0914', // Very deep violet-black
  surface: '#161224', // Deep indigo card background
  surface2: '#201B34', // Slightly lighter indigo for inputs/chips
  border: '#2A2346',
  border2: '#3D3465',
  borderGlow: 'rgba(139, 92, 246, 0.4)',
  primary: '#8B5CF6', // Electric Purple
  primaryDark: '#6D28D9',
  cyan: '#06B6D4', // Neon Cyan
  text: '#F8FAFC',
  textDim: '#94A3B8',
  muted: '#475569',
  red: '#F43F5E',
  amber: '#F59E0B',
  green: '#10B981',
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  cardShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 16,
  },
  loadingTitle: {
    color: palette.text,
    fontSize: 24,
    fontWeight: '800',
    marginTop: 8,
  },
  loadingCopy: {
    color: palette.textDim,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 24,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  authScroll: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 40,
    justifyContent: 'center',
  },
  authContent: {
    gap: 24,
    marginTop: 20,
  },
  authHero: {
    borderRadius: 32,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 28,
    gap: 16,
    overflow: 'hidden',
    backgroundColor: palette.surface,
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    backgroundColor: palette.surface2,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: palette.border2,
  },
  heroBadgeTitle: {
    color: palette.text,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  heroTitle: {
    color: palette.text,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '900',
    letterSpacing: -1,
  },
  heroCopy: {
    color: palette.textDim,
    fontSize: 15,
    lineHeight: 24,
  },
  authCard: {
    backgroundColor: palette.surface,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 24,
    gap: 20,
  },
  modeTabs: {
    flexDirection: 'row',
    backgroundColor: palette.bg,
    borderRadius: 20,
    padding: 6,
    borderWidth: 1,
    borderColor: palette.border,
  },
  modeTab: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modeTabActive: {
    backgroundColor: palette.surface2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  modeTabText: {
    color: palette.muted,
    fontWeight: '800',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modeTabTextActive: {
    color: palette.text,
  },
  authTitle: {
    color: palette.text,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '900',
    marginTop: 4,
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
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.surface2,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 20,
    overflow: 'hidden',
  },
  inputContainerFocused: {
    borderColor: palette.primary,
    backgroundColor: palette.surface,
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  inputIcon: {
    paddingLeft: 16,
  },
  input: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: palette.text,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.3)',
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  errorText: {
    flex: 1,
    color: palette.red,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
  },
  primaryButton: {
    borderRadius: 20,
    overflow: 'hidden',
    marginTop: 4,
  },
  primaryButtonDisabled: {
    opacity: 0.65,
  },
  primaryButtonGradient: {
    minHeight: 56,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  primaryButtonText: {
    color: palette.text,
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  appScroll: {
    padding: 20,
    gap: 24,
  },
  topCard: {
    backgroundColor: palette.surface,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 24,
    gap: 20,
    overflow: 'hidden',
  },
  topCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  workspacePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    alignSelf: 'flex-start',
    marginBottom: 12,
    gap: 6,
  },
  workspacePillText: {
    color: palette.cyan,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  highlightText: {
    color: palette.text,
    fontWeight: '800',
  },
  topCardTitle: {
    color: palette.text,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  topCardCopy: {
    color: palette.textDim,
    fontSize: 14,
    lineHeight: 22,
    marginTop: 4,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: palette.surface2,
    borderWidth: 1,
    borderColor: palette.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  workspaceGrid: {
    gap: 12,
  },
  workspaceChip: {
    backgroundColor: palette.bg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 16,
  },
  workspaceChipActive: {
    borderColor: palette.cyan,
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
    shadowColor: palette.cyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  workspaceChipTitle: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '800',
  },
  workspaceChipTitleActive: {
    color: palette.cyan,
  },
  workspaceChipMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 6,
  },
  workspaceChipMeta: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  workspaceChipMetaActive: {
    color: '#38bdf8', // Lighter cyan
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.muted,
  },
  dotActive: {
    backgroundColor: palette.cyan,
    opacity: 0.5,
  },
  section: {
    gap: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  sectionTitle: {
    color: palette.text,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  sectionCopy: {
    color: palette.textDim,
    fontSize: 13,
    marginTop: 2,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCardOuter: {
    width: '48%',
    minWidth: 150,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.border,
    overflow: 'hidden',
    backgroundColor: palette.surface,
  },
  statCardInner: {
    padding: 16,
    gap: 12,
  },
  statHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statLabel: {
    color: palette.textDim,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  listCard: {
    backgroundColor: palette.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.border,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  listRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  personRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarStyle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  avatarText: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
  },
  personTextWrap: {
    flex: 1,
    gap: 4,
  },
  listTitle: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '800',
  },
  listMeta: {
    color: palette.textDim,
    fontSize: 13,
  },
  moduleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  moduleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '48%',
    minWidth: 150,
    backgroundColor: palette.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 16,
  },
  moduleTitle: {
    color: palette.textDim,
    fontSize: 14,
    fontWeight: '800',
  },
  emptyCard: {
    backgroundColor: palette.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 32,
    alignItems: 'center',
    gap: 16,
  },
  emptyText: {
    color: palette.textDim,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: 20,
    padding: 16,
    gap: 12,
  },
  warningText: {
    flex: 1,
    color: palette.amber,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
  },
  configCard: {
    backgroundColor: palette.surface,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 28,
    gap: 16,
    alignItems: 'center',
  },
  configTitle: {
    color: palette.text,
    fontSize: 26,
    fontWeight: '900',
  },
  configCopy: {
    color: palette.textDim,
    fontSize: 15,
    lineHeight: 24,
    textAlign: 'center',
  },
  configValue: {
    color: palette.cyan,
    fontWeight: '800',
  },
  codeBlock: {
    backgroundColor: palette.bg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 16,
    width: '100%',
  },
  codeLine: {
    color: palette.green,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontSize: 13,
    lineHeight: 20,
  },
});
