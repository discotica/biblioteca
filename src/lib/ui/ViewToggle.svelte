<script lang="ts">
  import { onMount } from 'svelte';
  import IconButton from './IconButton.svelte';
  import { readViewPreference, writeViewPreference, type ViewMode } from './viewPreference';

  type Props = {
    value?: ViewMode;
    /**
     * Contexto que se recuerda por separado (p. ej. "inicio", "coleccion").
     * Sin contexto no se guarda nada.
     */
    context?: string;
    onchange?: (mode: ViewMode) => void;
    label?: string;
    size?: 'sm' | 'md';
    class?: string;
  };

  let { value = $bindable('grid'), context, onchange, label = 'Vista', size = 'md', class: className = '' }: Props = $props();

  // Al montar recupera la preferencia guardada. Para evitar un cambio visible
  // tras el primer pintado, la vista puede leerla antes con readViewPreference.
  onMount(() => {
    if (!context) return;
    const stored = readViewPreference(context);
    if (stored && stored !== value) {
      value = stored;
      onchange?.(stored);
    }
  });

  function select(mode: ViewMode) {
    if (mode === value) return;
    value = mode;
    if (context) writeViewPreference(context, mode);
    onchange?.(mode);
  }
</script>

<div class="ui-view-toggle ui-view-toggle--{size} {className}" role="group" aria-label={label}>
  <IconButton icon="grilla" label="Grilla" {size} pressed={value === 'grid'} onclick={() => select('grid')} />
  <IconButton icon="lista" label="Lista" {size} pressed={value === 'list'} tooltipAlign="end" onclick={() => select('list')} />
</div>

<style>
  /* Sin marco propio: mide lo mismo que la paginación y "Ordenar por" de su línea. */
  .ui-view-toggle {
    display: inline-flex;
    gap: var(--space-1);
  }
  /* En sm (32) la separación completa los 44 de cada objetivo sin solaparlos. */
  .ui-view-toggle--sm { gap: calc(var(--target-touch) - var(--button-h-sm)); }
</style>
