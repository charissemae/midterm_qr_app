import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase';
import type { Session, User } from '@supabase/supabase-js';

type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
};

type AuthContextValue = AuthState;

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  loading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // getSession() can hang on React Native (custom storage / token refresh
    // edge cases). The watchdog guarantees loading never blocks the UI forever.
    const watchdog = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 3000);

    supabase.auth
      .getSession()
      .then(({ data }) => {
        clearTimeout(watchdog);
        if (!mounted) return;
        setSession(data.session);
        setLoading(false);
      })
      .catch(() => {
        clearTimeout(watchdog);
        if (mounted) setLoading(false);
      });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      mounted = false;
      clearTimeout(watchdog);
      sub.subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}

export type SignUpProfile = {
  full_name: string;
  role: 'student' | 'teacher';
};

export async function signUp(
  email: string,
  password: string,
  profile?: SignUpProfile
) {
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (!error && data.session && profile) {
    // The signup trigger creates the profile row; fill in the name and role
    // the user chose. Right after signUp() the supabase client may not have
    // attached the session yet on React Native, so requests via the client
    // would be sent unauthenticated and RLS would silently skip them. PATCH
    // the row directly with the returned access_token instead — guaranteed
    // authenticated.
    const userId = data.session.user.id;
    const accessToken = data.session.access_token;
    const userEmail = data.session.user.email;

    let profileError: string | null = null;
    // Mobile networks drop connections. The account already exists, so retry
    // a couple of times before giving up.
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, 800));
      }
      try {
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`,
          {
            method: 'PATCH',
            headers: {
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
              Prefer: 'return=minimal',
            },
            body: JSON.stringify({
              full_name: profile.full_name,
              role: profile.role,
            }),
          }
        );
        if (res.ok) {
          profileError = null;
          break;
        }
        profileError =
          res.status >= 400 && res.status < 600
            ? `HTTP ${res.status}`
            : 'unknown error';
      } catch (err: any) {
        profileError = err?.message ?? 'network error';
      }
    }

    // If the profile row does not exist (signup trigger missing/raced), the
    // PATCH updates nothing and can even 404. Fall back to a merge-duplicates
    // insert so the chosen role+name is stored no matter what.
    if (profileError) {
      try {
        const upsert = await fetch(
          `${SUPABASE_URL}/rest/v1/profiles?on_conflict=id`,
          {
            method: 'POST',
            headers: {
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
              Prefer: 'resolution=merge-duplicates,return=minimal',
            },
            body: JSON.stringify({
              id: userId,
              email: userEmail,
              full_name: profile.full_name,
              role: profile.role,
            }),
          }
        );
        if (upsert.ok) {
          profileError = null;
        }
      } catch {
        // keep the original profileError
      }
    }

    // Surface profile-saving failures instead of silently keeping the
    // trigger's default 'student' row.
    if (profileError) {
      return {
        data,
        error: {
          message: `Account created, but saving your name/role failed (${profileError}). You can still sign in and update your name in the Profile tab.`,
        },
      };
    }
  }

  return { data, error };
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { data, error };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}