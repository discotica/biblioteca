<script>
  // Inicio: orquesta el SearchState único (E12), los resultados (E13), la
  // búsqueda móvil (E15) y la sesión modal (E17). Las derivaciones viven en
  // $lib/domain/homeSearchView, las navegaciones en $lib/ui/homeUrl y cada
  // superficie en $lib/components/home. U10: en móvil, tres líneas antes de la
  // primera portada (Buscar y vista / filtros activos / paginación y orden).
  // U10b: en desktop el campo de texto de HomeSearchBar abre el panel; en
  // móvil el campo va en la barra y Filtros abre la hoja. U29: la franja de
  // entrada (campo de pulso) aloja la bienvenida o la nota beta en un solo hueco,
  // ninguna modal; sin ellas queda la banda reducida con el buscador. U29b:
  // en desktop esa banda reducida también es a donde pasa la franja con texto
  // tras el primer scroll hacia abajo (franjaReduccion.ts; solo lee el scroll).
  import { getContext, onMount } from 'svelte';
  import LanzamientoModal from '$lib/components/LanzamientoModal.svelte';
  import BetaInvitation from '$lib/components/BetaInvitation.svelte';
  import HomeFranja from '$lib/components/home/HomeFranja.svelte';
  import HomeWelcome from '$lib/components/home/HomeWelcome.svelte';
  import HomeSearchBar from '$lib/components/home/HomeSearchBar.svelte';
  import MobileSearchBar from '$lib/components/home/MobileSearchBar.svelte';
  import HomeResults from '$lib/components/home/HomeResults.svelte';
  import MobileFilterSheet from '$lib/components/home/MobileFilterSheet.svelte';
  import { page } from '$app/stores';
  import { get } from 'svelte/store';
  import { flushSync, tick } from 'svelte';
  import { slugFromLanzamiento } from '$lib/utils/slugLanzamiento';
  import { fetchLanzamientos, resolveReleaseBySlug } from '$lib/utils/catalogoStore';
  import { matchReleases } from '$lib/domain/searchMatching';
  import { recommendReleases } from '$lib/domain/releaseRecommendations';
  import { closeModalPlan, entryForSession, idleModalSession, pushModalRelease, restoreModalSession, visitModalBase } from '$lib/domain/modalHistory';
  import { createSearchState, hasSearchCriteria, parseSearchState, searchStateToCriteria, serializeSearchState } from '$lib/domain/searchState';
  import {
    activeSearchPills, availableOrders, countActiveFilters, describeResults, pageSlice, searchFilterValues,
    totalPagesFor, withFilterForm, withOrder, withPage, withRadar, withoutPill
  } from '$lib/domain/homeSearchView';
  import {
    currentModalEntry, currentQuery, markModalEntry, navigateToSearch, replaceSearchHref,
    replaceWithCanonicalQuery, restoreUnderlyingScroll, searchHref as searchHrefFor, startModalSession, takeBootModalEntry
  } from '$lib/ui/homeUrl';
  import { observeMobileSearchChrome } from '$lib/ui/mobileSearchChrome';
  import { alAsentarseElScroll, animarReduccion, esMovil, medirFranja, movimientoReducido, observarPrimerScroll } from '$lib/ui/franjaReduccion';
  import { readViewPreference, writeViewPreference } from '$lib/ui/viewPreference';
  import { parseBetaInvitation, removeBetaInvitationParams } from '$lib/domain/betaInvitation';
  import { WELCOME_CONTENT } from '$lib/content/welcome';
  import { WELCOME_SESSION_CONTEXT, consumeWelcomeDecision, markWelcomeHandled } from '$lib/ui/welcomeSession';

  // A presentation kill switch only. It never grants access or changes E18.
  const betaInvitationEnabled = import.meta.env.VITE_BETA_INVITATION_ENABLED === 'true';
  const welcomeSession = getContext(WELCOME_SESSION_CONTEXT);

  let lanzamientos = [];
  let lanzamientosFiltrados = [];
  let cargandoTSV = true;
  let errorCargaCatalogo = false;
  let radarRef;
  let radarRefMobile;
  let mostrarPanelFiltros = false;
  let modalFiltrosMobile = false;
  let filtrosMobileTriggerEl;
  let mobileSearchVisible = true;
  let mobileSearchInputEl;
  let mobileFiltersButtonEl;
  // Grilla o lista: se lee antes del primer pintado para que la vista no salte.
  const VIEW_CONTEXT = 'inicio';
  let vista = readViewPreference(VIEW_CONTEXT) ?? 'grid';
  let searchState = createSearchState();
  let unknownSearchParams = new URLSearchParams();
  let paginaActual = 1;
  let coincidencias = [];
  let coincidenciasExactas = [];
  let coincidenciasAproximadas = [];
  let resultadosGridEl;
  // El campo de texto de desktop: destino del cierre de la nota beta.
  let desktopSearchInputEl;
  let betaInvitation = null;
  let welcomeVisible = false;
  // U29b: la franja con texto pasa a la forma reducida tras el primer scroll
  // hacia abajo y SE QUEDA así hasta que la página se desmonte (una visita).
  // No cierra nada: la sesión de la bienvenida y beta/nombre de la URL siguen
  // como estaban, y subir de nuevo no la reexpande (sin bucle con el scroll).
  let franjaReducida = false;
  let franjaEl = null;
  let franjaCampoEl = null;
  let transicionFranja = null;
  let cancelarReduccionPendiente = null;
  $: franjaSinTexto = !betaInvitation && !welcomeVisible;

  // Modal
  let lanzamientoActivo = null;
  let modalSession = idleModalSession();
  let modalReturnFocus = null;
  let pendingDirectClose = false;
  let modalResolutionVersion = 0;
  $: recomendacionesActivas = lanzamientoActivo ? recommendReleases(lanzamientoActivo, lanzamientos) : [];

  async function abrirModal(lanzamiento) {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // El modal fija el scroll de fondo (E17, overlay.ts) y lo restaura al cerrar:
    // la franja se reduce antes, nunca con el fondo bloqueado.
    await franjaEnFormaFinal();
    // A card already carries the canonical release it was listed from: open at
    // once instead of paying two sequential round trips (resolver + lookup).
    // Only legacy rows, which have no canonical identity yet, go through the resolver.
    let release = lanzamiento?.source === 'canonical' && lanzamiento.id ? lanzamiento : null;
    if (!release) {
      const resolution = await resolveReleaseBySlug(slugFromLanzamiento(lanzamiento));
      if (resolution.status !== 'resolved') return;
      release = resolution.release;
    }
    const canonicalSlug = slugFromLanzamiento(release);
    modalSession = startModalSession('catalog', searchState, unknownSearchParams, canonicalSlug);
    modalReturnFocus = opener;
    lanzamientoActivo = release;
    searchState = createSearchState({ ...searchState, modal: canonicalSlug });
    await navegarEstado({ historyEntry: entryForSession(modalSession) });
  }

  async function cerrarModal() {
    const plan = closeModalPlan(modalSession);
    if (plan.kind === 'go') {
      pendingDirectClose = plan.finishDirectAtDepthZero;
      history.go(plan.delta);
      return;
    }
    if (plan.kind === 'replace') await replaceWithModalBase(plan.href, plan.scroll);
  }

  async function abrirRecomendacion({ recommendation }) {
    if (!lanzamientoActivo || modalSession.phase !== 'open') return;
    const slug = slugFromLanzamiento(recommendation.release);
    const next = pushModalRelease(modalSession, slug);
    modalSession = next.session;
    searchState = createSearchState({ ...searchState, modal: slug });
    await navegarEstado({ historyEntry: next.entry });
  }

  function searchHref(state) {
    return searchHrefFor(state, unknownSearchParams);
  }

  function syncBetaInvitation(params) {
    betaInvitation = betaInvitationEnabled ? parseBetaInvitation(params) : null;
  }

  async function closeBetaInvitation() {
    // Build from E12's serialized search state, then remove only E19-owned
    // keys. Keep the retained unknown set clean too: otherwise a later E12
    // navigation would serialize stale beta keys back into an internal link.
    // Deleting again is a no-op, so repeated close/replace is stable.
    unknownSearchParams = removeBetaInvitationParams(unknownSearchParams);
    const params = removeBetaInvitationParams(serializeSearchState(searchState, unknownSearchParams));
    betaInvitation = null;
    const nextQs = params.toString();
    if (nextQs === currentQuery()) return;
    await replaceSearchHref(nextQs ? `?${nextQs}` : '/', currentModalEntry());
  }

  function decideWelcome() {
    welcomeVisible = consumeWelcomeDecision(welcomeSession?.initialPath, get(page).url.searchParams);
  }

  function closeWelcome() {
    markWelcomeHandled();
    welcomeVisible = false;
  }

  // La nota beta ya no es un diálogo que devuelva el foco: al cerrarla, el foco
  // va al campo de texto de desktop (que no abre el panel por foco).
  async function dismissBetaInvitation() {
    await closeBetaInvitation();
    await tick();
    desktopSearchInputEl?.focus({ preventScroll: true });
  }

  async function replaceWithModalBase(href, scroll = modalSession.baseScroll) {
    const baseState = createSearchState({ ...modalSession.baseSearchState, modal: null });
    lanzamientoActivo = null;
    searchState = baseState;
    modalSession = visitModalBase(modalSession);
    pendingDirectClose = false;
    await replaceSearchHref(href, null);
    await restoreUnderlyingScroll(scroll);
  }

  let syncingFromURL = false;
  let lastSeenQS = '';

  async function canonizarURLActual() {
    const canonical = serializeSearchState(searchState, unknownSearchParams).toString();
    lastSeenQS = canonical;
    await replaceWithCanonicalQuery(canonical);
  }

  async function sincronizarModalDesdeURL(modalSlug) {
    if (!modalSlug) {
      const scroll = modalSession.baseScroll;
      lanzamientoActivo = null;
      if (modalSession.phase === 'open') {
        modalSession = visitModalBase(modalSession);
        await restoreUnderlyingScroll(scroll);
      }
      return;
    }

    const historyEntry = currentModalEntry();
    if (pendingDirectClose && historyEntry?.origin === 'direct' && historyEntry.depth === 0) {
      modalSession = restoreModalSession(historyEntry);
      await replaceWithModalBase(historyEntry.baseHref, historyEntry.baseScroll);
      return;
    }

    if (historyEntry) modalSession = restoreModalSession(historyEntry);
    else if (modalSession.phase !== 'open') {
      modalSession = startModalSession('direct', searchState, unknownSearchParams, modalSlug);
      markModalEntry(modalSession);
    }

    if (lanzamientoActivo && slugFromLanzamiento(lanzamientoActivo) === modalSlug) return;
    const local = lanzamientos.find((release) => release.slug === modalSlug || release.legacySlug === modalSlug);
    if (local) {
      lanzamientoActivo = local;
      return;
    }
    const resolutionVersion = ++modalResolutionVersion;
    const resolution = await resolveReleaseBySlug(modalSlug);
    // A Back/Forward can happen while the resolver is in flight.
    if (resolutionVersion !== modalResolutionVersion || searchState.modal !== modalSlug) return;
    if (resolution.status === 'resolved') {
      lanzamientoActivo = resolution.release;
      return;
    }
    const baseState = createSearchState({ ...searchState, modal: null });
    searchState = baseState;
    lanzamientoActivo = null;
    await replaceSearchHref(searchHref(baseState), null);
  }

  // Sync reactivo: si cambia la query en la misma ruta (/?...), actualiza filtros y re-filtra
  $: if (!cargandoTSV) {
    const qsNow = $page.url.searchParams.toString();
    if (qsNow !== lastSeenQS) {
      const prev = new URLSearchParams(lastSeenQS);
      const next = new URLSearchParams(qsNow);
      prev.delete('modal'); next.delete('modal');
      lastSeenQS = qsNow;

      if (prev.toString() !== next.toString()) {
        syncingFromURL = true;
        const parsed = parseSearchState($page.url.searchParams);
        searchState = parsed.state;
        unknownSearchParams = parsed.unknown;
        syncBetaInvitation($page.url.searchParams);
        aplicarTodosLosFiltros({ skipURL: true });
        void canonizarURLActual();
        syncingFromURL = false;
      } else {
        searchState = createSearchState({ ...searchState, modal: $page.url.searchParams.get('modal') || null });
      }
      void sincronizarModalDesdeURL(searchState.modal);
    }
  }

  $: totalPaginas = totalPagesFor(lanzamientosFiltrados.length);
  $: paginaActual = searchState.page;
  $: coincidenciasPaginadas = pageSlice(coincidencias, paginaActual);
  // Sin criterios, E11 entrega la colección completa pero no la etiqueta como
  // "exacta". Para la superficie E13 eso es el estado normal del catálogo,
  // nunca el aviso de aproximación.
  $: haySoloAproximados = hasSearchCriteria(searchState) && coincidenciasExactas.length === 0 && coincidenciasAproximadas.length > 0;
  $: hayGruposMixtos = coincidenciasExactas.length > 0 && coincidenciasAproximadas.length > 0;
  $: aproximadosEnPagina = coincidenciasPaginadas.filter((match) => match.group === 'approximate').length;
  $: exactosEnPagina = coincidenciasPaginadas.filter((match) => match.group === 'exact').length;
  $: mostrarSeparadorAlInicio = hayGruposMixtos && aproximadosEnPagina > 0 && exactosEnPagina === 0;
  $: ordenesDisponibles = availableOrders(searchState);
  // Las entradas van en la sentencia para que el anuncio siga a la carga y a
  // cada búsqueda (hasta U10 se evaluaba una sola vez, al montar).
  $: anuncioResultados = describeResults({
    loading: cargandoTSV,
    error: errorCargaCatalogo,
    total: coincidencias.length,
    onlyApproximate: haySoloAproximados,
    approximateTotal: coincidenciasAproximadas.length,
    mixedGroups: hayGruposMixtos,
    exactOnPage: exactosEnPagina,
    approximateOnPage: aproximadosEnPagina
  });

  // Alias visual temporal: el único estado editable y compartible es SearchState.
  $: filtrosSeleccionados = searchFilterValues(searchState);
  $: activePills = activeSearchPills(searchState);
  $: contarFiltrosActivos = countActiveFilters(searchState);

  function refsFranja() {
    return {
      franja: franjaEl,
      campo: franjaCampoEl,
      fila: desktopSearchInputEl?.closest('.home-search__row') ?? null,
      entrada: desktopSearchInputEl?.closest('.home-search__field') ?? null,
      grilla: resultadosGridEl ?? null
    };
  }

  // Devuelve si había algo que reducir. Solo cambia estado de presentación:
  // nunca escribe el scroll, la URL ni el historial. La animación (FLIP) se
  // monta tras aplicar la forma final y se puede cancelar para llegar a ella.
  function reducirFranja({ instantanea = false } = {}) {
    if (franjaReducida) return true;
    if (!franjaEl || esMovil() || franjaSinTexto) return false;
    const animar = !instantanea && !movimientoReducido();
    const antes = animar ? medirFranja(refsFranja()) : null;
    const focoEnTexto = franjaEl.contains(document.activeElement);
    // Síncrono de punta a punta: el estado final se vuelca al DOM y la animación
    // arranca en la misma tarea. Con un `await tick()` por medio, un cuadro podía
    // pintarse con la forma final antes de que existiera la animación (un
    // parpadeo de la grilla ya reducida).
    flushSync(() => { franjaReducida = true; });
    // El texto pasa a estar oculto: el foco que tuviera dentro va al campo.
    if (focoEnTexto) desktopSearchInputEl?.focus({ preventScroll: true });
    if (antes) transicionFranja = animarReduccion(refsFranja(), antes);
    return true;
  }

  function terminarAnimacionFranja() {
    transicionFranja?.terminar();
    transicionFranja = null;
  }

  // Lleva la franja a su forma final al instante (si tocaba reducirla) y espera
  // a que el DOM la refleje. Se usa antes de todo lo que fija o mide una
  // posición de scroll: la reducción mueve lo que hay bajo ella, y no puede
  // hacerlo con una medida o un bloqueo ya tomados.
  async function franjaEnFormaFinal() {
    reducirFranja({ instantanea: true });
    terminarAnimacionFranja();
    await tick();
  }

  async function desplazarAGrilla() {
    // La grilla se mide con la franja ya en su forma final: si el scroll a la
    // grilla corriera con la reducción a medias, aterrizaría tantos píxeles
    // más abajo como ya hubiera encogido la franja. Aquí no se anima.
    await franjaEnFormaFinal();
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    resultadosGridEl?.scrollIntoView({ block: 'start', behavior: reducedMotion ? 'auto' : 'smooth' });
  }

  // Primero la URL y después el scroll: `goto` con noScroll devuelve la página
  // a donde estaba al terminar, y eso cancelaba el desplazamiento suave a la
  // grilla iniciado antes (U18, H15).
  async function irAPagina(p) {
    searchState = withPage(searchState, p, totalPaginas);
    await navegarEstado();
    await desplazarAGrilla();
  }

  function cambiarOrden(order) {
    if (!ordenesDisponibles.some((option) => option.value === order)) return;
    searchState = withOrder(searchState, order);
    aplicarTodosLosFiltros();
    void desplazarAGrilla();
  }

  function quitarPill(pill) {
    searchState = withoutPill(searchState, pill);
    if (pill.kind === 'radar') {
      radarRef?.resetRadar();
      radarRefMobile?.resetRadar();
    }
    aplicarTodosLosFiltros();
  }

  function abrirFiltrosMobile(trigger = mobileFiltersButtonEl) {
    filtrosMobileTriggerEl = trigger;
    mobileSearchVisible = true;
    modalFiltrosMobile = true;
  }

  function cambiarVista(mode) {
    if (mode === vista) return;
    vista = mode;
    writeViewPreference(VIEW_CONTEXT, mode);
  }

  function cerrarFiltrosMobile() {
    modalFiltrosMobile = false;
  }

  // --- Acciones ---
  function reiniciarFiltrosYRadar() {
    searchState = createSearchState();
    radarRef?.resetRadar();
    radarRefMobile?.resetRadar();
    aplicarTodosLosFiltros();
  }

  let mounted = false;
  let welcomeDecided = false;

  async function initialize() {
    cargandoTSV = true;

    try {
      lanzamientos = await fetchLanzamientos();
      errorCargaCatalogo = false;
    } catch (err) {
      console.error('Error cargando catálogo:', err);
      lanzamientos = [];
      errorCargaCatalogo = true;
    }

    if (!mounted) return;

    cargandoTSV = false;

    const parsed = parseSearchState(get(page).url.searchParams);
    searchState = parsed.state;
    unknownSearchParams = parsed.unknown;
    // Un reintento tras un fallo no vuelve a decidir la bienvenida.
    if (!welcomeDecided) decideWelcome();
    welcomeDecided = true;
    await canonizarURLActual();
    // U29: la nota beta ya no es un diálogo que tarde en recibir un clic. Se monta
    // con la URL ya canónica; si no, un cierre inmediato la limpiaba y la
    // canonización pendiente volvía a escribir beta/nombre.
    syncBetaInvitation(get(page).url.searchParams);

    aplicarTodosLosFiltros();

    // Abrir modal si la URL tiene ?modal=[slug]
    const modalSlug = searchState.modal;
    if (!modalSlug) return;
    const resolution = await resolveReleaseBySlug(modalSlug);
    if (resolution.status === 'resolved') {
      lanzamientoActivo = resolution.release;
      const storedEntry = currentModalEntry();
      const bootEntry = storedEntry ? null : takeBootModalEntry(modalSlug);
      if (storedEntry || bootEntry) {
        modalSession = restoreModalSession(storedEntry ?? bootEntry);
        // `page.state` arrancó vacío: reescribir el marker para que las escrituras siguientes lo conserven.
        if (bootEntry) markModalEntry(modalSession);
      } else {
        modalSession = startModalSession('direct', searchState, unknownSearchParams, slugFromLanzamiento(resolution.release));
        markModalEntry(modalSession);
      }
    } else {
      searchState = createSearchState({ ...searchState, modal: null });
      await replaceSearchHref(searchHref(searchState), null);
    }
  }

  // Reintento tras un fallo de carga: vuelve a pasar por el esqueleto.
  function reintentarCarga() {
    if (cargandoTSV) return;
    void initialize();
  }

  onMount(() => {
    mounted = true;

    const manejarClickGlobal = (event) => {
      document.querySelectorAll('.dropdown[open]').forEach((dropdown) => {
        if (!dropdown.contains(event.target)) dropdown.removeAttribute('open');
      });
    };

    document.addEventListener('click', manejarClickGlobal);
    // La hoja (Sheet) sigue el viewport visual por su cuenta.
    const stopMobileSearchChrome = observeMobileSearchChrome({
      sheetOpen: () => modalFiltrosMobile,
      onSearchVisible: (visible) => (mobileSearchVisible = visible),
      onViewport: () => {}
    });
    void initialize();
    const stopFranja = observarPrimerScroll({
      alReducir: () => {
        if (!franjaEl || franjaSinTexto || esMovil()) return false;
        // Con la franja a la vista, reduce ya y con transición.
        if (franjaEl.getBoundingClientRect().bottom > 0) return reducirFranja();
        // Entera fuera de la vista no hay nada que animar, y reducir en mitad de
        // un salto de scroll mueve lo que se está pulsando: se espera al reposo.
        cancelarReduccionPendiente ??= alAsentarseElScroll(() => {
          cancelarReduccionPendiente = null;
          const caja = franjaEl?.getBoundingClientRect();
          reducirFranja({ instantanea: !caja || caja.bottom <= 0 });
        });
        return true;
      }
    });
    return () => {
      mounted = false;
      stopFranja();
      cancelarReduccionPendiente?.();
      terminarAnimacionFranja();
      document.removeEventListener('click', manejarClickGlobal);
      stopMobileSearchChrome();
    };
  });

  function actualizarFiltros({ detail }) {
    searchState = withFilterForm(searchState, detail);
    aplicarTodosLosFiltros();
  }

  function actualizarRadar(event) {
    searchState = withRadar(searchState, event.detail);
    aplicarTodosLosFiltros();
  }

  function aplicarTodosLosFiltros({ skipURL = false } = {}) {
    const evaluation = matchReleases(lanzamientos, searchStateToCriteria(searchState));
    const resultado = evaluation.matches.map(({ release }) => release);

    const total = totalPagesFor(resultado.length);
    if (searchState.page > total) searchState = createSearchState({ ...searchState, page: total });

    lanzamientosFiltrados = resultado;
    coincidencias = evaluation.matches;
    coincidenciasExactas = evaluation.exact;
    coincidenciasAproximadas = evaluation.approximate;

    if (!skipURL && !syncingFromURL) void navegarEstado();
  }

  function navegarEstado({ replaceState = false, historyEntry = undefined } = {}) {
    return navigateToSearch(searchState, unknownSearchParams, { replaceState, historyEntry });
  }
