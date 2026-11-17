<script lang="ts">
  // Cabecera de ficha (U32, tablero G2): colección, artista y sello. Cenefa
  // troquelada con la portada más reciente y la huella del nombre, a todo el
  // ancho bajo el cabecero. Encima, en el contenedor del sitio: las migas, el
  // título en su propia fila (§3: ninguna columna lo estrecha) y, debajo, la
  // descripción y las acciones a la izquierda y la columna de datos de 372 a la
  // derecha, sobre la zona atenuada. En móvil, título y datos van bajo una
  // cenefa más baja.
  import { onMount, type Snippet } from 'svelte';
  import { Cenefa, type Rol } from '$lib/generative';
  import Breadcrumbs, { type Crumb } from '$lib/ui/Breadcrumbs.svelte';
  import { MOBILE_QUERY } from '$lib/ui/breakpoints';
  import type { FichaDato } from '$lib/domain/fichaDatos';
  import FichaDatos from './FichaDatos.svelte';

  type Props = {
    nombre: string;
    /** Colecciones: una o dos frases bajo el título. */
    descripcion?: string | null;
    portada?: string | null;
    /** Gama de la huella cuando no hay portada. */
    rol?: Rol;
    datos: FichaDato[];
    breadcrumbs?: Crumb[];
    /** Colecciones: compartir, editar y eliminar, bajo la descripción. */
    acciones?: Snippet;
  };

  let { nombre, descripcion = null, portada = null, rol = 'colaborador', datos, breadcrumbs, acciones }: Props = $props();

  const CENEFA = 400;
  const CENEFA_MOVIL = 180;

  let movil = $state(typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches);
  let cabeza = $state<HTMLElement>();
  let columna = $state<HTMLElement>();
  /** Alto de la cabecera en desktop: la cenefa crece si el contenido no cabe en 400. */
  let altoCabeza = $state(0);
  let ancho = $state(0);
  let zona = $state<number | null>(null);

  // El alto es del lienzo, no del CSS: estirar la máscara deformaría los puntos.
  const alto = $derived(movil ? CENEFA_MOVIL : Math.max(CENEFA, Math.round(altoCabeza)));

  /** La zona atenuada empieza un tramo antes de la columna y llega al borde derecho. */
  function medirZona() {
    if (movil || !cabeza || !columna) {
      zona = null;
      return;
    }
    const caja = cabeza.getBoundingClientRect();
    const col = columna.getBoundingClientRect();
    const tramo = Number.parseFloat(getComputedStyle(cabeza).getPropertyValue('--ficha-zona-tramo')) || 48;
    zona = caja.width ? Math.max(0, (col.left - caja.left - tramo) / caja.width) : null;
  }

  onMount(() => {
    const query = window.matchMedia(MOBILE_QUERY);
    const onChange = () => (movil = query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  });

  $effect(() => {
    void ancho, movil, columna;
    medirZona();
  });
</script>

<header class="ficha-cabeza" bind:this={cabeza} bind:clientWidth={ancho} bind:clientHeight={altoCabeza} style:--ficha-cenefa-alto="{alto}px">
  <Cenefa {nombre} {rol} {portada} {alto} zonaDerecha={zona} class="ficha-cabeza__cenefa" />

  <div class="l-container l-container--wide ficha-cabeza__contenido">
    {#if breadcrumbs?.length}
      <Breadcrumbs items={breadcrumbs} class="ficha-cabeza__migas" />
    {/if}

    <h1 class="ficha-cabeza__titulo">{nombre}</h1>

    <div class="ficha-cabeza__fila">
      {#if descripcion || acciones}
        <div class="ficha-cabeza__texto">
          {#if descripcion}<p class="ficha-cabeza__descripcion">{descripcion}</p>{/if}
          {#if acciones}<div class="ficha-cabeza__acciones">{@render acciones()}</div>{/if}
        </div>
      {/if}
      <div class="ficha-cabeza__columna" bind:this={columna}>
        <FichaDatos {datos} entidad={nombre} />
      </div>
    </div>
  </div>
</header>

<style>
  .ficha-cabeza {
    --ficha-zona-tramo: var(--space-7);
    position: relative;
    isolation: isolate;
  }

  .ficha-cabeza :global(.ficha-cabeza__cenefa) {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    z-index: -1;
  }

  /* Desktop: el bloque llena la cenefa (400 como mínimo); las migas arriba y
     el título con los datos apoyados en su borde inferior. */
  .ficha-cabeza__contenido {
    display: flex;
    flex-direction: column;
    min-height: var(--ficha-cenefa-h);
    box-sizing: border-box;
    padding-top: var(--space-3);
    padding-bottom: var(--perfil-cabeza-pad);
  }

  .ficha-cabeza :global(.ficha-cabeza__migas) { margin-bottom: auto; padding-bottom: var(--space-4); }
  /* Sobre la cenefa las migas suben de tono: con --color-texto-medio, una portada muy clara las deja en 3,8:1 (U34). */
  .ficha-cabeza :global(.ficha-cabeza__migas .ui-crumbs__link),
  .ficha-cabeza :global(.ficha-cabeza__migas .ui-crumbs__sep) { color: var(--color-texto-cenefa); }
  .ficha-cabeza :global(.ficha-cabeza__migas .ui-crumbs__link:hover) { color: var(--color-acento); }

  .ficha-cabeza__titulo {
    margin: 0;
    color: var(--color-texto);
    font-size: var(--text-entidad);
    font-weight: 700;
    letter-spacing: -0.035em;
    line-height: var(--text-entidad-lh);
    overflow-wrap: break-word;
  }

  /* Debajo del título: texto a la izquierda y la columna de 372 a la derecha. */
  .ficha-cabeza__fila {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--space-4) var(--space-6);
    margin-top: var(--space-5);
  }
  .ficha-cabeza__texto { flex: 1 1 auto; min-width: 0; }
  .ficha-cabeza__columna { flex: none; width: var(--ficha-columna-w); margin-left: auto; }

  .ficha-cabeza__descripcion {
    max-width: var(--measure-reading);
    margin: 0;
    color: var(--color-texto-alto);
    font-size: var(--text-lg);
    line-height: 1.625rem;
  }

  .ficha-cabeza__acciones { display: flex; flex-wrap: wrap; gap: var(--space-2); }
  .ficha-cabeza__descripcion + .ficha-cabeza__acciones { margin-top: var(--space-4); }
  /* Botones sobre la cenefa: 40 de alto y fondo al 70 %, como en el perfil. */
  .ficha-cabeza__acciones :global(.ui-btn) { --btn-h: var(--control-h-md); }
  .ficha-cabeza__acciones :global(.ui-btn--secondary:not(:hover)) { background: var(--color-boton-cenefa); }

  /* Móvil: cenefa de 180 con las migas encima; título, texto y datos debajo. */
  @media (max-width: 768px) {
    .ficha-cabeza__contenido {
      display: block;
      min-height: 0;
      padding-top: var(--space-2);
      padding-bottom: 0;
    }
    .ficha-cabeza :global(.ficha-cabeza__migas) {
      height: calc(var(--ficha-cenefa-h-movil) - var(--space-2));
      margin: 0;
      padding: 0;
    }
    .ficha-cabeza__titulo {
      margin-top: var(--space-5);
      font-size: var(--text-entidad-m);
      line-height: var(--text-entidad-m-lh);
    }
    .ficha-cabeza__fila { display: block; margin-top: var(--space-3); }
    .ficha-cabeza__descripcion { font-size: var(--text-md); line-height: 1.5rem; }
    .ficha-cabeza__columna { width: auto; margin-top: var(--space-5); }
    .ficha-cabeza__acciones :global(.ui-btn) { --btn-h: var(--control-h-lg); }
  }
</style>
