// Reducción de la franja de entrada del inicio (U29b, tablero D «Reducida»).
//
// Tras el primer scroll hacia abajo la franja grande (bienvenida o nota beta)
// pasa a la banda de --franja-h-reducida. Este módulo solo LEE el scroll y
// anima una forma que ya está aplicada en el DOM:
//  - `observarPrimerScroll` avisa una vez, al pasar el umbral bajando. Nunca
//    escribe el scroll (ni scrollTo ni scrollBy): ni la URL, ni el historial,
//    ni la paginación tienen parte aquí.
//  - `medirFranja` y `animarReduccion` hacen un FLIP con WAAPI. La forma final
//    (clases y estado) la pone la página y se mide ya aplicada; después se
//    anima desde la caja anterior hasta ella. Cancelar las animaciones deja el
//    DOM exactamente en la forma final, sin esperar a nada.
//
// Sin saltos: la grilla de resultados arranca la animación donde estaba (la
// altura y el margen inferior de la franja empiezan en valores que compensan lo
// que el buscador ocupa de más en la banda) y termina donde la deja el CSS. El
// campo de pulso conserva su tamaño: lo que se anima es la caja que lo recorta,
// así que no hay remuestreo del lienzo cuadro a cuadro.

import { MOBILE_QUERY } from './breakpoints.ts';

/** Píxeles de scroll hacia abajo a partir de los cuales la franja se reduce. */
export const FRANJA_UMBRAL_SCROLL = 48;

export const esMovil = (): boolean => window.matchMedia(MOBILE_QUERY).matches;
export const movimientoReducido = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export interface ObservarPrimerScrollOptions {
  /** Devuelve false si ahora no toca reducir (p. ej. en móvil): el observador sigue armado. */
  alReducir: (y: number) => boolean | void;
}

/**
 * Observa el scroll; avisa una sola vez y se desarma. Devuelve la función que lo suelta.
 * Con un botón del puntero pulsado no avisa: cambiar el layout entre pulsar y
 * soltar mueve el destino del clic (un scroll que acaba de llevar el botón a
 * la vista, y la persona o la prueba que lo pulsa en ese mismo cuadro). Avisa
 * al soltar, ya sin cambios en el layout que importen para ese clic.
 */
export function observarPrimerScroll({ alReducir }: ObservarPrimerScrollOptions): () => void {
  let ultimo = window.scrollY;
  let armado = true;
  let pulsado = false;
  let aplazado = false;
  let cuadro = 0;
  const soltar = () => {
    armado = false;
    window.cancelAnimationFrame(cuadro);
    window.removeEventListener('scroll', alScroll);
    window.removeEventListener('pointerdown', alPulsar, true);
    window.removeEventListener('pointerup', alSoltar, true);
    window.removeEventListener('pointercancel', alSoltar, true);
  };
  const intentar = (y: number) => {
    if (alReducir(y) !== false) soltar();
  };
  function alPulsar() { pulsado = true; }
  function alSoltar() {
    pulsado = false;
    if (!aplazado || !armado) return;
    aplazado = false;
    cuadro = window.requestAnimationFrame(() => { if (armado && window.scrollY >= FRANJA_UMBRAL_SCROLL) intentar(window.scrollY); });
  }
  function alScroll() {
    const y = Math.max(0, window.scrollY);
    const bajando = y > ultimo;
    ultimo = y;
    if (!armado || !bajando || y < FRANJA_UMBRAL_SCROLL) return;
    if (pulsado) { aplazado = true; return; }
    intentar(y);
  }
  window.addEventListener('scroll', alScroll, { passive: true });
  window.addEventListener('pointerdown', alPulsar, true);
  window.addEventListener('pointerup', alSoltar, true);
  window.addEventListener('pointercancel', alSoltar, true);
  // Una página que arranca ya desplazada (restaurada) no emite un primer scroll.
  if (window.scrollY >= FRANJA_UMBRAL_SCROLL) intentar(window.scrollY);
  return soltar;
}

