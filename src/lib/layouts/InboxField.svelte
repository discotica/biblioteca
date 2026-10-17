<script lang="ts">
  import type { Snippet } from 'svelte';
  import Chip from '$lib/ui/Chip.svelte';

  type Props = {
    label: string;
    /** Valor en texto; '' se muestra como "—" (vacío para lectores). */
    value?: string;
    /** Valor con marcado propio (enlaces, chips). Sustituye a `value`. */
    children?: Snippet;
    /** Marca junto a la etiqueta ("Editado"), con su explicación para lectores. */
    mark?: { label: string; description: string };
    /** Ocupa las dos columnas. */
    wide?: boolean;
  };

  let { label, value = '', children, mark, wide = false }: Props = $props();
</script>

<!-- Un dato del detalle de la bandeja (U17). Va dentro de <dl class="l-inbox-fields">. -->
<div class="l-inbox-field" class:l-inbox-field--wide={wide} class:l-inbox-field--marked={!!mark}>
  <dt class="l-inbox-field__label">
    <span>{label}</span>
    {#if mark}<Chip kind="status" tone="warning" label={mark.label} /><span class="sr-only">{mark.description}</span>{/if}
  </dt>
  <dd class="l-inbox-field__value">
    {#if children}{@render children()}{:else if value}{value}{:else}<span aria-hidden="true">—</span><span class="sr-only">Vacío</span>{/if}
  </dd>
</div>

<style>
  .l-inbox-field { min-width: 0; }
  .l-inbox-field--wide { grid-column: 1 / -1; }

  .l-inbox-field__label {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    min-height: var(--chip-h-sm);
    color: var(--color-texto-tenue);
    font-size: var(--density-label);
    font-weight: 750;
    letter-spacing: var(--nav-letter-spacing);
    text-transform: uppercase;
  }

  .l-inbox-field__value {
    margin: var(--space-1) 0 0;
    color: var(--color-texto-alto);
    font-size: var(--density-text);
    line-height: 1.45;
    overflow-wrap: anywhere;
  }
  .l-inbox-field--marked .l-inbox-field__value { color: var(--color-texto); }
</style>
