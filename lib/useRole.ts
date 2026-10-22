import { useEffect, useState } from 'react';

import { useAuth } from './auth';
import { getProfile, type Role } from './profiles';

export type RoleState = {
  role: Role | null;
  loading: boolean;
};

let cachedRole: { userId: string; role: Role } | null = null;
const listeners = new Set<() => void>();

export function invalidateCachedRole() {
  cachedRole = null;
  listeners.forEach((l) => l());
}

const MAX_TRIES = 4;
const RETRY_DELAY_MS = 700;

// Centralized role lookup used by every screen that gates on teacher vs
// student. Cache is keyed by user id so switching accounts never leaks an old
// role. invalidateCachedRole() re-fetches immediately on every subscriber.
//
// IMPORTANT: a null/unresolved role is NEVER cached. The profile row can lag
// behind signup (trigger race) or a read can return nothing transiently; if we
// cached that, the account would be stuck as "student" forever (Teacher tab
// locked, Scan visible). We retry briefly instead, then fall back to
// "student" with the cache still empty so the next mount re-tries.
export function useRole(): RoleState {
  const { user } = useAuth();
  const [state, setState] = useState<RoleState>(() => ({
    role: cachedRole && cachedRole.userId === user?.id ? cachedRole.role : null,
    loading: cachedRole?.userId !== user?.id,
  }));

  useEffect(() => {
    if (!user) {
      setState({ role: null, loading: false });
      return;
    }

    let active = true;
    let tries = 0;

    const load = () => {
      if (!active) return;
      tries += 1;
      setState((s) => ({ ...s, loading: true }));
      getProfile(user.id)
        .then((profile) => {
          if (!active) return;
          if (profile?.role) {
            cachedRole = { userId: user.id, role: profile.role };
            setState({ role: profile.role, loading: false });
            return;
          }
          if (tries < MAX_TRIES) {
            setTimeout(load, RETRY_DELAY_MS);
          } else {
            setState((s) => ({ ...s, loading: false }));
          }
        })
        .catch(() => {
          if (!active) return;
          if (tries < MAX_TRIES) {
            setTimeout(load, RETRY_DELAY_MS);
          } else {
            setState((s) => ({ ...s, loading: false }));
          }
        });
    };

    if (cachedRole?.userId === user.id) {
      setState({ role: cachedRole.role, loading: false });
    } else {
      load();
    }

    const onInvalidate = () => {
      if (!active) return;
      if (cachedRole?.userId === user.id) {
        setState({ role: cachedRole.role, loading: false });
      } else {
        tries = 0;
        load();
      }
    };
    listeners.add(onInvalidate);

    return () => {
      active = false;
      listeners.delete(onInvalidate);
    };
  }, [user]);

  return state;
}