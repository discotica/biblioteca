<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { legacyStudioHref } from '$lib/domain/studio';

  // /admin/catalogo y /editorial se unieron en el Estudio (U15). El enlace
  // viejo se reemplaza en el historial por su sección, con la misma query y
  // hash; los permisos los vuelve a decidir el Estudio. En el servidor, la
  // misma regla es un 301 en static/.htaccess.
  onMount(() => {
    const { pathname, search, hash } = window.location;
    goto(legacyStudioHref(pathname, search, hash) ?? '/estudio', { replaceState: true });
  });
</script>
