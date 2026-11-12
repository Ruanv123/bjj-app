import type { User } from '@supabase/supabase-js';

export function getDisplayName(user: User | null): string | null {
  const metadata = user?.user_metadata ?? {};
  const name = metadata.full_name ?? metadata.name;
  return typeof name === 'string' && name.trim() ? name.trim() : null;
}

export function getFirstName(user: User | null): string | null {
  return getDisplayName(user)?.split(/\s+/)[0] ?? null;
}

export function getAvatarUrl(user: User | null): string | null {
  const metadata = user?.user_metadata ?? {};
  const url = metadata.avatar_url ?? metadata.picture;
  return typeof url === 'string' ? url : null;
}

const PROVIDER_NAMES: Record<string, string> = { apple: 'Apple', google: 'Google' };

export function getProviderName(user: User | null): string | null {
  const provider = user?.app_metadata.provider;
  return provider ? (PROVIDER_NAMES[provider] ?? provider) : null;
}
