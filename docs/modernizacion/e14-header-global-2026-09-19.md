# E14 — Header global: relevo a E15 y E19

## Estado

E14 queda implementada sobre las primitivas `dropdownMenu` y las capas de E04. No se modificaron datos, Supabase, flags de catálogo, búsqueda móvil, invitación beta ni producción.

## API y comportamiento entregados

`src/lib/components/Header.svelte` es global desde el layout y no recibe props.

- Sin sesión, `Sugerir` permanece visible y apunta a `/auth/login?redirect=%2Fsugerir`; `Entrar` es la acción primaria. El enlace a registro y el regreso posterior a login preservan ese `redirect`.
- Con sesión, `Perfil`, `Mis crates` y `Salir` forman el grupo de cuenta. El perfil usa `user_metadata.username`, igual que las rutas existentes.
- `Menú` contiene exclusivamente los secundarios: Manual, Blog, Substack e Instagram. El footer conserva esos enlaces.
- Todos los iconos decorativos llevan texto visible; los disparadores y enlaces mantienen nombre accesible.
- El menú consume `dropdownMenu`: foco inicial en el primer elemento, Tab contenido, Escape/clic exterior y retorno exacto al disparador. No bloquea el scroll.
- El header usa `z-index: calc(var(--layer-overlay) - 1)`, por debajo de los overlays E04. Al abrir un overlay modal, E04 lo vuelve `inert` y `aria-hidden`.

## Matriz de breakpoints y scroll

| Contexto | Desktop `>768px` | Móvil `≤768px` |
| --- | --- | --- |
| Acciones visibles | Sugerir, grupo de cuenta/Entrar y Menú | Sugerir, Entrar anónimo y disparador del menú |
| Secundarios | Menú desplegable | Mismo menú desplegable |
| Scroll | Conserva ocultar/reaparecer por dirección, con umbral de 8 px | Se oculta al bajar 8 px; solo reaparece en `scrollY = 0` |
| Congelación | Menú abierto, campo enfocado o cambio grande de `visualViewport` | Igual; la reducción/variación de 120 px o más se trata como teclado |

El estado se reancla mientras está congelado y al cruzar el breakpoint. Así E15 puede posicionar su barra sin leer ni inferir la altura/visibilidad del header: en móvil no debe esperar que vuelva salvo en el inicio.

## Pruebas ejecutadas

- `npx playwright test tests/browser/catalogo.spec.ts --grep 'E04|E14' --workers=1`: 11/11.
- `npm run test:browser -- --workers=1`: 46 pasadas, 2 omitidas por flags de staging/legacy (E01, E03).
- `npm test`: 39/39.
- `npm run build`: correcto.

La cobertura E14 verifica anónimo y sesión fixture a 360/1440 px, jerarquía, retorno de `/sugerir`, foco/Tab/Escape, targets de 44 px, scroll sostenido, congelación con menú/campo y superposición modal. La prueba E10 que comprobaba ausencia de botones se acotó a `main`, porque el disparador global de Menú es legítimo fuera de la superficie editorial.

## Restricciones de integración para E15/E19

- E15 no debe implementar ni reactivar el header durante scroll ascendente intermedio. Puede asumir que el header móvil está visible únicamente al inicio.
- E15 debe seguir congelando su propia auto-ocultación cuando su Sheet esté abierto, haya foco de campo o teclado visual; E14 no expone una API de estado deliberadamente.
- E19 no debe añadir acciones beta al header ni alterar los destinos de Sugerir/Entrar. Su diálogo debe seguir usando E04, que sitúa el header detrás e inerte.
- No añadir una segunda superficie sticky que dependa de medir el header. Usar el flujo normal/offset propio de la barra Buscar.

## Rollback

Revertir los cambios de E14 en `Header.svelte`, los enlaces de retorno de autenticación y sus pruebas/documento; no requiere migraciones ni cambios de datos.
