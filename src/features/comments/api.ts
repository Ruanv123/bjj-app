import { supabase } from '@/lib/supabase';

import { COMMENT_COLUMNS, mapComment, type Comment, type CommentRow } from './types';

export const COMMENTS_PAGE_SIZE = 20;

export async function fetchComments(videoId: string, page: number): Promise<Comment[]> {
  const from = page * COMMENTS_PAGE_SIZE;
  const { data, error } = await supabase
    .from('comments')
    .select(COMMENT_COLUMNS)
    .eq('video_id', videoId)
    .order('created_at', { ascending: false })
    .range(from, from + COMMENTS_PAGE_SIZE - 1);
  if (error) throw error;
  return (data as CommentRow[]).map(mapComment);
}

export async function createComment(videoId: string, body: string): Promise<Comment> {
  // Autor e user_id são definidos pelo trigger no banco.
  const { data, error } = await supabase
    .from('comments')
    .insert({ video_id: videoId, body })
    .select(COMMENT_COLUMNS)
    .single();
  if (error) throw error;
  return mapComment(data as CommentRow);
}

export async function deleteComment(id: string) {
  const { error } = await supabase.from('comments').delete().eq('id', id);
  if (error) throw error;
}
