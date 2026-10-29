-- Bucket privado para imágenes y portadas sin publicar.
-- Cada usuario solo accede a su carpeta: drafts/<uid>/<archivo>.

insert into storage.buckets (id, name, public)
values ('drafts', 'drafts', false)
on conflict (id) do nothing;

create policy drafts_select_own on storage.objects for select to authenticated
  using (bucket_id = 'drafts' and (storage.foldername(name))[1] = auth.uid()::text);

create policy drafts_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'drafts' and (storage.foldername(name))[1] = auth.uid()::text);

create policy drafts_update_own on storage.objects for update to authenticated
  using (bucket_id = 'drafts' and (storage.foldername(name))[1] = auth.uid()::text);

create policy drafts_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'drafts' and (storage.foldername(name))[1] = auth.uid()::text);