/**
 * Ejecuta `accion` cuando el scroll lleva `reposo` ms sin moverse. Para cambios
 * de layout que no se ven (la franja ya fuera de la vista): hacerlos en mitad
 * de un salto de scroll (End, arrastrar la barra, un clic que acaba de
 * desplazar la página) mueve lo que la persona está a punto de pulsar.
 * Devuelve la función que lo cancela.
 */
export function alAsentarseElScroll(accion: () => void, reposo = 150): () => void {
  let temporizador = 0;
  const cancelar = () => {
    window.clearTimeout(temporizador);
    window.removeEventListener('scroll', rearmar);
  };
  function rearmar() {
    window.clearTimeout(temporizador);
    temporizador = window.setTimeout(() => { cancelar(); accion(); }, reposo);
  }
  window.addEventListener('scroll', rearmar, { passive: true });
  rearmar();
  return cancelar;
}

export interface RefsFranja {
  /** `.franja`: la caja que se reduce. */
  franja: HTMLElement;
  /** `.franja__campo`: el lienzo; se congela a su alto para no remuestrearlo. */
  campo: HTMLElement | null;
  /** `.home-search__row`: la fila del buscador, que sube con la franja. */
  fila: HTMLElement | null;
  /** `.home-search__field`: el campo de texto, que se estrecha y se desplaza. */
  entrada: HTMLElement | null;
  /** La grilla de resultados: su posición es la que no puede saltar. */
  grilla: HTMLElement | null;
}

interface Punto { x: number; y: number; w: number }
export interface MedidasFranja { alto: number; fila: Punto | null; entrada: Punto | null; grilla: Punto | null }

// Coordenadas de documento: no cambian con el scroll, así que son comparables
// antes y después de que el navegador ajuste (o no) la posición.
function punto(el: HTMLElement | null): Punto | null {
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  return { x: rect.left + window.scrollX, y: rect.top + window.scrollY, w: rect.width };
}

/** Lee las cajas de partida. Debe llamarse ANTES de aplicar la forma reducida. */
export function medirFranja(refs: RefsFranja): MedidasFranja {
  return { alto: refs.franja.getBoundingClientRect().height, fila: punto(refs.fila), entrada: punto(refs.entrada), grilla: punto(refs.grilla) };
}

/** Duración y curva de --motion-slow y --ease-expressive (WAAPI no admite var()). */
function ritmo(): { duration: number; easing: string } {
  const estilos = getComputedStyle(document.documentElement);
  const ms = parseFloat(estilos.getPropertyValue('--motion-slow'));
  const curva = estilos.getPropertyValue('--ease-expressive').trim();
  return { duration: Number.isFinite(ms) && ms > 0 ? ms : 320, easing: curva || 'ease-out' };
}

/** Una transición en curso: `terminar` la cancela y deja el DOM en la forma final. */
export interface TransicionFranja { terminar: () => void }

type Cuadro = Record<string, string | number>;

/**
 * Anima `el` desde `cuadros[0]`. Esos mismos valores de partida se dejan en
 * línea hasta que la animación acaba o se cancela: una animación recién creada
 * aún no ha empezado a aplicarse, y sin ellos un cuadro podría leerse o
 * pintarse con la forma final antes del primer fotograma.
 */
function animar(el: HTMLElement, cuadros: [Cuadro, Cuadro], opciones: KeyframeAnimationOptions, limpiezas: Array<() => void>): Animation {
  const propiedades = Object.keys(cuadros[0]).filter((nombre) => nombre !== 'offset');
  const estilo = el.style as unknown as Record<string, string>;
  for (const nombre of propiedades) estilo[nombre] = String(cuadros[0][nombre]);
  const limpiar = () => { for (const nombre of propiedades) estilo[nombre] = ''; };
  const animacion = el.animate(cuadros, opciones);
  animacion.addEventListener('finish', limpiar);
  animacion.addEventListener('cancel', limpiar);
  limpiezas.push(limpiar);
  return animacion;
}

