import { supabase } from "$lib/supabase";
import type {
  DictionaryFilter,
  DictionaryItem,
  DictionaryKind,
  DictionaryPage,
} from "$lib/domain/dictionaries";

/**
 * RPC de la pantalla de diccionarios (U19, G4). Todos son de admin y
 * auditados; los cuatro de escritura piden la observación del cambio.
 */

export const DICTIONARY_PAGE_SIZE = 50;
/** Igual que el límite del servidor. */
export const DICTIONARY_DELETE_MAX = 200;

function rpcError(error: { message: string; code?: string; details?: string | null } | null) {
  if (!error) return;
  const next = new Error(error.message) as Error & { code?: string; details?: string | null };
  next.code = error.code;
  next.details = error.details ?? null;
  throw next;
}

export async function listDictionary(input: {
  kind: DictionaryKind;
  query?: string;
  filter?: DictionaryFilter;
  page?: number;
  pageSize?: number;
}): Promise<DictionaryPage> {
  const { data, error } = await supabase.rpc("admin_list_catalog_dictionary", {
    p_kind: input.kind,
    p_query: input.query?.trim() || null,
    p_filter: input.filter ?? "all",
    p_page: input.page ?? 1,
    p_page_size: input.pageSize ?? DICTIONARY_PAGE_SIZE,
  });
  rpcError(error);
  return data as DictionaryPage;
}

type ValueResult = { kind: DictionaryKind; value: Pick<DictionaryItem, "id" | "name" | "slug" | "status" | "aliases"> };

export async function createDictionaryValue(kind: DictionaryKind, name: string, status: "selectable" | "legacy", reason: string) {
  const { data, error } = await supabase.rpc("admin_create_catalog_dictionary_value", {
    p_kind: kind,
    p_name: name,
    p_status: status,
    p_reason: reason,
  });
  rpcError(error);
  return data as ValueResult;
}

export async function renameDictionaryValue(kind: DictionaryKind, id: string, name: string, reason: string) {
  const { data, error } = await supabase.rpc("admin_rename_catalog_dictionary_value", {
    p_kind: kind,
    p_id: id,
    p_name: name,
    p_reason: reason,
  });
  rpcError(error);
  return data as ValueResult & { changed: boolean; previous_name?: string; alias_added?: boolean; slug_aliases_added?: string[] };
}

export async function mergeDictionaryValues(kind: DictionaryKind, sourceId: string, targetId: string, reason: string) {
  const { data, error } = await supabase.rpc("admin_merge_catalog_dictionary_values", {
    p_kind: kind,
    p_source_id: sourceId,
    p_target_id: targetId,
    p_reason: reason,
  });
  rpcError(error);
  return data as ValueResult & { source: { id: string; name: string }; release_count: number; slug_aliases_added: string[] };
}

export async function setDictionaryStatus(kind: DictionaryKind, id: string, status: "selectable" | "legacy", reason: string) {
  const { data, error } = await supabase.rpc("admin_set_catalog_dictionary_status", {
    p_kind: kind,
    p_id: id,
    p_status: status,
    p_reason: reason,
  });
  rpcError(error);
  return data as ValueResult & { changed: boolean; previous_status?: string };
}

export async function deleteDictionaryOrphans(kind: DictionaryKind, ids: string[], reason: string) {
  const { data, error } = await supabase.rpc("admin_delete_catalog_dictionary_orphans", {
    p_kind: kind,
    p_ids: ids,
    p_reason: reason,
  });
  rpcError(error);
  return data as { kind: DictionaryKind; deleted_count: number; items: { id: string; name: string }[] };
}
