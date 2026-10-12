/**
 * Estudio (U15): la herramienta interna única, en /estudio, con una sección por
 * tarea. Aquí viven sus rutas, quién ve cada sección, las vistas rápidas del
 * catálogo en la URL y cómo se lee el informe de un lote. Sin Svelte ni
 * Supabase, para probarlo en node.
 *
 * Los permisos efectivos siguen en la base (E06, E09, E18); estas reglas solo
 * deciden qué se muestra, y son las mismas que tenían /admin/catalogo y
 * /editorial.
 */

export type StudioRole = 'admin' | 'colaborador';
export type StudioSectionId = 'catalogo' | 'propuestas' | 'reportes';

export const STUDIO_BASE = '/estudio';

export const STUDIO_SECTIONS: ReadonlyArray<{ id: StudioSectionId; label: string; href: string }> = [
  { id: 'catalogo', label: 'Catálogo', href: `${STUDIO_BASE}/catalogo` },
  { id: 'propuestas', label: 'Propuestas', href: `${STUDIO_BASE}/propuestas` },
  { id: 'reportes', label: 'Reportes', href: `${STUDIO_BASE}/reportes` }
];

export type StudioFlags = { adminCatalog: boolean; editorial: boolean };

/**
 * Secciones que ve cada rol, iguales a las rutas de antes:
 * - admin: Catálogo (consola de E07, con su interruptor) y Propuestas y
 *   Reportes (estación de E10, con el suyo);
 * - colaborador: solo Propuestas, como en /editorial;
 * - comunidad y sin sesión: ninguna.
 */
export function studioSectionsFor(role: string, flags: StudioFlags): StudioSectionId[] {
  if (role === 'admin') {
    return [
      ...(flags.adminCatalog ? (['catalogo'] as const) : []),
      ...(flags.editorial ? (['propuestas', 'reportes'] as const) : [])
    ];
  }
  if (role === 'colaborador') return flags.editorial ? ['propuestas'] : [];
  return [];
}

/** Sección de una ruta del Estudio, o null en /estudio y fuera de él. */
export function studioSectionOf(pathname: string): StudioSectionId | null {
  const match = pathname.match(/^\/estudio\/([^/]+)\/?$/);
  return (STUDIO_SECTIONS.find((section) => section.id === match?.[1])?.id ?? null) as StudioSectionId | null;
}

export function studioSectionHref(id: StudioSectionId): string {
  return `${STUDIO_BASE}/${id}`;
}

// ---------------------------------------------------------------------------
// Rutas anteriores. Las mismas reglas viven como 301 en static/.htaccess.

const LEGACY_STUDIO_ROUTES: Array<[RegExp, string]> = [
  [/^\/admin\/catalogo\/?$/, `${STUDIO_BASE}/catalogo`],
  [/^\/editorial\/?$/, `${STUDIO_BASE}/propuestas`]
];

