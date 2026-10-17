-- Conserva fielmente filas que no satisfacen el contrato canónico. No se
-- publican ni se convierten en releases mediante valores de relleno.
create table public.catalog_import_rejections (
  source_name text not null check (btrim(source_name) <> ''),
  source_key text not null check (btrim(source_key) <> ''),
  source_hash text not null check (source_hash ~ '^[a-f0-9]{64}$'),
  row_number integer not null check (row_number > 1),
  raw_payload jsonb not null,
  issues jsonb not null check (jsonb_typeof(issues) = 'array' and jsonb_array_length(issues) > 0),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (source_name, source_key)
);

create index catalog_import_rejections_last_seen_idx
  on public.catalog_import_rejections (last_seen_at desc);

alter table public.catalog_import_rejections enable row level security;

-- No se concede acceso a anon/authenticated: los datos defectuosos pueden
-- revisarse mediante conexión administrativa o una futura interfaz editorial.

create function private.record_catalog_import_rejection(
  p_source_name text,
  p_source_key text,
  p_source_hash text,
  p_row_number integer,
  p_raw_payload jsonb,
  p_issues jsonb
)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.catalog_import_rejections (
    source_name, source_key, source_hash, row_number, raw_payload, issues
  ) values (
    p_source_name, p_source_key, p_source_hash, p_row_number, p_raw_payload, p_issues
  )
  on conflict (source_name, source_key) do update
  set source_hash = excluded.source_hash,
      row_number = excluded.row_number,
      raw_payload = excluded.raw_payload,
      issues = excluded.issues,
      last_seen_at = now();
$$;

revoke all on function private.record_catalog_import_rejection(text, text, text, integer, jsonb, jsonb)
  from public, anon, authenticated;
