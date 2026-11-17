<script lang="ts">
  // Bienvenida del inicio (E20; permanente desde U11; U29: texto de la franja).
  // Bloque en el flujo, no modal: la regla de sesión (una vez por pestaña, solo
  // al entrar directo a /) la decide la página con welcomeSession.ts. Aquí solo
  // se pone el contenido en el hueco de la franja.
  import FranjaCabeza from './FranjaCabeza.svelte';
  import { WELCOME_CONTENT, type WelcomeContent } from '$lib/content/welcome';

  type Props = {
    content?: WelcomeContent;
    onclose?: () => void;
  };

  let { content = WELCOME_CONTENT, onclose }: Props = $props();
</script>

<FranjaCabeza
  id="welcome-title"
  titulo={content.title}
  texto={content.description}
  closeLabel={content.closeLabel}
  {onclose}
  data-welcome-banner
/>
