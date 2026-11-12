-- Perfil social: consulta pontual dos campos públicos, sem ampliar as policies
-- da tabela de perfis nem expor auth.users, e-mail ou caminho interno do avatar.
create function public.get_athlete_profile(p_user_id uuid)
returns table (
  id uuid,
  display_name text,
  avatar_url text,
  bio text,
  instagram text,
  belt text,
  belt_degree integer,
  disciplines text[],
  competitions jsonb
)
language sql stable security definer
set search_path = ''
as $$
  select
    d.user_id,
    d.name,
    d.avatar_url,
    coalesce(p.bio, ''),
    coalesce(p.instagram, ''),
    p.belt,
    coalesce(p.belt_degree, 0),
    coalesce(p.disciplines, '{}'::text[]),
    coalesce(p.competitions, '[]'::jsonb)
  from public.user_directory d
  left join public.profiles p on p.id = d.user_id
  where d.user_id = p_user_id
    and (select auth.uid()) is not null
    and not public.is_blocked_between((select auth.uid()), d.user_id);
$$;

revoke all on function public.get_athlete_profile(uuid) from public, anon;
grant execute on function public.get_athlete_profile(uuid) to authenticated;
