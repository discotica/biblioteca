<script lang="ts">
  // Columna de datos de la ficha (U32, tablero G2): filas de 44 con la etiqueta
  // a la izquierda y el valor a la derecha. Una lista muestra hasta tres
  // nombres, los que quepan en la fila, y «N más» abre la lista completa
  // (nombre y cantidad, con enlace a su ficha) colgada de la columna.
  import { onMount } from 'svelte';
  import Menu from '$lib/ui/Menu.svelte';
  import type { FichaDato, FichaItem } from '$lib/domain/fichaDatos';

  type Props = {
    datos: FichaDato[];
    /** Nombre de la ficha: nombra cada desplegable («Sellos de Entrañas»). */
    entidad: string;
    class?: string;
  };

  let { datos, entidad, class: className = '' }: Props = $props();

  /** Como mucho, tres nombres en la fila. */
  const MAX_NOMBRES = 3;

  let columna = $state<HTMLElement>();
  /** Cuántos nombres caben, por etiqueta de fila. */
  let caben = $state<Record<string, number>>({});
  /** Fila por etiqueta: el ancla del desplegable es la columna, debajo de su fila. */
  let filas = $state<Record<string, HTMLElement>>({});

  const items = (dato: FichaDato): FichaItem[] => (dato.tipo === 'lista' ? dato.items : []);
  const visibles = (dato: FichaDato) => Math.min(caben[dato.etiqueta] ?? MAX_NOMBRES, items(dato).length);

  /**
   * Mide con copias ocultas de los nombres y del chip («N más»), con su misma
   * fuente: cuántos de los tres primeros caben junto al chip. Al menos uno, que
   * se recorta con puntos suspensivos si ni él cabe.
   */
  function medir() {
    if (!columna) return;
    const next: Record<string, number> = {};
    for (const fila of columna.querySelectorAll<HTMLElement>('[data-ficha-lista]')) {
      const etiqueta = fila.dataset.fichaLista ?? '';
      const total = Number(fila.dataset.total) || 0;
      const label = fila.querySelector<HTMLElement>('.ficha-dato__etiqueta');
      const medidas = fila.querySelector<HTMLElement>('.ficha-dato__medidas');
      if (!label || !medidas) continue;
      const nombres = Array.from(medidas.querySelectorAll<HTMLElement>('[data-medida="nombre"]'), (el) => el.offsetWidth);
      const coma = medidas.querySelector<HTMLElement>('[data-medida="coma"]')?.offsetWidth ?? 0;
      const chip = medidas.querySelector<HTMLElement>('[data-medida="chip"]')?.offsetWidth ?? 0;
      const style = getComputedStyle(fila);
      const gap = Number.parseFloat(style.columnGap) || 0;
      const disponible = fila.clientWidth - label.offsetWidth - gap;
      let n = 1;
      for (let k = Math.min(MAX_NOMBRES, total); k >= 1; k -= 1) {
        const texto = nombres.slice(0, k).reduce((sum, w) => sum + w, 0) + coma * (k - 1);
        const resto = k < total ? gap + chip : 0;
        if (texto + resto <= disponible) {
          n = k;
          break;
        }
      }
      next[etiqueta] = n;
    }
    caben = next;
  }

  onMount(() => {
    const observer = new ResizeObserver(() => medir());
    if (columna) observer.observe(columna);
    // La fuente propia llega después del primer pintado: se vuelve a medir.
    void document.fonts?.ready.then(() => medir());
    return () => observer.disconnect();
  });

  // Datos nuevos (otra ficha en la misma página): se mide de nuevo.
  $effect(() => {
    void datos;
    queueMicrotask(medir);
  });

  function registrar(node: HTMLElement, etiqueta: string) {
    filas = { ...filas, [etiqueta]: node };
    return {
      destroy() {
        const { [etiqueta]: _, ...resto } = filas;
        filas = resto;
      }
    };
  }
</script>

