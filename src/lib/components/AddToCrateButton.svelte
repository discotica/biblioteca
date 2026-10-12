<script lang="ts">
  import { user } from '$lib/stores/authStore';
  import { crates, cratesLoaded, cargarCrates, agregarItem, quitarItemPorLanzamiento, lanzamientosEnCrate } from '$lib/stores/cratesStore';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { resolveReleaseId } from '$lib/utils/catalogoStore';
  import { anchoredLayer, dropdownMenu } from '$lib/ui/overlay';
  import { withoutBetaInvitationSearch } from '$lib/domain/betaInvitation';
  import Button from '$lib/ui/Button.svelte';
  import Icon from '$lib/ui/Icon.svelte';

  export let releaseId: string | undefined;
  export let lanzamientoSlug: string;
  /** Layer inside ReleaseDetail, outside its scrolling and clipping boxes. */
  export let menuPortalTarget: HTMLElement | undefined;
  /** Talla del disparador: md en la ficha de escritorio, sm en la barra de una columna. */
  export let size: 'sm' | 'md' = 'md';

  let abierto = false;
  let lanzamientosEnCrates: Map<string, Set<string>> = new Map();
  let cargandoSlug: string | null = null;
  let releaseIdResuelto: string | null = null;
  let error = '';
  let triggerEl: HTMLButtonElement | HTMLAnchorElement | undefined;
  $: menuId = `crate-menu-${releaseId ?? lanzamientoSlug}`;

  $: if (abierto && !$cratesLoaded) cargarCrates();

  async function toggleAbierto() {
    if (!$user) {
      goto(`/auth/login?redirect=${encodeURIComponent($page.url.pathname + withoutBetaInvitationSearch($page.url.search))}`);
      return;
    }
    abierto = !abierto;
    if (abierto) {
      error = '';
      if (!releaseId && !releaseIdResuelto) {
        try {
          releaseIdResuelto = await resolveReleaseId(lanzamientoSlug);
        } catch {
          error = 'No se pudo preparar este lanzamiento para la colección.';
        }
      }
      if (!releaseIdResuelto && !releaseId) {
        error = error || 'Este lanzamiento no tiene una equivalencia canónica única.';
        return;
      }
      await cargarLanzamientosPorCrate();
    }
  }

  $: releaseIdEfectivo = releaseId ?? releaseIdResuelto ?? undefined;
  $: claveLanzamiento = releaseIdEfectivo ?? lanzamientoSlug;
  $: usaReleaseId = Boolean(releaseIdEfectivo);

  async function cargarLanzamientosPorCrate() {
    for (const crate of $crates) {
      if (!lanzamientosEnCrates.has(crate.id)) {
        const lanzamientos = await lanzamientosEnCrate(crate.id, usaReleaseId);
        lanzamientosEnCrates.set(crate.id, lanzamientos);
        lanzamientosEnCrates = lanzamientosEnCrates;
      }
    }
  }

  async function toggleItem(crateId: string) {
    const lanzamientos = lanzamientosEnCrates.get(crateId);
    const estaEnCrate = lanzamientos?.has(claveLanzamiento) ?? false;
    cargandoSlug = crateId;
    error = '';

    if (estaEnCrate) {
      const removido = await quitarItemPorLanzamiento(crateId, lanzamientoSlug, releaseIdEfectivo);
      if (removido) lanzamientos?.delete(claveLanzamiento);
      else error = 'No se pudo quitar el lanzamiento de la colección.';
    } else {
      const resultado = await agregarItem(crateId, lanzamientoSlug, releaseIdEfectivo);
      if (resultado.ok) {
        if (lanzamientos) {
          lanzamientos.add(claveLanzamiento);
        } else {
          lanzamientosEnCrates.set(crateId, new Set([claveLanzamiento]));
        }
      } else if (resultado.yaExiste) {
        error = 'Este lanzamiento ya está en la colección.';
      } else {
        error = 'No se pudo añadir el lanzamiento a la colección.';
      }
    }
    lanzamientosEnCrates = lanzamientosEnCrates;
    cargandoSlug = null;
  }

  function cerrar() {
    abierto = false;
  }

  async function crearNuevoCrate() {
    cerrar();
    await goto('/mis-colecciones?crear=1');
  }
</script>

