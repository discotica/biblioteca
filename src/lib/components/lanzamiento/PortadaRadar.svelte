<script lang="ts">
  // Portada de la tarjeta con el radar del lanzamiento (U8).
  //
  // - Con cursor (hover: hover): el radar aparece al pasar sobre la portada y
  //   un clic abre la ficha, como siempre.
  // - Con el dedo: el primer toque muestra el radar y el segundo abre la ficha.
  //   Tocar fuera de la portada (otra portada, la página) lo oculta. Deslizar
  //   no es un toque: el navegador no emite clic y la página se desplaza.
  //
  // La portada repite el enlace del título, así que queda fuera del orden de
  // tabulación y del árbol de accesibilidad: con teclado o lector de pantalla se
  // abre desde el título, en un solo paso. El radar es decorativo (aria-hidden).
  import { Cover } from '$lib/ui';
  import RadarMini from '$lib/components/RadarMini.svelte';
  import type { Release } from '$lib/domain/releases';
  import { isModifiedClick } from './lanzamiento';

  type Props = {
    href: string;
    cover: string;
    radar: Release['radar'];
    /** Abre la ficha (modal). Sin él, el enlace navega a la página. */
    onopen?: () => void;
    /** Fondo ambiental desenfocado en el anfitrión (la tarjeta). */
    ambient?: boolean;
    class?: string;
  };

  let { href, cover, radar, onopen, ambient = false, class: className = '' }: Props = $props();

  let root = $state<HTMLElement>();
  /** Radar visible por un toque (con cursor lo controla :hover). */
  let touchRadar = $state(false);
  /** Tipo de puntero del último pointerdown; el clic de teclado no tiene. */
  let pointerType = '';

  function onpointerdown(event: PointerEvent) {
    pointerType = event.pointerType;
  }

  function onclick(event: MouseEvent) {
    const touch = pointerType === 'touch';
    pointerType = '';
    if (touch && !touchRadar) {
      event.preventDefault();
      touchRadar = true;
      return;
    }
    touchRadar = false;
    if (!onopen || isModifiedClick(event)) return;
    event.preventDefault();
    onopen();
  }

  // Un toque fuera de esta portada oculta su radar. En captura, para enterarse
  // antes de que otra portada procese su propio toque.
  $effect(() => {
    if (!touchRadar) return;
    const dismiss = (event: PointerEvent) => {
      if (!root?.contains(event.target as Node)) touchRadar = false;
    };
    document.addEventListener('pointerdown', dismiss, true);
    return () => document.removeEventListener('pointerdown', dismiss, true);
  });
</script>

<div bind:this={root} class="portada {className}" class:portada--radar={touchRadar} data-radar={touchRadar ? 'visible' : undefined}>
  <a class="portada__enlace" {href} tabindex="-1" aria-hidden="true" draggable="false" {onpointerdown} {onclick}>
    <Cover src={cover} alt="" {ambient} />
  </a>
  <div class="portada__velo" aria-hidden="true"></div>
  <div class="portada__radar" aria-hidden="true">
    <div class="portada__radar-escala"><RadarMini valores={radar} /></div>
  </div>
</div>

<style>
  /* Las capas se apilan en la misma celda de grid, sin posicionar la portada ni
     su enlace: así el fondo ambiental de Cover (absoluto) sube hasta el
     anfitrión, la tarjeta, que es quien lo recorta. La imagen se recorta en
     .ui-cover, que tiene su propio overflow. */
  .portada {
    display: grid;
    -webkit-tap-highlight-color: transparent;
  }
  .portada > * { grid-area: 1 / 1; }

  .portada__enlace {
    display: block;
    /* Sin menú de "abrir enlace" ni vista previa al mantener el dedo: el gesto es del radar. */
    -webkit-touch-callout: none;
  }

  .portada :global(.ui-cover__image) {
    transition: transform var(--motion-slow) var(--ease-emphasized), opacity var(--motion-slow) var(--ease-standard);
  }

  /* position: relative para pintarse sobre .ui-cover (que está posicionada). */
  .portada__velo,
  .portada__radar {
    position: relative;
    pointer-events: none;
  }
  .portada__velo {
    background: transparent;
    transition: background var(--motion-slow) var(--ease-standard);
  }
  .portada__radar {
    display: grid;
    place-items: center;
    opacity: 0;
    transition: opacity var(--motion-slow) var(--ease-standard);
  }
  .portada__radar :global(*) { pointer-events: none; }
  .portada__radar-escala { transform: scale(1.6); }

  /* Radar visible: cursor encima (solo con puntero fino) o primer toque. */
  .portada--radar :global(.ui-cover__image) { transform: scale(1.05); opacity: .18; }
  .portada--radar .portada__velo { background: var(--color-sombra-fuerte); }
  .portada--radar .portada__radar { opacity: 1; }
  @media (hover: hover) {
    .portada:hover :global(.ui-cover__image) { transform: scale(1.05); opacity: .18; }
    .portada:hover .portada__velo { background: var(--color-sombra-fuerte); }
    .portada:hover .portada__radar { opacity: 1; }
  }

  @media (prefers-reduced-motion: reduce) {
    .portada :global(.ui-cover__image),
    .portada__velo,
    .portada__radar { transition: none; }
  }
</style>
