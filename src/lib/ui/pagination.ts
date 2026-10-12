/**
 * Elementos de la paginación numerada (U5). Siempre devuelve el mismo número
 * de elementos para un total dado, así los botones no saltan de sitio al
 * cambiar de página.
 *
 *   paginationItems(1, 233)   → 1 2 3 4 5 … 233
 *   paginationItems(50, 233)  → 1 … 49 50 51 … 233
 *   paginationItems(233, 233) → 1 … 229 230 231 232 233
 */
export type PaginationItem = number | 'gap';

export function paginationItems(page: number, totalPages: number, siblings = 1): PaginationItem[] {
  const total = Math.max(1, Math.floor(totalPages));
  const current = Math.min(Math.max(1, Math.floor(page)), total);
  // primera + última + actual + vecinos + dos huecos
  const slots = siblings * 2 + 5;

  if (total <= slots) return Array.from({ length: total }, (_, index) => index + 1);

  const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, index) => from + index);
  const edge = siblings * 2 + 3; // páginas seguidas cuando la actual está cerca de un extremo

  if (current <= edge - siblings) return [...range(1, edge), 'gap', total];
  if (current >= total - edge + siblings + 1) return [1, 'gap', ...range(total - edge + 1, total)];
  return [1, 'gap', ...range(current - siblings, current + siblings), 'gap', total];
}

/** Página válida dentro de [1, totalPages]. */
export function clampPage(page: number, totalPages: number) {
  return Math.min(Math.max(1, Math.floor(page) || 1), Math.max(1, Math.floor(totalPages)));
}
