import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { DataApi } from '../data/api';
import { createSupabaseApi } from '../data/supabaseApi';
import { createDemoApi } from '../data/demoApi';

type Session =
  | { kind: 'none' }
  | { kind: 'demo' }
  | { kind: 'user'; userId: string; email: string };

interface SessionCtx {
  ready: boolean;
  session: Session;
  api: DataApi | null;
  signIn(email: string, password: string): Promise<void>;
  /** Returns true when email confirmation is required before signing in. */
  signUp(email: string, password: string, displayName: string): Promise<boolean>;
  signOut(): Promise<void>;
  enterDemo(): void;
}

const Ctx = createContext<SessionCtx | null>(null);

/**
 * Real authentication is delegated entirely to Supabase Auth (passwords never
 * touch our storage; the SDK keeps only its own session tokens). Demo mode is
 * NOT a login — it's an unauthenticated preview with in-memory sample data.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!supabase);
  const [session, setSession] = useState<Session>({ kind: 'none' });

  useEffect(() => {
    if (!supabase) return;
    const apply = (s: { user: { id: string; email?: string } } | null) =>
      setSession((prev) =>
        s ? { kind: 'user', userId: s.user.id, email: s.user.email ?? '' } : prev.kind === 'demo' ? prev : { kind: 'none' },
      );
    supabase.auth.getSession().then(({ data }) => { apply(data.session); setReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => apply(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const userId = session.kind === 'user' ? session.userId : null;
  const api = useMemo<DataApi | null>(() => {
    if (session.kind === 'demo') return createDemoApi();
    if (userId && supabase) return createSupabaseApi(supabase, userId);
    return null;
  }, [session.kind, userId]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Supabase is not configured');
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
  }, []);

  const signUp = useCallback(async (email: string, password: string, displayName: string) => {
    if (!supabase) throw new Error('Supabase is not configured');
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(), password,
      options: { data: { display_name: displayName.trim() }, emailRedirectTo: window.location.origin },
    });
    if (error) throw error;
    return !data.session;
  }, []);

  const signOut = useCallback(async () => {
    if (session.kind === 'demo') { setSession({ kind: 'none' }); return; }
    await supabase?.auth.signOut();
    setSession({ kind: 'none' });
  }, [session.kind]);

  const enterDemo = useCallback(() => setSession({ kind: 'demo' }), []);

  const value = useMemo(
    () => ({ ready, session, api, signIn, signUp, signOut, enterDemo }),
    [ready, session, api, signIn, signUp, signOut, enterDemo],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useSession must be used inside SessionProvider');
  return c;
}

/** For pages rendered inside the authenticated shell, where api is guaranteed. */
export function useApi(): DataApi {
  const { api } = useSession();
  if (!api) throw new Error('No active session');
  return api;
}
