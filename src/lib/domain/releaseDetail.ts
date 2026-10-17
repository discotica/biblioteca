import type { Release, ReleaseDateValue } from './releases';

export type ReleasePlayerProvider = 'bandcamp' | 'soundcloud' | 'spotify';

export interface ReleasePlayerConfig {
  provider: ReleasePlayerProvider;
  title: string;
  src: string;
  height: number;
  allow: string;
}

const ES_CO_DATE = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC'
});

function externalUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url : null;
  } catch {
    return null;
  }
}

function isHost(url: URL, host: string) {
  return url.hostname === host || url.hostname.endsWith(`.${host}`);
}

/** Presentación única de fecha para las dos superficies de ficha. */
export function formatReleaseDateEsCo(value: ReleaseDateValue): string {
  if (!value.iso) return value.display;
  const [year, month, day] = value.iso.split('-').map(Number);
  return ES_CO_DATE.format(new Date(Date.UTC(year, month - 1, day)));
}

/** URL pública estable: nunca comparte el alias con el que se abrió la ficha. */
export function canonicalReleasePath(release: Pick<Release, 'slug'>): string {
  return `/lanzamiento/${encodeURIComponent(release.slug)}`;
}

/**
 * Matriz exterior de reproductores. Es deliberadamente pura: la aplicación
 * nunca consulta el DOM, la URL actual ni los eventos internos del iframe.
 */
export function releasePlayerConfig(release: Pick<Release, 'buyLink'>): ReleasePlayerConfig | null {
  const source = externalUrl(release.buyLink);
  if (!source) return null;

  if (isHost(source, 'bandcamp.com')) {
    return {
      provider: 'bandcamp',
      title: 'Bandcamp player',
      src: `https://bandcamp.com/EmbeddedPlayer/url=${encodeURIComponent(source.toString())}/size=large/bgcol=111111/linkcol=96f719/artwork=small/transparent=true/`,
      // Altura estable en ambos modos; no depende del DOM cross-origin. Cabe una lista de ~5 pistas
      // (cabecera ~120px + 33px por pista); las más largas hacen scroll dentro del reproductor.
      height: 290,
      allow: 'autoplay'
    };
  }

  if (isHost(source, 'soundcloud.com')) {
    return {
      provider: 'soundcloud',
      title: 'SoundCloud player',
      src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(source.toString())}&color=%2396f719&auto_play=false&hide_related=false&show_comments=false&show_user=true&show_reposts=false&show_teaser=false`,
      height: 300,
      allow: 'autoplay'
    };
  }

  if (source.hostname === 'open.spotify.com') {
    const match = source.pathname.match(/^\/album\/([A-Za-z0-9]+)\/?$/);
    if (!match) return null;
    return {
      provider: 'spotify',
      title: 'Spotify player',
      src: `https://open.spotify.com/embed/album/${match[1]}?utm_source=generator&theme=0`,
      height: 352,
      allow: 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture'
    };
  }

  return null;
}
