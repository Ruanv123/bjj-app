import { z } from 'zod';

import type { ProfileDetails } from '@/features/profile/details';

export const MAX_POST_LENGTH = 500;
export const FEED_PAGE_SIZE = 20;
export const postBodySchema = z.string().trim().min(1).max(MAX_POST_LENGTH);
export const validPostId = (id: unknown): id is string => z.uuid().safeParse(id).success;

export type Post = {
  id: string;
  authorId: string;
  parentId: string | null;
  body: string;
  createdAt: string;
  editedAt: string | null;
  authorName: string;
  authorAvatarUrl: string | null;
  authorBelt: ProfileDetails['belt'];
  authorBeltDegree: number;
  likeCount: number;
  replyCount: number;
  liked: boolean;
};
export type PostRow = {
  id: string;
  author_id: string;
  parent_id: string | null;
  body: string;
  created_at: string;
  edited_at: string | null;
  author_name: string;
  author_avatar_url: string | null;
  author_belt: ProfileDetails['belt'];
  author_belt_degree: number;
  like_count: number | string;
  reply_count: number | string;
  liked: boolean;
};
export function mapPost(row: PostRow): Post {
  return {
    id: row.id,
    authorId: row.author_id,
    parentId: row.parent_id,
    body: row.body,
    createdAt: row.created_at,
    editedAt: row.edited_at,
    authorName: row.author_name,
    authorAvatarUrl: row.author_avatar_url,
    authorBelt: row.author_belt,
    authorBeltDegree: row.author_belt_degree,
    likeCount: Number(row.like_count),
    replyCount: Number(row.reply_count),
    liked: row.liked,
  };
}
export type FeedFilter = { authorId?: string; parentId?: string; following?: boolean };
export type PostCursor = { createdAt: string; id: string };
export type SocialStats = {
  postCount: number;
  followerCount: number;
  followingCount: number;
  isFollowing: boolean;
};
