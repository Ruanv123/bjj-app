export type Comment = {
  id: string;
  videoId: string;
  userId: string;
  body: string;
  authorName: string;
  authorAvatarUrl: string | null;
  createdAt: string;
};

export type CommentRow = {
  id: string;
  video_id: string;
  user_id: string;
  body: string;
  author_name: string;
  author_avatar_url: string | null;
  created_at: string;
};

export const COMMENT_COLUMNS = 'id,video_id,user_id,body,author_name,author_avatar_url,created_at';

export const MAX_COMMENT_LENGTH = 1000;

export function mapComment(row: CommentRow): Comment {
  return {
    id: row.id,
    videoId: row.video_id,
    userId: row.user_id,
    body: row.body,
    authorName: row.author_name,
    authorAvatarUrl: row.author_avatar_url,
    createdAt: row.created_at,
  };
}
