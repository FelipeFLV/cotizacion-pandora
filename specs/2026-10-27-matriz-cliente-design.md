# Matriz privada + versión cliente publicada

**Fecha:** 27 de octubre de 2026  
**Estado:** implementado  
**Repo:** `FelipeFLV/cotizacion-pandora`  
**URL actual:** https://felipeflv.github.io/cotizacion-pandora/

## 1. Intención

Convertir el cotizador actual —una sola cotización editable y publicada— en dos capas con propósitos distintos:

1. **Matriz privada:** la herramienta de trabajo de Pandora. Vive en la Mac, guarda varias cotizaciones (cliente 01, cliente 02…), permite editar todo y prepara cada propuesta.
2. **Versión cliente:** una copia congelada de una cotización, publicada en una URL propia, sin ningún control de edición. El cliente solo puede leer, reproducir videos, ampliar imágenes y exportar el PDF.

El problema que resuelve: hoy se edita y se publica lo mismo. Si se prepara una cotización para un cliente nuevo, se pisa la anterior; y el cliente ve botones de edición que no debería ver. La separación permite preparar muchas propuestas sin mezclarlas y entregar a cada cliente una pieza limpia.

## 2. Objetivos

- Editar en la matriz: empresa, servicio(s) requerido(s), líneas de precio, condiciones, datos de pago, evidencias y fecha.
- Mantener varias cotizaciones en el navegador, con crear, duplicar, renombrar (vía nombre del cliente), eliminar y respaldar.
- Evidencias por servicio **y** un banco general de otros trabajos, con cuatro modos por cotización: `servicio`, `general`, `ambas`, `ninguna`.
- Botón **Modo cliente nuevo** que pone la cotización en `general` de un toque.
- Poder **ocultar la sección de evidencia** cuando no se usarán videos ni piezas locales; en ese caso no se genera la sección ni se embeben los medios en la página del cliente.
- Generar una versión cliente con la fecha del momento de generación.
- Publicar esa versión en una URL no adivinable, sin enlaces entre clientes.
- La versión cliente conserva el diseño, los videos, la galería y el PDF; pierde edición, importación, guardado y cualquier campo de formulario.
- La matriz no se sirve en la web.
- Todo sigue siendo estático: la matriz se abre con doble clic; la versión cliente funciona sin backend.

## 3. No objetivos

- Contraseña o autenticación real. Una web estática no puede esconder una página a quien tenga la URL. Se usa URL no adivinable + `noindex`, y se advierte el límite.
- Edición colaborativa, multiusuario o sincronización entre dispositivos.
- Backend, base de datos, login, panel administrativo remoto.
- Cambiar la identidad gráfica ni el contenido comercial del catálogo.
- Generar URLs desde el navegador sin intervención local. El último paso (subir a GitHub) lo hace un ayudante local.
- Historial publicado navegable por el cliente. El historial es local y en git.

## 4. Decisiones tomadas por el usuario

| Tema | Decisión |
|---|---|
| Publicación | Un clic + ayudante local que sube a GitHub Pages y devuelve la URL |
| Costo vs. precio | Es el mismo número; el precio se arma con las líneas de inversión. No hay costo interno ni margen |
| Varias cotizaciones | Biblioteca de clientes dentro de la matriz, con respaldo JSON |
| Evidencias generales | Sección configurable por cotización + botón “Modo cliente nuevo” que elige general o servicio |
| Ocultar evidencia | Modo `ninguna`: no se genera la sección ni se embeben los medios |
| Fuentes de evidencia | Rutas en `docs/assets/` y enlaces de YouTube/Vimeo, según el caso |
| Republicar | Misma URL, con historial local de versiones |
| PDF | Se conserva en la versión cliente |
| “No editable” | Sin UI, sin inputs, sin guardado; no es bloqueo criptográfico |

## 5. Restricciones

