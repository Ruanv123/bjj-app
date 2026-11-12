import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';

import { COMMENTS_PAGE_SIZE, createComment, deleteComment, fetchComments } from './api';
import type { Comment } from './types';

export const commentKeys = {
  list: (videoId: string) => ['comments', videoId] as const,
};

type Pages = InfiniteData<Comment[], number>;

export function useComments(videoId: string) {
  return useInfiniteQuery({
    queryKey: commentKeys.list(videoId),
    queryFn: ({ pageParam }) => fetchComments(videoId, pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === COMMENTS_PAGE_SIZE ? allPages.length : undefined,
    select: (data) => data.pages.flat(),
  });
}

export function useAddComment(videoId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => createComment(videoId, body),
    onSuccess: (comment) => {
      // Coloca o novo comentário no topo sem refazer a busca.
      queryClient.setQueryData<Pages>(commentKeys.list(videoId), (data) =>
        data
          ? { ...data, pages: [[comment, ...(data.pages[0] ?? [])], ...data.pages.slice(1)] }
          : data
      );
    },
  });
}

export function useDeleteComment(videoId: string) {
  const queryClient = useQueryClient();
  const key = commentKeys.list(videoId);

  return useMutation({
    mutationFn: deleteComment,
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Pages>(key);
      queryClient.setQueryData<Pages>(key, (data) =>
        data ? { ...data, pages: data.pages.map((p) => p.filter((c) => c.id !== id)) } : data
      );
      return { previous };
    },
    onError: (_error, _id, context) => queryClient.setQueryData(key, context?.previous),
  });
}
