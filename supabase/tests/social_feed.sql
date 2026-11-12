-- Depois das migrações; todos os registros de teste são revertidos.
begin;
insert into auth.users(id, email, raw_user_meta_data, created_at) values
 ('e0000000-0000-4000-8000-000000000001','feed-a@example.invalid','{"name":"Atleta A"}',now()),
 ('e0000000-0000-4000-8000-000000000002','feed-b@example.invalid','{"name":"Atleta B"}',now()),
 ('e0000000-0000-4000-8000-000000000003','feed-c@example.invalid','{"name":"Atleta C"}',now());
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"e0000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select set_config('test.post_a',public.create_social_post('Treino de judô!')::text,true);
select set_config('test.post_a2',public.create_social_post('Mais um treino.')::text,true);
select set_config('request.jwt.claims','{"sub":"e0000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select set_config('test.post_c',public.create_social_post('Post de outra pessoa.')::text,true);
select set_config('request.jwt.claims','{"sub":"e0000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select set_config('test.post_b',public.create_social_post('Meu post.')::text,true);
select public.set_social_follow('e0000000-0000-4000-8000-000000000001',true);
select public.set_social_follow('e0000000-0000-4000-8000-000000000001',true);
select public.set_social_like(current_setting('test.post_a')::uuid,true);
select public.set_social_like(current_setting('test.post_a')::uuid,true);
select set_config('test.reply',public.create_social_post('Oss!',current_setting('test.post_a')::uuid)::text,true);
do $$ declare p record; next_p record; stats record;
begin
  select * into p from public.list_social_posts(p_post_id => current_setting('test.post_a')::uuid);
  assert p.author_id = 'e0000000-0000-4000-8000-000000000001';
  assert p.like_count = 1 and p.reply_count = 1 and p.liked;
  assert (select count(*) from public.list_social_posts(p_following => true)) = 3;
  assert not exists (select 1 from public.list_social_posts(p_following => true) where author_id = 'e0000000-0000-4000-8000-000000000003');
  assert (select count(*) from public.list_social_posts(p_parent_id => current_setting('test.post_a')::uuid)) = 1;
  select * into stats from public.get_social_stats('e0000000-0000-4000-8000-000000000001');
  assert stats.post_count = 2 and stats.follower_count = 1 and stats.is_following;
  select * into p from public.list_social_posts(p_limit => 1);
  select * into next_p from public.list_social_posts(p_before_at => p.created_at, p_before_id => p.id, p_limit => 1);
  assert (next_p.created_at, next_p.id) < (p.created_at, p.id);
  begin
    perform public.edit_social_post(current_setting('test.post_a')::uuid,'Edição indevida');
    raise exception 'A edição de publicação alheia foi permitida';
  exception when insufficient_privilege then null; end;
  begin
    perform public.delete_social_post(current_setting('test.post_a')::uuid);
    raise exception 'A exclusão de publicação alheia foi permitida';
  exception when insufficient_privilege then null; end;
  begin
    perform public.create_social_post(E'\n\t');
    raise exception 'Publicação sem texto foi permitida';
  exception when check_violation then null; end;
  begin
    perform public.create_social_post(repeat('x',501));
    raise exception 'Limite de texto não foi aplicado';
  exception when check_violation then null; end;
  begin
    perform public.create_social_post('Resposta aninhada',current_setting('test.reply')::uuid);
    raise exception 'Era esperada uma publicação principal como pai';
  exception when insufficient_privilege then null; end;
  perform public.report_social_post(current_setting('test.post_a')::uuid);
  perform public.report_social_post(current_setting('test.post_a')::uuid);
  perform public.edit_social_post(current_setting('test.post_b')::uuid,'Editado pelo dono.');
  select * into p from public.list_social_posts(p_post_id => current_setting('test.post_b')::uuid);
  assert p.body = 'Editado pelo dono.' and p.edited_at is not null;
end $$;
select public.block_user('e0000000-0000-4000-8000-000000000001');
do $$ begin
  assert (select count(*) from public.list_social_posts(p_post_id => current_setting('test.post_a')::uuid)) = 0;
  assert (select count(*) from public.list_social_posts(p_parent_id => current_setting('test.post_a')::uuid)) = 0;
  assert (select count(*) from public.get_social_stats('e0000000-0000-4000-8000-000000000001')) = 0;
  begin
    perform public.set_social_like(current_setting('test.post_a')::uuid,true);
    raise exception 'Foi possível interagir com perfil bloqueado';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"e0000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$ begin
  assert (select count(*) from public.list_social_posts(p_post_id => current_setting('test.post_b')::uuid)) = 0;
end $$;
reset role;
do $$ begin
  assert (select count(*) from public.social_follows where follower_id = 'e0000000-0000-4000-8000-000000000002') = 0;
  assert not has_function_privilege('anon','public.create_social_post(text,uuid)','execute');
  assert not has_table_privilege('authenticated','public.social_posts','INSERT');
  assert not has_table_privilege('authenticated','public.social_post_reports','SELECT');
  assert (select count(*) from public.social_post_reports where post_id = current_setting('test.post_a')::uuid) = 1;
end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"e0000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select public.delete_social_post(current_setting('test.post_a')::uuid);
reset role;
do $$ begin
  assert not exists (select 1 from public.social_posts where id = current_setting('test.reply')::uuid);
  assert not exists (select 1 from public.social_likes where post_id = current_setting('test.post_a')::uuid);
end $$;
rollback;
