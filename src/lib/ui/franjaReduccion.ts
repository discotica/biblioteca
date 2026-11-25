// Reducción de la franja de entrada del inicio (U29b, tablero D «Reducida»).
//
// Al bajar más allá del umbral la franja grande (bienvenida o nota beta) pasa a
// la banda de --franja-h-reducida; al volver al tope de la página se expande
// otra vez. Este módulo solo LEE el scroll y anima una forma que ya está
// aplicada en el DOM:
//  - `observarScrollFranja` avisa al pasar el umbral bajando y al llegar al
//    tope. Nunca escribe el scroll (ni scrollTo ni scrollBy): ni la URL, ni el
//    historial, ni la paginación tienen parte aquí.
//  - `medirFranja` y `animarFranja` hacen un FLIP con WAAPI. La forma final
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

export interface ObservarScrollFranjaOptions {
  /** Bajando, pasado el umbral. La página ignora el aviso si ya está reducida. */
  alReducir: (y: number) => void;
  /** De vuelta en el tope (scroll 0). La página lo ignora si no está reducida. */
  alExpandir: () => void;
}

/**
 * Observa el scroll mientras la página viva. Devuelve la función que lo suelta.
 * Con un botón del puntero pulsado no avisa: cambiar el layout entre pulsar y
 * soltar mueve el destino del clic (un scroll que acaba de llevar el botón a
 * la vista, y la persona o la prueba que lo pulsa en ese mismo cuadro). Avisa
 * al soltar, ya sin cambios en el layout que importen para ese clic.
 */
