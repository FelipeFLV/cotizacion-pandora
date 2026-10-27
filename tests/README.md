# Pruebas

Requisitos: Node 24, Python 3 (servidor estático del E2E) y Chrome/Chromium disponible para Playwright.

```bash
node --test tests/*.test.mjs   # unitarias
node tests/e2e.mjs             # extremo a extremo
```

## Unitarias

| Archivo | Cubre |
| --- | --- |
| `core.test.mjs` | Utilidades puras: totales, dinero, fechas, slugs, `assetUrl`. |
| `store.test.mjs` | Biblioteca en `localStorage`, migración de la cotización antigua, snapshots (máx. 10) y restauración. |
| `evidence.test.mjs` | Banco de evidencias, semilla por servicio y limpieza de selecciones al quitar una pieza. |
| `payload.test.mjs` | `buildClientPayload` en los cuatro modos y `validateMedia` (blob, data, esquemas, tamaño). |
| `build.test.mjs` | Plantilla de cliente, `pandora-quote-id`, fecha y escape de `</script>`. |
| `publicar.test.mjs` | Validación de paquetes, slugs, generación en `docs/c/<slug>/`, colisiones, medios faltantes y retiro. |

## E2E

`tests/e2e.mjs` levanta un servidor en un puerto libre y ejecuta, en orden:

1. **Matriz** (`file://`): carga, logo, edición persistente, biblioteca y respaldo.
2. **Evidencias**: banco, modos, “Modo cliente nuevo” y piezas quitadas.
3. **Exportación**: paquete descargado, URL, historial, restauración, bloqueo por `blob:` y retiro.
4. **Cliente** (HTTP local): cuatro modos, sin controles de edición, sin `localStorage`, videos y lightbox.
5. **PDF**: con `emulateMedia('print')` comprueba que la barra, acciones y botones se ocultan, y que la marca y el pie impresos se ven.
6. **Responsive**: 360, 390, 768, 1024 y 1440 px en matriz (con un cliente de 60 caracteres) y en cliente `service`/`general`, sin desbordes.
7. **Publicación**: `--dry-run` escribe en `tests/tmp/`, y aborta con slug inválido o medio inexistente.

Al terminar, el bloque `finally` cierra el navegador, mata el servidor y borra `docs/c/_e2e*` y `tests/tmp/`. La suite no hace commits ni push.

## Fixtures

- `fixtures/cliente.json`: paquete `pandora-cliente` válido (slug `demo`, cotización `q_test`).
- `fixtures/retiro.json`: paquete `pandora-retiro` para el mismo slug.
