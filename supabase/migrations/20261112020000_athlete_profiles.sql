-- Dados esportivos opcionais. As políticas existentes continuam limitando
-- leitura e escrita ao dono do perfil.
create function public.valid_profile_competitions(items jsonb)
returns boolean
language plpgsql stable
set search_path = ''
as $$
declare item jsonb;
begin
  if jsonb_typeof(items) <> 'array' then return false; end if;
  if jsonb_array_length(items) > 30 then return false; end if;
  for item in select value from jsonb_array_elements(items) loop
    if jsonb_typeof(item) <> 'object'
      or not (item ?& array['name', 'year', 'result'])
      or jsonb_typeof(item->'name') <> 'string'
      or char_length(btrim(item->>'name')) not between 1 and 100
      or jsonb_typeof(item->'year') <> 'number'
      or (item->>'year') !~ '^[0-9]{4}$'
      or (item->>'year')::numeric not between 1900 and extract(year from current_date)
      or jsonb_typeof(item->'result') <> 'string'
      or item->>'result' not in ('participated', 'gold', 'silver', 'bronze')
    then return false; end if;
  end loop;
  return true;
end;
$$;

alter table public.profiles
  add column bio text not null default '' check (char_length(bio) <= 300),
  add column instagram text not null default '' check (
    instagram = '' or (
      char_length(instagram) <= 30
      and instagram ~ '^[A-Za-z0-9_]([A-Za-z0-9_.]*[A-Za-z0-9_])?$'
      and instagram not like '%..%'
    )
  ),
  add column belt text check (belt in ('white', 'grey', 'yellow', 'orange', 'green', 'blue', 'purple', 'brown', 'black', 'coral', 'red')),
  add column belt_degree integer not null default 0 check (belt_degree between 0 and 6),
  add column disciplines text[] not null default '{}' check (
    cardinality(disciplines) <= 7
    and disciplines <@ array['gi', 'nogi', 'judo', 'wrestling', 'mma', 'muayThai', 'boxing']::text[]
    and array_position(disciplines, null) is null
  ),
  add column other_disciplines text not null default '' check (char_length(other_disciplines) <= 100),
  add column competitions jsonb not null default '[]'::jsonb check (public.valid_profile_competitions(competitions)),
  add constraint profile_degree_requires_belt check (belt is not null or belt_degree = 0);
