<script module lang="ts">
  export type Crumb = { label: string; href?: string };
</script>

<script lang="ts">
  type Props = {
    /** Del más general al actual. El último es la página actual y no se enlaza. */
    items: Crumb[];
    label?: string;
    class?: string;
  };

  let { items, label = 'Migas de pan', class: className = '' }: Props = $props();
</script>

<nav class="ui-crumbs {className}" aria-label={label}>
  <ol class="ui-crumbs__list">
    {#each items as item, index}
      {@const isCurrent = index === items.length - 1}
      <li class="ui-crumbs__item">
        {#if index > 0}<span class="ui-crumbs__sep" aria-hidden="true">›</span>{/if}
        {#if isCurrent || !item.href}
          <span class="ui-crumbs__current" aria-current={isCurrent ? 'page' : undefined}>{item.label}</span>
        {:else}
          <a class="ui-crumbs__link" href={item.href}>{item.label}</a>
        {/if}
      </li>
    {/each}
  </ol>
</nav>

<style>
  .ui-crumbs__list {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: var(--text-sm);
    line-height: 1.3;
  }

  .ui-crumbs__item {
    display: inline-flex;
    align-items: center;
    min-width: 0;
  }

  .ui-crumbs__sep {
    padding: 0 var(--space-2);
    color: var(--color-texto-tenue);
  }

  /* Enlaces de texto con área táctil de 44 de alto. */
  .ui-crumbs__link {
    position: relative;
    display: inline-flex;
    align-items: center;
    min-height: var(--target-touch);
    color: var(--color-texto-medio);
    font-weight: 600;
    text-decoration: none;
  }
  .ui-crumbs__link::after {
    content: '';
    position: absolute;
    inset-block: 0;
    inset-inline: min(0px, calc((100% - var(--target-touch)) / 2));
  }
  .ui-crumbs__link:hover { color: var(--color-acento); text-decoration: underline; text-underline-offset: .25em; }
  .ui-crumbs__link:focus-visible {
    outline: 2px solid var(--focus-ring-color);
    outline-offset: 2px;
    border-radius: var(--radius-xs);
  }

  .ui-crumbs__current {
    overflow: hidden;
    color: var(--color-texto);
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
