import { writable, get } from 'svelte/store';
import { supabase } from '$lib/supabase';
import { slugify } from '$lib/utils/slugify';
import { fetchReleasesForCrate, resolveReleaseBySlug, type Release } from '$lib/utils/catalogoStore';

export interface Crate {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  slug: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  item_count?: number;
}

export interface CrateItem {
  id: string;
  crate_id: string;
  release_id: string | null;
  lanzamiento_slug: string;
  note: string | null;
  added_at: string;
  /** Orden manual (D1): 0..n-1 tras reordenar; las altas van al final. */
  position: number;
}

export const crates = writable<Crate[]>([]);
export const cratesLoaded = writable(false);

export async function cargarCrates() {
  // La política de lectura permite ver crates públicos para las páginas de
  // perfil. Este store, en cambio, alimenta "Mis crates" y el menú donde se
  // escribe, así que solo puede contener crates del usuario actual.
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    crates.set([]);
    cratesLoaded.set(true);
    return;
  }

  const { data, error } = await supabase
    .from('crates')
    .select('*, crate_items(count)')
    .eq('owner_id', authData.user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error cargando crates:', error.message);
    return;
  }

  const conConteo = (data ?? []).map((c: any) => ({
    ...c,
    item_count: c.crate_items?.[0]?.count ?? 0
  }));

  crates.set(conConteo);
  cratesLoaded.set(true);
}

function generarSlugCrate(nombre: string, existentes: Crate[]): string {
  // Reserva si el nombre no deja slug ("!!!"): se ve en la URL, así que en español (U3).
  const base = slugify(nombre).slice(0, 60) || 'coleccion';
  let slug = base;
  let i = 2;
  while (existentes.some((c) => c.slug === slug)) {
    slug = `${base}-${i++}`;
  }
  return slug;
}

export async function crearCrate(
  nombre: string,
  descripcion: string,
  esPublico: boolean
): Promise<Crate | null> {
  const existentes = get(crates);
  const slug = generarSlugCrate(nombre, existentes);
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    console.error('No hay una sesión válida para crear el crate.');
    return null;
  }

  const { data, error } = await supabase
    .from('crates')
    .insert({
      owner_id: authData.user.id,
      name: nombre,
      description: descripcion || null,
      slug,
      is_public: esPublico
    })
    .select()
    .single();

  if (error) {
    console.error('Error creando crate:', error.message);
    return null;
  }

  const nuevo = { ...data, item_count: 0 };
  crates.update((prev) => [nuevo, ...prev]);
  return nuevo;
}

export async function eliminarCrate(id: string) {
  const { error } = await supabase.from('crates').delete().eq('id', id);
  if (error) {
    console.error('Error eliminando crate:', error.message);
    return false;
  }
  crates.update((prev) => prev.filter((c) => c.id !== id));
  return true;
}

