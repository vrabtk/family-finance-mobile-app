import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, bindAuth, getWorkspaces, login, logoutRemote, signup } from './api';
import { Platform } from 'react-native';
import { API_BASE_URL, HAS_API_CONFIG } from './config';
import { clearSessionStorage, loadSessionStorage, saveSessionStorage } from './storage';
import type { MobileSession, Role, Workspace } from './types';

type Status = 'loading' | 'config' | 'signedOut' | 'ready';

type SessionContext = {
  status: Status;
  session: MobileSession | null;
  workspace: Workspace | null;
  role: Role;
  canWrite: boolean; // member or admin
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  switchWorkspace: (id: string) => Promise<void>;
  patchSession: (change: Partial<MobileSession>) => Promise<void>; // e.g. new name or tokens after a profile change
};

const Ctx = createContext<SessionContext | null>(null);

export const useSession = () => {
  const value = useContext(Ctx);
  if (!value) throw new Error('useSession must be used inside SessionProvider');
  return value;
};

const withActiveWorkspace = (s: MobileSession): MobileSession => ({
  ...s,
  activeWorkspaceId: s.workspaces.some((x) => x.id === s.activeWorkspaceId) ? s.activeWorkspaceId : s.workspaces[0]?.id ?? null,
});

// Login returns `workspaces`; signup returns a single `workspace`.
const fromAuthResponse = (data: any): MobileSession => {
  const workspaces: Workspace[] = data.workspaces || (data.workspace ? [{ ...data.workspace, role: 'admin' }] : []);
  return withActiveWorkspace({
    user: data.user,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    workspaces,
    activeWorkspaceId: workspaces[0]?.id ?? null,
  });
};

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [session, setSessionState] = useState<MobileSession | null>(null);
  const ref = useRef<MobileSession | null>(null);

  // Single place that keeps memory, React state and secure storage in step.
  const commit = useCallback(async (next: MobileSession | null) => {
    ref.current = next;
    setSessionState(next);
    if (next) {
      await saveSessionStorage(next);
      setStatus('ready');
    } else {
      await clearSessionStorage();
      setStatus('signedOut');
    }
  }, []);

  useEffect(() => {
    bindAuth({ get: () => ref.current, set: commit });
    return () => bindAuth(null);
  }, [commit]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!HAS_API_CONFIG) { setStatus('config'); return; }
      const stored = await loadSessionStorage();
      if (!stored) { if (alive) setStatus('signedOut'); return; }
      ref.current = stored;
      try {
        // Also proves the token works (api.ts refreshes it if it expired).
        const workspaces = await getWorkspaces();
        if (alive) await commit(withActiveWorkspace({ ...ref.current!, workspaces }));
      } catch {
        if (alive) await commit(null);
      }
    })();
    return () => { alive = false; };
  }, [commit]);

  const signIn = useCallback(async (email: string, password: string) => {
    await commit(fromAuthResponse(await login(email, password)));
  }, [commit]);

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    await commit(fromAuthResponse(await signup(name, email, password)));
  }, [commit]);

  const signOut = useCallback(async () => {
    const current = ref.current;
    if (current) { try { await logoutRemote(current.refreshToken); } catch { /* offline or expired: still sign out locally */ } }
    await commit(null);
  }, [commit]);

  const switchWorkspace = useCallback(async (id: string) => {
    if (ref.current) await commit({ ...ref.current, activeWorkspaceId: id });
  }, [commit]);

  const patchSession = useCallback(async (change: Partial<MobileSession>) => {
    if (ref.current) await commit({ ...ref.current, ...change });
  }, [commit]);

  const value = useMemo<SessionContext>(() => {
    const workspace = session?.workspaces.find((x) => x.id === session.activeWorkspaceId) ?? null;
    const role: Role = workspace?.role ?? 'viewer';
    return { status, session, workspace, role, canWrite: role !== 'viewer', isAdmin: role === 'admin', signIn, signUp, signOut, switchWorkspace, patchSession };
  }, [status, session, signIn, signUp, signOut, switchWorkspace, patchSession]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const errorMessage = (error: unknown, fallback = 'Something went wrong. Please try again.'): string => {
  if (error instanceof ApiError) return error.message;
  const message = (error as Error)?.message || '';
  if (message.includes('Network request failed') || message.includes('Failed to fetch')) {
    // On a phone/emulator "localhost" is the device itself, the most common setup mistake.
    const loopback = Platform.OS !== 'web' && /\/\/(localhost|127\.0\.0\.1)[:/]/.test(API_BASE_URL);
    return `Cannot reach the server at ${API_BASE_URL}.${loopback ? " On a phone, localhost is the phone itself: use your computer's LAN IP (10.0.2.2 on the Android emulator)." : ' Check that the backend is running and the address is correct.'}`;
  }
  return message || fallback;
};
