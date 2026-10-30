# Panel privado de cotizaciones — diseño

Fecha: 2026-10-28
Estado: implementado
Ámbito: software

## 1. Intención

Hoy las cotizaciones se preparan editando texto sobre una página local y publicando un paquete JSON con un ayudante de doble clic. Funciona, pero depende de esta Mac, de recordar rutas de archivos y de editar directamente sobre la pieza final.

Se quiere un **panel privado de contenido** para preparar cotizaciones desde cualquier computadora, con datos de clientes fuera del repositorio público, y conservar exactamente la entrega actual: una página de cliente ejecutiva, interactiva, con videos, gráficos, evidencia y PDF.

La cotización deja de ser un archivo suelto y pasa a ser un registro privado con versiones. Solo lo que se publica —la página y sus imágenes— llega al sitio público.

## 2. Objetivos

- Crear, editar, duplicar y archivar cotizaciones desde cualquier computadora de escritorio, con login.
- Editar con formularios por secciones, no con texto editable sobre la página.
- Cargar evidencias de dos formas: archivos locales (imágenes y portadas) y enlaces de YouTube/Vimeo.
- Ver una vista previa idéntica a la página que recibirá el cliente.
- Publicar con un botón; conservar la misma URL al republicar.
- Mantener borradores, versiones y medios sin publicar en almacenamiento privado.
- Exportar PDF A4 con el diseño actual.
- Migrar la biblioteca actual (H&S y Cliente 01) sin romper sus URLs.
- Mantener el sitio público estático, visible con la Mac apagada.

## 3. No objetivos

- Interfaz móvil o tablet. El panel se diseña para escritorio.
- Varios editores, roles o permisos. Un solo editor.
- Cuentas de cliente, comentarios o aprobaciones dentro de la página.
- Alojar video propio. Los videos viven en YouTube o Vimeo.
- Edición sin conexión.
- Reemplazar GitHub Pages por otro hosting.
- Analítica, CRM o facturación.

## 4. Anti-objetivos

- Guardar borradores o datos de clientes en el repositorio público.
- Generar una URL nueva cuando el cliente pide un ajuste de precio.
- Volver a escribir rutas de archivos a mano.
- Cambiar el diseño ejecutivo de la página del cliente por un panel genérico.
- Subir videos pesados al repositorio.
- Poner secretos, service role o tokens de GitHub en el navegador.

## 5. Restricciones

- El repositorio `FelipeFLV/cotizacion-pandora` es público y GitHub Pages sirve `/docs`.
- El sitio público no tiene build: HTML, CSS y JS estáticos.
- Los videos publicados son enlaces de YouTube/Vimeo.
- Las imágenes publicadas deben ser ligeras y quedar disponibles con la Mac apagada.
- GitHub limita archivos a 100 MB y recomienda repositorios por debajo de 1 GB.
- La página del cliente debe conservar `noindex`, su identidad visual y su PDF A4.
- El editor debe funcionar en navegadores de escritorio actuales.
- El código e identificadores van en inglés; la interfaz y los textos, en español.

## 6. Decisiones ya tomadas por la persona usuaria

- Solo computadora; no se usará desde celular.
- Debe poder prepararse desde otra computadora.
- Solo las páginas publicadas pueden ser visibles; los borradores y datos de clientes, no.
- Las evidencias aceptan archivos locales y enlaces.
- Los videos publicados viven en YouTube/Vimeo.
- Se conserva el aspecto ejecutivo y la entrega interactiva actual.

## 7. Arquitectura propuesta

Tres piezas:

1. **Panel privado** (`/admin/` en GitHub Pages): aplicación estática de escritorio, sin build, con login. Reutiliza `docs/app/render.js`, `core.js` y los estilos actuales para la vista previa.
2. **Supabase** como backend privado: autenticación, base de datos, versiones y almacenamiento privado de imágenes.
3. **Publicador** (Supabase Edge Function): recibe la orden de publicar, valida, genera el HTML con la plantilla actual y hace un commit atómico al repositorio público mediante la API de GitHub.

Flujo resumido:

```
Panel (/admin) ──> Supabase (datos privados, imágenes)
      │                     │
      │                     └──> Edge Function "publish"
      │                                   │
      └── vista previa <── render compartido│
                                            ▼
                             GitHub API ──> docs/c/<slug>/ + docs/assets/c/<slug>/
                                            │
                                            ▼
                                     GitHub Pages (público)
```

