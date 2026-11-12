import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { fetchVideo } from '../api';
import { useVideo, videoKeys } from '../hooks';
import type { Playlist, Video } from '../types';

jest.mock('../api', () => ({ fetchVideo: jest.fn() }));
jest.mock('@/features/auth/auth-provider', () => ({ useUser: jest.fn() }));

it('busca a URL da aula gratuita mesmo com a playlist em cache recente', async () => {
  const video: Video = { id: '1', title: 'Aula', description: '', channel: '', thumbnailUrl: '', videoUrl: null, requiresPremium: false, durationSeconds: null, views: 0, publishedAt: '' };
  const playlist: Playlist = { id: 'p', title: '', description: '', isPremium: false, videos: [video] };
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, retry: false } } });
  client.setQueryData(videoKeys.playlists(), [playlist]);
  jest.mocked(fetchVideo).mockResolvedValue({ ...video, videoUrl: 'https://example.com/video.mp4' });
  const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const { result } = await renderHook(() => useVideo('1'), { wrapper });
  await waitFor(() => expect(result.current.data?.videoUrl).toBe('https://example.com/video.mp4'));
  client.clear();
});
