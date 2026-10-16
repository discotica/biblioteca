<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { goto, pushState } from '$app/navigation';
  import { page } from '$app/state';
  import PageLayout from '$lib/layouts/PageLayout.svelte';
  import RadarControls from '$lib/components/RadarControls.svelte';
  import { Button, Checkbox, Combobox, Cover, Field, Icon, LoadingIndicator, Notice, Select, Textarea, type ComboboxOption } from '$lib/ui';
  import { normalizeSearch } from '$lib/ui/combobox';
  import { user } from '$lib/stores/authStore';
  import { knownProfileRole, loadProfileRole } from '$lib/stores/profileRole';
  import {
    CONTRIBUTION_STEPS,
    errorsForStep,
    firstInvalidField,
    firstStepWithError,
    stepOfField,
    visibleStep,
    type ContributionField,
    type ContributionStep
  } from '$lib/domain/contributionSteps';
  import {
    RADAR_AXES,
    completeRadar,
    describeContributionError,
    type CatalogCreation,
    type ContributionRadar
  } from '$lib/domain/contributionContract';
  import {
    compareNames,
    doneScreen,
    duplicateNotice,
    pinIndependent,
    similarSearchTerms,
    submitLabel,
    submitLead
  } from '$lib/domain/suggestFlow';
  import { studioReleaseHref } from '$lib/domain/studio';
  import {
    RELEASE_TYPE_OPTIONS,
    adminCreateDraftFromSuggestion,
    checkSourceDuplicate,
    contributionFieldErrors,
    createContributionDraft,
    inspectSource,
    loadContribution,
    loadContributionDictionaries,
    saveContributionDraft,
    searchArtistNames,
    searchLabelNames,
    similarCatalogNames,
    sourceProviderFor,
    submitContribution,
    type ContributionFieldErrors,
    type ContributionPayload,
    type ContributionStatus,
    type DetectedMetadata,
    type ProfileRole,
    type ReleaseTypeSlug
  } from '$lib/stores/contributionsStore';

  // Sugerir por pasos (U13): fuente → revisar datos → nota → enviar. Desde U19 es la única
  // entrada para crear, también para admin y desde «Nuevo lanzamiento» del Estudio. Lo que cambia
  // por rol es el envío: comunidad y colaborador mandan a su cola; admin crea un borrador del
  // catálogo. Entre visitas, el borrador de la propuesta (Guardar borrador y /sugerir?draft=<uuid>).

  type StepState = { sugerirPaso?: ContributionStep };

  const editorialEnabled = import.meta.env.VITE_EDITORIAL_ENABLED === 'true';
  const SOURCE_ERROR = 'Usa una URL HTTPS de Bandcamp, Spotify o SoundCloud.';
  const FIELD_IDS: Record<ContributionField, string> = {
    source: 'source-url',
    title: 'title',
    primary_artists: 'primary-artists',
    release_type: 'release-type',
    release_date: 'release-date',
    genres: 'genres',
    countries: 'countries',
    label: 'label'
  };
  const RADAR_LABELS: Record<(typeof RADAR_AXES)[number], string> = {
    experimental: 'Experimental',
    denso: 'Denso',
    sintetico: 'Sintético',
    bailable: 'Bailable',
    rapido: 'Rápido'
  };
  const typeOptions = [{ value: '', label: 'Selecciona y confirma' }, ...RELEASE_TYPE_OPTIONS];
  const emptyRadar = (): ContributionRadar => ({ experimental: 0, denso: 0, sintetico: 0, bailable: 0, rapido: 0 });

  let sourceUrl = $state('');
  let title = $state('');
  let primaryArtists = $state<string[]>([]);
  let collaborators = $state<string[]>([]);
  let releaseType = $state<ReleaseTypeSlug | ''>('');
  let releaseDate = $state('');
  let genres = $state<string[]>([]);
  let countries = $state<string[]>([]);
  /** El sello es un Combobox de un solo valor: lista de cero o un nombre. */
  let labelValue = $state<string[]>([]);
  let radarOn = $state(false);
  let radar = $state<ContributionRadar>(emptyRadar());
  let teamNote = $state('');
  let detectedMetadata = $state<DetectedMetadata>({});
  /** URL de la última detección: si no cambia, el paso 1 solo continúa. */
  let detectedUrl = $state('');
  /** Ya hay datos que revisar (detectados, escritos o de un borrador). */
  let hasData = $state(false);
  let detectionState = $state<'idle' | 'loading' | 'available' | 'unavailable'>('idle');
  /** Aviso de duplicado de la última detección (U19). */
  let duplicate = $state<ReturnType<typeof duplicateNotice>>(null);
  let draftId = $state('');
  let resumedStatus = $state<ContributionStatus | null>(null);
  let reviewerNote = $state('');
  let loadingDraft = $state(false);
  let busy = $state<'save' | 'submit' | ''>('');
  let error = $state('');
  let success = $state(false);
  /** Borrador del catálogo que creó admin. */
  let created = $state<CatalogCreation | null>(null);
  let saved = $state('');
  let fieldErrors = $state<ContributionFieldErrors>({});
  // Todos los roles con sesión ven el formulario al instante; el rol se lee en paralelo y solo
  // decide el envío.
  const initialRole = knownProfileRole($user?.id);
  let role = $state<ProfileRole | ''>(initialRole ?? '');
  let roleLoaded = $state(initialRole !== null);
  /** Paso inicial sin entrada en el historial: el 2 al retomar un borrador. */
  let fallbackStep = $state<ContributionStep>(1);
  let sourceInput = $state<HTMLInputElement>();
  let stepHeading = $state<HTMLHeadingElement>();
  let genreOptions = $state<ComboboxOption[]>([]);
  let countryOptions = $state<ComboboxOption[]>([]);

  const step = $derived(visibleStep((page.state as StepState).sugerirPaso, hasData, fallbackStep));
  const draftParam = $derived(page.url.searchParams.get('draft'));
  // Admin no guarda borradores de propuesta: su envío crea directamente el borrador del catálogo.
  const isAdmin = $derived(role === 'admin');
  const canSaveDraft = $derived(resumedStatus !== 'changes_requested' && roleLoaded && !isAdmin);
  const loginHref = $derived(`/auth/login?redirect=${encodeURIComponent(page.url.pathname + page.url.search)}`);
  const sourceUnchanged = $derived(hasData && sourceUrl.trim() === detectedUrl);
  const typeLabel = $derived(RELEASE_TYPE_OPTIONS.find((option) => option.value === releaseType)?.label ?? '');
  const label = $derived(labelValue[0]?.trim() ?? '');
  const done = $derived(doneScreen(role, created ? studioReleaseHref(created.release_id) : null));

  /** Búsqueda de nombres del catálogo para un Combobox (con "Añadir" si no existe). */
  class NameSearch {
    query = $state('');
    found = $state<string[]>([]);
    loading = $state(false);
    #timer: ReturnType<typeof setTimeout> | undefined;
    #sequence = 0;
    #search: (query: string) => Promise<string[]>;

    constructor(search: (query: string) => Promise<string[]>) {
      this.#search = search;
    }

    run(query: string) {
      clearTimeout(this.#timer);
      const sequence = ++this.#sequence;
      if (query.trim().length < 2) {
        this.found = [];
        this.loading = false;
        return;
      }
      this.loading = true;
      this.#timer = setTimeout(async () => {
        const found = await this.#search(query).catch(() => [] as string[]);
        if (sequence !== this.#sequence) return;
        this.found = found;
        this.loading = false;
      }, 200);
    }
  }
  const asOptions = (names: string[]) => names.map((name) => ({ value: name, label: name }));
  const primarySearch = new NameSearch(searchArtistNames);
  const collaboratorSearch = new NameSearch(searchArtistNames);
  const labelSearch = new NameSearch(searchLabelNames);
  $effect(() => primarySearch.run(primarySearch.query));
  $effect(() => collaboratorSearch.run(collaboratorSearch.query));
  $effect(() => labelSearch.run(labelSearch.query));
  // «Independiente» siempre arriba (U19), también antes de escribir.
  const labelOptions = $derived(asOptions(pinIndependent(labelSearch.found)));

  /**
   * Aviso de nombres parecidos (U19): un artista o sello que no está en el catálogo se crea al
   * aceptar (o al crear el borrador, si es admin). Al escribir uno nuevo («Añadir «…»»), Sugerir
   * enseña los que se escriben casi igual para elegir el existente. Los detectados en la fuente no
   * avisan: un compilado traería decenas de avisos.
   */
  class SimilarNames {
    similar = $state<Record<string, string[]>>({});
    #asked = new Set<string>();
    #kind: 'artists' | 'labels';

    constructor(kind: 'artists' | 'labels') {
      this.#kind = kind;
    }

    /** Para el `oncreate` del Combobox: devuelve el texto tal cual y busca parecidos. */
    check = (text: string) => {
      const name = text.trim();
      if (name && !this.#asked.has(name)) {
        this.#asked.add(name);
        similarCatalogNames(this.#kind, similarSearchTerms(name))
          .then((candidates) => compareNames(name, candidates).similar)
          .catch(() => [] as string[])
          .then((similar) => (this.similar = { ...this.similar, [name]: similar }));
      }
      return text;
    };

    of(value: string): string[] {
      return this.similar[value.trim()] ?? [];
    }
  }
  const artistNames = new SimilarNames('artists');
  const labelNames = new SimilarNames('labels');

  const clean = (values: string[]) => values.map((value) => value.trim()).filter(Boolean);
  const replaceName = (values: string[], from: string, to: string) =>
    values.map((value) => (value === from ? to : value)).filter((value, index, list) => list.findIndex((other) => normalizeSearch(other) === normalizeSearch(value)) === index);

  function useExisting(field: 'primary' | 'collaborators' | 'label', from: string, to: string) {
    if (field === 'primary') primaryArtists = replaceName(primaryArtists, from, to);
    else if (field === 'collaborators') collaborators = replaceName(collaborators, from, to);
    else labelValue = [to];
  }

  function payload(): ContributionPayload {
    const proposedRadar = radarOn ? completeRadar($state.snapshot(radar)) : null;
    return {
      version: 3,
      title: title.trim(),
      primary_artists: clean(primaryArtists),
      collaborators: clean(collaborators),
      release_type: releaseType,
      release_date: releaseDate,
      genres: clean(genres),
      countries: clean(countries),
      label,
      ...(proposedRadar ? { radar: proposedRadar } : {}),
      // La observación de admin va al historial (p_reason); en la propuesta sería la reseña.
      ...(teamNote.trim() && !isAdmin ? { team_note: teamNote.trim() } : {})
    };
  }

  function requestInput() {
    return {
      sourceUrl: sourceUrl.trim(),
      sourceProvider: sourceProviderFor(sourceUrl)!,
      payload: payload(),
      detectedMetadata
    };
  }

  function populate(contribution: NonNullable<Awaited<ReturnType<typeof loadContribution>>>) {
    sourceUrl = contribution.source_url;
    detectedUrl = contribution.source_url.trim();
    title = contribution.payload.title ?? '';
    primaryArtists = [...(contribution.payload.primary_artists ?? [])];
    collaborators = [...(contribution.payload.collaborators ?? [])];
    releaseType = contribution.payload.release_type ?? '';
    releaseDate = contribution.payload.release_date ?? '';
    genres = [...(contribution.payload.genres ?? [])];
    countries = [...(contribution.payload.countries ?? [])];
    labelValue = contribution.payload.label ? [contribution.payload.label] : [];
    const savedRadar = completeRadar(contribution.payload.radar);
    radarOn = !!savedRadar;
    radar = savedRadar ?? emptyRadar();
    teamNote = contribution.payload.team_note ?? '';
    detectedMetadata = contribution.detected_metadata ?? {};
    detectionState = contribution.detected_metadata?.source_available === false ? 'unavailable' : 'available';
    draftId = contribution.id;
    resumedStatus = contribution.status;
    reviewerNote = contribution.reviewer_note ?? '';
    fallbackStep = 2;
    hasData = true;
  }

  onMount(async () => {
    loadContributionDictionaries()
      .then((values) => {
        genreOptions = asOptions(values.genres);
        countryOptions = asOptions(values.countries);
      })
      // Sin la lista no se puede elegir; el servidor rechaza cualquier valor de fuera.
      .catch(() => {});

    if (!$user) return;
    const requestedId = draftParam;
    if (editorialEnabled && requestedId) loadingDraft = true;
    else if (editorialEnabled) {
      await tick();
      sourceInput?.focus();
    }
    try {
      role = await loadProfileRole($user.id);
    } catch (cause: any) {
      role = '';
      error = cause?.message || 'No se pudieron comprobar tus permisos.';
    } finally {
      roleLoaded = true;
    }
    if (!editorialEnabled || !role) {
      loadingDraft = false;
      return;
    }
    if (!requestedId) return;
    try {
      const contribution = await loadContribution(requestedId);
      if (!contribution || !['draft', 'changes_requested'].includes(contribution.status)) {
        throw new Error('Este borrador no está disponible para edición.');
      }
      populate(contribution);
    } catch (cause: any) {
      error = cause?.message || 'No se pudo cargar el borrador.';
    } finally {
      loadingDraft = false;
    }
  });

  // Al cambiar de paso (botones o atrás/adelante del navegador), el foco va al
  // título del paso y la vista vuelve al inicio del formulario. Si el cambio lo
  // causó un error, el foco va al campo que lo tiene.
  let shownStep: ContributionStep | null = null;
  let focusAfterStep: ContributionField | null = null;
  $effect(() => {
    const current = step;
    if (shownStep !== null && shownStep !== current) {
      const field = focusAfterStep;
      focusAfterStep = null;
      tick().then(() => {
        if (field) return void document.getElementById(FIELD_IDS[field])?.focus();
        stepHeading?.focus({ preventScroll: true });
        const top = stepHeading?.closest('form')?.getBoundingClientRect().top ?? 0;
        if (top < 0) window.scrollBy({ top: top - 96 });
      });
    }
    shownStep = current;
  });

  function goToStep(next: ContributionStep) {
    error = '';
    saved = '';
    pushState('', { sugerirPaso: next } as App.PageState);
  }

  async function focusField(field: ContributionField | null) {
    if (!field) return;
    await tick();
    document.getElementById(FIELD_IDS[field])?.focus();
  }

  /** Lleva al paso del campo con error y lo enfoca. */
  async function showFieldError(field: ContributionField | null, message: string) {
    error = message;
    const target = field ? stepOfField(field) : step;
    if (target !== step) {
      focusAfterStep = field;
      goToStep(target);
      error = message;
    } else await focusField(field);
  }

  /** Error de un RPC v3: si es de un campo, se marca en su paso; si no, arriba. */
  async function showServerError(cause: any, fallback: string) {
    const described = describeContributionError(cause);
    const field = described?.field && described.field in FIELD_IDS ? (described.field as ContributionField) : null;
    if (described && field) {
      fieldErrors = { [field]: described.message };
      await showFieldError(field, 'Revisa los campos indicados.');
      return;
    }
    error = described?.message || cause?.message || fallback;
  }

  async function detectar() {
    if (detectionState === 'loading' || busy) return;
    error = '';
    saved = '';
    fieldErrors = {};
    duplicate = null;
    const provider = sourceProviderFor(sourceUrl);
    if (!provider) {
      fieldErrors = { source: SOURCE_ERROR };
      sourceInput?.focus();
      return;
    }
    detectionState = 'loading';
    const url = sourceUrl.trim();
    // El aviso de duplicado se pide a la vez; si falla, se sigue sin él (el servidor no lo exige).
    const found = checkSourceDuplicate(url).catch(() => null);
    try {
      const detected = await inspectSource(url);
      detectedMetadata = { ...detected, provider };
      title ||= detected.title ?? '';
      if (!primaryArtists.length) primaryArtists = clean(detected.artists ?? []);
      releaseDate ||= detected.release_date ?? '';
      detectionState = detected.source_available === false ? 'unavailable' : 'available';
    } catch {
      detectedMetadata = { provider, source_available: false };
      detectionState = 'unavailable';
    }
    duplicate = duplicateNotice(await found, { role, draftId });
    detectedUrl = url;
    hasData = true;
    // Con un duplicado, el aviso se lee en el paso 1 antes de seguir.
    if (!duplicate) goToStep(2);
  }

  async function continuar() {
    if (step === 1) {
      if (sourceUnchanged && sourceProviderFor(sourceUrl)) goToStep(2);
      else await detectar();
      return;
    }
    if (step === 2) {
      const errors = errorsForStep(contributionFieldErrors(sourceUrl, payload()), 2);
      fieldErrors = errors;
      if (Object.keys(errors).length) {
        error = 'Revisa los campos obligatorios indicados.';
        await focusField(firstInvalidField(errors));
        return;
      }
      goToStep(3);
      return;
    }
    if (step === 3) {
      goToStep(4);
      return;
    }
    await enviar();
  }

  function atras() {
    if (step > 1) goToStep((step - 1) as ContributionStep);
  }

  async function guardar() {
    if (busy) return;
    error = '';
    saved = '';
    fieldErrors = {};
    if (!sourceProviderFor(sourceUrl)) {
      fieldErrors = { source: SOURCE_ERROR };
      if (step !== 1) goToStep(1);
      await focusField('source');
      return;
    }
    busy = 'save';
    try {
      const contribution = draftId
        ? await saveContributionDraft(draftId, requestInput())
        : await createContributionDraft(requestInput());
      draftId = contribution.id;
      resumedStatus = 'draft';
      saved = 'Borrador guardado. Puedes retomarlo desde tu perfil.';
    } catch (cause: any) {
      await showServerError(cause, 'No se pudo guardar el borrador.');
    } finally {
      busy = '';
    }
  }

  /** Comunidad y colaborador: a su cola. Admin: borrador del catálogo, sin cola (U19). */
  async function enviar() {
    if (busy) return;
    error = '';
    saved = '';
    const errors = contributionFieldErrors(sourceUrl, payload());
    fieldErrors = errors;
    if (firstStepWithError(errors)) {
      await showFieldError(firstInvalidField(errors), 'Revisa los campos obligatorios indicados.');
      return;
    }
    busy = 'submit';
    try {
      if (isAdmin) {
        created = await adminCreateDraftFromSuggestion({ ...requestInput(), reason: teamNote.trim() || undefined });
      } else {
        if (!draftId) {
          const contribution = await createContributionDraft(requestInput());
          draftId = contribution.id;
        }
        await submitContribution(draftId, requestInput());
        resumedStatus = 'pending';
      }
      success = true;
    } catch (cause: any) {
      await showServerError(cause, isAdmin ? 'No se pudo crear el borrador. Intenta de nuevo.' : 'No se pudo enviar la propuesta. Intenta de nuevo.');
    } finally {
      busy = '';
    }
  }

  async function sugerirOtro() {
    sourceUrl = '';
    title = '';
    primaryArtists = [];
    collaborators = [];
    releaseType = '';
    releaseDate = '';
    genres = [];
    countries = [];
    labelValue = [];
    radarOn = false;
    radar = emptyRadar();
    teamNote = '';
    detectedMetadata = {};
    detectedUrl = '';
    detectionState = 'idle';
    duplicate = null;
    draftId = '';
    resumedStatus = null;
    reviewerNote = '';
    fieldErrors = {};
    error = '';
    saved = '';
    fallbackStep = 1;
    hasData = false;
    success = false;
    created = null;
    await goto('/sugerir', { replaceState: true, state: {} });
    await tick();
    sourceInput?.focus();
  }

  const list = (values: string[]) => clean(values).join(', ');
  const radarSummary = $derived(radarOn ? RADAR_AXES.map((axis) => `${RADAR_LABELS[axis]} ${radar[axis]}`).join(' · ') : '');
</script>

<svelte:head><title>Sugerir un lanzamiento — Discótica</title></svelte:head>

{#snippet summaryRow(term: string, value: string, empty = 'Sin indicar')}
  <div class="sugerir__row">
    <dt>{term}</dt>
    <dd class:sugerir__empty={!value}>{value || empty}</dd>
  </div>
{/snippet}

<!-- Nombres nuevos con parecidos en el catálogo (U19): elegir el existente evita el duplicado. -->
{#snippet similarWarning(field: 'primary' | 'collaborators' | 'label', values: string[], checker: SimilarNames)}
  {#each clean(values).filter((name) => checker.of(name).length) as name (name)}
    <Notice class="sugerir__similar" title={`«${name}» no está en el catálogo y se creará como nuevo.`}>
      Hay nombres parecidos. Si es el mismo, usa el que ya existe.
      {#snippet actions()}
        {#each checker.of(name) as other (other)}
          <Button variant="link" size="sm" onclick={() => useExisting(field, name, other)}>Usar «{other}»</Button>
        {/each}
      {/snippet}
    </Notice>
  {/each}
{/snippet}

<PageLayout
  container="narrow"
  title="Sugerir un lanzamiento"
  description={!success && step === 1 ? 'Pega el enlace del lanzamiento y revisa los datos que detectamos.' : undefined}
>
  {#if !editorialEnabled}
    <section class="sugerir__gate">
      <h2>Sugerencias temporalmente cerradas</h2>
      <p>Esta función todavía no está habilitada en este entorno.</p>
    </section>
  {:else if !$user}
    <section class="sugerir__gate">
      <h2>Inicia sesión para proponer</h2>
      <p>Necesitas una cuenta para sugerir lanzamientos y seguir su revisión.</p>
      <div class="sugerir__gate-actions">
        <Button href={loginHref}>Entrar</Button>
        <Button variant="secondary" href="/auth/registro">Crear una cuenta</Button>
      </div>
    </section>
  {:else if roleLoaded && !role}
    <section class="sugerir__gate" role="alert">
      <h2>No puedes crear propuestas</h2>
      <p>Tu perfil no tiene un rol habilitado para este flujo.</p>
    </section>
  {:else if loadingDraft}
    <LoadingIndicator label="Cargando borrador" />
  {:else if success}
    <section class="sugerir__done" role="status">
      <span class="sugerir__done-icon"><Icon name="check" size="md" /></span>
      <h2>{done.title}</h2>
      <p>{done.text}</p>
      <div class="sugerir__gate-actions">
        {#each done.actions as action (action.label)}
          {#if action.restart}
            <Button variant={action.variant} icon="agregar" onclick={sugerirOtro}>{action.label}</Button>
          {:else}
            <Button variant={action.variant} href={action.href}>{action.label}</Button>
          {/if}
        {/each}
      </div>
    </section>
  {:else}
    <ol class="sugerir__steps" aria-label="Pasos">
      {#each CONTRIBUTION_STEPS as item (item.step)}
        <li
          class:is-current={item.step === step}
          class:is-done={item.step < step}
          aria-current={item.step === step ? 'step' : undefined}
        >
          <span class="sugerir__step-n" aria-hidden="true">
            {#if item.step < step}<Icon name="check" size="sm" />{:else}{item.step}{/if}
          </span>
          <span class="sugerir__step-label">{item.label}</span>
          {#if item.step < step}<span class="sr-only">, completado</span>{/if}
        </li>
      {/each}
    </ol>

    <form class="sugerir__form" novalidate onsubmit={(event) => { event.preventDefault(); void continuar(); }}>
      <h2 class="sugerir__step-title" tabindex="-1" bind:this={stepHeading}>
        <span class="sr-only">Paso {step} de 4: </span>{CONTRIBUTION_STEPS[step - 1].label}
      </h2>

      {#if error}<Notice tone="error">{error}</Notice>{/if}
      {#if resumedStatus === 'changes_requested'}
        <Notice title="Cambios solicitados">
          {reviewerNote || 'Actualiza la propuesta y vuelve a enviarla.'}
        </Notice>
      {/if}

      {#if step === 1}
        <div class="sugerir__source">
          <Field
            label="Enlace de la fuente"
            type="url"
            id={FIELD_IDS.source}
            bind:value={sourceUrl}
            bind:element={sourceInput}
            placeholder="https://artista.bandcamp.com/album/…"
            hint="Bandcamp, Spotify o SoundCloud. Recomendamos Bandcamp cuando esté disponible."
            error={fieldErrors.source}
            autocomplete="url"
            required
          />
        </div>
        {#if duplicate && sourceUnchanged}
          <Notice class="sugerir__duplicate" title={duplicate.text}>
            Revisa lo que ya existe antes de seguir.
            {#snippet actions()}
              {#if duplicate?.link}<Button variant="link" size="sm" href={duplicate.link.href}>{duplicate.link.label}</Button>{/if}
            {/snippet}
          </Notice>
        {/if}
      {:else if step === 2}
        <p class="sugerir__lead">Comprueba lo que detectamos y completa lo que falte.</p>
        {#if detectionState === 'unavailable'}
          <Notice title="Información no disponible.">
            Puedes completar la propuesta manualmente; lo que ya escribiste se conserva.
          </Notice>
        {/if}
        {#if detectedMetadata.cover_url}
          <figure class="sugerir__evidence">
            <div class="sugerir__evidence-cover">
              <Cover src={String(detectedMetadata.cover_url)} alt="Portada detectada, pendiente de verificación" radius="sm" loading="eager" />
            </div>
            <figcaption>Portada detectada como evidencia de solo lectura; el equipo la verificará.</figcaption>
          </figure>
        {/if}

        <Field label="Título" id={FIELD_IDS.title} bind:value={title} maxlength={200} error={fieldErrors.title} required />
        <div class="sugerir__group">
          <Combobox
            label="Artistas principales"
            id={FIELD_IDS.primary_artists}
            options={asOptions(primarySearch.found)}
            bind:value={primaryArtists}
            bind:query={primarySearch.query}
            filter={false}
            loading={primarySearch.loading}
            allowCreate
            oncreate={artistNames.check}
            placeholder="Busca o escribe un nombre"
            error={fieldErrors.primary_artists}
            required
          />
          {@render similarWarning('primary', primaryArtists, artistNames)}
        </div>
        <div class="sugerir__group">
          <Combobox
            label="Colaboradores"
            options={asOptions(collaboratorSearch.found)}
            bind:value={collaborators}
            bind:query={collaboratorSearch.query}
            filter={false}
            loading={collaboratorSearch.loading}
            allowCreate
            oncreate={artistNames.check}
            placeholder="Busca o escribe un nombre"
            optional
          />
          {@render similarWarning('collaborators', collaborators, artistNames)}
        </div>
        <div class="sugerir__pair">
          <Select
            label="Tipo"
            id={FIELD_IDS.release_type}
            options={typeOptions}
            bind:value={releaseType}
            hint={detectedMetadata.type ? `La fuente sugiere “${detectedMetadata.type}”; confírmalo manualmente.` : undefined}
            error={fieldErrors.release_type}
          />
          <Field label="Fecha" type="date" id={FIELD_IDS.release_date} bind:value={releaseDate} error={fieldErrors.release_date} required />
        </div>
        <div class="sugerir__pair">
          <Combobox
            label="Géneros"
            id={FIELD_IDS.genres}
            options={genreOptions}
            bind:value={genres}
            placeholder="Selecciona uno o más valores"
            error={fieldErrors.genres}
            required
          />
          <Combobox
            label="Países"
            id={FIELD_IDS.countries}
            options={countryOptions}
            bind:value={countries}
            placeholder="Selecciona uno o más valores"
            error={fieldErrors.countries}
            required
          />
        </div>
        <div class="sugerir__group">
          <Combobox
            label="Sello"
            id={FIELD_IDS.label}
            options={labelOptions}
            bind:value={labelValue}
            bind:query={labelSearch.query}
            filter={false}
            loading={labelSearch.loading}
            single
            allowCreate
            oncreate={labelNames.check}
            placeholder="Selecciona o escribe un sello"
            hint="Si es autoeditado, elige «Independiente»."
            error={fieldErrors.label}
            required
          />
          {@render similarWarning('label', labelValue, labelNames)}
        </div>
        <div class="sugerir__radar">
          <Checkbox bind:checked={radarOn} hint="Opcional. El equipo lo ajusta al revisar.">Proponer un radar</Checkbox>
          {#if radarOn}<RadarControls bind:value={radar} compact />{/if}
        </div>
      {:else if step === 3}
        <Textarea
          label={isAdmin ? 'Observación del cambio' : 'Nota para el equipo'}
          id="team-note"
          bind:value={teamNote}
          rows={6}
          maxlength={3000}
          hint={isAdmin
            ? 'Queda en el historial del Estudio. Si la dejas vacía, se usa «Alta desde Sugerir».'
            : 'Contexto, créditos o cualquier dato que ayude a revisar la propuesta. Puedes enviarla sin nota.'}
          optional
        />
      {:else}
        <p class="sugerir__lead">{submitLead(role)}</p>
        <section class="sugerir__summary" aria-labelledby="summary-source">
          <header>
            <h3 id="summary-source">Fuente</h3>
            <Button variant="link" size="sm" onclick={() => goToStep(1)}>Editar<span class="sr-only"> la fuente</span></Button>
          </header>
          <p class="sugerir__source-link"><a href={sourceUrl} target="_blank" rel="noopener noreferrer">{sourceUrl}</a></p>
        </section>
        <section class="sugerir__summary" aria-labelledby="summary-data">
          <header>
            <h3 id="summary-data">Datos</h3>
            <Button variant="link" size="sm" onclick={() => goToStep(2)}>Editar<span class="sr-only"> los datos</span></Button>
          </header>
          <div class="sugerir__summary-body">
            {#if detectedMetadata.cover_url}
              <div class="sugerir__summary-cover">
                <Cover src={String(detectedMetadata.cover_url)} alt="" radius="sm" loading="eager" />
              </div>
            {/if}
            <dl>
              {@render summaryRow('Título', title.trim())}
              {@render summaryRow('Artistas principales', list(primaryArtists))}
              {@render summaryRow('Colaboradores', list(collaborators))}
              {@render summaryRow('Tipo', typeLabel)}
              {@render summaryRow('Fecha', releaseDate)}
              {@render summaryRow('Géneros', list(genres))}
              {@render summaryRow('Países', list(countries))}
              {@render summaryRow('Sello', label)}
              {@render summaryRow('Radar', radarSummary, 'Sin radar')}
            </dl>
          </div>
        </section>
        <section class="sugerir__summary" aria-labelledby="summary-note">
          <header>
            <h3 id="summary-note">{isAdmin ? 'Observación' : 'Nota'}</h3>
            <Button variant="link" size="sm" onclick={() => goToStep(3)}>Editar<span class="sr-only"> la {isAdmin ? 'observación' : 'nota'}</span></Button>
          </header>
          <p class="sugerir__note" class:sugerir__empty={!teamNote.trim()}>{teamNote.trim() || (isAdmin ? 'Alta desde Sugerir' : 'Sin nota')}</p>
        </section>
      {/if}

      {#if saved}<Notice tone="success">{saved}</Notice>{/if}

      <div class="sugerir__actions">
        {#if step > 1}
          <Button variant="secondary" icon="chevron-izquierda" onclick={atras} disabled={!!busy}>Atrás</Button>
        {/if}
        {#if step > 1 && canSaveDraft}
          <Button variant="ghost" class="sugerir__save" loading={busy === 'save'} disabled={busy === 'submit'} onclick={guardar}>
            {busy === 'save' ? 'Guardando…' : 'Guardar borrador'}
          </Button>
        {/if}
        {#if step === 1}
          <Button type="submit" class="sugerir__primary" loading={detectionState === 'loading'} disabled={!!busy} iconEnd={sourceUnchanged ? 'chevron-derecha' : undefined}>
            {#if detectionState === 'loading'}Leyendo…{:else if sourceUnchanged && duplicate}Continuar igualmente{:else if sourceUnchanged}Continuar{:else}Detectar{/if}
          </Button>
        {:else if step < 4}
          <Button type="submit" class="sugerir__primary" iconEnd="chevron-derecha" disabled={!!busy}>Continuar</Button>
        {:else}
          <Button type="submit" class="sugerir__primary" loading={busy === 'submit'} disabled={busy === 'save' || !roleLoaded}>
            {busy === 'submit' ? (isAdmin ? 'Creando…' : 'Enviando…') : submitLabel(role)}
          </Button>
        {/if}
      </div>
    </form>
  {/if}
</PageLayout>

<style>
  /* Pasos: número y nombre; en móvil solo el nombre del paso actual. */
  .sugerir__steps {
    display: flex;
    gap: var(--space-2);
    margin: var(--space-5) 0 0;
    padding: 0;
    list-style: none;
  }
  .sugerir__steps li {
    display: flex;
    flex: 1 1 0;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
    padding-top: var(--space-2);
    border-top: 2px solid var(--color-linea);
    color: var(--color-texto-tenue);
    font-size: var(--text-sm);
    font-weight: 600;
  }
  .sugerir__steps li.is-done { border-top-color: var(--color-acento-border); color: var(--color-texto-medio); }
  .sugerir__steps li.is-current { border-top-color: var(--color-acento); color: var(--color-texto); }
  .sugerir__step-n {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: var(--icon-lg);
    height: var(--icon-lg);
    border: 1px solid currentColor;
    border-radius: var(--radius-pill);
    font-size: var(--text-2xs);
    font-variant-numeric: tabular-nums;
  }
  .is-current .sugerir__step-n { border-color: var(--color-acento); background: var(--color-acento); color: var(--color-sobre-acento); }
  .is-done .sugerir__step-n { border-color: transparent; color: var(--color-acento); }
  .sugerir__step-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  .sugerir__form {
    display: grid;
    gap: var(--space-5);
    margin-top: var(--space-6);
  }
  .sugerir__step-title {
    margin: 0;
    color: var(--color-texto);
    font-size: var(--text-lg);
    line-height: 1.2;
  }
  .sugerir__step-title:focus { outline: none; }
  .sugerir__lead { margin: calc(-1 * var(--space-3)) 0 0; color: var(--color-texto-medio); font-size: var(--text-sm); line-height: 1.5; }
  .sugerir__pair {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-5) var(--space-4);
    align-items: start;
  }

  .sugerir__evidence {
    display: grid;
    grid-template-columns: var(--sugerir-evidence) minmax(0, 1fr);
    align-items: center;
    gap: var(--space-4);
    margin: 0;
    padding: var(--space-3);
    border-radius: var(--radius-base);
    background: var(--color-superficie-1);
    --sugerir-evidence: calc(var(--space-8) + var(--space-7));
  }
  /* Un campo y sus avisos de nombres parecidos. */
  .sugerir__group { display: grid; gap: var(--space-3); }
  .sugerir__radar { display: grid; gap: var(--space-2); }
  .sugerir__radar :global(.radar-field) { margin-top: 0; }

  .sugerir__evidence figcaption { color: var(--color-texto-tenue); font-size: var(--text-2xs); line-height: 1.45; }

  .sugerir__summary {
    display: grid;
    gap: var(--space-3);
    padding-top: var(--space-4);
    border-top: 1px solid var(--color-linea-sutil);
  }
  .sugerir__summary header { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); }
  .sugerir__summary h3 { margin: 0; color: var(--color-texto-alto); font-size: var(--text-sm); font-weight: 700; }
  .sugerir__summary-body { display: grid; grid-template-columns: var(--sugerir-evidence) minmax(0, 1fr); gap: var(--space-4); align-items: start; --sugerir-evidence: calc(var(--space-8) + var(--space-7)); }
  .sugerir__summary-body:not(:has(.sugerir__summary-cover)) { grid-template-columns: minmax(0, 1fr); }
  .sugerir__summary dl { display: grid; gap: var(--space-2); margin: 0; }
  .sugerir__row { display: grid; grid-template-columns: minmax(0, 11rem) minmax(0, 1fr); gap: var(--space-3); font-size: var(--text-sm); line-height: 1.45; }
  .sugerir__row dt { color: var(--color-texto-tenue); }
  .sugerir__row dd { margin: 0; color: var(--color-texto); overflow-wrap: anywhere; }
  .sugerir__source-link, .sugerir__note { margin: 0; font-size: var(--text-sm); line-height: 1.5; overflow-wrap: anywhere; white-space: pre-line; }
  .sugerir__source-link a { color: var(--color-acento); }
  .sugerir__empty { color: var(--color-texto-tenue) !important; }

  .sugerir__actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3);
    padding-top: var(--space-4);
    border-top: 1px solid var(--color-linea-sutil);
  }
  .sugerir__actions :global(.sugerir__save) { margin-left: auto; }
  .sugerir__actions :global(.sugerir__primary) { margin-left: auto; }
  .sugerir__actions :global(.sugerir__save + .sugerir__primary) { margin-left: 0; }

  .sugerir__gate,
  .sugerir__done {
    display: grid;
    justify-items: start;
    gap: var(--space-3);
    margin-top: var(--space-5);
  }
  .sugerir__gate h2,
  .sugerir__done h2 { margin: 0; font-size: var(--text-lg); }
  .sugerir__gate p,
  .sugerir__done p { margin: 0; color: var(--color-texto-medio); line-height: 1.5; }
  .sugerir__gate-actions { display: flex; flex-wrap: wrap; gap: var(--space-3); margin-top: var(--space-2); }
  .sugerir__done-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--target-touch);
    height: var(--target-touch);
    border-radius: var(--radius-pill);
    background: var(--color-acento-dim);
    color: var(--color-acento);
  }

  @media (max-width: 679px) {
    .sugerir__steps li:not(.is-current) .sugerir__step-label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; }
    .sugerir__steps li { flex: 0 0 auto; }
    .sugerir__steps li.is-current { flex: 1 1 auto; }
    .sugerir__pair { grid-template-columns: minmax(0, 1fr); }
    .sugerir__row { grid-template-columns: minmax(0, 1fr); gap: 0; }
    /* Atrás y la acción principal comparten la última línea; guardar va encima. */
    .sugerir__actions :global(.sugerir__save) { order: -1; flex-basis: 100%; margin-left: 0; }
    .sugerir__actions :global(.sugerir__primary) { flex: 1 1 auto; }
  }
</style>
