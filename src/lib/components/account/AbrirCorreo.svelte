<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Button } from '$lib/ui';
  import { WEBMAILS } from '$lib/domain/account';

  type Props = {
    /** Acciones que siguen a los dos webmails (p. ej. Reenviar). */
    children?: Snippet;
  };

  let { children }: Props = $props();
</script>

<!--
  «Abrir Gmail» y «Abrir Outlook» (D4: siempre los dos, sin adivinar el
  proveedor del correo), en verde y con el icono externo.
-->
<div class="abrir-correo">
  {#each WEBMAILS as webmail (webmail.label)}
    <Button href={webmail.url} target="_blank" rel="noopener" size="form" iconEnd="flecha-externa">
      Abrir {webmail.label}<span class="sr-only"> (se abre en otra pestaña)</span>
    </Button>
  {/each}
  {@render children?.()}
</div>

<style>
  .abrir-correo {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
</style>
