# Aceptación del panel privado

Fecha: 29 de octubre de 2026.
Panel: `https://felipeflv.github.io/cotizacion-pandora/admin/`.
Proyecto Supabase: `pandora-cotizaciones` (`zvusvaotqtchaglwyifl`, `sa-east-1`).

Cada casilla se marca solo con la evidencia que la respalda. Las que dependen de
publicar se probaron desde el panel desplegado, porque las Edge Functions aceptan
únicamente el origen de Pages (`ALLOWED_ORIGIN`) y publicar desde `localhost`
falla por CORS a propósito.

## Cómo repetir la parte automática

```bash
SUPABASE_URL=https://zvusvaotqtchaglwyifl.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<service_role> \
ADMIN_TEST_EMAIL=<correo autorizado> \
npm run test:admin
```

El E2E del panel se omite (`E2E panel: omitido`) si falta alguna variable. Trabaja
contra la base real con datos de prueba (`E2E Panel` / `E2E Cliente`) y los borra
al terminar, devolviendo la plantilla anterior a su lugar. No publica: eso se
verifica a mano en el panel desplegado.

## Casillas

- [x] **Desde una segunda computadora, con login, se ve la misma biblioteca.**

  Verificado como sesión de navegador nueva (contexto limpio, mismo correo, sin
  almacenamiento compartido): la lista y la cotización `E2E Cliente` con importe
  2400 aparecen iguales (`tests/e2e-admin.mjs`). En el panel desplegado se repitió
  el login con una sesión recién generada y la biblioteca coincidió. No se dispone
  de una segunda máquina física: la prueba cubre lo que importa (el estado vive en
  Supabase, no en el navegador).

- [x] **Sin sesión, la API y el bucket no devuelven nada.**

  Con la `anon` key y sin sesión: `quotes`, `media` y `bank_items` responden
  `42501 permission denied`; `storage/v1/object/list/drafts` devuelve `[]`; firmar
  un objeto devuelve `404`; la lectura pública del cubo devuelve `400`. Sin login
  no se filtra ni un nombre de archivo.

- [x] **Un cliente nuevo desde la plantilla recibe una URL nueva.**

  `Nuevo cliente` nace sin `slug`, sin URL y sin número; la plantilla sigue sin
  URL. Publicado, el cliente recibió `aceptacion-evidencia-04mm`, distinta de la
  plantilla y de cualquier otro cliente.

- [x] **Cambiar el precio de un cliente publicado conserva la URL.**

  `aceptacion-panel-rg48`: 4800 → 4900 → 5000, tres publicaciones (tres entradas
  de historial) y la misma URL. Esta prueba destapó que guardar después de
  publicar borraba el `slug`; corregido y cubierto por `tests/admin-model.test.mjs`.

- [x] **Una imagen subida y un video de YouTube se ven en la página publicada.**

  Imagen real subida desde el panel: 13 972 bytes, WebP 1280×720, guardada en el
  cubo privado y publicada como
  `assets/c/aceptacion-evidencia-04mm/89b21b3a-….webp` (200, `image/webp`), visible
  en la página. El video de YouTube se reproduce en la misma página con
  `https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ`.

- [x] **Un borrador y sus imágenes no existen en el repositorio público.**

  Mientras la cotización fue borrador no hubo ningún archivo suyo en `docs/`. La
  imagen y el HTML entraron juntos en el commit de publicación (`499c32e`) y
  desaparecieron juntos al retirar (`b4b5ee1`); `git ls-tree origin/main
  docs/assets/c` queda vacío. Los borradores y sus archivos viven solo en el cubo
  privado y en Postgres.

- [x] **El PDF coincide con la página y cabe en A4.**

  El PDF es la misma página con `@page { size: A4; margin: 16mm 15mm 20mm }`: se
  ocultan barra, acciones y lightbox y se muestran marca y pie de impresión
  (`tests/e2e.mjs`, bloque PDF). No hay un segundo render que pueda desviarse.

- [x] **H&S y Cliente 01 conservan URL, diseño y videos.**

  `c/h-s-inmobiliaria-7k2m/` y `c/cliente-01-9k4d/` siguen en 200 con su título y
  su diseño, y su `data` coincide al 100 % con el `window.__PANDORA__` original
  (0 diferencias, ver `specs/2026-10-28-migracion-registro.md`). Ninguna de las dos
  tenía videos, así que no hay video que conservar; las 9 imágenes heredadas
  siguen cargando.

- [x] **Un fallo de publicación no altera la página anterior y se puede reintentar.**

  La publicación es un commit atómico: si falla la escritura en GitHub, la fila
  vuelve a `draft`, no se crea versión y la página anterior sigue intacta
  (`tests/publish-core.test.mjs`). En la interfaz el error se muestra con
  «Reintentar» y no se pierde lo editado.

- [x] **La página sigue visible con la Mac apagada.**

  Todo lo publicado es HTML estático en GitHub Pages. Las páginas de H&S y Cliente
  01 se descargaron con `curl` desde otro proceso, sin sesión ni panel de por medio.

- [x] **Retirar una publicación devuelve 404 y conserva el historial.**

  Retiradas `aceptacion-panel-rg48` y `aceptacion-evidencia-04mm`: ambas pasan a
  404 (en 20–60 s, lo que tarda Pages) y la fila conserva `slug`, `published_url` y
  sus versiones. La imagen publicada también desaparece del repo.

## Límites conocidos

- Publicar desde el panel en `localhost` está bloqueado por CORS: es deliberado y
  evita que un origen ajeno dispare commits. El panel desplegado publica sin
  problema.
- El E2E del panel necesita `service_role`: no se puede ejecutar en CI sin ese
  secreto, así que corre a mano y se omite si faltan las variables.
- El panel es solo para computadora; no se probó ni se soporta en móvil.
