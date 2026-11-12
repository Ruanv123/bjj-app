-- =============================================================
-- Chat, parte 2: busca indexada, bloqueio e denúncia, editar/apagar,
-- moderação (cargos, remover, banir), comunidades privadas, imagens e push.
-- =============================================================
--
-- CONFIGURAÇÃO MANUAL (uma vez por projeto, fora das migrations):
--
-- 1. Push — segredos no Vault (o trigger lê daqui para chamar a Edge Function):
--      select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
--      select vault.create_secret('<valor longo e aleatório>', 'chat_push_secret');
--    e o MESMO valor na Edge Function:
--      supabase secrets set CHAT_PUSH_SECRET=<valor longo e aleatório>
--      supabase functions deploy chat-push --no-verify-jwt
--    Sem esses segredos o chat funciona normalmente, só não envia push.
--
-- 2. Realtime → Settings: "Allow public access" desligado (ver migration do chat).

create extension if not exists pg_trgm with schema extensions;
create extension if not exists pg_net with schema extensions;

-- =============================================================
-- Diretório de usuários (nome/foto públicos + busca indexada)
-- =============================================================
-- Antes, nome e foto eram calculados a cada consulta juntando auth.users e
-- profiles — impossível de indexar. Agora ficam materializados aqui, mantidos
-- por triggers, com índice trigram para buscar por qualquer parte do nome.

create table public.user_directory (
  user_id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  avatar_url text,
  updated_at timestamptz not null default now()
);

-- Sem policies: só é lida por funções security definer.
alter table public.user_directory enable row level security;

create index user_directory_name_trgm_idx
  on public.user_directory using gin (name extensions.gin_trgm_ops);

create or replace function public.refresh_user_directory(uid uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.user_directory (user_id, name, avatar_url, updated_at)
  select
    u.id,
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
    ),
    now()
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.id = uid
  on conflict (user_id) do update
    set name = excluded.name,
        avatar_url = excluded.avatar_url,
        updated_at = excluded.updated_at;
$$;

create or replace function public.sync_user_directory_from_auth()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.refresh_user_directory(new.id);
  return null;
end;
$$;

create trigger user_directory_sync_auth
  after insert or update of email, raw_user_meta_data on auth.users
  for each row execute function public.sync_user_directory_from_auth();

create or replace function public.sync_user_directory_from_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.refresh_user_directory(coalesce(new.id, old.id));
  return null;
end;
$$;

create trigger user_directory_sync_profile
  after insert or update or delete on public.profiles
  for each row execute function public.sync_user_directory_from_profile();

-- Preenche com quem já existe.
select public.refresh_user_directory(id) from auth.users;

-- Nome/foto agora vêm do diretório (sempre devolve uma linha).
create or replace function public.user_public_profile(uid uuid)
returns table (name text, avatar_url text)
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(d.name, 'Usuário'), d.avatar_url
  from (select uid as id) x
  left join public.user_directory d on d.user_id = x.id;
$$;

-- =============================================================
-- Bloqueio e denúncia (exigidos pela App Store para conteúdo de usuários)
-- =============================================================

create table public.user_blocks (
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index user_blocks_blocked_id_idx on public.user_blocks (blocked_id);

alter table public.user_blocks enable row level security;

create policy "Usuário vê quem bloqueou" on public.user_blocks
  for select to authenticated using ((select auth.uid()) = blocker_id);

grant select on public.user_blocks to authenticated;

create or replace function public.is_blocked_between(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$$;

-- Denúncias são revisadas pelo painel (sem acesso pelo app).
create table public.message_reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages (id) on delete cascade,
  reporter_id uuid not null references auth.users (id) on delete cascade,
  reason text not null default '' check (char_length(reason) <= 500),
  created_at timestamptz not null default now(),
  unique (message_id, reporter_id)
);

alter table public.message_reports enable row level security;

-- =============================================================
-- Mudanças nas tabelas do chat
-- =============================================================

-- Mensagens: edição, exclusão (lógica) e anexo de imagem.
alter table public.messages
  add column edited_at timestamptz,
  add column deleted_at timestamptz,
  add column attachment_path text,
  add column attachment_width integer check (attachment_width is null or attachment_width > 0),
  add column attachment_height integer check (attachment_height is null or attachment_height > 0);

-- Texto pode ser vazio quando há imagem ou quando a mensagem foi apagada.
alter table public.messages drop constraint messages_body_check;
alter table public.messages
  add constraint messages_body_check check (char_length(body) <= 2000),
  add constraint messages_content_check check (
    deleted_at is not null or attachment_path is not null or char_length(btrim(body)) >= 1
  );

-- Prévia da lista de conversas sabe se a última foi imagem ou foi apagada.
alter table public.conversations
  add column last_message_id uuid,
  add column last_message_type text check (last_message_type in ('text', 'image', 'deleted'));

update public.conversations set last_message_type = 'text' where last_message_body is not null;

-- Cargos: dono, moderador e membro. Silenciar notificações por conversa.
alter table public.conversation_members drop constraint conversation_members_role_check;
alter table public.conversation_members
  add constraint conversation_members_role_check check (role in ('owner', 'moderator', 'member')),
  add column muted boolean not null default false;

-- Comunidades privadas (só entra com convite) e código de convite.
alter table public.communities
  add column is_private boolean not null default false,
  add column invite_code text not null unique
    default substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);

