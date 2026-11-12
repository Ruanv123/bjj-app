-- =============================================================
-- Comunidades, parte 3: perfil da comunidade (foto, banner, descrição),
-- administração (dono sempre presente, admins), reações e busca de mensagens.
-- =============================================================
--
-- Cargos (o banco continua usando os nomes antigos):
--   owner     → "Dono"   (um por comunidade; edita tudo, promove e rebaixa admins)
--   moderator → "Admin"  (edita os dados, promove membros, remove/bane membros comuns)
--   member    → membro comum

-- =============================================================
-- Perfil da comunidade: foto e banner
-- =============================================================

alter table public.communities
  add column avatar_path text,
  add column banner_url text,
  add column banner_path text;

-- Bucket público: foto e banner aparecem para quem ainda nem entrou.
-- Pasta = id da comunidade: community-media/<community_id>/<arquivo>.
insert into storage.buckets (id, name, public)
values ('community-media', 'community-media', true)
on conflict (id) do nothing;

create or replace function public.community_media_owner(object_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when (storage.foldername(object_name))[1]
      ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then ((storage.foldername(object_name))[1])::uuid
  end;
$$;

-- Dono ou admin da comunidade (pelo id da COMUNIDADE, não da conversa).
create or replace function public.is_community_admin(p_community_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversations c
    join public.conversation_members m on m.conversation_id = c.id
    where c.community_id = p_community_id
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'moderator')
  );
$$;

create policy "Comunidade: admin envia foto/banner" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'community-media'
    and public.is_community_admin(public.community_media_owner(name))
  );

create policy "Comunidade: admin apaga foto/banner" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'community-media'
    and public.is_community_admin(public.community_media_owner(name))
  );

-- O delete do Storage confere a policy de select antes de apagar.
create policy "Comunidade: admin vê os arquivos" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'community-media'
    and public.is_community_admin(public.community_media_owner(name))
  );

-- =============================================================
-- Toda comunidade com membros tem um dono
-- =============================================================
-- As comunidades criadas pelo seed não tinham dono, e ninguém conseguia
-- administrá-las. Agora, sempre que a comunidade fica sem dono (seed, conta
-- apagada…), o admin mais antigo assume; sem admins, o membro mais antigo.

