/**
 * E08 inference contract. This module is deliberately pure: callers fetch and
 * validate metadata elsewhere, then pass a bounded snapshot here. It never
 * creates artists, performs network I/O, or writes a release.
 */
export const CREDIT_INFERENCE_VERSION = "credit-inference-v1";

export type ExistingArtist = { id: string; name: string; normalized_name?: string };
export type CreditMetadata = {
  provider?: "bandcamp" | "spotify" | "soundcloud" | "manual" | string;
  source_url?: string;
  /** Bandcamp data-tralbum.current.artist, not text guessed from a title. */
  structured_author?: string | null;
  title?: string | null;
  track_authors?: string[] | null;
  source_available?: boolean;
};
export type CreditEvidence = {
  kind: "structured_author" | "controlled_signal" | "ambiguous_separator" | "missing_source" | "contradiction";
  field: "structured_author" | "title" | "track_authors" | "source";
  value: string;
  signal?: string;
};
export type CreditInference = {
  heuristic_version: typeof CREDIT_INFERENCE_VERSION;
  classification: "high" | "review" | "manual";
  primary_artist_ids: string[];
  collaborator_artist_ids: string[];
  evidence: CreditEvidence[];
  warnings: string[];
};

const collaboration = /\b(feat\.?|ft\.?|featuring|remix|remixed\s+by|prod\.?|produced\s+by)\b/giu;
const separator = /\s*(?:,|&|\band\b|\by\b)\s*/giu;

function clean(value: string) {
  return value.normalize("NFC").replace(/\s+/gu, " ").trim();
}

function key(value: string) {
  return clean(value).normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase();
}

function artistIndex(artists: ExistingArtist[]) {
  return new Map(artists.map((artist) => [key(artist.normalized_name || artist.name), artist]));
}

function knownParts(value: string, known: Map<string, ExistingArtist>) {
  const exact = known.get(key(value));
  if (exact) return { artists: [exact], ambiguous: false };
  if (!/[,&]|\band\b|\by\b/iu.test(value)) return { artists: [], ambiguous: false };
  const parts = value.split(separator).map(clean).filter(Boolean);
  // Separators are semantic only when *every* part resolves to an established
  // identity. This keeps names such as "A&B" and "Comma, Name" intact.
  if (parts.length < 2) return { artists: [], ambiguous: true };
  const resolved = parts.map((part) => known.get(key(part)));
  return resolved.every(Boolean)
    ? { artists: resolved as ExistingArtist[], ambiguous: false }
    : { artists: [], ambiguous: true };
}

function controlledSignals(field: CreditEvidence["field"], value: string) {
  const signals: CreditEvidence[] = [];
  collaboration.lastIndex = 0;
  for (const match of value.matchAll(collaboration)) {
    signals.push({ kind: "controlled_signal", field, value, signal: match[0].toLocaleLowerCase() });
  }
  return signals;
}

/** Conservative inference. `high` requires a supported, available source and
 * a structured author that resolves exactly to known artist identities, with
 * no collaboration signal or unresolved track author. */
export function inferCredits(metadata: CreditMetadata, artists: ExistingArtist[]): CreditInference {
  const known = artistIndex(artists);
  const evidence: CreditEvidence[] = [];
  const warnings: string[] = [];
  const author = clean(metadata.structured_author || "");
  const signalEvidence = [
    ...controlledSignals("title", metadata.title || ""),
    ...(metadata.track_authors || []).flatMap((trackAuthor) => controlledSignals("track_authors", trackAuthor)),
  ];
  evidence.push(...signalEvidence);

  if (metadata.source_available !== true || !metadata.source_url || !["bandcamp", "spotify", "soundcloud"].includes(metadata.provider || "")) {
    evidence.push({ kind: "missing_source", field: "source", value: metadata.source_url || "unavailable" });
    return { heuristic_version: CREDIT_INFERENCE_VERSION, classification: "manual", primary_artist_ids: [], collaborator_artist_ids: [], evidence, warnings: ["source_unavailable_or_unsupported"] };
  }
  if (!author) {
    evidence.push({ kind: "missing_source", field: "structured_author", value: "missing" });
    return { heuristic_version: CREDIT_INFERENCE_VERSION, classification: "manual", primary_artist_ids: [], collaborator_artist_ids: [], evidence, warnings: ["structured_author_missing"] };
  }

  const resolved = knownParts(author, known);
  if (resolved.ambiguous) {
    evidence.push({ kind: "ambiguous_separator", field: "structured_author", value: author });
    return { heuristic_version: CREDIT_INFERENCE_VERSION, classification: "review", primary_artist_ids: [], collaborator_artist_ids: [], evidence, warnings: ["author_separator_not_cross_checked"] };
  }
  if (!resolved.artists.length) {
    evidence.push({ kind: "contradiction", field: "structured_author", value: author });
    return { heuristic_version: CREDIT_INFERENCE_VERSION, classification: "manual", primary_artist_ids: [], collaborator_artist_ids: [], evidence, warnings: ["structured_author_not_known"] };
  }
  evidence.push({ kind: "structured_author", field: "structured_author", value: author });

  const trackAuthors = (metadata.track_authors || []).map(clean).filter(Boolean);
  const unresolvedTrackAuthor = trackAuthors.some((trackAuthor) => !knownParts(trackAuthor, known).artists.length);
  if (signalEvidence.length || unresolvedTrackAuthor) {
    if (unresolvedTrackAuthor) warnings.push("track_author_requires_editorial_review");
    return {
      heuristic_version: CREDIT_INFERENCE_VERSION,
      classification: "review",
      primary_artist_ids: resolved.artists.map((artist) => artist.id),
      collaborator_artist_ids: [],
      evidence,
      warnings: signalEvidence.length ? [...warnings, "collaboration_signal_requires_editorial_review"] : warnings,
    };
  }
  return { heuristic_version: CREDIT_INFERENCE_VERSION, classification: "high", primary_artist_ids: resolved.artists.map((artist) => artist.id), collaborator_artist_ids: [], evidence, warnings };
}
