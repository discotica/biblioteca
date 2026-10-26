// src/routes/+layout.ts
export const prerender = false;
export const ssr = false;

import type { LayoutLoad } from './$types';
import { supabase } from '$lib/supabase';
import { user } from '$lib/stores/authStore';

export const load: LayoutLoad = async ({ url }) => {
  const path = url.pathname;

  let title = 'Biblioteca Discótica';

  if (path !== '/') {
    const query =
      decodeURIComponent(url.searchParams.get('texto') || '') ||
      decodeURIComponent(path.split('/').pop() || '') ||
      '';

    title = query ? `${query} — Biblioteca Discótica` : 'Biblioteca Discótica';
  }

  // Inicializa el estado de sesión en cada navegación
  const { data: { session } } = await supabase.auth.getSession();
  user.set(session?.user ?? null);

  return { title };
};