import { Feather } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BarItem, DEFAULT_PINS, Focus, Go, MoreKey, PinKey, TabKey, activeBarKey, barItems, cleanPins, pinInfo } from './src/navigation';
import { TabsScreen } from './src/screens/TabsScreen';
import { TourScreen } from './src/screens/TourScreen';
import { TourTarget } from './src/tour/context';
import { TourProvider } from './src/tour/TourProvider';
import { loadPrefs, savePrefs } from './src/storage';
import { AuthScreen, ConfigScreen } from './src/screens/AuthScreen';
import { DataScreen } from './src/screens/DataScreen';
import { AnalyticsScreen } from './src/screens/AnalyticsScreen';
import { BanksScreen } from './src/screens/BanksScreen';
import { ExpensesScreen } from './src/screens/ExpensesScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { MoreScreen, SettingsScreen } from './src/screens/MoreScreen';
import { InsuranceScreen, InvestmentsScreen, LoansScreen, OverviewScreen } from './src/screens/resources';
import { useKeyboardHeight } from './src/hooks';
import { FadeIn } from './src/motion';
import { OptionsProvider } from './src/options';
import { ProfileScreen } from './src/screens/ProfileScreen';
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
  return <FadeIn key={workspace?.id ?? 'none'} from={0} style={{ flex: 1 }}><OptionsProvider><Main /></OptionsProvider></FadeIn>;
}

function Main() {
  const { role } = useSession();
  const [tab, setTab] = useState<TabKey>('home');
  const [pins, setPinsState] = useState<PinKey[]>(DEFAULT_PINS);
  useEffect(() => { loadPrefs().then((p) => setPinsState(cleanPins(p.pins))); }, []);
  const setPins = (next: PinKey[]) => { setPinsState(next); loadPrefs().then((p) => savePrefs({ ...p, pins: next })); };
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
  const goRoute = (r: { tab: TabKey; more?: MoreKey }) => go(r.tab, { more: r.more });
  const openFromMore = (dest: PinKey | 'profile' | 'tabs' | 'data' | 'tours') => (dest === 'profile' || dest === 'tabs' || dest === 'data' || dest === 'tours' ? go('more', { more: dest }) : goRoute(pinInfo(dest).route));
  const back = () => setMore(null);

  let content;
  if (tab === 'more' && more) {
    content = more === 'investments' ? <InvestmentsScreen onBack={back} />
      : more === 'insurance' ? <InsuranceScreen onBack={back} />
      : more === 'overview' ? <OverviewScreen onBack={back} />
      : more === 'profile' ? <ProfileScreen onBack={back} />
      : more === 'analytics' ? <AnalyticsScreen onBack={back} />
      : more === 'data' ? <DataScreen onBack={back} />
      : more === 'tours' ? <TourScreen onBack={back} />
      : more === 'tabs' ? <TabsScreen pins={pins} onChange={setPins} onBack={back} />
      : <SettingsScreen onBack={back} />;
  } else {
    content = tab === 'home' ? <HomeScreen go={go} />
      : tab === 'expenses' ? <ExpensesScreen key={focus ? `${focus.yearId}:${focus.groupId}` : 'default'} focus={focus} />
      : tab === 'loans' ? <LoansScreen />
      : tab === 'banks' ? <BanksScreen />
      : <MoreScreen pins={pins} open={openFromMore} />;
  }

  // Android draws edge to edge, so the window no longer resizes for the keyboard: pad the whole
  // app instead, and hide the tab bar while typing so the form keeps the room.
  const keyboard = useKeyboardHeight();
  const typing = keyboard > 0;

  return (
    <TourProvider navigate={goRoute} access={role}>
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingBottom: keyboard }}>
        <View style={{ flex: 1 }}>{content}</View>
        {!typing && <TourTarget id="bar"><TabBar items={barItems(pins)} active={activeBarKey(pins, { tab, more: more ?? undefined })} onChange={goRoute} /></TourTarget>}
      </View>
    </TourProvider>
  );
}

function TabBar({ items, active, onChange }: { items: BarItem[]; active: string; onChange: (route: BarItem['route']) => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, space.sm) }]} accessibilityRole="tablist">
      {items.map((t) => {
        const on = t.key === active;
        return (
          <Pressable key={t.key} onPress={() => onChange(t.route)} style={styles.tab} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={t.label}>
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
