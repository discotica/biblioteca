// src/routes/sello/[slug]/+page.ts
import type { PageLoad } from './$types';
import { findReleasesByLabelSlug } from '$lib/utils/catalogoStore';

export const load: PageLoad = async ({ params }) => {
  const slug = params.slug;

  const { labelName, releases } = await findReleasesByLabelSlug(slug);
  return { slug, nombreSello: labelName, lanzamientos: releases };
};
