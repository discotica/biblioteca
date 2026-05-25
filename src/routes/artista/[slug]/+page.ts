// src/routes/artista/[slug]/+page.ts
import type { PageLoad } from './$types';
import { slugify } from '$lib/utils/slugify';

const TSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vScoTP0-0jq3HAGMIzxS9NOSHsgXx4bxjlFKSPtuFq26OLJ5QCTtulXm328Bdl5lMHzpiOO5ffkpvE4/pub?gid=1229139332&single=true&output=tsv';

function splitCSVish(value: unknown): string[] {
  const s = (value ?? '').toString().trim();
  if (!s) return [];
  return s.split(',').map((x) => x.trim()).filter(Boolean);
}

function toInt01to5(v: unknown): number {
  const n = Number((v ?? '').toString().trim());
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(5, Math.round(n)));
}

function normKey(s: unknown): string {
  return (s ?? '')
    .toString()
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, '_');
}

function parseTSV(tsvText: string): Record<string, string>[] {
  const text = (tsvText ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = text.split('\n').filter((l) => l.trim().length > 0);
  if (!lines.length) return [];

  const headers = lines[0].split('\t').map((h) => normKey(h));
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split('\t');
    const obj: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) obj[headers[c]] = (cols[c] ?? '').trim();
    rows.push(obj);
  }
  return rows;
}

/**
 * Cache cliente (por pestaña). Evita re-descargar el TSV
 * al navegar entre artistas, sellos, lanzamientos, etc.
 */
let cacheData: any[] | null = null;
let cacheAt = 0;
let inflight: Promise<any[]> | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

async function fetchLanzamientosCached(fetchFn: typeof fetch): Promise<any[]> {
  const now = Date.now();
  if (cacheData && now - cacheAt < CACHE_TTL_MS) return cacheData;
  if (inflight) return inflight;

  inflight = (async () => {
    const res = await fetchFn(TSV_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`TSV fetch failed: ${res.status}`);

    const tsvText = await res.text();
    const rows = parseTSV(tsvText);

    const parsed = rows
      .map((r) => {
        const artistArr = splitCSVish((r as any).artist);
        const artist = artistArr.length ? artistArr : ((r as any).artist ? [(r as any).artist.trim()] : []);

        const experimental = (r as any).experimental ?? (r as any).radar_experimental;
        const denso = (r as any).denso ?? (r as any).radar_denso;
        const sintetico = (r as any).sintetico ?? (r as any).sintetico_ ?? (r as any).radar_sintetico;
        const bailable = (r as any).bailable ?? (r as any).bailable_ ?? (r as any).radar_bailable;
        const rapido = (r as any).rapido ?? (r as any).rapido_ ?? (r as any).radar_rapido;

        return {
          artist,
          title: ((r as any).title ?? '').trim(),
          type: ((r as any).type ?? '').trim(),
          country: splitCSVish((r as any).country),
          genre: splitCSVish((r as any).genre),
          label: ((r as any).label ?? '').trim(),
          release_date: ((r as any).release_date ?? '').trim(),
          buy_link: ((r as any).buy_link ?? '').trim(),
          review: ((r as any).review ?? '').trim(),
          radar: {
            experimental: toInt01to5(experimental),
            denso: toInt01to5(denso),
            sintetico: toInt01to5(sintetico),
            bailable: toInt01to5(bailable),
            rapido: toInt01to5(rapido)
          },
          cover: ((r as any).cover ?? '').trim()
        };
      })
      .filter((l) => l.title || (l.artist && l.artist.length));

    cacheData = parsed;
    cacheAt = Date.now();
    inflight = null;
    return parsed;
  })();

  try {
    return await inflight;
  } catch (e) {
    inflight = null;
    throw e;
  }
}

export const load: PageLoad = async ({ params, fetch }) => {
  const slug = params.slug;

  const lanzamientos = await fetchLanzamientosCached(fetch);

  const filtrados = lanzamientos.filter((l: any) =>
    (l?.artist ?? []).some((nombre: string) => slugify(nombre) === slug)
  );

  const nombreArtista =
    (filtrados.length > 0
      ? filtrados[0]?.artist?.find((nombre: string) => slugify(nombre) === slug)
      : decodeURIComponent(slug)) || decodeURIComponent(slug);

  return { slug, nombreArtista, lanzamientos: filtrados };
};