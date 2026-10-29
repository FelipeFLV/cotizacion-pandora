# Edge Function `publish`

Publica una cotización aprobada en GitHub Pages con **un solo commit atómico**:
primero crea los blobs, el árbol y el commit; solo al final mueve la rama. Si algo
falla antes de ese último paso, la rama queda intacta.

## Qué hace

1. Comprueba la sesión (`Authorization: Bearer`) y que el correo sea `ALLOWED_EMAIL`.
2. Carga la cotización y verifica que pertenece al usuario.
3. Reserva el slug si la fila todavía no tiene uno.
4. Descarga de `drafts` las imágenes referenciadas como `media:<id>`.
5. Genera el HTML de cliente y las rutas públicas `assets/c/<slug>/…`.
6. Publica con un commit atómico en GitHub.
7. Marca la cotización como publicada, guarda una versión y cierra el job de auditoría.

## Secretos

Configúralos con `supabase secrets set` (nunca en el repositorio):

| Secreto | Ejemplo | Uso |
| --- | --- | --- |
| `ALLOWED_ORIGIN` | `https://felipeflv.github.io` | Único origen con CORS (esquema + host, sin ruta). |
| `ALLOWED_EMAIL` | `felipeflores1986@gmail.com` | Único correo autorizado. |
| `GITHUB_TOKEN` | `github_pat_…` | Token fine-grained con *Contents: read and write* sobre el repo. |
| `GITHUB_REPO` | `FelipeFLV/cotizacion-pandora` | Repositorio de Pages. |
| `GITHUB_BRANCH` | `main` | Rama que publica Pages. |
| `SITE_BASE` | `https://felipeflv.github.io/cotizacion-pandora` | Base pública para calcular la URL. |

`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` los inyecta Supabase automáticamente.
La función usa la service role solo después de validar la sesión y la propiedad de
la fila; nunca acepta `owner_id` del cliente.

## Despliegue

```bash
supabase login
supabase link --project-ref zvusvaotqtchaglwyifl
supabase functions deploy publish
```

La verificación de JWT se mantiene activa (comportamiento por defecto). Además,
`requireUser` vuelve a validar el token y el correo.

## Prueba local

```bash
supabase functions serve publish --env-file supabase/.env.local
```

```bash
curl -X POST "http://localhost:54321/functions/v1/publish" \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"quoteId":"<uuid>"}'
```

Respuesta correcta: `{ "url": "…/c/<slug>/", "commit": "<sha>" }`.

## Errores y reversión

- Un fallo de red, de GitHub o del plan devuelve `4xx/5xx` y deja `publish_jobs`
  en `error` con un mensaje saneado.
- Si el commit ya se creó pero falla la actualización de la fila, se responde
  `500` con un mensaje explícito; el commit se puede revertir desde GitHub y
  volver a publicar.
- Republicar el mismo slug reutiliza la URL y borra solo las imágenes viejas de
  `docs/assets/c/<slug>/`, nunca otros activos.

## Pruebas

```bash
node --test tests/github.test.mjs tests/publish-plan.test.mjs tests/publish-http.test.mjs tests/publish-core.test.mjs
```

Cubren la secuencia exacta de llamadas a GitHub, el fallo del árbol sin mover la
rama, el reintento solo ante `5xx`, el filtrado de `listPaths`, la sustitución de
medios, la conservación de activos heredados, los borrados acotados al slug, el
rechazo de plantillas, esquemas peligrosos y videos que no son de YouTube/Vimeo, y
el flujo completo contra Supabase y GitHub simulados (incluida la evidencia del
banco de otro usuario).
