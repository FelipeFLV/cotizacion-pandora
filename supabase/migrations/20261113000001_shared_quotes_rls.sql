-- Migración para acceso compartido entre usuarios autenticados autorizados.
-- Permite que los usuarios de Pandora compartan y editen las mismas cotizaciones,
-- historial de versiones, medios y banco de evidencias.

-- 1. Tablas principales (quotes, quote_versions, media, bank_items, publish_jobs)
drop policy if exists quotes_select_own on public.quotes;
drop policy if exists quotes_insert_own on public.quotes;
drop policy if exists quotes_update_own on public.quotes;
drop policy if exists quotes_delete_own on public.quotes;

create policy quotes_select_auth on public.quotes for select to authenticated
  using (true);
create policy quotes_insert_auth on public.quotes for insert to authenticated
  with check (owner_id = auth.uid());
create policy quotes_update_auth on public.quotes for update to authenticated
  using (true) with check (true);
create policy quotes_delete_auth on public.quotes for delete to authenticated
  using (true);

drop policy if exists quote_versions_select_own on public.quote_versions;
drop policy if exists quote_versions_insert_own on public.quote_versions;
drop policy if exists quote_versions_update_own on public.quote_versions;
drop policy if exists quote_versions_delete_own on public.quote_versions;

create policy quote_versions_select_auth on public.quote_versions for select to authenticated
  using (true);
create policy quote_versions_insert_auth on public.quote_versions for insert to authenticated
  with check (owner_id = auth.uid());
create policy quote_versions_update_auth on public.quote_versions for update to authenticated
  using (true) with check (true);
create policy quote_versions_delete_auth on public.quote_versions for delete to authenticated
  using (true);

drop policy if exists media_select_own on public.media;
drop policy if exists media_insert_own on public.media;
drop policy if exists media_update_own on public.media;
drop policy if exists media_delete_own on public.media;

create policy media_select_auth on public.media for select to authenticated
  using (true);
create policy media_insert_auth on public.media for insert to authenticated
  with check (owner_id = auth.uid());
create policy media_update_auth on public.media for update to authenticated
  using (true) with check (true);
create policy media_delete_auth on public.media for delete to authenticated
  using (true);

drop policy if exists bank_items_select_own on public.bank_items;
drop policy if exists bank_items_insert_own on public.bank_items;
drop policy if exists bank_items_update_own on public.bank_items;
drop policy if exists bank_items_delete_own on public.bank_items;

create policy bank_items_select_auth on public.bank_items for select to authenticated
  using (true);
create policy bank_items_insert_auth on public.bank_items for insert to authenticated
  with check (owner_id = auth.uid());
create policy bank_items_update_auth on public.bank_items for update to authenticated
  using (true) with check (true);
create policy bank_items_delete_auth on public.bank_items for delete to authenticated
  using (true);

drop policy if exists publish_jobs_select_own on public.publish_jobs;
create policy publish_jobs_select_auth on public.publish_jobs for select to authenticated
  using (true);
create policy publish_jobs_insert_auth on public.publish_jobs for insert to authenticated
  with check (owner_id = auth.uid());

-- 2. Storage (bucket 'drafts' compartido para todo el equipo autenticado)
drop policy if exists drafts_select_own on storage.objects;
drop policy if exists drafts_insert_own on storage.objects;
drop policy if exists drafts_update_own on storage.objects;
drop policy if exists drafts_delete_own on storage.objects;

create policy drafts_select_auth on storage.objects for select to authenticated
  using (bucket_id = 'drafts');
create policy drafts_insert_auth on storage.objects for insert to authenticated
  with check (bucket_id = 'drafts');
create policy drafts_update_auth on storage.objects for update to authenticated
  using (bucket_id = 'drafts');
create policy drafts_delete_auth on storage.objects for delete to authenticated
  using (bucket_id = 'drafts');
