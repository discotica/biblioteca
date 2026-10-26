import { legacyReleaseSlug } from '$lib/domain/releases';

export function slugFromLanzamiento(l: any): string {
  const canonicalSlug = (l?.slug ?? '').toString().trim();
  if (canonicalSlug) return canonicalSlug;
  const title = (l?.title ?? '').toString().trim();
  const a0 = Array.isArray(l?.artist) ? (l.artist[0] ?? '') : '';
  return legacyReleaseSlug(title, a0);
}
