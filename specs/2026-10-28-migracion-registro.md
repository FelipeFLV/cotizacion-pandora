# Registro de migración al panel privado

Fecha: 29 de octubre de 2026 · Proyecto Supabase `pandora-cotizaciones` (`zvusvaotqtchaglwyifl`, `sa-east-1`).

## 1. Origen de los datos

La biblioteca de la matriz en este navegador solo tenía H&S y la copia publicada en GitHub Pages está vacía, así que la migración se hizo **desde las páginas publicadas**: cada página incrusta `window.__PANDORA__` con la cotización completa (`quote`, `general`, `meta`).

- `https://felipeflv.github.io/cotizacion-pandora/c/h-s-inmobiliaria-7k2m/`
- `https://felipeflv.github.io/cotizacion-pandora/c/cliente-01-9k4d/`

Copias byte a byte guardadas fuera del repo en `~/.pandora-migration/original/<slug>/index.html` (H&S `053799aa…`, Cliente 01 `3e7b90b6…`) y respaldo `~/.pandora-migration/backup-2026-10-29.json` (10 669 bytes).

El banco de evidencias (10 piezas) se armó con la biblioteca local del navegador. H&S no traía `meta.publishedUrl` en su HTML; se corrigió solo en el respaldo.

## 2. Importación

Hecha con `PADMIN.api.importBackup` (el mismo camino que **Importar respaldo**), ya con sesión real del correo autorizado.

| Resultado | Valor |
| --- | --- |
| Cotizaciones | 2, ambas `published` |
| Slugs y URLs | `h-s-inmobiliaria-7k2m` y `cliente-01-9k4d`, con la URL de siempre |
| Banco | 10 piezas |
| Versiones importadas | 0 (las páginas originales no tenían historial) |

## 3. Plantilla

Se duplicó Cliente 01 y el clon se marcó como plantilla, con el nombre **Plantilla · Cliente 01** para no confundirlo con el cliente real (que sigue publicado).

- Publicar la plantilla devuelve `400 Una plantilla no se puede publicar: crea un cliente a partir de ella.`
- Archivar la plantilla lo bloquea la base: `check constraint "template_not_archived"`.
- En la barra lateral solo ofrece **Nuevo cliente**, sin publicar, historial ni archivar.
- **Nuevo cliente** desde la plantilla nace sin slug, sin URL, sin número y con «Cliente sin nombre».

## 4. Paridad con las páginas publicadas

Comparación automática del `data` de cada fila contra el `window.__PANDORA__.quote` de su página publicada, ignorando solo los campos volátiles (`id`, `slug`, `publishedUrl`, `publishedAt`, `generatedAt`, `isDraft`): **0 diferencias en las dos cotizaciones**.

En la vista previa del panel, con los medios heredados:

| | H&S | Cliente 01 |
| --- | --- | --- |
| Secciones | Alcance · Evidencia · Inversión · Condiciones | igual |
| Imágenes | 9 de 9 cargan | 9 de 9 cargan |
| Videos | 0 (la página original tampoco tiene) | 0 |
| Rutas de medios | `../assets/media/…` → `/docs/assets/…` (200) | igual |

El contenido de la evidencia general migrada coincide con el de las páginas (misma lista de piezas) y el orden de secciones es el mismo. **No se republicó ninguna de las dos**: siguen con su HTML actual y republicarlas será decisión del usuario cuando edite esa cotización.

## 5. Prueba de publicación con un clon

Se duplicó Cliente 01 como **Prueba Panel** y se usó el dominio real: `https://felipeflv.github.io/cotizacion-pandora/c/prueba-panel-69k7/`.

1. Primera publicación: commit `0979328`.
2. Precio de 5 000 → 5 100 y republicar: misma URL, commit `ab0068e`.
3. Precio a 5 200 y republicar: misma URL, commit `facc4b7`; la página publicada muestra `5200`, y el historial acumula 2 versiones «Publicación» con 2 filas de auditoría en `publish_jobs`.
4. Retirar: la URL pasa a **404** en la segunda comprobación (unos 40 s), la fila queda `retired` conservando `slug` y `published_url`, y el historial se mantiene.

El clon retirado queda en el panel como **Prueba Panel · Retirada**; se puede archivar sin afectar a nada.

## 6. Incidente encontrado durante la prueba

La primera publicación respondió `404 No existe la cotización.` porque las Edge Functions usan la clave `service_role` y el proyecto tiene **desactivado** «Automatically expose new tables»: la migración `20261028000004_grants.sql` solo daba permisos a `authenticated`.

- Corregido con `supabase/migrations/20261029000005_service_role_grants.sql` (privilegios mínimos: `quotes` select/update, `media` y `bank_items` select, `quote_versions` select/insert/delete, `publish_jobs` select/insert/update) y aplicado a la base.
- Cubierto por `tests/schema.test.mjs` («the Edge Functions can read and write through service_role»).
- Efecto secundario detectado: cuando la función no puede leer la fila, responde `404` en vez de mostrar el error real. Queda anotado para la revisión final.

## 7. Pendientes

- **Publicar desde el panel local no funciona**: las funciones solo aceptan el origen `https://felipeflv.github.io` (`ALLOWED_ORIGIN`). Las pruebas de publicación de este registro se hicieron contra la función real con la sesión del panel; desde el navegador hay que usar el panel ya desplegado en Pages.
- El panel todavía no está en Pages: el despliegue va con el cierre de la Tarea 12.
- H&S y Cliente 01 conservan su HTML publicado; si se editan y republican, la página se regenera con la plantilla nueva (mismos medios heredados).
- `~/.pandora-migration/` (respaldo, originales, tokens) es material local de migración, fuera del repo; conviene borrarlo cuando ya no haga falta.
