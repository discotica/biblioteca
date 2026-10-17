import type { PageLoad } from './$types';
import { error } from '@sveltejs/kit';
import { supabase } from '$lib/supabase';
import { obtenerItemsOrdenados } from '$lib/stores/cratesStore';

export const load: PageLoad = async ({ params, url }) => {
  const crateSlug = params.slug;
  const usernameParam = url.searchParams.get('usuario');

  // Resolución del owner:
  // - Si ?usuario=__self__, usa el usuario autenticado actual
  // - Si ?usuario=xxx, usa ese username (solo colecciones públicas)
  // - Sin parámetro: intenta con sesión activa
  const { data: { session } } = await supabase.auth.getSession();

  let ownerId: string | null = null;

  if (usernameParam === '__self__') {
    if (!session) throw error(401, 'Debes iniciar sesión para ver esta colección.');
    ownerId = session.user.id;
  } else if (usernameParam) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', usernameParam)
      .single();
    if (!profile) throw error(404, 'Usuario no encontrado.');
    ownerId = profile.id;
  } else if (session) {
    ownerId = session.user.id;
  } else {
    throw error(400, 'Falta el parámetro ?usuario=');
  }

  const { data: crate } = await supabase
    .from('crates')
    .select('*, profiles(username, display_name)')
    .eq('slug', crateSlug)
    .eq('owner_id', ownerId)
    .single();

  if (!crate) throw error(404, 'Colección no encontrada.');

  // Si es privado, solo el dueño puede verlo
  if (!crate.is_public && session?.user.id !== ownerId) {
    throw error(403, 'Esta colección es privada.');
  }

  // Orden manual (D1). Sin la migración en el entorno, por fecha de alta y sin
  // reordenar. Un fallo de lectura deja la colección vacía, como antes.
  const { items, ordenManual } = await obtenerItemsOrdenados(crate.id).catch(() => ({ items: [], ordenManual: false }));

  return {
    crate,
    items,
    ordenManual,
    esDueno: session?.user.id === ownerId
  };
};
