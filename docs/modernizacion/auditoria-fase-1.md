# Auditoría de Fase 1

Actualizado: 2026-08-30.

Este informe registra hechos observados sin modificar servicios remotos. Es una base para diseñar la Fase 2, no un contrato de esquema.

## Repositorio y gobernanza

- Rama actual: `main`; remoto: `github.com/discotica/biblioteca`.
- El árbol de trabajo ya contenía cambios sin confirmar en autenticación, crates, catálogo, interfaz y PWA. Se mantienen separados de este trabajo; no se han preparado ni confirmado cambios ajenos.
- El despliegue actual se construye en GitHub Actions y se publica en la rama `dist`. Se añadió una verificación independiente para pull requests y `main`: instalación reproducible, auditoría de catálogo y build.
- Se añadió `.env.example` con las variables públicas del cliente. El archivo `.env` sigue ignorado y sus valores no se registran en este informe.

## Catálogo local de referencia

Fuente auditada: `static/lanzamientos.json`.

| Métrica | Resultado |
| --- | ---: |
| Lanzamientos | 622 |
| SHA-256 | `d9ffdb6d9a4f637dd3676e4445375dc0ae9fd647d4653cb2f7b30818edc6422f` |
| `buy_link` vacío | 1 |
| `buy_link` con URL inválida | 6 |
| `cover` vacío | 3 |
| `cover` con URL inválida | 3 |
| Radares fuera de 0–5 entero | 0 |
| Posibles duplicados por artista + título + fecha | 2 |

Los campos `review` están vacíos en 619 registros; esto parece una decisión editorial actual y no se corrige durante la auditoría. Las portadas se concentran en `f4.bcbits.com` (583). La validez medida es sintáctica: esta fase no verificó disponibilidad HTTP de proveedores.

Para repetir la auditoría:

```sh
npm run audit:catalog
```

El JSON de referencia dentro de `discotica-sync/` no coincide byte a byte con el archivo servido. Se descargó además un snapshot del TSV publicado en `../discotica-backups/2026-08-30/catalogo-publicado.tsv` (671 KB; SHA-256 `22ab9cfce3495ec034d6b32584c087c72b4e15f892cd1bb9aaa70d762818b0ea`). Para la Fase 2, `static/lanzamientos.json` y este snapshot se usarán como referencias de comparación.

## Supabase y respaldos

La auditoría de solo lectura se completó mediante el Dashboard y consultas de catálogo. El proyecto tiene las siguientes tablas de aplicación en `public`:

| Tabla | Columnas relevantes | Relaciones y reglas |
| --- | --- | --- |
| `profiles` | `id`, `username`, `display_name`, `bio`, `newsletter_opt_in`, fechas | PK en `id`; `username` único; FK a `auth.users(id)` con borrado en cascada. |
| `crates` | `id`, `owner_id`, `name`, `description`, `slug`, `is_public`, fechas | PK en `id`; único `(owner_id, slug)`; FK a `profiles(id)` con borrado en cascada. |
| `crate_items` | `id`, `crate_id`, `lanzamiento_slug`, `note`, `added_at` | PK en `id`; único `(crate_id, lanzamiento_slug)`; FK a `crates(id)` con borrado en cascada. |

Las tres tablas tienen RLS habilitado. `crates` y `crate_items` solo permiten escritura a su propietario y lectura de crates públicos o propios. `profiles` permite lectura pública de los campos actuales y actualización solo de la propia fila. Dado que `profiles` no contiene email, esa política no expone el identificador de Auth; debe reevaluarse si se añaden campos privados.

Auth tiene registro habilitado, confirmación de email activa y solo el proveedor Email habilitado. No hay buckets de Storage ni objetos que exportar. El trigger `auth.users.on_auth_user_created` invoca `public.handle_new_user`, que crea un perfil con los metadatos de registro. La función es `SECURITY DEFINER`: en Fase 4 se revisarán explícitamente sus permisos de ejecución y validaciones; no se modifica durante esta fase.

Se detectaron las extensiones `pg_stat_statements`, `pgcrypto`, `supabase_vault` y `uuid-ossp`. No hay catálogo de lanzamientos en Supabase. Las vistas y tablas de los esquemas `auth`, `storage`, `realtime` y `vault` son administradas por Supabase y no forman parte del esquema de aplicación.

## Respaldo inicial

Se generó un respaldo lógico de la base en `../discotica-backups/2026-08-30/`:

| Archivo | Tamaño | SHA-256 |
| --- | ---: | --- |
| `roles.sql` | 360 B | `a1c56b013dd585348059d79aaefeea3433b17442acf5a8af321b366d84187840` |
| `schema.sql` | 8.0 KB | `8f2034d3b78698c36ec3491f1c5cbe273914247ea43dca1264f44c66671a1adf` |
| `data.sql` | 11 KB | `d028fa548b3e5f9af12a4b22f4cb5ad892565a1b279588f68ae52e3803aa6389` |
| `catalogo-publicado.tsv` | 671 KB | `22ab9cfce3495ec034d6b32584c087c72b4e15f892cd1bb9aaa70d762818b0ea` |

`SHA256SUMS` contiene las verificaciones. El dump de roles se ajustó localmente para comentar una instrucción incompatible con el rol administrado `supabase_admin`; no se cambió ningún rol remoto.

Por decisión de alcance, no se repetirá la prueba de restauración en un proyecto nuevo: las tres tablas de aplicación no contienen datos operativos útiles y no hay Storage. La prueba de restauración completa queda como requisito antes de una migración irreversible sobre producción o cuando Supabase pase a contener datos de catálogo, usuarios o medios relevantes. El respaldo local debe copiarse a almacenamiento cifrado fuera de Supabase, Hostinger y Git antes de ese hito.

El build desplegado en Hostinger y la copia externa cifrada siguen siendo tareas operativas, no bloqueantes para diseñar y probar la Fase 2 en local/staging.