export function observarScrollFranja({ alReducir, alExpandir }: ObservarScrollFranjaOptions): () => void {
  let ultimo = Math.max(0, window.scrollY);
  let pulsado = false;
  let aplazado = false;
  let cuadro = 0;
  const soltar = () => {
    window.cancelAnimationFrame(cuadro);
    window.removeEventListener('scroll', alScroll);
    window.removeEventListener('pointerdown', alPulsar, true);
    window.removeEventListener('pointerup', alSoltar, true);
    window.removeEventListener('pointercancel', alSoltar, true);
  };
  function alPulsar() { pulsado = true; }
  function alSoltar() {
    pulsado = false;
    if (!aplazado) return;
    aplazado = false;
    cuadro = window.requestAnimationFrame(() => {
      const y = Math.max(0, window.scrollY);
      if (y <= 0) alExpandir();
      else if (y >= FRANJA_UMBRAL_SCROLL) alReducir(y);
    });
  }
  function alScroll() {
    const y = Math.max(0, window.scrollY);
    const bajando = y > ultimo;
    ultimo = y;
    const enTope = y <= 0;
    if (!enTope && !(bajando && y >= FRANJA_UMBRAL_SCROLL)) return;
    if (pulsado) { aplazado = true; return; }
    if (enTope) alExpandir();
    else alReducir(y);
  }
  window.addEventListener('scroll', alScroll, { passive: true });
  window.addEventListener('pointerdown', alPulsar, true);
  window.addEventListener('pointerup', alSoltar, true);
  window.addEventListener('pointercancel', alSoltar, true);
  // Una página que arranca ya desplazada (restaurada) no emite un primer scroll.
  if (window.scrollY >= FRANJA_UMBRAL_SCROLL) alReducir(window.scrollY);
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
function animar(el: HTMLElement, cuadros: [Cuadro, ...Cuadro[]], opciones: KeyframeAnimationOptions, limpiezas: Array<() => void>): Animation {
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
 * Anima la reducción (o la expansión de vuelta) hacia la forma final, que ya
 * está aplicada en el DOM. Devuelve la transición para poder terminarla en
 * seco (terminar = forma final).
 */
export function animarFranja(
  refs: RefsFranja,
  antes: MedidasFranja,
  direccion: 'reducir' | 'expandir' = 'reducir'
): TransicionFranja {
  const expandir = direccion === 'expandir';
  const { franja, campo, fila, entrada, grilla } = refs;
  const ritmoBase = ritmo();
  const animaciones: Animation[] = [];
  const limpiezas: Array<() => void> = [];
  // La transición CSS de max-width del campo arrancaría con el cambio de clase
  // y la medida de abajo leería su valor de partida (420 al expandir): la
  // animación acabaría ahí y el campo saltaría a 560 al terminar. La anima el
  // FLIP; la transición queda fuera mientras dura.
  const soltarTransicion = () => { if (entrada) entrada.style.transition = ''; };
  if (entrada) {
    entrada.style.transition = 'none';
    limpiezas.push(soltarTransicion);
  }
  const despuesAlto = franja.getBoundingClientRect().height;
  const despuesGrilla = punto(grilla);
  const despuesFila = punto(fila);
  const despuesEntrada = punto(entrada);
  const margenFinal = parseFloat(getComputedStyle(franja).marginBottom) || 0;

  // El lienzo se queda con el alto mayor de los dos: lo único que se anima es la
  // caja que lo recorta. Sin esto el ResizeObserver lo remuestrearía en cada
  // cuadro. Al reducir se queda así (recortado por la banda); al expandir lo
  // suelta al acabar, para que vuelva a estirarse con el texto.
  const soltarCampo = () => { if (campo) campo.style.height = ''; };
  if (campo) {
    campo.style.height = `${Math.max(antes.alto, despuesAlto)}px`;
    if (expandir) limpiezas.push(soltarCampo);
  }

  // Posición de la grilla al empezar = la de antes: la altura y el margen
  // inferior de partida absorben lo que el buscador ocupa de más en la banda.
  const desvio = antes.grilla && despuesGrilla ? antes.grilla.y - despuesGrilla.y : 0;
  const margenInicial = margenFinal + desvio - (antes.alto - despuesAlto);
  animaciones.push(
    animar(
      franja,
      [
        // min-height acompaña a height: la forma con texto tiene un mínimo de
        // --franja-h que, si no, fijaba el alto final desde el primer cuadro al
        // expandir (la franja saltaba entera y empujaba buscador y grilla).
        { height: `${antes.alto}px`, minHeight: `${antes.alto}px`, marginBottom: `${margenInicial}px` },
        { height: `${despuesAlto}px`, minHeight: `${despuesAlto}px`, marginBottom: `${margenFinal}px` }
      ],
      ritmoBase,
      limpiezas
    )
  );
  animaciones[0].addEventListener('finish', soltarTransicion);
  if (expandir) {
    animaciones[0].addEventListener('finish', soltarCampo);
    animaciones[0].addEventListener('cancel', soltarCampo);
  }

  // Al reducir, el texto (bienvenida o nota) se desvanece en la primera mitad:
  // en la forma final está oculto (visibility), así que se fuerza visible
  // mientras dura y, al acabar, vuelve a quedar oculto por el CSS. Al expandir
  // aparece en la segunda mitad, cuando la caja ya le ha hecho sitio.
  for (const hijo of Array.from(franja.children)) {
    if (hijo === campo) continue;
    animaciones.push(
      animar(
        hijo as HTMLElement,
        expandir
          ? [{ opacity: 0, visibility: 'visible' }, { opacity: 0, visibility: 'visible', offset: 0.5 }, { opacity: 1, visibility: 'visible' }]
          : [{ opacity: 1, visibility: 'visible' }, { opacity: 0, visibility: 'visible' }],
        expandir ? { ...ritmoBase, easing: 'linear' } : { duration: ritmoBase.duration * 0.5, easing: 'linear' },
        limpiezas
      )
    );
  }

  // El título de la banda aparece en la fila del buscador mientras el texto se
  // va. Al expandir ya no está en el DOM: no hay nada que desvanecer.
  const titulo = fila?.querySelector<HTMLElement>('.home-search__titulo');
  if (titulo && !expandir) animaciones.push(animar(titulo, [{ opacity: 0 }, { opacity: 1 }], { ...ritmoBase, easing: 'linear' }, limpiezas));

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
