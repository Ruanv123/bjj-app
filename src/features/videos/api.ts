import { supabase } from "@/lib/supabase";

import {
  mapVideo,
  VIDEO_COLUMNS,
  type Playlist,
  type Video,
  type VideoRow,
} from "./types";

type PlaylistRow = {
  id: string;
  title: string;
  description: string;
  position: number;
  is_premium: boolean;
  items: { position: number; video: VideoRow | null }[];
};

export async function fetchPlaylists(): Promise<Playlist[]> {
  const { data, error } = await supabase
    .from("playlists")
    .select(
      `id,title,description,position,is_premium,items:playlist_videos(position,video:videos(${VIDEO_COLUMNS}))`,
    )
    .order("position");
  if (error) throw error;

  return (data as unknown as PlaylistRow[])
    .map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      isPremium: p.is_premium,
      videos: [...p.items]
        .sort((a, b) => a.position - b.position)
        .flatMap((item) => (item.video ? [mapVideo(item.video)] : [])),
    }))
    .filter((p) => p.videos.length > 0);
}

export async function fetchVideo(id: string): Promise<Video | null> {
  const { data, error } = await supabase
    .from("videos")
    // A RLS de `video_sources` devolve `source: null` se o usuário não puder assistir.
    .select(`${VIDEO_COLUMNS},source:video_sources(url)`)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapVideo(data as unknown as VideoRow) : null;
}

/** Remove caracteres que têm significado na sintaxe de filtros do PostgREST. */
export function sanitizeSearchTerm(term: string) {
  return term
    .replace(/[%_*,()\\"'.:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function searchVideos(term: string): Promise<Video[]> {
  const q = sanitizeSearchTerm(term);
  if (!q) return [];
  const { data, error } = await supabase
    .from("videos")
    .select(VIDEO_COLUMNS)
    .or(`title.ilike.%${q}%,channel.ilike.%${q}%`)
    .order("published_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data as VideoRow[]).map(mapVideo);
}

// ---------- Salvos ----------

export async function fetchIsSaved(videoId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("saved_videos")
    .select("video_id")
    .eq("video_id", videoId)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function fetchSavedVideos(): Promise<Video[]> {
  const { data, error } = await supabase
    .from("saved_videos")
    .select(`created_at,video:videos(${VIDEO_COLUMNS})`)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw error;
  return (data as unknown as { video: VideoRow | null }[]).flatMap((r) =>
    r.video ? [mapVideo(r.video)] : [],
  );
}

export async function setSaved(videoId: string, saved: boolean) {
  // user_id é preenchido pelo banco (default auth.uid()) e validado pela RLS.
  const { error } = saved
    ? await supabase
        .from("saved_videos")
        .upsert({ video_id: videoId }, { ignoreDuplicates: true })
    : await supabase.from("saved_videos").delete().eq("video_id", videoId);
  if (error) throw error;
}
