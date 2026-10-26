/**
 * Datos de ejemplo de /lab (U6). No son interfaz: las portadas son SVG de
 * prueba con proporciones distintas para comprobar el recorte, y los créditos,
 * géneros y redes son ficticios.
 */
import type { ArtistCredit, Release } from '$lib/domain/releases';
import { socialLinks, type SocialLink } from '$lib/domain/profileSocial';
import type { ComboboxOption } from '$lib/ui';

/** Portada de prueba: retícula, diagonal y la proporción escrita en el centro. */
export function sampleCover(width: number, height: number, tone: string, label = `${width}×${height}`): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<defs><pattern id="g" width="${width / 8}" height="${height / 8}" patternUnits="userSpaceOnUse"><path d="M ${width / 8} 0 L 0 0 0 ${height / 8}" fill="none" stroke="#0e0e0e" stroke-opacity=".35" stroke-width="2"/></pattern></defs>
<rect width="100%" height="100%" fill="${tone}"/><rect width="100%" height="100%" fill="url(#g)"/>
<path d="M0 0 L${width} ${height} M${width} 0 L0 ${height}" stroke="#0e0e0e" stroke-opacity=".25" stroke-width="3"/>
<rect x="3" y="3" width="${width - 6}" height="${height - 6}" fill="none" stroke="#f8ffee" stroke-width="6"/>
<text x="50%" y="50%" fill="#0e0e0e" font-family="sans-serif" font-weight="700" font-size="${Math.min(width, height) / 7}" text-anchor="middle" dominant-baseline="middle">${label}</text>
</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export const COVER_TONES = ['#96f719', '#7dd3fc', '#c4b5fd', '#fcd34d', '#fca5a5', '#baff4e'];

const credit = (name: string, position: number, slug: string | null = name.toLowerCase().replace(/[^a-z0-9]+/g, '-')): ArtistCredit => ({
  id: slug,
  slug,
  name,
  position
});

type CreditSample = { title: string; release: Pick<Release, 'releaseType' | 'primaryArtists' | 'collaborators'> };

export const CREDIT_SAMPLES: CreditSample[] = [
  { title: 'Un artista', release: { releaseType: 'Álbum', primaryArtists: [credit('Lido Pimienta', 0)], collaborators: [] } },
  {
    title: 'Varios principales, nombres largos',
    release: {
      releaseType: 'EP',
      primaryArtists: [credit('Sonido Gallo Negro y la Orquesta Imaginaria', 0), credit('Dengue Dengue Dengue', 1), credit('Nicola Cruz', 2)],
      collaborators: []
    }
  },
  {
    title: 'Principal y colaboradores',
    release: {
      releaseType: 'Single',
      primaryArtists: [credit('Luca Durán Experimental Ensemble de Medellín', 0)],
      collaborators: [credit('Ana Tijoux', 1), credit('Bomba Estéreo', 2), credit('Sin enlace', 3, null), credit('Quantic', 4)]
    }
  },
  {
    title: 'Compilado',
    release: {
      releaseType: 'Compilado',
      primaryArtists: [credit('Ela Minus', 0), credit('Verraco', 1), credit('Lucrecia Dalt', 2), credit('Sin enlace', 3, null)],
      collaborators: [credit('Matanza', 4)]
    }
  },
  { title: 'Solo colaboradores', release: { releaseType: 'Álbum', primaryArtists: [], collaborators: [credit('Meridian Brothers', 0)] } }
];

export const GENRE_OPTIONS: ComboboxOption[] = [
  'Ambient', 'Bullerengue', 'Champeta', 'Cumbia', 'Dembow', 'Downtempo', 'Drum and bass', 'Dub', 'Electro', 'Electrónica',
  'Experimental', 'Footwork', 'Funk', 'Guaracha', 'House', 'Jazz', 'Jungle', 'Minimal', 'Noise', 'Progresivo', 'Reggaetón',
  'Salsa', 'Techno', 'Trap', 'Tribal'
].map((label, index) => ({
  value: label.toLowerCase(),
  label,
  hint: `${(index * 37) % 140 + 3} lanzamientos`,
  // Grafías alternativas que encuentran la misma opción.
  keywords: label === 'Progresivo' ? ['Progressive', 'Progresive'] : label === 'Drum and bass' ? ['dnb', 'drum & bass'] : undefined
}));

export const COUNTRY_OPTIONS: ComboboxOption[] = ['Argentina', 'Bolivia', 'Brasil', 'Chile', 'Colombia', 'Ecuador', 'Estados Unidos', 'México', 'Perú', 'Uruguay', 'Venezuela'].map(
  (label) => ({ value: label, label, keywords: label === 'Estados Unidos' ? ['EE. UU.', 'EEUU', 'USA'] : undefined })
);

export const ARTIST_OPTIONS: ComboboxOption[] = ['Ela Minus', 'Lido Pimienta', 'Lucrecia Dalt', 'Meridian Brothers', 'Nicola Cruz', 'Quantic', 'Verraco', 'Dengue Dengue Dengue', 'Mitú', 'Matanza'].map(
  (label) => ({ value: label, label })
);

