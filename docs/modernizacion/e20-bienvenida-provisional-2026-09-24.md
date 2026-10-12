# E20 — Bienvenida general provisional: relevo a E21

> **U11 (2026-10-08):** la bienvenida deja de ser provisional. `WelcomeBanner.svelte` se sustituyó por `home/HomeWelcome.svelte` y el contenido de `welcome.ts` añade `eyebrow` e `illustration`. La regla de sesión no cambia. La sección "Retirada" ya no aplica tal cual. Ver [`u11-bienvenida-beta-entidades-2026-10-08.md`](./u11-bienvenida-beta-entidades-2026-10-08.md).

Estado: **implementada y verificada localmente**. No hubo cambios de datos, autenticación, Supabase, permisos, producción, commit ni push.

## Dependencias y contrato consumido

- E04 está disponible operativamente mediante los tokens de foco, target táctil y reduced motion ya usados por las superficies posteriores. No existe un expediente E04 independiente en `docs/modernizacion`; sus pruebas y consumo están documentados por E13, E14, E15 y E19.
- E13 está implementada localmente y su relevo establece que E20 no controla la barra ni el estado de búsqueda. E20 sólo usa `parseSearchState` y `hasSearchCriteria` para suprimir enlaces compartidos.
- E19 está implementada y verificada localmente. Una URL beta válida se trata como entrada que consume la decisión de bienvenida y sólo puede montar la invitación beta.

## Comportamiento entregado

- El layout raíz registra una sola vez la ruta inicial de la pestaña en `sessionStorage`. La bienvenida sólo puede mostrarse en la primera carga directa de `/`; una navegación posterior desde una ruta interna no se confunde con un cold start.
- La decisión se consume por sesión de pestaña también para entradas directas con filtros reconocidos, `modal` o beta válida. Por tanto la bienvenida no aparece después de cerrar una beta ni tras abrir un enlace compartido.
- El banner no es modal ni overlay: queda antes de Buscar dentro del flujo, no bloquea teclado, grilla ni lectura del catálogo. Cierre y CTA persisten la decisión de sesión.
- El CTA `Explorar` desplaza y enfoca Buscar (o la grilla como respaldo), respetando `prefers-reduced-motion`. El cierre tiene exactamente `aria-label="Cerrar bienvenida"`.
- `src/lib/content/welcome.ts` concentra copy, labels y el contrato de contenido. `WelcomeBanner.svelte` acepta ese contenido como prop. El visual es un placeholder CSS local con aspect ratio definido, sin red y sin presentarse como arte definitivo. No se añade fecha ni telemetría.

## Verificación local

- `npm test` — **52/52 PASS**.
- `PLAYWRIGHT_PORT=4218 npx playwright test tests/browser/e20-welcome.spec.ts tests/browser/e19-beta-invitation.spec.ts tests/browser/e13-results-composition.spec.ts --workers=1 --reporter=line` — **11 PASS, 3 skipped por configuración de flag**.
- `VITE_BETA_INVITATION_ENABLED=true PLAYWRIGHT_PORT=4219 npx playwright test tests/browser/e19-beta-invitation.spec.ts tests/browser/e20-welcome.spec.ts --workers=1 --reporter=line` — **7 PASS, 1 skipped por configuración de flag**.
- `npm run build` y `git diff --check` — **PASS**.

La suite E20 cubre primera visita, recarga tras cierre, pestaña nueva, filtros/modal/beta, entrada interna, CTA/foco, 360/390/768/1440, reduced motion y ausencia de scroll horizontal. E19 cubre además el diálogo beta con teclado, foco, backdrop y móvil.

## Retirada, rollback y relevo a E21

Para retirar la bienvenida provisional, eliminar en un mismo cambio:

1. `src/lib/components/WelcomeBanner.svelte`, `src/lib/content/welcome.ts` y `src/lib/ui/welcomeSession.ts`.
2. El contexto e imports E20 de `src/routes/+layout.svelte`.
3. La integración, handlers e imports E20 de `src/routes/+page.svelte`.
4. `tests/browser/e20-welcome.spec.ts` y este expediente, cuando ya no se requiera trazabilidad.

No hay flag, migración ni dato remoto que retirar; una reversión de esos archivos restaura el banner. Antes de una sustitución por copy/arte final, actualizar sólo `WELCOME_CONTENT` y el visual local o la prop del componente, después ejecutar la matriz E20/E19 y la verificación visual de E21. Si la experiencia final cambia la política de sesión o convierte el banner en overlay, requiere una etapa/decisión nueva: E20 no autoriza ese cambio.
