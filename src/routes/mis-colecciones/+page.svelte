<script lang="ts">
  // Mis colecciones desapareció en U31 (plan de dirección de arte, tablero L):
  // el perfil propio es la casa y lleva sus colecciones, privadas incluidas.
  // Los enlaces viejos (correos de U12, marcadores, /mis-crates) aterrizan en el
  // perfil con su query y su hash: `?aviso=` muestra el aviso allí y `?crear=1`
  // abre el diálogo. Apache no sabe de quién es la sesión, así que no hay 301
  // en static/.htaccess: la regla es solo esta, en el cliente.
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { ownProfilePath } from '$lib/services/profiles';

  onMount(async () => {
    const { search, hash } = window.location;
    await goto(`${await ownProfilePath()}${search}${hash}`, { replaceState: true });
  });
</script>

<svelte:head>
  <title>Tu perfil — Biblioteca Discótica</title>
</svelte:head>