- **Web estática, sin build para ver:** la matriz se abre con `file://`; la página del cliente se sirve desde GitHub Pages. No hay servidor de aplicación.
- **Sin backend:** el navegador no puede publicar ni crear una URL viva. La publicación requiere un paso local (`git push`).
- **GitHub Pages publica una sola carpeta:** se usará `/docs` como fuente. Todo lo que esté fuera de `/docs` no se sirve.
- **El repo es público:** el código de la matriz y las páginas de `/docs` son inspeccionables en GitHub. Las URLs de clientes no están enlazadas entre sí ni indexadas, pero no son secretas.
- **Persistencia del navegador:** la biblioteca vive en `localStorage`. Si se limpian los datos del navegador, se pierde; por eso el respaldo JSON es obligatorio en el flujo.
- **Medios:** se reutilizan los 6.1 MB de `assets/` (fuentes, logos, 5 servicios). No se añaden dependencias.

## 6. Arquitectura

### 6.1 Estructura de carpetas

```
/ (raíz del repo; NO se publica)
  index.html                 # matriz
  js/
    config.js                # P.siteBase (única fuente de la URL pública)
    catalog.js               # catálogo de servicios + cotización base + banco semilla
    store.js                 # biblioteca, migración, snapshots, respaldo
    app.js                   # interacción de la matriz
  docs/                      # fuente de GitHub Pages
    index.html               # continuación de la URL actual (ver §9)
    robots.txt               # Disallow: /
    app/
      app.css
      print.css
      core.js                # utilidades puras: get/set/totals/money/fechas/assetUrl/slug
      render.js              # render compartido; modo readonly
      client.js              # solo interacciones del cliente
    assets/                  # antes /assets
      fonts.css, fonts/, logo-*.png, favicon.svg, media/**
    c/
      <slug>/index.html      # una página generada por cliente
  tools/
    cliente.template.html    # plantilla de la página cliente
    publicar.mjs             # construye docs/c/<slug>/index.html, commit, push, URL
    Publicar cliente.command # envoltorio de doble clic para macOS
  specs/
    2026-10-27-matriz-cliente-design.md
  README.md
```

**Por qué `docs/` contiene también CSS/JS compartidos:** GitHub Pages solo puede servir `/` o `/docs`. Para que la matriz siga siendo privada, la fuente debe ser `/docs`. La matriz (en la raíz) carga `docs/app/*` y `docs/assets/*`; la página del cliente carga `../../app/*` y `../../assets/*`. Una sola copia de estilos, fuentes y medios; sin duplicar 6 MB.

**Consecuencia:** la matriz depende de que exista `docs/`. Es aceptable: `docs/` es parte del proyecto y se versiona.

### 6.2 Flujo de publicación

1. En la matriz, el usuario elige una cotización de la biblioteca y la edita.
2. Pulsa **Exportar versión cliente**.
3. La matriz:
   - fija `meta.date` al día de hoy y `meta.generatedAt` al instante actual;
   - asigna `meta.slug` si aún no tiene (nombre del cliente + sufijo aleatorio de 4 caracteres);
   - guarda un snapshot en el historial local;
   - descarga un paquete JSON `pandora-<slug>-<YYYYMMDD-HHMM>.json`.
4. El usuario arrastra ese archivo sobre `Publicar cliente.command` (o lo elige al abrirlo).
5. El ayudante:
   - valida el paquete;
   - escribe `docs/c/<slug>/index.html` desde la plantilla, con los datos embebidos;
   - hace `git add`, `git commit` y `git push`;
   - imprime la URL, la copia al portapapeles y la abre (con margen para el despliegue de Pages).
6. GitHub Pages sirve la página en `https://felipeflv.github.io/cotizacion-pandora/c/<slug>/`.

**Republicar:** mismo slug, mismo archivo, nueva fecha. El enlace no cambia. El snapshot anterior queda en el historial local y en el historial de git.

**Por qué el paquete JSON y no escribir desde el navegador:** `file://` no permite escribir en el proyecto de forma fiable; el paquete desacopla la edición de la publicación y deja un artefacto auditable. El ayudante es el único que toca git.

### 6.3 Matriz

#### Biblioteca

- Clave `pandora.biblioteca.v1`:
  ```
  {
    version: 1,
    activeId: "q_...",
    evidenceBank: { videos: [...], images: [...] },
    quotes: [
      {
        id: "q_...",
        name: "H&S Inmobiliaria",       // espejo de meta.client para listar
        updatedAt: "2026-10-27T...",
        quote: { ... },
        versions: [ { at, label, quote } ]   // máx. 10, la más nueva primero
      }
    ]
  }
  ```
