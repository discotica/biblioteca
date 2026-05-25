// src/routes/+layout.ts
export const prerender = false;
export const ssr = false;

import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ url }) => {
  const path = url.pathname;

  let title = 'Discótica';

  if (path !== '/') {
    const query =
      decodeURIComponent(url.searchParams.get('texto') || '') ||
      decodeURIComponent(path.split('/').pop() || '') ||
      '';

    title = query ? `${query} — Discótica` : 'Discótica';
  }

  return { title };
};