</script>

<!-- Desktop: el campo de HomeSearchBar abre el panel. Móvil: la barra persistente y la hoja. -->
<HomeFranja
  modo={betaInvitation ? 'beta' : welcomeVisible ? 'bienvenida' : 'reducida'}
  reducir={franjaReducida} bind:el={franjaEl} bind:campo={franjaCampoEl}
>
  {#if betaInvitation}
    <BetaInvitation name={betaInvitation.name} onclose={dismissBetaInvitation} />
  {:else if welcomeVisible}
    <HomeWelcome content={WELCOME_CONTENT} onclose={closeWelcome} />
  {/if}
</HomeFranja>

<MobileSearchBar
  visible={mobileSearchVisible} expanded={modalFiltrosMobile} count={contarFiltrosActivos} view={vista}
  {lanzamientos} valores={filtrosSeleccionados}
  bind:inputEl={mobileSearchInputEl} bind:filtersButtonEl={mobileFiltersButtonEl}
  on:filtrar={actualizarFiltros} on:open={(event) => abrirFiltrosMobile(event.detail)}
  on:view={(event) => cambiarVista(event.detail)}
/>

<!-- Va después de la barra móvil: en móvil solo muestra la banda de chips. -->
<HomeSearchBar
  bind:open={mostrarPanelFiltros} {lanzamientos} valores={filtrosSeleccionados} pills={activePills}
  compacta={franjaSinTexto || franjaReducida} titulo={WELCOME_CONTENT.title}
  bind:radarRef bind:inputEl={desktopSearchInputEl}
  on:remove={(event) => quitarPill(event.detail)}
  on:filtrar={actualizarFiltros} on:filtrarRadar={actualizarRadar} on:reset={reiniciarFiltrosYRadar}
/>

<HomeResults
  loading={cargandoTSV} error={errorCargaCatalogo} announcement={anuncioResultados}
  page={paginaActual} totalPages={totalPaginas} order={searchState.order} orders={ordenesDisponibles}
  approximateNotice={haySoloAproximados ? 'No encontramos resultados exactos, pero aquí tienes los más cercanos.' : ''}
  matches={coincidencias} pageMatches={coincidenciasPaginadas}
  onlyApproximate={haySoloAproximados} separatorAtStart={mostrarSeparadorAlInicio}
  hasCriteria={hasSearchCriteria(searchState)} view={vista}
  bind:gridEl={resultadosGridEl}
  on:page={(event) => irAPagina(event.detail)}
  on:order={(event) => cambiarOrden(event.detail)}
  on:view={(event) => cambiarVista(event.detail)}
  on:retry={reintentarCarga}
  on:reset={reiniciarFiltrosYRadar}
  on:abrir={(event) => abrirModal(event.detail)}
/>

<MobileFilterSheet
  open={modalFiltrosMobile} pills={activePills} {lanzamientos} valores={filtrosSeleccionados}
  returnFocus={filtrosMobileTriggerEl} bind:radarRef={radarRefMobile}
  on:close={cerrarFiltrosMobile} on:remove={(event) => quitarPill(event.detail)}
  on:filtrar={actualizarFiltros} on:filtrarRadar={actualizarRadar} on:reset={reiniciarFiltrosYRadar}
/>

{#if lanzamientoActivo}
  <LanzamientoModal
    lanzamiento={lanzamientoActivo}
    recommendations={recomendacionesActivas}
    returnFocus={modalReturnFocus}
    on:cerrar={cerrarModal}
    on:recomendar={(event) => abrirRecomendacion(event.detail)}
  />
{/if}
