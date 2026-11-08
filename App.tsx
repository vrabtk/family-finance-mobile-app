import { Feather } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Focus, Go, MoreKey, TABS, TabKey } from './src/navigation';
import { AuthScreen, ConfigScreen } from './src/screens/AuthScreen';
import { BanksScreen } from './src/screens/BanksScreen';
import { ExpensesScreen } from './src/screens/ExpensesScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { MoreScreen, SettingsScreen } from './src/screens/MoreScreen';
import { InsuranceScreen, InvestmentsScreen, LoansScreen, OverviewScreen } from './src/screens/resources';
import { SessionProvider, useSession } from './src/session';
import { colors, shadow, space } from './src/theme';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <SessionProvider>
        <Root />
      </SessionProvider>
    </SafeAreaProvider>
  );
}

function Root() {
  const { status, workspace } = useSession();
  if (status === 'loading') {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }
  if (status === 'config') return <ConfigScreen />;
  if (status === 'signedOut') return <AuthScreen />;
  // Keyed by workspace so every screen reloads cleanly after switching.
  return <Main key={workspace?.id ?? 'none'} />;
}

function Main() {
  const [tab, setTab] = useState<TabKey>('home');
  const [more, setMore] = useState<MoreKey | null>(null);
  const [focus, setFocus] = useState<Focus | undefined>();

  // Android back: close a More sub-screen, then return to Home, then exit.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (more) { setMore(null); return true; }
      if (tab !== 'home') { setTab('home'); return true; }
      return false;
    });
    return () => sub.remove();
  }, [more, tab]);

  // One way to navigate: pick a tab, optionally a More sub-screen, optionally a month for Expenses.
  const go: Go = (next, options) => { setMore(options?.more ?? null); setFocus(options?.focus); setTab(next); };
  const goTab = (next: TabKey) => go(next);
  const back = () => setMore(null);

  let content;
  if (tab === 'more' && more) {
    content = more === 'investments' ? <InvestmentsScreen onBack={back} />
      : more === 'insurance' ? <InsuranceScreen onBack={back} />
      : more === 'overview' ? <OverviewScreen onBack={back} />
      : <SettingsScreen onBack={back} />;
  } else {
    content = tab === 'home' ? <HomeScreen go={go} />
      : tab === 'expenses' ? <ExpensesScreen key={focus ? `${focus.yearId}:${focus.groupId}` : 'default'} focus={focus} />
      : tab === 'loans' ? <LoansScreen />
      : tab === 'banks' ? <BanksScreen />
      : <MoreScreen open={setMore} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flex: 1 }}>{content}</View>
      <TabBar active={tab} onChange={goTab} />
    </View>
  );
}

function TabBar({ active, onChange }: { active: TabKey; onChange: (tab: TabKey) => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, space.sm) }]} accessibilityRole="tablist">
      {TABS.map((t) => {
        const on = t.key === active;
        return (
          <Pressable key={t.key} onPress={() => onChange(t.key)} style={styles.tab} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={t.label}>
            <View style={[styles.tabPill, on && { backgroundColor: colors.primarySoft }]}>
              <Feather name={t.icon} size={20} color={on ? colors.primary : colors.muted} />
            </View>
            <Text style={[styles.tabLabel, { color: on ? colors.primary : colors.muted }]}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  tabBar: { flexDirection: 'row', backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: space.sm, ...shadow },
  tab: { flex: 1, alignItems: 'center', gap: 2 },
  tabPill: { width: 52, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  tabLabel: { fontSize: 11, fontWeight: '600' },
});