<dl class="ficha-datos {className}" bind:this={columna}>
  {#each datos as dato (dato.etiqueta)}
    {#if dato.tipo === 'texto'}
      <div class="ficha-dato">
        <dt class="ficha-dato__etiqueta">{dato.etiqueta}</dt>
        <dd class="ficha-dato__valor">
          {#if dato.href}<a class="ficha-dato__enlace" href={dato.href}>{dato.valor}</a>{:else}{dato.valor}{/if}
        </dd>
      </div>
    {:else}
      {@const n = visibles(dato)}
      {@const resto = dato.items.length - n}
      <div class="ficha-dato" data-ficha-lista={dato.etiqueta} data-total={dato.items.length} use:registrar={dato.etiqueta}>
        <dt class="ficha-dato__etiqueta">{dato.etiqueta}</dt>
        <dd class="ficha-dato__valor">
          <span class="ficha-dato__nombres">
            {#each dato.items.slice(0, n) as item, index (item.href)}
              {#if index > 0}<span class="ficha-dato__coma">{', '}</span>{/if}<a class="ficha-dato__enlace" href={item.href}>{item.nombre}</a>
            {/each}
          </span>
          {#if resto > 0}
            <Menu
              class="ficha-mas"
              presentation="lista"
              variant="ghost"
              size="sm"
              align="start"
              gutter={4}
              anchor={filas[dato.etiqueta]}
              buttonLabel={`${resto} más`}
              label={`${dato.etiqueta} de ${entidad}`}
              items={dato.items.map((item) => ({ label: item.nombre, detail: String(item.cantidad), href: item.href }))}
            />
          {/if}
          <!-- Copias para medir: mismas fuentes, fuera del flujo y de la lectura. -->
          <span class="ficha-dato__medidas" aria-hidden="true">
            {#each dato.items.slice(0, MAX_NOMBRES) as item (item.href)}<span data-medida="nombre">{item.nombre}</span>{/each}
            <span data-medida="coma">{', '}</span>
            <span class="ficha-dato__chip-medida" data-medida="chip">{dato.items.length} más</span>
          </span>
        </dd>
      </div>
    {/if}
  {/each}
</dl>

<style>
  .ficha-datos {
    margin: 0;
    font-size: var(--text-ficha-dato);
    line-height: var(--text-ficha-dato-lh);
  }

  .ficha-dato {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    min-height: var(--ficha-dato-h);
    border-top: 1px solid var(--color-linea-cenefa);
  }
  .ficha-dato:last-child { border-bottom: 1px solid var(--color-linea-cenefa); }

  .ficha-dato__etiqueta {
    flex: none;
    color: var(--color-texto); /* sobre portadas muy claras el .9 de --color-texto-cenefa no llega a 4,5:1 (U34) */
  }

  .ficha-dato__valor {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--space-2);
    min-width: 0;
    margin: 0;
    color: var(--color-texto);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .ficha-dato__nombres {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ficha-dato__enlace {
    color: inherit;
    text-decoration: none;
    border-radius: var(--radius-xs);
  }
  .ficha-dato__enlace:hover { text-decoration: underline; text-underline-offset: 3px; }
  .ficha-dato__enlace:focus-visible { outline: 2px solid var(--focus-ring-color); outline-offset: 2px; }

  .ficha-dato__medidas {
    position: absolute;
    top: 0;
    left: 0;
    visibility: hidden;
    pointer-events: none;
    white-space: pre;
  }
  .ficha-dato__medidas > span { display: inline-block; }

  /* «N más» (tablero G2): chip de 26 con caret; abierto, verde sobre el fondo. */
  .ficha-dato__chip-medida,
  .ficha-dato :global(.ficha-mas .ui-menu__trigger) {
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    height: var(--ficha-mas-h);
    padding: 0 6px 0 10px;
    border: 1px solid var(--color-linea-cenefa);
    border-radius: var(--ficha-mas-radius);
    font-size: var(--text-xs);
    font-weight: 600;
    white-space: nowrap;
  }
  /* El caret medido: el icono de 14 y su hueco. */
  .ficha-dato__chip-medida { padding-right: calc(6px + 14px + var(--space-1)); }

  .ficha-dato :global(.ficha-mas .ui-menu__trigger) {
    --btn-h: var(--ficha-mas-h);
    position: relative;
    min-height: var(--ficha-mas-h);
    background: var(--color-boton-cenefa);
    color: var(--color-texto);
  }
  .ficha-dato :global(.ficha-mas .ui-menu__trigger .ui-icon) {
    width: 14px;
    height: 14px;
    transition: transform var(--motion-fast) var(--ease-standard);
  }
  .ficha-dato :global(.ficha-mas .ui-menu__trigger:hover) { border-color: var(--color-texto); }
  .ficha-dato :global(.ficha-mas .ui-menu__trigger[aria-expanded='true']) {
    border-color: var(--color-acento);
    background: var(--color-fondo);
    color: var(--color-acento);
  }
  .ficha-dato :global(.ficha-mas .ui-menu__trigger[aria-expanded='true'] .ui-icon) { transform: rotate(180deg); }
  /* Área táctil de 44 sin cambiar la caja visible. */
  .ficha-dato :global(.ficha-mas .ui-menu__trigger::after) {
    content: '';
    position: absolute;
    inset: calc((var(--ficha-mas-h) - var(--target-touch)) / 2) 0;
  }

  @media (prefers-reduced-motion: reduce) {
    .ficha-dato :global(.ficha-mas .ui-menu__trigger .ui-icon) { transition: none; }
  }
</style>
