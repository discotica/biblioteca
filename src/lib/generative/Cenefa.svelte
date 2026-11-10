<script lang="ts">
  import { onDestroy, untrack, type Snippet } from 'svelte';
  import { huella, type Rol } from './huella.ts';

  type Props = {
    /** Nombre que siembra la huella: usuario, colección, artista o sello. */
    nombre: string;
    rol?: Rol;
    /**
     * Portada más reciente. Con ella, la superficie es la portada desenfocada,
     * troquelada por los puntos. Sin ella, la huella con el color del rol.
     */
    portada?: string | null;
    /** Alto en px. */
    alto?: number;
    /** Paso de la rejilla en px CSS (24 en el lienzo a 2×). */
    paso?: number;
    /** Velo vertical de lectura (0,66 → 0,46). */
    velo?: boolean;
    /**
     * Zona derecha atenuada al 72 %, detrás de la columna de datos. Fracción del
     * ancho donde empieza (p. ej. 0.62); `null` la quita.
     */
    zonaDerecha?: number | null;
    class?: string;
    children?: Snippet;
  };

  let { nombre, rol = 'usuario', portada = null, alto = 400, paso = 12, velo = true, zonaDerecha = null, class: className = '', children }: Props = $props();

  /** La huella se dibuja siempre a 2×: el DPR máximo del motor. */
  const ESCALA = 2;

  let ancho = $state(0);
  let lienzo = $state<HTMLCanvasElement>();
  let mascara = $state('');

  // Sin portada: la huella con su color, en un canvas propio.
  $effect(() => {
    if (portada || !lienzo || !ancho) return;
    const w = Math.round(ancho * ESCALA), h = Math.round(alto * ESCALA);
    const ctx = lienzo.getContext('2d');
    if (!ctx) return;
    lienzo.width = w;
    lienzo.height = h;
    huella(ctx, w, h, { nombre, rol, paso: paso * ESCALA });
  });

  // Con portada: máscara de puntos blancos en un canvas que nunca toca la
  // portada, servida como blob a `mask-image`. Se regenera tras un respiro al
  // cambiar de tamaño.
  $effect(() => {
    if (!portada || !ancho) return;
    const w = Math.round(ancho * ESCALA), h = Math.round(alto * ESCALA);
    const op = { nombre, rol, paso: paso * ESCALA, mascara: true };
    let vigente = true;
    const espera = setTimeout(
      () => {
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        huella(ctx, w, h, op);
        canvas.toBlob((blob) => {
          if (!blob || !vigente) return;
          // La máscara anterior se suelta solo cuando la nueva ya está puesta.
          const anterior = untrack(() => mascara);
          mascara = URL.createObjectURL(blob);
          if (anterior) URL.revokeObjectURL(anterior);
        });
      },
      untrack(() => mascara) ? 120 : 0
    );
    return () => {
      vigente = false;
      clearTimeout(espera);
    };
  });

  // Sin portada o al desmontar, la máscara deja de servir.
  $effect(() => {
    if (portada) return;
    const anterior = untrack(() => mascara);
    if (anterior) {
      URL.revokeObjectURL(anterior);
      mascara = '';
    }
  });
  onDestroy(() => {
    if (mascara) URL.revokeObjectURL(mascara);
  });
</script>

<!--
  Cenefa (U27, §4). Con portada: <img> con filtro CSS bajo una máscara de
  puntos; la portada nunca entra en un canvas (las de otro dominio lo
  contaminarían) ni se lee con getImageData. Sin portada: la huella del rol.
-->
<div class="ui-cenefa {className}" style:height="{alto}px" bind:clientWidth={ancho}>
  {#if portada}
    <div class="ui-cenefa__superficie" class:ui-cenefa__superficie--lista={mascara} style:--mascara={mascara ? `url(${mascara})` : 'none'} aria-hidden="true">
      <img class="ui-cenefa__portada" src={portada} alt="" decoding="async" />
    </div>
  {:else}
    <canvas class="ui-cenefa__huella" bind:this={lienzo} aria-hidden="true"></canvas>
  {/if}
  {#if velo}<div class="ui-cenefa__velo" aria-hidden="true"></div>{/if}
  {#if zonaDerecha != null}<div class="ui-cenefa__zona" style:left="{zonaDerecha * 100}%" aria-hidden="true"></div>{/if}
  {#if children}<div class="ui-cenefa__contenido">{@render children()}</div>{/if}
</div>

<style>
  .ui-cenefa {
    position: relative;
    overflow: hidden;
    isolation: isolate;
    background: var(--color-fondo);
  }

  .ui-cenefa__huella,
  .ui-cenefa__superficie,
  .ui-cenefa__velo,
  .ui-cenefa__zona {
    position: absolute;
    inset: 0;
  }

  .ui-cenefa__huella {
    display: block;
    width: 100%;
    height: 100%;
  }

  /* Hasta tener la máscara, la superficie no se ve: nunca aparece la portada entera. */
  .ui-cenefa__superficie {
    overflow: hidden;
    visibility: hidden;
    -webkit-mask: var(--mascara) 0 0 / 100% 100% no-repeat;
    mask: var(--mascara) 0 0 / 100% 100% no-repeat;
  }

  .ui-cenefa__superficie--lista {
    visibility: visible;
  }

  /* Desenfocada al máximo, más saturada y más clara. La escala tapa el borde
     transparente que deja el desenfoque. */
  .ui-cenefa__portada {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    transform: scale(1.3);
    filter: blur(48px) saturate(1.3) brightness(1.4);
  }

  .ui-cenefa__velo {
    background: linear-gradient(to bottom, var(--color-velo-cenefa-arriba), var(--color-velo-cenefa-abajo));
  }

  .ui-cenefa__zona {
    left: auto;
    background: linear-gradient(to right, transparent, var(--color-velo-cenefa-zona) var(--space-7));
  }

  .ui-cenefa__contenido {
    position: relative;
    height: 100%;
  }
</style>
