import { supabase } from "$lib/supabase";
import {
  RELEASE_TYPES,
  type CreditQuality,
  type ReleaseType,
} from "$lib/domain/releases";

export type CatalogStatus = "draft" | "published" | "archived";
export type DictionaryEntry = { id: string; name: string; slug?: string };
export type Artist = DictionaryEntry & { normalized_name?: string };

/** Requisitos de publicación de E06 que el lanzamiento guardado no cumple (D2). */
export type CatalogMissingField =
  | "release_date"
  | "release_type"
  | "label"
  | "primary_artist"
  | "genre"
  | "country"
  | "cover"
  | "primary_link";

/** Mismos nombres que usa la consola de E07 para los campos pendientes. */
export const CATALOG_MISSING_FIELD_LABELS: Record<CatalogMissingField, string> = {
  release_date: "Fecha",
  release_type: "Tipo",
  label: "Sello",
  primary_artist: "Artista principal",
  genre: "Género",
  country: "País",
  cover: "Portada",
  primary_link: "Link de compra",
};

/** Señales de solo lectura para las vistas rápidas del Estudio (D2). */
export type CatalogSignals = {
  draft: boolean;
  /** `missing_fields` no está vacío: hoy no se podría publicar. */
  incomplete: boolean;
  missing_fields: CatalogMissingField[];
  /** Sin portada externa HTTPS; equivale a `missing_fields` con "cover". */
  missing_cover: boolean;
  /** Reportes en estado new, triaged o in_progress. */
  open_report_count: number;
};

export type CatalogQuickView =
  | "draft"
  | "incomplete"
  | "missing_cover"
  | "open_reports";

export const CATALOG_QUICK_VIEWS: CatalogQuickView[] = [
  "draft",
  "incomplete",
  "missing_cover",
  "open_reports",
];

export type CatalogSnapshot = {
  id: string;
  slug: string;
  title: string;
  release_date: string | null;
  release_type_id: string | null;
  label_id: string | null;
  review: string;
  status: CatalogStatus;
  credit_quality: CreditQuality;
  catalog_version: number;
  updated_at: string;
  artist_ids: string[];
  collaborator_ids: string[];
  genre_ids: string[];
  country_ids: string[];
  radar: Record<string, number>;
  links: { provider: string; url: string; is_primary: boolean }[];
  cover_url: string | null;
  source?: {
    mode: "imported" | "editorial";
    provider: string | null;
    url: string | null;
    cover_source_url: string | null;
  };
  /** Solo en las lecturas administrativas; nunca se envía en un payload. */
  signals?: CatalogSignals;
};

export type CatalogHistory = {
  change_set_id: string;
  operation: string;
  reason: string;
  status: "applied" | "reverted";
  base_version: number | null;
  result_version: number;
  created_at: string;
  reverted_at: string | null;
  /** El lote que hizo el cambio; null en las operaciones individuales. */
  batch_id: string | null;
  actor: { id: string; username: string; display_name: string };
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown>;
};

function rpcError(error: { message: string; code?: string } | null) {
  if (!error) return;
  const next = new Error(error.message) as Error & { code?: string };
  next.code = error.code;
  throw next;
}

export async function getAdminRole(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  rpcError(error);
  return data?.role ?? "";
}

export type CatalogOrderKey = "release_date" | "updated_at" | "title" | "slug";
export type CatalogOrderDirection = "asc" | "desc";

export async function listCatalog(input: {
  query: string;
  statuses: CatalogStatus[];
  typeIds: string[];
  qualities: CreditQuality[];
  page: number;
  orderKey?: CatalogOrderKey;
  orderDirection?: CatalogOrderDirection;
  /** Se combina con los demás filtros; el servidor filtra antes de paginar. */
  quickView?: CatalogQuickView | null;
}) {
  const { data, error } = await supabase.rpc("admin_list_catalog_releases", {
    p_query: input.query || null,
    p_statuses: input.statuses.length ? input.statuses : null,
    p_type_ids: input.typeIds.length ? input.typeIds : null,
    p_credit_qualities: input.qualities.length ? input.qualities : null,
    p_page: input.page,
    p_page_size: 25,
    // E06 orders the full filtered relation before OFFSET/LIMIT. These are
    // allowlisted again in SQL; client values never become SQL identifiers.
    p_order_key: input.orderKey ?? "release_date",
    p_order_direction: input.orderDirection ?? "desc",
    p_quick_view: input.quickView ?? null,
  });
  rpcError(error);
  return data as {
    items: CatalogSnapshot[];
    total: number;
    page: number;
    page_size: number;
    quick_view: CatalogQuickView | null;
  };
}