- Migración: si no existe la biblioteca y existe `pandora.cotizacion.v1`, se crea una entrada con esa cotización, se le añaden los campos nuevos y se guarda. La clave vieja se elimina después de guardar.
- Acciones: abrir, nueva (elige servicio), duplicar, eliminar, respaldar biblioteca, importar respaldo.
- “Renombrar” = editar `meta.client`; `name` se sincroniza al guardar.
- No se puede eliminar la última cotización; se ofrece crear otra.
- Respaldo: `{ version: 1, exportedAt, evidenceBank, quotes }`, descarga `pandora-biblioteca-YYYY-MM-DD.json`. Importar reemplaza la biblioteca tras confirmación (no fusiona).
- Cambiar de cotización guarda inmediatamente la actual y cancela el debounce pendiente.

#### Edición

Se conserva la edición en línea actual (contenteditable, inputs de montos y porcentajes, diálogos de medios) con estos cambios:

- La fecha deja de ser un input libre: se muestra “Se actualizará al exportar” y el valor de hoy. `meta.date` se fija en la exportación.
- El botón **Exportar PDF** sigue disponible para revisar la pieza.
- Los botones de importar/exportar JSON de una sola cotización se reemplazan por el respaldo de biblioteca.
- Se añade el botón **Evidencias** (banco general + selección por cotización) y el control de modo.
- Se añade **Exportar versión cliente** en la barra superior.
- Se añade **Cotizaciones** (abre la biblioteca).

#### Evidencias

- **Banco general** (global, compartido, `library.evidenceBank`): `videos[]` e `images[]`, cada pieza con `id`, `title`, `src`, `poster` y `service` (etiqueta visible: “Meta Ads”, “Branding”…). No confundir con `quote.bank`, que son los datos de depósito.
- Semilla: una video y una imagen de cada uno de los 5 servicios, reutilizando `docs/assets/media/*`. El usuario puede reemplazar, añadir o quitar entradas del banco.
- **Origen durable de una pieza:** ruta dentro de `docs/assets/media/` (por ejemplo `assets/media/general/mi-pieza.mp4`) o enlace `https://` de YouTube/Vimeo/video directo. El selector de archivo local sigue sirviendo solo como vista previa y produce un `blob:` temporal; la exportación lo bloquea (ver §6.6). Para sumar un archivo propio, se copia a `docs/assets/media/general/` y se usa su ruta. El README lo explica paso a paso.
- **Por cotización:** `evidence.mode` (`service` | `general` | `both` | `none`) y `evidence.generalIds` (IDs elegidos del banco).
- Control en la matriz:
  - segmentado `Servicio / General / Ambas / Ocultar`;
  - botón **Modo cliente nuevo** que alterna `general` ↔ `service` (si está en `both` o `none`, pasa a `general`). Al encenderlo, si la cotización no tenía selección, marca **todas** las piezas del banco; si ya había una selección manual, la conserva. Apagarlo no borra la selección.
  - lista de piezas del banco con checkbox; “Seleccionar todo” / “Ninguna”.
- Una cotización nueva nace en `service` con selección vacía; al pulsar “Modo cliente nuevo” queda en `general` con todo el banco.
- Si `mode` es `general` y no hay piezas seleccionadas, la matriz avisa y la exportación usa `service` como respaldo.
- **`none` / “Ocultar”:** la versión cliente no genera las secciones de evidencia ni “Otros trabajos”, la navegación no las muestra y el PDF no incluye esas páginas. El paquete omite `videos` e `images` de los bloques y las piezas generales, de modo que los medios no viajan en el HTML. La matriz conserva todo para cuando se vuelva a activar.
- La sección general se titula **Otros trabajos** y muestra la etiqueta de servicio de cada pieza.

### 6.4 Versión cliente

