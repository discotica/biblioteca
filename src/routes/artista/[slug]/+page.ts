// src/routes/artista/[slug]/+page.ts
import type { PageLoad } from './$types';
import { findReleasesByArtistSlug } from '$lib/utils/catalogoStore';

export const load: PageLoad = async ({ params }) => {
  const slug = params.slug;

  const { artistName, releases } = await findReleasesByArtistSlug(slug);
  return { slug, nombreArtista: artistName, lanzamientos: releases };
};
