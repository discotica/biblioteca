/**
 * Búsqueda del combobox con chips (U6), sin DOM. Tiene prueba propia.
 */
export type ComboboxOption = {
  value: string;
  label: string;
  /** Otros textos que también encuentran la opción (sinónimos, grafías). */
  keywords?: string[];
  /** Texto secundario en la lista (p. ej. "12 lanzamientos"). */
  hint?: string;
  disabled?: boolean;
};

/** Minúsculas, sin tildes ni diacríticos y con espacios simples. */
export function normalizeSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function rank(option: ComboboxOption, query: string): number {
  let best = -1;
  for (const text of [option.label, ...(option.keywords ?? [])]) {
    const candidate = normalizeSearch(text);
    if (candidate === query) return 0;
    if (candidate.startsWith(query)) best = best < 0 ? 1 : Math.min(best, 1);
    else if (candidate.split(' ').some((word) => word.startsWith(query))) best = best < 0 ? 2 : Math.min(best, 2);
    else if (candidate.includes(query)) best = best < 0 ? 3 : Math.min(best, 3);
  }
  return best;
}

/**
 * Opciones que coinciden con `query`, en este orden: igual, empieza por,
 * alguna palabra empieza por, contiene. Dentro de cada grupo se respeta el
 * orden recibido. Sin texto se devuelven todas.
 */
export function filterOptions(options: readonly ComboboxOption[], query: string, limit = Number.POSITIVE_INFINITY): ComboboxOption[] {
  const needle = normalizeSearch(query);
  if (!needle) return options.slice(0, limit);
  return options
    .map((option, index) => ({ option, index, score: rank(option, needle) }))
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .slice(0, limit)
    .map((entry) => entry.option);
}

/**
 * true si se puede ofrecer "Añadir «query»": hay texto y ninguna opción ni
 * valor elegido se llama igual (sin distinguir mayúsculas ni tildes).
 */
export function canCreate(options: readonly ComboboxOption[], selectedLabels: readonly string[], query: string): boolean {
  const needle = normalizeSearch(query);
  if (!needle) return false;
  const taken = (text: string) => normalizeSearch(text) === needle;
  return !options.some((option) => taken(option.label)) && !selectedLabels.some(taken);
}
