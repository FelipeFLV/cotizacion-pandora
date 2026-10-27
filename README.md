# Cotizador Pandora

Dos capas en un mismo repo:

- **Matriz privada** (`index.html`): se abre en tu Mac y sirve para preparar todas las cotizaciones (cliente 01, 02…), editar precios, condiciones, evidencias y datos de pago.
- **Versión cliente** (`docs/c/<slug>/`): página de solo lectura, publicada en GitHub Pages, sin edición ni guardado. Queda visible aunque la Mac esté apagada.

La propuesta de H&S Inmobiliaria sigue disponible en la URL de siempre:
<https://felipeflv.github.io/cotizacion-pandora/> → redirige a su página de cliente.

---

## 1. Abrir la matriz

Doble clic en `index.html`. No necesita servidor ni build.

Si el navegador bloquea videos con `file://`:

```bash
cd "Cotizador Pandora"
python3 -m http.server 4173
```

Y abre <http://localhost:4173>.

---

## 2. Preparar una cotización

1. Pulsa **Editar** y haz clic en cualquier texto para cambiarlo.
2. **Cotizaciones** (arriba) abre la biblioteca guardada en este navegador:
   - **Nueva** crea una cotización desde un servicio.
   - **Duplicar** copia una existente.
   - **Eliminar** borra la seleccionada (siempre queda al menos una).
   - **Respaldar** descarga un JSON con toda la biblioteca.
   - **Importar respaldo** reemplaza la biblioteca actual.
3. El pie “Guardado en este navegador” confirma cada guardado.

La biblioteca vive en `localStorage` (clave `pandora.biblioteca.v1`). No se sube al repo ni a ningún servidor. Si limpias los datos del navegador se pierde: restaura tu respaldo JSON.

El costo y el precio son el mismo número: el precio se arma con las líneas de inversión de cada servicio.

---

## 3. Evidencias

El botón **Evidencias** define qué verá el cliente:

- **Servicio**: videos e imágenes de cada servicio de la cotización.
- **General**: piezas de otros trabajos, elegidas del banco general.
- **Ambas**: las dos cosas.
- **Ocultar**: no se muestra ninguna evidencia en la versión cliente.

**Modo cliente nuevo** cambia a `General` y, si no había selección, marca todo el banco; si ya había una selección, la conserva.

Si exportas en modo `General` sin ninguna pieza marcada, la matriz avisa y usa la evidencia de cada servicio como respaldo.

Para sumar una pieza al banco general:

1. Copia el archivo a `docs/assets/media/general/`.
2. En **Evidencias → + Video / + Imagen**, usa la ruta `assets/media/general/<archivo>`.
3. También acepta enlaces de YouTube o Vimeo, y `https://` directos.

El selector de archivo local solo sirve para previsualizar en esta sesión. Al exportar se bloquean los `blob:` y los videos `data:`; las imágenes incrustadas deben pesar menos de 1.5 MB. La evidencia durable siempre es un archivo dentro de `docs/assets/` o un enlace `https://`.

---

## 4. Publicar

1. En la matriz, pulsa **Exportar cliente**.
2. Revisa la URL y descarga el paquete `.json`.
3. Arrastra el archivo sobre **`tools/Publicar cliente.command`** (o haz doble clic y elígelo).
4. El ayudante escribe `docs/c/<slug>/index.html`, hace commit y `git push`.
5. Al terminar imprime la URL y la copia al portapapeles. GitHub Pages puede tardar un minuto.

La primera exportación fija el slug del cliente. **Republicar conserva la misma URL**, actualiza la fecha de generación y guarda una versión en el historial.

El comando también acepta:

```bash
node tools/publicar.mjs paquete.json --dry-run   # escribe la página sin tocar git
node tools/publicar.mjs paquete.json --no-push   # commit local, sin subir
node tools/publicar.mjs paquete.json --open      # abre la URL al terminar
```

Si el paquete trae un medio inexistente, un esquema inseguro o un slug que ya pertenece a otro cliente, el ayudante se detiene y no borra el paquete.

---

## 5. Retirar una publicación

1. **Cotizaciones → Retirar** en la cotización publicada.
2. Se descarga un paquete `pandora-retiro-…json`.
3. Arrástralo sobre el mismo `.command`.

La URL deja de existir (404), pero la cotización y su historial siguen en la biblioteca local. Mientras el paquete no se aplique, la biblioteca muestra **Retiro pendiente**; retirar es distinto de eliminar.

---

## 6. Historial

- **Local**: cada exportación guarda un snapshot con fecha y hora. **Historial → Restaurar** vuelve a una versión anterior. Se conservan las últimas 10.
- **Git**: cada publicación es un commit; el historial completo queda en el repo.

Restaurar no cambia la URL publicada hasta que vuelvas a exportar.

---

## 7. Privacidad y límites

El repo es público y las páginas no tienen contraseña. La protección es:

- URL no adivinable: `/c/<slug>/` con un sufijo aleatorio.
- `<meta name="robots" content="noindex, nofollow, noarchive">` y `docs/robots.txt` con `Disallow: /`.

Eso evita que Google las indexe, pero **cualquiera con el enlace puede abrirla**. Para material confidencial hace falta otro hosting con autenticación (por ejemplo, un sitio privado o un enlace firmado con caducidad).

La matriz nunca se publica: GitHub Pages sirve únicamente la carpeta `docs/`.

---

## 8. Solución de problemas

| Problema | Qué hacer |
| --- | --- |
| `git push` rechazado | Revisa conexión y permisos del repo. El commit local queda hecho; vuelve a ejecutar el comando o haz `git push`. |
| La URL tarda en cambiar | GitHub Pages tarda hasta un minuto. Recarga con caché limpia. |
| “No existe el medio …” | Copia el archivo a la ruta indicada dentro de `docs/assets/` o usa un enlace `https://`. |
| La biblioteca aparece vacía | Los datos del navegador se borraron. Importa tu respaldo JSON. |
| El `.command` no abre | `chmod +x "tools/Publicar cliente.command"` y vuelve a intentar. |
| Quiero revisar antes de publicar | Usa `--dry-run` y abre `docs/c/<slug>/index.html` con un servidor local. |

---

## 9. Estructura del repo

| Ruta | Qué es | ¿Se publica? |
| --- | --- | --- |
| `index.html` | Matriz privada | No |
| `js/` | Lógica de la matriz | No |
| `docs/c/<slug>/` | Versiones cliente | Sí |
| `docs/app/` | CSS y JS compartido | Sí |
| `docs/assets/` | Logos, fuentes y medios (~6 MB) | Sí |
| `docs/index.html` | Redirección de la URL antigua a H&S | Sí |
| `docs/robots.txt`, `docs/.nojekyll` | Control de indexación y despliegue | Sí |
| `tools/` | Generador, plantilla y `.command` | Sí (no se sirve como página) |
| `specs/` | Diseño y plan de la migración | No (local) |
| `tests/` | Pruebas unitarias y E2E | Sí |

GitHub Pages debe estar configurado en **Settings → Pages → Source: `main` / `/docs`**.

---

## 10. Pruebas

```bash
node --test tests/*.test.mjs   # unitarias
node tests/e2e.mjs             # matriz, biblioteca, evidencias, cliente y exportación
```

El E2E levanta un servidor local en un puerto libre y limpia `docs/c/_e2e*` y `tests/tmp/` al terminar. No escribe en git.
