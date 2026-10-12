import type { Release } from './releases.ts';

export type SlugMatchKind = 'canonical' | 'alias' | 'legacy';
export type AliasKind = 'migration' | 'editorial_redirect' | null;

export interface SlugTarget {
  releaseId: string;
  canonicalSlug: string;
  matchKind: Exclude<SlugMatchKind, 'legacy'>;
  aliasKind: AliasKind;
}

export type ReleaseResolution =
  | {
      status: 'resolved';
      requestedSlug: string;
      releaseId: string | null;
      canonicalSlug: string;
      matchKind: SlugMatchKind;
      aliasKind: AliasKind;
      release: Release;
    }
  | {
      status: 'unresolved';
      requestedSlug: string;
      reason: 'empty' | 'not-found-or-ambiguous';
    };

export interface ReleaseResolutionGateway {
  resolveCanonicalSlug(slug: string): Promise<SlugTarget | null>;
  findCanonicalById(releaseId: string): Promise<Release | null>;
  listLegacy(): Promise<Release[]>;
}

export function normalizeRequestedSlug(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  try {
    return decodeURIComponent(raw).trim();
  } catch {
    return '';
  }
}

/**
 * Política única: el RPC de E02 decide canonical/alias/ambiguo de forma atómica.
 * Solo ante indisponibilidad técnica del RPC se permite el rollback TSV, y aun
 * así únicamente si el slug legado identifica exactamente una fila.
 */
export async function resolveReleaseBySlug(
  value: unknown,
  gateway: ReleaseResolutionGateway,
  options: { allowLegacyFallback?: boolean } = {}
): Promise<ReleaseResolution> {
  const requestedSlug = normalizeRequestedSlug(value);
  if (!requestedSlug) return { status: 'unresolved', requestedSlug, reason: 'empty' };

  try {
    const target = await gateway.resolveCanonicalSlug(requestedSlug);
    if (!target) return { status: 'unresolved', requestedSlug, reason: 'not-found-or-ambiguous' };
    const release = await gateway.findCanonicalById(target.releaseId);
    if (!release) return { status: 'unresolved', requestedSlug, reason: 'not-found-or-ambiguous' };
    return {
      status: 'resolved',
      requestedSlug,
      releaseId: target.releaseId,
      canonicalSlug: target.canonicalSlug,
      matchKind: target.matchKind,
      aliasKind: target.aliasKind,
      release
    };
  } catch (error) {
    if (!options.allowLegacyFallback) throw error;
    const matches = (await gateway.listLegacy()).filter((release) => release.legacySlug === requestedSlug);
    if (matches.length !== 1) return { status: 'unresolved', requestedSlug, reason: 'not-found-or-ambiguous' };
    const release = matches[0];
    return {
      status: 'resolved',
      requestedSlug,
      releaseId: release.id,
      canonicalSlug: release.slug,
      matchKind: 'legacy',
      aliasKind: null,
      release
    };
  }
}
