-- Linha do tempo social. Tabelas privadas; o app usa RPCs com identidade da sessão.
create table public.social_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid references public.social_posts(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 500 and body ~ '[^[:space:]]'),
  created_at timestamptz not null default now(),
  edited_at timestamptz
);
create index social_posts_timeline_idx on public.social_posts(created_at desc, id desc) where parent_id is null;
create index social_posts_author_idx on public.social_posts(author_id, created_at desc, id desc);
create index social_posts_parent_idx on public.social_posts(parent_id, created_at desc, id desc);

create table public.social_likes (
  post_id uuid not null references public.social_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key(post_id, user_id)
);
create table public.social_follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  followed_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(follower_id, followed_id),
  check (follower_id <> followed_id)
);
create index social_follows_followed_idx on public.social_follows(followed_id);
create table public.social_post_reports (
  post_id uuid not null references public.social_posts(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(post_id, reporter_id)
);

alter table public.social_posts enable row level security;
alter table public.social_likes enable row level security;
alter table public.social_follows enable row level security;
alter table public.social_post_reports enable row level security;
revoke all on public.social_posts, public.social_likes, public.social_follows, public.social_post_reports from anon, authenticated;

create function public.can_read_social_post(p_post_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.social_posts p
    left join public.social_posts parent on parent.id = p.parent_id
    where p.id = p_post_id
      and not public.is_blocked_between((select auth.uid()), p.author_id)
      and (p.parent_id is null or (parent.id is not null and not public.is_blocked_between((select auth.uid()), parent.author_id)))
  );
$$;

create function public.list_social_posts(
  p_author_id uuid default null,
  p_parent_id uuid default null,
  p_following boolean default false,
  p_before_at timestamptz default null,
  p_before_id uuid default null,
  p_post_id uuid default null,
  p_limit integer default 20
)
returns table (
  id uuid, author_id uuid, parent_id uuid, body text, created_at timestamptz, edited_at timestamptz,
  author_name text, author_avatar_url text, author_belt text, author_belt_degree integer,
  like_count bigint, reply_count bigint, liked boolean
)
language sql stable security definer set search_path = '' as $$
  select p.id, p.author_id, p.parent_id, p.body, p.created_at, p.edited_at,
    d.name, d.avatar_url, pr.belt, coalesce(pr.belt_degree, 0),
    (select count(*) from public.social_likes l where l.post_id = p.id),
    (select count(*) from public.social_posts r where r.parent_id = p.id and public.can_read_social_post(r.id)),
    exists (select 1 from public.social_likes l where l.post_id = p.id and l.user_id = (select auth.uid()))
  from public.social_posts p
  join public.user_directory d on d.user_id = p.author_id
  left join public.profiles pr on pr.id = p.author_id
  where public.can_read_social_post(p.id)
    and (p_post_id is null or p.id = p_post_id)
    and (p_post_id is not null or (p_parent_id is null and p.parent_id is null) or p.parent_id = p_parent_id)
    and (p_author_id is null or p.author_id = p_author_id)
    and (not coalesce(p_following, false) or p.author_id = (select auth.uid()) or exists (
      select 1 from public.social_follows f where f.follower_id = (select auth.uid()) and f.followed_id = p.author_id
    ))
    and (p_before_at is null or (p.created_at, p.id) < (p_before_at, p_before_id))
  order by p.created_at desc, p.id desc
  limit greatest(1, least(coalesce(p_limit, 20), 50));
$$;

create function public.create_social_post(p_body text, p_parent_id uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare post_id uuid;
begin
  if auth.uid() is null then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_parent_id is not null and (
    not public.can_read_social_post(p_parent_id)
    or not exists (select 1 from public.social_posts where id = p_parent_id and parent_id is null)
  ) then raise exception 'post_unavailable' using errcode = '42501'; end if;
  insert into public.social_posts(author_id, body, parent_id)
  values (auth.uid(), btrim(p_body), p_parent_id) returning id into post_id;
  return post_id;
end;
$$;

create function public.edit_social_post(p_post_id uuid, p_body text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.social_posts set body = btrim(p_body), edited_at = now()
  where id = p_post_id and author_id = auth.uid();
  if not found then raise exception 'forbidden' using errcode = '42501'; end if;
end;
$$;

create function public.delete_social_post(p_post_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from public.social_posts where id = p_post_id and author_id = auth.uid();
  if not found then raise exception 'forbidden' using errcode = '42501'; end if;
end;
$$;

create function public.set_social_like(p_post_id uuid, p_liked boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_read_social_post(p_post_id) then raise exception 'post_unavailable' using errcode = '42501'; end if;
  if p_liked then
    insert into public.social_likes(post_id, user_id) values (p_post_id, auth.uid()) on conflict do nothing;
  else
    delete from public.social_likes where post_id = p_post_id and user_id = auth.uid();
  end if;
end;
$$;

create function public.set_social_follow(p_user_id uuid, p_following boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or auth.uid() = p_user_id then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_following then
    if public.is_blocked_between(auth.uid(), p_user_id) or not exists (select 1 from public.user_directory where user_id = p_user_id)
    then raise exception 'forbidden' using errcode = '42501'; end if;
    insert into public.social_follows(follower_id, followed_id) values (auth.uid(), p_user_id) on conflict do nothing;
  else
    delete from public.social_follows where follower_id = auth.uid() and followed_id = p_user_id;
  end if;
end;
$$;

create function public.get_social_stats(p_user_id uuid)
returns table (post_count bigint, follower_count bigint, following_count bigint, is_following boolean)
language sql stable security definer set search_path = '' as $$
  select
    (select count(*) from public.social_posts p where p.author_id = p_user_id and p.parent_id is null),
    (select count(*) from public.social_follows f where f.followed_id = p_user_id and not public.is_blocked_between(p_user_id, f.follower_id)),
    (select count(*) from public.social_follows f where f.follower_id = p_user_id and not public.is_blocked_between(p_user_id, f.followed_id)),
    exists (select 1 from public.social_follows f where f.follower_id = (select auth.uid()) and f.followed_id = p_user_id)
  from public.user_directory d
  where d.user_id = p_user_id and (select auth.uid()) is not null and not public.is_blocked_between((select auth.uid()), p_user_id);
$$;

create function public.report_social_post(p_post_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_read_social_post(p_post_id) or exists (select 1 from public.social_posts where id = p_post_id and author_id = auth.uid())
  then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.social_post_reports(post_id, reporter_id) values (p_post_id, auth.uid()) on conflict do nothing;
end;
$$;

-- Bloquear também desfaz a relação de seguir nos dois sentidos.
create function public.remove_blocked_social_follows()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.social_follows where
    (follower_id = new.blocker_id and followed_id = new.blocked_id) or
    (follower_id = new.blocked_id and followed_id = new.blocker_id);
  return null;
end;
$$;
create trigger user_blocks_remove_social_follows after insert on public.user_blocks
for each row execute function public.remove_blocked_social_follows();

revoke all on function public.can_read_social_post(uuid), public.remove_blocked_social_follows(),
  public.list_social_posts(uuid, uuid, boolean, timestamptz, uuid, uuid, integer),
  public.create_social_post(text, uuid), public.edit_social_post(uuid, text), public.delete_social_post(uuid),
  public.set_social_like(uuid, boolean), public.set_social_follow(uuid, boolean), public.get_social_stats(uuid),
  public.report_social_post(uuid) from public, anon;
grant execute on function public.list_social_posts(uuid, uuid, boolean, timestamptz, uuid, uuid, integer),
  public.create_social_post(text, uuid), public.edit_social_post(uuid, text), public.delete_social_post(uuid),
  public.set_social_like(uuid, boolean), public.set_social_follow(uuid, boolean), public.get_social_stats(uuid),
  public.report_social_post(uuid) to authenticated;