- Página estática en `docs/c/<slug>/index.html`.
- Datos embebidos: `<script>window.__PANDORA_QUOTE__ = {...}; window.__PANDORA_META__ = {...};</script>`, con `<` escapado como `\u003c`.
- Los datos embebidos se construyen **según el modo de evidencia**: en `none` los bloques no llevan `videos` ni `images` y no se incluye el banco; en `service` se omite el banco; en `general` se omiten los medios de servicio. Así lo oculto no viaja en el HTML.
- Carga `../../app/core.js`, `../../app/render.js`, `../../app/client.js`; no carga `store.js`, `catalog.js` ni `app.js`.
- No hay `localStorage`, ni `fetch`, ni guardado.
- El DOM generado **no contiene** `contenteditable`, `<input>`, `<textarea>`, botones “Editar”, “Reemplazar”, “Añadir”, “Quitar”, “Importar” ni “Guardar”. No se ocultan con CSS: no se generan.
- Sí contiene: navegación, videos reproducibles, lightbox, pantalla completa y **Exportar PDF**.
- Cabecera: marca, navegación, pantalla completa, PDF. Sin “Editar”.
- Fecha: `meta.date` (día de generación) en la portada; en el pie de impresión, “Generada el <fecha> a las <hora>”.
- `noindex, nofollow, noarchive` + `docs/robots.txt`.
- El título es `Propuesta · <cliente>`; la descripción, genérica.
- Un `<meta name="pandora-quote-id" content="q_...">` permite al ayudante detectar colisiones de slug.

### 6.5 Render compartido

`docs/app/render.js` recibe `opts = { readonly, evidenceMode, generalVideos, generalImages }`.

- En modo matriz (`readonly: false`): genera los mismos `.editable`, `.amt`, `.pct-input`, botones y diálogos que hoy.
- En modo cliente (`readonly: true`):
  - textos como `<span class="txt">` sin `data-text`;
  - montos como texto `S/ 5,000.00`, sin `<input>`;
  - porcentajes como texto, sin `<input>`;
  - listas sin botones de quitar ni de añadir;
  - piezas sin “Reemplazar”;
  - banco sin “Copiar” (el cliente puede seleccionar el número).
- Capítulos:
  - siempre: Alcance por servicio;
  - si el modo incluye servicio: Evidencia por servicio;
  - si el modo incluye general y hay piezas: una sección **Otros trabajos** al final de los capítulos;
  - si el modo es `none`: no se genera ninguna sección de evidencia;
  - la numeración `01, 02…` se calcula sobre las secciones realmente incluidas;
  - la navegación oculta “Evidencia” y “Otros trabajos” cuando no existen.
- `renderPrices`, `renderSplit`, `renderBank`, `renderConditions` respetan `readonly`.
- `sync()` solo se usa en la matriz. El cliente renderiza valores finales una vez.

### 6.6 Utilidades y assets

- `docs/app/core.js` (nuevo) contiene lo que hoy está en `store.js` y no depende de `localStorage`: `get`, `set`, `totals`, `money`, `moneyS`, `parseNumber`, `dateLabel`, `shortDate`, `uid`, `slugify`, `assetUrl`, `todayISO`.
- `P.assetBase`:
  - matriz: `docs/` → `docs/assets/media/...`;
  - cliente: `../../` → `../../assets/media/...`.
- `assetUrl(src)` deja intactos `http(s)://`, `data:`, `blob:` y `/`; prefija rutas relativas. El `blob:` se conserva solo para la vista previa de la matriz.
- **Validación de medios al exportar** (la matriz avisa antes de descargar y el generador vuelve a validar):
  - `blob:` → **rechazado**: es una URL de sesión, muere al recargar y nunca funcionaría en Pages. El diálogo lista las piezas afectadas y pide guardar el archivo en `docs/assets/media/` o usar un enlace.
  - `data:image/*` → permitido hasta **1.5 MB** por pieza; por encima se rechaza por peso.
  - `data:video/*` → rechazado: infla el HTML y `localStorage`.
  - `assets/...` → permitido si el archivo existe bajo `docs/`; el generador comprueba la existencia y falla con la ruta exacta si no.
  - `http(s)://` → permitido. YouTube/Vimeo se embeben; el resto se reproduce como video/imagen directa.
  - `javascript:`, `vbscript:`, `file:` y esquemas desconocidos → rechazados.
- Consecuencia para el usuario: para publicar una pieza propia debe copiarla a `docs/assets/media/general/` y usar su ruta; el selector de archivo local solo sirve para previsualizar. El README lo explica. Un importador de archivos (copiar + ruta automática) queda como mejora futura, no entra en esta versión.
- `store.js` queda solo para la matriz: biblioteca, migración, snapshots y respaldo. Usa `core.js`.

