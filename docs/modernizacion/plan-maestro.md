# Plan maestro de modernización de Discótica

## 1. Objetivo

Transformar Discótica de una aplicación estática que consume un TSV público a una plataforma editorial sostenible: catálogo canónico versionable, permisos explícitos, participación de comunidad moderada, crates estables, búsqueda eficiente y capacidad de evolución sin que una interfaz o un cambio puntual comprometa el sistema completo.

La modernización preserva el diseño curado y los comportamientos que funcionan. No es una reescritura estética ni una migración de proveedor por moda.

## 2. Diagnóstico inicial

### Arquitectura actual

```text
Google Sheets público --TSV--> navegador/SvelteKit --filtros locales--> interfaz
                                      |
                                      +--> URLs externas de portada y reproductores

Supabase Auth + tablas de crates <---- cliente SvelteKit
Hostinger <--------------------------- archivos estáticos generados
```

### Oportunidades y riesgos

| Área | Situación actual | Riesgo u oportunidad |
| --- | --- | --- |
| Catálogo | TSV de Google Sheets descargado por cada visitante | Sin identidad estable, sin controles de acceso, búsqueda y filtrado en cliente, duplicación de parseadores. |
| Identidad | Auth Supabase con email; perfiles y username | La experiencia requerida es login por username; debe protegerse la relación privada username/email. |
| Crates | Referencian `lanzamiento_slug` | Renombrar un artista o título puede romper colecciones y enlaces. |
| Colaboración | No existe flujo editorial versionado | Cambios concurrentes, errores y propuestas no tienen trazabilidad ni moderación. |
| Medios | URLs externas manuales | Funciona y es liviano, pero faltan procedencia, verificación y fallback controlado. |
| Operación | Sin migraciones, CI ni backups versionados | Alto riesgo de cambios irrepetibles y recuperación dependiente de una sola cuenta o proveedor. |
| Frontend | SvelteKit estático con componentes curados | Puede mantenerse; requiere una capa de datos desacoplada y pruebas de regresión. |

## 3. Arquitectura objetivo

```text
                         +------------------------+
                         | PostgreSQL / Supabase  |
                         | catálogo canónico      |
                         +-----------+------------+
                                     |
              +----------------------+----------------------+
              |                      |                      |
       API pública             área editorial          Auth + crates
       consultas paginadas     roles y revisión        perfiles/comunidad
              |                      |                      |
        frontend estático       adaptadores de URL      propuestas aisladas
              |                      |                      |
              +----------------------+----------------------+
                                     |
                        backups externos verificables
```

### Capas

1. **Dominio de datos:** PostgreSQL, constraints, IDs UUID, RLS, índices y migraciones.
2. **Servicios de confianza:** funciones de servidor para login por username, enriquecimiento de enlaces, acciones de aprobación y operaciones administrativas.
3. **Aplicación:** SvelteKit, con una única capa de repositorio/API; no conoce TSV ni SQL directo.
4. **Operación:** GitHub, CI, respaldos, monitoreo de enlaces, documentación y recuperación.

## 4. Modelo de datos propuesto

El diseño final se confirma después de auditar Supabase y la hoja, pero la dirección es la siguiente:

```text
profiles (id, username, role, ...)
releases (id, slug, title, release_date, type, label_id, status, ...)
artists (id, slug, name, ...)
labels (id, slug, name, ...)
genres (id, slug, name)
countries (id, code, name)
release_artists (release_id, artist_id, position, role)
release_genres (release_id, genre_id)
release_countries (release_id, country_id)
release_radar (release_id, experimental, denso, sintetico, bailable, rapido)
release_sources (id, release_id, provider, url, embed_type, metadata, checked_at)
release_covers (id, release_id, kind, url, storage_path, source_url, hash, checked_at)
contributions (id, author_id, status, payload, reviewed_by, reviewed_at, ...)
contribution_events (id, contribution_id, actor_id, action, before, after, created_at)
crates (id, owner_id, slug, name, description, is_public, ...)
crate_items (crate_id, release_id, note, added_at)
```

### Reglas no negociables

- `releases.id` es inmutable y todas las relaciones lo usan.
- `slug` es único, redireccionable y sustituible; los cambios de slug conservan historial.
- Un lanzamiento publicado no se destruye desde la interfaz: se archiva o se corrige con auditoría.
- Los enlaces externos se validan y se guardan como datos, sin permitir peticiones arbitrarias desde el navegador.
- Los índices siguen las consultas reales: fecha, slug, artista, sello, filtros de país/género/tipo y búsqueda de texto.

## 5. Flujo de contribuciones y enriquecimiento

1. Una persona autenticada pega un enlace de fuente.
2. El servidor valida protocolo, dominio, redirecciones y límites de petición.
3. Un adaptador identifica proveedor y obtiene una vista previa de metadatos permitidos.
4. La persona completa o corrige campos editoriales y selecciona portada detectada, URL externa o subida.
5. Se crea una contribución con estado `pending`; no se toca `releases`.
6. Un colaborador compara, edita, solicita corrección, rechaza o aprueba.
7. La aprobación ejecuta una transacción que crea/actualiza el lanzamiento y registra el evento.

