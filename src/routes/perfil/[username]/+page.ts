import type { PageLoad } from './$types';
import { error } from '@sveltejs/kit';
import { supabase } from '$lib/supabase';
import { loadProfilePage } from '$lib/services/profiles';
import { cargarCrates, type Crate } from '$lib/stores/cratesStore';

export const load: PageLoad = async ({ params }) => {
  const result = await loadProfilePage(params.username).catch(() => null);
  if (!result) throw error(404, 'Perfil no encontrado.');

  // Perfil propio (U31): es la casa. El dueño ve todas sus colecciones, también
  // las privadas, con el store que ya las trae (`cargarCrates`, el de la antigua
  // Mis colecciones), y la página lee de él para que crear, editar o eliminar se
  // vea al momento. La sesión se lee del almacenamiento local, sin red.
  const { data: { session } } = await supabase.auth.getSession();
  const own = session?.user.id === result.profile.id;
  if (own) {
    await cargarCrates();
    return { perfil: result.profile, d1: result.d1, own, crates: [] as Crate[] };
  }

  // Los demás, solo las públicas.
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

  return { perfil: result.profile, d1: result.d1, own, crates: cratesConConteo };
};
