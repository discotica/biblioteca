<script lang="ts">
  import { tick, untrack } from 'svelte';
  import RadarMini from '$lib/components/RadarMini.svelte';
  import EditorCredits from './EditorCredits.svelte';
  import EditorHistory from './EditorHistory.svelte';
  import { slugifyReleaseIdentity } from '$lib/domain/releases';
  import { matchByName, normalizeName, takeAdminHandoff, type AdminHandoff } from '$lib/domain/adminHandoff';
  import { studioProposalsHref, studioReportsHref } from '$lib/domain/studio';
  import {
    EDITOR_SECTIONS,
    editorSectionAnchor,
    inferProvider,
    missingBySection,
    missingFields,
    primaryLink,
    validateRelease,
    withPrimaryLink,
    type EditorSectionId
  } from '$lib/domain/releaseEditor';
  import {
    Button,
    Chip,
    Combobox,
    Cover,
    Dialog,
    ErrorState,
    Field,
    Icon,
    IconButton,
    LoadingIndicator,
    Menu,
    Notice,
    Select,
    Textarea,
    type MenuItem
  } from '$lib/ui';
  import {
    blankCatalog,
    createArtist,
    createCatalog,
    createGenre,
    createLabel,
    findArtistsByNames,
    getArtistsByIds,
    getCatalogHistory,
    getCatalogRelease,
    payload,
    revertCatalog,
    saveCatalog,
    type Artist,
    type CatalogHistory,
    type CatalogSnapshot,
    type CatalogStatus,
    type DictionaryEntry
  } from '$lib/services/adminCatalog';

  type Props = {
    /** Lanzamiento abierto (?lanzamiento=). */
    releaseId: string | null;
    /** Alta nueva (?nuevo=1), con el traspaso de Sugerir si lo hay (U13). */
    isNew: boolean;
    labels: DictionaryEntry[];
    genres: DictionaryEntry[];
    countries: DictionaryEntry[];
    types: DictionaryEntry[];
    /** Nombres de artistas conocidos, compartidos con la lista. */
    artists: Artist[];
    onclose: () => void;
    /** El borrador nuevo ya tiene identidad: su URL pasa a ser la del lanzamiento. */
    oncreated: (id: string) => void | Promise<void>;
    /** Algo cambió en el servidor: la lista y los conteos se vuelven a leer. */
    onsaved: () => void;
  };

  let {
    releaseId,
    isNew,
    labels = $bindable(),
    genres = $bindable(),
    countries,
    types,
    artists = $bindable(),
    onclose,
    oncreated,
    onsaved
  }: Props = $props();

  type DialogKind = 'publish' | 'archive' | 'revert' | 'artist' | 'label' | 'genre' | null;
  type Feedback = { tone: 'error' | 'success'; text: string } | null;

  const STATUS_LABELS: Record<CatalogStatus, string> = { draft: 'Borrador', published: 'Publicado', archived: 'Archivado' };
  const STATUS_TONES: Record<CatalogStatus, 'neutral' | 'accent' | 'danger'> = { draft: 'neutral', published: 'accent', archived: 'danger' };
  const RADAR = [
    { key: 'experimental', label: 'Experimental' },
    { key: 'denso', label: 'Denso' },
    { key: 'sintetico', label: 'Sintético' },
    { key: 'bailable', label: 'Bailable' },
    { key: 'rapido', label: 'Rápido' }
  ] as const;

  let selected = $state<CatalogSnapshot | null>(null);
  let history = $state<CatalogHistory[]>([]);
  let loading = $state(false);
  let loadError = $state('');
  /** El payload tal como se leyó o guardó, para saber si hay cambios sin guardar. */
  let baseline = $state('');
  let labelText = $state('');
  let observation = $state('');
  let busy = $state(false);
  let feedback = $state<Feedback>(null);
  let handoffNotice = $state('');
  let titleError = $state('');
  let activeSection = $state<EditorSectionId>('datos');

  // Diálogos: confirmar publicar, archivar y revertir; altas auditadas.
  let dialog = $state<DialogKind>(null);
  let dialogOpen = $state(false);
  let dialogError = $state('');
  let pendingHistory = $state<CatalogHistory | null>(null);
  let revertReason = $state('');
  let artistName = $state('');
  let dictionaryName = $state('');
  let dictionaryReason = $state('');
  let returnFocus = $state<HTMLElement | null>(null);
  /** Quien pidió el alta (combobox de géneros o de créditos) espera su resultado. */
  let pendingCreate: ((entry: DictionaryEntry | null) => void) | null = null;

  let noteEl = $state<HTMLInputElement>();

  const dirty = $derived(selected ? JSON.stringify(payload(selected)) !== baseline : false);
  const missing = $derived(selected ? missingFields(selected) : []);
  const missingIn = $derived(selected ? missingBySection(selected) : null);
  const artistLine = $derived(
    selected ? selected.artist_ids.map((id) => artists.find((artist) => artist.id === id)?.name ?? 'Artista sin resolver').join(', ') : ''
  );
  const link = $derived(primaryLink(selected));
  const extraLinks = $derived(selected ? selected.links.filter((entry) => !entry.is_primary).length : 0);
  const typeOptions = $derived([{ value: '', label: 'Selecciona un tipo' }, ...types.map((type) => ({ value: type.id, label: type.name }))]);
  const genreOptions = $derived(genres.map((genre) => ({ value: genre.id, label: genre.name })));
  const countryOptions = $derived(countries.map((country) => ({ value: country.id, label: country.name })));
  const sectionOptions = $derived(
    EDITOR_SECTIONS.map((section) => ({ value: section.id, label: sectionLabel(section.id, section.label) }))
  );
  const reports = $derived(selected?.signals?.open_report_count ?? 0);
  const menuItems = $derived.by<MenuItem[]>(() => {
    if (!selected?.id) return [];
    const items: MenuItem[] = [];
    if (selected.status === 'published') items.push({ label: 'Ver ficha pública', icon: 'flecha-externa', href: `/lanzamiento/${selected.slug}` });
    items.push({ label: reports ? `Reportes abiertos (${reports})` : 'Reportes', icon: 'reportar', href: studioReportsHref(selected.id) });
    items.push({ label: 'Propuestas', icon: 'lista', href: studioProposalsHref(selected.id) });
    if (selected.status !== 'archived') items.push({ label: 'Archivar lanzamiento', tone: 'danger', onselect: () => askFor('archive', null) });
    return items;
  });
  const dialogTitle = $derived(
    {
      publish: 'Publicar lanzamiento',
      archive: 'Archivar lanzamiento',
      revert: 'Revertir cambio',
      artist: 'Crear nueva identidad',
      label: 'Crear sello confirmado',
      genre: 'Crear género confirmado'
    }[dialog ?? 'publish']
  );

  function sectionLabel(id: EditorSectionId, label: string) {
    if (id === 'historial') return history.length ? `${label} (${history.length})` : label;
    const count = missingIn?.[id].length ?? 0;
    return count ? `${label} · falta ${count}` : label;
  }

  const nameOf = (entries: DictionaryEntry[], id: string | null) => entries.find((entry) => entry.id === id)?.name ?? '';
  const formatDate = (value: string | null) =>
    value
      ? new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value.length === 10 ? `${value}T12:00:00` : value))
      : 'Sin fecha';

  // Un aviso de éxito deja de valer en cuanto se vuelve a editar.
  $effect(() => {
    if (dirty) untrack(() => feedback?.tone === 'success' && (feedback = null));
  });

  // ---------------------------------------------------------------------------
  // Carga: la URL manda (la página pasa releaseId / isNew).

  $effect(() => {
    const id = releaseId;
    const fresh = isNew;
    untrack(() => void sync(id, fresh));
  });

  async function sync(id: string | null, fresh: boolean) {
    if (id) {
      // Tras crear el borrador, la URL pasa a su id: ya está cargado.
      if (selected?.id !== id) await load(id);
    } else if (fresh && (!selected || selected.id)) {
      startBlank();
      await applyHandoff(takeAdminHandoff());
    }
  }

  function assign(snapshot: CatalogSnapshot) {
    selected = snapshot;
    baseline = JSON.stringify(payload(snapshot));
    labelText = snapshot.label_id ? nameOf(labels, snapshot.label_id) : '';
    titleError = '';
  }

  async function ensureArtists(ids: string[]) {
    const known = new Set(artists.map((artist) => artist.id));
    const unknown = [...new Set(ids)].filter((id) => id && !known.has(id));
    if (unknown.length) artists = [...artists, ...(await getArtistsByIds(unknown))];
  }

  async function load(id: string) {
    loading = true;
    loadError = '';
    feedback = null;
    handoffNotice = '';
    try {
      const snapshot = await getCatalogRelease(id);
      history = await getCatalogHistory(id);
      await ensureArtists([...snapshot.artist_ids, ...snapshot.collaborator_ids]);
      assign(snapshot);
      observation = '';
      activeSection = 'datos';
    } catch (cause: any) {
      selected = null;
      loadError = cause?.code === 'P0002' ? 'Ese lanzamiento no existe.' : cause?.message || 'No se pudo abrir el lanzamiento.';
    } finally {
      loading = false;
    }
  }

  function startBlank() {
    assign(blankCatalog());
    history = [];
    observation = '';
    feedback = null;
    handoffNotice = '';
    loadError = '';
    activeSection = 'datos';
  }

  /** Vuelve a leer el lanzamiento y su historial después de escribir. */
  async function refresh(id = selected?.id) {
    if (!id) return;
    const snapshot = await getCatalogRelease(id);
    history = await getCatalogHistory(id);
    await ensureArtists([...snapshot.artist_ids, ...snapshot.collaborator_ids]);
    assign(snapshot);
    onsaved();
  }

  /**
   * Rellena el alta con lo escrito en Sugerir (U13). Solo elige lo que ya
   * existe; lo demás se nombra en el aviso para crearlo aquí.
   */
  async function applyHandoff(handoff: AdminHandoff | null) {
    if (!handoff || !selected) return;
    const found = await findArtistsByNames([...handoff.primaryArtists, ...handoff.collaborators]).catch(() => [] as Artist[]);
    artists = [...artists, ...found.filter((artist) => !artists.some((known) => known.id === artist.id))];
    const primary = matchByName(found, handoff.primaryArtists);
    const guests = matchByName(found, handoff.collaborators);
    const genreMatch = matchByName(genres, handoff.genres);
    const countryMatch = matchByName(countries, handoff.countries);
    const typeMatch = matchByName(types, handoff.releaseType ? [handoff.releaseType] : []);
    if (!selected) return;
    updateTitle(handoff.title);
    selected.release_date = handoff.releaseDate || null;
    selected.release_type_id = typeMatch.ids[0] ?? null;
    selected.artist_ids = primary.ids;
    selected.collaborator_ids = guests.ids.filter((id) => !primary.ids.includes(id));
    selected.genre_ids = genreMatch.ids;
    selected.country_ids = countryMatch.ids;
    if (/^https:\/\//i.test(handoff.coverUrl)) selected.cover_url = handoff.coverUrl;
    if (handoff.label) updateLabel(handoff.label);
    if (handoff.sourceUrl) updateBuyLink(handoff.sourceUrl);
    observation = handoff.note.trim() || 'Alta desde Sugerir.';
    const pending = [
      ...primary.missing.map((name) => `${name} (artista)`),
      ...guests.missing.map((name) => `${name} (colaborador)`),
      ...genreMatch.missing.map((name) => `${name} (género)`),
      ...countryMatch.missing.map((name) => `${name} (país)`),
      ...(handoff.label && !selected.label_id ? [`${handoff.label} (sello)`] : [])
    ];
    handoffNotice = pending.length
      ? `Datos traídos de Sugerir. Aún no existen en el catálogo, créalos aquí: ${pending.join(', ')}.`
      : 'Datos traídos de Sugerir. Revisa y crea el borrador.';
  }

  // ---------------------------------------------------------------------------
  // Campos

  function updateTitle(value: string) {
    if (!selected) return;
    selected.title = value;
    if (!selected.id) selected.slug = slugifyReleaseIdentity(value);
    if (value.trim()) titleError = '';
  }
  function updateLabel(value: string) {
    if (!selected) return;
    labelText = value;
    selected.label_id = labels.find((label) => normalizeName(label.name) === normalizeName(value))?.id ?? null;
  }
  function updateBuyLink(value: string) {
    if (!selected) return;
    selected.links = withPrimaryLink(selected.links, value);
  }

  // ---------------------------------------------------------------------------
  // Guardar, publicar, archivar y revertir (E06, sin cambios de payload)

  async function fail(text: string, focusNote = false) {
    feedback = { tone: 'error', text };
    if (focusNote) {
      await tick();
      noteEl?.focus();
    }
  }

  function needsObservation() {
    if (observation.trim()) return false;
    void fail('Añade una observación del cambio. El historial auditado la exige.', true);
    return true;
  }

  function askFor(kind: 'publish' | 'archive', trigger: HTMLElement | null) {
    if (!selected) return;
    if (kind === 'publish') {
      const invalid = validateRelease(selected, true);
      if (invalid) return void fail(invalid);
    }
    if (needsObservation()) return;
    feedback = null;
    openDialog(kind, trigger);
  }

  async function submit(operation: 'update' | 'publish' | 'archive' = 'update') {
    if (!selected || busy) return;
    const invalid = validateRelease(selected, operation === 'publish');
    if (invalid) {
      if (!selected.title.trim()) titleError = invalid;
      return void fail(invalid);
    }
    if (needsObservation()) return;
    busy = true;
    feedback = null;
    try {
      const snapshot = $state.snapshot(selected) as CatalogSnapshot;
      const wasNew = !snapshot.id;
      const outcome = snapshot.id ? await saveCatalog(snapshot, observation, operation) : await createCatalog(snapshot, observation);
      await refresh(outcome.release_id);
      feedback = {
        tone: 'success',
        text: operation === 'archive' ? 'Lanzamiento archivado.' : operation === 'publish' ? 'Lanzamiento publicado.' : wasNew ? 'Borrador creado.' : 'Cambios guardados.'
      };
      observation = '';
      handoffNotice = '';
      if (wasNew) await oncreated(outcome.release_id);
    } catch (cause: any) {
      if (cause?.code === '40001') {
        await refresh().catch(() => {});
        feedback = { tone: 'error', text: 'Otra persona editó este lanzamiento. Cargamos la versión más reciente; revisa el historial antes de guardar.' };
      } else feedback = { tone: 'error', text: cause?.message || 'No se pudo guardar.' };
    } finally {
      busy = false;
      closeDialog();
    }
  }

  function askRevert(entry: CatalogHistory, trigger: HTMLElement) {
    pendingHistory = entry;
    revertReason = observation;
    openDialog('revert', trigger);
  }

  async function submitRevert() {
    if (!pendingHistory || !selected || busy) return;
    if (!revertReason.trim()) {
      dialogError = 'Añade una observación para explicar la reversión.';
      return;
    }
    busy = true;
    feedback = null;
    try {
      await revertCatalog(pendingHistory.change_set_id, pendingHistory.result_version, revertReason);
      await refresh();
      feedback = { tone: 'success', text: 'Cambio revertido mediante una nueva entrada auditada.' };
      observation = '';
    } catch (cause: any) {
      if (cause?.code === '40001') {
        await refresh().catch(() => {});
        feedback = { tone: 'error', text: 'No se revirtió porque existe una edición posterior. Cargamos el estado actual.' };
      } else feedback = { tone: 'error', text: cause?.message || 'No se pudo revertir.' };
    } finally {
      busy = false;
      closeDialog();
    }
  }

  // ---------------------------------------------------------------------------
  // Altas auditadas: artista, sello y género (E06/E07)

  function openDialog(kind: Exclude<DialogKind, null>, trigger: HTMLElement | null = null) {
    dialogError = '';
    returnFocus = trigger ?? (document.activeElement as HTMLElement | null);
    dialog = kind;
    dialogOpen = true;
  }

  function closeDialog() {
    pendingCreate?.(null);
    pendingCreate = null;
    dialogOpen = false;
    dialog = null;
    pendingHistory = null;
  }

  /** Abre la confirmación del alta y espera a que se cree o se cancele. */
  function requestCreate(kind: 'artist' | 'label' | 'genre', name: string) {
    pendingCreate?.(null);
    return new Promise<DictionaryEntry | null>((resolve) => {
      if (kind === 'artist') artistName = name;
      else {
        dictionaryName = name;
        dictionaryReason = '';
      }
      openDialog(kind);
      pendingCreate = resolve;
    });
  }

  async function confirmArtist() {
    if (!artistName.trim() || busy) return;
    busy = true;
    dialogError = '';
    try {
      const result = await createArtist(artistName);
      const artist = { id: result.artist_id, name: result.name };
      feedback = { tone: 'success', text: result.created ? 'Artista creado y añadido al lanzamiento.' : 'Usamos la identidad canónica existente.' };
      pendingCreate?.(artist);
      pendingCreate = null;
      artistName = '';
      closeDialog();
    } catch (cause: any) {
      dialogError = cause?.message || 'No se pudo crear el artista.';
    } finally {
      busy = false;
    }
  }

  async function confirmDictionary() {
    if (!selected || (dialog !== 'label' && dialog !== 'genre') || busy) return;
    if (!dictionaryName.trim()) return void (dialogError = 'Escribe el nombre que quieres dar de alta.');
    if (!dictionaryReason.trim()) return void (dialogError = 'Añade una observación para auditar esta alta.');
    const kind = dialog;
    busy = true;
    dialogError = '';
    try {
      const result = kind === 'label' ? await createLabel(dictionaryName, dictionaryReason) : await createGenre(dictionaryName, dictionaryReason);
      const entry = { id: result.id, name: result.name };
      const sorted = (list: DictionaryEntry[]) => [...list.filter((item) => item.id !== entry.id), entry].sort((a, b) => a.name.localeCompare(b.name, 'es'));
      if (kind === 'label') {
        labels = sorted(labels);
        selected.label_id = entry.id;
        labelText = entry.name;
      } else {
        genres = sorted(genres);
        // Sin combobox esperando (no debería pasar), se añade igual que en E07.
        if (!pendingCreate && !selected.genre_ids.includes(entry.id)) selected.genre_ids = [...selected.genre_ids, entry.id];
      }
      feedback = { tone: 'success', text: result.created ? `${kind === 'label' ? 'Sello' : 'Género'} creado y auditado.` : 'Usamos el valor canónico existente.' };
      pendingCreate?.(entry);
      pendingCreate = null;
      dictionaryName = '';
      dictionaryReason = '';
      closeDialog();
    } catch (cause: any) {
      dialogError = cause?.code === '42501' ? 'El servidor denegó el alta administrativa.' : cause?.message || 'No se pudo crear el valor.';
    } finally {
      busy = false;
    }
  }

  async function createGenreOption(text: string) {
    const entry = await requestCreate('genre', text);
    return entry ? { value: entry.id, label: entry.name } : null;
  }

  async function createArtistEntry(text: string) {
    const entry = await requestCreate('artist', text);
    return entry ? { id: entry.id, name: entry.name } : null;
  }

  // ---------------------------------------------------------------------------
  // Índice: lleva a cada sección y marca la que se está viendo.

  async function goTo(id: EditorSectionId) {
    activeSection = id;
    const target = document.getElementById(editorSectionAnchor(id));
    if (!target) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    // El foco va un frame después. Con el salto instantáneo, el header veía el
    // scroll unas veces con el foco aún en el selector (se queda) y otras ya en
    // el h2 (se oculta); así siempre lo ve antes del cambio de foco.
    const heading = target.querySelector<HTMLElement>('h2');
    requestAnimationFrame(() => heading?.focus({ preventScroll: true }));
  }

  $effect(() => {
    if (!selected || loading || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) activeSection = entry.target.getAttribute('data-section') as EditorSectionId;
        }
      },
      { rootMargin: '-20% 0px -70% 0px', threshold: 0 }
    );
    for (const section of EDITOR_SECTIONS) {
      const element = document.getElementById(editorSectionAnchor(section.id));
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  });
</script>

