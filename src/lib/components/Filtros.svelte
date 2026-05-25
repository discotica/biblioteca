<script>
  import { createEventDispatcher, onMount } from 'svelte';

  export let valores = {
    pais: [],
    genero: [],
    texto: [],
    año: '',
    mes: '',
    type: '',
    orden: 'fecha-desc'
  };

  export let lanzamientos = [];
  const dispatch = createEventDispatcher();

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function normalizarPais(s) {
    return (s ?? '')
      .toString()
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/\s+/g, ' ');
  }

  const PAISES_LATAM_CARIBE = new Set([
    'argentina','ar','bolivia','bo','brasil','brazil','br','chile','cl','colombia','co','ecuador','ec','paraguay','py','peru','pe','uruguay','uy','venezuela','ve','guyana','gy','suriname','sr','guayana francesa','guayana frances','french guiana','guyane francaise','gf',
    'mexico','mejico','mx','guatemala','gt','belize','bz','honduras','hn','el salvador','sv','nicaragua','ni','costa rica','cr','panama','pa',
    'cuba','cu','republica dominicana','rep. dominicana','dominican republic','do','haiti','ht','puerto rico','pr','jamaica','jm','trinidad y tobago','trinidad and tobago','tt','bahamas','bs','barbados','bb','antigua y barbuda','antigua and barbuda','ag','saint kitts and nevis','san cristobal y nieves','kn','saint lucia','santa lucia','lc','saint vincent and the grenadines','san vicente y las granadinas','vc','grenada','granada','gd','dominica','dm','aruba','aw','curazao','curacao','cw','bonaire','bq','cayman islands','islas caiman','ky','virgin islands','islas virgenes','vi','vg','guadalupe','guadeloupe','gp','martinica','martinique','mq'
  ].map(normalizarPais));

  function extraerYearMonthDDMMYYYY(fecha) {
    const s = (fecha ?? '').toString().trim();
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (!m) return { year: '', month: '' };
    const month = pad2(m[2]);
    let year = m[3];
    if (year.length === 2) year = `20${year}`;
    return { year, month };
  }

  $: paisesUnicos = Array.from(
    new Set(
      (lanzamientos ?? [])
        .flatMap(l => (l.country ?? []))
        .filter(Boolean)
        .filter(p => PAISES_LATAM_CARIBE.has(normalizarPais(p)))
    )
  ).sort((a, b) => a.localeCompare(b, 'es'));

  $: generosUnicos = Array.from(
    new Set((lanzamientos ?? []).flatMap(l => (l.genre ?? [])).filter(Boolean))
  ).sort();

  $: tiposUnicos = Array.from(
    new Set((lanzamientos ?? []).map(l => l.type).filter(Boolean))
  ).sort();

  $: añosUnicos = Array.from(
    new Set((lanzamientos ?? [])
      .map(l => extraerYearMonthDDMMYYYY(l.release_date).year)
      .filter(Boolean)
    )
  ).sort((a, b) => Number(b) - Number(a));

  $: mesesUnicos = Array.from(
    new Set((lanzamientos ?? [])
      .map(l => extraerYearMonthDDMMYYYY(l.release_date).month)
      .filter(Boolean)
    )
  ).sort((a, b) => Number(a) - Number(b));

  const NOMBRE_MES = {
    '01': 'Enero', '02': 'Febrero', '03': 'Marzo', '04': 'Abril',
    '05': 'Mayo', '06': 'Junio', '07': 'Julio', '08': 'Agosto',
    '09': 'Septiembre', '10': 'Octubre', '11': 'Noviembre', '12': 'Diciembre'
  };

  let textoTemporal = '';
  let dropdownAbierto = false;
  let indiceSugerencia = -1;

  function normalizar(s) {
    return (s ?? '').toString().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim();
  }

  $: artistasUnicos = Array.from(
    new Set((lanzamientos ?? []).flatMap(l => l.artist ?? []).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, 'es'));

  $: sellosUnicos = Array.from(
    new Set((lanzamientos ?? []).map(l => l.label).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, 'es'));

  $: albumsUnicos = Array.from(
    new Set((lanzamientos ?? []).map(l => l.title).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, 'es'));

  function matchTop(lista, query, max = 5) {
    const q = normalizar(query);
    if (!q) return [];
    return lista.filter(item => normalizar(item).includes(q)).slice(0, max);
  }

  $: gruposSugerencias = (() => {
    const q = textoTemporal.trim();
    if (!q) return [];
    const grupos = [];
    const mp = matchTop(paisesUnicos, q, 4);
    if (mp.length) grupos.push({ tipo: 'pais', label: 'País', items: mp });
    const mg = matchTop(generosUnicos, q, 4);
    if (mg.length) grupos.push({ tipo: 'genero', label: 'Género', items: mg });
    const ma = matchTop(artistasUnicos, q, 5);
    if (ma.length) grupos.push({ tipo: 'artista', label: 'Artista', items: ma });
    const ms = matchTop(sellosUnicos, q, 3);
    if (ms.length) grupos.push({ tipo: 'sello', label: 'Sello', items: ms });
    const mal = matchTop(albumsUnicos, q, 3);
    if (mal.length) grupos.push({ tipo: 'album', label: 'Álbum', items: mal });
    return grupos;
  })();

  $: sugerenciasPlanas = gruposSugerencias.flatMap(g => g.items.map(v => ({ tipo: g.tipo, value: v })));

  $: {
    const q = textoTemporal.trim();
    if (q && gruposSugerencias.length > 0) {
      dropdownAbierto = true;
    } else if (!q) {
      dropdownAbierto = false;
      indiceSugerencia = -1;
    }
  }

  function elegirSugerencia(tipo, valor) {
    if (tipo === 'pais') {
      toggleEnLista('pais', valor);
    } else if (tipo === 'genero') {
      toggleEnLista('genero', valor);
    } else {
      toggleEnLista('texto', valor);
    }
    textoTemporal = '';
    dropdownAbierto = false;
    indiceSugerencia = -1;
  }

  function buscarTextoLibre() {
    const q = textoTemporal.trim();
    if (!q) return;
    toggleEnLista('texto', q);
    textoTemporal = '';
    dropdownAbierto = false;
    indiceSugerencia = -1;
  }

  function onKeydown(e) {
    if (e.key === 'Escape') {
      dropdownAbierto = false;
      indiceSugerencia = -1;
      return;
    }
    const total = sugerenciasPlanas.length + 1; // +1 for free-text option
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!dropdownAbierto) { dropdownAbierto = gruposSugerencias.length > 0; return; }
      indiceSugerencia = indiceSugerencia < total - 1 ? indiceSugerencia + 1 : -1;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!dropdownAbierto) return;
      indiceSugerencia = indiceSugerencia > -1 ? indiceSugerencia - 1 : total - 1;
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (dropdownAbierto && indiceSugerencia >= 0 && indiceSugerencia < sugerenciasPlanas.length) {
        const { tipo, value } = sugerenciasPlanas[indiceSugerencia];
        elegirSugerencia(tipo, value);
      } else {
        buscarTextoLibre();
      }
    }
  }

  function onSearchBlur() {
    setTimeout(() => { dropdownAbierto = false; indiceSugerencia = -1; }, 160);
  }

  function updateCampo(key, value) {
    const nuevo = { ...valores, [key]: value };
    dispatch('filtrar', nuevo);
  }

  function toggleEnLista(key, valor) {
    const yaEstá = valores[key].includes(valor);
    const nuevo = {
      ...valores,
      [key]: yaEstá ? valores[key].filter(v => v !== valor) : [...valores[key], valor]
    };
    dispatch('filtrar', nuevo);
  }

  let detPais, detGenero;

  function handleClickOutside(e) {
    if (detPais && !detPais.contains(e.target)) detPais.removeAttribute('open');
    if (detGenero && !detGenero.contains(e.target)) detGenero.removeAttribute('open');
  }

  onMount(() => {
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  });


