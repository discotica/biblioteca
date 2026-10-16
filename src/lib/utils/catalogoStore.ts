// Repositorio único del catálogo. El TSV sigue siendo el valor por defecto
// hasta que VITE_CATALOG_SOURCE=canonical se active en un entorno validado.
import { supabase } from '$lib/supabase';
import {
  adaptCanonicalRelease,
  adaptLegacyRelease,
  findArtistCredit,
  releaseHasArtistSlug,
  slugifyReleaseIdentity,
  type CanonicalReleaseRow,
  type Release
} from '$lib/domain/releases';
import {
  resolveReleaseBySlug as resolveWithPolicy,
  type ReleaseResolution,
  type ReleaseResolutionGateway,
  type SlugTarget
} from '$lib/domain/releaseRepository';

export type {
  ArtistCredit,
  CreditQuality,
  Release,
  ReleaseDateValue,
  ReleaseType
} from '$lib/domain/releases';
export type { ReleaseResolution } from '$lib/domain/releaseRepository';

/** Alias de transición para consumidores anteriores a E03. */
export type Lanzamiento = Release;

const TSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vScoTP0-0jq3HAGMIzxS9NOSHsgXx4bxjlFKSPtuFq26OLJ5QCTtulXm328Bdl5lMHzpiOO5ffkpvE4/pub?gid=1229139332&single=true&output=tsv';

export type CatalogSource = 'legacy' | 'canonical';
export const catalogSource: CatalogSource =
  import.meta.env.VITE_CATALOG_SOURCE === 'canonical' ? 'canonical' : 'legacy';

