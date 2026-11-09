import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { MobileSession } from './types';

const SESSION_KEY = 'family_finance_mobile_session';

function getBrowserStorage(): Storage {
  if (typeof window === 'undefined') {
    throw new Error('Browser storage is unavailable.');
  }

  return window.localStorage;
}

export async function loadSessionStorage(): Promise<MobileSession | null> {
  const raw = Platform.OS === 'web'
    ? getBrowserStorage().getItem(SESSION_KEY)
    : await SecureStore.getItemAsync(SESSION_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as MobileSession;
  } catch {
    if (Platform.OS === 'web') {
      getBrowserStorage().removeItem(SESSION_KEY);
    } else {
      await SecureStore.deleteItemAsync(SESSION_KEY);
    }
    return null;
  }
}

export async function saveSessionStorage(session: MobileSession) {
  if (Platform.OS === 'web') {
    getBrowserStorage().setItem(SESSION_KEY, JSON.stringify(session));
  } else {
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
  }
}

// Small per-device preferences (not secret), e.g. which tabs are pinned. Never throws.
const PREFS_KEY = 'family_finance_mobile_prefs';
export async function loadPrefs(): Promise<Record<string, unknown>> {
  try {
    const raw = Platform.OS === 'web' ? getBrowserStorage().getItem(PREFS_KEY) : await SecureStore.getItemAsync(PREFS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}
export async function savePrefs(prefs: Record<string, unknown>) {
  try {
    if (Platform.OS === 'web') getBrowserStorage().setItem(PREFS_KEY, JSON.stringify(prefs));
    else await SecureStore.setItemAsync(PREFS_KEY, JSON.stringify(prefs));
  } catch { /* a preference that cannot be saved is not worth an error */ }
}

export async function clearSessionStorage() {
  if (Platform.OS === 'web') {
    getBrowserStorage().removeItem(SESSION_KEY);
  } else {
    await SecureStore.deleteItemAsync(SESSION_KEY);
  }
}
