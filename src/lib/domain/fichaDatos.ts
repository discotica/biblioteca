/**
 * Datos de la cabecera de ficha (U32, tablero G2): la columna de la derecha en
 * colecciones, artistas y sellos. Puro, sin Supabase: todo sale de los
 * lanzamientos que la página ya cargó (§2, «Datos»), nunca de una consulta nueva.
 *
 * Las listas (sellos, países, artistas, géneros) van por frecuencia, de más a
 * menos lanzamientos; los empates, por nombre. «Independiente» no cuenta como
 * sello y «LATAM» no cuenta como país.
 */
import { normalizeReleaseDate, slugifyReleaseIdentity, type ArtistCredit, type Release } from './releases.ts';
import { createSearchState, serializeSearchState } from './searchState.ts';

export type FichaItem = {
  nombre: string;
  /** Lanzamientos de la ficha en los que aparece. */
  cantidad: number;
  /** Su ficha: la de artista o sello, o el catálogo filtrado por país o género. */
  href: string;
};

export type FichaDato =
  | { tipo: 'texto'; etiqueta: string; valor: string; href?: string }
  | { tipo: 'lista'; etiqueta: string; items: FichaItem[] };

/** Lo que la ficha necesita de cada lanzamiento. */
export type FichaRelease = Pick<Release, 'releaseDate' | 'primaryArtists' | 'countries' | 'genres' | 'label'> &
  Partial<Pick<Release, 'coverUrl' | 'cover'>>;

const SELLO_EXCLUIDO = 'independiente';
const PAIS_EXCLUIDO = 'latam';

/** Clave de agrupado: sin mayúsculas, tildes ni espacios repetidos. */
function clave(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ');
}

type Entrada = { key: string; nombre: string; href: string };

/**
 * Cuenta en cuántos lanzamientos aparece cada entrada (una vez por lanzamiento,
 * aunque se repita en él) y ordena por frecuencia y luego por nombre. El nombre
 * que se muestra es el de su primera aparición.
 */
export function contarPorFrecuencia<T>(releases: readonly T[], entradas: (release: T) => Entrada[]): FichaItem[] {
  const conteo = new Map<string, FichaItem>();
  for (const release of releases) {
    const vistas = new Set<string>();
    for (const entrada of entradas(release)) {
      if (!entrada.key || vistas.has(entrada.key)) continue;
      vistas.add(entrada.key);
      const actual = conteo.get(entrada.key);
      if (actual) actual.cantidad += 1;
      else conteo.set(entrada.key, { nombre: entrada.nombre, cantidad: 1, href: entrada.href });
    }
  }
  return [...conteo.values()].sort(
    (a, b) => b.cantidad - a.cantidad || a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' })
  );
}

function catalogoFiltrado(kind: 'countries' | 'genres', value: string): string {
  const query = serializeSearchState(createSearchState({ [kind]: [value] })).toString();
  return query ? `/?${query}` : '/';
}

export const hrefArtista = (credit: Pick<ArtistCredit, 'slug' | 'name'>) =>
  `/artista/${encodeURIComponent(credit.slug || slugifyReleaseIdentity(credit.name))}`;
export const hrefSello = (label: string) => `/sello/${encodeURIComponent(slugifyReleaseIdentity(label))}`;

const sellos = (releases: readonly FichaRelease[]) =>
  contarPorFrecuencia(releases, (release) => {
    const nombre = (release.label ?? '').trim();
    if (!nombre || clave(nombre) === SELLO_EXCLUIDO) return [];
    return [{ key: slugifyReleaseIdentity(nombre), nombre, href: hrefSello(nombre) }];
  });

const paises = (releases: readonly FichaRelease[]) =>
  contarPorFrecuencia(releases, (release) =>
    (release.countries ?? [])
      .map((pais) => pais.trim())
      .filter((pais) => pais && clave(pais) !== PAIS_EXCLUIDO)
      .map((pais) => ({ key: clave(pais), nombre: pais, href: catalogoFiltrado('countries', pais) }))
  );

