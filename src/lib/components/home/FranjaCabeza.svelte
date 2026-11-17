<script lang="ts">
  // Hueco de texto de la franja de entrada (U29, tablero D): lo comparten la
  // bienvenida y la nota beta. Título 102/92, texto y, si hace falta, los
  // enlaces de la nota. No es modal: vive en el flujo, sobre el campo de pulso,
  // y su cierre es el de quien lo monta (la bienvenida o la invitación beta).
  import type { Snippet } from 'svelte';
  import IconButton from '$lib/ui/IconButton.svelte';

  type Props = {
    /** id del título: lo referencia aria-labelledby. */
    id: string;
    titulo: string;
    texto: string;
    closeLabel: string;
    onclose?: () => void;
    /** Enlaces u otra línea bajo el texto. */
    children?: Snippet;
    [attribute: string]: unknown;
  };

  let { id, titulo, texto, closeLabel, onclose, children, ...rest }: Props = $props();
</script>

<section class="franja-cabeza l-container l-container--wide" aria-labelledby={id} {...rest}>
  <h1 class="franja-cabeza__titulo" {id}>{titulo}</h1>
  <p class="franja-cabeza__texto">{texto}</p>
  {#if children}<div class="franja-cabeza__extra">{@render children()}</div>{/if}

  <IconButton
    class="franja-cabeza__cerrar"
    icon="cerrar"
    label={closeLabel}
    tooltip="bottom"
    tooltipAlign="end"
    onclick={() => onclose?.()}
  />
</section>

<style>
  .franja-cabeza {
    position: relative;
    z-index: var(--layer-raised);
    padding-top: var(--franja-pad-top);
    padding-bottom: var(--space-7);
    /* La columna de texto no llega al cierre. */
    padding-right: calc(var(--container-gutter) + var(--target-touch) + var(--space-3));
  }

  .franja-cabeza__titulo {
    max-width: var(--franja-titulo-medida);
    margin: 0;
    color: var(--color-texto);
    font-size: var(--text-franja);
    font-weight: 700;
    letter-spacing: -0.035em;
    line-height: var(--text-franja-lh);
    overflow-wrap: anywhere;
  }

  .franja-cabeza__texto {
    max-width: var(--franja-texto-medida);
    margin: calc(var(--space-5) + var(--space-1)) 0 0;
    color: var(--color-texto-alto);
    font-size: var(--text-xl);
    line-height: 1.4;
  }

  .franja-cabeza__extra {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2) var(--space-5);
    margin-top: var(--space-4);
  }
  .franja-cabeza__extra :global(a) {
    color: var(--color-acento);
    font-size: var(--text-md);
    font-weight: 600;
    overflow-wrap: anywhere;
  }
  .franja-cabeza__extra :global(p) { margin: 0; color: var(--color-acento); font-size: var(--text-sm); }

  .franja-cabeza :global(.franja-cabeza__cerrar) {
    position: absolute;
    top: var(--space-5);
    right: var(--container-gutter);
  }

  @media (max-width: 768px) {
    .franja-cabeza {
      padding-top: var(--space-7);
      padding-bottom: var(--space-6);
      padding-right: var(--container-gutter);
    }
    .franja-cabeza__titulo { font-size: var(--text-franja-m); line-height: var(--text-franja-m-lh); }
    .franja-cabeza__texto { margin-top: var(--space-4); font-size: var(--text-md); line-height: 1.5; }
    /* El título empieza bajo el cierre. */
    .franja-cabeza :global(.franja-cabeza__cerrar) { top: var(--space-2); }
    .franja-cabeza__titulo { margin-top: var(--space-5); }
  }
</style>
