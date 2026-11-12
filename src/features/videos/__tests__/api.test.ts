import { sanitizeSearchTerm } from '../api';
import { mapVideo } from '../types';

// O jest "iça" o mock para antes dos imports.
jest.mock('@/lib/supabase', () => ({ supabase: {} }));

describe('sanitizeSearchTerm', () => {
  it('remove caracteres especiais do filtro do PostgREST', () => {
    expect(sanitizeSearchTerm('bunny,title.eq.x')).toBe('bunny title eq x');
    expect(sanitizeSearchTerm('  100% (teste)  ')).toBe('100 teste');
    expect(sanitizeSearchTerm('***')).toBe('');
  });

  it('mantém acentos e espaços simples', () => {
    expect(sanitizeSearchTerm('Flor em   câmera')).toBe('Flor em câmera');
  });
});

describe('mapVideo', () => {
  it('converte snake_case do banco para o modelo do app', () => {
    expect(
      mapVideo({
        id: 'v1',
        title: 'T',
        description: 'D',
        channel: 'C',
        thumbnail_url: 'https://t',
        requires_premium: true,
        source: { url: 'https://v' },
        duration_seconds: null,
        views: '42' as unknown as number, // bigint chega como string em alguns casos
        published_at: '2026-01-01T00:00:00Z',
      })
    ).toEqual({
      id: 'v1',
      title: 'T',
      description: 'D',
      channel: 'C',
      thumbnailUrl: 'https://t',
      videoUrl: 'https://v',
      requiresPremium: true,
      durationSeconds: null,
      views: 42,
      publishedAt: '2026-01-01T00:00:00Z',
    });
  });

  it('sem fonte (bloqueado ou lista), videoUrl é null', () => {
    const video = mapVideo({
      id: 'v1',
      title: 'T',
      description: '',
      channel: 'C',
      thumbnail_url: 'https://t',
      requires_premium: true,
      source: null,
      duration_seconds: 60,
      views: 0,
      published_at: '2026-01-01T00:00:00Z',
    });
    expect(video.videoUrl).toBeNull();
  });
});