create table public.community_bans (
  community_id uuid not null references public.communities (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  banned_by uuid references auth.users (id) on delete set null,
  reason text not null default '' check (char_length(reason) <= 500),
  created_at timestamptz not null default now(),
  primary key (community_id, user_id)
);

alter table public.community_bans enable row level security;

-- Comunidade privada só aparece para quem é membro.
drop policy "Comunidades são visíveis para usuários logados" on public.communities;
create policy "Comunidades públicas ou em que o usuário é membro" on public.communities
  for select to authenticated
  using (
    not is_private
    or exists (
      select 1 from public.conversations c
      where c.community_id = communities.id and public.is_conversation_member(c.id)
    )
  );

-- Tokens de push (um aparelho = um token; troca de dono se outra pessoa logar nele).
create table public.push_tokens (
  token text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  language text not null default 'pt',
  updated_at timestamptz not null default now()
);

create index push_tokens_user_id_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

-- =============================================================
-- Funções auxiliares de permissão
-- =============================================================

create or replace function public.conversation_role(cid uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.conversation_members
  where conversation_id = cid and user_id = (select auth.uid());
$$;

create or replace function public.is_conversation_moderator(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversation_members m
    join public.conversations c on c.id = m.conversation_id
    where m.conversation_id = cid
      and m.user_id = (select auth.uid())
      and c.kind = 'community'
      and m.role in ('owner', 'moderator')
  );
$$;

-- Pasta do arquivo no bucket chat-media = id da conversa.
create or replace function public.chat_media_conversation(object_name text)
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

-- =============================================================
-- Triggers de mensagens
-- =============================================================

create or replace function public.prepare_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  conv_kind text;
  other_id uuid;
begin
  new.sender_id := auth.uid();
  new.body := btrim(new.body);
  new.created_at := now();
  new.edited_at := null;
  new.deleted_at := null;

  -- A imagem precisa estar na pasta desta conversa (não dá para "pegar emprestado"
  -- o arquivo de outra conversa).
  if new.attachment_path is not null
     and new.attachment_path not like new.conversation_id::text || '/%' then
    raise exception 'invalid_attachment' using errcode = '22023';
  end if;

  select kind into conv_kind from public.conversations where id = new.conversation_id;
  if conv_kind = 'dm' then
    select user_id into other_id from public.conversation_members
    where conversation_id = new.conversation_id and user_id <> new.sender_id
    limit 1;
    if other_id is not null and public.is_blocked_between(new.sender_id, other_id) then
      raise exception 'blocked' using errcode = '42501';
    end if;
  end if;

  select p.name, p.avatar_url
  into new.sender_name, new.sender_avatar_url
  from public.user_public_profile(new.sender_id) p;

  return new;
end;
$$;

create or replace function public.publish_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  conv public.conversations;
  member_id uuid;
begin
  update public.conversations
  set last_message_at = new.created_at,
      last_message_body = left(new.body, 140),
      last_message_sender_id = new.sender_id,
      last_message_id = new.id,
      last_message_type = case when new.attachment_path is not null then 'image' else 'text' end
  where id = new.conversation_id
  returning * into conv;

  update public.conversation_members
  set last_read_at = new.created_at
  where conversation_id = new.conversation_id and user_id = new.sender_id;

  begin
    perform realtime.send(
      payload => to_jsonb(new),
      event => 'message',
      topic => 'conversation:' || new.conversation_id::text,
      private => true
    );

    if conv.kind = 'dm' then
      for member_id in
        select user_id from public.conversation_members
        where conversation_id = new.conversation_id
      loop
        perform realtime.send(
          payload => jsonb_build_object('conversation_id', new.conversation_id),
          event => 'conversation_updated',
          topic => 'user:' || member_id::text,
          private => true
        );
      end loop;
    end if;
  exception when others then
    raise warning 'publish_message: falha ao enviar broadcast: %', sqlerrm;
  end;

  return null;
end;
$$;

-- Edição e exclusão também vão pelo canal: o app substitui a mensagem pelo id.
create or replace function public.publish_message_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversations
  set last_message_body = left(new.body, 140),
      last_message_type = case
        when new.deleted_at is not null then 'deleted'
        when new.attachment_path is not null then 'image'
        else 'text'
      end
  where id = new.conversation_id and last_message_id = new.id;

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

create trigger messages_publish_update
  after update on public.messages
  for each row
  when (old.body is distinct from new.body or old.deleted_at is distinct from new.deleted_at)
  execute function public.publish_message_update();

-- Push: chama a Edge Function chat-push (assíncrono: pg_net só dispara após o commit).
create or replace function public.request_chat_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_url text;
  secret text;
begin
  begin
    select decrypted_secret into base_url from vault.decrypted_secrets where name = 'project_url';
    select decrypted_secret into secret from vault.decrypted_secrets where name = 'chat_push_secret';
    if base_url is null or secret is null then
      return null;
    end if;

    perform net.http_post(
      url := base_url || '/functions/v1/chat-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || secret
      ),
      body := jsonb_build_object('message_id', new.id),
      timeout_milliseconds := 5000
    );
  exception when others then
    raise warning 'request_chat_push: %', sqlerrm;
  end;
  return null;
end;
$$;

create trigger messages_request_push
  after insert on public.messages
  for each row execute function public.request_chat_push();

-- =============================================================
-- Storage: imagens do chat (bucket privado, pasta por conversa)
-- =============================================================

insert into storage.buckets (id, name, public)
values ('chat-media', 'chat-media', false)
on conflict (id) do nothing;

create policy "Chat: membro vê imagens da conversa" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'chat-media'
    and public.is_conversation_member(public.chat_media_conversation(name))
  );

