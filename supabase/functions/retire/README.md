# Edge Function `retire`

Retira una cotización publicada borrando **solo** su carpeta en GitHub Pages y
marcando la fila como `retired`. Conserva el borrador, el historial y las imágenes
privadas del cubo `drafts`, así que volver a publicar reutiliza la misma URL.

## Qué hace

1. Valida la sesión y el correo (`ALLOWED_EMAIL`) y la propiedad de la fila.
2. Exige que la cotización tenga `slug` y no sea la plantilla.
3. Lista el árbol de `docs/` y planifica borrar `docs/c/<slug>/` y
   `docs/assets/c/<slug>/` exclusivamente.
4. Si la página existe, comprueba que su `pandora-quote-id` coincide con la fila;
   si pertenece a otra cotización, aborta con `409` sin borrar nada.
5. Hace un commit con las bajas (`sha: null`), actualiza `status='retired'` y
   `retired_at`, y cierra el job de auditoría.

## Despliegue

Mismos secretos que `publish` (ver `../publish/README.md`):

```bash
supabase functions deploy retire
```

## Pruebas

```bash
node --test tests/retire-plan.test.mjs tests/retire-core.test.mjs
```
