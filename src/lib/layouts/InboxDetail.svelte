<script lang="ts">
  import type { Snippet } from 'svelte';

  type Props = {
    /** h2 del detalle. Recibe el foco al abrir el elemento en móvil. */
    title: string;
    /** Línea sobre el título: estado, cola, categoría. */
    eyebrow?: Snippet;
    /** Línea bajo el título: fecha, fuente, enlaces. */
    meta?: Snippet;
    children: Snippet;
    /** Pie con las acciones del elemento (notas y botones). */
    actions?: Snippet;
    /** El título, para devolverle el foco. */
    heading?: HTMLHeadingElement;
    class?: string;
    [attribute: string]: unknown;
  };

  let { title, eyebrow, meta, children, actions, heading = $bindable(), class: className = '', ...rest }: Props = $props();
</script>

<!--
  Detalle de la bandeja del Estudio (U17). Los datos van en <dl class="l-inbox-fields">
  con InboxField; las notas en .l-inbox-note.
-->
<article class="l-inbox-detail {className}" aria-label={title} {...rest}>
  <header class="l-inbox-detail__head">
    {#if eyebrow}<div class="l-inbox-detail__eyebrow">{@render eyebrow()}</div>{/if}
    <h2 class="l-inbox-detail__title" tabindex="-1" bind:this={heading}>{title}</h2>
    {#if meta}<div class="l-inbox-detail__meta">{@render meta()}</div>{/if}
  </header>
  <div class="l-inbox-detail__body">{@render children()}</div>
  {#if actions}<footer class="l-inbox-detail__actions">{@render actions()}</footer>{/if}
</article>

<style>
  .l-inbox-detail {
    container-type: inline-size;
    min-width: 0;
    box-sizing: border-box;
    border: 1px solid var(--color-linea);
    border-radius: var(--radius-base);
    background: var(--color-superficie-1);
  }

  .l-inbox-detail__head,
  .l-inbox-detail__body,
  .l-inbox-detail__actions { padding: var(--density-pad); }

  .l-inbox-detail__head {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    border-bottom: 1px solid var(--color-linea);
  }

  .l-inbox-detail__eyebrow,
  .l-inbox-detail__meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--space-3);
    color: var(--color-texto-tenue);
    font-size: var(--text-2xs);
  }

  .l-inbox-detail__title {
    margin: 0;
    color: var(--color-texto);
    font-size: var(--text-xl);
    font-weight: 800;
    letter-spacing: -0.01em;
    line-height: var(--leading-heading);
    overflow-wrap: anywhere;
  }
  .l-inbox-detail__title:focus { outline: none; }
  .l-inbox-detail__title:focus-visible { outline: 2px solid var(--focus-ring-color); outline-offset: 2px; }

  .l-inbox-detail__body {
    display: flex;
    flex-direction: column;
    gap: var(--density-pad);
  }

  .l-inbox-detail__actions {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    border-top: 1px solid var(--color-linea);
  }

  /* Datos del elemento: dos columnas en ancho, una en móvil. */
  .l-inbox-detail :global(.l-inbox-fields) {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-4) var(--density-pad);
    margin: 0;
  }

  /* Una nota (de quien propone, de la revisión): texto con sangría de acento. */
  .l-inbox-detail :global(.l-inbox-note) {
    margin: 0;
    padding: var(--space-3);
    border-left: 2px solid var(--color-acento-border);
    background: var(--color-superficie-2);
    color: var(--color-texto-medio);
    font-size: var(--density-text);
  }
  .l-inbox-detail :global(.l-inbox-note strong) {
    display: block;
    margin-bottom: var(--space-1);
    color: var(--color-texto-tenue);
    font-size: var(--density-label);
    font-weight: 750;
    letter-spacing: var(--nav-letter-spacing);
    text-transform: uppercase;
  }
  .l-inbox-detail :global(.l-inbox-note p) { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
  .l-inbox-detail :global(.l-inbox-note--empty p) { color: var(--color-texto-tenue); }

  /* Botones de decisión en una línea; si el detalle es estrecho (móvil, tablet
     con la lista al lado), apilados a todo el ancho: ninguno queda solo. */
  .l-inbox-detail :global(.l-inbox-buttons) {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  @media (max-width: 679px) {
    .l-inbox-detail :global(.l-inbox-fields) { grid-template-columns: minmax(0, 1fr); }
  }

  @container (max-width: 479px) {
    .l-inbox-detail__actions :global(.l-inbox-buttons > *) { flex: 1 1 100%; }
  }
</style>
