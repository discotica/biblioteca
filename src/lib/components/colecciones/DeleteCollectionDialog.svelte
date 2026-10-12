<script lang="ts">
  // Confirmación de eliminar una colección (U14). Es la única acción sin deshacer.
  import { Button, Dialog, Notice } from '$lib/ui';
  import { eliminarCrate, type Crate } from '$lib/stores/cratesStore';

  type Props = {
    open: boolean;
    crate: Crate | null;
    ondeleted?: (crate: Crate) => void;
    onclose?: () => void;
  };

  let { open = $bindable(), crate, ondeleted, onclose }: Props = $props();

  let deleting = $state(false);
  let error = $state('');

  const count = $derived(crate?.item_count ?? 0);

  $effect(() => {
    if (open) error = '';
  });

  async function confirm() {
    if (!crate) return;
    deleting = true;
    const ok = await eliminarCrate(crate.id);
    deleting = false;
    if (!ok) {
      error = 'No pudimos eliminarla. Vuelve a intentarlo.';
      return;
    }
    const deleted = crate;
    open = false;
    ondeleted?.(deleted);
    onclose?.();
  }
</script>

<Dialog bind:open title={crate ? `¿Eliminar «${crate.name}»?` : 'Eliminar colección'} size="sm" {onclose}>
  <p class="delete-text">
    Se borra la colección.
    {#if count === 1}Su lanzamiento sigue en el catálogo.{:else if count > 1}Sus {count} lanzamientos siguen en el catálogo.{/if}
    No se puede deshacer.
  </p>
  {#if error}<Notice tone="error">{error}</Notice>{/if}
  {#snippet footer()}
    <Button variant="secondary" onclick={() => { open = false; onclose?.(); }}>Cancelar</Button>
    <Button variant="destructive" loading={deleting} onclick={confirm}>Eliminar</Button>
  {/snippet}
</Dialog>

<style>
  .delete-text { margin: 0 0 var(--space-4); color: var(--color-texto-medio); font-size: var(--text-sm); line-height: 1.55; }
</style>
