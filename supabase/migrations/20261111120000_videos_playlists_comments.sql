-- =============================================================
-- Vídeos, playlists, comentários e vídeos salvos
-- =============================================================

-- ---------- Vídeos ----------
create table public.videos (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 200),
  description text not null default '',
  channel text not null,
  thumbnail_url text not null,
  video_url text not null,
  duration_seconds integer check (duration_seconds is null or duration_seconds > 0),
  views bigint not null default 0,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index videos_published_at_idx on public.videos (published_at desc);

-- ---------- Playlists ----------
create table public.playlists (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  description text not null default '',
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.playlist_videos (
  playlist_id uuid not null references public.playlists (id) on delete cascade,
  video_id uuid not null references public.videos (id) on delete cascade,
  position integer not null default 0,
  primary key (playlist_id, video_id)
);

create index playlist_videos_video_id_idx on public.playlist_videos (video_id);

-- ---------- Comentários ----------
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  -- Preenchidos pelo trigger abaixo a partir do perfil do usuário (não confiamos no cliente).
  author_name text not null default '',
  author_avatar_url text,
  created_at timestamptz not null default now()
);

create index comments_video_id_created_at_idx on public.comments (video_id, created_at desc);
create index comments_user_id_idx on public.comments (user_id);

create or replace function public.set_comment_author()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.user_id := auth.uid();
  new.body := btrim(new.body);

  select
    coalesce(
      u.raw_user_meta_data ->> 'full_name',
      u.raw_user_meta_data ->> 'name',
      split_part(u.email, '@', 1),
      'Usuário'
    ),
    coalesce(u.raw_user_meta_data ->> 'avatar_url', u.raw_user_meta_data ->> 'picture')
  into new.author_name, new.author_avatar_url
  from auth.users u
  where u.id = new.user_id;

  return new;
end;
$$;

create trigger comments_set_author
  before insert on public.comments
  for each row execute function public.set_comment_author();

-- ---------- Vídeos salvos ----------
create table public.saved_videos (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  video_id uuid not null references public.videos (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, video_id)
);

create index saved_videos_video_id_idx on public.saved_videos (video_id);

-- =============================================================
-- Row Level Security
-- =============================================================
alter table public.videos enable row level security;
alter table public.playlists enable row level security;
alter table public.playlist_videos enable row level security;
alter table public.comments enable row level security;
alter table public.saved_videos enable row level security;

-- Catálogo: leitura pública, escrita só pelo painel/service role.
create policy "Catálogo de vídeos é público" on public.videos
  for select to anon, authenticated using (true);
create policy "Playlists são públicas" on public.playlists
  for select to anon, authenticated using (true);
create policy "Itens de playlist são públicos" on public.playlist_videos
  for select to anon, authenticated using (true);

-- Comentários: qualquer um lê; só logado escreve; só o autor apaga.
create policy "Comentários são públicos" on public.comments
  for select to anon, authenticated using (true);
create policy "Usuário comenta em seu nome" on public.comments
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Usuário apaga o próprio comentário" on public.comments
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Salvos: cada usuário só vê e mexe nos próprios.
create policy "Usuário vê os próprios salvos" on public.saved_videos
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Usuário salva para si" on public.saved_videos
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Usuário remove os próprios salvos" on public.saved_videos
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Permissões explícitas (RLS continua filtrando as linhas).
grant select on public.videos, public.playlists, public.playlist_videos, public.comments to anon, authenticated;
grant insert, delete on public.comments to authenticated;
grant select, insert, delete on public.saved_videos to authenticated;
