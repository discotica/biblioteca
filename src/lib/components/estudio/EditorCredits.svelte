<script lang="ts">
  import { Button, Combobox, Icon, IconButton, Notice, type ComboboxOption } from '$lib/ui';
  import { normalizeSearch } from '$lib/ui/combobox';
  import { isPendingId, mergeById, moveCredits, pendingId, pendingName } from '$lib/domain/releaseEditor';
  import { searchArtists, type Artist, type CatalogSnapshot } from '$lib/services/adminCatalog';
  import { SimilarEntries } from './similarEntries.svelte';

  type CreditKind = 'artist_ids' | 'collaborator_ids';

  type Props = {
    /** El lanzamiento que se edita; los cambios se escriben en sus dos listas de créditos. */
    release: CatalogSnapshot;
    /** Nombres conocidos de artistas (compartidos con la lista del catálogo). */
    artists: Artist[];
    /**
     * U19: un artista que no existe entra como nombre nuevo y se crea «al guardar» (catálogo) o
     * «al aceptar» (propuesta). Sustituye al diálogo de alta de E06.
     */
    createdWhen: string;
    /** Un aviso sobre los créditos (p. ej. "ya está en el otro grupo"). */
    onmessage?: (text: string) => void;
  };

  let { release = $bindable(), artists = $bindable(), createdWhen, onmessage }: Props = $props();

  const GROUPS: Array<{ kind: CreditKind; title: string; other: string; optional: boolean }> = [
    { kind: 'artist_ids', title: 'Artistas principales', other: 'colaboradores', optional: false },
    { kind: 'collaborator_ids', title: 'Colaboradores', other: 'principales', optional: true }
  ];

  let queries = $state<Record<CreditKind, string>>({ artist_ids: '', collaborator_ids: '' });
  let results = $state<Record<CreditKind, Artist[]>>({ artist_ids: [], collaborator_ids: [] });
  let searching = $state<Record<CreditKind, boolean>>({ artist_ids: false, collaborator_ids: false });
  /** Selección para arrastrar varios a la vez (Mayús amplía, Cmd/Ctrl alterna). */
  let picked = $state<string[]>([]);
  let anchor = $state<{ kind: CreditKind; index: number } | null>(null);
  let dragging = $state<string[]>([]);
  let dropTarget = $state<{ kind: CreditKind; before: string | null } | null>(null);

  const similar = new SimilarEntries('artists');
  const nameOf = (id: string) => (isPendingId(id) ? pendingName(id) : artists.find((artist) => artist.id === id)?.name ?? 'Artista sin resolver');
  const otherKind = (kind: CreditKind): CreditKind => (kind === 'artist_ids' ? 'collaborator_ids' : 'artist_ids');

  function optionsFor(kind: CreditKind): ComboboxOption[] {
    const elsewhere = release[otherKind(kind)];
    const other = GROUPS.find((group) => group.kind === otherKind(kind))!.other;
    return results[kind].map((artist) => ({
      value: artist.id,
      label: artist.name,
      hint: elsewhere.includes(artist.id) ? `En ${other}: se mueve aquí` : undefined
    }));
  }

  // Búsqueda en el servidor, con espera, por grupo (E07: desde 2 caracteres).
  for (const kind of ['artist_ids', 'collaborator_ids'] as const) {
    $effect(() => {
      const text = queries[kind].trim();
      if (text.length < 2) {
        results[kind] = [];
        searching[kind] = false;
        return;
      }
      searching[kind] = true;
      let stale = false;
      const timer = window.setTimeout(async () => {
        try {
          const found = await searchArtists(text);
          if (!stale) results[kind] = found;
        } catch {
          if (!stale) onmessage?.('No se pudo buscar artistas.');
        } finally {
          if (!stale) searching[kind] = false;
        }
      }, 220);
      return () => {
        stale = true;
        window.clearTimeout(timer);
      };
    });
  }

  function remember(entries: Artist[]) {
    artists = mergeById(artists, entries);
  }

  function apply(next: { artist_ids: string[]; collaborator_ids: string[] }) {
    release.artist_ids = next.artist_ids;
    release.collaborator_ids = next.collaborator_ids;
  }

  /** Lo elegido en el buscador: añade, quita o trae del otro grupo. */
  function change(kind: CreditKind, next: string[]) {
    const current = release[kind];
    const removed = current.filter((id) => !next.includes(id));
    const added = next.filter((id) => !current.includes(id));
    remember(results[kind].filter((artist) => added.includes(artist.id)));
    let credits = { artist_ids: release.artist_ids, collaborator_ids: release.collaborator_ids };
    if (removed.length) credits = { ...credits, [kind]: current.filter((id) => !removed.includes(id)) };
    if (added.length) credits = moveCredits(credits, added, kind);
    apply(credits);
    picked = picked.filter((id) => !removed.includes(id));
  }

  /** «Añadir «…»»: el que se llama igual en los resultados, o un nombre nuevo con aviso de parecidos. */
  function create(kind: CreditKind, text: string): ComboboxOption {
    const name = text.replace(/\s+/g, ' ').trim();
    const same = results[kind].find((artist) => normalizeSearch(artist.name) === normalizeSearch(name));
    if (same) remember([same]);
    else similar.check(name);
    const id = same?.id ?? pendingId(name);
    if (release[otherKind(kind)].includes(id)) apply(moveCredits(release, [id], kind));
    return { value: id, label: same?.name ?? name };
  }

  /** «Usar «…»»: el existente ocupa el lugar del nombre nuevo, en el mismo grupo y posición. */
  function useExisting(kind: CreditKind, id: string, artist: Artist) {
    remember([artist]);
    const swap = (ids: string[]) => ids.map((value) => (value === id ? artist.id : value)).filter((value, index, list) => list.indexOf(value) === index);
    const credits = { artist_ids: swap(release.artist_ids), collaborator_ids: swap(release.collaborator_ids) };
    // Si el existente ya estaba en el otro grupo, se queda en el que eligió quien edita.
    apply(credits.artist_ids.includes(artist.id) && credits.collaborator_ids.includes(artist.id) ? moveCredits(credits, [artist.id], kind) : credits);
    picked = picked.filter((value) => value !== id);
  }

  function remove(kind: CreditKind, id: string) {
    release[kind] = release[kind].filter((value) => value !== id);
    picked = picked.filter((value) => value !== id);
  }

  function moveToOther(kind: CreditKind, id: string) {
    apply(moveCredits(release, [id], otherKind(kind)));
    picked = [];
  }

  function select(event: MouseEvent, kind: CreditKind, id: string, index: number) {
    if (event.shiftKey && anchor?.kind === kind) {
      const [start, end] = [Math.min(anchor.index, index), Math.max(anchor.index, index)];
      picked = [...new Set([...picked, ...release[kind].slice(start, end + 1)])];
    } else if (event.metaKey || event.ctrlKey) {
      picked = picked.includes(id) ? picked.filter((value) => value !== id) : [...picked, id];
    } else {
      picked = picked.length === 1 && picked[0] === id ? [] : [id];
    }
    anchor = { kind, index };
  }

  // Arrastrar (puntero fino): uno o varios, a otro grupo o delante de otro crédito.
  function dragStart(event: DragEvent, kind: CreditKind, id: string, index: number) {
    if (!picked.includes(id)) {
      picked = [id];
      anchor = { kind, index };
    }
    dragging = [...picked];
    event.dataTransfer?.setData('text/plain', id);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }
  function dragOver(event: DragEvent, kind: CreditKind, before: string | null) {
    if (!dragging.length) return;
    event.preventDefault();
    event.stopPropagation();
    if (dropTarget?.kind !== kind || dropTarget.before !== before) dropTarget = { kind, before };
  }
  function drop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (dropTarget && dragging.length) apply(moveCredits(release, dragging, dropTarget.kind, dropTarget.before));
    dragEnd();
  }
  function dragEnd() {
    dragging = [];
    dropTarget = null;
  }
