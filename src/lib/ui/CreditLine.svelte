<script lang="ts">
  import { summarizeReleaseCredits, VARIOUS_ARTISTS_LABEL, type ArtistCredit, type Release } from '$lib/domain/releases';
  import Menu, { type MenuGroup } from './Menu.svelte';
  import { creditRoleGroups, defaultArtistHref } from './credits';

  type Props = {
    release: Pick<Release, 'releaseType' | 'primaryArtists' | 'collaborators'>;
    /**
     * line: una línea con la regla de R2 (tarjeta). Los nombres se truncan con
     * elipsis; "y N más" nunca se oculta. En un Compilado, "Varios artistas" abre
     * un menú con todos los créditos por rol.
     * roles: todos los artistas agrupados por rol, sin truncar (ficha).
     */
    variant?: 'line' | 'roles';
    /** Enlace de cada crédito. Por defecto /artista/{slug}; sin slug no se enlaza. */
    hrefFor?: (credit: ArtistCredit) => string | null;
    class?: string;
  };

  let { release, variant = 'line', hrefFor = defaultArtistHref, class: className = '' }: Props = $props();

  const summary = $derived(summarizeReleaseCredits(release));
  const groups = $derived(creditRoleGroups(release));
  const namesKind = $derived((release.primaryArtists ?? []).length ? 'primary' : 'collaborator');
  /** Colaboradores fuera de la línea, para la ayuda al pasar el cursor. */
  const moreTitle = $derived((release.collaborators ?? []).map((credit) => credit.name).join(', '));
  const menuGroups = $derived<MenuGroup[]>(
    groups.map((group) => ({
      label: group.label,
      items: group.credits.map((credit) => ({ label: credit.name, href: hrefFor(credit) ?? undefined }))
    }))
  );

  const creditKey = (credit: ArtistCredit) => credit.id ?? credit.slug ?? credit.name;
</script>

{#snippet name(credit: ArtistCredit)}
  {@const href = hrefFor(credit)}
  {#if href}<a {href} title={credit.name}>{credit.name}</a>{:else}<span title={credit.name}>{credit.name}</span>{/if}
{/snippet}

{#if variant === 'roles'}
  {#if groups.length}
    <dl class="ui-credits {className}">
      {#each groups as group (group.role)}
        <div class="ui-credits__group ui-credits__group--{group.role}">
          <dt class="ui-credits__role">{group.label}</dt>
          <dd class="ui-credits__names">
            {#each group.credits as credit, index (`${group.role}-${creditKey(credit)}`)}
              <!-- Cada nombre es una unidad y la línea se parte tras la coma (<wbr>):
                   Svelte recorta el espacio, así que sin esto se partía dentro de un nombre (U9). -->
              <span class="ui-credits__name">{@render name(credit)}{#if index < group.credits.length - 1}<span class="ui-credits__sep" aria-hidden="true">,</span>{/if}</span>{#if index < group.credits.length - 1}<wbr />{/if}
            {/each}
          </dd>
        </div>
      {/each}
    </dl>
  {/if}
{:else if summary.names.length || summary.various}
  <div class="ui-credit-line ui-credit-line--{namesKind} {className}">
    {#if summary.various}
      <Menu buttonLabel={VARIOUS_ARTISTS_LABEL} label="Créditos del lanzamiento" variant="link" size="sm" align="start" groups={menuGroups} />
    {:else}
      <span class="sr-only">{namesKind === 'primary' ? 'Artistas principales' : 'Colaboradores'}: </span>
      <span class="ui-credit-line__names">
        {#each summary.names as credit, index (`${namesKind}-${creditKey(credit)}`)}
          {@render name(credit)}{#if index < summary.names.length - 1}<span class="ui-credits__sep" aria-hidden="true">,</span>{/if}
        {/each}
      </span>
      {#if summary.moreLabel}
        <span class="ui-credit-line__more" title={moreTitle}>{summary.moreLabel}</span>
      {/if}
    {/if}
  </div>
{/if}

<style>
  /* ---- Una línea (tarjeta) ---- */
  .ui-credit-line {
    display: flex;
    align-items: baseline;
    min-width: 0;
    font-size: var(--text-xs);
    line-height: 1.4;
  }
  /* Los nombres ceden ancho y se truncan; "y N más" no se encoge nunca. */
  .ui-credit-line__names { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ui-credit-line--primary .ui-credit-line__names { color: var(--color-acento); font-weight: 600; }
  .ui-credit-line--collaborator .ui-credit-line__names { color: var(--color-texto-secundario); }
  .ui-credit-line__more { flex: none; margin-inline-start: .3em; color: var(--color-texto-secundario); white-space: nowrap; }
  /* "Varios artistas" ocupa la línea de texto, no la caja de 32 del Button sm (U8):
     la fila mide lo mismo en un Compilado. El área táctil sigue en 44 (::after). */
  .ui-credit-line :global(.ui-menu__trigger) { --btn-h: auto; }

  .ui-credit-line a,
  .ui-credits a { color: inherit; text-decoration: none; }
  .ui-credit-line a:hover,
  .ui-credits a:hover { color: var(--color-texto); text-decoration: underline; }
  .ui-credit-line a:focus-visible,
  .ui-credits a:focus-visible { outline: 2px solid var(--focus-ring-color); outline-offset: 2px; border-radius: var(--radius-xs); }

  /* La separación tras la coma es margen: Svelte 5 recorta el espacio final de un span (R2). */
  .ui-credits__sep { margin-inline-end: .3em; }

  /* ---- Por rol (ficha) ---- */
  .ui-credits { display: grid; gap: var(--space-3); margin: 0; }
  .ui-credits__group { display: grid; gap: var(--space-1); }
  .ui-credits__role {
    color: var(--color-texto-tenue);
    font-size: var(--text-2xs);
    font-weight: 700;
    letter-spacing: var(--nav-letter-spacing);
    text-transform: uppercase;
  }
  .ui-credits__names { margin: 0; color: var(--color-texto); font-size: var(--text-md); line-height: 1.5; overflow-wrap: anywhere; }
  /* Unidad atómica: la línea se parte entre nombres; un nombre más largo que la
     línea se parte por dentro (max-width). */
  .ui-credits__name { display: inline-block; max-width: 100%; }
  .ui-credits__group--primary .ui-credits__names { color: var(--color-acento); font-weight: 600; }
</style>
