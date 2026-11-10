import { useState } from 'react';
import { Text } from 'react-native';
import { changePassword, updateProfile } from '../api';
import { errorMessage, useSession } from '../session';
import { colors, space, type } from '../theme';
import { Button, Card, ErrorBanner, Field, Screen, SectionTitle } from '../ui';

// Optional number: 7 to 15 digits, a leading + allowed; spaces and dashes are ignored (same rule as the server).
export const phoneProblem = (value: string) => {
  const v = value.trim();
  return !v || /^\+?\d{7,15}$/.test(v.replace(/[\s-]/g, '')) ? '' : 'Enter 7 to 15 digits, or leave it empty.';
};

export function ProfileScreen({ onBack }: { onBack: () => void }) {
  const { session, patchSession } = useSession();
  const user = session?.user;
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [saving, setSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileDone, setProfileDone] = useState('');

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [changing, setChanging] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwDone, setPwDone] = useState('');

  const saveProfile = async () => {
    setProfileDone('');
    if (!name.trim()) { setProfileError('Name cannot be empty.'); return; }
    const bad = phoneProblem(phone);
    if (bad) { setProfileError(bad); return; }
    setSaving(true);
    setProfileError('');
    try {
      const res = await updateProfile({ name: name.trim(), phone: phone.trim() || null });
      await patchSession({ user: { ...user!, ...res.user } });
      setProfileDone('Profile saved.');
    } catch (e) {
      setProfileError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const savePassword = async () => {
    setPwDone('');
    if (!current) { setPwError('Enter your current password.'); return; }
    if (next.length < 8) { setPwError('New password must be at least 8 characters.'); return; }
    if (next !== again) { setPwError('The two new passwords do not match.'); return; }
    setChanging(true);
    setPwError('');
    try {
      const res = await changePassword(current, next);
      await patchSession({ accessToken: res.accessToken, refreshToken: res.refreshToken });
      setCurrent(''); setNext(''); setAgain('');
      setPwDone('Password changed. Other devices were signed out.');
    } catch (e) {
      setPwError(errorMessage(e));
    } finally {
      setChanging(false);
    }
  };

  return (
    <Screen tour="profile" title="My profile" subtitle={user?.email} onBack={onBack}>
      <SectionTitle>Details</SectionTitle>
      <Card>
        <Field label="Name" value={name} onChangeText={setName} autoCapitalize="words" />
        <Field label="Mobile number (optional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+91 98765 43210" />
        <ErrorBanner message={profileError} />
        {!!profileDone && <Text style={[type.small, { color: colors.positive, marginBottom: space.sm }]}>{profileDone}</Text>}
        <Button label="Save changes" icon="check" onPress={saveProfile} loading={saving} />
      </Card>

      <SectionTitle>Password</SectionTitle>
      <Card>
        <Field label="Current password" value={current} onChangeText={setCurrent} secure />
        <Field label="New password" value={next} onChangeText={setNext} secure placeholder="At least 8 characters" />
        <Field label="Repeat new password" value={again} onChangeText={setAgain} secure />
        <ErrorBanner message={pwError} />
        {!!pwDone && <Text style={[type.small, { color: colors.positive, marginBottom: space.sm }]}>{pwDone}</Text>}
        <Button label="Change password" icon="lock" onPress={savePassword} loading={changing} />
      </Card>
    </Screen>
  );
}
