import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';

import { useUser } from '@/features/auth/auth-provider';

import {
  deletePost,
  fetchFeed,
  fetchPost,
  fetchSocialStats,
  publishPost,
  reportPost,
  setFollow,
  setPostLike,
} from './api';
import { FEED_PAGE_SIZE, validPostId, type FeedFilter, type Post, type PostCursor } from './types';

export const feedKeys = {
  root: ['social'] as const,
  lists: ['social', 'list'] as const,
  list: (viewerId: string | undefined, filter: FeedFilter) =>
    ['social', 'list', viewerId, filter] as const,
  post: (viewerId: string | undefined, id: string | undefined) =>
    ['social', 'post', viewerId, id] as const,
  stats: (viewerId: string | undefined, id: string) => ['social', 'stats', viewerId, id] as const,
};
export function useFeed(filter: FeedFilter = {}, enabled = true) {
  const user = useUser();
  return useInfiniteQuery({
    queryKey: feedKeys.list(user?.id, filter),
    queryFn: ({ pageParam }) => fetchFeed(filter, pageParam),
    initialPageParam: null as PostCursor | null,
    getNextPageParam: (lastPage) =>
      lastPage.length === FEED_PAGE_SIZE
        ? {
            createdAt: lastPage[lastPage.length - 1].createdAt,
            id: lastPage[lastPage.length - 1].id,
          }
        : undefined,
    enabled: !!user && enabled,
    staleTime: 15_000,
  });
}
export function usePost(id: string | undefined) {
  const user = useUser();
  return useQuery({
    queryKey: feedKeys.post(user?.id, id),
    queryFn: () => fetchPost(id!),
    enabled: !!user && validPostId(id),
  });
}
function useSocialMutation<T, R>(mutationFn: (variables: T) => Promise<R>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => client.invalidateQueries({ queryKey: feedKeys.root }),
  });
}
export const usePublishPost = () => useSocialMutation(publishPost);
export const useDeletePost = () => useSocialMutation(deletePost);
export const useReportPost = () => useMutation({ mutationFn: reportPost });
export const useFollow = () => useSocialMutation(setFollow);
export function useSocialStats(userId: string) {
  const user = useUser();
  return useQuery({
    queryKey: feedKeys.stats(user?.id, userId),
    queryFn: () => fetchSocialStats(userId),
    enabled: !!user && validPostId(userId),
  });
}

export function applyLike(post: Post, postId: string, liked: boolean): Post {
  return post.id === postId
    ? {
        ...post,
        liked,
        likeCount: Math.max(0, post.likeCount + Number(liked) - Number(post.liked)),
      }
    : post;
}
export function useLikePost() {
  const user = useUser();
  const client = useQueryClient();
  return useMutation({
    mutationKey: ['social', 'like'],
    mutationFn: setPostLike,
    onMutate: async ({ postId, liked }) => {
      await client.cancelQueries({ queryKey: feedKeys.root });
      const lists = client.getQueriesData<InfiniteData<Post[]>>({ queryKey: feedKeys.lists });
      const key = feedKeys.post(user?.id, postId);
      const detail = client.getQueryData<Post | null>(key);
      client.setQueriesData<InfiniteData<Post[]>>({ queryKey: feedKeys.lists }, (old) =>
        old
          ? { ...old, pages: old.pages.map((page) => page.map((p) => applyLike(p, postId, liked))) }
          : old
      );
      if (detail) client.setQueryData(key, applyLike(detail, postId, liked));
      return { lists, detail, key };
    },
    onError: (_error, { postId }, context) => {
      for (const [key, data] of context?.lists ?? []) {
        const previous = data?.pages.flat().find((post) => post.id === postId);
        if (previous)
          client.setQueryData<InfiniteData<Post[]>>(key, (current) =>
            current
              ? {
                  ...current,
                  pages: current.pages.map((page) =>
                    page.map((post) => (post.id === postId ? previous : post))
                  ),
                }
              : current
          );
      }
      if (context?.detail) client.setQueryData(context.key, context.detail);
    },
    onSettled: () =>
      client.isMutating({ mutationKey: ['social', 'like'] }) === 1
        ? client.invalidateQueries({ queryKey: feedKeys.root })
        : undefined,
  });
}
