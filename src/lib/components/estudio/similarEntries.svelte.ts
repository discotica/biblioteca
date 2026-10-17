import { compareNames, similarSearchTerms } from '$lib/domain/suggestFlow';
import { similarCatalogEntries, type DictionaryEntry } from '$lib/services/adminCatalog';

/**
 * Aviso de nombres parecidos del editor (U19): un artista o sello nuevo se crea al guardar o al
 * aceptar, así que antes se enseñan los existentes que se escriben igual o casi igual, para usar
 * ese en lugar de crear un duplicado. Misma regla que Sugerir (`compareNames`).
 */
export class SimilarEntries {
  similar = $state<Record<string, DictionaryEntry[]>>({});
  #asked = new Set<string>();
  #kind: 'artists' | 'labels';

  constructor(kind: 'artists' | 'labels') {
    this.#kind = kind;
  }

  /** Busca parecidos de `name` una sola vez; el resultado aparece en `of(name)`. */
  check(name: string) {
    const key = name.trim();
    if (!key || this.#asked.has(key)) return;
    this.#asked.add(key);
    similarCatalogEntries(this.#kind, similarSearchTerms(key))
      .then((candidates) => {
        const { exact, similar } = compareNames(key, candidates.map((entry) => entry.name));
        return (exact ? [exact] : similar).map((found) => candidates.find((entry) => entry.name === found)!).filter(Boolean);
      })
      .catch(() => [] as DictionaryEntry[])
      .then((found) => (this.similar = { ...this.similar, [key]: found }));
  }

  of(name: string): DictionaryEntry[] {
    return this.similar[name.trim()] ?? [];
  }
}
