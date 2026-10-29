-- Permisos mínimos para las Edge Functions.
-- Las funciones usan la clave `service_role`, que salta RLS pero no recibe
-- privilegios por defecto cuando "Automatically expose new tables" está
-- desactivado: sin estos grants publicar y retirar fallan con 404.
-- PostgREST exige además `select` (y `delete` en el historial) para poder
-- devolver la fila insertada.

grant usage on schema public to service_role;

grant select, update on public.quotes to service_role;
grant select on public.media to service_role;
grant select on public.bank_items to service_role;
grant select, insert, delete on public.quote_versions to service_role;
grant select, insert, update on public.publish_jobs to service_role;
