<script>
  // «Reiniciar filtros», compartido por el panel y la hoja (U10). Secundario de
  // acento con icono: se distingue sin competir con «Ver N lanzamientos».
  // `label` permite la forma corta de la hoja ("Reiniciar").
  import { createEventDispatcher } from 'svelte';
  import Button from '$lib/ui/Button.svelte';

  export let block = false;
  export let label = 'Reiniciar filtros';

  const dispatch = createEventDispatcher();
</script>

<Button
  class="reset-filtros"
  variant="accent"
  icon="reiniciar"
  {block}
  aria-label={label === 'Reiniciar filtros' ? undefined : 'Reiniciar filtros'}
  onclick={() => dispatch('click')}
>{label}</Button>