La página pública sigue siendo la misma plantilla; cambia cómo se llena y cómo se publica.

## 8. Modelo de datos

Se reutiliza el esquema de cotización actual (`version: 2`) dentro de una columna JSONB. Así el render y las validaciones existentes se conservan.

### `quotes`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `owner_id` | uuid | FK a `auth.users` |
| `slug` | text único | se fija en la primera publicación |
| `status` | text | `draft`, `published`, `retired` |
| `is_template` | boolean | solo una plantilla; no se publica ni se elimina |
| `data` | jsonb | cotización completa (esquema v2) |
| `published_url` | text | URL pública |
| `published_at` | timestamptz | última publicación |
| `retired_at` | timestamptz | retiro |
| `archived_at` | timestamptz | archivado reversible desde el panel |
| `created_at`, `updated_at` | timestamptz | auditoría |

### `quote_versions`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `quote_id` | uuid | FK |
| `data` | jsonb | copia completa |
| `label` | text | fecha o etiqueta |
| `created_at` | timestamptz | |
| `published` | boolean | distingue borrador de publicado |

Se conservan las últimas 10 versiones por cotización, igual que hoy. Una versión se crea **solo al publicar** y al hacer una captura manual antes de restaurar; el autoguardado nunca crea versiones, para que una sesión de edición no borre el historial publicado.

### `media`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `owner_id` | uuid | FK |
| `storage_path` | text | ruta en el bucket privado |
| `mime` | text | jpeg, png, webp |
| `bytes`, `width`, `height` | integer | control de peso |
| `created_at` | timestamptz | |

### `bank_items`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `owner_id` | uuid | FK |
| `kind` | text | `video` o `image` |
| `title` | text | |
| `source` | text | `upload` o `url` |
| `media_id` | uuid | si es archivo |
| `url` | text | si es enlace |
| `service` | text | etiqueta opcional |
| `created_at` | timestamptz | |

### `publish_jobs`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `quote_id` | uuid | FK |
| `status` | text | `queued`, `running`, `ok`, `error` |
| `url` | text | resultado |
| `error` | text | mensaje saneado |
| `created_at`, `finished_at` | timestamptz | |

### RLS

Todas las tablas con `owner_id = auth.uid()`. El rol anónimo no puede leer ni escribir nada. El bucket `drafts` es privado y solo el propietario puede leer sus archivos. La Edge Function usa service role solo del lado servidor.

### Evidencias dentro del JSON

Se mantiene la forma actual (`title`, `src`, `poster`) con una convención adicional:

- Video: `src` es una URL de YouTube/Vimeo.
- Imagen o portada subida: `src` o `poster` es `media:<uuid>`.
- Material migrado: `src` sigue siendo `assets/...` (público y ya existente).
- Enlace de imagen: `https://...`.

El panel resuelve `media:<uuid>` a una URL firmada para la vista previa. El publicador la resuelve a `assets/c/<slug>/<uuid>.<ext>` y sube el archivo.

## 9. Flujos

### Crear desde la plantilla

1. El panel muestra el borrador marcado (`is_template`).
2. **Nuevo cliente** clona la plantilla, limpia nombre, número, fecha, slug y URL, y crea un borrador nuevo.
3. La plantilla original no se modifica y no se puede publicar ni eliminar.
4. La fecha se fija al día de la creación.

### Editar

1. Se elige una cotización en la barra lateral.
2. Se edita por secciones: Cliente, Servicios, Evidencias, Inversión, Condiciones, Publicación.
3. Los cambios se guardan en Supabase con debounce y un indicador de estado.
4. **Vista previa** abre un iframe con el render compartido; no es editable.
5. **PDF** imprime esa misma vista con `print.css`.

### Publicar

1. El usuario pulsa **Publicar** en una cotización que no es plantilla.
2. El panel llama a la Edge Function `publish` con el `quote_id`.
3. La función verifica sesión y propiedad, y rechaza plantillas, slugs inválidos o medios no permitidos.
4. Crea un `publish_job` en `queued`.
5. Descarga las imágenes referenciadas del bucket privado y las sube a `docs/assets/c/<slug>/` con la API de Git. El publicador no recomprime: valida el peso y rechaza lo que exceda el límite.
6. Genera el HTML con la plantilla y el payload, reescribiendo `media:<uuid>` a la ruta pública.
7. Hace **un commit atómico** con imágenes y HTML.
8. Actualiza `quotes` (`published`, URL, fecha), guarda una versión y marca el job como `ok`.
9. Devuelve la URL. GitHub Pages tarda alrededor de un minuto.