</script>

<section class="filtros-panel">
  <div class="filtros-body">

    <!-- Búsqueda enriquecida -->
    <div class="campo-busqueda">
      <div class="busqueda-wrap">
        <div class="busqueda-input-row">
          <svg class="busqueda-icono" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" stroke-width="1.6"/>
            <line x1="10" y1="10" x2="14" y2="14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
          </svg>
          <input
            class="busqueda-input"
            type="text"
            bind:value={textoTemporal}
            placeholder="País, género, artista, sello o álbum…"
            autocomplete="off"
            spellcheck="false"
            on:keydown={onKeydown}
            on:blur={onSearchBlur}
            on:focus={() => { if (gruposSugerencias.length) dropdownAbierto = true; }}
          />
          {#if textoTemporal}
            <button
              class="busqueda-clear"
              type="button"
              aria-label="Limpiar búsqueda"
              on:click={() => { textoTemporal = ''; dropdownAbierto = false; }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
                <line x1="10" y1="2" x2="2" y2="10" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
              </svg>
            </button>
          {/if}
        </div>

        {#if dropdownAbierto && gruposSugerencias.length > 0}
          <div class="busqueda-dropdown" role="listbox" aria-label="Sugerencias de búsqueda">
            {#each gruposSugerencias as grupo}
              <div class="sug-grupo">
                <span class="sug-grupo-label">{grupo.label}</span>
                {#each grupo.items as item}
                  {@const flatIdx = sugerenciasPlanas.findIndex(s => s.tipo === grupo.tipo && s.value === item)}
                  <button
                    class="sug-item"
                    class:sug-item--focused={flatIdx === indiceSugerencia}
                    type="button"
                    role="option"
                    aria-selected={flatIdx === indiceSugerencia}
                    on:click={() => elegirSugerencia(grupo.tipo, item)}
                  >
                    <span class="sug-tipo sug-tipo--{grupo.tipo}">{grupo.label}</span>
                    <span class="sug-valor">{item}</span>
                  </button>
                {/each}
              </div>
            {/each}

            <div class="sug-libre-wrap">
              <button
                class="sug-libre"
                class:sug-item--focused={indiceSugerencia === sugerenciasPlanas.length}
                type="button"
                on:click={buscarTextoLibre}
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                  <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" stroke-width="1.5"/>
                  <line x1="9" y1="9" x2="12.5" y2="12.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
                Buscar "<strong>{textoTemporal.trim()}</strong>"
              </button>
            </div>
          </div>
        {/if}
      </div>
    </div>

    <!-- Tag clouds: País + Género (collapsible) -->
    <div class="clouds-row">
      <div class="cloud-campo">
        <span class="campo-label">País</span>
        <details class="cloud-dropdown" bind:this={detPais}>
          <summary class="cloud-summary">
            <span class="cloud-text">
              {#if valores.pais.length > 0}{valores.pais.join(', ')}{:else}Seleccionar{/if}
            </span>
            {#if valores.pais.length > 0}
              <span class="cloud-count">{valores.pais.length}</span>
            {/if}
          </summary>
          <div class="cloud-body">
            <div class="tag-cloud">
              {#each paisesUnicos as pais}
                <button
                  type="button"
                  class="tag"
                  class:tag--active={valores.pais.includes(pais)}
                  on:click={() => toggleEnLista('pais', pais)}
                >{pais}</button>
              {/each}
            </div>
          </div>
        </details>
      </div>

      <div class="cloud-campo">
        <span class="campo-label">Género</span>
        <details class="cloud-dropdown" bind:this={detGenero}>
          <summary class="cloud-summary">
            <span class="cloud-text">
              {#if valores.genero.length > 0}{valores.genero.join(', ')}{:else}Seleccionar{/if}
            </span>
            {#if valores.genero.length > 0}
              <span class="cloud-count">{valores.genero.length}</span>
            {/if}
          </summary>
          <div class="cloud-body">
            <div class="tag-cloud">
              {#each generosUnicos as genero}
                <button
                  type="button"
                  class="tag"
                  class:tag--active={valores.genero.includes(genero)}
                  on:click={() => toggleEnLista('genero', genero)}
                >{genero}</button>
              {/each}
            </div>
          </div>
        </details>
      </div>
    </div>

    <!-- Dropdowns secundarios -->
    <div class="select-row">
      <div class="campo">
        <span class="campo-label">Tipo</span>
        <details class="dropdown">
          <summary>{valores.type || 'Seleccionar'}</summary>
          <ul>
            <li>
              <button type="button" on:click={() => updateCampo('type', '')}>
                Todos {#if !valores.type}<span class="tick">✔</span>{/if}
              </button>
            </li>
            {#each tiposUnicos as tipo}
              <li>
                <button type="button" on:click={() => updateCampo('type', tipo)}>
                  {tipo}{#if valores.type === tipo} <span class="tick">✔</span>{/if}
                </button>
              </li>
            {/each}
          </ul>
        </details>
      </div>

      <div class="campo">
        <span class="campo-label">Año</span>
        <details class="dropdown">
          <summary>{valores.año || 'Seleccionar'}</summary>
          <ul>
            <li>
              <button type="button" on:click={() => updateCampo('año', '')}>
                Todos {#if !valores.año}<span class="tick">✔</span>{/if}
              </button>
            </li>
            {#each añosUnicos as año}
              <li>
                <button type="button" on:click={() => updateCampo('año', año)}>
                  {año}{#if String(valores.año) === String(año)} <span class="tick">✔</span>{/if}
                </button>
              </li>
            {/each}
          </ul>
        </details>
      </div>

      <div class="campo">
        <span class="campo-label">Mes</span>
        <details class="dropdown">
          <summary>
            {#if valores.mes}{NOMBRE_MES[valores.mes]}{:else}Seleccionar{/if}
          </summary>
          <ul>
            <li>
              <button type="button" on:click={() => updateCampo('mes', '')}>
                Todos {#if !valores.mes}<span class="tick">✔</span>{/if}
              </button>
            </li>
            {#each mesesUnicos as mm}
              <li>
                <button type="button" on:click={() => updateCampo('mes', mm)}>
                  {NOMBRE_MES[mm] || mm}{#if valores.mes === mm} <span class="tick">✔</span>{/if}
                </button>
              </li>
            {/each}
          </ul>
        </details>
      </div>

      <div class="campo">
        <span class="campo-label">Ordenar por</span>
        <details class="dropdown">
          <summary>
            {
              {
                'fecha-desc': 'Más reciente',
                'fecha-asc': 'Más antiguo',
                'artista-asc': 'Artista A → Z',
                'artista-desc': 'Artista Z → A',
                'titulo-asc': 'Título A → Z',
                'titulo-desc': 'Título Z → A'
              }[valores.orden]
            }
          </summary>
          <ul>
            {#each [
              ['fecha-desc', 'Más reciente'],
              ['fecha-asc', 'Más antiguo'],
              ['artista-asc', 'Artista A → Z'],
              ['artista-desc', 'Artista Z → A'],
              ['titulo-asc', 'Título A → Z'],
              ['titulo-desc', 'Título Z → A']
            ] as [valor, label]}
              <li>
                <button
                  type="button"
                  on:click={() => {
                    const nuevo = { ...valores, orden: valor };
                    dispatch('filtrar', nuevo);
                  }}
                >
                  {label}{#if valores.orden === valor} <span class="tick">✔</span>{/if}
                </button>
              </li>
            {/each}
          </ul>
        </details>
      </div>
    </div>

  </div>
</section>

<style>
.filtros-panel {
  background: rgba(255, 255, 255, .02);
  border: 1px solid var(--color-borde);
  border-radius: 18px;
  padding: 1.25rem;
  box-shadow: 0 18px 50px rgba(0, 0, 0, .35);
}

.filtros-body {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}

.campo-busqueda { width: 100%; }

/* Rich search */
.busqueda-wrap {
  position: relative;
  width: 100%;
}

.busqueda-input-row {
  display: flex;
  align-items: center;
  gap: .55rem;
  background: rgba(0, 0, 0, .22);
  border: 1px solid var(--color-borde);
  border-radius: 12px;
  padding: .6rem .75rem;
  transition: border-color 140ms ease, box-shadow 140ms ease, background 140ms ease;
}

.busqueda-input-row:focus-within {
  border-color: rgba(150, 247, 25, .55);
  box-shadow: 0 0 0 3px rgba(150, 247, 25, .12);
  background: rgba(0, 0, 0, .28);
}

.busqueda-icono {
  color: rgba(248, 255, 238, .3);
  flex-shrink: 0;
  pointer-events: none;
}

.busqueda-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--color-texto);
  font-family: var(--font-base);
  font-size: .92rem;
  min-width: 0;
  padding: 0;
}

.busqueda-input::placeholder {
  color: rgba(248, 255, 238, .38);
}

.busqueda-clear {
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  padding: 3px;
  cursor: pointer;
  color: rgba(248, 255, 238, .35);
  border-radius: 4px;
  flex-shrink: 0;
  transition: color 100ms ease, background 100ms ease;
}

.busqueda-clear:hover {
  color: var(--color-texto);
  background: rgba(255, 255, 255, .06);
}

/* Suggestions dropdown */
.busqueda-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  z-index: 50;
  background: rgba(11, 11, 11, .98);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  border: 1px solid rgba(255, 255, 255, .1);
  border-radius: 14px;
  padding: .45rem;
  box-shadow: 0 16px 48px rgba(0, 0, 0, .55);
}

.sug-grupo {
  margin-bottom: .1rem;
}

.sug-grupo-label {
  display: block;
  font-size: .63rem;
  font-weight: 700;
  letter-spacing: .12em;
  text-transform: uppercase;
  color: rgba(248, 255, 238, .25);
  padding: .35rem .55rem .15rem;
}

.sug-item {
  display: flex;
  align-items: center;
  gap: .55rem;
  width: 100%;
  padding: .48rem .55rem;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 9px;
  cursor: pointer;
  text-align: left;
  transition: background 100ms ease, border-color 100ms ease;
  font-family: var(--font-base);
}

.sug-item:hover,
.sug-item--focused {
  background: rgba(255, 255, 255, .05);
  border-color: rgba(255, 255, 255, .07);
}

.sug-tipo {
  font-size: .63rem;
  font-weight: 700;
  letter-spacing: .06em;
  text-transform: uppercase;
  border-radius: 999px;
  padding: .18rem .48rem;
  line-height: 1.4;
  flex-shrink: 0;
  border: 1px solid transparent;
}

.sug-tipo--pais {
  background: rgba(56, 189, 248, .1);
  border-color: rgba(56, 189, 248, .32);
  color: rgb(125, 211, 252);
}

.sug-tipo--genero {
  background: rgba(167, 139, 250, .1);
  border-color: rgba(167, 139, 250, .32);
  color: rgb(196, 181, 253);
}

.sug-tipo--artista {
  background: rgba(150, 247, 25, .08);
  border-color: rgba(150, 247, 25, .3);
  color: var(--color-acento);
}

.sug-tipo--sello {
  background: rgba(251, 191, 36, .08);
  border-color: rgba(251, 191, 36, .3);
  color: rgb(252, 211, 77);
}

.sug-tipo--album {
  background: rgba(248, 113, 113, .08);
  border-color: rgba(248, 113, 113, .3);
  color: rgb(252, 165, 165);
}

.sug-valor {
  font-size: .88rem;
  color: var(--color-texto);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sug-libre-wrap {
  margin-top: .3rem;
  padding-top: .3rem;
  border-top: 1px solid rgba(255, 255, 255, .06);
}

.sug-libre {
  display: flex;
  align-items: center;
  gap: .55rem;
  width: 100%;
  padding: .48rem .55rem;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 9px;
  cursor: pointer;
  text-align: left;
  font-family: var(--font-base);
  font-size: .85rem;
  color: rgba(248, 255, 238, .48);
  transition: background 100ms ease, color 100ms ease, border-color 100ms ease;
}

.sug-libre:hover,
.sug-libre.sug-item--focused {
  background: rgba(255, 255, 255, .05);
  border-color: rgba(255, 255, 255, .07);
  color: var(--color-texto);
}

.sug-libre svg {
  flex-shrink: 0;
  opacity: .5;
}

.sug-libre strong {
  color: var(--color-texto);
  font-weight: 600;
}

/* Cloud dropdowns */
.clouds-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: .75rem;
  align-items: start;
}

@media (max-width: 680px) {
  .clouds-row { grid-template-columns: 1fr; }
}

.cloud-campo {
  display: flex;
  flex-direction: column;
  gap: .35rem;
}

.campo-label {
  font-size: .75rem;
  font-weight: 600;
  letter-spacing: .2px;
  color: var(--color-texto-secundario);
}

.cloud-dropdown { position: relative; }

.cloud-summary {
  cursor: pointer;
  list-style: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .5rem;
  padding: .65rem .75rem;
  padding-right: 2.2rem;
  background: rgba(0, 0, 0, .22);
  border: 1px solid var(--color-borde);
  border-radius: 12px;
  color: var(--color-texto);
  font-size: .88rem;
  font-family: var(--font-base);
  position: relative;
  transition: border-color 140ms ease, box-shadow 140ms ease, background 140ms ease;
  user-select: none;
  line-height: 1.15;
}

.cloud-summary::-webkit-details-marker { display: none; }
.cloud-summary::marker { display: none; }

.cloud-summary::after {
  content: '▾';
  position: absolute;
  right: .8rem;
  font-size: .8rem;
  color: var(--color-texto-secundario);
  pointer-events: none;
  transform: translateY(-.5px);
}

.cloud-dropdown[open] .cloud-summary {
  border-color: rgba(150, 247, 25, .45);
  box-shadow: 0 0 0 3px rgba(150, 247, 25, .10);
  background: rgba(0, 0, 0, .28);
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
}

.cloud-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.cloud-count {
  background: rgba(150, 247, 25, .2);
  border: 1px solid rgba(150, 247, 25, .4);
  color: var(--color-acento);
  border-radius: 999px;
  padding: .12rem .45rem;
  font-size: .68rem;
  font-weight: 700;
  line-height: 1.4;
  flex-shrink: 0;
}

.cloud-body {
  border: 1px solid rgba(255, 255, 255, .1);
  border-top: none;
  border-radius: 0 0 12px 12px;
  background: rgba(12, 12, 12, .97);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  padding: .65rem;
  max-height: 180px;
  overflow-y: auto;
  position: absolute;
  left: 0;
  right: 0;
  z-index: 10;
  scrollbar-width: thin;
  scrollbar-color: rgba(150, 247, 25, .25) transparent;
}

.cloud-body::-webkit-scrollbar { width: 4px; }
.cloud-body::-webkit-scrollbar-thumb { background: rgba(150, 247, 25, .25); border-radius: 2px; }

.tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: .32rem;
}

.tag {
  appearance: none;
  border: 1px solid rgba(255, 255, 255, .12);
  background: rgba(255, 255, 255, .04);
  color: var(--color-texto-secundario);
  border-radius: 999px;
  padding: .32rem .7rem;
  font-family: var(--font-base);
  font-size: .78rem;
  cursor: pointer;
  transition: border-color 100ms ease, background 100ms ease, color 100ms ease;
  line-height: 1;
}

.tag:hover {
  border-color: rgba(150, 247, 25, .45);
  background: rgba(150, 247, 25, .08);
  color: var(--color-texto);
}

.tag--active {
  background: rgba(150, 247, 25, .18);
  border-color: rgba(150, 247, 25, .6);
  color: var(--color-acento);
  font-weight: 600;
}

/* Secondary selects row */
.select-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: .75rem;
  align-items: start;
}

@media (max-width: 860px) {
  .select-row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 480px) {
  .select-row { grid-template-columns: 1fr 1fr; }
}

.campo {
  display: flex;
  flex-direction: column;
  gap: .35rem;
}


/* Dropdowns */
.dropdown { position: relative; }

.dropdown summary {
  cursor: pointer;
  padding: .65rem .75rem;
  padding-right: 2.2rem;
  background: rgba(0, 0, 0, .22);
  border: 1px solid var(--color-borde);
  border-radius: 12px;
  color: var(--color-texto);
  font-size: .88rem;
  font-family: var(--font-base);
  list-style: none;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: .75rem;
  position: relative;
  transition: border-color 140ms ease, box-shadow 140ms ease, background 140ms ease;
  user-select: none;
  line-height: 1.15;
}

.dropdown summary::-webkit-details-marker { display: none; }
.dropdown summary::marker { display: none; }

.dropdown summary::after {
  content: '▾';
  position: absolute;
  right: .8rem;
  font-size: .8rem;
  color: var(--color-texto-secundario);
  pointer-events: none;
  transform: translateY(-.5px);
}

.dropdown[open] summary {
  border-color: rgba(150, 247, 25, .45);
  box-shadow: 0 0 0 3px rgba(150, 247, 25, .10);
  background: rgba(0, 0, 0, .28);
  border-bottom-left-radius: 10px;
  border-bottom-right-radius: 10px;
}

.dropdown ul {
  margin: 0;
  padding: .35rem;
  list-style: none;
  border: 1px solid rgba(255, 255, 255, .1);
  border-top: none;
  border-radius: 0 0 14px 14px;
  background: rgba(12, 12, 12, .97);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  opacity: 0;
  transform: translateY(-4px);
  max-height: 0;
  overflow: hidden;
  transition: max-height 180ms ease, opacity 160ms ease, transform 160ms ease;
  position: absolute;
  left: 0;
  right: 0;
  z-index: 10;
}

.dropdown[open] ul {
  opacity: 1;
  transform: translateY(0);
  max-height: 12rem;
  overflow: auto;
}

.dropdown li button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: .55rem .7rem;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 10px;
  color: var(--color-texto);
  font-family: var(--font-base);
  font-size: .85rem;
  cursor: pointer;
  transition: background 120ms ease, border-color 120ms ease;
  text-align: left;
}

.dropdown li button:hover {
  background: rgba(255, 255, 255, .06);
  border-color: rgba(255, 255, 255, .08);
}

.tick {
  margin-left: .5rem;
  color: var(--color-acento);
}

@media (prefers-reduced-motion: reduce) {
  .dropdown ul { transition: none; }
}
</style>