const generos = (releases: readonly FichaRelease[]) =>
  contarPorFrecuencia(releases, (release) =>
    (release.genres ?? [])
      .map((genero) => genero.trim())
      .filter(Boolean)
      .map((genero) => ({ key: clave(genero), nombre: genero, href: catalogoFiltrado('genres', genero) }))
  );

/** Solo los artistas principales: los colaboradores no firman el sello. */
const artistasPrincipales = (releases: readonly FichaRelease[]) =>
  contarPorFrecuencia(releases, (release) =>
    (release.primaryArtists ?? [])
      .filter((credit) => credit.name?.trim())
      .map((credit) => ({
        key: credit.slug || slugifyReleaseIdentity(credit.name),
        nombre: credit.name.trim(),
        href: hrefArtista(credit)
      }))
  );

/** «2020–2026», o un solo año si todos coinciden. Vacío sin fechas. */
export function rangoDeAnios(releases: readonly FichaRelease[]): string {
  const anios = releases
    .map((release) => Number(release.releaseDate?.year))
    .filter((anio) => Number.isInteger(anio) && anio > 0);
  if (!anios.length) return '';
  const min = Math.min(...anios);
  const max = Math.max(...anios);
  return min === max ? String(min) : `${min}–${max}`;
}

/** La portada del lanzamiento más reciente que tenga portada, o null. */
export function portadaMasReciente(releases: readonly FichaRelease[]): string | null {
  let mejor: { url: string; ts: number } | null = null;
  for (const release of releases) {
    const url = (release.coverUrl || release.cover || '').trim();
    if (!url) continue;
    const ts = release.releaseDate?.timestamp || normalizeReleaseDate(release.releaseDate?.iso).timestamp || 0;
    if (!mejor || ts > mejor.ts) mejor = { url, ts };
  }
  return mejor?.url ?? null;
}

/** Una lista vacía no ocupa fila; un país solo se dice en singular. */
function lista(etiqueta: string, items: FichaItem[]): FichaDato[] {
  return items.length ? [{ tipo: 'lista', etiqueta, items }] : [];
}
function texto(etiqueta: string, valor: string, href?: string): FichaDato[] {
  return valor ? [{ tipo: 'texto', etiqueta, valor, ...(href ? { href } : {}) }] : [];
}
const lanzamientos = (n: number) => texto('Lanzamientos', String(n));
const etiquetaPaises = (items: FichaItem[]) => (items.length === 1 ? 'País' : 'Países');

/** Artista: País, Años, Sellos, Géneros y Lanzamientos. */
export function datosArtista(releases: readonly FichaRelease[]): FichaDato[] {
  const listaPaises = paises(releases);
  return [
    ...lista(etiquetaPaises(listaPaises), listaPaises),
    ...texto('Años', rangoDeAnios(releases)),
    ...lista('Sellos', sellos(releases)),
    ...lista('Géneros', generos(releases)),
    ...lanzamientos(releases.length)
  ];
}

/** Sello: Países, Años, Artistas (principales), Géneros y Lanzamientos. */
export function datosSello(releases: readonly FichaRelease[]): FichaDato[] {
  const listaPaises = paises(releases);
  return [
    ...lista(etiquetaPaises(listaPaises), listaPaises),
    ...texto('Años', rangoDeAnios(releases)),
    ...lista('Artistas', artistasPrincipales(releases)),
    ...lista('Géneros', generos(releases)),
    ...lanzamientos(releases.length)
  ];
}

/** Colección: Curada por, Lanzamientos y Visibilidad. */
export function datosColeccion(input: { usuario: string; lanzamientos: number; publica: boolean }): FichaDato[] {
  return [
    ...texto('Curada por', `@${input.usuario}`, `/perfil/${encodeURIComponent(input.usuario)}`),
    ...lanzamientos(input.lanzamientos),
    ...texto('Visibilidad', input.publica ? 'Pública' : 'Privada')
  ];
}