</script>

<div class="credits">
  {#each GROUPS as group (group.kind)}
    {@const ids = release[group.kind]}
    <section
      class="credits__group"
      class:credits__group--target={dropTarget?.kind === group.kind && dropTarget.before === null}
      role="group"
      aria-label={group.title}
      ondragover={(event) => dragOver(event, group.kind, null)}
      ondrop={drop}
    >
      <header class="credits__head">
        <h3 class="credits__title">
          {group.title}{#if group.optional}<span class="credits__optional">(opcional)</span>{/if}
        </h3>
        <span class="credits__count">{ids.length}</span>
      </header>

      {#if ids.length}
        <ol class="credits__list" aria-label={group.title}>
          {#each ids as id, index (id)}
            <li
              class="credit"
              class:credit--picked={picked.includes(id)}
              class:credit--dragging={dragging.includes(id)}
              class:credit--before={dropTarget?.kind === group.kind && dropTarget.before === id}
              draggable="true"
              ondragstart={(event) => dragStart(event, group.kind, id, index)}
              ondragover={(event) => dragOver(event, group.kind, id)}
              ondrop={drop}
              ondragend={dragEnd}
            >
              <span class="credit__handle" aria-hidden="true"><Icon name="arrastrar" size="sm" /></span>
              <button
                type="button"
                class="credit__name"
                aria-pressed={picked.includes(id)}
                aria-label={`Seleccionar ${nameOf(id)}${isPendingId(id) ? `, nuevo, se crea ${createdWhen}` : ''}`}
                onclick={(event) => select(event, group.kind, id, index)}
              >{nameOf(id)}</button>
              {#if isPendingId(id)}<span class="credit__new" aria-hidden="true">Nuevo · se crea {createdWhen}</span>{/if}
              <IconButton size="sm" icon="intercambiar" label={`Mover a ${group.other}`} onclick={() => moveToOther(group.kind, id)} />
              <IconButton size="sm" icon="cerrar" label={`Quitar ${nameOf(id)}`} tooltipAlign="end" onclick={() => remove(group.kind, id)} />
            </li>
          {/each}
        </ol>
      {:else}
        <p class="credits__empty">{group.optional ? 'Sin colaboradores.' : 'Añade al menos un artista principal.'}</p>
      {/if}

      <Combobox
        class="credits__search"
        label={`Añadir a ${group.title.toLowerCase()}`}
        hideLabel
        chips={false}
        filter={false}
        options={optionsFor(group.kind)}
        value={ids}
        bind:query={queries[group.kind]}
        loading={searching[group.kind]}
        allowCreate={queries[group.kind].trim().length >= 2 && !searching[group.kind]}
        createLabel={(text) => `Añadir «${text}» como artista nuevo`}
        oncreate={(text) => create(group.kind, text)}
        onchange={(next) => change(group.kind, next)}
        placeholder="Buscar artista…"
        emptyText="No encontramos coincidencias."
      />
      {#each ids.filter((id) => isPendingId(id) && similar.of(pendingName(id)).length) as id (id)}
        <Notice class="credits__similar" title={`«${pendingName(id)}» no está en el catálogo y se creará como nuevo.`}>
          Hay nombres parecidos. Si es el mismo, usa el que ya existe.
          {#snippet actions()}
            {#each similar.of(pendingName(id)) as other (other.id)}
              <Button variant="link" size="sm" onclick={() => useExisting(group.kind, id, other)}>Usar «{other.name}»</Button>
            {/each}
          {/snippet}
        </Notice>
      {/each}
    </section>
  {/each}
</div>
{#if release.artist_ids.length + release.collaborator_ids.length > 1}
  <p class="credits__help">Arrastra para ordenar o cambiar de grupo; Mayús o Cmd seleccionan varios.</p>
{/if}

<style>
  .credits {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--density-gap);
    align-items: start;
  }

  .credits__group {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    min-width: 0;
    padding: var(--space-3);
    border: 1px solid var(--color-borde);
    border-radius: var(--radius-sm);
    transition: border-color var(--motion-fast) var(--ease-standard);
  }
  .credits__group--target { border-color: var(--color-acento-border); }

  .credits__head { display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-2); }
  .credits__title { margin: 0; color: var(--color-texto-alto); font-size: var(--text-sm); font-weight: 600; }
  .credits__optional { margin-left: .3em; color: var(--color-texto-tenue); font-weight: 400; }
  .credits__count { color: var(--color-texto-tenue); font-size: var(--text-2xs); font-variant-numeric: tabular-nums; }

  .credits__list { display: flex; flex-direction: column; margin: 0; padding: 0; list-style: none; }

  .credit {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    min-height: var(--density-row-h);
    padding-left: var(--space-1);
    border-radius: var(--radius-xs);
    box-shadow: inset 0 0 0 1px transparent;
  }
  .credit + .credit { border-top: 1px solid var(--color-linea-sutil); }
  .credit:hover { background: var(--color-superficie-1); }
  .credit--picked { background: var(--color-acento-tinte); box-shadow: inset 0 0 0 1px var(--color-acento-border); }
  .credit--dragging { opacity: .5; }
  .credit--before { box-shadow: inset 0 2px 0 var(--color-acento); }

  .credit__handle { display: flex; color: var(--color-texto-tenue); cursor: grab; }
  .credit__name {
    flex: 1;
    min-width: 0;
    min-height: var(--target-touch);
    margin-block: calc((var(--density-row-h) - var(--target-touch)) / 2);
    padding: 0 var(--space-2);
    overflow: hidden;
    border: 0;
    background: transparent;
    color: var(--color-texto);
    font: inherit;
    font-size: var(--text-sm);
    text-align: left;
    white-space: nowrap;
    text-overflow: ellipsis;
    cursor: pointer;
  }

  .credit__new {
    flex: none;
    color: var(--color-aviso);
    font-size: var(--text-2xs);
    white-space: nowrap;
  }

  .credits__empty { margin: 0; padding: var(--space-2) var(--space-1); color: var(--color-texto-tenue); font-size: var(--text-xs); }
  .credits__help { margin: var(--space-2) 0 0; color: var(--color-texto-tenue); font-size: var(--text-2xs); }

  /* Sin puntero fino no se arrastra: mover y quitar quedan en los botones. */
  @media (hover: none) {
    .credit__handle { display: none; }
    .credits__help { display: none; }
  }

  @media (max-width: 767px) {
    .credits { grid-template-columns: minmax(0, 1fr); }
  }

  @media (prefers-reduced-motion: reduce) {
    .credits__group { transition: none; }
  }
</style>
