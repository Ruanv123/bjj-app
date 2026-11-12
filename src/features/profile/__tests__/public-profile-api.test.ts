import { supabase } from '@/lib/supabase';

import { fetchPublicProfile } from '../api';

jest.mock('@/lib/supabase', () => ({ supabase: { rpc: jest.fn() } }));
jest.mock('@/features/notifications/push', () => ({ unregisterPushAsync: jest.fn() }));

const targetId = 'f0000000-0000-4000-8000-000000000002';
const rpc = jest.mocked(supabase.rpc);

beforeEach(() => jest.clearAllMocks());

describe('consulta do perfil social', () => {
  it('mapeia a identidade do alvo e expõe somente os campos do perfil social', async () => {
    rpc.mockResolvedValue({
      data: [
        {
          id: targetId,
          display_name: 'Bia',
          avatar_url: null,
          bio: 'Judoca',
          instagram: 'bia',
          belt: 'black',
          belt_degree: 2,
          disciplines: ['gi', 'judo', 'boxing'],
          competitions: [{ name: 'Open', year: 2024, result: 'gold' }],
          avatar_path: 'private/path',
          email: 'private@example.com',
        },
      ],
      error: null,
      count: null,
      status: 200,
      statusText: 'OK',
      success: true,
    });
    const profile = await fetchPublicProfile(targetId);
    expect(rpc).toHaveBeenCalledWith('get_athlete_profile', { p_user_id: targetId });
    expect(profile).toEqual({
      id: targetId,
      displayName: 'Bia',
      avatarUrl: null,
      bio: 'Judoca',
      instagram: 'bia',
      belt: 'black',
      beltDegree: 2,
      disciplines: ['gi', 'judo'],
      competitions: [{ name: 'Open', year: 2024, result: 'gold' }],
    });
  });

  it('trata perfil inexistente ou bloqueado como indisponível', async () => {
    rpc.mockResolvedValue({
      data: [],
      error: null,
      count: null,
      status: 200,
      statusText: 'OK',
      success: true,
    });
    expect(await fetchPublicProfile(targetId)).toBeNull();
  });

  it('não consulta ids inválidos', async () => {
    expect(await fetchPublicProfile('not-a-user')).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('preserva falhas de rede para permitir uma nova tentativa', async () => {
    rpc.mockRejectedValue(new Error('network'));
    await expect(fetchPublicProfile(targetId)).rejects.toThrow('network');
  });
});
