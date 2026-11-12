-- =============================================================
-- Conteúdo premium (vídeos e trilhas) + assinaturas vindas do RevenueCat
-- =============================================================
-- O catálogo (título, capa, duração) continua público, para mostrar o que é
-- premium com cadeado. O que fica protegido é o endereço do vídeo, que sai da
-- tabela `videos` para `video_sources`, com RLS.

-- ---------- Flags de conteúdo premium ----------
alter table public.videos add column is_premium boolean not null default false;
alter table public.playlists add column is_premium boolean not null default false;

-- ---------- Assinaturas (escritas só pelas Edge Functions) ----------
-- Espelho das entitlements do RevenueCat. Não usamos `profiles` porque o
-- usuário pode editar o próprio perfil e se marcaria como premium.
create table public.user_entitlements (
  user_id uuid not null references auth.users (id) on delete cascade,
  entitlement text not null,
  product_id text,
  -- null = vitalício. Já inclui o período de carência quando houver.
  expires_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, entitlement)
);

alter table public.user_entitlements enable row level security;

create policy "Usuário vê as próprias assinaturas" on public.user_entitlements
  for select to authenticated using ((select auth.uid()) = user_id);

grant select on public.user_entitlements to authenticated;
-- Sem insert/update/delete para anon/authenticated: só a service role escreve.

-- ---------- Regras ----------
create or replace function public.has_premium()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_entitlements e
    where e.user_id = (select auth.uid())
      and e.entitlement = 'premium'
      and (e.expires_at is null or e.expires_at > now())
  );
$$;

-- Vídeo é premium se estiver marcado ou fizer parte de uma trilha premium.
create or replace function public.video_requires_premium(p_video_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.videos v where v.id = p_video_id and v.is_premium)
      or exists (
        select 1
        from public.playlist_videos pv
        join public.playlists p on p.id = pv.playlist_id
        where pv.video_id = p_video_id and p.is_premium
      );
$$;

-- Coluna calculada para o PostgREST: `select=...,requires_premium`.
create or replace function public.requires_premium(v public.videos)
returns boolean
language sql
stable
set search_path = ''
as $$
  select public.video_requires_premium(v.id);
$$;

grant execute on function public.has_premium() to authenticated;
grant execute on function public.video_requires_premium(uuid) to anon, authenticated;
grant execute on function public.requires_premium(public.videos) to anon, authenticated;

-- ---------- Endereço do vídeo (protegido) ----------
create table public.video_sources (
  video_id uuid primary key references public.videos (id) on delete cascade,
  url text not null
);

insert into public.video_sources (video_id, url)
select id, video_url from public.videos;

alter table public.videos drop column video_url;

alter table public.video_sources enable row level security;

create policy "Vídeo grátis para todos, premium para assinantes" on public.video_sources
  for select to anon, authenticated
  using (not public.video_requires_premium(video_id) or public.has_premium());

grant select on public.video_sources to anon, authenticated;

-- Exemplo com os dados de teste (ajuste no painel com o conteúdo real):
-- uma trilha inteira premium e um vídeo avulso premium.
update public.playlists set is_premium = true where id = '00000000-0000-4000-b000-000000000002';
update public.videos set is_premium = true where id = '00000000-0000-4000-a000-000000000006';