create policy "Chat: membro envia imagens para a conversa" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'chat-media'
    and public.is_conversation_member(public.chat_media_conversation(name))
  );

create policy "Chat: autor ou moderador apaga imagem" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'chat-media'
    and (
      owner_id = (select auth.uid())::text
      or public.is_conversation_moderator(public.chat_media_conversation(name))
    )
  );

-- =============================================================
-- RPCs: conversas e comunidades (recriadas com campos novos)
-- =============================================================

drop function public.list_conversations(uuid);
create function public.list_conversations(p_conversation_id uuid default null)
returns table (
  id uuid,
  kind text,
  title text,
  avatar_url text,
  community_id uuid,
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
    coalesce(cm.is_private, false),
    other.user_id,
    -- DM: eu bloqueei a outra pessoa?
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
    cm.is_private,
    c.id,
    (select count(*)::int from public.conversation_members x where x.conversation_id = c.id),
    me.role is not null,
    me.role
  from public.communities cm
  join public.conversations c on c.community_id = cm.id
  left join public.conversation_members me
    on me.conversation_id = c.id and me.user_id = (select auth.uid())
  -- Privadas só aparecem para quem já é membro.
  where not cm.is_private or me.role is not null
  order by cm.name;
$$;

create or replace function public.set_conversation_muted(p_conversation_id uuid, p_muted boolean)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.conversation_members
  set muted = p_muted
  where conversation_id = p_conversation_id and user_id = (select auth.uid());
$$;

-- Busca agora usa o índice trigram (por isso o mínimo de 3 letras) e esconde
-- quem bloqueou você ou foi bloqueado por você.
create or replace function public.search_users(p_query text)
returns table (id uuid, name text, avatar_url text)
language sql
stable
security definer
set search_path = ''
as $$
  select d.user_id, d.name, d.avatar_url
  from public.user_directory d
  where char_length(btrim(p_query)) >= 3
    and d.user_id <> (select auth.uid())
    and d.name ilike '%' || replace(replace(replace(btrim(p_query), '\', '\\'), '%', '\%'), '_', '\_') || '%'
    and not public.is_blocked_between(d.user_id, (select auth.uid()))
  order by d.name
  limit 20;
$$;

create or replace function public.get_or_create_dm(p_other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  key text;
  conv_id uuid;
begin
  if me is null then
    raise exception 'Sem sessão.' using errcode = '28000';
  end if;
  if p_other_user_id = me then
    raise exception 'Não é possível conversar consigo mesmo.' using errcode = '22023';
  end if;
  if not exists (select 1 from auth.users where id = p_other_user_id) then
    raise exception 'Usuário não encontrado.' using errcode = 'P0002';
  end if;
  if public.is_blocked_between(me, p_other_user_id) then
    raise exception 'blocked' using errcode = '42501';
  end if;

  key := least(me, p_other_user_id)::text || ':' || greatest(me, p_other_user_id)::text;

  insert into public.conversations (kind, dm_key)
  values ('dm', key)
  on conflict (dm_key) do nothing;

  select c.id into conv_id from public.conversations c where c.dm_key = key;

  insert into public.conversation_members (conversation_id, user_id)
  values (conv_id, me), (conv_id, p_other_user_id)
  on conflict do nothing;

  return conv_id;
end;
$$;

-- Entrada sem convite: só comunidades públicas.
create or replace function public.join_community(p_community_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  conv_id uuid;
  private boolean;
begin
  if auth.uid() is null then
    raise exception 'Sem sessão.' using errcode = '28000';
  end if;

  select c.id, cm.is_private into conv_id, private
  from public.communities cm
  join public.conversations c on c.community_id = cm.id
  where cm.id = p_community_id;

  if conv_id is null then
    raise exception 'Comunidade não encontrada.' using errcode = 'P0002';
  end if;
  if exists (
    select 1 from public.community_bans
    where community_id = p_community_id and user_id = auth.uid()
  ) then
    raise exception 'banned' using errcode = '42501';
  end if;
  if private and not public.is_conversation_member(conv_id) then
    raise exception 'private_community' using errcode = '42501';
  end if;

  insert into public.conversation_members (conversation_id, user_id)
  values (conv_id, auth.uid())
  on conflict do nothing;

  return conv_id;
end;
$$;

create or replace function public.join_community_by_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_id uuid;
  conv_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sem sessão.' using errcode = '28000';
  end if;

  select cm.id, c.id into target_id, conv_id
  from public.communities cm
  join public.conversations c on c.community_id = cm.id
  where cm.invite_code = lower(btrim(p_code));

  if conv_id is null then
    raise exception 'invalid_code' using errcode = 'P0002';
  end if;
  if exists (
    select 1 from public.community_bans
    where community_id = target_id and user_id = auth.uid()
  ) then
    raise exception 'banned' using errcode = '42501';
  end if;

  insert into public.conversation_members (conversation_id, user_id)
  values (conv_id, auth.uid())
  on conflict do nothing;

  return conv_id;
end;
$$;

-- Dono não sai (apaga a comunidade ou passa a moderação adiante antes).
create or replace function public.leave_community(p_community_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  conv_id uuid;
begin
  select c.id into conv_id from public.conversations c where c.community_id = p_community_id;
  if public.conversation_role(conv_id) = 'owner' then
    raise exception 'owner_cannot_leave' using errcode = '42501';
  end if;

  delete from public.conversation_members
  where conversation_id = conv_id and user_id = (select auth.uid());
end;
$$;

drop function public.create_community(text, text);
create function public.create_community(
  p_name text,
  p_description text default '',
  p_is_private boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_community_id uuid;
  conv_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sem sessão.' using errcode = '28000';
  end if;

  insert into public.communities (name, description, is_private, created_by)
  values (btrim(p_name), btrim(coalesce(p_description, '')), coalesce(p_is_private, false), auth.uid())
  returning id into new_community_id;

  insert into public.conversations (kind, community_id)
  values ('community', new_community_id)
  returning id into conv_id;

  insert into public.conversation_members (conversation_id, user_id, role)
  values (conv_id, auth.uid(), 'owner');

  return conv_id;
end;
$$;

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
begin
  select c.id into conv_id from public.conversations c where c.community_id = p_community_id;
  if public.conversation_role(conv_id) is distinct from 'owner' then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.communities
  set name = btrim(p_name),
      description = btrim(coalesce(p_description, '')),
      is_private = p_is_private
  where id = p_community_id;
end;
$$;

create or replace function public.delete_community(p_community_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  conv_id uuid;
  member_id uuid;
begin
  select c.id into conv_id from public.conversations c where c.community_id = p_community_id;
  if public.conversation_role(conv_id) is distinct from 'owner' then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Avisa os membros (quem estiver com a conversa aberta sai dela).
  for member_id in
    select user_id from public.conversation_members where conversation_id = conv_id
  loop
    begin
      perform realtime.send(
        payload => jsonb_build_object('conversation_id', conv_id),
        event => 'membership_revoked',
        topic => 'user:' || member_id::text,
        private => true
      );
    exception when others then
      raise warning 'delete_community: %', sqlerrm;
    end;
  end loop;

  -- Conversa, membros e mensagens caem junto (on delete cascade).
  -- As imagens no Storage ficam órfãs: o Supabase não recomenda apagar
  -- storage.objects por SQL; limpe pela API se precisar.
  delete from public.communities where id = p_community_id;
end;
$$;

-- Convite: em comunidade pública qualquer membro compartilha; em privada, só moderação.
create or replace function public.get_community_invite(p_community_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  conv_id uuid;
  private boolean;
  code text;
begin
  select c.id, cm.is_private, cm.invite_code into conv_id, private, code
  from public.communities cm
  join public.conversations c on c.community_id = cm.id
  where cm.id = p_community_id;

  if not public.is_conversation_member(conv_id)
     or (private and not public.is_conversation_moderator(conv_id)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return code;
end;
$$;

create or replace function public.regenerate_community_invite(p_community_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  conv_id uuid;
  code text;
begin
  select c.id into conv_id from public.conversations c where c.community_id = p_community_id;
  if not public.is_conversation_moderator(conv_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.communities
  set invite_code = substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)
  where id = p_community_id
  returning invite_code into code;
  return code;
end;
$$;

-- =============================================================
-- RPCs: membros e moderação
-- =============================================================

create or replace function public.list_conversation_members(p_conversation_id uuid)
returns table (user_id uuid, name text, avatar_url text, role text, joined_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select m.user_id, p.name, p.avatar_url, m.role, m.joined_at
  from public.conversation_members m
  cross join lateral public.user_public_profile(m.user_id) p
  where m.conversation_id = p_conversation_id
    and public.is_conversation_member(p_conversation_id)
  order by
    case m.role when 'owner' then 0 when 'moderator' then 1 else 2 end,
    p.name
  limit 500;
$$;

-- Só o dono promove/rebaixa moderadores.
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
begin
  if p_role not in ('moderator', 'member') then
    raise exception 'invalid_role' using errcode = '22023';
  end if;
  if public.conversation_role(p_conversation_id) is distinct from 'owner'
     or not public.is_conversation_moderator(p_conversation_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.conversation_members
  set role = p_role
  where conversation_id = p_conversation_id
    and user_id = p_user_id
    and role <> 'owner';
end;
$$;

-- Remove (e opcionalmente bane) um membro. Moderador só remove membros comuns;
-- o dono remove qualquer um, menos a si mesmo.
create or replace function public.remove_member(
  p_conversation_id uuid,
  p_user_id uuid,
  p_ban boolean default false,
  p_reason text default ''
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  my_role text := public.conversation_role(p_conversation_id);
  target_role text;
  target_community uuid;
begin
  if not public.is_conversation_moderator(p_conversation_id) or p_user_id = auth.uid() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select role into target_role from public.conversation_members
  where conversation_id = p_conversation_id and user_id = p_user_id;

  if target_role = 'owner' or (my_role = 'moderator' and target_role = 'moderator') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select community_id into target_community from public.conversations where id = p_conversation_id;

  delete from public.conversation_members
  where conversation_id = p_conversation_id and user_id = p_user_id;

  if p_ban then
    insert into public.community_bans (community_id, user_id, banned_by, reason)
    values (target_community, p_user_id, auth.uid(), left(coalesce(p_reason, ''), 500))
    on conflict (community_id, user_id) do update
      set banned_by = excluded.banned_by, reason = excluded.reason, created_at = now();
  end if;

  -- O Realtime guarda a permissão até o JWT expirar: avisamos o app para sair do canal já.
  begin
    perform realtime.send(
      payload => jsonb_build_object('conversation_id', p_conversation_id),
      event => 'membership_revoked',
      topic => 'user:' || p_user_id::text,
      private => true
    );
  exception when others then
    raise warning 'remove_member: %', sqlerrm;
  end;
end;
$$;

create or replace function public.list_community_bans(p_conversation_id uuid)
returns table (user_id uuid, name text, avatar_url text, reason text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select b.user_id, p.name, p.avatar_url, b.reason, b.created_at
  from public.community_bans b
  join public.conversations c on c.community_id = b.community_id
  cross join lateral public.user_public_profile(b.user_id) p
  where c.id = p_conversation_id
    and public.is_conversation_moderator(p_conversation_id)
  order by b.created_at desc;
$$;

create or replace function public.unban_member(p_conversation_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_conversation_moderator(p_conversation_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  delete from public.community_bans b
  using public.conversations c
  where c.id = p_conversation_id
    and b.community_id = c.community_id
    and b.user_id = p_user_id;
end;
$$;

-- =============================================================
-- RPCs: editar, apagar e denunciar mensagens
-- =============================================================

create or replace function public.edit_message(p_message_id uuid, p_body text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.messages
  set body = btrim(p_body), edited_at = now()
  where id = p_message_id
    and sender_id = auth.uid()
    and deleted_at is null
    and public.is_conversation_member(conversation_id);

  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
end;
$$;

-- Apaga (exclusão lógica: a mensagem vira "Mensagem apagada"). O autor apaga as
-- próprias; moderadores apagam qualquer uma da comunidade. Devolve o caminho da
-- imagem, se houver, para o app removê-la do Storage.
create or replace function public.delete_message(p_message_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  msg public.messages;
begin
  select * into msg from public.messages where id = p_message_id;

  if msg.id is null or msg.deleted_at is not null
     or not public.is_conversation_member(msg.conversation_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if msg.sender_id <> auth.uid() and not public.is_conversation_moderator(msg.conversation_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.messages
  set body = '',
      deleted_at = now(),
      edited_at = null,
      attachment_path = null,
      attachment_width = null,
      attachment_height = null
  where id = p_message_id;

  return msg.attachment_path;
end;
$$;

create or replace function public.report_message(p_message_id uuid, p_reason text default '')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  cid uuid;
begin
  select conversation_id into cid from public.messages where id = p_message_id;
  if cid is null or not public.is_conversation_member(cid) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  insert into public.message_reports (message_id, reporter_id, reason)
  values (p_message_id, auth.uid(), left(coalesce(p_reason, ''), 500))
  on conflict (message_id, reporter_id) do nothing;
end;
$$;

-- =============================================================
-- RPCs: bloqueio
-- =============================================================

create or replace function public.block_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id = auth.uid() then
    raise exception 'invalid_user' using errcode = '22023';
  end if;
  insert into public.user_blocks (blocker_id, blocked_id)
  values (auth.uid(), p_user_id)
  on conflict do nothing;
end;
$$;

create or replace function public.unblock_user(p_user_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.user_blocks
  where blocker_id = (select auth.uid()) and blocked_id = p_user_id;
$$;

create or replace function public.list_blocked_users()
returns table (id uuid, name text, avatar_url text)
language sql
stable
security definer
set search_path = ''
as $$
  select b.blocked_id, p.name, p.avatar_url
  from public.user_blocks b
  cross join lateral public.user_public_profile(b.blocked_id) p
  where b.blocker_id = (select auth.uid())
  order by p.name;
$$;

-- =============================================================
-- RPCs: push
-- =============================================================

create or replace function public.register_push_token(
  p_token text,
  p_platform text,
  p_language text default 'pt'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Sem sessão.' using errcode = '28000';
  end if;
  if p_token !~ '^Expo(nent)?PushToken\[.+\]$' then
    raise exception 'invalid_token' using errcode = '22023';
  end if;

  insert into public.push_tokens (token, user_id, platform, language, updated_at)
  values (p_token, auth.uid(), p_platform, coalesce(nullif(p_language, ''), 'pt'), now())
  on conflict (token) do update
    set user_id = excluded.user_id,
        platform = excluded.platform,
        language = excluded.language,
        updated_at = now();
end;
$$;

create or replace function public.unregister_push_token(p_token text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.push_tokens where token = p_token and user_id = (select auth.uid());
$$;

-- Usada só pela Edge Function chat-push (service role): para quem enviar e o quê.
-- Ignora quem enviou, quem silenciou a conversa e quem bloqueou o remetente.
create or replace function public.chat_push_targets(p_message_id uuid)
returns table (
  token text,
  language text,
  conversation_id uuid,
  kind text,
  community_name text,
  sender_name text,
  body text,
  has_attachment boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    t.token,
    t.language,
    m.conversation_id,
    c.kind,
    cm.name,
    m.sender_name,
    m.body,
    m.attachment_path is not null
  from public.messages m
  join public.conversations c on c.id = m.conversation_id
  left join public.communities cm on cm.id = c.community_id
  join public.conversation_members mem on mem.conversation_id = m.conversation_id
  join public.push_tokens t on t.user_id = mem.user_id
  where m.id = p_message_id
    and m.deleted_at is null
    and mem.user_id <> m.sender_id
    and not mem.muted
    and not public.is_blocked_between(mem.user_id, m.sender_id);
$$;

-- =============================================================
-- Permissões das funções
-- =============================================================

revoke execute on function
  public.refresh_user_directory(uuid),
  public.sync_user_directory_from_auth(),
  public.sync_user_directory_from_profile(),
  public.is_blocked_between(uuid, uuid),
  public.conversation_role(uuid),
  public.is_conversation_moderator(uuid),
  public.chat_media_conversation(text),
  public.publish_message_update(),
  public.request_chat_push(),
  public.list_conversations(uuid),
  public.list_communities(),
  public.set_conversation_muted(uuid, boolean),
  public.join_community_by_code(text),
  public.create_community(text, text, boolean),
  public.update_community(uuid, text, text, boolean),
  public.delete_community(uuid),
  public.get_community_invite(uuid),
  public.regenerate_community_invite(uuid),
  public.list_conversation_members(uuid),
  public.set_member_role(uuid, uuid, text),
  public.remove_member(uuid, uuid, boolean, text),
  public.list_community_bans(uuid),
  public.unban_member(uuid, uuid),
  public.edit_message(uuid, text),
  public.delete_message(uuid),
  public.report_message(uuid, text),
  public.block_user(uuid),
  public.unblock_user(uuid),
  public.list_blocked_users(),
  public.register_push_token(text, text, text),
  public.unregister_push_token(text),
  public.chat_push_targets(uuid)
from public, anon;

-- Usadas pelas policies de Storage (rodam como o usuário logado).
grant execute on function
  public.is_conversation_moderator(uuid),
  public.chat_media_conversation(text)
to authenticated;

-- RPCs chamadas pelo app.
grant execute on function
  public.list_conversations(uuid),
  public.list_communities(),
  public.set_conversation_muted(uuid, boolean),
  public.join_community_by_code(text),
  public.create_community(text, text, boolean),
  public.update_community(uuid, text, text, boolean),
  public.delete_community(uuid),
  public.get_community_invite(uuid),
  public.regenerate_community_invite(uuid),
  public.list_conversation_members(uuid),
  public.set_member_role(uuid, uuid, text),
  public.remove_member(uuid, uuid, boolean, text),
  public.list_community_bans(uuid),
  public.unban_member(uuid, uuid),
  public.edit_message(uuid, text),
  public.delete_message(uuid),
  public.report_message(uuid, text),
  public.block_user(uuid),
  public.unblock_user(uuid),
  public.list_blocked_users(),
  public.register_push_token(text, text, text),
  public.unregister_push_token(text)
to authenticated;

-- Internas.
revoke execute on function
  public.refresh_user_directory(uuid),
  public.sync_user_directory_from_auth(),
  public.sync_user_directory_from_profile(),
  public.is_blocked_between(uuid, uuid),
  public.conversation_role(uuid),
  public.publish_message_update(),
  public.request_chat_push(),
  public.chat_push_targets(uuid)
from authenticated;

grant execute on function public.chat_push_targets(uuid) to service_role;
