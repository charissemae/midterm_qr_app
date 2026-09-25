import { supabase } from './supabase';

export type Role = 'student' | 'teacher';

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
};

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as Profile;
}

export async function ensureProfile(
  userId: string,
  email?: string | null
): Promise<{ error: string | null }> {
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (data) return { error: null };

  // Row missing (karaan nga account / signup trigger miss): create it with the
  // DB default role so the account works instead of being stuck as "unknown".
  const { error } = await supabase
    .from('profiles')
    .insert({ id: userId, email: email ?? null, role: 'student' });

  if (error && error.code === '23505') return { error: null };
  return { error: error?.message ?? null };
}

export async function updateProfile(
  userId: string,
  updates: { full_name?: string; role?: Role }
): Promise<{ error: string | null }> {
  const { data: updated, error: updateError } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select('id');

  if (updateError) {
    return { error: updateError.message };
  }

  if (updated && updated.length > 0) {
    return { error: null };
  }

  // No profile row exists yet (e.g. the signup trigger missed, or the account
  // was created before it was added). Create it now so the role/name always
  // sticks instead of silently updating nothing.
  const { error: insertError } = await supabase
    .from('profiles')
    .insert({ id: userId, ...updates });

  return { error: insertError?.message ?? null };
}
