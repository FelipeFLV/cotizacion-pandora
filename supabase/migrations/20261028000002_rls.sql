-- RLS: cada usuario solo ve y escribe sus propias filas.
-- El rol anónimo no tiene ninguna política y, por tanto, no ve nada.

alter table public.quotes enable row level security;
create policy quotes_select_own on public.quotes for select to authenticated
  using (owner_id = auth.uid());
create policy quotes_insert_own on public.quotes for insert to authenticated
  with check (owner_id = auth.uid());
create policy quotes_update_own on public.quotes for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy quotes_delete_own on public.quotes for delete to authenticated
  using (owner_id = auth.uid());

alter table public.quote_versions enable row level security;
create policy quote_versions_select_own on public.quote_versions for select to authenticated
  using (owner_id = auth.uid());
create policy quote_versions_insert_own on public.quote_versions for insert to authenticated
  with check (owner_id = auth.uid());
create policy quote_versions_update_own on public.quote_versions for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy quote_versions_delete_own on public.quote_versions for delete to authenticated
  using (owner_id = auth.uid());

alter table public.media enable row level security;
create policy media_select_own on public.media for select to authenticated
  using (owner_id = auth.uid());
create policy media_insert_own on public.media for insert to authenticated
  with check (owner_id = auth.uid());
create policy media_update_own on public.media for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy media_delete_own on public.media for delete to authenticated
  using (owner_id = auth.uid());

alter table public.bank_items enable row level security;
create policy bank_items_select_own on public.bank_items for select to authenticated
  using (owner_id = auth.uid());
create policy bank_items_insert_own on public.bank_items for insert to authenticated
  with check (owner_id = auth.uid());
create policy bank_items_update_own on public.bank_items for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy bank_items_delete_own on public.bank_items for delete to authenticated
  using (owner_id = auth.uid());

alter table public.publish_jobs enable row level security;
create policy publish_jobs_select_own on public.publish_jobs for select to authenticated
  using (owner_id = auth.uid());
