-- =============================================================
-- Chat: conversas privadas (DM) e comunidades
-- =============================================================
-- Fonte da verdade: as tabelas abaixo. O Realtime (Broadcast em canal privado)
-- só avisa os clientes que algo mudou; o app sempre consegue se recuperar
-- buscando no banco (mensagens perdidas enquanto estava offline, por exemplo).
--
-- Tópicos do Realtime:
--   conversation:<uuid>  → mensagens novas (evento "message") + presence (digitando)
--   user:<uuid>          → avisos pessoais (evento "conversation_updated", só DMs)
--
-- IMPORTANTE (painel do Supabase): em Realtime → Settings, desligue
-- "Allow public access" para que só canais privados sejam aceitos.

-- ---------- Tabelas ----------
create table public.communities (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 3 and 60),
  description text not null default '' check (char_length(description) <= 280),
  avatar_url text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('dm', 'community')),
  -- Cada comunidade tem exatamente uma conversa.
  community_id uuid unique references public.communities (id) on delete cascade,
  -- DM: '<menor uuid>:<maior uuid>' — garante uma única conversa por par.
  dm_key text unique,
  last_message_at timestamptz,
  last_message_body text,
  last_message_sender_id uuid,
  created_at timestamptz not null default now(),
  check ((kind = 'community') = (community_id is not null)),
  check ((kind = 'dm') = (dm_key is not null))
);

create table public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  last_read_at timestamptz not null default now(),
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create index conversation_members_user_id_idx on public.conversation_members (user_id);

create table public.messages (
  -- O id vem do app: permite envio otimista e descartar a cópia que chega pelo Realtime.
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  -- Preenchidos pelo trigger a partir do perfil (não confiamos no cliente).
  sender_name text not null default '',
  sender_avatar_url text,
  created_at timestamptz not null default now()
);

-- Paginação por cursor (created_at, id), da mais nova para a mais antiga.
create index messages_conversation_created_idx
  on public.messages (conversation_id, created_at desc, id desc);
create index messages_sender_id_idx on public.messages (sender_id);

-- ---------- Funções auxiliares ----------

-- Nome e foto públicos de um usuário (mesma regra dos comentários).
create or replace function public.user_public_profile(uid uuid)
returns table (name text, avatar_url text)
language sql
stable
security definer
set search_path = ''
as $$
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
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.id = uid;
$$;

-- security definer: evita recursão de RLS ao consultar conversation_members.
create or replace function public.is_conversation_member(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.conversation_members
    where conversation_id = cid and user_id = (select auth.uid())
  );
$$;

-- Quem pode ouvir/publicar em cada tópico do Realtime.
create or replace function public.can_access_realtime_topic(topic text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when topic = 'user:' || (select auth.uid())::text then true
    when topic ~ '^conversation:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.is_conversation_member(substr(topic, 14)::uuid)
    else false
  end;
$$;

-- ---------- Triggers de mensagens ----------

create or replace function public.prepare_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.sender_id := auth.uid();
  new.body := btrim(new.body);
  -- Horário sempre do servidor: é ele que define a ordem das mensagens.
  new.created_at := now();

  select p.name, p.avatar_url
  into new.sender_name, new.sender_avatar_url
  from public.user_public_profile(new.sender_id) p;

  return new;
end;
$$;

create trigger messages_prepare
  before insert on public.messages
  for each row execute function public.prepare_message();

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
      last_message_sender_id = new.sender_id
  where id = new.conversation_id
  returning * into conv;

  -- Quem enviou já leu a própria mensagem.
  update public.conversation_members
  set last_read_at = new.created_at
  where conversation_id = new.conversation_id and user_id = new.sender_id;

  -- Falha no Realtime nunca deve impedir a mensagem de ser salva:
  -- os clientes recuperam o que perderam buscando no banco.
  begin
    perform realtime.send(
      payload => to_jsonb(new),
      event => 'message',
      topic => 'conversation:' || new.conversation_id::text,
      private => true
    );

    -- Só DMs avisam cada membro no canal pessoal. Em comunidades isso
    -- multiplicaria o custo pelo número de membros; lá a lista de conversas
    -- é atualizada quando a aba ganha foco.
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

create trigger messages_publish
  after insert on public.messages
  for each row execute function public.publish_message();

-- =============================================================
-- Row Level Security
-- =============================================================
alter table public.communities enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

-- Comunidades: qualquer usuário logado vê a lista. Criar/entrar/sair é por RPC.
create policy "Comunidades são visíveis para usuários logados" on public.communities
  for select to authenticated using (true);

create policy "Membro vê a conversa" on public.conversations
  for select to authenticated using (public.is_conversation_member(id));

create policy "Membro vê os membros da conversa" on public.conversation_members
  for select to authenticated using (public.is_conversation_member(conversation_id));

create policy "Membro lê as mensagens" on public.messages
  for select to authenticated using (public.is_conversation_member(conversation_id));
create policy "Membro envia mensagem em seu nome" on public.messages
  for insert to authenticated
  with check ((select auth.uid()) = sender_id and public.is_conversation_member(conversation_id));

grant select on public.communities, public.conversations, public.conversation_members, public.messages
  to authenticated;
grant insert on public.messages to authenticated;

-- ---------- Realtime Authorization (canais privados) ----------
-- Obs.: RLS já vem ativo em realtime.messages; não rode "enable row level security" nela.
-- Leitura: broadcast (mensagens) e presence (digitando) para quem é membro.
create policy "Chat: membro ouve o canal" on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension in ('broadcast', 'presence')
    and public.can_access_realtime_topic((select realtime.topic()))
  );