La publicación corre dentro de una sola invocación de la función, sin cola ni worker: el registro en `publish_jobs` sirve para auditoría y la interfaz consulta su estado final. Si se agota el tiempo máximo, no hay commit y se puede reintentar.

Si algo falla antes del commit, la página anterior queda intacta y el job pasa a `error` con un mensaje para reintentar.

### Republicar

Mismo slug y misma URL. Se reemplazan HTML e imágenes; se añade una versión al historial privado. Los cambios de precio, condiciones o nombre no alteran la URL.

### Retirar

1. Confirmación explícita en el panel.
2. La Edge Function elimina `docs/c/<slug>/` y `docs/assets/c/<slug>/` en un commit atómico.
3. Las imágenes siguen en el bucket privado, así que republicar las restaura sin volver a subirlas.
4. `quotes.status = retired`, se conserva el historial.
5. La URL deja de existir; la cotización sigue en el panel.

**Eliminar** en el panel es un archivado reversible (`archived_at`), no un borrado físico: oculta la cotización de la lista y conserva versiones y medios. La plantilla no se puede archivar.

### Importar la biblioteca actual

1. **Fuente de verdad**: el respaldo JSON de la biblioteca local. Las páginas `docs/c/*/index.html` se usan solo como referencia para comparar el resultado, nunca para sobrescribir el respaldo.
2. El usuario descarga el respaldo desde la matriz actual y el panel lo sube con **Importar biblioteca**.
3. Se insertan cotizaciones, versiones y banco; las rutas `assets/...` se conservan como material público existente.
4. H&S y Cliente 01 quedan como `published` con sus URLs actuales; su HTML no se regenera hasta que el usuario las edite y republique.
5. La plantilla se crea a partir de la cotización que el usuario elija, sin identidad ni URL.
6. Criterio de paridad: antes del primer republicado se guardan capturas y el HTML actual; después se comparan texto, precios y evidencias. Cualquier diferencia se corrige en el respaldo antes de seguir.

## 10. Medios y evidencias

### Imágenes y portadas

- Formatos: JPEG, PNG, WebP.
- Compresión **solo en el navegador**, antes de subir: lado mayor máximo 1800 px, calidad 0.85, objetivo menor a 1.5 MB.
- Se guarda únicamente la versión comprimida en el bucket privado.
- El publicador no recomprime: valida el peso y rechaza con un mensaje claro lo que exceda el límite.
- Al publicar, se copian a `docs/assets/c/<slug>/<uuid>.<ext>`.

### Videos

- Piezas nuevas: solo enlaces de YouTube o Vimeo; se valida el dominio y se extrae el identificador. No se aceptan archivos de video.
- Material heredado: los `.mp4` ya publicados en `docs/assets/media/...` siguen siendo válidos y editables en H&S y Cliente 01. No se suben videos nuevos al repositorio; si el usuario quiere reemplazar uno, lo sube a YouTube o Vimeo y pega el enlace.
- Portada: si el usuario sube una, se usa; para YouTube se puede usar la miniatura oficial; para Vimeo se exige portada o se muestra un placeholder neutro.

### Banco general

- Mismas reglas que las evidencias por servicio.
- Los elementos del banco se pueden marcar por cotización en los modos actuales: Servicio, General, Ambas, Ocultar.

### Validaciones

