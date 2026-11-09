import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { listMembers, removeMember, updateMember } from '../api';
import { useAsync } from '../hooks';
import { errorMessage } from '../session';
import { colors, space, type } from '../theme';
import type { Member, Role } from '../types';
import { Badge, Button, Card, Chips, ConfirmSheet, ErrorBanner, Loading, Sheet } from '../ui';

const ROLE_OPTIONS = [{ value: 'viewer' as Role, label: 'Viewer' }, { value: 'member' as Role, label: 'Member' }, { value: 'admin' as Role, label: 'Admin' }];

// Everyone sees who is in the workspace; admins open a member to change access, block or remove them.
export function MembersCard({ workspaceId, myId, isAdmin }: { workspaceId: string; myId?: string; isAdmin: boolean }) {
  const { data, loading, error, refetch } = useAsync(() => listMembers(workspaceId), [workspaceId]);
  const [picked, setPicked] = useState<Member | null>(null);

  if (loading) return <Loading />;
  return (
    <>
      <ErrorBanner message={error} onRetry={refetch} />
      <Card style={{ padding: 0 }}>
        {(data ?? []).map((m, i) => {
          const editable = isAdmin && !m.isOwner && m.userId !== myId;
          return (
            <Pressable key={m.userId} disabled={!editable} onPress={() => setPicked(m)} accessibilityRole={editable ? 'button' : undefined}
              accessibilityLabel={`${m.name}, ${m.role}${m.blocked ? ', blocked' : ''}`} style={[styles.row, i > 0 && styles.divider]}>
              <View style={{ flex: 1 }}>
                <Text style={type.body} numberOfLines={1}>{m.name}{m.userId === myId ? ' (you)' : ''}</Text>
                <Text style={type.small} numberOfLines={1}>{m.email}</Text>
              </View>
              {m.isOwner && <Badge label="owner" tone="info" />}
              {m.blocked ? <Badge label="blocked" tone="negative" /> : <Badge label={m.role} tone={m.role === 'admin' ? 'primary' : 'neutral'} />}
            </Pressable>
          );
        })}
      </Card>
      {picked && <MemberSheet workspaceId={workspaceId} member={picked} onClose={() => setPicked(null)} onChanged={() => { setPicked(null); refetch(); }} />}
    </>
  );
}

function MemberSheet({ workspaceId, member, onClose, onChanged }: { workspaceId: string; member: Member; onClose: () => void; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState(false);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try { await action(); onChanged(); } catch (e) { setError(errorMessage(e)); setBusy(false); setRemoving(false); }
  };

  return (
    <>
      <Sheet visible={!removing} title={member.name} onClose={onClose}>
        <Text style={[type.small, { marginBottom: space.md }]}>{member.email}</Text>
        <Chips label="Access" options={ROLE_OPTIONS} value={member.role} onChange={(role) => run(() => updateMember(workspaceId, member.userId, { role }))} />
        <ErrorBanner message={error} />
        <Button label={member.blocked ? 'Unblock access' : 'Block access'} icon={member.blocked ? 'unlock' : 'slash'} variant="secondary" loading={busy}
          onPress={() => run(() => updateMember(workspaceId, member.userId, { blocked: !member.blocked }))} />
        <Button label="Remove from workspace" icon="user-x" variant="danger" onPress={() => setRemoving(true)} disabled={busy} style={{ marginTop: space.sm }} />
      </Sheet>
      <ConfirmSheet visible={removing} title="Remove member?" message={`${member.name} will lose access to this workspace. Their entries stay.`}
        onConfirm={() => run(() => removeMember(workspaceId, member.userId))} onClose={() => setRemoving(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.md },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
});
