import { loadOwnContributions, RELEASE_TYPE_OPTIONS, type Contribution } from '$lib/stores/contributionsStore';
import { fetchReleasesForCrate } from '$lib/utils/catalogoStore';
import { contributionCounts } from '$lib/domain/contributionRows';
import { PORTADAS_MOSAICO } from '$lib/stores/cratesStore';

/**
 * Aportes de la sesión (U31): la página Mis aportes (tablero N) y el tile fijado
 * del perfil (tablero F) leen lo mismo. Solo el dueño los ve (D2); RLS ya limita
 * `contributions` a los del autor. Sin migraciones ni RPC nuevas.
 */

/** Lo que se sabe del lanzamiento de un aporte aceptado que sigue publicado. */
export interface AporteLanzamiento {
  slug: string;
  cover: string | null;
}

export interface AportesPropios {
  contributions: Contribution[];
  /** Por `release_id`: solo los aceptados cuyo lanzamiento sigue publicado. */
  releases: Map<string, AporteLanzamiento>;
}

export async function loadAportesPropios(userId: string): Promise<AportesPropios> {
  const contributions = await loadOwnContributions(userId);
  const ids = contributions.filter((c) => c.status === 'approved' && c.release_id).map((c) => c.release_id as string);
  const releases = new Map<string, AporteLanzamiento>();
  if (ids.length) {
    // Sin el catálogo, las filas siguen: solo pierden la portada publicada y el enlace.
    const found = await fetchReleasesForCrate(ids, []).catch(() => []);
    for (const release of found) {
      if (release.id) releases.set(release.id, { slug: release.slug, cover: release.cover || null });
    }
  }
  return { contributions, releases };
}

/** Portada de un aporte: la publicada si existe; si no, la que trajo la fuente. */
export function portadaAporte(contribution: Contribution, releases: Map<string, AporteLanzamiento>): string | null {
  const published = contribution.release_id ? releases.get(contribution.release_id)?.cover : null;
  return published || contribution.payload?.cover_url || contribution.detected_metadata?.cover_url || null;
}

/** «Artista · Tipo», o «Sin artista» si el borrador no tiene ninguno. */
export function subtituloAporte(contribution: Contribution): string {
  const artists = (contribution.payload?.primary_artists ?? []).map((name) => name.trim()).filter(Boolean).join(', ');
  const type = RELEASE_TYPE_OPTIONS.find((option) => option.value === contribution.payload?.release_type)?.label;
  return [artists || 'Sin artista', type].filter(Boolean).join(' · ');
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Datos del tile del perfil: «N lanzamientos · N en revisión» y hasta cuatro
 * portadas de aportes aceptados, del más reciente al más antiguo.
 */
export function resumenAportes({ contributions, releases }: AportesPropios): { meta: string; covers: (string | null)[] } {
  if (!contributions.length) return { meta: 'Sin aportes todavía', covers: [] };
  const counts = contributionCounts(contributions);
  const covers = contributions
    .filter((c) => c.status === 'approved')
    .map((c) => portadaAporte(c, releases))
    .filter((cover): cover is string => Boolean(cover))
    .slice(0, PORTADAS_MOSAICO);
  return {
    meta: `${plural(counts.total, 'lanzamiento', 'lanzamientos')} · ${counts.enRevision} en revisión`,
    covers
  };
}