<div class="add-crate-wrap">
  <Button
    variant="secondary"
    {size}
    icon="agregar"
    class="btn-add-crate"
    bind:element={triggerEl}
    onclick={toggleAbierto}
    aria-haspopup="menu"
    aria-expanded={abierto}
    aria-controls={abierto ? menuId : undefined}
  >
    Añadir a colección
  </Button>

  {#if abierto}
    <div
      class="crate-dropdown"
      id={menuId}
      role="menu"
      tabindex="-1"
      use:anchoredLayer={{ target: menuPortalTarget, trigger: triggerEl }}
      use:dropdownMenu={{ onClose: cerrar, trigger: triggerEl }}
    >
      {#if $crates.length === 0}
        <div class="dropdown-vacio">
          <span>No tienes colecciones aún.</span>
          <button type="button" class="link-crear" on:click={crearNuevoCrate}>Crear una</button>
        </div>
      {:else}
        {#each $crates as crate (crate.id)}
          {@const estaEn = lanzamientosEnCrates.get(crate.id)?.has(claveLanzamiento) ?? false}
          <button
            class="crate-opcion"
            class:en-crate={estaEn}
            disabled={cargandoSlug === crate.id}
            on:click={() => toggleItem(crate.id)}
            role="menuitem"
          >
            <span class="check-icon" aria-hidden="true">{#if estaEn}<Icon name="check" size="sm" />{/if}</span>
            <span class="opcion-nombre">{crate.name}</span>
            <span class="opcion-conteo">{crate.item_count ?? 0}</span>
          </button>
        {/each}
      {/if}

      {#if error}
        <p class="crate-error" role="status">{error}</p>
      {/if}

      <div class="dropdown-footer">
        <button type="button" class="nuevo-crate-link" on:click={crearNuevoCrate}><Icon name="agregar" size="sm" />Nueva colección</button>
      </div>
    </div>
  {/if}
</div>

<style>
  /* En la línea de acciones de la ficha: si no cabe (pantallas de menos de
     360 px), el texto se recorta con elipsis en lugar de partir la línea. */
  .add-crate-wrap {
    position: relative;
    display: inline-flex;
    flex: 0 1 auto;
    min-width: 0;
  }

  .add-crate-wrap :global(.btn-add-crate) { min-width: 0; max-width: 100%; }

  .crate-dropdown {
    position: absolute;
    top: 0;
    left: 0;
    min-width: var(--menu-min-w);
    background: var(--color-panel-raised);
    border: 1px solid var(--color-linea);
    border-radius: var(--radius-base);
    padding: var(--space-1);
    z-index: var(--layer-dropdown);
    box-shadow: var(--shadow-flotante);
    animation: dropIn var(--motion-fast) var(--ease-standard);
  }

  @media (prefers-reduced-motion: reduce) {
    .crate-dropdown { animation: none; }
  }

  @keyframes dropIn {
    from { opacity: 0; transform: translateY(-6px) scale(.97); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }

  .dropdown-vacio {
    padding: 1rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: .5rem;
    font-size: var(--text-xs);
    color: var(--color-texto-tenue);
  }

  .dropdown-vacio .link-crear {
    color: var(--color-acento);
    font-weight: 700;
    border: 0;
    background: none;
    font: inherit;
    cursor: pointer;
  }

  .crate-opcion {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    width: 100%;
    min-height: var(--target-touch);
    box-sizing: border-box;
    background: none;
    border: none;
    border-radius: var(--radius-sm);
    padding: 0 var(--space-3);
    color: inherit;
    cursor: pointer;
    font-family: inherit;
    transition: background var(--motion-fast) ease;
    text-align: left;
  }

  .crate-error {
    margin: .45rem .75rem;
    color: var(--color-danger);
    font-size: var(--text-2xs);
    line-height: 1.4;
  }

  .crate-opcion:hover:not(:disabled) {
    background: var(--color-superficie-2);
  }

  .crate-opcion:disabled {
    opacity: .5;
  }

  .crate-opcion.en-crate {
    background: var(--color-acento-tinte);
  }

  .check-icon {
    display: inline-flex;
    width: var(--icon-sm);
    color: var(--color-acento);
    flex-shrink: 0;
  }

  .opcion-nombre {
    flex: 1;
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--color-texto-alto);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .crate-opcion.en-crate .opcion-nombre {
    color: var(--color-texto);
  }

  .opcion-conteo {
    font-size: var(--text-2xs);
    color: var(--color-texto-tenue);
    font-weight: 700;
    flex-shrink: 0;
  }

  .dropdown-footer {
    border-top: 1px solid var(--color-linea-sutil);
    margin-top: var(--space-1);
    padding: 0 var(--space-3);
  }

  .nuevo-crate-link {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    min-height: var(--target-touch);
    padding: 0;
    font-size: var(--text-xs);
    font-weight: 700;
    color: var(--color-acento-texto);
    transition: color var(--motion-fast) ease;
    border: 0;
    background: none;
    font-family: inherit;
    cursor: pointer;
  }

  .nuevo-crate-link:hover {
    color: var(--color-acento);
  }
</style>
