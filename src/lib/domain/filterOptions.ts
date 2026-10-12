import { normalizeReleaseDate } from './releases.ts';

// Opciones del formulario de filtros y de las sugerencias del buscador
// (U10b). Funciones puras sobre el catálogo cargado: las comparten Filtros
// (País, Género, Tipo y Año) y SearchCombobox (País y Género).

type FilterRelease = {
  country?: string[] | null;
  genre?: string[] | null;
  type?: string | null;
  release_date?: string | null;
};

function normalizeCountry(value: unknown) {
  return (value ?? '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ');
}

// El catálogo es de Latinoamérica y el Caribe: otros países no se ofrecen.
const LATAM_CARIBBEAN = new Set([
  'argentina','ar','bolivia','bo','brasil','brazil','br','chile','cl','colombia','co','ecuador','ec','paraguay','py','peru','pe','uruguay','uy','venezuela','ve','guyana','gy','suriname','sr','guayana francesa','guayana frances','french guiana','guyane francaise','gf',
  'mexico','mejico','mx','guatemala','gt','belize','bz','honduras','hn','el salvador','sv','nicaragua','ni','costa rica','cr','panama','pa',
  'cuba','cu','republica dominicana','rep. dominicana','dominican republic','do','haiti','ht','puerto rico','pr','jamaica','jm','trinidad y tobago','trinidad and tobago','tt','bahamas','bs','barbados','bb','antigua y barbuda','antigua and barbuda','ag','saint kitts and nevis','san cristobal y nieves','kn','saint lucia','santa lucia','lc','saint vincent and the grenadines','san vicente y las granadinas','vc','grenada','granada','gd','dominica','dm','aruba','aw','curazao','curacao','cw','bonaire','bq','cayman islands','islas caiman','ky','virgin islands','islas virgenes','vi','vg','guadalupe','guadeloupe','gp','martinica','martinique','mq'
].map(normalizeCountry));

export function uniqueCountries(releases: FilterRelease[] | null | undefined): string[] {
  return Array.from(
    new Set(
      (releases ?? [])
        .flatMap((release) => release.country ?? [])
        .filter(Boolean)
        .filter((country) => LATAM_CARIBBEAN.has(normalizeCountry(country)))
    )
  ).sort((a, b) => a.localeCompare(b, 'es'));
}

export function uniqueGenres(releases: FilterRelease[] | null | undefined): string[] {
  return Array.from(
    new Set((releases ?? []).flatMap((release) => release.genre ?? []).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
}

export function uniqueTypes(releases: FilterRelease[] | null | undefined): string[] {
  return Array.from(
    new Set((releases ?? []).map((release) => release.type).filter((type): type is string => Boolean(type)))
  ).sort();
}

export function uniqueYears(releases: FilterRelease[] | null | undefined): string[] {
  return Array.from(
    new Set((releases ?? [])
      .map((release) => normalizeReleaseDate(release.release_date).year)
      .filter(Boolean)
    )
  ).sort((a, b) => Number(b) - Number(a));
}
