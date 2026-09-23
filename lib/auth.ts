import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';

type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
};

let globalSession: Session | null = null;
let globalUser: User | null = null;
let globalLoading = true; 
let listeners: Set<() => void> = new Set();

function notify() {
  listeners.forEach((l) => l());
}

export function setAuth(session: Session | null) {
  globalSession = session;
  globalUser = session?.user ?? null;
  globalLoading = false;
  notify();
}

function handleAuthChange(event: AuthChangeEvent, session: Session | null) {
  if (session) {
    setAuth(session);
    return;
  }

  if (event === 'SIGNED_OUT') {
    setAuth(null);
    return;
  }

  // INITIAL_SESSION / TOKEN_REFRESHED etc. can resolve with a null session
  // shortly after app start. If the user already signed in by then, do not
  // wipe their session (that would bounce them straight back to login).
  if (!globalSession) {
    setAuth(null);
  }
}

supabase.auth.onAuthStateChange(handleAuthChange);

// getSession() can hang on React Native (custom storage / token refresh
// edge cases). Watchdog guarantees loading never blocks the UI forever.
const RESTORE_TIMEOUT_MS = 3000;

function finishRestore() {
  if (globalLoading) {
    setAuth(globalSession);
  }
}

const restoreDeadline = setTimeout(finishRestore, RESTORE_TIMEOUT_MS);

supabase.auth
  .getSession()
  .then(({ data }) => {
    clearTimeout(restoreDeadline);
    if (data.session) {
      setAuth(data.session);
    } else if (!globalSession) {
      setAuth(null);
    }
  })
  .catch(() => {
    clearTimeout(restoreDeadline);
    setAuth(null);
  });

export function useAuth(): AuthState {
  const [, setTick] = useState(0);

  useEffect(() => {
    const listener = () => setTick((t) => t + 1);
    listeners.add(listener);
    return () => { 
      listeners.delete(listener); 
    };
  }, []);

  return {
    session: globalSession,
    user: globalUser,
    loading: globalLoading,
  };
}

export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (!error && data.session) {
    setAuth(data.session);
  }
  return { data, error };
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (!error && data.session) {
    setAuth(data.session);
  }
  return { data, error };
}

export async function signOut() {
  setAuth(null);
  // Fire-and-forget: waiting for the server on mobile can hang (see docs).
  supabase.auth.signOut().catch(() => {});
  return { error: null };
}