export type SortableSample = { id: string; title: string; artist: string; cover: string };

export const SORTABLE_SAMPLES: SortableSample[] = [
  ['Pájaros de fuego', 'Ela Minus'],
  ['Miss Colombia', 'Lido Pimienta'],
  ['¡Ay!', 'Lucrecia Dalt'],
  ['Cumbia siglo XXI con un título largo que ocupa dos líneas', 'Meridian Brothers'],
  ['Prender el alma', 'Nicola Cruz'],
  ['Atlantic Oscillations', 'Quantic']
].map(([title, artist], index) => ({ id: `r${index + 1}`, title, artist, cover: sampleCover(240, 240, COVER_TONES[index % COVER_TONES.length], String(index + 1)) }));

/** Perfil de ejemplo con las cinco redes (contrato D1, sin datos reales). */
export const SOCIAL_SAMPLE: SocialLink[] = socialLinks({
  social_bandcamp: 'discotica',
  social_bandcamp_kind: 'artist',
  social_soundcloud: 'discotica',
  social_instagram: 'discotica.co',
  social_x: 'discotica',
  social_facebook: 'discotica.co'
});

// ---- Tarjeta y fila (U8) ------------------------------------------------------

type ReleaseSampleInput = Pick<Release, 'title' | 'label' | 'genres' | 'countries' | 'radar'> &
  Pick<CreditSample['release'], 'releaseType' | 'primaryArtists' | 'collaborators'> & { year: string; cover: string };

const release = (index: number, input: ReleaseSampleInput): Release => {
  const slug = `lab-u8-${index}`;
  // Solo los campos que leen la tarjeta y la fila; el resto del contrato no hace falta en /lab.
  return {
    id: slug,
    slug,
    title: input.title,
    releaseType: input.releaseType,
    releaseDate: { iso: null, display: input.year, year: input.year, month: '', timestamp: 0 },
    primaryArtists: input.primaryArtists,
    collaborators: input.collaborators,
    countries: input.countries,
    genres: input.genres,
    label: input.label,
    coverUrl: input.cover,
    radar: input.radar
  } as unknown as Release;
};

/**
 * Los casos de créditos del plan (compilado, varios principales de nombres
 * largos, principal con colaboradores) más los que cambian el alto de la
 * tarjeta: título largo, datos largos, cinco géneros, sin portada, sin datos.
 */
export const RELEASE_SAMPLES: Release[] = [
  release(1, {
    title: 'Pájaros de fuego',
    ...CREDIT_SAMPLES[0].release,
    year: '2024',
    countries: ['Colombia'],
    label: 'Sello Lab',
    genres: ['Electrónica', 'Techno'],
    radar: { experimental: 2, denso: 3, sintetico: 4, bailable: 5, rapido: 4 },
    cover: sampleCover(600, 600, COVER_TONES[0], '1:1')
  }),
  release(2, {
    title: 'Cumbia siglo XXI con un título largo que no cabe en dos líneas de la tarjeta',
    ...CREDIT_SAMPLES[1].release,
    year: '2019',
    countries: ['Estados Unidos', 'Colombia'],
    label: 'Un sello con un nombre excepcionalmente largo para probar el truncado',
    genres: ['Cumbia', 'Experimental', 'Drum and bass', 'Dub', 'Jungle'],
    radar: { experimental: 5, denso: 4, sintetico: 3, bailable: 2, rapido: 1 },
    cover: sampleCover(1600, 900, COVER_TONES[1], '16:9')
  }),
  release(3, {
    title: 'Principal con colaboradores',
    ...CREDIT_SAMPLES[2].release,
    year: '2025',
    countries: ['Chile'],
    label: 'Discos Lab',
    genres: ['House'],
    radar: { experimental: 1, denso: 2, sintetico: 2, bailable: 5, rapido: 3 },
    cover: sampleCover(500, 800, COVER_TONES[2], '5:8')
  }),
  release(4, {
    title: 'Compilado del laboratorio',
    ...CREDIT_SAMPLES[3].release,
    year: '2023',
    countries: ['México'],
    label: 'Compilados Lab',
    genres: ['Ambient', 'Downtempo', 'Noise'],
    radar: { experimental: 4, denso: 2, sintetico: 5, bailable: 1, rapido: 2 },
    cover: sampleCover(600, 600, COVER_TONES[3], 'VA')
  }),
  release(5, {
    title: 'Sin portada ni créditos',
    releaseType: 'Single',
    primaryArtists: [],
    collaborators: [],
    year: '',
    countries: [],
    label: '',
    genres: [],
    radar: { experimental: 0, denso: 0, sintetico: 0, bailable: 0, rapido: 0 },
    cover: ''
  }),
  release(6, {
    title: 'Solo colaboradores',
    ...CREDIT_SAMPLES[4].release,
    year: '2021',
    countries: ['Perú'],
    label: 'Sello Lab',
    genres: ['Funk', 'Salsa'],
    radar: { experimental: 3, denso: 3, sintetico: 1, bailable: 4, rapido: 3 },
    cover: sampleCover(600, 600, COVER_TONES[5], '6')
  })
];
