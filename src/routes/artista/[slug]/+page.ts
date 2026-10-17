// src/routes/artista/[slug]/+page.ts
import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { findReleasesByArtistSlug, resolveEntitySlugAlias } from '$lib/utils/catalogoStore';

export const load: PageLoad = async ({ params, url }) => {
  const slug = params.slug;

  const { artistName, releases } = await findReleasesByArtistSlug(slug);
  // U19 (G4): la URL de un artista fusionado o renombrado lleva a la del conservado.
  if (!releases.length) {
    const target = await resolveEntitySlugAlias('artist', slug);
    if (target) throw redirect(301, `/artista/${encodeURIComponent(target)}${url.search}`);
  }
  return { slug, nombreArtista: artistName, lanzamientos: releases };
};