La interfaz nunca debe interpretar HTML de un proveedor como HTML confiable; solo consume campos extraídos y validados.

## 6. Resiliencia, respaldo y propiedad

### Estrategia 3-2-1 inicial

1. Base activa en Supabase/PostgreSQL.
2. Exportación lógica regular (`pg_dump`/Supabase CLI) y exportación de Storage.
3. Copia cifrada fuera de Supabase y fuera de Hostinger, con al menos dos propietarios capaces de restaurarla.

Cada respaldo se prueba periódicamente restaurándolo en una base aislada. Un backup que nunca se restauró no es una garantía.

### Versionado

- Migraciones SQL en `supabase/migrations/`.
- Tipos generados de la base de datos versionados o reproducibles.
- Documentación, scripts de importación y pruebas en Git.
- Secretos solo en variables de entorno y gestores de secretos; nunca en commits.
- Flujo: rama corta -> pull request -> CI -> revisión -> `main` protegido -> despliegue.

## 7. Fases de ejecución

### Fase 1 — Fundaciones y auditoría

**Objetivo:** saber con precisión qué existe y garantizar reversibilidad.

- Inventario de Supabase: esquema, RLS, Auth, Storage, extensiones, funciones y datos.
- Inventario de Google Sheets/TSV: columnas, valores inválidos, duplicados, URLs y cobertura de metadatos.
- Respaldo inicial de base, Storage, TSV y build desplegado.
- Limpieza de gobernanza Git: documentación, `.env.example`, CI, ramas y protección de `main`.
- Clasificar los cambios locales preexistentes antes de hacer commits.

**Salida:** informe de auditoría y backup restaurable. Sin modificar producción.

### Fase 2 — Contrato de datos y migraciones

**Objetivo:** crear el núcleo canónico sin interrumpir la web actual.

- Esquema normalizado, constraints, vistas públicas y RLS.
- Migraciones versionadas y datos semilla controlados.
- IDs inmutables, mapa de slugs y reglas de deduplicación.
- Importador idempotente de TSV con reporte de errores.
- Pruebas de integridad e importación.

**Salida:** catálogo nuevo poblado en entorno de desarrollo/staging y comparable con la fuente actual.

### Fase 3 — API de catálogo y compatibilidad

**Objetivo:** permitir que el frontend consulte el catálogo nuevo sin degradar experiencia.

- Capa única de acceso a datos en SvelteKit.
- Consultas paginadas, filtros e índices en servidor/base de datos.
- Búsqueda textual y estrategia de orden/radar equivalente a la experiencia actual.
- URLs y modales compatibles; redirects de slug cuando corresponda.
- Comparación automática de resultados entre TSV y base canónica.

**Salida:** feature flag para alternar entre catálogo legado y canónico.

### Fase 4 — Identidad, perfiles y crates

**Objetivo:** hacer estables las cuentas y colecciones.

- Username único, reserva de nombres y flujo de login seguro por username.
- Revisión de Auth, confirmación de email y recuperación de contraseña.
- Migración de `crate_items.lanzamiento_slug` a `release_id` mediante tabla de equivalencias.
- Pruebas de privacidad y acceso a crates públicos/privados.

**Salida:** perfiles y crates operando contra IDs estables.

### Fase 5 — Área editorial y contribuciones

**Objetivo:** habilitar crecimiento sin perder curaduría.

- Panel para colaboradores: pendientes, edición, comparación, aprobación y rechazo.
- Formulario de comunidad con borradores y evidencia.
- Adaptadores para Bandcamp, Spotify, SoundCloud y fallback Open Graph/manual.
- Política de imágenes externas/subidas y limpieza de objetos temporales.
- Auditoría de cada acción editorial.

**Salida:** primera propuesta de comunidad moderada de punta a punta.

### Fase 6 — Calidad, observabilidad y corte

**Objetivo:** convertir la solución en operación madura.

- Pruebas de unidad, integración y flujos críticos de navegador.
- Matriz de regresión para reproductores y portadas de cada proveedor.
- Correcciones de accesibilidad y HTML reportadas por el build actual.
- Monitoreo de fallos de enlace y jobs de verificación no destructivos.
- Prueba de restauración completa, rollback y migración gradual de producción.

**Salida:** sistema legado retirado solo después de validar catálogo, rutas, crates y recuperación.

## 8. Criterios de aceptación globales

- Un cambio de título o artista no rompe crates existentes.
- Una persona de comunidad nunca publica por accidente.
- Un colaborador puede revisar una propuesta sin permisos de infraestructura.
- La interfaz usa username para iniciar sesión sin filtrar emails.
- Si Supabase, Hostinger o una cuenta quedan inaccesibles, existe una copia restaurable y al menos dos propietarios pueden utilizarla.
- Un enlace de Bandcamp/Spotify/SoundCloud que hoy funciona continúa ofreciendo una experiencia equivalente o mejor.
- El catálogo público no depende de descargar y parsear todo el TSV en cada visita.
- Cada cambio estructural está en una migración y cada despliegue pasa verificaciones.

## 9. Próxima acción

Ejecutar la auditoría de Supabase en solo lectura y registrar su resultado en `estado.md`. Con ese inventario se convierte la Fase 2 en migraciones SQL concretas, sin inventar una estructura a ciegas.