### 6.7 Esquema de una cotización (v2)

```
{
  version: 2,
  meta: {
    quoteNo, date, client, lede, duration, validity,
    taxEnabled, taxRate, payments[], closing, conditions[],
    slug, generatedAt, publishedUrl, publishedAt
  },
  bank: { holder, account, cci, detractions, bankName },
  // evidenceBank no va aquí: es global (library.evidenceBank)
  blocks: [{
    uid, serviceId, serviceName, title, tagline, duration,
    deliverables[], considerations[], process[],
    items[{ label, amount }],
    videos[{ title, src, poster }],
    images[{ title, src }]
  }],
  evidence: {
    mode: "service" | "general" | "both" | "none",
    generalIds: { videos: [], images: [] }
  }
}
```

`serviceName` se guarda en el bloque para que el cliente no dependa de `catalog.js`. Los bloques migrados lo reciben desde el catálogo.

### 6.8 Generador y ayudante

`tools/publicar.mjs` (Node, sin dependencias) maneja dos tipos de paquete:

**A. `kind: "pandora-cliente"` (publicar o actualizar)**

1. Lee y valida `version`, `slug`, `quote.blocks.length`, `quote.meta.client` y los medios (§6.6).
2. Normaliza el slug (`[a-z0-9-]`, 2–64 caracteres).
3. Comprueba `docs/c/<slug>/index.html`:
   - si no existe, crea;
   - si existe y su `pandora-quote-id` es distinto, aborta con un mensaje claro; `--force` lo permite.
4. Calcula la base relativa (`../../` para `docs/c/<slug>/`, `./` para `docs/index.html`).
5. Renderiza la plantilla `tools/cliente.template.html`:
   - `{{TITLE}}`, `{{DESCRIPTION}}`, `{{QUOTE_ID}}`, `{{GENERATED_AT}}`, `{{BASE}}`, `{{DATA}}`.
6. Escribe el archivo.
7. `git add docs/c/<slug>/index.html`, `git commit -m "Publicar <cliente> — <fecha>"`, `git push`.
8. Imprime la URL, la copia con `pbcopy` y, con `--open`, la abre tras 30 s (Pages tarda).
9. Si algo falla antes del push, deja el archivo escrito y muestra el error; no borra el paquete.

**B. `kind: "pandora-retiro"` (despublicar)**

1. Valida `version`, `slug` y `quoteId`.
2. Comprueba que `docs/c/<slug>/index.html` existe y que su `pandora-quote-id` coincide; si no, aborta (salvo `--force`).
3. Borra la carpeta `docs/c/<slug>/`.
4. `git add -A docs/c/<slug>`, `git commit -m "Retirar <cliente> — <fecha>"`, `git push`.
5. Imprime “Publicación retirada” y la URL que deja de existir. No abre el navegador.

Flags: `--dry-run` (no toca git ni borra), `--no-push`, `--force`, `--out <ruta>`, `--base <ruta>`, `--open`.

`tools/Publicar cliente.command`:

- `cd` a la raíz del repo;
- si recibe un archivo por arrastre, lo usa;
- si no, abre un selector de macOS (`osascript choose file`) en Descargas;
- ejecuta `node tools/publicar.mjs "<archivo>" --open`;
- deja la Terminal abierta con el resultado y la URL.

El mismo `.command` sirve para retirar: el tipo de paquete decide la acción. El selector acepta `pandora-*.json`.

### 6.9 URL y configuración

- `js/config.js`: `P.siteBase = "https://felipeflv.github.io/cotizacion-pandora"`.
- El ayudante lee esa misma línea con una expresión regular para construir la URL; no se duplica la constante.
- URL del cliente: `${siteBase}/c/${slug}/`.
- La URL se muestra en la biblioteca y en el diálogo de exportación (previsualización).
- Si cambia el host o el repo, se edita una línea.

### 6.10 Historial

- Cada exportación guarda un snapshot en `versions` (máx. 10 por cotización): `{ at, label, quote }`.
- La UI de historial lista fecha/hora y permite **Restaurar** (con confirmación). Restaurar no republica; deja la cotización como borrador con la fecha de hoy al volver a exportar.
- El historial de git conserva todas las páginas publicadas. No se publican versiones antiguas.

