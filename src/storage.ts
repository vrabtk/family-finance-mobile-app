import * as SecureStore from 'expo-secure-store';
import { MobileSession } from './types';

const SESSION_KEY = 'family_finance_mobile_session';

export async function loadSessionStorage(): Promise<MobileSession | null> {
  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as MobileSession;
  } catch {
    await SecureStore.deleteItemAsync(SESSION_KEY);
    return null;
  }
}

export async function saveSessionStorage(session: MobileSession) {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
}

export async function clearSessionStorage() {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}
