import { supabase } from '@/lib/supabase';

import { fetchFeed, publishPost } from '../api';
import { applyLike } from '../hooks';
import { mapPost, postBodySchema, type PostRow } from '../types';

jest.mock('@/lib/supabase', () => ({ supabase: { rpc: jest.fn() } }));
jest.mock('@/features/auth/auth-provider', () => ({ useUser: () => null }));
const rpc = jest.mocked(supabase.rpc);
const id = 'e0000000-0000-4000-8000-000000000001';
const row: PostRow = {
  id,
  author_id: id,
  parent_id: null,
  body: 'Oss!',
  created_at: '2026-01-01T00:00:00Z',
  edited_at: null,
  author_name: 'Ana',
  author_avatar_url: null,
  author_belt: 'blue',
  author_belt_degree: 2,
  like_count: '12',
  reply_count: '3',
  liked: false,
};
const response = (data: unknown) => ({
  data,
  error: null,
  count: null,
  status: 200,
  statusText: 'OK',
  success: true as const,
});
beforeEach(() => jest.clearAllMocks());

describe('feed', () => {
  it('valida o texto e mantém quebras de linha internas', () => {
    expect(postBodySchema.parse('  Um treino.\nUma conquista.  ')).toBe(
      'Um treino.\nUma conquista.'
    );
    expect(postBodySchema.safeParse('\n\t ').success).toBe(false);
    expect(postBodySchema.safeParse('x'.repeat(501)).success).toBe(false);
    expect(postBodySchema.safeParse('x'.repeat(500)).success).toBe(true);
  });
  it('converte contadores bigint e mantém o grau do autor', () => {
    expect(mapPost(row)).toMatchObject({
      authorBelt: 'blue',
      authorBeltDegree: 2,
      likeCount: 12,
      replyCount: 3,
    });
  });
  it('usa cursor de data e id para não repetir posts com o mesmo horário', async () => {
    rpc.mockResolvedValue(response([row]));
    await fetchFeed({ following: true }, { createdAt: row.created_at, id });
    expect(rpc).toHaveBeenCalledWith(
      'list_social_posts',
      expect.objectContaining({
        p_following: true,
        p_before_at: row.created_at,
        p_before_id: id,
        p_parent_id: null,
      })
    );
  });
  it('publica respostas no post correto sem aceitar um autor no payload', async () => {
    rpc.mockResolvedValue(response(id));
    await publishPost({ body: '  Oss!  ', parentId: id });
    expect(rpc).toHaveBeenCalledWith('create_social_post', { p_body: 'Oss!', p_parent_id: id });
  });
  it('edita pelo RPC de edição sem criar uma segunda publicação', async () => {
    rpc.mockResolvedValue(response(null));
    expect(await publishPost({ body: 'Editado', editId: id })).toBe(id);
    expect(rpc).toHaveBeenCalledWith('edit_social_post', { p_body: 'Editado', p_post_id: id });
  });
  it('não envia textos inválidos ao servidor', async () => {
    await expect(publishPost({ body: '   ' })).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });
  it('aplica a curtida otimista de forma idempotente', () => {
    const post = mapPost({ ...row, like_count: 0 });
    const liked = applyLike(post, id, true);
    expect(liked.likeCount).toBe(1);
    expect(applyLike(liked, id, true).likeCount).toBe(1);
    expect(applyLike(liked, id, false).likeCount).toBe(0);
    expect(applyLike(post, 'another-id', true)).toBe(post);
  });
});
