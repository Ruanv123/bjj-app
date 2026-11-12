export type Video = {
  id: string;
  title: string;
  description: string;
  channel: string;
  thumbnailUrl: string;
  /**
   * Endereço do stream. Só vem na tela do vídeo (`fetchVideo`) e é `null`
   * quando o vídeo é premium e o usuário não assina (bloqueado pela RLS).
   */
  videoUrl: string | null;
  /** Vídeo marcado como premium ou dentro de uma trilha premium. */
  requiresPremium: boolean;
  durationSeconds: number | null;
  views: number;
  publishedAt: string; // ISO
};

export type Playlist = {
  id: string;
  title: string;
  description: string;
  isPremium: boolean;
  videos: Video[];
};

/** Linha da tabela `videos` como vem do Supabase. */
export type VideoRow = {
  id: string;
  title: string;
  description: string;
  channel: string;
  thumbnail_url: string;
  /** Coluna calculada no banco: `public.requires_premium(videos)`. */
  requires_premium: boolean;
  /**
   * Só presente quando a consulta embute `source:video_sources(url)`. Como
   * `video_id` é a PK, o PostgREST devolve um objeto; aceitamos lista por garantia.
   */
  source?: { url: string } | { url: string }[] | null;
  duration_seconds: number | null;
  views: number;
  published_at: string;
};

export const VIDEO_COLUMNS =
  'id,title,description,channel,thumbnail_url,requires_premium,duration_seconds,views,published_at';

export function mapVideo(row: VideoRow): Video {
  const source = Array.isArray(row.source) ? row.source[0] : row.source;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    channel: row.channel,
    thumbnailUrl: row.thumbnail_url,
    videoUrl: source?.url ?? null,
    requiresPremium: row.requires_premium,
    durationSeconds: row.duration_seconds,
    views: Number(row.views),
    publishedAt: row.published_at,
  };
}