export type CatalogQuickViewCounts = Record<CatalogQuickView, number> & {
  total: number;
};

/** Conteos de las vistas rápidas, opcionalmente solo para ciertos estados. */
export async function getCatalogQuickViewCounts(
  statuses: CatalogStatus[] = [],
): Promise<CatalogQuickViewCounts> {
  const { data, error } = await supabase.rpc("admin_catalog_quick_view_counts", {
    p_statuses: statuses.length ? statuses : null,
  });
  rpcError(error);
  const { statuses: _statuses, ...counts } = data as CatalogQuickViewCounts & {
    statuses: unknown;
  };
  return counts;
}

/** Igual que el límite del servidor; un lote mayor se rechaza entero con 22023. */
export const CATALOG_BATCH_MAX = 50;

export type CatalogBatchOperation = "publish" | "archive";

type BatchItemBase = { release_id: string; expected_version: number };

export type CatalogBatchItemResult =
  | (BatchItemBase & {
      result: "applied";
      catalog_version: number;
      change_set_id: string;
    })
  /** Ya estaba en el estado pedido: no se escribe ni se audita. */
  | (BatchItemBase & { result: "unchanged"; catalog_version: number })
  /** Era válido, pero otro elemento falló y el lote se deshizo. */
  | (BatchItemBase & { result: "rolled_back" })
  /** Mismo SQLSTATE que la operación individual: 40001, 23514, 22023, P0002… */
  | (BatchItemBase & {
      result: "rejected";
      error: { code: string; message: string };
    });

export type CatalogBatchResult = {
  /** false: no cambió nada, ni datos ni auditoría. */
  applied: boolean;
  operation: CatalogBatchOperation;
  /** Enlaza los change sets del lote en el historial; null si no se escribió nada. */
  batch_id: string | null;
  requested: number;
  applied_count: number;
  unchanged_count: number;
  rolled_back_count: number;
  rejected_count: number;
  /** Uno por elemento, en el orden enviado. */
  items: CatalogBatchItemResult[];
};

/**
 * Publica o archiva en lote (solo admin), todo o nada. Cada lanzamiento pasa
 * por la misma validación, versionado y auditoría que `saveCatalog`, y la
 * versión enviada es la precondición de concurrencia de cada uno: si alguno
 * cambió desde la última lectura, el lote no se aplica y ese elemento vuelve
 * con 40001. Un lote rechazado responde con `applied: false`, no lanza.
 * Lanza 42501 si quien llama no es admin y 22023 si el lote está mal formado.
 */
export async function batchUpdateCatalog(
  operation: CatalogBatchOperation,
  releases: Pick<CatalogSnapshot, "id" | "catalog_version">[],
  reason: string,
): Promise<CatalogBatchResult> {
  const { data, error } = await supabase.rpc(
    "admin_batch_update_catalog_releases",
    {
      p_operation: operation,
      p_items: releases.map((release) => ({
        release_id: release.id,
        expected_version: release.catalog_version,
      })),
      p_reason: reason,
    },
  );
  rpcError(error);
  return data as CatalogBatchResult;
}

export async function getCatalogRelease(id: string) {
  const { data, error } = await supabase.rpc("admin_get_catalog_release", {
    p_release_id: id,
  });
  rpcError(error);
  return data as CatalogSnapshot;
}

export async function getCatalogHistory(id: string) {
  const { data, error } = await supabase.rpc("admin_get_catalog_history", {
    p_release_id: id,
  });
  rpcError(error);
  return (data as { items: CatalogHistory[] }).items;
}

export async function saveCatalog(
  snapshot: CatalogSnapshot,
  reason: string,
  operation: "update" | "publish" | "archive" = "update",
) {
  const { data, error } = await supabase.rpc("admin_update_catalog_release", {
    p_release_id: snapshot.id,
    p_expected_version: snapshot.catalog_version,
    p_payload: payload(snapshot),
    p_reason: reason,
    p_operation: operation,
  });
  rpcError(error);
  return data as {
    release_id: string;
    catalog_version: number;
    change_set_id: string;
  };
}

export async function createCatalog(snapshot: CatalogSnapshot, reason: string) {
  const { data, error } = await supabase.rpc("admin_create_catalog_release", {
    p_payload: payload(snapshot),
    p_reason: reason,
  });
  rpcError(error);
  return data as {
    release_id: string;
    catalog_version: number;
    change_set_id: string;
  };
}

export async function revertCatalog(
  changeSetId: string,
  version: number,
  reason: string,
) {
  const { data, error } = await supabase.rpc("admin_revert_catalog_change", {
    p_change_set_id: changeSetId,
    p_expected_version: version,
    p_reason: reason,
  });
  rpcError(error);
  return data as {
    release_id: string;
    catalog_version: number;
    change_set_id: string;
  };
}

