-- Esquema privado del panel de cotizaciones.
-- Toda fila pertenece a un usuario; las políticas viven en 20261028000002_rls.sql.

create extension if not exists pgcrypto;

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  slug text unique check (slug is null or slug ~ '^[a-z0-9][a-z0-9-]{1,63}$'),
  status text not null default 'draft' check (status in ('draft', 'published', 'retired')),
  is_template boolean not null default false,
  data jsonb not null,
  published_url text not null default '',
  published_at timestamptz,
  retired_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index quotes_one_template_per_owner
  on public.quotes (owner_id) where is_template;
create index quotes_owner_updated on public.quotes (owner_id, updated_at desc);

alter table public.quotes
  add constraint template_not_archived check (archived_at is null or is_template = false);

create table public.quote_versions (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null,
  label text not null default '',
  published boolean not null default false,
  created_at timestamptz not null default now()
);
create index quote_versions_quote on public.quote_versions (quote_id, created_at desc);

create table public.media (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null unique,
  mime text not null check (mime in ('image/jpeg', 'image/png', 'image/webp')),
  bytes integer not null check (bytes > 0 and bytes <= 1572864),
  width integer not null,
  height integer not null,
  created_at timestamptz not null default now()
);

create table public.bank_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('video', 'image')),
  title text not null,
  source text not null check (source in ('upload', 'url', 'legacy')),
  media_id uuid references public.media(id) on delete set null,
  url text not null default '',
  service text not null default '',
  created_at timestamptz not null default now()
);

create table public.publish_jobs (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'running', 'ok', 'error')),
  url text not null default '',
  error text not null default '',
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index publish_jobs_quote on public.publish_jobs (quote_id, created_at desc);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger quotes_touch before update on public.quotes
for each row execute function public.touch_updated_at();

create or replace function public.protect_template()
returns trigger language plpgsql as $$
begin
  if old.is_template then
    raise exception 'La plantilla no se elimina';
  end if;
  return old;
end $$;

create trigger quotes_protect_template before delete on public.quotes
for each row execute function public.protect_template();

create or replace function public.prune_versions()
returns trigger language plpgsql as $$
begin
  delete from public.quote_versions
  where quote_id = new.quote_id
    and id not in (
      select id from public.quote_versions
      where quote_id = new.quote_id
      order by created_at desc
      limit 10
    );
  return new;
end $$;

create trigger quote_versions_prune after insert on public.quote_versions
for each row execute function public.prune_versions();
