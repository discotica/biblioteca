<script lang="ts">
  // Crear o editar una colección (U14). Sustituye a CreateCrateModal: usa Dialog
  // y los campos del sistema, sin mayúsculas ni segmentado propio (hallazgo del
  // censo). Editar no cambia el slug, así que los enlaces compartidos siguen valiendo.
  import { tick } from 'svelte';
  import { Button, Checkbox, Dialog, Field, Notice, Textarea } from '$lib/ui';
  import { actualizarCrate, crearCrate, type Crate } from '$lib/stores/cratesStore';

  type Props = {
    open: boolean;
    /** Sin colección, crea una nueva. */
    crate?: Crate | null;
    onsaved?: (crate: Crate) => void;
    onclose?: () => void;
  };

  let { open = $bindable(), crate = null, onsaved, onclose }: Props = $props();

  let name = $state('');
  let description = $state('');
  let isPublic = $state(true);
  let nameError = $state('');
  let saveError = $state('');
  let saving = $state(false);
  let nameInput = $state<HTMLInputElement>();

  const editing = $derived(Boolean(crate));

  // Al abrir, el formulario parte de la colección (o vacío al crear).
  let wasOpen = false;
  $effect(() => {
    if (open && !wasOpen) {
      name = crate?.name ?? '';
      description = crate?.description ?? '';
      isPublic = crate?.is_public ?? true;
      nameError = '';
      saveError = '';
    }
    wasOpen = open;
  });

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    nameError = '';
    saveError = '';
    const trimmed = name.trim();
    if (!trimmed) {
      nameError = 'Ponle un nombre a la colección.';
      await tick();
      nameInput?.focus();
      return;
    }
    saving = true;
    let saved: Crate | null = null;
    if (crate) {
      const changes = { name: trimmed, description: description.trim() || null, is_public: isPublic };
      if (await actualizarCrate(crate.id, changes)) saved = { ...crate, ...changes };
    } else {
      saved = await crearCrate(trimmed, description.trim(), isPublic);
    }
    saving = false;
    if (!saved) {
      saveError = editing ? 'No pudimos guardar los cambios. Vuelve a intentarlo.' : 'No pudimos crear la colección. Vuelve a intentarlo.';
      return;
    }
    open = false;
    onsaved?.(saved);
    onclose?.();
  }
</script>

<Dialog bind:open title={editing ? 'Editar colección' : 'Nueva colección'} size="sm" {onclose} initialFocus="input[name='collection-name']">
  <form id="collection-form" class="collection-form" onsubmit={submit} novalidate>
    <Field
      label="Nombre"
      name="collection-name"
      maxlength={120}
      required
      placeholder="Ej.: Cumbia ácida 2024"
      bind:value={name}
      bind:element={nameInput}
      error={nameError}
    />
    <Textarea label="Descripción" name="collection-description" optional rows={3} maxlength={400} placeholder="¿Qué tiene esta colección?" bind:value={description} />
    <Checkbox
      variant="switch"
      name="collection-public"
      bind:checked={isPublic}
      hint={isPublic ? 'Aparece en tu perfil y cualquiera con el enlace puede verla.' : 'Solo tú puedes verla.'}
    >Colección pública</Checkbox>
    {#if saveError}<Notice tone="error">{saveError}</Notice>{/if}
  </form>
  {#snippet footer()}
    <Button variant="secondary" onclick={() => { open = false; onclose?.(); }}>Cancelar</Button>
    <Button type="submit" form="collection-form" loading={saving}>{editing ? 'Guardar cambios' : 'Crear colección'}</Button>
  {/snippet}
</Dialog>

<style>
  .collection-form { display: flex; flex-direction: column; gap: var(--space-4); }
</style>
