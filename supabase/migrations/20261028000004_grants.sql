-- Permisos explícitos para la Data API.
-- El proyecto tiene desactivado "Automatically expose new tables", así que
-- ninguna tabla es visible por defecto: solo `authenticated` recibe permisos
-- y siempre pasa por RLS. El rol `anon` no recibe nada.

grant usage on schema public to authenticated;

grant select, insert, update, delete on public.quotes to authenticated;
grant select, insert, update, delete on public.quote_versions to authenticated;
grant select, insert, update, delete on public.media to authenticated;
grant select, insert, update, delete on public.bank_items to authenticated;
grant select, insert on public.publish_jobs to authenticated;

revoke all on public.quotes from anon;
revoke all on public.quote_versions from anon;
revoke all on public.media from anon;
revoke all on public.bank_items from anon;
revoke all on public.publish_jobs from anon;
