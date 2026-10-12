<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { afterNavigate, replaceState } from '$app/navigation';
  import { user } from '$lib/stores/authStore';
  import { crates, cratesLoaded, cargarCrates, enlaceColeccion, portadasDeColecciones, type Crate } from '$lib/stores/cratesStore';
  import { supabase } from '$lib/supabase';
  import PageLayout from '$lib/layouts/PageLayout.svelte';
  import { Button, EmptyState, LoadingIndicator, Notice, type MenuItem } from '$lib/ui';
  import CollectionTile from '$lib/components/colecciones/CollectionTile.svelte';
  import CollectionFormDialog from '$lib/components/colecciones/CollectionFormDialog.svelte';
  import DeleteCollectionDialog from '$lib/components/colecciones/DeleteCollectionDialog.svelte';
  import { copyLink } from '$lib/components/colecciones/share';

  // Avisos al llegar desde un enlace de correo (U12). Se leen una vez y se
  // quitan de la URL, para que recargar o compartir no los repita.
  const AVISOS: Record<string, { title: string; text: string }> = {
    'cuenta-confirmada': {
      title: 'Tu cuenta está confirmada',
      text: 'Ya puedes crear colecciones, compartirlas y sugerir lanzamientos.'
    },
    contrasena: { title: 'Contraseña actualizada', text: 'Usa tu contraseña nueva la próxima vez que entres.' }
  };
  let aviso = $state<{ title: string; text: string } | null>(null);

  /** Resultado de la última acción del "…" (compartir, eliminar). */
  let feedback = $state<{ tone: 'success' | 'error'; text: string } | null>(null);

  let formOpen = $state(false);
  let editing = $state<Crate | null>(null);
  let deleteOpen = $state(false);
  let deleting = $state<Crate | null>(null);

  let perfil = $state<{ username: string } | null>(null);
  let covers = $state(new Map<string, (string | null)[]>());

  // La sesión ya trae el usuario: las migas y los enlaces no esperan al perfil.
  const username = $derived(perfil?.username ?? ($user?.user_metadata?.username as string | undefined) ?? '');

  $effect(() => {
    if ($page.url.searchParams.get('crear') === '1') openCreate();
  });

  // afterNavigate y no onMount: replaceState necesita el router ya iniciado,
  // y en una carga directa onMount corre antes.
  afterNavigate(({ to }) => {
    const avisoParam = to?.url.searchParams.get('aviso');
    if (!to || !avisoParam) return;
    aviso = AVISOS[avisoParam] ?? null;
    const url = new URL(to.url);
    url.searchParams.delete('aviso');
    replaceState(url, {});
  });

  // Mosaicos: se piden de nuevo cuando cambia el conjunto de colecciones.
  let coversKey = '';
  $effect(() => {
    const ids = $crates.map((crate) => crate.id);
    const key = ids.join(',');
    if (!$cratesLoaded || key === coversKey) return;
    coversKey = key;
    portadasDeColecciones(ids)
      .then((next) => (covers = next))
      .catch(() => {}); // sin portadas, el mosaico muestra el logo
  });

  onMount(async () => {
    if (!$cratesLoaded) await cargarCrates();
    if ($user) {
      const { data } = await supabase.from('profiles').select('username').eq('id', $user.id).single();
      perfil = data;
    }
  });

  function openCreate() {
    editing = null;
    formOpen = true;
  }

  async function share(crate: Crate) {
    const ok = await copyLink(enlaceColeccion(crate, username));
    feedback = ok
      ? { tone: 'success', text: `Copiamos el enlace de «${crate.name}».` }
      : { tone: 'error', text: 'No pudimos copiar el enlace. Ábrela y copia la dirección del navegador.' };
  }

  function actionsFor(crate: Crate): MenuItem[] {
    return [
      crate.is_public
        ? { label: 'Compartir', icon: 'compartir', onselect: () => share(crate) }
        : { label: 'Compartir (es privada)', icon: 'compartir', disabled: true },
      { label: 'Editar', onselect: () => { editing = crate; formOpen = true; } },
      { label: 'Eliminar', tone: 'danger', onselect: () => { deleting = crate; deleteOpen = true; } }
    ];
  }
</script>

<svelte:head>
  <title>Mis colecciones — Biblioteca Discótica</title>
</svelte:head>

<PageLayout
  container="regular"
  breadcrumbs={username ? [{ label: `@${username}`, href: `/perfil/${username}` }, { label: 'Mis colecciones' }] : undefined}
  title="Mis colecciones"
>
  {#snippet actions()}
    <Button icon="agregar" onclick={openCreate}>Nueva colección</Button>
  {/snippet}

  {#if aviso}
    <Notice tone="success" title={aviso.title} class="mis-colecciones__aviso">{aviso.text}</Notice>
  {/if}
  {#if feedback}
    <Notice tone={feedback.tone} class="mis-colecciones__aviso">{feedback.text}</Notice>
  {/if}

  {#if !$cratesLoaded}
    <LoadingIndicator label="Cargando colecciones" />
  {:else if $crates.length === 0}
    <EmptyState
      message="Todavía no tienes colecciones."
      detail="Agrupa lanzamientos para volver a ellos o compartirlos."
      actionLabel="Crear mi primera colección"
      onaction={openCreate}
    />
  {:else}
    <ul class="crates-grid collection-grid">
      {#each $crates as crate (crate.id)}
        <li>
          <CollectionTile
            {crate}
            covers={covers.get(crate.id) ?? []}
            href={`/coleccion/${encodeURIComponent(crate.slug)}?usuario=${encodeURIComponent(username || '__self__')}`}
            actions={actionsFor(crate)}
            showVisibility
          />
        </li>
      {/each}
    </ul>
  {/if}
</PageLayout>

<CollectionFormDialog
  bind:open={formOpen}
  crate={editing}
  onsaved={(saved) => {
    feedback = { tone: 'success', text: editing ? `Guardamos «${saved.name}».` : `Creamos «${saved.name}».` };
    coversKey = '';
  }}
/>

<DeleteCollectionDialog
  bind:open={deleteOpen}
  crate={deleting}
  ondeleted={(deleted) => (feedback = { tone: 'success', text: `Eliminamos «${deleted.name}».` })}
/>

<style>
  :global(.mis-colecciones__aviso) { margin-bottom: var(--space-6); }

  .collection-grid {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(var(--mosaic-min-w), 1fr));
    gap: var(--space-6) var(--space-4);
  }
</style>
