# Cotizador Pandora

Dashboard web interactivo para presentar cotizaciones de Pandora Marketing: alcance por servicio, evidencia (videos y piezas) e inversión, con edición en vivo y exportación a PDF.

No tiene build, ni dependencias, ni servidor propio: son archivos estáticos.

---

## Abrir

**Opción rápida:** doble clic en `index.html`.

**Opción recomendada** (evita restricciones del navegador con `file://` y con los videos):

```bash
cd "Cotizador Pandora"
python3 -m http.server 4173
```

Luego abre <http://localhost:4173>.

Funciona en Chrome, Edge, Safari y Firefox actuales. Los videos se reproducen dentro del dashboard; los MP4 incluidos usan H.264, compatibles con todos los navegadores modernos.

---

## Editar la cotización

1. Pulsa **Editar** (arriba a la derecha). Se habilitan los campos y aparecen los controles de edición.
2. Haz clic en cualquier texto y escribe: cliente, fecha, duración, vigencia, entregables, consideraciones, condiciones y datos bancarios.
3. Los montos se editan directamente en la columna de inversión. Los porcentajes de pago (60/40) también.
4. Con **+ Añadir** puedes sumar entregables, consideraciones, condiciones, líneas de inversión o servicios completos.
5. La **✕** de cada fila elimina ese ítem.

Los cambios se guardan automáticamente en este navegador (`localStorage`, clave `pandora.cotizacion.v1`). No se suben a ningún servidor.

Para volver al estado original: **Editar → Restablecer**.

### Varios servicios en una cotización

**Editar → Añadir otro servicio a esta cotización**. Cada servicio añade su propio capítulo (alcance + evidencia), sus ítems de inversión y se suma al total. El selector permite cambiar el servicio de un capítulo ya creado.

Servicios disponibles en el catálogo: Audiovisual, Branding, Diseño gráfico, Redes sociales y Meta Ads.

---

## Reemplazar la evidencia

Cada capítulo tiene dos videos y tres piezas gráficas. En modo edición, usa **Reemplazar** bajo cada pieza o **+ Añadir video / + Añadir imagen**.

### Con enlaces (recomendado para videos largos)

Pega la URL de YouTube, Vimeo o un video directo (`.mp4`). YouTube y Vimeo se abren en un reproductor embebido; el resto se reproduce en el propio marco.

### Con archivos locales

1. Copia el archivo a `assets/media/<servicio>/`.
2. En el diálogo, escribe la ruta relativa, por ejemplo `assets/media/metaads/metaads-1.mp4`.

> Si eliges un archivo con el botón "Elegir archivo del equipo", se verá al instante, pero el navegador no puede conservarlo al recargar (por seguridad). Para que quede fijo, guarda el archivo dentro de `assets/media/` y usa su ruta.

Convención actual de nombres:

```
assets/media/
  audiovisual/   audiovisual-1.mp4  audiovisual-1.jpg  audiovisual-1.png …
  branding/      branding-1.mp4     branding-1.jpg     branding-1.png …
  diseno/        …
  metaads/       metaads-1.mp4      metaads-1.jpg      metaads-1.png …
  redes/         …
```

Los posters (`-1.jpg`, `-2.jpg`) son las portadas de los videos; si cambias el video, conviene reemplazar también su poster.

### Cambiar la evidencia por defecto

Edita `js/catalog.js`: cada servicio tiene `videos` (con `src` y `poster`) e `images` (`src`). Es la vía más rápida si vas a reutilizar el mismo material en varias cotizaciones.

---

## Exportar a PDF

Pulsa **Exportar PDF** (o `Ctrl/Cmd + P`). En el diálogo de impresión:

- Destino: **Guardar como PDF**
- Papel: **A4**
- Márgenes: **Predeterminado**
- Escala: **100 %** (no "Ajustar a la página")
- **Gráficos en segundo plano: activado** (sin esto se pierden colores, barras y fondos)

El documento sale en cuatro páginas: portada, alcance + proceso, evidencia, inversión + condiciones. Los saltos de página están definidos en `styles/print.css`; el diseño de pantalla está en `styles/app.css`.

Si una cotización con varios servicios genera más capítulos, cada uno abre en página nueva y el pie de marca se imprime al final.

---

## Importar y exportar datos

En modo edición, al final de la sección **Condiciones**:

- **Exportar datos**: descarga la cotización completa en JSON (útil como respaldo o para enviarla a otra persona).
- **Importar datos**: carga un JSON exportado previamente.

El JSON contiene `meta` (cliente, fecha, condiciones, pagos), `blocks` (servicios con alcance, evidencia e ítems) y `bank`.

---

## Estructura del proyecto

```
index.html            Estructura del dashboard
styles/app.css        Diseño de pantalla (tokens, layout, responsive)
styles/print.css      Hoja A4 y paginación del PDF
js/catalog.js         Catálogo de servicios + cotización inicial
js/store.js           Persistencia, totales y formato (moneda, fechas)
js/render.js          Plantillas de capítulos, inversión y condiciones
js/app.js             Interacciones: edición, medios, import/export
assets/fonts/         Newsreader + Archivo (self-hosted)
assets/media/         Evidencia demo por servicio
assets/logo-*.png     Logo de Pandora
tools/art.html        Generador de las piezas demo (no se usa en producción)
cotizacion.docx       Documento original de la cotización (solo referencia)
```

### Identidad gráfica

Paleta: tinta `#28363B`, morado `#4600BB`, pasteles `#BFE0C8`, `#BFD3EA`, `#E6CBA6`, `#CBB8F0`, papel `#F8F7F5`. Tipografías: **Newsreader** para títulos y **Archivo** para interfaz y datos.

Todo se define como variables CSS al inicio de `styles/app.css`.

---

## Publicar en GitHub Pages

El dashboard no requiere build: se publica la rama `main` tal cual.

```bash
git init -b main
git add .
git commit -m "Cotizador Pandora: dashboard de cotización"
gh repo create cotizacion-pandora --public --source=. --remote=origin --push
gh api -X POST repos/FelipeFLV/cotizacion-pandora/pages \
  -f source[branch]=main -f source[path]=/
```

La URL queda como `https://felipeflv.github.io/cotizacion-pandora/` (tarda uno o dos minutos en activarse).

Con el flujo manual: crear el repo en GitHub, `git remote add origin …`, `git push -u origin main` y en **Settings → Pages** elegir *Deploy from a branch* → `main` → `/ (root)`.

> El repositorio es público y la URL se puede compartir con quien quieras. La página lleva `noindex, nofollow`, así que no aparece en buscadores, pero cualquiera con el enlace puede verla. Evita el nombre del cliente en el nombre del repo.

Cada cambio futuro se publica con `git add . && git commit -m "…" && git push`; Pages se actualiza solo.

---

## Notas

- La evidencia incluida es material de muestra generado para esta demo; reemplázala con piezas reales antes de enviar una cotización.
- Los datos de la empresa (RUC, cuentas, contacto) están en el HTML y en `js/catalog.js` (`bank`). Revísalos si cambian.
- No hay backend ni analítica: nada sale del equipo del usuario.