/** Ruta del Estudio para una ruta anterior, conservando query y hash; o null. */
export function legacyStudioHref(pathname: string, search = '', hash = ''): string | null {
  for (const [pattern, target] of LEGACY_STUDIO_ROUTES) {
    if (pattern.test(pathname)) return target + search + hash;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Vistas rápidas del catálogo (D2). En la URL van en español: ?vista=…

export type StudioQuickView = 'draft' | 'incomplete' | 'missing_cover' | 'open_reports';

export const STUDIO_QUICK_VIEWS: ReadonlyArray<{ value: StudioQuickView; slug: string; label: string }> = [
  { value: 'draft', slug: 'borradores', label: 'Borradores' },
  { value: 'incomplete', slug: 'incompletos', label: 'Incompletos' },
  { value: 'missing_cover', slug: 'sin-portada', label: 'Sin portada' },
  { value: 'open_reports', slug: 'con-reportes', label: 'Con reportes' }
];

export function quickViewFromSlug(slug: string | null | undefined): StudioQuickView | null {
  return STUDIO_QUICK_VIEWS.find((view) => view.slug === slug)?.value ?? null;
}

export function quickViewSlug(view: StudioQuickView | null): string | null {
  return STUDIO_QUICK_VIEWS.find((entry) => entry.value === view)?.slug ?? null;
}

/** Catálogo, opcionalmente en una vista rápida. */
export function catalogHref(view: StudioQuickView | null = null): string {
  const slug = quickViewSlug(view);
  return `${STUDIO_BASE}/catalogo${slug ? `?vista=${slug}` : ''}`;
}

// ---------------------------------------------------------------------------
// Enlaces cruzados entre un lanzamiento, sus propuestas y sus reportes.

/** El lanzamiento abierto en el editor del Catálogo. */
export function studioReleaseHref(releaseId: string): string {
  return `${STUDIO_BASE}/catalogo?lanzamiento=${encodeURIComponent(releaseId)}`;
}

/** Reportes de un lanzamiento. */
export function studioReportsHref(releaseId?: string | null): string {
  return `${STUDIO_BASE}/reportes${releaseId ? `?lanzamiento=${encodeURIComponent(releaseId)}` : ''}`;
}

/** Propuestas que crearon o tocaron un lanzamiento. */
export function studioProposalsHref(releaseId?: string | null): string {
  return `${STUDIO_BASE}/propuestas${releaseId ? `?lanzamiento=${encodeURIComponent(releaseId)}` : ''}`;
}

/** Copia de `url` con estos parámetros puestos (string) o quitados (null). */
export function withParams(url: URL, params: Record<string, string | null>): string {
  const next = new URL(url);
  for (const [key, value] of Object.entries(params)) {
    if (value === null) next.searchParams.delete(key);
    else next.searchParams.set(key, value);
  }
  const search = next.searchParams.toString();
  return `${next.pathname}${search ? `?${search}` : ''}${next.hash}`;
}

// ---------------------------------------------------------------------------
// Lote (D2): textos del informe por elemento.

export type BatchOperation = 'publish' | 'archive';

export type BatchItemOutcome =
  | { result: 'applied' }
  | { result: 'unchanged' }
  | { result: 'rolled_back' }
  | { result: 'rejected'; error: { code: string; message: string } };

const DONE: Record<BatchOperation, string> = { publish: 'Publicado', archive: 'Archivado' };
const ALREADY: Record<BatchOperation, string> = { publish: 'Ya estaba publicado', archive: 'Ya estaba archivado' };

/** Por qué no se aplicó un elemento, en lenguaje del equipo y nunca con su código. */
export function batchRejectionText(code: string): string {
  switch (code) {
    case '40001':
      return 'Cambió desde que cargaste la lista. Recarga y vuelve a seleccionarlo.';
    case '23514':
      return 'Le faltan datos para publicarse.';
    case '22023':
      return 'Tiene datos que ya no se aceptan, como una portada o un enlace sin HTTPS. Corrígelo en el editor.';
    case 'P0002':
      return 'Este lanzamiento ya no existe.';
    case '23502':
      return 'Le falta el radar. Revísalo en el editor.';
    case '42501':
      return 'El servidor no permitió el cambio.';
    default:
      return 'El servidor lo rechazó.';
  }
}

/** Texto del resultado de un elemento del lote. */
export function batchItemText(operation: BatchOperation, item: BatchItemOutcome): string {
  if (item.result === 'applied') return DONE[operation];
  if (item.result === 'unchanged') return ALREADY[operation];
  if (item.result === 'rolled_back') return 'Sin cambios: otro elemento del lote falló';
  return batchRejectionText(item.error.code);
}

/** Resumen de una línea del lote. */
export function batchSummary(
  operation: BatchOperation,
  result: { applied: boolean; applied_count: number; unchanged_count: number; rejected_count: number }
): string {
  const verb = operation === 'publish' ? 'publicaron' : 'archivaron';
  const verbOne = operation === 'publish' ? 'publicó' : 'archivó';
  if (!result.applied) {
    const failed = result.rejected_count === 1 ? '1 lanzamiento no se pudo' : `${result.rejected_count} lanzamientos no se pudieron`;
    return `No cambió nada: ${failed} ${operation === 'publish' ? 'publicar' : 'archivar'} y el lote se deshizo completo.`;
  }
  if (!result.applied_count) {
    return `No hubo cambios: ${result.unchanged_count === 1 ? 'ya lo estaba' : 'todos ya lo estaban'}.`;
  }
  const parts = [
    result.applied_count === 1 ? `Se ${verbOne} 1 lanzamiento` : `Se ${verb} ${result.applied_count} lanzamientos`
  ];
  if (result.unchanged_count) {
    parts.push(result.unchanged_count === 1 ? '1 ya lo estaba' : `${result.unchanged_count} ya lo estaban`);
  }
  return `${parts.join('; ')}.`;
}
