import { supabase } from '@/lib/supabase';

import {
  FEED_PAGE_SIZE,
  mapPost,
  postBodySchema,
  validPostId,
  type FeedFilter,
  type Post,
  type PostCursor,
  type PostRow,
  type SocialStats,
} from './types';

export async function fetchFeed(filter: FeedFilter, cursor: PostCursor | null): Promise<Post[]> {
  const { data, error } = await supabase.rpc('list_social_posts', {
    p_author_id: filter.authorId ?? null,
    p_parent_id: filter.parentId ?? null,
    p_following: filter.following ?? false,
    p_before_at: cursor?.createdAt ?? null,
    p_before_id: cursor?.id ?? null,
    p_limit: FEED_PAGE_SIZE,
  });
  if (error) throw error;
  return ((data ?? []) as PostRow[]).map(mapPost);
}
export async function fetchPost(id: string): Promise<Post | null> {
  if (!validPostId(id)) return null;
  const { data, error } = await supabase.rpc('list_social_posts', { p_post_id: id, p_limit: 1 });
  if (error) throw error;
  const row = (data as PostRow[] | null)?.[0];
  return row ? mapPost(row) : null;
}
export async function publishPost({
  body,
  parentId,
  editId,
}: {
  body: string;
  parentId?: string;
  editId?: string;
}): Promise<string> {
  const text = postBodySchema.parse(body);
  const { data, error } = editId
    ? await supabase.rpc('edit_social_post', { p_post_id: editId, p_body: text })
    : await supabase.rpc('create_social_post', { p_body: text, p_parent_id: parentId ?? null });
  if (error) throw error;
  return editId ?? (data as string);
}
export async function setPostLike({ postId, liked }: { postId: string; liked: boolean }) {
  const { error } = await supabase.rpc('set_social_like', { p_post_id: postId, p_liked: liked });
  if (error) throw error;
}
export async function deletePost(id: string) {
  const { error } = await supabase.rpc('delete_social_post', { p_post_id: id });
  if (error) throw error;
}
export async function reportPost(id: string) {
  const { error } = await supabase.rpc('report_social_post', { p_post_id: id });
  if (error) throw error;
}
export async function setFollow({ userId, following }: { userId: string; following: boolean }) {
  const { error } = await supabase.rpc('set_social_follow', {
    p_user_id: userId,
    p_following: following,
  });
  if (error) throw error;
}
export async function fetchSocialStats(userId: string): Promise<SocialStats | null> {
  const { data, error } = await supabase.rpc('get_social_stats', { p_user_id: userId });
  if (error) throw error;
  const row = data?.[0];
  return row
    ? {
        postCount: Number(row.post_count),
        followerCount: Number(row.follower_count),
        followingCount: Number(row.following_count),
        isFollowing: row.is_following,
      }
    : null;
}
