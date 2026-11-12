import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { useUser } from '@/features/auth/auth-provider';

import {
  fetchIsSaved,
  fetchPlaylists,
  fetchSavedVideos,
  fetchVideo,
  searchVideos,
  setSaved,
} from './api';

export const videoKeys = {
  all: ['videos'] as const,
  playlists: () => [...videoKeys.all, 'playlists'] as const,
  search: (term: string) => [...videoKeys.all, 'search', term] as const,
  detail: (id: string) => [...videoKeys.all, 'detail', id] as const,
  saved: (userId: string | undefined) => ['saved', userId] as const,
  savedList: (userId: string | undefined) => [...videoKeys.saved(userId), 'list'] as const,
  isSaved: (userId: string | undefined, videoId: string) =>
    [...videoKeys.saved(userId), 'video', videoId] as const,
};

export function usePlaylists() {
  return useQuery({ queryKey: videoKeys.playlists(), queryFn: fetchPlaylists });
}

export const MIN_SEARCH_LENGTH = 2;

export function useVideoSearch(term: string) {
  const normalized = term.trim();
  return useQuery({
    queryKey: videoKeys.search(normalized),
    queryFn: () => searchVideos(normalized),
    enabled: normalized.length >= MIN_SEARCH_LENGTH,
    placeholderData: keepPreviousData,
  });
}

export function useVideo(id: string) {
  return useQuery({
    queryKey: videoKeys.detail(id),
    queryFn: () => fetchVideo(id),
    enabled: !!id,
  });
}

// ---------- Salvos ----------

export function useSavedVideos() {
  const user = useUser();
  return useQuery({
    queryKey: videoKeys.savedList(user?.id),
    queryFn: fetchSavedVideos,
    enabled: !!user,
  });
}

export function useIsSaved(videoId: string) {
  const user = useUser();
  return useQuery({
    queryKey: videoKeys.isSaved(user?.id, videoId),
    queryFn: () => fetchIsSaved(videoId),
    enabled: !!user,
  });
}

export function useToggleSave(videoId: string) {
  const user = useUser();
  const queryClient = useQueryClient();
  const key = videoKeys.isSaved(user?.id, videoId);

  return useMutation({
    mutationFn: (saved: boolean) => setSaved(videoId, saved),
    // Atualização otimista: o ícone muda na hora; desfaz se o servidor recusar.
    onMutate: async (saved) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<boolean>(key);
      queryClient.setQueryData(key, saved);
      return { previous };
    },
    onError: (_error, _saved, context) => {
      queryClient.setQueryData(key, context?.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: videoKeys.savedList(user?.id) });
    },
  });
}