- Rechazar `blob:`, `data:video/*`, `file:`, `javascript:`, `vbscript:`.
- Rechazar imágenes incrustadas mayores a 1.5 MB.
- Rechazar rutas con `..`, `//` o `\`.
- Rechazar videos que no sean YouTube/Vimeo.
- Un enlace roto o privado se detecta al publicar y se muestra como error, sin bloquear el resto de la cotización.

## 11. Panel: interfaz

Diseño de escritorio, con ancho mínimo cómodo (1024 px). Sin menús móviles.

- **Login**: correo con enlace mágico; solo el correo autorizado. Sesión persistente.
- **Barra lateral**: buscador, filtros (borrador, publicada, retirada), lista de cotizaciones, botón **Nuevo cliente** y **Importar**.
- **Editor**: formulario por secciones con etiquetas, ayudas cortas y validación en línea.
  - Cliente: nombre, número, fecha, duración, validez, frase de entrada, cierre.
  - Servicios: añadir, quitar, reordenar; título, duración, entregables, consideraciones, proceso.
  - Inversión: líneas con concepto y monto; IGV; forma de pago con porcentajes.
  - Condiciones y datos bancarios.
  - Evidencias: pestañas Video/Imagen; subir o pegar enlace; título; servicio; portada; selección general.
- **Vista previa**: panel lateral o modal a pantalla completa, con el mismo render del cliente.
- **Publicación**: estado, URL, copiar, abrir, historial, **Publicar**, **Retirar**, **PDF**.
- **Guardado**: automático con indicador “Guardado” / “Guardando” / “Error”.

El panel no permite editar texto directamente sobre la página; la página es solo vista previa.

## 12. Publicación y URLs

- Slug: se genera en la primera publicación a partir del nombre del cliente, en minúsculas, con sufijo aleatorio corto; se guarda y no cambia.
- Republicar conserva el slug.
- Un cliente nuevo recibe un slug nuevo.
- La plantilla no tiene slug.
- Colisión de slug: restricción única en la base y reintento con otro sufijo.
- URL: `https://felipeflv.github.io/cotizacion-pandora/c/<slug>/`.
- La raíz del sitio sigue redirigiendo a H&S.
- La página incluye `noindex, nofollow, noarchive`.

## 13. Seguridad y privacidad

- RLS en todas las tablas; el rol anónimo no ve filas.
- Auth: registro público desactivado y allowlist con un único correo. Se usa el SMTP por defecto de Supabase (límite bajo, suficiente para un editor); el enlace mágico debe abrirse en el mismo navegador que lo solicitó.
- Bucket privado para borradores y medios sin publicar.
- La `anon key` de Supabase puede ser pública; la seguridad depende de RLS.
- La service role y el token de GitHub viven solo en la Edge Function.
- Token de GitHub fine-grained: solo `contents: write` sobre el repositorio público.
- Validación de JWT y de `owner_id` en cada función.
- Límite de publicación: una por cotización cada 60 segundos.
- Logs de la función solo con identificadores y estado; sin contenido de la cotización.
- CSP del panel: scripts propios, Supabase y CDN fijado; sin `eval`.
- El código del panel es público, pero no contiene datos ni secretos.
- La página publicada es pública por diseño; se acepta que cualquiera con la URL la vea.
- `docs/robots.txt` y `noindex` se mantienen.

## 14. Costos y límites

- Supabase free: base, auth y almacenamiento suficientes para este volumen.
- GitHub Pages y repositorio público: sin costo; se vigila el peso por las imágenes.
- Edge Functions: dentro del plan gratuito para el uso previsto.
- YouTube/Vimeo: sin costo; el video no consume almacenamiento propio.
- Sin dominio propio: se mantiene `felipeflv.github.io`.

## 15. Migración

1. Congelar cambios en la matriz actual durante la migración.
2. Crear el proyecto Supabase, esquema, RLS y bucket.
3. Importar el respaldo JSON de la biblioteca.
4. Verificar H&S y Cliente 01: datos, URLs y estado.
5. Crear la plantilla base y probar un cliente de prueba de punta a punta.
6. Publicar el cliente de prueba, editar precio, republicar y confirmar misma URL.
7. Retirar el cliente de prueba.
8. Comparar las páginas reales antes y después (capturas y contenido).
9. Archivar la matriz local como respaldo; no se sirve desde Pages.

## 16. Pruebas

- **Unitarias**: generación de HTML, validación de medios, parseo de YouTube/Vimeo, slugs, totales e IGV.
- **RLS**: con `anon key` no se lee ninguna fila ni archivo; con el usuario autorizado, sí.
- **Edge Function**: GitHub API simulada; commit atómico; fallo a mitad no deja página parcial; reintento.
- **E2E**: login, crear desde plantilla, editar, subir imagen, pegar video, previsualizar, publicar, republicar, retirar, PDF.
- **Regresión**: H&S y Cliente 01 siguen en 200 y con el mismo diseño.
- **Seguridad**: intentos de slug inválido, ruta con `..`, URL `javascript:`, archivo sobredimensionado y acceso anónimo.

