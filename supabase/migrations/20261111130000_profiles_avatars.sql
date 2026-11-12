-- =============================================================
-- Perfis (nome e foto editáveis pelo usuário) + bucket de avatares
-- =============================================================
-- Guardamos nome/foto numa tabela própria em vez de user_metadata, para que
-- os dados vindos do Google/Apple em cada login não sobrescrevam as edições.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (display_name is null or char_length(btrim(display_name)) between 1 and 80),
  -- URL pública da foto e caminho no Storage (para apagar a anterior).
  avatar_url text,
  avatar_path text,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Usuário vê o próprio perfil" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "Usuário cria o próprio perfil" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);
create policy "Usuário edita o próprio perfil" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

grant select, insert, update on public.profiles to authenticated;

create or replace function public.touch_profile_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_profile_updated_at();

-- Comentários passam a usar o nome/foto do perfil quando existirem.
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
      p.display_name,
      u.raw_user_meta_data ->> 'full_name',
      u.raw_user_meta_data ->> 'name',
      split_part(u.email, '@', 1),
      'Usuário'
    ),
    coalesce(
      p.avatar_url,
      u.raw_user_meta_data ->> 'avatar_url',
      u.raw_user_meta_data ->> 'picture'
    )
  into new.author_name, new.author_avatar_url
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.id = new.user_id;

  return new;
end;
$$;

-- ---------- Storage: bucket público de avatares ----------
-- Leitura pela URL pública; escrita só na pasta do próprio usuário: avatars/<user_id>/...
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "Usuário envia avatar na própria pasta" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.jwt() ->> 'sub')
  );

create policy "Usuário vê os próprios arquivos de avatar" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.jwt() ->> 'sub')
  );

create policy "Usuário apaga avatar da própria pasta" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.jwt() ->> 'sub')
  );
