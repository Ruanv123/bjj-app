-- =============================================================
-- messages.updated_at: permite ao app recuperar edições e exclusões perdidas
-- =============================================================
-- O Realtime não garante entrega. Ao reconectar, o app buscava só mensagens
-- NOVAS (created_at); uma mensagem editada ou apagada enquanto o canal estava
-- fora nunca era atualizada na tela. Agora ele busca tudo o que MUDOU
-- (updated_at) desde a última sincronização.

alter table public.messages add column updated_at timestamptz;

update public.messages set updated_at = coalesce(deleted_at, edited_at, created_at);

alter table public.messages
  alter column updated_at set not null,
  alter column updated_at set default now();

create index messages_conversation_updated_idx
  on public.messages (conversation_id, updated_at);

-- Sempre definido pelo servidor (o app não escolhe o próprio horário).
create or replace function public.touch_message_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger messages_touch_updated_at
  before insert or update on public.messages
  for each row execute function public.touch_message_updated_at();

revoke execute on function public.touch_message_updated_at() from public, anon, authenticated;
