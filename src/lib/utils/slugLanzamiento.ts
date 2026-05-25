import { slugify } from '$lib/utils/slugify';

function getPrimaryArtist(a: any): string {
  if (Array.isArray(a)) {
    const first = a[0];
    return typeof first === 'string' ? first : (first?.name ?? '');
  }
  return typeof a === 'string' ? a : (a?.name ?? '');
}

export function slugFromLanzamiento(l: any): string {
  const title = (l?.title ?? '').toString().trim();
  const a0 = Array.isArray(l?.artist) ? (l.artist[0] ?? '') : '';
  return slugify(`${title}-${a0}`);
}