## 7. Comportamiento en detalle

### 7.1 Exportar

- El botón se deshabilita si no hay cliente o si no hay al menos un bloque con ítems.
- Si el cliente está vacío, se pide un nombre antes de seguir.
- Si `mode` es `general` sin piezas, se avisa y se exporta como `service`.
- Antes de descargar se validan **solo los medios que se van a embeber** según el modo (§6.6). Si hay piezas con `blob:`, `data:video/*`, `data:image/*` > 1.5 MB o rutas `assets/` inexistentes, se bloquea la descarga y se listan las piezas con la corrección concreta (“guarda el archivo en docs/assets/media/… y usa esa ruta”). En `none`, no se valida nada: los medios no se exportan.
- En `none` el paquete no incluye medios; la exportación no se bloquea por una pieza temporal guardada solo en la matriz.
- Al abrir el diálogo se muestra:
  - cliente, servicios, fecha de hoy, modo de evidencia, slug y URL prevista;
  - “Se guardará una copia en el historial”;
  - botón **Descargar paquete**;
  - instrucción: “Arrastra el archivo sobre Publicar cliente.command”.
- Al descargar:
  - se fija `generatedAt` y `date`;
  - se crea el snapshot;
  - se actualiza `publishedUrl` (previsualización) y `publishedAt` optimista;
  - se muestra un toast con la ruta del archivo y el siguiente paso.
- Si el usuario vuelve a exportar el mismo día, se crea otro snapshot; el slug no cambia.

### 7.2 Publicar

- El ayudante no abre el navegador hasta que el push terminó.
- Si `git push` falla (sin red, credenciales), muestra el error y la URL no se abre; el archivo ya está escrito y el usuario puede reintentar.
- Si no hay cambios (misma cotización, mismo día), `git commit` puede no tener nada; el script continúa y hace push si hay algo pendiente.
- El script no hace `pull` ni `rebase`; el repo es de un solo usuario. Si el push es rechazado, muestra el comando sugerido.
- El paquete descargado no se borra; el README indica que se puede eliminar después de publicar.
- **Retirar:** la biblioteca ofrece “Retirar publicación” en cada cotización con URL. Descarga un paquete `pandora-retiro-<slug>.json`; el mismo `.command` borra `docs/c/<slug>/`, hace commit y push. La URL deja de existir (404). La cotización y su historial siguen en la matriz. Si se retira la página raíz de H&S, se advierte que la URL base también deja de funcionar.
- Retirar no borra la cotización; borrar la cotización no retira la publicación. Son acciones separadas y se advierte en ambos diálogos.

### 7.3 Cliente

- Sin JavaScript, la página muestra la estructura pero no los capítulos (igual que hoy). Es aceptable para el uso previsto.
- Los videos se reproducen con `<video>` o embed de YouTube/Vimeo, igual que hoy.
- El lightbox y el PDF funcionan sin la matriz.
- La navegación por scroll usa `IntersectionObserver`.
- Si la sección general está activa, el título “Otros trabajos” y las etiquetas de servicio aparecen; si no, no se genera nada.
- En modo `none` no hay sección de evidencia, ni “Otros trabajos”, ni enlaces de navegación a ellas; el PDF tampoco las incluye.
- La fecha visible es la de generación; no hay input de fecha.
- No hay enlaces a la matriz ni a otros clientes.

### 7.4 Biblioteca

- Al abrir la matriz se carga la última cotización activa.
- Si no hay biblioteca, se migra la cotización actual o se crea una nueva con el servicio Meta Ads.
- El listado muestra: cliente, servicios, fecha de emisión, última edición, URL (si existe), estado de publicación (sin publicar / publicada / retirada) y acciones.
- Eliminar una cotización solo borra su copia local; si tenía URL publicada, el diálogo lo advierte y ofrece “Retirar publicación” antes o después. Nunca se borra una página de GitHub sin una acción explícita.
- El buscador no es necesario para 5–20 clientes; se puede añadir después.
- La biblioteca se guarda con debounce de 400 ms; al cambiar de cotización, guardado inmediato.
- Un indicador “Guardado en este navegador” reemplaza la nota actual; el respaldo sigue siendo manual.

