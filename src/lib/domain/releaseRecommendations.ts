import { releaseArtistPresentation, type Release } from './releases.ts';
import { evaluateReleaseMatch, normalizeSearchText } from './searchMatching.ts';

export type ReleaseRecommendation = {
  release: Release;
  slot: 1 | 2;
  artist: string;
  sharesGenre: boolean;
  radarDistance: number | null;
};

function releaseIdentity(release: Release): string {
  return String(release.id || release.slug).trim();
}

function stableHash(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function sharesGenre(current: Release, candidate: Release): boolean {
  const genres = new Set(current.genres.map(normalizeSearchText).filter(Boolean));
  return candidate.genres.some((genre) => genres.has(normalizeSearchText(genre)));
}

function radarDistance(current: Release, candidate: Release): number | null {
  // E11 remains the only Radar evaluator. Recommendations intentionally read
  // its distance but do not apply its search eligibility gate.
  return evaluateReleaseMatch(candidate, { radar: current.radar }).radarDistance;
}

function compareForSlot(current: Release, slot: 1 | 2) {
  const currentIdentity = releaseIdentity(current);
  return (a: Release, b: Release) => {
    const aDistance = radarDistance(current, a) ?? Number.POSITIVE_INFINITY;
    const bDistance = radarDistance(current, b) ?? Number.POSITIVE_INFINITY;
    if (aDistance !== bDistance) return aDistance - bDistance;
    const aTie = stableHash(`${currentIdentity}|${slot}|${releaseIdentity(a)}`);
    const bTie = stableHash(`${currentIdentity}|${slot}|${releaseIdentity(b)}`);
    return aTie - bTie || releaseIdentity(a).localeCompare(releaseIdentity(b));
  };
}

function asRecommendation(current: Release, release: Release, slot: 1 | 2): ReleaseRecommendation {
  return {
    release,
    slot,
    artist: releaseArtistPresentation(release).label,
    sharesGenre: sharesGenre(current, release),
    radarDistance: radarDistance(current, release)
  };
}

/**
 * Returns the two editorial slots defined by E17. The catalogue is independent
 * from active search filters and is de-duplicated by canonical release_id (or
 * slug only for legacy rows that do not have an id yet).
 */
export function recommendReleases(current: Release, catalogue: readonly Release[]): ReleaseRecommendation[] {
  const currentIdentity = releaseIdentity(current);
  const unique = new Map<string, Release>();
  for (const candidate of catalogue) {
    const identity = releaseIdentity(candidate);
    if (!identity || identity === currentIdentity || unique.has(identity)) continue;
    unique.set(identity, candidate);
  }

  const candidates = [...unique.values()];
  const first = candidates.filter((candidate) => sharesGenre(current, candidate)).sort(compareForSlot(current, 1))[0];
  const remaining = first
    ? candidates.filter((candidate) => releaseIdentity(candidate) !== releaseIdentity(first))
    : candidates;
  const second = remaining.sort(compareForSlot(current, 2))[0];

  return [
    ...(first ? [asRecommendation(current, first, 1)] : []),
    ...(second ? [asRecommendation(current, second, 2)] : [])
  ];
}

