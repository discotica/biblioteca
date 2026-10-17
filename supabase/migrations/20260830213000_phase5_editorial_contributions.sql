-- Fase 5: propuestas moderadas. Las contribuciones nunca escriben el catálogo
-- directamente; la publicación ocurre dentro de review_contribution.
create schema if not exists private;

alter table public.profiles
  add column if not exists role text not null default 'comunidad'
  check (role in ('admin', 'colaborador', 'comunidad'));

create table public.contributions (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'draft'
    check (status in ('draft', 'pending', 'changes_requested', 'rejected', 'approved')),
  source_url text not null check (source_url ~* '^https://'),
  source_provider text,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  reviewer_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  release_id uuid references public.releases(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index contributions_queue_idx on public.contributions (status, created_at)
  where status in ('pending', 'changes_requested');
create index contributions_author_idx on public.contributions (author_id, updated_at desc);

create table public.contribution_events (
  id bigint generated always as identity primary key,
  contribution_id uuid not null references public.contributions(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null check (action in ('created', 'updated', 'submitted', 'changes_requested', 'rejected', 'approved')),
  before_payload jsonb,
  after_payload jsonb,
  note text,
  created_at timestamptz not null default now()
);

create index contribution_events_contribution_idx
  on public.contribution_events (contribution_id, created_at);

alter table public.contributions enable row level security;
alter table public.contribution_events enable row level security;

create or replace function private.is_editor()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role in ('admin', 'colaborador')
  );
$$;

create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

revoke all on function private.is_editor() from public, anon, authenticated;
revoke all on function private.is_admin() from public, anon, authenticated;

grant select, insert on public.contributions to authenticated;
grant update (payload, source_url, source_provider, status, updated_at) on public.contributions to authenticated;
grant select on public.contribution_events to authenticated;

create policy "authors read their contributions and editors read the queue" on public.contributions
  for select to authenticated
  using (author_id = (select auth.uid()) or (select private.is_editor()));
create policy "authors create their own drafts" on public.contributions
  for insert to authenticated
  with check (author_id = (select auth.uid()) and status = 'draft');
create policy "authors edit only drafts" on public.contributions
  for update to authenticated
  using (author_id = (select auth.uid()) and status in ('draft', 'changes_requested'))
  with check (author_id = (select auth.uid()) and status in ('draft', 'pending'));
create policy "authors and editors read contribution history" on public.contribution_events
  for select to authenticated
  using (
    (select private.is_editor()) or exists (
      select 1 from public.contributions c
      where c.id = contribution_id and c.author_id = (select auth.uid())
    )
  );

create or replace function public.record_contribution_event()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.contribution_events (contribution_id, actor_id, action, before_payload, after_payload)
  values (
    new.id,
    (select auth.uid()),
    case when tg_op = 'INSERT' then 'created'
      when new.status = 'pending' then 'submitted'
      else 'updated' end,
    case when tg_op = 'INSERT' then null else old.payload end,
    new.payload
  );
  return new;
end;
$$;

create trigger record_contribution_event
after insert or update of payload, status on public.contributions
for each row execute function public.record_contribution_event();

-- La única transición editorial con privilegios también publica un release.
-- El payload editable contiene title, artists[], type, label, release_date,
-- review, source_url y cover_url; los campos no presentes son opcionales.
create or replace function public.review_contribution(
  p_contribution_id uuid,
  p_action text,
  p_note text default null
)
returns public.contributions
language plpgsql security definer set search_path = '' as $$
declare
  c public.contributions%rowtype;
  p jsonb;
  p_release_id uuid;
  p_artist_id uuid;
  p_label_id uuid;
  p_type_id uuid;
  p_artist text;
  p_slug_base text;
  p_url text;
  p_cover text;
  p_date date;
begin
  if not (select private.is_editor()) then
    raise exception 'Editorial role required' using errcode = '42501';
  end if;
  if p_action not in ('changes_requested', 'rejected', 'approved') then
    raise exception 'Invalid review action';
  end if;

  select * into c from public.contributions where id = p_contribution_id for update;
  if not found or c.status <> 'pending' then
    raise exception 'Only pending contributions can be reviewed';
  end if;
  if p_action in ('changes_requested', 'rejected') and nullif(btrim(coalesce(p_note, '')), '') is null then
    raise exception 'A reviewer note is required';
  end if;

  if p_action = 'approved' then
    p := c.payload;
    if nullif(btrim(p ->> 'title'), '') is null
      or jsonb_typeof(p -> 'artists') <> 'array'
      or jsonb_array_length(p -> 'artists') = 0 then
      raise exception 'title and at least one artist are required to publish';
    end if;
    if nullif(p ->> 'release_date', '') is not null then
      p_date := (p ->> 'release_date')::date;
    end if;
    p_slug_base := regexp_replace(lower(coalesce(p ->> 'title', 'release')), '[^a-z0-9]+', '-', 'g');
    p_slug_base := trim(both '-' from p_slug_base);
    if p_slug_base = '' then p_slug_base := 'release'; end if;

    if nullif(btrim(p ->> 'label'), '') is not null then
      insert into public.labels (name, normalized_name, slug)
      values (btrim(p ->> 'label'), lower(btrim(p ->> 'label')), 'label--' || substr(md5(lower(btrim(p ->> 'label'))), 1, 8))
      on conflict (normalized_name) do update set updated_at = now()
      returning id into p_label_id;
    end if;
    if nullif(btrim(p ->> 'type'), '') is not null then
      insert into public.release_types (name, normalized_name, slug)
      values (btrim(p ->> 'type'), lower(btrim(p ->> 'type')), 'type--' || substr(md5(lower(btrim(p ->> 'type'))), 1, 8))
      on conflict (normalized_name) do update set updated_at = now()
      returning id into p_type_id;
    end if;
    insert into public.releases (slug, title, release_date, release_type_id, label_id, review, status)
    values (p_slug_base || '--' || substr(replace(c.id::text, '-', ''), 1, 8), btrim(p ->> 'title'), p_date,
      p_type_id, p_label_id, coalesce(p ->> 'review', ''), 'published')
    returning id into p_release_id;
    for p_artist in select btrim(value) from jsonb_array_elements_text(p -> 'artists') as artists(value) loop
      if p_artist <> '' then
        insert into public.artists (name, normalized_name, slug)
        values (p_artist, lower(p_artist), 'artist--' || substr(md5(lower(p_artist)), 1, 8))
        on conflict (normalized_name) do update set updated_at = now()
        returning id into p_artist_id;
        insert into public.release_artists (release_id, artist_id, position)
        values (p_release_id, p_artist_id, coalesce((select max(position) + 1 from public.release_artists where release_id = p_release_id), 0));
      end if;
    end loop;
    p_url := coalesce(nullif(btrim(p ->> 'source_url'), ''), c.source_url);
    insert into public.release_links (release_id, provider, url)
    values (p_release_id, coalesce(nullif(c.source_provider, ''), 'manual'), p_url);
    p_cover := nullif(btrim(p ->> 'cover_url'), '');
    if p_cover ~* '^https://' then
      insert into public.release_covers (release_id, url, source_url)
      values (p_release_id, p_cover, p_url);
    end if;
  end if;

  update public.contributions
  set status = p_action,
      reviewer_note = nullif(btrim(coalesce(p_note, '')), ''),
      reviewed_by = (select auth.uid()), reviewed_at = now(),
      release_id = p_release_id, updated_at = now()
  where id = c.id
  returning * into c;
  insert into public.contribution_events (contribution_id, actor_id, action, before_payload, after_payload, note)
  values (c.id, (select auth.uid()), p_action, c.payload, c.payload, c.reviewer_note);
  return c;
end;
$$;

revoke all on function public.record_contribution_event() from public, anon, authenticated;
revoke all on function public.review_contribution(uuid, text, text) from public, anon;
grant execute on function public.review_contribution(uuid, text, text) to authenticated;

-- Objetos temporales: privados, con dueño y propuesta verificables por RLS.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('contribution-covers', 'contribution-covers', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "authors upload their contribution covers" on storage.objects for insert to authenticated
with check (
  bucket_id = 'contribution-covers'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and exists (select 1 from public.contributions c
    where c.id::text = (storage.foldername(name))[2] and c.author_id = (select auth.uid()))
);
create policy "authors and editors read contribution covers" on storage.objects for select to authenticated
using (
  bucket_id = 'contribution-covers' and (
    owner_id = (select auth.uid()::text) or (select private.is_editor())
  )
);
create policy "authors delete their pending contribution covers" on storage.objects for delete to authenticated
using (bucket_id = 'contribution-covers' and owner_id = (select auth.uid()::text));
