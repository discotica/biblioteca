// src/routes/sello/[slug]/+page.ts
import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { findReleasesByLabelSlug, resolveEntitySlugAlias } from '$lib/utils/catalogoStore';

export const load: PageLoad = async ({ params, url }) => {
  const slug = params.slug;

  const { labelName, releases } = await findReleasesByLabelSlug(slug);
  // U19 (G4): la URL de un sello fusionado o renombrado lleva a la del conservado.
  if (!releases.length) {
    const target = await resolveEntitySlugAlias('label', slug);
    if (target) throw redirect(301, `/sello/${encodeURIComponent(target)}${url.search}`);
  }
  return { slug, nombreSello: labelName, lanzamientos: releases };
};
