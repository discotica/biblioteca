/**
 * Iconos SVG del sistema (U5). Sustituyen a los emoji y a los glifos
 * tipográficos usados como icono.
 *
 * - Retícula de 24 × 24, trazo `currentColor` de --icon-stroke y extremos
 *   redondeados. El color siempre sale del texto que los rodea.
 * - Las marcas de redes son siluetas rellenas (`filled`).
 * - Instagram reutiliza el dibujo de marca de `static/img/insta.svg`, con su
 *   propio viewBox, para que coincida con el footer.
 */
export type IconPath = string | { d: string; fill: true };

export type IconDefinition = {
  paths: IconPath[];
  /** Silueta rellena sin trazo (marcas). */
  filled?: boolean;
  viewBox?: string;
};

const circle = (cx: number, cy: number, r: number) =>
  `M${cx + r} ${cy}a${r} ${r} 0 1 1-${2 * r} 0 ${r} ${r} 0 0 1 ${2 * r} 0Z`;

export const ICONS = {
  // ---- Acciones ---------------------------------------------------------
  buscar: { paths: [circle(10.5, 10.5, 6.5), 'M15.5 15.5 20 20'] },
  salir: { paths: ['M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4', 'M15 8l4 4-4 4', 'M19 12H9'] },
  compartir: {
    paths: [
      { d: circle(18, 5.5, 2.5), fill: true },
      { d: circle(6, 12, 2.5), fill: true },
      { d: circle(18, 18.5, 2.5), fill: true },
      'M8.2 10.8 15.8 6.7',
      'M8.2 13.2l7.6 4.1'
    ]
  },
  reportar: { paths: ['M5 21V4', 'M5 4h13l-3 5 3 5H5'] },
  // Bolsa: Comprar en la ficha (U9).
  comprar: { paths: ['M5 8h14l-1.2 12H6.2Z', 'M9 10V7a3 3 0 0 1 6 0v3'] },
  menu: { paths: ['M4 7h16', 'M4 12h16', 'M4 17h16'] },
  cerrar: { paths: ['M6 6l12 12', 'M18 6 6 18'] },
  agregar: { paths: ['M12 5v14', 'M5 12h14'] },
  check: { paths: ['M5 12.5l4.5 4.5L19 7.5'] },
  'mas-opciones': {
    paths: [
      { d: circle(5, 12, 1.75), fill: true },
      { d: circle(12, 12, 1.75), fill: true },
      { d: circle(19, 12, 1.75), fill: true }
    ]
  },
  // Asa del ordenable (U6): dos columnas de tres puntos.
  arrastrar: {
    paths: [6, 12, 18].flatMap((y) => [
      { d: circle(9, y, 1.25), fill: true as const },
      { d: circle(15, y, 1.25), fill: true as const }
    ])
  },
  ojo: { paths: ['M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z', circle(12, 12, 3)] },
  'ojo-tachado': {
    paths: ['M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z', circle(12, 12, 3), 'M4 4l16 16']
  },

  // ---- Flechas ----------------------------------------------------------
  'flecha-izquierda': { paths: ['M19 12H5', 'M11 6l-6 6 6 6'] },
  'flecha-derecha': { paths: ['M5 12h14', 'M13 6l6 6-6 6'] },
  'flecha-arriba': { paths: ['M12 19V5', 'M6 11l6-6 6 6'] },
  'flecha-abajo': { paths: ['M12 5v14', 'M6 13l6 6 6-6'] },
  'flecha-externa': { paths: ['M7 17 17 7', 'M9 7h8v8'] },
  'chevron-izquierda': { paths: ['M15 6l-6 6 6 6'] },
  'chevron-derecha': { paths: ['M9 6l6 6-6 6'] },
  'chevron-arriba': { paths: ['M6 15l6-6 6 6'] },
  'chevron-abajo': { paths: ['M6 9l6 6 6-6'] },

  // ---- Vistas -----------------------------------------------------------
  grilla: { paths: ['M4 4h6v6H4Z', 'M14 4h6v6h-6Z', 'M4 14h6v6H4Z', 'M14 14h6v6h-6Z'] },
  lista: { paths: ['M4 5h4v4H4Z', 'M11 7h9', 'M4 15h4v4H4Z', 'M11 17h9'] },
  // Orden de resultados (U10): una flecha hacia arriba y otra hacia abajo.
  ordenar: { paths: ['M8 19V5', 'M4 9l4-4 4 4', 'M16 5v14', 'M12 15l4 4 4-4'] },
  // Mover un crédito al otro grupo en el editor del Estudio (U16): dos flechas opuestas.
  intercambiar: { paths: ['M4 8h15', 'M15 4l4 4-4 4', 'M20 16H5', 'M9 12l-4 4 4 4'] },
  // Reiniciar filtros (U10): flecha circular.
  reiniciar: { paths: ['M4 12a8 8 0 1 0 2.4-5.7', 'M4 4v4.5h4.5'] },
  // Filtros de la barra móvil (U10b): tres deslizadores con su mando.
  filtros: {
    paths: [
      'M4 6h8', 'M16 6h4', circle(14, 6, 2),
      'M4 12h2', 'M10 12h10', circle(8, 12, 2),
      'M4 18h10', 'M18 18h2', circle(16, 18, 2)
    ]
  },

  // ---- Redes (perfil, D1) -------------------------------------------------
  bandcamp: { filled: true, paths: ['M2 18 8.5 6H22l-6.5 12H2Z'] },
  soundcloud: {
    filled: true,
    paths: [
      'M10.6 17V8.3a6 6 0 0 1 8.6 4.4 2.6 2.6 0 0 1 .9-.2 2.25 2.25 0 1 1 0 4.5H10.6Z',
      'M1.5 13.5h1.3V17H1.5Z',
      'M4 11.5h1.3V17H4Z',
      'M6.5 10h1.3v7H6.5Z',
      'M8.8 9h1.1v8H8.8Z'
    ]
  },
  instagram: {
    filled: true,
    viewBox: '0 0 288 288',
    paths: [
      'M80,0C35.9,0,0,35.9,0,80v128c0,44.1,35.9,80,80,80h128c44.1,0,80-35.9,80-80V80C288,35.9,252.1,0,208,0H80ZM80,32h128c26.5,0,48,21.5,48,48v128c0,26.5-21.5,48-48,48H80c-26.5,0-48-21.5-48-48V80c0-26.5,21.5-48,48-48ZM224,48c-8.8,0-16,7.2-16,16s7.2,16,16,16,16-7.2,16-16-7.2-16-16-16ZM144,64c-44.1,0-80,35.9-80,80s35.9,80,80,80,80-35.9,80-80-35.9-80-80-80ZM144,96c26.5,0,48,21.5,48,48s-21.5,48-48,48-48-21.5-48-48,21.5-48,48-48Z'
    ]
  },
  x: {
    filled: true,
    paths: ['M3.5 3.5h5.3l11.7 17h-5.3Z', 'M18.4 3.5h2l-7 8-1.1-1.5Z', 'M10.6 13.1l1.1 1.5-6.1 5.9h-2Z']
  },
  facebook: {
    filled: true,
    paths: [
      'M22 12a10 10 0 1 0-11.6 9.9V15H7.9v-3h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 3h-2.4v6.9A10 10 0 0 0 22 12Z'
    ]
  }
} satisfies Record<string, IconDefinition>;

export type IconName = keyof typeof ICONS;

export const ICON_NAMES = Object.keys(ICONS) as IconName[];

/** Las cinco redes del perfil (D1), en el orden del registro. */
export const SOCIAL_ICONS = ['bandcamp', 'soundcloud', 'instagram', 'x', 'facebook'] as const satisfies readonly IconName[];