## 8. Privacidad y límites (explícito)

- La matriz no se sirve en la web: GitHub Pages publica solo `/docs`.
- El repositorio es público: el código y las páginas de `/docs` son visibles en GitHub. La biblioteca (con los datos de todos los clientes) **no** se sube: vive en `localStorage` y en los respaldos JSON locales.
- Cada página de cliente contiene solo los datos de ese cliente.
- Las URLs no son adivinables (sufijo aleatorio) y no están enlazadas entre sí; `robots.txt` y `noindex` evitan indexación.
- No hay contraseña. Quien tenga la URL puede ver la propuesta. Si se requiere confidencialidad fuerte: repo privado con GitHub Pages de pago, o un hosting con autenticación (Netlify/Cloudflare) o backend.
- Los paquetes JSON descargados y los respaldos contienen datos de clientes; se guardan en la Mac y no se commitean (`.gitignore` para `pandora-*.json` y `pandora-biblioteca-*.json`).

## 9. Migración del sitio actual

- `assets/` se mueve a `docs/assets/` con `git mv`.
- `styles/app.css` y `styles/print.css` se mueven a `docs/app/`.
- `js/render.js` se mueve a `docs/app/` y se adapta a `readonly`.
- Se extrae `docs/app/core.js` de `store.js`.
- `js/store.js` se reescribe para la biblioteca; `js/app.js` se adapta.
- `js/catalog.js` se queda en la raíz; añade `serviceName` y la semilla del banco.
- `index.html` (matriz) actualiza las rutas a `docs/...`.
- `docs/index.html`: **la URL actual sigue funcionando** y pasa a ser la versión cliente de H&S, en modo lectura y con la fecha de generación. Para no romper el enlace que ya pudo compartirse, `docs/index.html` redirige a `./c/<slug-hs>/` con `<meta http-equiv="refresh">`. Si se prefiere una portada neutral, se reemplaza ese archivo.
  - Esta es una decisión del constructor, no del usuario. Se puede vetar.
- La fuente de GitHub Pages se cambia a `main` / `/docs` una sola vez.
- El repo conserva el historial; la página raíz anterior deja de servirse desde `/` y pasa a `docs/index.html`.

## 10. Pruebas y criterios de aceptación

### Matriz

- Abre con `file://` sin errores de consola.
- Migra la cotización existente a la biblioteca una sola vez.
- Crear, duplicar, eliminar y cambiar de cliente conserva los datos.
- Editar todos los campos y recargar conserva los cambios.
- El respaldo JSON exporta e importa la biblioteca completa.
- El banco general permite añadir, reemplazar y quitar piezas con rutas de `docs/assets/` o enlaces.
- El modo `Servicio / General / Ambas / Ocultar` se refleja en el paquete exportado.
- “Modo cliente nuevo” cambia a `general`; si no había selección, marca todo el banco; si había una, la conserva.
- En `Ocultar`, el paquete no lleva `videos`/`images` ni el banco, y una pieza temporal guardada en la matriz no bloquea la exportación.
- La exportación fija la fecha de hoy y descarga un JSON válido.
- La exportación bloquea piezas con `blob:`, `data:video/*`, `data:image/*` > 1.5 MB y rutas inexistentes **cuando esas piezas se van a embeber**.
- Los datos de depósito (`quote.bank`) llegan intactos al cliente y al PDF.
- El slug se genera una vez y no cambia al reeditar el nombre.
- El historial guarda y restaura una versión.
- Eliminar una cotización no borra su página publicada; retirar sí, y son acciones separadas.

### Versión cliente

- El HTML generado **no contiene** `contenteditable`, `<input>`, `<textarea>`, ni textos “Editar”, “Reemplazar”, “Añadir entrega”, “Importar”, “Guardar”.
- No hay llamadas a `localStorage` ni `fetch` en `client.js`.
- Renderiza portada, alcance, evidencia (según modo), otros trabajos, inversión y condiciones.
- En `none`, no hay sección de evidencia, ni “Otros trabajos”, ni esas entradas de navegación; el JSON embebido no contiene los medios.
- Los videos reproducen; el lightbox abre y cierra; el PDF sale en A4 sin botones.
- La fecha mostrada es la de generación.
- La navegación oculta secciones ausentes y no hay enlaces rotos.
- Responsive 360, 390, 768, 1024 y 1440 px sin overflow horizontal.
- Sin errores de consola.
- `robots.txt` y `noindex` presentes.

