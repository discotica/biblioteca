<script lang="ts">
  // Franja de entrada del inicio (U29, tablero D): el campo de pulso a todo el
  // ancho bajo el cabecero, con una sola instancia en la página. Dos formas,
  // sin cambiar de elemento (el campo no se remonta):
  //  - bienvenida / beta: el campo ocupa el hueco de texto (FranjaCabeza) y el
  //    buscador va debajo, en el flujo;
  //  - reducida: una banda de --franja-h-reducida sobre la que el buscador se
  //    superpone (margen negativo). Solo en desktop: en móvil la barra sticky
  //    y la hoja siguen siendo la búsqueda y no hay banda.
  // U29b: tras el primer scroll (solo desktop) la franja con texto pasa a la
  // forma reducida SIN cerrar nada: el texto queda montado pero oculto
  // (visibility), con su estado, su sesión y la URL intactos. Quién y cuándo la
  // reduce lo decide la página (franjaReduccion.ts); aquí solo hay estilo.
  // El estado de la franja lo decide la página (qué hueco de texto hay); aquí no
  // hay lógica de scroll ni de URL.
  import { onMount, type Snippet } from 'svelte';
  import { CampoPulso } from '$lib/generative';
  import { MOBILE_QUERY } from '$lib/ui/breakpoints';

  type Props = {
    modo: 'bienvenida' | 'beta' | 'reducida';
    /** Reducida por scroll: la forma de `reducida` aunque `modo` tenga texto (solo desktop). */
    reducir?: boolean;
    /** La caja `.franja` y el lienzo, para que la página anime la reducción. */
    el?: HTMLElement | null;
    campo?: HTMLElement | null;
    children?: Snippet;
  };

  let { modo, reducir = false, el = $bindable(null), campo = $bindable(null), children }: Props = $props();

  // En móvil la banda reducida no existe: ahí el campo no se monta (ni canvas ni
  // observadores ni worker para algo que no se ve).
  let movil = $state(window.matchMedia(MOBILE_QUERY).matches);
  onMount(() => {
    const consulta = window.matchMedia(MOBILE_QUERY);
    const alCambiar = () => (movil = consulta.matches);
    consulta.addEventListener('change', alCambiar);
    return () => consulta.removeEventListener('change', alCambiar);
  });
  // En móvil nunca hay banda reducida: una reducción por scroll no cuenta allí.
  const forma = $derived(reducir && !movil ? 'reducida' : modo);
  const conCampo = $derived(!(movil && forma === 'reducida'));
</script>

<div class="franja franja--{forma}" data-franja={forma} data-franja-modo={modo} bind:this={el}>
  <div class="franja__campo" aria-hidden="true" bind:this={campo}>{#if conCampo}<CampoPulso />{/if}</div>
  {#if children}{@render children()}{/if}
</div>

<style>
  .franja {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    align-items: start;
    min-height: var(--franja-h);
    overflow: hidden;
  }
  /* El campo y el texto comparten la celda: el campo detrás y a toda su altura. */
  .franja > :global(*) { grid-area: 1 / 1; }
  .franja__campo { position: relative; z-index: 0; align-self: stretch; min-height: 0; }

  /* Reducida: la banda no ocupa sitio; el buscador la cubre y la abre su panel
     sin estirar el campo. */
  .franja--reducida {
    min-height: var(--franja-h-reducida);
    height: var(--franja-h-reducida);
    margin-bottom: calc(var(--franja-h-reducida) * -1);
  }
  /* El texto de la bienvenida o la nota deja su sitio sin cerrarse: oculto y
     fuera del árbol de accesibilidad y del tabulador, pero montado. */
  .franja--reducida > :global(:not(.franja__campo)) { visibility: hidden; pointer-events: none; }

  @media (max-width: 768px) {
    .franja { min-height: 0; }
    .franja--reducida { display: none; }
  }
</style>