export async function createArtist(name: string) {
  const { data, error } = await supabase.rpc("admin_create_catalog_artist", {
    p_name: name,
    p_confirm: true,
  });
  rpcError(error);
  return data as {
    artist_id: string;
    name: string;
    created: boolean;
    duplicate: boolean;
  };
}

export type DictionaryCreateResult = DictionaryEntry & {
  created: boolean;
  duplicate: boolean;
  audit_event_id?: number;
  catalog_version?: number;
};

async function createDictionary(
  entity: "label" | "genre",
  name: string,
  reason: string,
): Promise<DictionaryCreateResult> {
  const { data, error } = await supabase.rpc(`admin_create_catalog_${entity}`, {
    p_name: name,
    p_confirm: true,
    p_reason: reason,
  });
  rpcError(error);
  const result = data as Record<string, unknown>;
  return {
    id: String(result[`${entity}_id`]),
    name: String(result.name),
    created: Boolean(result.created),
    duplicate: Boolean(result.duplicate),
    ...(typeof result.audit_event_id === "number" ? { audit_event_id: result.audit_event_id } : {}),
    ...(typeof result.catalog_version === "number" ? { catalog_version: result.catalog_version } : {}),
  };
}

/** Admin RPCs only: components never insert dictionary rows directly. */
export const createLabel = (name: string, reason: string) =>
  createDictionary("label", name, reason);

/** Admin RPCs only: components never insert dictionary rows directly. */
export const createGenre = (name: string, reason: string) =>
  createDictionary("genre", name, reason);

export async function getArtistsByIds(ids: string[]) {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (!uniqueIds.length) return [] as Artist[];
  const { data, error } = await supabase
    .from("artists")
    .select("id,name,slug")
    .in("id", uniqueIds)
    .order("name");
  rpcError(error);
  return (data ?? []) as Artist[];
}

export async function searchArtists(query: string) {
  const value = query.trim();
  if (value.length < 2) return [] as Artist[];
  const { data, error } = await supabase
    .from("artists")
    .select("id,name,slug")
    .ilike("name", `%${value}%`)
    .order("name")
    .limit(30);
  rpcError(error);
  return (data ?? []) as Artist[];
}

/**
 * Artistas existentes con exactamente estos nombres (sin distinguir mayúsculas).
 * Para el traspaso de Sugerir a la consola (U13): no crea nada.
 */
export async function findArtistsByNames(names: string[]) {
  const unique = [...new Set(names.map((name) => name.trim()).filter(Boolean))];
  const found = await Promise.all(
    unique.map(async (name) => {
      const pattern = name.replace(/[\\%_]/g, (character) => `\\${character}`);
      const { data, error } = await supabase.from("artists").select("id,name,slug").ilike("name", pattern).limit(5);
      rpcError(error);
      return (data ?? []) as Artist[];
    }),
  );
  return found.flat();
}

/** Read-only public dictionaries are intentionally kept outside component code. */
export async function dictionaries() {
  const [labels, genres, countries, types] = await Promise.all([
    supabase.from("labels").select("id,name,slug").order("name").limit(1000),
    supabase.from("genres").select("id,name,slug").order("name").limit(1000),
    supabase.from("countries").select("id,name,slug").order("name").limit(1000),
    supabase.from("release_types").select("id,name,slug").order("name"),
  ]);
  for (const response of [labels, genres, countries, types])
    rpcError(response.error);
  const canonicalTypes = ((types.data ?? []) as DictionaryEntry[]).filter(
    (entry) => RELEASE_TYPES.includes(entry.name as ReleaseType),
  );
  return {
    labels: (labels.data ?? []) as DictionaryEntry[],
    genres: (genres.data ?? []) as DictionaryEntry[],
    countries: (countries.data ?? []) as DictionaryEntry[],
    types: canonicalTypes,
  };
}

export function blankCatalog(): CatalogSnapshot {
  return {
    id: "",
    slug: "",
    title: "",
    release_date: null,
    release_type_id: null,
    label_id: null,
    review: "",
    status: "draft",
    credit_quality: "proposed",
    catalog_version: 1,
    updated_at: "",
    artist_ids: [],
    collaborator_ids: [],
    genre_ids: [],
    country_ids: [],
    radar: { experimental: 0, denso: 0, sintetico: 0, bailable: 0, rapido: 0 },
    links: [],
    cover_url: null,
  };
}

export function payload(snapshot: CatalogSnapshot) {
  const { id, catalog_version, updated_at, source, signals, ...value } =
    snapshot;
  return value;
}