### Publicación

- `--dry-run` genera el HTML en una carpeta temporal sin tocar git.
- El ayudante rechaza un slug con formato inválido.
- Detecta colisión de slug con otro `quote-id` y aborta sin `--force`.
- El commit contiene solo `docs/c/<slug>/index.html`.
- La URL impresa coincide con `siteBase/c/<slug>/`.
- Republicar actualiza el mismo archivo y la fecha; la URL no cambia.
- Retirar borra `docs/c/<slug>/index.html`, hace commit y push; la URL devuelve 404.
- Retirar un slug con `quote-id` distinto aborta sin `--force`.
- Un paquete con `blob:` o una ruta de asset inexistente falla con un mensaje que nombra la pieza y la ruta.

### PDF

- 4 páginas con un servicio y modo `servicio`.
- 5–6 páginas con dos servicios.
- Con modo `general`, incluye “Otros trabajos” y no incluye la evidencia de servicio.
- Con modo `none`, no incluye páginas de evidencia ni “Otros trabajos”.
- Portada con fecha, vigencia, contacto y correo.

## 11. Fases de implementación

1. **Base compartida y modo lectura**
   - mover assets/styles/render a `docs/`;
   - extraer `core.js`;
   - `render.js` con `readonly` y evidencias;
   - `client.js` + plantilla;
   - generar una página de prueba y verificar que no hay controles de edición.
2. **Biblioteca**
   - `store.js` v1, migración, UI de cotizaciones, respaldo;
   - adaptar `app.js`.
3. **Evidencias generales**
   - banco, semilla, selección por cotización, modos (incluido `none`), “Modo cliente nuevo”;
   - render de “Otros trabajos” y supresión total de la evidencia;
   - construcción del payload según el modo.
4. **Generador y publicación**
   - `publicar.mjs`, `.command`, `config.js`, validaciones de medios y slugs;
   - publicar y retirar;
   - probar `--dry-run`, colisión, push real;
   - cambiar Pages a `/docs`.
5. **Migración H&S, README y verificación**
   - generar la página raíz de H&S;
   - README con el flujo;
   - pruebas E2E, PDF y responsive.

Cada fase termina con una verificación ejecutable; no se avanza con errores de consola o controles de edición filtrados.

## 12. Decisiones del constructor (revisables)

- Fuente de Pages en `/docs`; matriz en la raíz, fuera de lo publicado.
- Assets y código compartido dentro de `docs/` para no duplicar 6 MB.
- Plantilla de cliente separada de `index.html` (evita arrastrar diálogos y edición al cliente).
- Render único con `readonly` en lugar de dos renderizadores.
- Slug = nombre del cliente + 4 caracteres aleatorios; estable tras la primera exportación.
- Paquete JSON + ayudante local en lugar de intentar publicar desde el navegador.
- Historial local de 10 snapshots + historial de git.
- `docs/index.html` redirige a la página de H&S para no romper el enlace actual.
- Sin buscador en la biblioteca; se añade si supera los ~20 clientes.
- Sin copia de datos bancarios en el cliente (el botón “Copiar” es de edición); el texto sigue seleccionable.
- `quote.bank` (datos de depósito) se mantiene por cotización y se siembra desde `defaultQuote()`; `library.evidenceBank` es el banco de medios. Nombres separados para no confundirlos.
- Los medios solo se publican desde rutas de `docs/assets/` o enlaces (YouTube/Vimeo/directo); el selector de archivo local es vista previa y se bloquea al exportar.
- El modo `none` (“Ocultar”) elimina la evidencia del payload, no solo de la vista; así los medios no quedan en el HTML del cliente.
- Borrar y retirar son acciones distintas; retirar requiere un paquete y un push explícito.

## 13. Preguntas abiertas

Ninguna que bloquee el plan. Las decisiones del constructor están marcadas arriba y se pueden vetar antes de implementar.