create or replace function public.ensure_community_owner(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  heir uuid;
begin
  if not exists (
    select 1 from public.conversations
    where id = p_conversation_id and kind = 'community'
  ) then
    return;
  end if;
  if exists (
    select 1 from public.conversation_members
    where conversation_id = p_conversation_id and role = 'owner'
  ) then
    return;
  end if;

  select user_id into heir
  from public.conversation_members
  where conversation_id = p_conversation_id
  order by case role when 'moderator' then 0 else 1 end, joined_at, user_id
  limit 1;

  if heir is not null then
    update public.conversation_members
    set role = 'owner'
    where conversation_id = p_conversation_id and user_id = heir;
  end if;
end;
$$;

create or replace function public.conversation_members_ensure_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.ensure_community_owner(coalesce(new.conversation_id, old.conversation_id));
  return null;
end;
$$;

create trigger conversation_members_ensure_owner
  after insert or delete on public.conversation_members
  for each row execute function public.conversation_members_ensure_owner();

-- Corrige as comunidades que já existem sem dono.
select public.ensure_community_owner(c.id)
from public.conversations c
where c.kind = 'community';

-- =============================================================
-- Reações (uma por pessoa por mensagem, como no WhatsApp)
-- =============================================================
-- Ficam na própria mensagem ({ "<user_id>": "👍" }). Assim reagir muda
-- updated_at e reaproveita tudo que já existe: o broadcast de edição e a
-- recuperação do que o Realtime não entregou.

alter table public.messages
  add column reactions jsonb not null default '{}'::jsonb
    check (jsonb_typeof(reactions) = 'object');

-- O app nunca cria mensagem já com reações.
create or replace function public.reset_message_reactions()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.reactions := '{}'::jsonb;
  return new;
end;
$$;

create trigger messages_reset_reactions
  before insert on public.messages
  for each row execute function public.reset_message_reactions();

create or replace function public.react_to_message(p_message_id uuid, p_emoji text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me text := (select auth.uid())::text;
  emoji text := nullif(btrim(coalesce(p_emoji, '')), '');
begin
  if emoji is not null and char_length(emoji) > 16 then
    raise exception 'invalid_emoji' using errcode = '22023';
  end if;

  update public.messages
  set reactions = case
    when emoji is null then reactions - me
    else reactions || jsonb_build_object(me, emoji)
  end
  where id = p_message_id
    and deleted_at is null
    and public.is_conversation_member(conversation_id);

  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
end;
$$;

-- Apagar a mensagem também tira as reações.
create or replace function public.clear_deleted_message_reactions()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.deleted_at is not null and old.deleted_at is null then
    new.reactions := '{}'::jsonb;
  end if;
  return new;
end;
$$;

create trigger messages_clear_deleted_reactions
  before update on public.messages
  for each row execute function public.clear_deleted_message_reactions();

-- Broadcast também quando as reações mudam (a prévia da lista só muda com texto).
create or replace function public.publish_message_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.body is distinct from new.body or old.deleted_at is distinct from new.deleted_at then
    update public.conversations
    set last_message_body = left(new.body, 140),
        last_message_type = case
          when new.deleted_at is not null then 'deleted'
          when new.attachment_path is not null then 'image'
          else 'text'
        end
    where id = new.conversation_id and last_message_id = new.id;
  end if;

  begin
    perform realtime.send(
      payload => to_jsonb(new),
      event => 'message',
      topic => 'conversation:' || new.conversation_id::text,
      private => true
    );
  exception when others then
    raise warning 'publish_message_update: falha ao enviar broadcast: %', sqlerrm;
  end;

  return null;
end;
$$;

drop trigger messages_publish_update on public.messages;
create trigger messages_publish_update
  after update on public.messages
  for each row
  when (
    old.body is distinct from new.body
    or old.deleted_at is distinct from new.deleted_at
    or old.reactions is distinct from new.reactions
  )
  execute function public.publish_message_update();

-- =============================================================
-- Busca nas mensagens da conversa
-- =============================================================

create index messages_body_trgm_idx
  on public.messages using gin (body extensions.gin_trgm_ops);

create or replace function public.search_messages(p_conversation_id uuid, p_query text)
returns setof public.messages
language sql
stable
security definer
set search_path = ''
as $$
  select m.*
  from public.messages m
  where m.conversation_id = p_conversation_id
    and public.is_conversation_member(p_conversation_id)
    and char_length(btrim(p_query)) >= 2
    and m.deleted_at is null
    and m.body ilike '%' || replace(replace(replace(btrim(p_query), '\', '\\'), '%', '\%'), '_', '\_') || '%'
    -- Esconde quem eu bloqueei (como na conversa).
    and not exists (
      select 1 from public.user_blocks b
      where b.blocker_id = (select auth.uid()) and b.blocked_id = m.sender_id
    )
  order by m.created_at desc, m.id desc
  limit 100;
$$;

-- =============================================================
-- RPCs de comunidade (recriadas com os campos novos)
-- =============================================================

drop function public.list_conversations(uuid);
create function public.list_conversations(p_conversation_id uuid default null)
returns table (
  id uuid,
  kind text,
  title text,
  avatar_url text,
  community_id uuid,
  description text,
  banner_url text,
  is_private boolean,
  other_user_id uuid,
  is_blocked boolean,
  member_count integer,
  my_role text,
  muted boolean,
  last_message_body text,
  last_message_type text,
  last_message_at timestamptz,
  last_message_sender_id uuid,
  unread_count integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id,
    c.kind,
    coalesce(cm.name, other.name, 'Conversa'),
    coalesce(cm.avatar_url, other.avatar_url),
    c.community_id,
    coalesce(cm.description, ''),
    cm.banner_url,
    coalesce(cm.is_private, false),
    other.user_id,
    coalesce(
      exists (
        select 1 from public.user_blocks b
        where b.blocker_id = me.user_id and b.blocked_id = other.user_id
      ),
      false
    ),
    (select count(*)::int from public.conversation_members x where x.conversation_id = c.id),
    me.role,
    me.muted,
    c.last_message_body,
    c.last_message_type,
    c.last_message_at,
    c.last_message_sender_id,
    (
      select count(*)::int from (
        select 1 from public.messages m
        where m.conversation_id = c.id
          and m.created_at > me.last_read_at
          and m.sender_id <> me.user_id
          and m.deleted_at is null
        limit 100
      ) unread
    )
  from public.conversation_members me
  join public.conversations c on c.id = me.conversation_id
  left join public.communities cm on cm.id = c.community_id
  left join lateral (
    select om.user_id, p.name, p.avatar_url
    from public.conversation_members om
    cross join lateral public.user_public_profile(om.user_id) p
    where c.kind = 'dm' and om.conversation_id = c.id and om.user_id <> me.user_id
    limit 1
  ) other on true
  where me.user_id = (select auth.uid())
    and (p_conversation_id is null or c.id = p_conversation_id)
  order by coalesce(c.last_message_at, c.created_at) desc;
$$;

drop function public.list_communities();
create function public.list_communities()
returns table (
  id uuid,
  name text,
  description text,
  avatar_url text,
  banner_url text,
  is_private boolean,
  conversation_id uuid,
  member_count integer,
  is_member boolean,
  my_role text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    cm.id,
    cm.name,
    cm.description,
    cm.avatar_url,
    cm.banner_url,
    cm.is_private,
    c.id,
    (select count(*)::int from public.conversation_members x where x.conversation_id = c.id),
    me.role is not null,
    me.role
  from public.communities cm
  join public.conversations c on c.community_id = cm.id
  left join public.conversation_members me
    on me.conversation_id = c.id and me.user_id = (select auth.uid())
  where not cm.is_private or me.role is not null
  order by cm.name;
$$;

-- Admins editam nome e descrição; só o dono muda a privacidade.
create or replace function public.update_community(
  p_community_id uuid,
  p_name text,
  p_description text,
  p_is_private boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  conv_id uuid;
  current_private boolean;
begin
  select c.id, cm.is_private into conv_id, current_private
  from public.communities cm
  join public.conversations c on c.community_id = cm.id
  where cm.id = p_community_id;

  if not public.is_community_admin(p_community_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_is_private is distinct from current_private
     and public.conversation_role(conv_id) is distinct from 'owner' then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.communities
  set name = btrim(p_name),
      description = btrim(coalesce(p_description, '')),
      is_private = p_is_private
  where id = p_community_id;
end;
$$;

-- Troca (ou remove, com p_path nulo) a foto ou o banner. Devolve o caminho
-- antigo para o app apagar o arquivo.
create or replace function public.set_community_image(
  p_community_id uuid,
  p_kind text,
  p_path text,
  p_url text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous text;
begin
  if p_kind not in ('avatar', 'banner') then
    raise exception 'invalid_kind' using errcode = '22023';
  end if;
  if not public.is_community_admin(p_community_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  -- O arquivo precisa estar na pasta desta comunidade, e a URL apontar para ele.
  if p_path is not null and (
    p_path not like p_community_id::text || '/%'
    or p_url is null
    or p_url not like '%/storage/v1/object/public/community-media/' || p_path
  ) then
    raise exception 'invalid_image' using errcode = '22023';
  end if;

  if p_kind = 'avatar' then
    select avatar_path into previous from public.communities where id = p_community_id;
    update public.communities
    set avatar_path = p_path, avatar_url = case when p_path is null then null else p_url end
    where id = p_community_id;
  else
    select banner_path into previous from public.communities where id = p_community_id;
    update public.communities
    set banner_path = p_path, banner_url = case when p_path is null then null else p_url end
    where id = p_community_id;
  end if;

  return previous;
end;
$$;

-- Dono e admins promovem membros a admin; só o dono rebaixa admins.
create or replace function public.set_member_role(
  p_conversation_id uuid,
  p_user_id uuid,
  p_role text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  my_role text := public.conversation_role(p_conversation_id);
  target_role text;
begin
  if p_role not in ('moderator', 'member') then
    raise exception 'invalid_role' using errcode = '22023';
  end if;
  if not public.is_conversation_moderator(p_conversation_id) or p_user_id = auth.uid() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select role into target_role from public.conversation_members
  where conversation_id = p_conversation_id and user_id = p_user_id;

  if target_role is null or target_role = 'owner' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if target_role = 'moderator' and my_role <> 'owner' then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.conversation_members
  set role = p_role
  where conversation_id = p_conversation_id and user_id = p_user_id;
end;
$$;

-- =============================================================
-- Permissões
-- =============================================================

revoke execute on function
  public.community_media_owner(text),
  public.is_community_admin(uuid),
  public.ensure_community_owner(uuid),
  public.conversation_members_ensure_owner(),
  public.reset_message_reactions(),
  public.clear_deleted_message_reactions(),
  public.react_to_message(uuid, text),
  public.search_messages(uuid, text),
  public.list_conversations(uuid),
  public.list_communities(),
  public.set_community_image(uuid, text, text, text)
from public, anon;

-- Usadas pelas policies de Storage.
grant execute on function
  public.community_media_owner(text),
  public.is_community_admin(uuid)
to authenticated;

grant execute on function
  public.react_to_message(uuid, text),
  public.search_messages(uuid, text),
  public.list_conversations(uuid),
  public.list_communities(),
  public.set_community_image(uuid, text, text, text)
to authenticated;

revoke execute on function
  public.ensure_community_owner(uuid),
  public.conversation_members_ensure_owner(),
  public.reset_message_reactions(),
  public.clear_deleted_message_reactions()
from authenticated;
