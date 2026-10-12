import type { PageLoad } from './$types';
import { error } from '@sveltejs/kit';
import { supabase } from '$lib/supabase';
import { loadProfilePage } from '$lib/services/profiles';
import type { Crate } from '$lib/stores/cratesStore';

export const load: PageLoad = async ({ params }) => {
  const result = await loadProfilePage(params.username).catch(() => null);
  if (!result) throw error(404, 'Perfil no encontrado.');

  // Solo colecciones públicas, también en el perfil propio: es lo que ven los demás.
  const { data: crates } = await supabase
    .from('crates')
    .select('*, crate_items(count)')
    .eq('owner_id', result.profile.id)
    .eq('is_public', true)
    .order('created_at', { ascending: false });

  const cratesConConteo: Crate[] = (crates ?? []).map((c: any) => ({
    ...c,
    item_count: c.crate_items?.[0]?.count ?? 0
  }));

  return {
    perfil: result.profile,
    d1: result.d1,
    crates: cratesConConteo
  };
};
