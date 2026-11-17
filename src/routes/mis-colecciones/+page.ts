import type { PageLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { supabase } from '$lib/supabase';

// U31: Mis colecciones se fue al perfil (+page.svelte redirige). Sin sesión no
// hay perfil propio: se pasa por Entrar y se vuelve aquí, que ya redirige.
export const load: PageLoad = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw redirect(302, '/auth/login?redirect=/mis-colecciones');
  }
  return {};
};