-- Escrita: só presence. Mensagens só saem do banco (trigger), assim ninguém
-- consegue forjar uma mensagem em nome de outra pessoa pelo canal.
create policy "Chat: membro publica presença" on realtime.messages
  for insert to authenticated
  with check (
    realtime.messages.extension = 'presence'
    and public.can_access_realtime_topic((select realtime.topic()))
  );

-- =============================================================
-- RPCs
-- =============================================================

-- Lista de conversas do usuário (ou uma só, com p_conversation_id).
create or replace function public.list_conversations(p_conversation_id uuid default null)
returns table (
  id uuid,
  kind text,
  title text,
  avatar_url text,
  community_id uuid,
  other_user_id uuid,
  member_count integer,
  last_message_body text,
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
    coalesce(cm.name, other.name, 'Conversa') as title,
    coalesce(cm.avatar_url, other.avatar_url) as avatar_url,
    c.community_id,
    other.user_id as other_user_id,
    (select count(*)::int from public.conversation_members x where x.conversation_id = c.id),
    c.last_message_body,
    c.last_message_at,
    c.last_message_sender_id,
    -- Limitado a 100 para não contar milhares de linhas (o app mostra "99+").
    (
      select count(*)::int from (
        select 1 from public.messages m
        where m.conversation_id = c.id
          and m.created_at > me.last_read_at
          and m.sender_id <> me.user_id
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

create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.conversation_members
  set last_read_at = now()
  where conversation_id = p_conversation_id and user_id = (select auth.uid());
$$;

-- Busca pessoas pelo nome para iniciar uma DM. Nunca expõe e-mail.
create or replace function public.search_users(p_query text)
returns table (id uuid, name text, avatar_url text)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, p.name, p.avatar_url
  from auth.users u
  cross join lateral public.user_public_profile(u.id) p
  where char_length(btrim(p_query)) >= 2
    and u.id <> (select auth.uid())
    and p.name ilike '%' || replace(replace(replace(btrim(p_query), '\', '\\'), '%', '\%'), '_', '\_') || '%'
  order by p.name
  limit 20;
$$;

-- Abre a DM com outra pessoa (cria na primeira vez) e devolve o id da conversa.
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

create or replace function public.list_communities()
returns table (
  id uuid,
  name text,
  description text,
  avatar_url text,
  conversation_id uuid,
  member_count integer,
  is_member boolean
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
    c.id,
    (select count(*)::int from public.conversation_members x where x.conversation_id = c.id),
    exists (
      select 1 from public.conversation_members x
      where x.conversation_id = c.id and x.user_id = (select auth.uid())
    )
  from public.communities cm
  join public.conversations c on c.community_id = cm.id
  order by cm.name;
$$;

-- Entra na comunidade e devolve o id da conversa dela.
create or replace function public.join_community(p_community_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  conv_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sem sessão.' using errcode = '28000';
  end if;

  select c.id into conv_id from public.conversations c where c.community_id = p_community_id;
  if conv_id is null then
    raise exception 'Comunidade não encontrada.' using errcode = 'P0002';
  end if;

  insert into public.conversation_members (conversation_id, user_id)
  values (conv_id, auth.uid())
  on conflict do nothing;

  return conv_id;
end;
$$;

create or replace function public.leave_community(p_community_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.conversation_members m
  using public.conversations c
  where c.community_id = p_community_id
    and m.conversation_id = c.id
    and m.user_id = (select auth.uid());
$$;

-- Cria a comunidade, a conversa dela e coloca quem criou como dono.
create or replace function public.create_community(p_name text, p_description text default '')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  community_id uuid;
  conv_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sem sessão.' using errcode = '28000';
  end if;

  insert into public.communities (name, description, created_by)
  values (btrim(p_name), btrim(coalesce(p_description, '')), auth.uid())
  returning id into community_id;

  insert into public.conversations (kind, community_id)
  values ('community', community_id)
  returning id into conv_id;

  insert into public.conversation_members (conversation_id, user_id, role)
  values (conv_id, auth.uid(), 'owner');

  return conv_id;
end;
$$;

-- ---------- Permissões das funções ----------
-- Por padrão o Postgres libera EXECUTE para todos; aqui fechamos e abrimos só o necessário.
revoke execute on function
  public.user_public_profile(uuid),
  public.is_conversation_member(uuid),
  public.can_access_realtime_topic(text),
  public.prepare_message(),
  public.publish_message(),
  public.list_conversations(uuid),
  public.mark_conversation_read(uuid),
  public.search_users(text),
  public.get_or_create_dm(uuid),
  public.list_communities(),
  public.join_community(uuid),
  public.leave_community(uuid),
  public.create_community(text, text)
from public, anon;

-- Usadas pelas policies (rodam como o usuário logado).
grant execute on function
  public.is_conversation_member(uuid),
  public.can_access_realtime_topic(text)
to authenticated;

-- RPCs chamadas pelo app.
grant execute on function
  public.list_conversations(uuid),
  public.mark_conversation_read(uuid),
  public.search_users(text),
  public.get_or_create_dm(uuid),
  public.list_communities(),
  public.join_community(uuid),
  public.leave_community(uuid),
  public.create_community(text, text)
to authenticated;

-- Internas: não devem ser chamadas pelo app.
revoke execute on function
  public.user_public_profile(uuid),
  public.prepare_message(),
  public.publish_message()
from authenticated;

-- ---------- Comunidades iniciais ----------
with seeded as (
  insert into public.communities (name, description) values
    ('Iniciantes', 'Dúvidas dos primeiros meses de tatame. Nenhuma pergunta é boba.'),
    ('Competição', 'Preparação, regras e resenha de campeonatos.'),
    ('Jogo de guarda', 'Fechada, aranha, De La Riva, laçada e tudo que se joga por baixo.')
  returning id
)
insert into public.conversations (kind, community_id)
select 'community', id from seeded;
