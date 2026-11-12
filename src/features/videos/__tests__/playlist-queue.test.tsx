import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import i18n from '@/lib/i18n';
import { PlaylistQueue } from '../components/playlist-queue';
import type { Playlist, Video } from '../types';

jest.mock('expo-router', () => ({ router: { setParams: jest.fn(), push: jest.fn() } }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}));
jest.mock('react-native-reanimated', () => ({ useReducedMotion: () => false }));
jest.mock('../components/video-thumbnail', () => ({ VideoThumbnail: () => null }));

const video: Video = {
  id: 'first', title: 'Primeira aula', channel: 'Professor', description: '', thumbnailUrl: '',
  videoUrl: null, requiresPremium: false, durationSeconds: 90, views: 0, publishedAt: '2026-01-01',
};
const playlist: Playlist = {
  id: 'track', title: 'Passagens', description: '', isPremium: false,
  videos: [video, { ...video, id: 'second', title: 'Segunda aula' }],
};

beforeEach(async () => {
  jest.clearAllMocks();
  await i18n.changeLanguage('pt');
});

it('abre a fila, destaca a aula atual e troca a aula preservando a playlist', async () => {
  await render(<PlaylistQueue playlist={playlist} videoId="first" />);
  await fireEvent.press(screen.getByRole('button', { name: 'Em seguida. Passagens. 1/2' }));
  expect(screen.getByRole('button', { selected: true })).toBeTruthy();
  expect(screen.getByText('Reproduzindo agora')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Segunda aula. Professor' }));
  expect(router.setParams).toHaveBeenCalledWith({ id: 'second', playlistId: 'track' });
  expect(router.push).not.toHaveBeenCalled();
});

it('fecha a fila sem reiniciar a aula atual', async () => {
  await render(<PlaylistQueue playlist={playlist} videoId="first" />);
  await fireEvent.press(screen.getByRole('button', { name: 'Em seguida. Passagens. 1/2' }));
  await fireEvent.press(screen.getByText('Primeira aula'));
  expect(router.setParams).not.toHaveBeenCalled();
  expect(screen.queryByText('Reproduzindo agora')).toBeNull();
});

it('indica o fim da playlist na última aula', async () => {
  await render(<PlaylistQueue playlist={playlist} videoId="second" />);
  expect(screen.getByText('Fim da playlist')).toBeTruthy();
  expect(screen.getByText('2/2')).toBeTruthy();
});