<svelte:head><title>{selected ? `${selected.title || 'Nuevo lanzamiento'} · ` : ''}Catálogo · Estudio — Discótica</title></svelte:head>

{#if loading && !selected}
  <div class="editor__state"><LoadingIndicator label="Abriendo el lanzamiento" /></div>
{:else if loadError || !selected}
  <ErrorState size="inline" message={loadError || 'No se pudo abrir el lanzamiento.'} actionLabel="Volver al catálogo" onaction={onclose} />
{:else}
  {@const release = selected}
  <div class="editor">
    <header class="editor__head">
      <IconButton icon="flecha-izquierda" label="Volver al catálogo" variant="secondary" tooltip="bottom" tooltipAlign="start" onclick={onclose} />
      <Cover class="editor__thumb" src={release.cover_url} alt="" radius="sm" loading="eager" />
      <div class="editor__identity">
        <p class="editor__eyebrow">{release.id ? 'Editar lanzamiento' : 'Nuevo lanzamiento'}</p>
        <h1 class="editor__title">{release.title || 'Sin título'}</h1>
        <p class="editor__artists">{artistLine || 'Añade un artista principal'}</p>
      </div>
      <div class="editor__meta">
        <Chip kind="status" tone={STATUS_TONES[release.status]} label={STATUS_LABELS[release.status]} />
        {#if release.id}<span class="editor__version">v{release.catalog_version}</span>{/if}
        {#if reports && release.id}<a class="editor__reports" href={studioReportsHref(release.id)}>{reports === 1 ? '1 reporte' : `${reports} reportes`}</a>{/if}
        {#if menuItems.length}
          <Menu label="Más acciones" items={menuItems} />
        {/if}
      </div>
    </header>

    {#if handoffNotice}<Notice class="editor__handoff">{handoffNotice}</Notice>{/if}

    <div class="editor__layout">
      <aside class="editor__aside">
        <nav class="editor__index" aria-label="Secciones del lanzamiento">
          <ol>
            {#each EDITOR_SECTIONS as section (section.id)}
              {@const count = section.id === 'historial' ? history.length : missingIn?.[section.id].length ?? 0}
              <li>
                <a
                  class="editor__index-link"
                  href="#{editorSectionAnchor(section.id)}"
                  aria-current={activeSection === section.id ? 'location' : undefined}
                  onclick={(event) => { event.preventDefault(); void goTo(section.id); }}
                >
                  <span>{section.label}</span>
                  {#if section.id === 'historial'}
                    {#if count}<span class="editor__tally">{count}</span>{/if}
                  {:else if count}
                    <span class="editor__tally editor__tally--missing">falta {count}</span>
                  {/if}
                </a>
              </li>
            {/each}
          </ol>
        </nav>
        <div class="editor__jump">
          <Select label="Ir a la sección" hideLabel icon="lista" options={sectionOptions} value={activeSection} onchange={(value) => void goTo(value as EditorSectionId)} />
        </div>
        <p class="editor__readiness" class:editor__readiness--ok={!missing.length}>
          {#if missing.length}<span class="editor__readiness-label">Para publicar falta:</span> {missing.join(', ')}{:else}Listo para publicar.{/if}
        </p>
      </aside>

      <div class="editor__body">
        <section class="editor__section" id={editorSectionAnchor('datos')} data-section="datos" aria-labelledby="editor-h-datos">
          <header class="editor__section-head">
            <h2 id="editor-h-datos" tabindex="-1">Datos</h2>
            {#if missingIn?.datos.length}<span class="editor__section-missing">Falta: {missingIn.datos.join(', ')}</span>{/if}
          </header>
          <div class="editor__grid">
            <Field
              class="editor__span-4"
              label="Título"
              required
              value={release.title}
              error={titleError}
              placeholder="Título del lanzamiento"
              oninput={(event: Event) => updateTitle((event.currentTarget as HTMLInputElement).value)}
            />
            <Select
              class="editor__span-2"
              label="Tipo"
              options={typeOptions}
              value={release.release_type_id ?? ''}
              onchange={(value) => (release.release_type_id = value || null)}
            />
            <Field
              class="editor__span-2"
              label="Fecha de lanzamiento"
              type="date"
              value={release.release_date ?? ''}
              oninput={(event: Event) => (release.release_date = (event.currentTarget as HTMLInputElement).value)}
            />
            <Field
              class="editor__span-4"
              label="Sello"
              value={labelText}
              list="editor-labels"
              autocomplete="off"
              placeholder="Busca un sello existente"
              oninput={(event: Event) => updateLabel((event.currentTarget as HTMLInputElement).value)}
            >
              {#snippet below()}
                {#if labelText.trim() && !release.label_id}
                  <p class="editor__label-missing">
                    No coincide con un sello existente.
                    <Button variant="link" size="sm" onclick={() => void requestCreate('label', labelText.trim())}>Crear sello «{labelText.trim()}»</Button>
                  </p>
                {/if}
              {/snippet}
            </Field>
            <datalist id="editor-labels">{#each labels as label (label.id)}<option value={label.name}></option>{/each}</datalist>
          </div>
          <details class="editor__more">
            <summary><span class="editor__chevron" aria-hidden="true"><Icon name="chevron-derecha" size="sm" /></span>Reseña <span class="editor__optional">(opcional)</span></summary>
            <Textarea label="Texto editorial" hideLabel rows={4} bind:value={release.review} placeholder="Añade una reseña solo cuando aporte contexto." />
          </details>
          {#if release.id}
            <details class="editor__more">
              <summary><span class="editor__chevron" aria-hidden="true"><Icon name="chevron-derecha" size="sm" /></span>Datos técnicos</summary>
              <dl class="editor__tech">
                <dt>ID</dt><dd>{release.id}</dd>
                <dt>Identificador</dt><dd>{release.slug}</dd>
                <dt>Última edición</dt><dd>{formatDate(release.updated_at)}</dd>
              </dl>
            </details>
          {/if}
        </section>

        <section class="editor__section" id={editorSectionAnchor('creditos')} data-section="creditos" aria-labelledby="editor-h-creditos">
          <header class="editor__section-head">
            <h2 id="editor-h-creditos" tabindex="-1">Créditos</h2>
            {#if missingIn?.creditos.length}<span class="editor__section-missing">Falta: {missingIn.creditos.join(', ')}</span>{/if}
          </header>
          <EditorCredits bind:release={selected} bind:artists oncreateartist={createArtistEntry} onmessage={(text) => fail(text)} />
        </section>

        <section class="editor__section" id={editorSectionAnchor('clasificacion')} data-section="clasificacion" aria-labelledby="editor-h-clasificacion">
          <header class="editor__section-head">
            <h2 id="editor-h-clasificacion" tabindex="-1">Clasificación</h2>
            {#if missingIn?.clasificacion.length}<span class="editor__section-missing">Falta: {missingIn.clasificacion.join(', ')}</span>{/if}
          </header>
          <div class="editor__pair">
            <Combobox
              label="Géneros"
              options={genreOptions}
              bind:value={release.genre_ids}
              allowCreate
              createLabel={(text) => `Crear género «${text}»`}
              oncreate={createGenreOption}
              placeholder="Buscar género"
              removeLabel={(text) => `Quitar género ${text}`}
            />
            <Combobox
              label="Países"
              options={countryOptions}
              bind:value={release.country_ids}
              placeholder="Buscar país"
              removeLabel={(text) => `Quitar país ${text}`}
            />
          </div>
          <fieldset class="editor__radar">
            <legend>Radar</legend>
            <div class="editor__radar-row">
            <div class="editor__radar-chart" aria-hidden="true"><RadarMini valores={release.radar} /></div>
            <div class="editor__radar-controls">
              {#each RADAR as axis (axis.key)}
                <label class="editor__slider">
                  <span>{axis.label}</span>
                  <input type="range" min="0" max="5" step="1" bind:value={release.radar[axis.key]} />
                  <output aria-hidden="true">{release.radar[axis.key]}</output>
                </label>
              {/each}
            </div>
            </div>
          </fieldset>
        </section>

        <section class="editor__section" id={editorSectionAnchor('medios')} data-section="medios" aria-labelledby="editor-h-medios">
          <header class="editor__section-head">
            <h2 id="editor-h-medios" tabindex="-1">Medios</h2>
            {#if missingIn?.medios.length}<span class="editor__section-missing">Falta: {missingIn.medios.join(', ')}</span>{/if}
          </header>
          <div class="editor__media">
            <Cover class="editor__cover" src={release.cover_url} alt={release.cover_url ? `Portada de ${release.title || 'lanzamiento'}` : ''} radius="sm" />
            <div class="editor__media-fields">
              <Field
                label="Link de compra o escucha"
                type="url"
                value={link?.url ?? ''}
                placeholder="https://bandcamp.com/…"
                hint={link?.url ? `Proveedor: ${inferProvider(link.url)}.` : 'Detectamos el proveedor a partir de la URL.'}
                oninput={(event: Event) => updateBuyLink((event.currentTarget as HTMLInputElement).value)}
              />
              <Field
                label="URL de portada"
                type="url"
                value={release.cover_url ?? ''}
                oninput={(event: Event) => (release.cover_url = (event.currentTarget as HTMLInputElement).value)}
                placeholder="https://…"
                hint="Pega una URL HTTPS. La detección automática llegará después."
              />
              {#if extraLinks}<p class="editor__extra">{extraLinks === 1 ? 'Hay 1 enlace adicional' : `Hay ${extraLinks} enlaces adicionales`}; se conservan al guardar.</p>{/if}
            </div>
          </div>
        </section>

        <section class="editor__section" id={editorSectionAnchor('historial')} data-section="historial" aria-labelledby="editor-h-historial">
          <header class="editor__section-head">
            <h2 id="editor-h-historial" tabindex="-1">Historial</h2>
            <span class="editor__section-note">Cada entrada conserva quién, la observación y las versiones.</span>
          </header>
          <EditorHistory {history} unsaved={!release.id} disabled={busy} onrevert={askRevert} />
        </section>

        <div class="editor__bar" role="region" aria-label="Guardar">
          <div class="editor__bar-status" aria-live="polite">
            {#if feedback}
              <p class="editor__feedback editor__feedback--{feedback.tone}" role={feedback.tone === 'error' ? 'alert' : 'status'}>{feedback.text}</p>
            {:else}
              <p class="editor__dirty" class:editor__dirty--clean={!dirty && !!release.id}>{dirty ? 'Cambios sin guardar.' : release.id ? 'Sin cambios.' : 'Borrador nuevo, sin guardar.'}</p>
            {/if}
          </div>
          <div class="editor__bar-row">
            <Field
              class="editor__note"
              label="Observación del cambio"
              hideLabel
              required
              bind:value={observation}
              bind:element={noteEl}
              placeholder="¿Qué cambió?"
              autocomplete="off"
              onkeydown={(event: KeyboardEvent) => { if (event.key === 'Enter') { event.preventDefault(); void submit(); } }}
            />
            <div class="editor__bar-actions">
              {#if release.id && release.status !== 'published'}
                <Button variant="accent" disabled={busy || missing.length > 0} onclick={(event: MouseEvent) => askFor('publish', event.currentTarget as HTMLElement)}>Publicar</Button>
              {/if}
              <Button loading={busy && !dialogOpen} onclick={() => submit()}>{release.id ? 'Guardar cambios' : 'Crear borrador'}</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}

<Dialog bind:open={dialogOpen} title={dialogTitle} size="sm" dismissible={!busy} {returnFocus} onclose={closeDialog} initialFocus="[data-dialog-focus]">
  {#if dialog === 'publish' && selected}
    <p class="editor__dialog-text"><strong>{selected.title}</strong> quedará visible en el catálogo. Se registrarán la observación y la versión actual.</p>
    <dl class="editor__dialog-facts">
      <dt>Artistas</dt><dd>{artistLine}</dd>
      <dt>Fecha</dt><dd>{formatDate(selected.release_date)}</dd>
    </dl>
  {:else if dialog === 'archive'}
    <p class="editor__dialog-text">El lanzamiento dejará de aparecer públicamente. Su identidad, colecciones e historial se conservarán.</p>
  {:else if dialog === 'revert' && pendingHistory}
    <p class="editor__dialog-text">Se restaurará el estado anterior a «{pendingHistory.reason}» mediante un nuevo cambio auditado. No se sobrescribirán ediciones posteriores.</p>
    <Textarea label="Observación de la reversión" required rows={2} bind:value={revertReason} placeholder="¿Por qué se revierte?" data-dialog-focus />
  {:else if dialog === 'artist'}
    <p class="editor__dialog-text">Confirma que la identidad no aparece en la búsqueda. El servicio normaliza el nombre para evitar duplicados.</p>
    <Field label="Nombre artístico" bind:value={artistName} placeholder="Nombre exacto" data-dialog-focus />
  {:else if dialog === 'label' || dialog === 'genre'}
    <p class="editor__dialog-text">Confirma esta alta administrativa. El servidor normaliza el nombre, evita duplicados y registra quién la hizo, la razón y el resultado.</p>
    <Field label={dialog === 'label' ? 'Nombre del sello' : 'Nombre del género'} bind:value={dictionaryName} placeholder={dialog === 'label' ? 'Nombre del sello' : 'Nombre del género'} data-dialog-focus />
    <Textarea label="Observación de la alta" required rows={2} bind:value={dictionaryReason} placeholder="¿Por qué se crea este valor?" />
  {/if}
  {#if dialogError}<Notice tone="error" class="editor__dialog-error">{dialogError}</Notice>{/if}
  {#snippet footer()}
    <Button variant="secondary" disabled={busy} onclick={closeDialog}>{dialog === 'publish' ? 'Seguir editando' : 'Cancelar'}</Button>
    {#if dialog === 'publish'}
      <Button loading={busy} onclick={() => submit('publish')} data-dialog-focus>Confirmar publicación</Button>
    {:else if dialog === 'archive'}
      <Button variant="destructive" loading={busy} onclick={() => submit('archive')} data-dialog-focus>Archivar</Button>
    {:else if dialog === 'revert'}
      <Button variant="destructive" loading={busy} onclick={submitRevert}>Revertir cambio</Button>
    {:else if dialog === 'artist'}
      <Button loading={busy} disabled={!artistName.trim()} onclick={confirmArtist}>Crear y añadir</Button>
    {:else if dialog === 'label' || dialog === 'genre'}
      <Button loading={busy} disabled={!dictionaryName.trim() || !dictionaryReason.trim()} onclick={confirmDictionary}>Confirmar y auditar</Button>
    {/if}
  {/snippet}
</Dialog>

<style>
  .editor { color: var(--color-texto); }
  .editor__state { display: grid; place-items: center; min-height: 16rem; }

  /* ---- Cabecera -------------------------------------------------------- */
  .editor__head {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin-bottom: var(--density-gap);
  }
  .editor__head :global(.editor__thumb) {
    flex: 0 0 var(--tool-thumb);
    width: var(--tool-thumb);
    height: var(--tool-thumb);
  }
  .editor__identity { flex: 1; min-width: 0; }
  .editor__eyebrow {
    margin: 0;
    color: var(--color-acento);
    font-size: var(--text-2xs);
    font-weight: 700;
    letter-spacing: var(--nav-letter-spacing);
    text-transform: uppercase;
  }
  .editor__title {
    margin: 0;
    overflow: hidden;
    color: var(--color-texto);
    font-size: var(--text-lg);
    font-weight: 700;
    line-height: var(--leading-heading);
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .editor__artists {
    margin: 0;
    overflow: hidden;
    color: var(--color-texto-tenue);
    font-size: var(--text-xs);
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .editor__meta { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: var(--space-2); }
  .editor__version { color: var(--color-texto-tenue); font-size: var(--text-2xs); font-variant-numeric: tabular-nums; }
  .editor__reports { color: var(--color-danger-texto); font-size: var(--text-2xs); }
  .editor__reports:hover { color: var(--color-texto); }

  .editor > :global(.editor__handoff) { margin-bottom: var(--density-gap); }

  /* ---- Índice y cuerpo ------------------------------------------------- */
  .editor__layout {
    display: grid;
    grid-template-columns: var(--tool-index-w) minmax(0, 1fr);
    gap: var(--space-5);
    align-items: start;
  }

  .editor__aside {
    position: sticky;
    top: calc(var(--header-offset) + var(--space-5));
    transition: top var(--motion-slow) var(--ease-emphasized);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .editor__index ol {
    display: flex;
    flex-direction: column;
    margin: 0;
    padding: 0;
    list-style: none;
    border-left: 1px solid var(--color-linea);
  }
  .editor__index-link {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    min-height: var(--target-touch);
    margin-left: -1px;
    padding: 0 var(--space-3);
    border-left: 2px solid transparent;
    color: var(--color-texto-medio);
    font-size: var(--density-text);
    font-weight: 600;
    text-decoration: none;
    transition: color var(--motion-fast) var(--ease-standard), border-color var(--motion-fast) var(--ease-standard);
  }
  .editor__index-link:hover { color: var(--color-texto); }
  .editor__index-link[aria-current='location'] { border-left-color: var(--color-acento); color: var(--color-acento); }
  .editor__tally { color: var(--color-texto-tenue); font-size: var(--text-2xs); font-weight: 500; font-variant-numeric: tabular-nums; }
  .editor__tally--missing { color: var(--color-aviso); }

  .editor__jump { display: none; }

  .editor__readiness {
    margin: 0;
    padding: var(--space-3) var(--space-3) 0;
    border-top: 1px solid var(--color-linea);
    color: var(--color-aviso);
    font-size: var(--text-2xs);
    line-height: 1.5;
  }
  .editor__readiness-label { color: var(--color-texto-tenue); }
  .editor__readiness--ok { color: var(--color-acento); }

  .editor__body { display: flex; flex-direction: column; gap: var(--space-3); min-width: 0; }

  .editor__section {
    padding: var(--density-pad);
    border: 1px solid var(--color-borde);
    border-radius: var(--radius-sm);
    background: var(--color-panel);
    scroll-margin-top: calc(var(--header-offset) + var(--space-5));
  }
  .editor__section-head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-1) var(--space-3);
    margin-bottom: var(--space-3);
  }
  .editor__section-head h2 { margin: 0; font-size: var(--text-md); font-weight: 700; }
  .editor__section-head h2:focus { outline: none; }
  .editor__section-missing { color: var(--color-aviso); font-size: var(--text-2xs); }
  .editor__section-note { color: var(--color-texto-tenue); font-size: var(--text-2xs); }

  /* ---- Datos ------------------------------------------------------------ */
  .editor__grid {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: var(--space-3) var(--density-gap);
  }
  .editor__grid :global(.editor__span-4) { grid-column: span 4; }
  .editor__grid :global(.editor__span-2) { grid-column: span 2; }
  .editor__label-missing {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0 var(--space-2);
    margin: 0;
    color: var(--color-aviso);
    font-size: var(--text-2xs);
  }

  .editor__more { margin-top: var(--space-3); }
  .editor__more summary {
    display: inline-flex;
    align-items: center;
    min-height: var(--target-touch);
    color: var(--color-texto-medio);
    font-size: var(--text-sm);
    font-weight: 600;
    cursor: pointer;
  }
  .editor__more summary { gap: var(--space-1); list-style: none; }
  .editor__more summary::-webkit-details-marker { display: none; }
  .editor__chevron { display: flex; color: var(--color-texto-tenue); transition: transform var(--motion-fast) var(--ease-standard); }
  .editor__more[open] .editor__chevron { transform: rotate(90deg); }
  .editor__optional { margin-left: .3em; color: var(--color-texto-tenue); font-weight: 400; }
  .editor__tech {
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr);
    gap: var(--space-1) var(--space-3);
    margin: 0;
    font-size: var(--text-2xs);
  }
  .editor__tech dt { color: var(--color-texto-tenue); }
  .editor__tech dd { margin: 0; overflow-wrap: anywhere; color: var(--color-texto-alto); font-variant-numeric: tabular-nums; }

  /* ---- Clasificación ---------------------------------------------------- */
  .editor__pair {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-3) var(--density-gap);
    align-items: start;
  }
  .editor__radar {
    margin: var(--space-4) 0 0;
    padding: var(--space-3) 0 0;
    border: 0;
    border-top: 1px solid var(--color-borde);
  }
  .editor__radar legend {
    margin-bottom: var(--space-2);
    padding: 0;
    color: var(--color-texto-alto);
    font-size: var(--text-sm);
    font-weight: 600;
  }
  .editor__radar-row {
    display: grid;
    grid-template-columns: var(--tool-radar) minmax(0, 1fr);
    align-items: center;
    gap: var(--space-6);
  }
  /* Las etiquetas del radar salen del dibujo: margen para que no se corten. */
  .editor__radar-chart { width: var(--tool-radar); padding-inline: var(--space-4); box-sizing: content-box; }
  .editor__radar-chart :global(svg) { display: block; width: 100%; height: auto; overflow: visible; }
  .editor__radar-controls {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0 var(--space-5);
  }
  .editor__slider {
    display: grid;
    grid-template-columns: 5.5rem minmax(0, 1fr) 1.5ch;
    align-items: center;
    gap: var(--space-2);
    min-height: var(--target-touch);
    color: var(--color-texto-medio);
    font-size: var(--text-xs);
  }
  .editor__slider input { width: 100%; min-height: var(--target-touch); margin: 0; accent-color: var(--color-acento); }
  .editor__slider output { color: var(--color-acento); font-weight: 700; font-variant-numeric: tabular-nums; text-align: right; }

  /* ---- Medios ----------------------------------------------------------- */
  .editor__media {
    display: grid;
    grid-template-columns: var(--tool-cover) minmax(0, 1fr);
    gap: var(--density-gap);
    align-items: start;
  }
  .editor__media :global(.editor__cover) { width: var(--tool-cover); height: var(--tool-cover); }
  .editor__media-fields { display: flex; flex-direction: column; gap: var(--space-3); min-width: 0; }
  .editor__extra { margin: 0; color: var(--color-texto-tenue); font-size: var(--text-2xs); }

  /* ---- Barra de guardar: fija abajo mientras se edita ------------------ */
  .editor__bar {
    position: sticky;
    bottom: 0;
    z-index: var(--layer-sticky);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin-top: var(--space-2);
    padding: var(--space-3) var(--density-pad) calc(var(--space-3) + var(--safe-area-bottom));
    border: 1px solid var(--color-linea);
    border-radius: var(--radius-sm);
    background: var(--color-panel);
    box-shadow: var(--shadow-flotante);
  }
  .editor__bar-status p { margin: 0; font-size: var(--text-2xs); }
  .editor__dirty { color: var(--color-texto-tenue); }
  .editor__feedback--error { color: var(--color-danger-texto); font-weight: 600; }
  .editor__feedback--success { color: var(--color-acento); }
  .editor__bar-row { display: flex; align-items: center; gap: var(--space-3); }
  .editor__bar-row :global(.editor__note) { flex: 1; }
  .editor__bar-actions { display: flex; gap: var(--space-2); }

  /* ---- Diálogos --------------------------------------------------------- */
  .editor__dialog-text { margin: 0 0 var(--space-3); color: var(--color-texto-medio); font-size: var(--text-sm); line-height: 1.5; }
  .editor__dialog-facts {
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr);
    gap: var(--space-2) var(--space-4);
    margin: 0;
    font-size: var(--text-sm);
  }
  .editor__dialog-facts dt { color: var(--color-texto-tenue); }
  .editor__dialog-facts dd { margin: 0; color: var(--color-texto); }
  :global(.editor__dialog-error) { margin-top: var(--space-3); }

  /* ---- Tablet: el índice sigue al lado, más estrecho ------------------- */
  @media (max-width: 1023px) {
    .editor__grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    /* Título y sello a todo el ancho; tipo y fecha comparten fila. */
    .editor__grid :global(.editor__span-4) { grid-column: 1 / -1; }
    .editor__grid :global(.editor__span-2) { grid-column: span 1; }
    .editor__pair { grid-template-columns: minmax(0, 1fr); }
    .editor__radar-controls { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }

  /* ---- Móvil: una columna, el índice es un selector y la barra va abajo - */
  @media (max-width: 767px) {
    .editor__head { flex-wrap: wrap; }
    .editor__meta { flex-basis: 100%; justify-content: flex-start; }
    /* En bloque, no en grilla: el selector fijo necesita toda la página como
       bloque contenedor (en una grilla sería solo su fila). */
    .editor__layout { display: block; }
    .editor__body { margin-top: var(--space-3); }
    .editor__aside {
      top: var(--header-offset);
      z-index: var(--layer-sticky);
      gap: var(--space-1);
      margin-inline: calc(-1 * var(--container-gutter));
      padding: var(--space-2) var(--container-gutter);
      border-bottom: 1px solid var(--color-linea);
      background: var(--color-fondo);
    }
    .editor__index { display: none; }
    .editor__jump { display: block; }
    .editor__readiness { padding: 0; border: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
    .editor__section { margin-inline: calc(-1 * var(--container-gutter)); border-inline: 0; border-radius: 0; scroll-margin-top: calc(var(--field-h-md) + var(--space-7)); }
    .editor__grid { grid-template-columns: minmax(0, 1fr); }
    .editor__grid :global(.editor__span-4),
    .editor__grid :global(.editor__span-2) { grid-column: 1 / -1; }
    .editor__media { grid-template-columns: minmax(0, 1fr); }
    .editor__radar-row { grid-template-columns: minmax(0, 1fr); justify-items: center; }
    .editor__radar-controls { width: 100%; grid-template-columns: minmax(0, 1fr); }
    .editor__bar {
      margin-inline: calc(-1 * var(--container-gutter));
      padding-inline: var(--container-gutter);
      border-inline: 0;
      border-radius: 0;
    }
    .editor__bar-status:has(.editor__dirty--clean) { display: none; }
    .editor__bar-row { flex-direction: column; align-items: stretch; gap: var(--space-2); }
    .editor__bar-actions > :global(*) { flex: 1; }
  }

  @media (prefers-reduced-motion: reduce) {
    .editor__index-link,
    .editor__chevron,
    .editor__aside { transition: none; }
  }
</style>