/**
 * Anima la reducción hacia la forma final, que ya está aplicada en el DOM.
 * Devuelve la transición para poder terminarla en seco (terminar = forma final).
 */
export function animarReduccion(refs: RefsFranja, antes: MedidasFranja): TransicionFranja {
  const { franja, campo, fila, entrada, grilla } = refs;
  const ritmoBase = ritmo();
  const animaciones: Animation[] = [];
  const limpiezas: Array<() => void> = [];
  const despuesAlto = franja.getBoundingClientRect().height;
  const despuesGrilla = punto(grilla);
  const despuesFila = punto(fila);
  const despuesEntrada = punto(entrada);
  const margenFinal = parseFloat(getComputedStyle(franja).marginBottom) || 0;

  // El lienzo se queda con su alto de partida: lo único que se anima es la caja
  // que lo recorta. Sin esto el ResizeObserver lo remuestrearía en cada cuadro.
  if (campo) campo.style.height = `${antes.alto}px`;

  // Posición de la grilla al empezar = la de antes: la altura y el margen
  // inferior de partida absorben lo que el buscador ocupa de más en la banda.
  const desvio = antes.grilla && despuesGrilla ? antes.grilla.y - despuesGrilla.y : 0;
  const margenInicial = margenFinal + desvio - (antes.alto - despuesAlto);
  animaciones.push(
    animar(
      franja,
      [
        { height: `${antes.alto}px`, marginBottom: `${margenInicial}px` },
        { height: `${despuesAlto}px`, marginBottom: `${margenFinal}px` }
      ],
      ritmoBase,
      limpiezas
    )
  );

  // El texto que se va (bienvenida o nota) se desvanece en la primera mitad.
  // En la forma final está oculto (visibility): se fuerza visible mientras dura
  // y, al acabar, vuelve a quedar oculto por el CSS.
  for (const hijo of Array.from(franja.children)) {
    if (hijo === campo) continue;
    animaciones.push(
      animar(
        hijo as HTMLElement,
        [{ opacity: 1, visibility: 'visible' }, { opacity: 0, visibility: 'visible' }],
        { duration: ritmoBase.duration * 0.5, easing: 'linear' },
        limpiezas
      )
    );
  }

  // El título de la banda aparece en la fila del buscador mientras el texto se va.
  const titulo = fila?.querySelector<HTMLElement>('.home-search__titulo');
  if (titulo) animaciones.push(animar(titulo, [{ opacity: 0 }, { opacity: 1 }], { ...ritmoBase, easing: 'linear' }, limpiezas));

  // La fila del buscador parte donde estaba y el campo conserva su sitio y su
  // ancho hasta encajar en la banda (título a la izquierda, 420).
  if (fila && antes.fila && despuesFila && despuesGrilla) {
    const dyFila = antes.fila.y - (despuesFila.y + desvio);
    animaciones.push(animar(fila, [{ transform: `translateY(${dyFila}px)` }, { transform: 'none' }], ritmoBase, limpiezas));
    if (entrada && antes.entrada && despuesEntrada) {
      const dx = antes.entrada.x - despuesEntrada.x;
      const dy = (antes.entrada.y - antes.fila.y) - (despuesEntrada.y - despuesFila.y);
      animaciones.push(
        animar(
          entrada,
          [
            { transform: `translate(${dx}px, ${dy}px)`, flexBasis: `${antes.entrada.w}px`, maxWidth: `${antes.entrada.w}px` },
            { transform: 'none', flexBasis: `${despuesEntrada.w}px`, maxWidth: `${despuesEntrada.w}px` }
          ],
          ritmoBase,
          limpiezas
        )
      );
    }
  }
  return {
    terminar() {
      for (const animacion of animaciones) animacion.cancel();
      for (const limpiar of limpiezas) limpiar();
    }
  };
}