Infraestructura de pruebas: proyecto Supabase **de test** separado del de producción, sin Docker. Las pruebas de RLS y de la Edge Function corren con `node:test` contra ese proyecto usando la `anon key` y una sesión de prueba. CI en GitHub Actions es opcional; la verificación mínima es local y reproducible.

## 17. Fases de implementación

1. **Base**: proyecto Supabase, tablas, RLS, bucket, auth y módulo compartido de publicación con pruebas.
2. **Panel**: login, lista, importación, plantilla y “Nuevo cliente”.
3. **Editor**: formularios, autosave y vista previa.
4. **Medios**: subida, compresión, enlaces, banco y modos de evidencia.
5. **Publicación**: Edge Function, commit atómico, historial, retiro y PDF.
6. **Migración**: H&S, Cliente 01 y prueba de extremo a extremo.
7. **Cierre**: documentación, respaldo y archivo de la matriz anterior.

Cada fase termina con pruebas y una demostración concreta; no se avanza con fallos abiertos.

## 18. Decisiones del builder

Estas quedan a criterio de quien implemente, salvo que la persona usuaria diga lo contrario:

- Panel servido en `/admin/` del mismo GitHub Pages, con login; alternativa: hosting separado.
- Un solo editor autorizado por correo; sin roles.
- Publicador como Edge Function de Supabase (no GitHub Action), para mantener logs privados.
- Imágenes publicadas dentro del repositorio (`docs/assets/c/<slug>/`), no en un bucket público.
- Historial de 10 versiones por cotización.
- Miniatura automática de YouTube; Vimeo exige portada o placeholder.
- La matriz local se conserva como respaldo hasta validar el panel.
- Sin service worker ni modo offline.

Estas decisiones cierran las dudas abiertas del diseño:

- **Migración**: el respaldo JSON es la fuente de verdad; el HTML publicado solo sirve para comparar (§9).
- **Videos heredados**: los `.mp4` ya publicados en `docs/assets/media/...` siguen válidos; las piezas nuevas exigen YouTube/Vimeo (§10).
- **Compresión**: solo en el navegador; el publicador valida y rechaza (§9, §10).
- **Publicación**: una sola invocación sincrónica con registro de auditoría, sin cola ni worker (§9).
- **Versiones**: se crean al publicar y en capturas manuales, nunca por autoguardado (§8).
- **Retiro**: borra página e imágenes del repo; las imágenes quedan en el bucket privado (§9).
- **Eliminar**: archivado reversible con `archived_at`, no borrado físico (§8, §9).
- **Auth**: registro cerrado y allowlist de un correo, con SMTP de Supabase (§13).
- **Pruebas**: proyecto Supabase de test y `node:test`, sin Docker; CI opcional (§16).

## 19. Criterios de aceptación

- Desde una segunda computadora, con login, se ve la misma biblioteca.
- Sin sesión, la API y el almacenamiento no devuelven datos.
- Se crea un cliente desde la plantilla y recibe una URL nueva.
- Se edita el precio de un cliente publicado y, al republicar, la URL no cambia.
- Se sube una imagen y se pega un video de YouTube/Vimeo; ambos se ven en la página publicada.
- Los borradores y sus imágenes no aparecen en el repositorio público.
- El PDF generado coincide con la página y cabe en A4.
- H&S y Cliente 01 conservan sus URLs y su contenido.
- Un fallo de publicación no altera la página anterior y se puede reintentar.
- La página sigue visible con la Mac apagada.

## 20. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Caída de Supabase | El sitio público sigue; el panel avisa y permite reintentar. |
| Token de GitHub vencido | Job en error claro; rotación documentada. |
| Imágenes pesadas o muchas | Compresión, límite por cotización y aviso antes de publicar. |
| Crecimiento del repositorio | Nombres por UUID, reemplazo en republicación y revisión periódica. |
| Video eliminado o privado | Validación al publicar; aviso y reemplazo. |
| Fuga por RLS mal configurada | Pruebas automatizadas con rol anónimo. |
| Publicar una plantilla | Rechazo en servidor, no solo en la interfaz. |
| Pérdida de datos | Versiones, respaldo JSON y backups de Supabase. |
| Pages tarda en reflejar | La UI muestra “publicando” y consulta el estado. |

## 21. Fuera de alcance

- Aplicación móvil.
- Varios usuarios o permisos avanzados.
- Videos alojados por Pandora.
- Comentarios o aprobación del cliente.
- Facturación o cobros.
- Analítica de visitas.
- Dominio propio.
