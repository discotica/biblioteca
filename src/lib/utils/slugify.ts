export function slugify(text: string) {
  return (text ?? '')
    .toString()
    .trim()
    .replace(/\u00A0/g, ' ')                  // NBSP -> space
    .replace(/[\u2010-\u2015\u2212]/g, '-')   // unicode dashes -> hyphen
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')          // remove diacritics
    .replace(/[^a-z0-9]+/g, '-')              // collapse to hyphens
    .replace(/^-+|-+$/g, '');                 // trim hyphens
}
