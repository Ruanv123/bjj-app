-- Execute após aplicar as migrações. Os usuários de teste e suas edições
-- ficam na transação, revertida ao final. Qualquer assert interrompe o teste.
begin;
insert into auth.users(id, email, raw_user_meta_data, created_at)
values
  ('f0000000-0000-4000-8000-000000000001', 'profile-validation-viewer@example.invalid', '{"name":"Atleta visitante"}', now()),
  ('f0000000-0000-4000-8000-000000000002', 'profile-validation-target@example.invalid', '{"name":"Atleta visitada"}', now()),
  ('f0000000-0000-4000-8000-000000000003', 'profile-validation-empty@example.invalid', '{"name":"Atleta nova"}', now());
insert into public.profiles(id, display_name, bio, instagram, belt, belt_degree, disciplines, competitions)
values ('f0000000-0000-4000-8000-000000000002', 'Bia', 'Judoca', 'bia.judo', 'black', 2, array['judo'], '[{"name":"Open","year":2024,"result":"gold"}]');
do $$ begin
  assert not has_function_privilege('anon', 'public.get_athlete_profile(uuid)', 'execute');
  assert has_function_privilege('authenticated', 'public.get_athlete_profile(uuid)', 'execute');
end $$;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$
declare p jsonb;
begin
  select to_jsonb(x) into p from public.get_athlete_profile('f0000000-0000-4000-8000-000000000002') x;
  assert p->>'display_name' = 'Bia';
  assert p->>'bio' = 'Judoca';
  assert p->>'belt_degree' = '2';
  assert p->'competitions'->0->>'result' = 'gold';
  assert not (p ?| array['email','avatar_path','user_metadata']);
  assert (select count(*) from public.profiles where id = 'f0000000-0000-4000-8000-000000000002') = 0;
  update public.profiles set display_name = 'Unauthorized edit' where id = 'f0000000-0000-4000-8000-000000000002';
  assert not found;
  select to_jsonb(x) into p from public.get_athlete_profile('f0000000-0000-4000-8000-000000000003') x;
  assert p->>'display_name' = 'Atleta nova';
  assert p->>'bio' = '';
  assert p->'competitions' = '[]'::jsonb;
  assert (select count(*) from public.get_athlete_profile('f0000000-0000-4000-8000-999999999999')) = 0;
end $$;
reset role;
insert into public.user_blocks(blocker_id, blocked_id)
values ('f0000000-0000-4000-8000-000000000001','f0000000-0000-4000-8000-000000000002');
set local role authenticated;
do $$ begin
  assert (select count(*) from public.get_athlete_profile('f0000000-0000-4000-8000-000000000002')) = 0;
end $$;
reset role;
delete from public.user_blocks where blocker_id = 'f0000000-0000-4000-8000-000000000001';
insert into public.user_blocks(blocker_id, blocked_id)
values ('f0000000-0000-4000-8000-000000000002','f0000000-0000-4000-8000-000000000001');
set local role authenticated;
do $$ begin
  assert (select count(*) from public.get_athlete_profile('f0000000-0000-4000-8000-000000000002')) = 0;
end $$;
reset role;
select set_config('request.jwt.claims', '{}', true);
do $$ begin
  assert (select count(*) from public.get_athlete_profile('f0000000-0000-4000-8000-000000000002')) = 0;
end $$;
rollback;
