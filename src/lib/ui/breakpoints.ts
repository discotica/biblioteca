// Breakpoints de Tokens v2 (U4). Mismos valores que --breakpoint-* en
// src/lib/styles/tokens.css; CSS no admite var() en @media, así que el lint
// de tokens solo acepta estos valores en las consultas.
export const BREAKPOINTS = {
  compact: 480,
  ficha: 680,
  mobile: 768,
  wide: 1024,
  max: 1280
} as const;

/** Móvil del sitio público: hasta 768 px incluido. */
export const MOBILE_QUERY = `(max-width: ${BREAKPOINTS.mobile}px)`;
/** Ficha en dos columnas (U9): desde 768 px. Por debajo, una columna con la barra fija abajo. */
export const FICHA_WIDE_QUERY = `(min-width: ${BREAKPOINTS.mobile}px)`;
/** Móvil de la consola: por debajo de 768 px. */
export const BELOW_MOBILE_QUERY = `(max-width: ${BREAKPOINTS.mobile - 1}px)`;
