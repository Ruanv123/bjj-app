import type { User } from '@supabase/supabase-js';

import { getAvatarUrl, getDisplayName, getFirstName, getProviderName } from '../utils';

function makeUser(overrides: Partial<User>): User {
  return {
    id: 'u1',
    aud: 'authenticated',
    created_at: '2026-01-01T00:00:00Z',
    app_metadata: {},
    user_metadata: {},
    ...overrides,
  };
}

describe('profile utils', () => {
  it('usa full_name, depois name', () => {
    expect(getDisplayName(makeUser({ user_metadata: { full_name: ' Ana Souza ' } }))).toBe('Ana Souza');
    expect(getDisplayName(makeUser({ user_metadata: { name: 'Bia' } }))).toBe('Bia');
    expect(getDisplayName(makeUser({}))).toBeNull();
    expect(getDisplayName(null)).toBeNull();
  });

  it('extrai o primeiro nome', () => {
    expect(getFirstName(makeUser({ user_metadata: { full_name: 'Ana  Souza' } }))).toBe('Ana');
  });

  it('lê avatar do Google (picture) e formata o provedor', () => {
    const user = makeUser({
      user_metadata: { picture: 'https://example.com/a.png' },
      app_metadata: { provider: 'google' },
    });
    expect(getAvatarUrl(user)).toBe('https://example.com/a.png');
    expect(getProviderName(user)).toBe('Google');
  });
});