function normKey(value: unknown): string {
  return String(value ?? '')
    .replace(/^﻿/, '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, '_');
}

export function parseLegacyCatalogTsv(tsvText: string): Release[] {
  const lines = String(tsvText ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    .split('\n')
    .filter((line) => line.trim());
  if (!lines.length) return [];
  const headers = lines[0].split('\t').map(normKey);
  return lines.slice(1)
    .map((line) => {
      const columns = line.split('\t');
      return Object.fromEntries(headers.map((header, index) => [header, (columns[index] ?? '').trim()]));
    })
    .map(adaptLegacyRelease)
    .filter((release) => release.title || release.primaryArtists.length);
}

let cacheData: Release[] | null = null;
let cacheAt = 0;
let inflight: Promise<Release[]> | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

async function fetchCanonicalPage(
  from: number,
  to: number,
  withCount = false
): Promise<{ releases: Release[]; total: number | null }> {
  const { data, error, count } = await supabase
    .from('catalog_releases')
    .select('*', withCount ? { count: 'exact' } : undefined)
    .order('release_date', { ascending: false, nullsFirst: false })
    .order('id', { ascending: false })
    .range(from, to);
  if (error) throw new Error(`Canonical catalog query failed: ${error.message}`);
  return { releases: ((data ?? []) as CanonicalReleaseRow[]).map(adaptCanonicalRelease), total: count ?? null };
}

async function fetchLegacyCatalog(fetchFn: typeof fetch = fetch): Promise<Release[]> {
  const response = await fetchFn(TSV_URL, { cache: 'no-store' });
  if (!response.ok) throw new Error(`TSV fetch failed: ${response.status}`);
  return parseLegacyCatalogTsv(await response.text());
}

/** Consulta paginada para consumidores que no necesitan todo el catálogo. */
export async function fetchCatalogPage(page = 1, pageSize = 48): Promise<Release[]> {
  const safePage = Math.max(1, Math.floor(page));
  const safeSize = Math.max(1, Math.min(1000, Math.floor(pageSize)));
  if (catalogSource === 'legacy') {
    const all = await fetchReleases();
    return all.slice((safePage - 1) * safeSize, safePage * safeSize);
  }
  return (await fetchCanonicalPage((safePage - 1) * safeSize, safePage * safeSize - 1)).releases;
}

export async function fetchReleases(fetchFn: typeof fetch = fetch): Promise<Release[]> {
  const now = Date.now();
  if (cacheData && now - cacheAt < CACHE_TTL_MS) return cacheData;
  if (inflight) return inflight;

  inflight = (async () => {
    if (catalogSource === 'legacy') return fetchLegacyCatalog(fetchFn);
    const pageSize = 1000;
    // The first page also returns the total, so the remaining pages go out
    // together instead of one round trip after another.
    const first = await fetchCanonicalPage(0, pageSize - 1, true);
    const releases = [...first.releases];
    if (first.releases.length < pageSize) return releases;
    if (first.total === null) {
      for (let page = 2; ; page++) {
        const batch = (await fetchCanonicalPage((page - 1) * pageSize, page * pageSize - 1)).releases;
        releases.push(...batch);
        if (batch.length < pageSize) break;
      }
      return releases;
    }
    const pages = Math.ceil(first.total / pageSize);
    const rest = await Promise.all(
      Array.from({ length: pages - 1 }, (_, index) => fetchCanonicalPage((index + 1) * pageSize, (index + 2) * pageSize - 1))
    );
    for (const batch of rest) releases.push(...batch.releases);
    return releases;
  })();

  try {
    cacheData = await inflight;
    cacheAt = Date.now();
    return cacheData;
  } finally {
    inflight = null;
  }
}

async function resolveCanonicalSlug(slug: string): Promise<SlugTarget | null> {
  const { data, error } = await supabase.rpc('resolve_release_slug', { p_slug: slug });
  if (error) throw new Error(`Canonical release resolver failed: ${error.message}`);
  const matches = Array.isArray(data) ? data : [];
  if (matches.length !== 1) return null;
  const match = matches[0] as Record<string, unknown>;
  const releaseId = String(match.release_id ?? '').trim();
  const canonicalSlug = String(match.canonical_slug ?? '').trim();
  if (!releaseId || !canonicalSlug || (match.match_kind !== 'canonical' && match.match_kind !== 'alias')) return null;
  return {
    releaseId,
    canonicalSlug,
    matchKind: match.match_kind,
    aliasKind: match.alias_kind === 'migration' || match.alias_kind === 'editorial_redirect'
      ? match.alias_kind
      : null
  };
}

async function findCanonicalById(releaseId: string): Promise<Release | null> {
  const { data, error } = await supabase
    .from('catalog_releases')
    .select('*')
    .eq('id', releaseId)
    .maybeSingle();
  if (error) throw new Error(`Canonical release lookup failed: ${error.message}`);
  return data ? adaptCanonicalRelease(data as CanonicalReleaseRow) : null;
}

const resolutionGateway: ReleaseResolutionGateway = {
  resolveCanonicalSlug,
  findCanonicalById,
  listLegacy: () => fetchLegacyCatalog()
};

/** API única usada por modal, ruta completa, crates y futuros consumidores. */
export function resolveReleaseBySlug(slug: unknown): Promise<ReleaseResolution> {
  return resolveWithPolicy(slug, resolutionGateway, { allowLegacyFallback: catalogSource === 'legacy' });
}

export async function resolveReleaseId(slug: unknown): Promise<string | null> {
  const resolution = await resolveReleaseBySlug(slug);
  return resolution.status === 'resolved' ? resolution.releaseId : null;
}

export async function findReleasesByArtistSlug(slug: string): Promise<{ artistName: string; releases: Release[] }> {
  const releases = (await fetchReleases()).filter((release) => releaseHasArtistSlug(release, slug));
  const artistName = releases.map((release) => findArtistCredit(release, slug)?.name).find(Boolean) ?? decodeURIComponent(slug);
  return { artistName, releases };
}

export async function findReleasesByLabelSlug(slug: string): Promise<{ labelName: string; releases: Release[] }> {
  const releases = (await fetchReleases()).filter((release) => slugifyReleaseIdentity(release.label) === slug);
  return { labelName: releases[0]?.label || decodeURIComponent(slug), releases };
}

/**
 * U19 (G4): URL vieja de un artista o un sello fusionado o renombrado. Devuelve el slug público
 * del valor conservado (el de su /artista/ o /sello/), o null si el slug no es un alias. Solo en
 * el catálogo canónico: el TSV no tiene diccionarios.
 */
export async function resolveEntitySlugAlias(kind: 'artist' | 'label', slug: string): Promise<string | null> {
  if (catalogSource !== 'canonical' || !slug) return null;
  if (kind === 'artist') {
    const { data, error } = await supabase.from('artist_slug_aliases').select('artist:artists(slug)').eq('slug', slug).maybeSingle();
    if (error || !data) return null;
    const target = (data as { artist?: { slug?: string } | null }).artist?.slug;
    return target && target !== slug ? target : null;
  }
  const { data, error } = await supabase.from('label_slug_aliases').select('label:labels(name)').eq('slug', slug).maybeSingle();
  if (error || !data) return null;
  const target = slugifyReleaseIdentity((data as { label?: { name?: string } | null }).label?.name);
  return target && target !== slug ? target : null;
}

/** Lee por UUID y resuelve slugs restantes con la misma política atómica. */
export async function fetchReleasesForCrate(releaseIds: string[], slugs: string[]): Promise<Release[]> {
  const ids = [...new Set(releaseIds.filter(Boolean))];
  const releases: Release[] = [];
  if (ids.length) {
    const { data, error } = await supabase.from('catalog_releases').select('*').in('id', ids);
    if (error) throw new Error(`Canonical crate release lookup failed: ${error.message}`);
    releases.push(...((data ?? []) as CanonicalReleaseRow[]).map(adaptCanonicalRelease));
  }

  const knownIds = new Set(releases.map((release) => release.id).filter(Boolean));
  for (const slug of [...new Set(slugs.filter(Boolean))]) {
    const resolution = await resolveReleaseBySlug(slug);
    if (resolution.status === 'resolved' && (!resolution.releaseId || !knownIds.has(resolution.releaseId))) {
      releases.push(resolution.release);
      if (resolution.releaseId) knownIds.add(resolution.releaseId);
    }
  }
  return releases;
}

// Compatibilidad nominal mientras consumidores externos completan su migración.
export const fetchLanzamientos = fetchReleases;
export const findLanzamientoBySlug = async (slug: string): Promise<Release | null> => {
  const resolution = await resolveReleaseBySlug(slug);
  return resolution.status === 'resolved' ? resolution.release : null;
};
export const resolveCanonicalReleaseId = resolveReleaseId;
export const fetchCanonicalCrateReleases = fetchReleasesForCrate;
