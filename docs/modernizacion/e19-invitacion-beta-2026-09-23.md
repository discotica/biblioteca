# E19 — Invitación beta temporal: relevo a E21

> **U11 (2026-10-08):** `BetaInvitation.svelte` usa ahora la primitiva `Dialog` (con `closeLabel` y `data-beta-invitation`). El contrato de este documento no cambia. Ver [`u11-bienvenida-beta-entidades-2026-10-08.md`](./u11-bienvenida-beta-entidades-2026-10-08.md).

Estado: **implementada y verificada localmente**. No hubo cambios en Supabase, datos, permisos, parser de búsqueda, producción, commit ni push.

## Contrato entregado

- `VITE_BETA_INVITATION_ENABLED=false` es el valor seguro. Es sólo un kill switch de presentación: no interpreta ni monta la invitación y no concede acceso, autenticación ni permisos.
- Sólo en `/`, `?beta` y `?beta=1` activan la invitación. `nombre` sin beta, `beta=true`, valores distintos y beta repetido no activan nada. Las rutas internas ignoran ambos parámetros.
- `nombre` se decodifica como Unicode, normaliza a NFC, reemplaza saltos/tabs, colapsa espacios y limita a 40 grafemas visibles. Vacío o repetido usa el copy genérico.
- El diálogo E04 inserta el nombre como texto Svelte, nunca HTML. El cierre, Escape, backdrop y `Explorar` eliminan sólo `beta`/`nombre` mediante `replaceState`, conservan filtros E12 y actualizan también los parámetros desconocidos retenidos; por ello no se reintroducen en enlaces posteriores.
- Copy final: `Hola, {nombre}.` o `Bienvenida a la beta de Discótica`; cuerpo `Estás entrando a una versión en prueba de nuestra biblioteca. Explora el catálogo y cuéntanos si encuentras algo que podamos mejorar.`; CTA `Explorar`. No hay fecha configurada.
- El correo beta es `hola@discotica.com`, ya publicado en Privacidad. Se explica por separado el canal protegido `Reportar un problema`, disponible tras iniciar sesión.

## Seguridad, accesibilidad y pruebas

- XSS como `<img onerror=alert(1)>` se renderiza como texto, sin nodo `img` creado.
- El diálogo es modal, con nombre accesible, foco inicial en cerrar, Tab contenido por E04, Escape/backdrop/CTA y retorno al disparador Buscar; funciona a 360 px sin overflow horizontal.
- `npm test` — **52/52 PASS** (incluye matriz de params, Unicode/NFC/emoji, 40/41 grafemas, XSS, limpieza idempotente y no propagación).
- `VITE_BETA_INVITATION_ENABLED=true npx playwright test tests/browser/e19-beta-invitation.spec.ts --workers=1 --reporter=line` — **3 PASS, 1 skip** (el caso de flag apagado se omite correctamente).
- `VITE_BETA_INVITATION_ENABLED=false npx playwright test tests/browser/e19-beta-invitation.spec.ts --workers=1 --reporter=line` — **1 PASS, 3 skip** (los casos activos se omiten correctamente).
- `npx playwright test tests/browser/e12-search-state.spec.ts --workers=1 --reporter=line` — **3/3 PASS**, incluida rehidratación Back/Forward de filtros E12.
- `npm run build` y `git diff --check` — **PASS**.

## Retirada y relevo a E21

1. Poner `VITE_BETA_INVITATION_ENABLED=false` para desactivar inmediatamente la interfaz, conservando las URLs antiguas sin UI.
2. Tras el periodo acordado, retirar `BetaInvitation.svelte`, `betaInvitation.ts`, su integración en `+page.svelte`, la variable de `.env.example` y las pruebas E19 en el mismo cambio.
3. Mantener E12 intacta: no se migra ni altera `searchState.ts`; los enlaces beta históricos sólo quedan como parámetros desconocidos inertes mientras el flag esté apagado.
4. Confirmar en staging la matriz con ambos valores de flag antes de retirar los archivos. No hay rollback de datos: revertir esos archivos restaura la beta.
