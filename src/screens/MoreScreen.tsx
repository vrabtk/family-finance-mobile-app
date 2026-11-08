import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { API_BASE_URL } from '../config';
import { deleteAccount, inviteMember } from '../api';
import { errorMessage, useSession } from '../session';
import { colors, radius, space, type } from '../theme';
import { Badge, Button, Card, Chips, ErrorBanner, Field, IconName, Screen, SectionTitle, Sheet } from '../ui';
import type { MoreKey } from '../navigation';

const LINKS: Array<{ key: MoreKey; label: string; hint: string; icon: IconName }> = [
  { key: 'investments', label: 'Investments', hint: 'Gold, deposits, stocks, funds', icon: 'trending-up' },
  { key: 'insurance', label: 'Insurance', hint: 'Policies, premiums, due dates', icon: 'shield' },
  { key: 'overview', label: 'Monthly overview', hint: 'Income, bills and savings', icon: 'layers' },
  { key: 'settings', label: 'Workspace & members', hint: 'Switch workspace, invite people', icon: 'users' },
];

export function MoreScreen({ open }: { open: (key: MoreKey) => void }) {
  const { session, workspace, signOut } = useSession();
  const [deleting, setDeleting] = useState(false);
  return (
    <Screen title="More">
      <Card style={styles.profile}>
        <View style={styles.avatar}><Text style={styles.avatarLabel}>{session?.user.name?.[0]?.toUpperCase() ?? '?'}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={type.heading} numberOfLines={1}>{session?.user.name}</Text>
          <Text style={type.small} numberOfLines={1}>{session?.user.email}</Text>
          <Text style={[type.small, { marginTop: 2 }]} numberOfLines={1}>{workspace?.name}{workspace?.role ? ` · ${workspace.role}` : ''}</Text>
        </View>
      </Card>

      <Card style={{ padding: 0 }}>
        {LINKS.map((l, i) => (
          <Pressable key={l.key} onPress={() => open(l.key)} style={[styles.link, i > 0 && styles.divider]} accessibilityRole="button">
            <View style={styles.linkIcon}><Feather name={l.icon} size={18} color={colors.primary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={type.body}>{l.label}</Text>
              <Text style={type.small}>{l.hint}</Text>
            </View>
            <Feather name="chevron-right" size={20} color={colors.muted} />
          </Pressable>
        ))}
      </Card>

      <Button label="Sign out" icon="log-out" variant="secondary" onPress={signOut} />
      <Button label="Delete account" icon="trash-2" variant="ghost" onPress={() => setDeleting(true)} />
      {deleting && <DeleteAccountSheet onClose={() => setDeleting(false)} />}
      <Text style={[type.small, { textAlign: 'center' }]} numberOfLines={1}>Server: {API_BASE_URL}</Text>
    </Screen>
  );
}

// Asks for the password, deletes the account on the server, then signs out on this device.
export function DeleteAccountSheet({ onClose }: { onClose: () => void }) {
  const { signOut } = useSession();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const confirm = async () => {
    setBusy(true);
    setError('');
    try {
      await deleteAccount(password);
      await signOut();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <Sheet visible title="Delete your account?" onClose={onClose}>
      <Text style={[type.body, { marginBottom: space.sm }]}>This permanently deletes your account and cannot be undone.</Text>
      <Text style={[type.small, { marginBottom: space.md }]}>
        Workspaces only you belong to are deleted with all their expenses, loans, banks and other data. In a workspace shared with others, ownership passes to another admin and the data stays for them.
      </Text>
      <Field label="Enter your password to confirm" value={password} onChangeText={setPassword} secure placeholder="Your password" />
      <ErrorBanner message={error} />
      <View style={{ flexDirection: 'row', gap: space.md, marginTop: space.sm }}>
        <Button label="Cancel" variant="secondary" onPress={onClose} disabled={busy} style={{ flex: 1 }} />
        <Button label="Delete my account" variant="danger" onPress={confirm} loading={busy} disabled={!password} style={{ flex: 2 }} />
      </View>
    </Sheet>
  );
}

export function SettingsScreen({ onBack }: { onBack: () => void }) {
  const { session, workspace, isAdmin, switchWorkspace } = useSession();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'viewer' | 'member' | 'admin'>('member');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  const invite = async () => {
    if (!workspace || !email.trim()) { setError('Enter the email of someone who already has an account.'); return; }
    setBusy(true);
    setError('');
    setDone('');
    try {
      await inviteMember(workspace.id, email.trim(), role);
      setDone(`${email.trim()} added as ${role}.`);
      setEmail('');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Workspace" subtitle="Switch workspace and manage members" onBack={onBack}>
      <SectionTitle>Your workspaces</SectionTitle>
      <Card style={{ padding: 0 }}>
        {session?.workspaces.map((w, i) => {
          const active = w.id === workspace?.id;
          return (
            <Pressable key={w.id} onPress={() => switchWorkspace(w.id)} style={[styles.link, i > 0 && styles.divider]} accessibilityRole="radio" accessibilityState={{ selected: active }}>
              <View style={{ flex: 1 }}>
                <Text style={type.body}>{w.name}</Text>
                <Text style={type.small}>{w.type}</Text>
              </View>
              {w.role && <Badge label={w.role} tone={w.role === 'admin' ? 'primary' : 'neutral'} />}
              <Feather name={active ? 'check-circle' : 'circle'} size={20} color={active ? colors.primary : colors.borderStrong} />
            </Pressable>
          );
        })}
      </Card>

      <SectionTitle>Invite a member</SectionTitle>
      {isAdmin ? (
        <Card>
          <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" placeholder="They must sign up first" />
          <Chips
            label="Access"
            options={[{ value: 'viewer', label: 'Viewer' }, { value: 'member', label: 'Member' }, { value: 'admin', label: 'Admin' }]}
            value={role}
            onChange={setRole}
          />
          <Text style={[type.small, { marginBottom: space.md }]}>Viewers can read, members can add and edit, admins can also delete.</Text>
          <ErrorBanner message={error} />
          {!!done && <Text style={[type.small, { color: colors.positive, marginBottom: space.sm }]}>{done}</Text>}
          <Button label="Add to workspace" icon="user-plus" onPress={invite} loading={busy} />
        </Card>
      ) : (
        <Card><Text style={type.small}>Only workspace admins can invite people.</Text></Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarLabel: { color: colors.primary, fontSize: 22, fontWeight: '800' },
  link: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  linkIcon: { width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
});
