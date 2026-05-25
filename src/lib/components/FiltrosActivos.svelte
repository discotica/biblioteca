<script>
  export let filtros = {}; // Recibe filtros como objeto
  export let onRemove = () => {}; // Función callback para eliminar filtro

  function formatoEtiqueta(key, value) {
    if (Array.isArray(value)) return value.map(v => ({ key, value: v }));
    return [{ key, value }];
  }

  $: chips = Object.entries(filtros)
    .flatMap(([key, value]) => formatoEtiqueta(key, value))
    .filter(chip => chip.value); // Solo chips con valor
</script>

<div class="chips">
  {#each chips as chip}
    <div class="chip">
      <span>{chip.key}: {chip.value}</span>
      <button on:click={() => onRemove(chip.key, chip.value)}>×</button>
    </div>
  {/each}
</div>

<style>
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: var(--spacing-sm);
  }

  .chip {
    background: var(--color-borde);
    color: var(--color-texto);
    padding: 0.2rem 0.6rem;
    border-radius: var(--radius-sm);
    font-size: 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .chip button {
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--color-acento);
    font-weight: bold;
  }
</style>