export async function actualizarCrate(
  id: string,
  cambios: { name?: string; description?: string | null; is_public?: boolean }
) {
  const { data, error } = await supabase
    .from('crates')
    .update({ ...cambios, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error actualizando crate:', error.message);
    return false;
  }

  crates.update((prev) =>
    prev.map((c) => (c.id === id ? { ...c, ...data } : c))
  );
  return true;
}

export async function agregarItem(
  crateId: string,
  lanzamientoSlug: string,
  releaseId?: string,
  note?: string
) {
  const item = {
    crate_id: crateId,
    lanzamiento_slug: lanzamientoSlug,
    ...(releaseId ? { release_id: releaseId } : {}),
    note: note ?? null
  };
  const { error } = await supabase.from('crate_items').insert(item);

  if (error) {
    if (error.code === '23505') return { ok: false, yaExiste: true };
    console.error('Error agregando item:', error.message);
    return { ok: false, yaExiste: false };
  }

  crates.update((prev) =>
    prev.map((c) =>
      c.id === crateId ? { ...c, item_count: (c.item_count ?? 0) + 1 } : c
    )
  );
  return { ok: true, yaExiste: false };
}

export async function quitarItem(crateId: string, itemId: string) {
  const { error } = await supabase
    .from('crate_items')
    .delete()
    .eq('crate_id', crateId)
    .eq('id', itemId);

  if (error) {
    console.error('Error quitando item:', error.message);
    return false;
  }

  crates.update((prev) =>
    prev.map((c) =>
      c.id === crateId ? { ...c, item_count: Math.max(0, (c.item_count ?? 1) - 1) } : c
    )
  );
  return true;
}

export async function quitarItemPorLanzamiento(
  crateId: string,
  lanzamientoSlug: string,
  releaseId?: string
) {
  const { error } = await supabase
    .from('crate_items')
    .delete()
    .eq('crate_id', crateId)
    .eq(releaseId ? 'release_id' : 'lanzamiento_slug', releaseId ?? lanzamientoSlug);

  if (error) {
    console.error('Error quitando item:', error.message);
    return false;
  }

  crates.update((prev) =>
    prev.map((c) =>
      c.id === crateId ? { ...c, item_count: Math.max(0, (c.item_count ?? 1) - 1) } : c
    )
  );
  return true;
}

export async function obtenerItemsDeCrate(crateId: string): Promise<CrateItem[]> {
  const { data, error } = await supabase
    .from('crate_items')
    .select('*')
    .eq('crate_id', crateId)
    .order('added_at', { ascending: true });

  if (error) {
    console.error('Error cargando items del crate:', error.message);
    return [];
  }
  return data ?? [];
}

export async function lanzamientosEnCrate(
  crateId: string,
  usarReleaseId: boolean
): Promise<Set<string>> {
  const items = await obtenerItemsDeCrate(crateId);
  return new Set(items
    .map((item) => usarReleaseId ? item.release_id : item.lanzamiento_slug)
    .filter((key): key is string => Boolean(key)));
}

/**
 * Ítems en el orden manual de la colección (D1). Requiere la migración
 * 20261006131054 en el entorno; hasta entonces las vistas siguen usando
 * obtenerItemsDeCrate, que ordena por fecha de alta (mismo orden tras el backfill).
 */
export async function obtenerItemsEnOrdenManual(crateId: string): Promise<CrateItem[]> {
  const { data, error } = await supabase
    .from('crate_items')
    .select('*')
    .eq('crate_id', crateId)
    .order('position', { ascending: true });

  if (error) {
    console.error('Error cargando items del crate:', error.message);
    return [];
  }
  return data ?? [];
}

export type ResultadoReordenar =
  | { ok: true; items: CrateItem[] }
  /** Alguien añadió o quitó ítems desde la última lectura: recargar y reintentar. */
  | { ok: false; motivo: 'coleccion-cambio' }
  | { ok: false; motivo: 'sin-permiso' | 'error' };

/**
 * Guarda el orden manual. `itemIds` es la colección completa en el nuevo orden
 * (todos sus ítems, sin repetir). Es atómico y solo lo puede hacer el dueño.
 */
export async function reordenarItems(crateId: string, itemIds: string[]): Promise<ResultadoReordenar> {
  const { data, error } = await supabase.rpc('reorder_crate_items', {
    p_crate_id: crateId,
    p_item_ids: itemIds
  });

  if (error) {
    if (error.code === '40001') return { ok: false, motivo: 'coleccion-cambio' };
    if (error.code === '42501') return { ok: false, motivo: 'sin-permiso' };
    console.error('Error reordenando items:', error.message);
    return { ok: false, motivo: 'error' };
  }
  return { ok: true, items: (data ?? []) as CrateItem[] };
}

/* ---------- Vistas de colecciones (U14) ---------- */

/** Columna `position` ausente: la migración de D1 no está aplicada en este entorno. */
const SIN_ORDEN_MANUAL = '42703';

/**
 * Ítems de una colección para pintarla: en orden manual si el entorno tiene D1;
 * si no, por fecha de alta (el mismo orden que deja el backfill) y sin poder
 * reordenar. Lanza si la lectura falla por otra causa.
 */
export async function obtenerItemsOrdenados(
  crateId: string
): Promise<{ items: CrateItem[]; ordenManual: boolean }> {
  const manual = await supabase
    .from('crate_items')
    .select('*')
    .eq('crate_id', crateId)
    .order('position', { ascending: true });
  if (!manual.error) return { items: (manual.data ?? []) as CrateItem[], ordenManual: true };
  if (manual.error.code !== SIN_ORDEN_MANUAL) throw new Error(manual.error.message);

  const porAlta = await supabase
    .from('crate_items')
    .select('*')
    .eq('crate_id', crateId)
    .order('added_at', { ascending: true });
  if (porAlta.error) throw new Error(porAlta.error.message);
  return { items: (porAlta.data ?? []) as CrateItem[], ordenManual: false };
}

/** Portadas del mosaico: las 4 primeras de la colección, en su orden. */
export const PORTADAS_MOSAICO = 4;

/**
 * Portadas del mosaico de cada colección (Mis colecciones y perfil). Lee los
 * ítems de todas a la vez y las portadas del catálogo por ID. Un ítem legado sin
 * `release_id`, o un lanzamiento que ya no se publica, deja la casilla vacía.
 * Las colecciones ajenas privadas no devuelven ítems (RLS), así que no se filtra nada.
 */
export async function portadasDeColecciones(crateIds: string[]): Promise<Map<string, (string | null)[]>> {
  const resultado = new Map<string, (string | null)[]>();
  if (!crateIds.length) return resultado;

  type Fila = { crate_id: string; release_id: string | null };
  const leer = (orden: 'position' | 'added_at') =>
    supabase
      .from('crate_items')
      .select('crate_id, release_id')
      .in('crate_id', crateIds)
      .order(orden, { ascending: true });
  let respuesta = await leer('position');
  if (respuesta.error?.code === SIN_ORDEN_MANUAL) respuesta = await leer('added_at');
  if (respuesta.error) throw new Error(respuesta.error.message);

  const primeros = new Map<string, (string | null)[]>();
  for (const fila of (respuesta.data ?? []) as Fila[]) {
    const lista = primeros.get(fila.crate_id) ?? [];
    if (lista.length < PORTADAS_MOSAICO) lista.push(fila.release_id);
    primeros.set(fila.crate_id, lista);
  }

  const ids = [...new Set([...primeros.values()].flat().filter((id): id is string => Boolean(id)))];
  const portadaPorId = new Map<string, string>();
  if (ids.length) {
    const { data, error } = await supabase.from('catalog_releases').select('id, cover').in('id', ids);
    if (error) throw new Error(error.message);
    for (const fila of (data ?? []) as { id: string; cover: string | null }[]) {
      if (fila.cover) portadaPorId.set(fila.id, fila.cover);
    }
  }
  for (const [crateId, lista] of primeros) {
    resultado.set(crateId, lista.map((id) => (id ? portadaPorId.get(id) ?? null : null)));
  }
  return resultado;
}

/**
 * Lanzamiento de cada ítem, por ID de ítem. Carga solo lo que la colección
 * contiene (por UUID del lanzamiento), nunca el catálogo completo. Los ítems
 * legados sin `release_id` se resuelven por su slug, uno a uno.
 */
export async function lanzamientosDeItems(items: CrateItem[]): Promise<Map<string, Release>> {
  const resultado = new Map<string, Release>();
  const ids = items.map((item) => item.release_id).filter((id): id is string => Boolean(id));
  const porId = new Map<string, Release>();
  if (ids.length) {
    for (const release of await fetchReleasesForCrate(ids, [])) {
      if (release.id) porId.set(release.id, release);
    }
  }
  await Promise.all(
    items.map(async (item) => {
      if (item.release_id) {
        const release = porId.get(item.release_id);
        if (release) resultado.set(item.id, release);
        return;
      }
      const resolucion = await resolveReleaseBySlug(item.lanzamiento_slug);
      if (resolucion.status === 'resolved') resultado.set(item.id, resolucion.release);
    })
  );
  return resultado;
}

/** Enlace público de una colección (el mismo que abre el visitante). */
export function enlaceColeccion(crate: Pick<Crate, 'slug'>, username: string, origin = window.location.origin) {
  return `${origin}/coleccion/${encodeURIComponent(crate.slug)}?usuario=${encodeURIComponent(username)}`;
}
